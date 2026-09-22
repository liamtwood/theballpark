import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AdminOrgService, ExtractReport, PullResult } from '../../core/admin-org.service';

/**
 * pV2-STORE-EXTRACT-01 — admin "Import from website" panel (Analyse → Pull).
 * Platform-admin only; lives on the supplier Shop tab. Analyse is read-only;
 * Pull creates PENDING items on the org (reviewed via Approvals). Curation is
 * the existing item editor — no curation UI here. Deliberately minimal: the real
 * extract data tells us what to build next.
 */
@Component({
  selector: 'app-website-import-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FormsModule, LucideAngularModule],
  template: `
    <div class="bp-card" style="padding:1rem; margin-bottom:1rem;">
      <div class="flex items-center gap-2 mb-2">
        <lucide-icon name="globe" [size]="16" class="text-secondary" />
        <span class="bp-body font-medium">Import from website</span>
        <span class="bp-caption text-secondary">Analyse a supplier page, then pull its catalogue as pending items.</span>
      </div>

      <div class="flex gap-2 items-center">
        <input
          type="url"
          class="bp-input-field flex-1"
          placeholder="https://supplier.com/products/…"
          [(ngModel)]="url"
          (keydown.enter)="analyse()"
          [disabled]="analyzing() || pulling()"
        />
        <button type="button" class="bp-btn-outline" [disabled]="!url().trim() || analyzing() || pulling()" (click)="analyse()">
          {{ analyzing() ? 'Analysing…' : 'Analyse' }}
        </button>
      </div>

      @if (error(); as e) { <p class="bp-body-small text-warn mt-2">{{ e }}</p> }

      @if (report(); as r) {
        <div class="mt-3 bp-body-small" style="border-top:1px solid var(--border); padding-top:0.75rem;">
          <div class="flex flex-wrap items-center gap-2 mb-2">
            <span class="bp-pill">{{ r.pageShape }}</span>
            @if (r.mapped?.itemCount != null) { <span class="bp-pill">{{ r.mapped?.itemCount }} items</span> }
            @if (r.mapped?.hasPrice) { <span class="bp-pill">price</span> }
            @if (r.mapped?.hasVolumeTiers) { <span class="bp-pill">tiers</span> }
            @if (r.mapped?.hasOptions) { <span class="bp-pill">options</span> }
            @if (r.mapped?.hasSku) { <span class="bp-pill">SKU</span> }
            @if (r.mapped?.hasImages) { <span class="bp-pill">images</span> }
          </div>
          <p class="mb-2"><strong>Verdict:</strong> {{ r.verdict }}</p>

          @if (r.mapped?.categories?.length) {
            <p class="text-secondary mb-1">Categories: {{ r.mapped?.categories?.join(', ') }}</p>
          }
          @if (r.mapped?.knownAttributes?.length) {
            <p class="text-secondary mb-1">Attributes: {{ r.mapped?.knownAttributes?.join(', ') }}</p>
          }

          @if (r.alsoFound?.length) {
            <details class="mb-2">
              <summary class="cursor-pointer text-secondary">Also found ({{ r.alsoFound?.length }}) — not modelled yet</summary>
              <ul class="mt-1 ml-4" style="list-style:disc;">
                @for (a of r.alsoFound; track a) { <li>{{ a }}</li> }
              </ul>
            </details>
          }

          @if (r.sample; as s) {
            <details class="mb-2">
              <summary class="cursor-pointer text-secondary">Sample item</summary>
              <pre class="mt-1 bp-caption" style="white-space:pre-wrap; overflow-x:auto;">{{ pretty(s) }}</pre>
            </details>
          }

          <!-- The task list: pick which item pages to pull (crawl or listing).
               A single detail URL pulls the page itself (no list). -->
          @if (r.productLinks?.length) {
            <div class="flex items-center justify-between mb-1">
              <p class="text-secondary">{{ selected().size }} of {{ r.productLinks?.length }} items selected</p>
              <button type="button" class="bp-caption" style="text-decoration:underline;" (click)="toggleAll()">
                {{ allSelected() ? 'Select none' : 'Select all' }}
              </button>
            </div>
            <div style="max-height:16rem; overflow:auto; border:1px solid var(--border); border-radius:0.5rem; padding:0.5rem;" class="mb-2">
              @for (g of grouped(); track g.category) {
                <div class="mb-1">
                  <!-- Category header (accordion): tick selects the whole group; the
                       row toggles the items open/closed. Collapsed by default. -->
                  <div class="flex items-center gap-2">
                    <input type="checkbox" class="bp-check" [checked]="groupAll(g.items)" [indeterminate]="groupSome(g.items)" (change)="toggleGroup(g.items)" />
                    <button type="button" class="flex items-center gap-1 font-medium bp-accordion-toggle" (click)="toggleExpand(g.category)">
                      <lucide-icon [name]="isExpanded(g.category) ? 'chevron-down' : 'chevron-right'" [size]="14" />
                      <span>{{ g.category }}</span>
                      <span class="text-secondary">({{ g.items.length }})</span>
                    </button>
                  </div>
                  @if (isExpanded(g.category)) {
                    <div class="ml-8 mt-0.5">
                      @for (link of g.items; track link) {
                        <label class="flex items-center gap-2 mb-0.5">
                          <input type="checkbox" class="bp-check" [checked]="selected().has(link)" (change)="toggle(link)" />
                          <span class="truncate">{{ leaf(link) }}</span>
                        </label>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }

          @if (canPull()) {
            <button type="button" class="bp-btn-grad" [disabled]="pulling()" (click)="pull()">
              {{ pulling() ? 'Pulling…' : pullLabel() }}
            </button>
          } @else {
            <p class="text-secondary">Nothing to pull from this page.</p>
          }
        </div>
      }

      @if (result(); as res) {
        <div class="mt-3 bp-body-small" style="border-top:1px solid var(--border); padding-top:0.75rem;">
          <p class="mb-1"><strong>{{ res.created }}</strong> created · {{ res.skipped }} skipped · {{ res.failed }} failed — all pending, review in Approvals.</p>
          @for (row of res.results; track row.url) {
            <p class="text-secondary truncate">
              {{ row.status === 'created' ? '✓' : row.status === 'skipped' ? '·' : '✕' }}
              {{ row.name || row.url }}{{ row.reason ? ' — ' + row.reason : '' }}{{ row.optionCount ? ' (' + row.optionCount + ' options)' : '' }}
            </p>
          }
        </div>
      }
    </div>
  `,
})
export class WebsiteImportPanelComponent {
  private readonly admin = inject(AdminOrgService);

