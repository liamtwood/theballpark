import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { PageHeroComponent } from '../../../shell/page-hero/page-hero.component';
import { SelectComponent, SelectOption } from '../../../shared/select/select.component';
import { CatalogueSearchComponent } from '../../../shared/catalogue/catalogue-search.component';
import { ConfirmService } from '../../../shared/confirm/confirm.service';
import { AdminOrgService, AdminOrg, CreateOrgInput } from '../../../core/admin-org.service';
import { OrgTypeStripComponent, OrgTypeBucket } from './org-type-strip.component';

const TYPE_OPTIONS: SelectOption[] = [
  { label: 'Agency', value: 'agency' },
  { label: 'Supplier', value: 'supplier' },
  { label: 'Ballpark', value: 'ballpark' },
];
const STATUS_OPTIONS: SelectOption[] = [
  { label: 'All statuses', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Suspended', value: 'suspended' },
];
/** Stale 'admin' org type is canonically 'ballpark' (normalizeOrgType mirrors this). */
const normType = (t: string): string => (t === 'admin' ? 'ballpark' : t);

// Fetch-from-website extraction: the 6 fields the lean form renders as inputs,
// vs the ones it doesn't (branding + About + reg details). BE-00127 QC: the form
// stays lean, but a create-from-Fetch must PERSIST the non-visible extracted
// fields too, so a supplier lands with its branding/About already populated.
const VISIBLE_KEYS = ['name', 'website', 'city', 'country', 'phone', 'email'] as const;
const EXTRA_KEYS = ['description', 'logo_url', 'cover_image_url', 'address', 'company_number', 'vat_number', 'default_currency'] as const;

const emptyForm = (): CreateOrgInput => ({
  name: '', type: 'supplier', website: '', city: '', country: '', phone: '', email: '',
});

/** pV2-ADMIN-ORGS-UX-01 — admin Orgs page, marketplace-consistent: a flat type
 *  rail (owns type), catalogue-search, a filter-toggle → Status filter, a Status
 *  pill + single contextual Activate/Suspend action, and a read-only storefront
 *  preview pane. Independent of MarketplaceStore (assembled from drop-in pieces +
 *  a thin org-type-strip fork). Backend unchanged (BE-00127). */
@Component({
  selector: 'app-orgs-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, LucideAngularModule, TooltipModule, ToastModule,
    PageHeroComponent, SelectComponent, CatalogueSearchComponent,
    OrgTypeStripComponent,
  ],
  providers: [MessageService],
  // bp-vpfit (md+): the page fills the viewport — hero + control bar + rail stay
  // anchored and only the table body scrolls internally (marketplace parity).
  host: { class: 'block bp-vpfit' },
  template: `
    <app-page-hero
      align="block"
      [back]="{ label: 'Back', href: '/admin' }"
      title="Organisations"
      subtitle="Every agency, supplier and platform org. Create one, or import a supplier from its website."
    >
      <button hero-actions type="button" class="bp-btn-grad" (click)="toggleCreate()">
        {{ showCreate() ? 'Close' : '+ Add organisation' }}
      </button>
    </app-page-hero>

    <div class="bp-page-body bp-page-body--workspace">
      <!-- Control bar — search + filter toggle (Add lives in the hero, top-right). -->
      <div class="mb-4 flex shrink-0 items-center gap-3">
        <div class="min-w-0 flex-1">
          <app-catalogue-search [value]="search()" [count]="filtered().length" (valueChange)="search.set($event)" />
        </div>
        <div class="inline-flex items-center rounded-[var(--radius-pill)] border border-hairline bg-surface p-1">
          <button type="button" class="bp-viewtoggle" [class.bp-viewtoggle--active]="showFilters()"
            pTooltip="Filter" tooltipStyleClass="bp-tooltip" tooltipPosition="top"
            aria-label="Filter" (click)="showFilters.set(!showFilters())">
            <lucide-icon name="sliders-horizontal" [size]="15" />
          </button>
        </div>
      </div>

      <!-- Filter row (status only — type is the rail, name is the search). -->
      @if (showFilters()) {
        <div class="mb-4 flex shrink-0 items-center gap-2">
          <span class="bp-field-label">Status</span>
          <app-select ariaLabel="Status" class="w-44" [compact]="true" [options]="statusOptions"
            [value]="statusFilter()" (changed)="statusFilter.set($event)" />
        </div>
      }

      <!-- Create form (lean; website Fetch pre-fills by confidence). -->
      @if (showCreate()) {
        <div class="mb-6 shrink-0 rounded-xl border border-hairline bg-surface p-4">
          <h3 class="bp-edit-section-title mb-3">New organisation</h3>
          <label class="block">
            <span class="bp-field-label">Website</span>
            <div class="mt-1 flex gap-2">
              <input class="ed-input min-w-0 flex-1" [(ngModel)]="form.website" (ngModelChange)="clearFlag('website')"
                placeholder="https://example.com" (keydown.enter)="fetchFromWebsite()" />
              <button type="button" class="bp-btn-outline shrink-0" [disabled]="fetching() || !form.website?.trim()"
                (click)="fetchFromWebsite()">{{ fetching() ? 'Fetching…' : 'Fetch' }}</button>
            </div>
          </label>
          <div class="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <label class="block">
              <span class="bp-field-label">Name *</span>
              <input class="ed-input mt-1 w-full" [(ngModel)]="form.name" (ngModelChange)="clearFlag('name')" placeholder="Organisation name" />
              @if (flagged().has('name')) { <span class="bp-caption text-warn">Auto-filled — please check</span> }
            </label>
            <label class="block">
              <span class="bp-field-label">Type</span>
              <app-select class="mt-1 block" ariaLabel="Type" [options]="typeOptions" [value]="form.type" (changed)="form.type = $event" />
            </label>
            <label class="block">
              <span class="bp-field-label">City</span>
              <input class="ed-input mt-1 w-full" [(ngModel)]="form.city" (ngModelChange)="clearFlag('city')" />
              @if (flagged().has('city')) { <span class="bp-caption text-warn">Auto-filled — please check</span> }
            </label>
            <label class="block">
              <span class="bp-field-label">Country</span>
              <input class="ed-input mt-1 w-full" [(ngModel)]="form.country" (ngModelChange)="clearFlag('country')" placeholder="e.g. GB" />
              @if (flagged().has('country')) { <span class="bp-caption text-warn">Auto-filled — please check</span> }
            </label>
            <label class="block">
              <span class="bp-field-label">Phone</span>
              <input class="ed-input mt-1 w-full" [(ngModel)]="form.phone" (ngModelChange)="clearFlag('phone')" />
              @if (flagged().has('phone')) { <span class="bp-caption text-warn">Auto-filled — please check</span> }
            </label>
            <label class="block">
              <span class="bp-field-label">Email</span>
              <input class="ed-input mt-1 w-full" type="email" [(ngModel)]="form.email" (ngModelChange)="clearFlag('email')" placeholder="contact@company.com" />
              @if (flagged().has('email')) { <span class="bp-caption text-warn">Auto-filled — please check</span> }
            </label>
          </div>
          <div class="mt-4 flex justify-end gap-2">
            <button type="button" class="bp-btn-outline" (click)="toggleCreate()">Cancel</button>
            <button type="button" class="bp-btn-grad" [disabled]="saving() || !form.name.trim()" (click)="submit()">
              {{ saving() ? 'Creating…' : 'Create organisation' }}
            </button>
          </div>
        </div>
      }

      <!-- Rail + table in ONE white rounded workspace card; only the table BODY
           scrolls (marketplace parity — page/rail/controls/header stay fixed). -->
      <div class="flex min-h-0 flex-1 flex-col rounded-[var(--radius-lg)] border border-hairline bg-surface p-4 shadow-[var(--shadow-md)]">
        <div class="flex min-h-0 flex-1 gap-6">
          <aside class="hidden w-[200px] shrink-0 md:block">
            <div class="rounded-[var(--radius-card)] border border-hairline bg-fill p-2">
              <app-org-type-strip [buckets]="buckets()" [activeId]="typeId()" [totalCount]="orgs().length"
                (selected)="typeId.set($event)" />
            </div>
          </aside>

          <div class="flex min-h-0 min-w-0 flex-1 flex-col">
            @if (loading()) {
              <p class="bp-body-small text-secondary">Loading…</p>
            } @else if (error()) {
              <p class="bp-body-small text-warn">Couldn't load organisations.</p>
            } @else {
              <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-hairline">
                <div class="grid shrink-0 grid-cols-[1fr_100px_120px_100px_120px] items-center gap-x-3 border-b border-hairline bg-fill px-4 py-2">
                  <span class="bp-table-column-header">Name</span>
                  <span class="bp-table-column-header">Type</span>
                  <span class="bp-table-column-header">City</span>
                  <span class="bp-table-column-header">Status</span>
                  <span class="bp-table-column-header text-right">Action</span>
                </div>
                <!-- The scroll area — only this scrolls. -->
                <div class="min-h-0 flex-1 overflow-y-auto">
                  @for (o of filtered(); track o.id) {
                    <div class="grid grid-cols-[1fr_100px_120px_100px_120px] items-center gap-x-3 border-b border-hairline px-4 py-2"
                      [class.bp-orgrow--clickable]="isSupplier(o)"
                      [attr.role]="isSupplier(o) ? 'button' : null" [attr.tabindex]="isSupplier(o) ? 0 : null"
                      (click)="openOrg(o)" (keydown.enter)="openOrg(o)">
                      <div class="min-w-0">
                        <div class="bp-body-small truncate font-medium">{{ o.name }}</div>
                        @if (o.website) { <div class="bp-caption truncate text-secondary">{{ o.website }}</div> }
                      </div>
                      <span class="bp-body-small capitalize">{{ typeLabel(o.type) }}</span>
                      <span class="bp-body-small truncate">{{ o.city || '—' }}</span>
                      <span>
                        <span class="bp-orgpill" [class.bp-orgpill--active]="o.is_active" [class.bp-orgpill--suspended]="!o.is_active">
                          {{ o.is_active ? 'Active' : 'Suspended' }}
                        </span>
                      </span>
                      <div class="flex justify-end">
                        @if (o.is_active) {
                          <button type="button" class="bp-orgact bp-orgact--suspend" [disabled]="busyId() === o.id"
                            (click)="suspend(o); $event.stopPropagation()">Suspend</button>
                        } @else {
                          <button type="button" class="bp-orgact bp-orgact--activate" [disabled]="busyId() === o.id"
                            (click)="activate(o); $event.stopPropagation()">Activate</button>
                        }
                      </div>
                    </div>
                  } @empty {
                    <div class="px-4 py-6 bp-body-small text-secondary">No organisations match.</div>
                  }
                </div>
              </div>
              <p class="bp-caption mt-2 shrink-0 text-secondary">{{ filtered().length }} of {{ orgs().length }} organisations</p>
            }
          </div>
        </div>
      </div>
    </div>

    <p-toast position="bottom-right" styleClass="bp-toast" />
  `,
  styles: [`
    .bp-orgpill { display: inline-flex; align-items: center; border-radius: var(--radius-pill, 999px);
      padding: 2px 10px; font-size: var(--text-sm); font-weight: 500; }
    .bp-orgpill--active { background: var(--color-success-soft); color: var(--color-success); }
    .bp-orgpill--suspended { background: var(--color-fill); color: var(--color-text-secondary); }
    .bp-orgact { height: 28px; padding: 0 12px; border-radius: var(--radius-input, 8px);
      border: 1px solid transparent; font-size: var(--text-sm); font-weight: 500; cursor: pointer; }
    .bp-orgact:disabled { opacity: 0.5; cursor: default; }
    .bp-orgact--suspend { background: var(--color-danger-soft); color: var(--color-danger); }
    .bp-orgact--activate { background: var(--color-success-soft); color: var(--color-success); }
    .bp-row--selected { background: var(--color-fill); }
    .bp-orgrow--clickable { cursor: pointer; }
    .bp-orgrow--clickable:hover { background: var(--color-fill); }
  `],
})
export class OrgsAdminComponent {
  private readonly svc = inject(AdminOrgService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  protected readonly typeOptions = TYPE_OPTIONS;
  protected readonly statusOptions = STATUS_OPTIONS;

  protected readonly orgs = signal<AdminOrg[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly typeId = signal('all');           // rail owns type
  protected readonly search = signal('');
  protected readonly statusFilter = signal('all');
  protected readonly showFilters = signal(false);
  protected readonly showCreate = signal(false);
  protected readonly saving = signal(false);
  protected readonly busyId = signal<string | null>(null);
  protected readonly fetching = signal(false);
  protected readonly flagged = signal<Set<string>>(new Set());
  /** High-confidence extracted fields the lean form doesn't render (branding +
   *  About + reg details) — carried through to create so they persist. */
  private readonly extracted = signal<Partial<CreateOrgInput>>({});

  protected form: CreateOrgInput = emptyForm();

  /** Type buckets for the rail (normalised so stale 'admin' counts as Ballpark). */
  protected readonly buckets = computed<OrgTypeBucket[]>(() => {
    const count = (t: string) => this.orgs().filter((o) => normType(o.type) === t).length;
    return [
      { id: 'agency', name: 'Agents', count: count('agency') },
      { id: 'supplier', name: 'Suppliers', count: count('supplier') },
      { id: 'ballpark', name: 'Admin', count: count('ballpark') },
    ];
  });

  protected readonly filtered = computed(() => {
    const t = this.typeId();
    const q = this.search().trim().toLowerCase();
    const s = this.statusFilter();
    return this.orgs().filter((o) => {
      if (t !== 'all' && normType(o.type) !== t) return false;
      if (s === 'active' && !o.is_active) return false;
      if (s === 'suspended' && o.is_active) return false;
      if (!q) return true;
      return [o.name, o.city, o.email].some((v) => (v || '').toLowerCase().includes(q));
    });
  });

  constructor() {
    void this.load();
  }

  protected typeLabel(t: string): string {
    return normType(t) === 'ballpark' ? 'Ballpark' : t;
  }

  /** Only supplier rows navigate — /suppliers/:id (supplier-detail) assumes a
   *  supplier/storefront; agency/ballpark rows would hit "Supplier not found". */
  protected isSupplier(o: AdminOrg): boolean {
    return normType(o.type) === 'supplier';
  }

  protected openOrg(o: AdminOrg): void {
    if (this.isSupplier(o)) void this.router.navigate(['/suppliers', o.id]);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      this.orgs.set(await firstValueFrom(this.svc.list()));
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected toggleCreate(): void {
    this.showCreate.update((v) => !v);
    if (!this.showCreate()) { this.form = emptyForm(); this.flagged.set(new Set()); this.extracted.set({}); }
  }

  protected clearFlag(k: string): void {
    const s = this.flagged();
    if (s.has(k)) { const n = new Set(s); n.delete(k); this.flagged.set(n); }
  }

  protected async fetchFromWebsite(): Promise<void> {
    const url = (this.form.website || '').trim();
    if (!url || this.fetching()) return;
    this.fetching.set(true);
    try {
      const { org } = await firstValueFrom(this.svc.importPreview(url));
      const flags = new Set<string>();
      const extra: Partial<CreateOrgInput> = {};
      // Route every non-low extracted field: VISIBLE ones pre-fill the form (medium
      // → flag for a check); the rest (branding/About/reg) are stashed to persist
      // on create even though the lean form doesn't render them.
      for (const [key, f] of Object.entries(org)) {
        if (!f || f.confidence === 'low') continue;
        if ((VISIBLE_KEYS as readonly string[]).includes(key)) {
          this.form[key as keyof CreateOrgInput] = f.value as never;
          if (f.confidence === 'medium') flags.add(key);
        } else if ((EXTRA_KEYS as readonly string[]).includes(key)) {
          extra[key as keyof CreateOrgInput] = f.value as never;
        }
      }
      this.extracted.set(extra);
      this.flagged.set(flags);
      const found = Object.keys(org).length > 0;
      this.toast.add({
        severity: found ? 'success' : 'info',
        summary: found ? 'Pre-filled from website — check any flagged fields' : 'Nothing found — fill manually',
      });
    } catch {
      this.toast.add({ severity: 'warn', summary: "Couldn't read that site — fill manually" });
    } finally {
      this.fetching.set(false);
    }
  }

  protected async submit(): Promise<void> {
    if (this.saving() || !this.form.name.trim()) return;
    this.saving.set(true);
    try {
      const created = await firstValueFrom(this.svc.create(this.cleaned()));
      this.orgs.update((list) => [created, ...list]);
      this.toast.add({ severity: 'success', summary: `${created.name} created` });
      this.form = emptyForm();
      this.flagged.set(new Set());
      this.extracted.set({});
      this.showCreate.set(false);
    } catch {
      this.toast.add({ severity: 'error', summary: 'Failed to create organisation' });
    } finally {
      this.saving.set(false);
    }
  }

  /** Active → Suspend: confirm first (guards an accidental suspend). */
  protected async suspend(o: AdminOrg): Promise<void> {
    if (this.busyId()) return;
    const ok = await this.confirm.ask({
      title: `Suspend “${o.name}”?`,
      message: 'They will be hidden from the marketplace until reactivated.',
      confirmLabel: 'Suspend',
      cancelLabel: 'Cancel',
      danger: true,
      icon: 'circle-off',
    });
    if (!ok) return;
    await this.setActive(o, false);
  }

  /** Suspended → Activate: direct (no confirm). */
  protected async activate(o: AdminOrg): Promise<void> {
    if (this.busyId()) return;
    await this.setActive(o, true);
  }

  private async setActive(o: AdminOrg, active: boolean): Promise<void> {
    this.busyId.set(o.id);
    try {
      const updated = await firstValueFrom(this.svc.setActive(o.id, active));
      this.orgs.update((list) => list.map((x) => (x.id === o.id ? updated : x)));
      this.toast.add({ severity: 'success', summary: `${o.name} ${active ? 'activated' : 'suspended'}` });
    } catch {
      this.toast.add({ severity: 'error', summary: 'Failed to update status' });
    } finally {
      this.busyId.set(null);
    }
  }

  private cleaned(): CreateOrgInput {
    // Start from the non-visible extracted fields (branding/About/reg) so a
    // create-from-Fetch persists them; the visible form fields overlay on top.
    const out: Record<string, unknown> = { ...this.extracted(), name: this.form.name.trim(), type: this.form.type };
    for (const k of VISIBLE_KEYS) {
      if (k === 'name') continue;
      const v = (this.form[k] || '').trim();
      if (v) out[k] = v;
    }
    for (const k of Object.keys(out)) { if (out[k] === '' || out[k] == null) delete out[k]; }
    return out as unknown as CreateOrgInput;
  }
}
