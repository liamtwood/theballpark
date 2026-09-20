import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { PageHeroComponent } from '../../../shell/page-hero/page-hero.component';
import { SelectComponent, SelectOption } from '../../../shared/select/select.component';
import { AdminOrgService, AdminOrg, CreateOrgInput } from '../../../core/admin-org.service';

const TYPE_OPTIONS: SelectOption[] = [
  { label: 'Agency', value: 'agency' },
  { label: 'Supplier', value: 'supplier' },
  { label: 'Ballpark', value: 'ballpark' },
];

const emptyForm = (): CreateOrgInput => ({
  name: '', type: 'supplier', website: '', city: '', country: '', phone: '', email: '',
});

/** BE-00127 slice 2 — admin Orgs management: list every org (type filter +
 *  search), create a new one (lean form; website import lands in slice 3), and
 *  approve/suspend (is_active toggle). Lives under the Admin hub (/admin/orgs). */
@Component({
  selector: 'app-orgs-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ToastModule, PageHeroComponent, SelectComponent],
  providers: [MessageService],
  host: { class: 'block' },
  template: `
    <app-page-hero
      align="block"
      [back]="{ label: 'Back', href: '/admin' }"
      title="Organisations"
      subtitle="Every agency, supplier and platform org. Create one, or import a supplier from its website."
    />

    <div class="bp-page-body bp-page-body--workspace">
      <!-- Controls: type filter + search + Add. -->
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <app-select ariaLabel="Type" class="w-40" [compact]="true" [options]="typeFilterOptions"
          [value]="typeFilter()" (changed)="typeFilter.set($event)" />
        <input class="ed-input min-w-[220px] flex-1" type="search" placeholder="Search name, city or email…"
          aria-label="Search organisations" [ngModel]="search()" (input)="search.set($any($event.target).value)" />
        <button type="button" class="bp-btn-grad" (click)="toggleCreate()">
          {{ showCreate() ? 'Close' : '+ Add organisation' }}
        </button>
      </div>

      <!-- Create form (lean). The website Fetch button lands in slice 3. -->
      @if (showCreate()) {
        <div class="mb-6 rounded-xl border border-hairline bg-surface p-4">
          <h3 class="bp-edit-section-title mb-3">New organisation</h3>
          <!-- Website + Fetch (pV2-IMPORT-ORG-01): reads the vendor site and
               pre-fills what it can — high silently, medium flagged, low/none
               left blank. -->
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
              <app-select class="mt-1 block" ariaLabel="Type" [options]="typeOptions" [value]="form.type"
                (changed)="form.type = $event" />
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

      <!-- List -->
      @if (loading()) {
        <p class="bp-body-small text-secondary">Loading…</p>
      } @else if (error()) {
        <p class="bp-body-small text-warn">Couldn't load organisations.</p>
      } @else {
        <div class="overflow-hidden rounded-xl border border-hairline bg-surface">
          <div class="grid grid-cols-[1fr_110px_130px_150px] items-center gap-x-4 border-b border-hairline bg-fill px-4 py-2">
            <span class="bp-table-column-header">Name</span>
            <span class="bp-table-column-header">Type</span>
            <span class="bp-table-column-header">City</span>
            <span class="bp-table-column-header text-right">Status</span>
          </div>
          @for (o of filtered(); track o.id) {
            <div class="grid grid-cols-[1fr_110px_130px_150px] items-center gap-x-4 border-b border-hairline px-4 py-2">
              <div class="min-w-0">
                <div class="bp-body-small truncate font-medium">{{ o.name }}</div>
                @if (o.website) { <div class="bp-caption truncate text-secondary">{{ o.website }}</div> }
              </div>
              <span class="bp-body-small capitalize">{{ o.type }}</span>
              <span class="bp-body-small truncate">{{ o.city || '—' }}</span>
              <div class="flex items-center justify-end gap-2">
                <span class="bp-caption" [class.text-secondary]="!o.is_active">{{ o.is_active ? 'Active' : 'Suspended' }}</span>
                <button type="button" class="bp-btn-outline bp-btn-xs" [disabled]="busyId() === o.id"
                  (click)="toggleActive(o)">
                  {{ o.is_active ? 'Suspend' : 'Approve' }}
                </button>
              </div>
            </div>
          } @empty {
            <div class="px-4 py-6 bp-body-small text-secondary">No organisations match.</div>
          }
        </div>
        <p class="bp-caption mt-2 text-secondary">{{ filtered().length }} of {{ orgs().length }} organisations</p>
      }
    </div>

    <p-toast position="bottom-right" styleClass="bp-toast" />
  `,
  styles: [`
    .bp-btn-xs { height: 28px; padding: 0 10px; font-size: var(--text-sm); }
  `],
})
export class OrgsAdminComponent {
  private readonly svc = inject(AdminOrgService);
  private readonly toast = inject(MessageService);