  /** The org (supplier) to import into. */
  readonly orgId = input.required<string>();
  /** Emitted after a successful pull so the parent can reload its item grid. */
  readonly pulled = output<PullResult>();

  protected readonly url = signal('');
  protected readonly analyzing = signal(false);
  protected readonly pulling = signal(false);
  protected readonly report = signal<ExtractReport | null>(null);
  protected readonly result = signal<PullResult | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly selected = signal<Set<string>>(new Set());

  /** A task list is present (crawl 'site' or a 'listing') — pull the selected subset;
   *  a single 'detail' page pulls itself. */
  protected readonly hasLinks = computed(() => (this.report()?.productLinks?.length ?? 0) > 0);
  protected readonly allSelected = computed(() => {
    const links = this.report()?.productLinks ?? [];
    return links.length > 0 && links.every((u) => this.selected().has(u));
  });
  protected readonly canPull = computed(() => {
    const r = this.report();
    if (!r) return false;
    return this.hasLinks() ? this.selected().size > 0 : r.pageShape === 'detail';
  });
  protected readonly pullLabel = computed(() =>
    this.hasLinks() ? `Pull ${this.selected().size} selected` : 'Pull this product');

  protected toggleAll(): void {
    const links = this.report()?.productLinks ?? [];
    this.selected.set(this.allSelected() ? new Set() : new Set(links));
  }

  /** Task list grouped by category (first path segment), alphabetical. */
  protected readonly grouped = computed(() => {
    const map = new Map<string, string[]>();
    for (const u of this.report()?.productLinks ?? []) {
      let cat = 'other';
      try { cat = new URL(u).pathname.split('/').filter(Boolean)[0] || 'other'; } catch { /* keep default */ }
      (map.get(cat) ?? map.set(cat, []).get(cat)!).push(u);
    }
    return [...map.entries()].map(([category, items]) => ({ category, items }))
      .sort((a, b) => a.category.localeCompare(b.category));
  });
  /** The product slug (last path segment) — the readable per-item label. */
  protected leaf(u: string): string {
    try { const p = new URL(u).pathname.split('/').filter(Boolean); return p[p.length - 1] || u; } catch { return u; }
  }
  /** Accordion: which category groups are expanded (collapsed by default). */
  protected readonly expandedCats = signal<Set<string>>(new Set());
  protected isExpanded(cat: string): boolean { return this.expandedCats().has(cat); }
  protected toggleExpand(cat: string): void {
    const next = new Set(this.expandedCats());
    next.has(cat) ? next.delete(cat) : next.add(cat);
    this.expandedCats.set(next);
  }
  protected groupSelectedCount(items: string[]): number { return items.filter((u) => this.selected().has(u)).length; }

  protected groupAll(items: string[]): boolean { return items.length > 0 && items.every((u) => this.selected().has(u)); }
  protected groupSome(items: string[]): boolean { return !this.groupAll(items) && items.some((u) => this.selected().has(u)); }
  protected toggleGroup(items: string[]): void {
    const next = new Set(this.selected());
    if (this.groupAll(items)) items.forEach((u) => next.delete(u));
    else items.forEach((u) => next.add(u));
    this.selected.set(next);
  }

  protected analyse(): void {
    const url = this.url().trim();
    if (!url) return;
    this.error.set(null);
    this.report.set(null);
    this.result.set(null);
    this.analyzing.set(true);
    this.admin.extractAnalyse(this.orgId(), url).subscribe({
      next: (r) => {
        this.report.set(r);
        // Default-select the whole task list (crawl or listing) so Pull is one click;
        // start with all category groups collapsed (accordion).
        this.selected.set(new Set(r.productLinks ?? []));
        this.expandedCats.set(new Set());
        this.analyzing.set(false);
      },
      error: (e) => { this.error.set(this.msg(e)); this.analyzing.set(false); },
    });
  }

  protected toggle(link: string): void {
    const next = new Set(this.selected());
    next.has(link) ? next.delete(link) : next.add(link);
    this.selected.set(next);
  }

  protected pull(): void {
    const r = this.report();
    if (!r) return;
    const urls = this.hasLinks() ? [...this.selected()] : [r.url];
    if (!urls.length) return;
    this.error.set(null);
    this.pulling.set(true);
    this.admin.extractPull(this.orgId(), urls).subscribe({
      next: (res) => { this.result.set(res); this.pulling.set(false); this.pulled.emit(res); },
      error: (e) => { this.error.set(this.msg(e)); this.pulling.set(false); },
    });
  }

  protected pretty(o: unknown): string { try { return JSON.stringify(o, null, 2); } catch { return String(o); } }
  private msg(e: unknown): string {
    const err = e as { error?: { error?: string }; message?: string };
    return err?.error?.error || err?.message || 'Something went wrong. Please try again.';
  }
}
