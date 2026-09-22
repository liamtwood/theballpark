import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AdminOrgService, CatNode, ExtractReport, MappingRow, PrepareResult, PullResult } from '../../core/admin-org.service';

/** One editable cat/subcat mapping row in the Prepare step. `subChoice` is a
 *  subcategory id, '' (none), or the '__new__' sentinel (create `newName`). */
interface EditRow { key: string; label: string; categoryId: string | null; subChoice: string; newName: string; }

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
       @if (!result()) {
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
                      <span>{{ groupLabel(g.category) }}</span>
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
            @if (!prepared()) {
              <!-- Step 2 trigger: only AI the groups we're about to load. -->
              <button type="button" class="bp-btn-grad" [disabled]="preparing()" (click)="prepare()">
                {{ preparing() ? 'Preparing…' : 'Prepare ' + selected().size + ' selected' }}
              </button>
            } @else {
              <!-- Step 2: confirm the Ballpark category + subcategory per supplier
                   group (the supplier grouped these; we mirror that). A NEW subcat is
                   created on Load. -->
              <div class="mb-3">
                <p class="font-medium mb-1">Category &amp; subcategory</p>
                @for (row of rows(); track row.key) {
                  <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span class="font-medium truncate" style="min-width:7rem; max-width:9rem;">{{ row.label }}</span>
                    <span class="text-secondary">→</span>
                    <select class="bp-input-field" style="width:auto;" [ngModel]="row.categoryId" (ngModelChange)="setCat(row.key, $event)">
                      @for (c of categories(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
                    </select>
                    <span class="text-secondary">▸</span>
                    <select class="bp-input-field" style="width:auto;" [class.italic]="row.subChoice === '__new__'" [ngModel]="row.subChoice" (ngModelChange)="setSub(row.key, $event)">
                      <option value="">(no subcategory)</option>
                      @for (s of subcatsFor(row.categoryId); track s.id) { <option [value]="s.id">{{ s.name }}</option> }
                      <option value="__new__">＋ Add new…</option>
                    </select>
                    @if (row.subChoice === '__new__') {
                      <input class="bp-input-field italic" style="width:9rem;" [ngModel]="row.newName" (ngModelChange)="setNewName(row.key, $event)" placeholder="New subcategory" />
                      <span class="bp-pill bp-pill--success">NEW</span>
                    }
                  </div>
                }
              </div>
              <!-- Step 3: load type. Review = lean vetting set; Full = everything mappable. -->
              <div class="flex items-center gap-3 mb-2">
                <span class="text-secondary">Load:</span>
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="pullmode" class="bp-radio" [checked]="mode() === 'review'" (change)="mode.set('review')" />
                  <span>Review <span class="text-secondary">— name, description, price, one image</span></span>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="pullmode" class="bp-radio" [checked]="mode() === 'full'" (change)="mode.set('full')" />
                  <span>Full <span class="text-secondary">— everything we can store</span></span>
                </label>
              </div>
              <div class="mt-4">
                <button type="button" class="bp-btn-grad" [disabled]="pulling()" (click)="pull()">
                  {{ pulling() ? 'Loading…' : 'Load ' + selected().size + ' selected' }}
                </button>
                <button type="button" class="bp-caption ml-3" style="text-decoration:underline;" (click)="backToSelection()">Back to selection</button>
              </div>
            }
          } @else {
            <p class="text-secondary">Nothing to pull from this page.</p>
          }
        </div>
       }
      }

      @if (result(); as res) {
        <div class="mt-3 bp-body-small" style="border-top:1px solid var(--border); padding-top:0.75rem;">
          <p class="mb-1"><strong>{{ res.created }}</strong> created · {{ res.skipped }} skipped · {{ res.failed }} failed — all pending, review in Approvals.@if (res.mode === 'review') { <span class="text-secondary"> (Review pull — lean set.)</span> }</p>

          <!-- The gap report: data found on the pages that has no home in our model
               yet. Tells us what to extend (attribute groups / value types) next. -->
          @if (res.gaps?.length) {
            <div class="mt-2 mb-2" style="border:1px solid var(--color-border-hairline); border-radius:0.5rem; padding:0.5rem 0.75rem;">
              <p class="font-medium mb-1">Found but couldn't store yet</p>
              <ul style="list-style:none; margin:0; padding:0;">
                @for (g of res.gaps; track g.label) {
                  <li class="flex items-center justify-between gap-2 py-0.5">
                    <span class="truncate">
                      <span class="bp-pill bp-pill--muted">{{ g.kind }}</span>
                      {{ g.label }}@if (g.example) { <span class="text-secondary"> — e.g. {{ g.example }}</span> }
                    </span>
                    <span class="text-secondary whitespace-nowrap">{{ g.count }} {{ g.count === 1 ? 'item' : 'items' }}</span>
                  </li>
                }
              </ul>
            </div>
          }
          @for (row of res.results; track row.url) {
            <p class="text-secondary truncate">
              {{ row.status === 'created' ? '✓' : row.status === 'skipped' ? '·' : '✕' }}
              {{ row.name || row.url }}{{ row.reason ? ' — ' + row.reason : '' }}{{ row.optionCount ? ' (' + row.optionCount + ' options)' : '' }}
            </p>
          }
          <!-- Done: clear the panel so it collapses back to the input and the
               reviewer drops straight to the (now-reloaded) shop grid below. -->
          <button type="button" class="bp-btn-outline mt-3" (click)="done()">Done</button>
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
  /** Pull mode — default Review (lean vetting set) per the contract lifecycle. */
  protected readonly mode = signal<'review' | 'full'>('review');
  /** Prepare step (2): taxonomy + per-group cat/subcat, and the editable rows. */
  protected readonly preparing = signal(false);
  protected readonly prepared = signal<PrepareResult | null>(null);
  protected readonly rows = signal<EditRow[]>([]);
  protected readonly categories = computed<CatNode[]>(() => this.prepared()?.categories ?? []);
  protected subcatsFor(categoryId: string | null): Array<{ id: string; name: string }> {
    return this.categories().find((c) => c.id === categoryId)?.subcats ?? [];
  }

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

  /** The supplier group KEY for a product URL — the PARENT path (all segments
   *  except the product slug). MUST match the server's groupKeyOf so the Pull
   *  mapping lines up. /catering-equipment-hire/cutlery-hire/fork → the sub-group. */
  private groupKey(u: string): string {
    try {
      const segs = new URL(u).pathname.split('/').filter(Boolean);
      return (segs.length > 1 ? segs.slice(0, -1) : segs).join('/') || 'other';
    } catch { return 'other'; }
  }
  private humanize(s: string): string {
    return s.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  /** Display label for a group key — its leaf segment humanised ("Cutlery Hire"). */
  protected groupLabel(key: string): string { return this.humanize(key.split('/').filter(Boolean).pop() || key); }

  /** Task list grouped by the supplier's hierarchy (parent path), alphabetical. */
  protected readonly grouped = computed(() => {
    const map = new Map<string, string[]>();
    for (const u of this.report()?.productLinks ?? []) {
      const key = this.groupKey(u);
      (map.get(key) ?? map.set(key, []).get(key)!).push(u);
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
        this.prepared.set(null);
        this.rows.set([]);
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

  /** Step 2: prepare cat/subcat for the SELECTED groups only. */
  protected prepare(): void {
    // One row per group that has a selected item; sample = a selected item's slug.
    const sel = this.selected();
    const groups = this.grouped()
      .map((g) => ({ g, chosen: g.items.filter((u) => sel.has(u)) }))
      .filter((x) => x.chosen.length)
      .map((x) => ({ key: x.g.category, sample: this.leaf(x.chosen[0]) }));
    if (!groups.length) return;
    this.error.set(null);
    this.preparing.set(true);
    this.admin.extractPrepare(this.orgId(), groups).subscribe({
      next: (res) => {
        this.prepared.set(res);
        this.rows.set(res.groups.map((gr) => ({
          key: gr.key,
          label: gr.label,
          categoryId: gr.categoryId,
          subChoice: gr.subcategoryId || (gr.isNew && gr.subcategoryName ? '__new__' : ''),
          newName: gr.subcategoryName || gr.label,
        })));
        this.preparing.set(false);
      },
      error: (e) => { this.error.set(this.msg(e)); this.preparing.set(false); },
    });
  }

  private patchRow(key: string, patch: Partial<EditRow>): void {
    this.rows.update((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  protected setCat(key: string, categoryId: string): void {
    // New category → reset the subcategory choice (its subcats differ).
    this.patchRow(key, { categoryId, subChoice: '' });
  }
  protected setSub(key: string, subChoice: string): void { this.patchRow(key, { subChoice }); }
  protected setNewName(key: string, newName: string): void { this.patchRow(key, { newName }); }
  protected backToSelection(): void { this.prepared.set(null); this.rows.set([]); }

  /** Build the group→mapping payload from the (edited) rows. */
  private buildMapping(): Record<string, MappingRow> {
    const map: Record<string, MappingRow> = {};
    for (const r of this.rows()) {
      if (!r.categoryId) continue;
      if (r.subChoice === '__new__' && r.newName.trim()) {
        map[r.key] = { categoryId: r.categoryId, subcategoryName: r.newName.trim(), isNew: true };
      } else if (r.subChoice) {
        map[r.key] = { categoryId: r.categoryId, subcategoryId: r.subChoice };
      } else {
        map[r.key] = { categoryId: r.categoryId };
      }
    }
    return map;
  }

  protected pull(): void {
    const r = this.report();
    if (!r) return;
    const urls = this.hasLinks() ? [...this.selected()] : [r.url];
    if (!urls.length) return;
    this.error.set(null);
    this.pulling.set(true);
    this.admin.extractPull(this.orgId(), urls, this.mode(), this.buildMapping()).subscribe({
      next: (res) => { this.result.set(res); this.pulling.set(false); this.pulled.emit(res); },
      error: (e) => { this.error.set(this.msg(e)); this.pulling.set(false); },
    });
  }

  /** Collapse the panel back to just the URL input after a pull — the shop grid
   *  below has already reloaded (pulled emitted), so the reviewer sees the imports. */
  protected done(): void {
    this.report.set(null);
    this.result.set(null);
    this.selected.set(new Set());
    this.expandedCats.set(new Set());
    this.prepared.set(null);
    this.rows.set([]);
    this.url.set('');
  }

  protected pretty(o: unknown): string { try { return JSON.stringify(o, null, 2); } catch { return String(o); } }
  private msg(e: unknown): string {
    const err = e as { error?: { error?: string }; message?: string };
    return err?.error?.error || err?.message || 'Something went wrong. Please try again.';
  }
}