  protected readonly typeOptions = TYPE_OPTIONS;
  protected readonly typeFilterOptions: SelectOption[] = [{ label: 'All types', value: 'all' }, ...TYPE_OPTIONS];

  protected readonly orgs = signal<AdminOrg[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly typeFilter = signal('all');
  protected readonly search = signal('');
  protected readonly showCreate = signal(false);
  protected readonly saving = signal(false);
  protected readonly busyId = signal<string | null>(null);
  protected readonly fetching = signal(false);
  /** Field keys pre-filled at medium confidence — "please check" until edited. */
  protected readonly flagged = signal<Set<string>>(new Set());

  /** Plain mutable model for the create form (ngModel two-way). */
  protected form: CreateOrgInput = emptyForm();

  protected readonly filtered = computed(() => {
    const t = this.typeFilter();
    const q = this.search().trim().toLowerCase();
    return this.orgs().filter((o) => {
      if (t !== 'all' && o.type !== t) return false;
      if (!q) return true;
      return [o.name, o.city, o.email].some((v) => (v || '').toLowerCase().includes(q));
    });
  });

  constructor() {
    void this.load();
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
    if (!this.showCreate()) { this.form = emptyForm(); this.flagged.set(new Set()); }
  }

  protected clearFlag(k: string): void {
    const s = this.flagged();
    if (s.has(k)) { const n = new Set(s); n.delete(k); this.flagged.set(n); }
  }

  /** pV2-IMPORT-ORG-01 — read the vendor site and pre-fill the lean form fields:
   *  high fills silently, medium fills + flags "please check", low/none skipped. */
  protected async fetchFromWebsite(): Promise<void> {
    const url = (this.form.website || '').trim();
    if (!url || this.fetching()) return;
    this.fetching.set(true);
    try {
      const { org } = await firstValueFrom(this.svc.importPreview(url));
      const flags = new Set<string>();
      const apply = (formKey: keyof CreateOrgInput, importKey: string) => {
        const f = org[importKey];
        if (!f || f.confidence === 'low') return;
        this.form[formKey] = f.value;
        if (f.confidence === 'medium') flags.add(formKey as string);
      };
      apply('name', 'name');
      apply('website', 'website');
      apply('city', 'city');
      apply('country', 'country');
      apply('phone', 'phone');
      apply('email', 'email');
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
      this.showCreate.set(false);
    } catch {
      this.toast.add({ severity: 'error', summary: 'Failed to create organisation' });
    } finally {
      this.saving.set(false);
    }
  }

  protected async toggleActive(o: AdminOrg): Promise<void> {
    if (this.busyId()) return;
    this.busyId.set(o.id);
    const next = !o.is_active;
    try {
      const updated = await firstValueFrom(this.svc.setActive(o.id, next));
      this.orgs.update((list) => list.map((x) => (x.id === o.id ? updated : x)));
      this.toast.add({ severity: 'success', summary: `${o.name} ${next ? 'approved' : 'suspended'}` });
    } catch {
      this.toast.add({ severity: 'error', summary: 'Failed to update status' });
    } finally {
      this.busyId.set(null);
    }
  }

  /** Drop empty strings so the server only writes provided fields. */
  private cleaned(): CreateOrgInput {
    const out: Record<string, unknown> = { name: this.form.name.trim(), type: this.form.type };
    for (const k of ['website', 'city', 'country', 'phone', 'email'] as const) {
      const v = (this.form[k] || '').trim();
      if (v) out[k] = v;
    }
    return out as unknown as CreateOrgInput;
  }
}
