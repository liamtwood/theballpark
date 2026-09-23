import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { CatalogueService } from '../../../core/marketplace/catalogue.service';
import { CategoryInfo, CategoryUpdate } from '../../../shared/catalogue/catalogue.types';
import { SelectComponent, SelectOption } from '../../../shared/select/select.component';
import { PageHeroComponent } from '../../../shell/page-hero/page-hero.component';

/** A node in the taxonomy tree — the category row + its lazily-loaded children
 *  and expand state. Depth is derived at render time. */
interface TaxNode { cat: CategoryInfo; parentId: string | null; expanded: boolean; loaded: boolean; children: TaxNode[]; }
/** A flattened render row: either a category node (with depth) or an "add" input row. */
type Row = { node: TaxNode; depth: number; add?: undefined } | { add: true; parentId: string | null; depth: number; node?: undefined };

/** pV2-STORE-TAXONOMY-01 — /settings/categories: the taxonomy MANAGER. A lazy
 *  tree of the catalogue hierarchy at any depth (Category ▸ Subcategory ▸
 *  Sub-subcategory), inline-editable (name / tagline / visibility / sort,
 *  save-on-blur), with Add (sibling) + Add child (one level deeper) creating nodes
 *  via POST. Admin-gated. Replaces the earlier edit-only 2-level table. */
@Component({
  selector: 'app-categories-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectComponent, LucideAngularModule, PageHeroComponent],
  host: { class: 'block' },
  template: `
    <app-page-hero
      align="block"
      [back]="{ label: 'Back', href: '/home' }"
      title="Categories"
      subtitle="Manage the marketplace taxonomy — categories, subcategories and levels below."
    />

    <div class="bp-page-body bp-page-body--workspace">
      @if (loader.isLoading()) {
        <p class="bp-body-small text-secondary">Loading…</p>
      } @else if (loader.error()) {
        <p class="bp-body-small text-warn">Couldn't load categories.</p>
      } @else {
        <div class="mb-3 flex items-center justify-between">
          <span class="bp-body-small text-secondary">Click a row's chevron to reveal the level beneath it.</span>
          <button type="button" class="bp-btn-outline" (click)="startAdd(null)">
            <lucide-icon name="plus" [size]="15" /> Add category
          </button>
        </div>

        <div class="overflow-hidden rounded-xl border border-hairline bg-surface">
          <div class="grid grid-cols-[28px_1fr_1.4fr_110px_90px_70px_36px] items-center gap-x-4 border-b border-hairline bg-fill px-4 py-2">
            <span></span>
            <span class="bp-table-column-header">Category</span>
            <span class="bp-table-column-header">Tagline</span>
            <span class="bp-table-column-header">Visibility</span>
            <span class="bp-table-column-header">Sort</span>
            <span class="bp-table-column-header">Items</span>
            <span></span>
          </div>

          @for (row of visible(); track row.add ? 'add:' + row.parentId : row.node.cat.id) {
            @if (row.add) {
              <div class="grid grid-cols-[28px_1fr_1.4fr_110px_90px_70px_36px] items-center gap-x-4 border-b border-hairline bg-fill px-4 py-1.5"
                   [style.padding-left.rem]="0.75 + row.depth * 1.25">
                <span></span>
                <input class="ed-input" maxlength="60" placeholder="New name…" autofocus
                       [ngModel]="addName()" (ngModelChange)="addName.set($event)"
                       (keydown.enter)="submitAdd(row.parentId)" (keydown.escape)="cancelAdd()" (blur)="submitAdd(row.parentId)" />
                <span class="bp-caption text-secondary">Enter to add · Esc to cancel</span>
                <span></span><span></span><span></span><span></span>
              </div>
            } @else {
              <div class="grid grid-cols-[28px_1fr_1.4fr_110px_90px_70px_36px] items-center gap-x-4 border-b border-hairline px-4 py-1.5"
                   [class.opacity-60]="!row.node.cat.isActive" [class.bg-fill]="row.depth > 0"
                   [style.padding-left.rem]="0.75 + row.depth * 1.25">
                <button type="button" class="bp-subcat-expander"
                        [attr.aria-label]="(row.node.expanded ? 'Collapse ' : 'Expand ') + row.node.cat.name"
                        (click)="toggle(row.node)">
                  <lucide-icon [name]="row.node.expanded ? 'chevron-down' : 'chevron-right'" [size]="14" />
                </button>
                <input class="ed-input" maxlength="60" aria-label="Name"
                       [ngModel]="row.node.cat.name" (blur)="commitText($event, row.node, 'name')" />
                <input class="ed-input" maxlength="120" placeholder="Shown on the card / chip" aria-label="Tagline"
                       [ngModel]="row.node.cat.tagline ?? ''" (blur)="commitText($event, row.node, 'tagline')" />
                <app-select ariaLabel="Visibility" [options]="visibility"
                            [value]="row.node.cat.isActive ? 'visible' : 'hidden'"
                            (changed)="save(row.node, { isActive: $event === 'visible' })" />
                <input class="ed-input" type="number" aria-label="Sort order"
                       [ngModel]="String(row.node.cat.sortOrder ?? 0)" (blur)="commitSort($event, row.node)" />
                <span class="bp-body-small text-secondary">{{ row.node.cat.count }}</span>
                <button type="button" class="bp-subcat-expander" title="Add child level" aria-label="Add child level"
                        (click)="startAdd(row.node)">
                  <lucide-icon name="plus" [size]="14" />
                </button>
              </div>
            }
          }
        </div>

        @if (error()) { <p class="bp-caption mt-3 text-danger">{{ error() }}</p> }
      }
    </div>
  `,
})
export class CategoriesSettingsComponent {
  private readonly catalogue = inject(CatalogueService);

  protected readonly String = String;
  protected readonly error = signal('');
  protected readonly visibility: SelectOption[] = [
    { label: 'Visible', value: 'visible' },
    { label: 'Hidden', value: 'hidden' },
  ];

  /** The tree (roots); nodes mutate in place and we bump the root ref to re-render. */
  protected readonly tree = signal<TaxNode[]>([]);
  private bump(): void { this.tree.set([...this.tree()]); }
  private toNode(cat: CategoryInfo, parentId: string | null): TaxNode {
    return { cat, parentId, expanded: false, loaded: false, children: [] };
  }

  protected readonly loader = resource<void, void>({
    loader: async () => {
      const roots = await firstValueFrom(this.catalogue.adminCategories());
      this.tree.set(roots.map((c) => this.toNode(c, null)));
    },
  });

  /** Flatten to visible rows (pre-order, expanded branches only) + the inline
   *  add-input row wherever an add is in progress. */
  protected readonly visible = computed<Row[]>(() => {
    const out: Row[] = [];
    const au = this.addingUnder();
    if (au === 'root') out.push({ add: true, parentId: null, depth: 0 });
    const walk = (nodes: TaxNode[], depth: number): void => {
      for (const n of nodes) {
        out.push({ node: n, depth });
        if (n.expanded) {
          if (au === n.cat.id) out.push({ add: true, parentId: n.cat.id, depth: depth + 1 });
          walk(n.children, depth + 1);
        }
      }
    };
    walk(this.tree(), 0);
    return out;
  });

  protected async toggle(node: TaxNode): Promise<void> {
    if (!node.loaded) {
      try {
        const kids = await firstValueFrom(this.catalogue.adminCategories(node.cat.id));
        node.children = kids.map((c) => this.toNode(c, node.cat.id));
        node.loaded = true;
      } catch (err) {
        console.warn('[Taxonomy] child load failed', err);
        this.error.set('Could not load the level beneath this one.');
        return;
      }
    }
    node.expanded = !node.expanded;
    this.bump();
  }

  // ── Add (sibling at root) / Add child (one level deeper) ────────────────────
  protected readonly addingUnder = signal<string | 'root' | null>(null);
  protected readonly addName = signal('');
  protected startAdd(parent: TaxNode | null): void {
    this.addName.set('');
    if (!parent) { this.addingUnder.set('root'); return; }
    if (!parent.expanded) void this.toggle(parent); // reveal where the child will land
    this.addingUnder.set(parent.cat.id);
  }
  protected cancelAdd(): void { this.addingUnder.set(null); this.addName.set(''); }
  protected async submitAdd(parentId: string | null): Promise<void> {
    const name = this.addName().trim();
    if (name.length < 2) { this.cancelAdd(); return; }
    this.addingUnder.set(null); // one create per submit; guard the blur+enter double-fire
    try {
      const created = await firstValueFrom(this.catalogue.createCategory(name, parentId));
      if (!parentId) {
        this.tree.update((roots) => [...roots, this.toNode(created, null)]);
      } else {
        const parent = this.find(this.tree(), parentId);
        if (parent) { parent.children = [...parent.children, this.toNode(created, parentId)]; parent.loaded = true; parent.expanded = true; }
        this.bump();
      }
      this.error.set('');
    } catch (err) {
      console.warn('[Taxonomy] create failed', err);
      this.error.set(`Couldn't add "${name}".`);
    } finally {
      this.addName.set('');
    }
  }
  private find(nodes: TaxNode[], id: string): TaxNode | null {
    for (const n of nodes) { if (n.cat.id === id) return n; const d = this.find(n.children, id); if (d) return d; }
    return null;
  }

  // ── Inline edit (save-on-blur), optimistic ─────────────────────────────────
  protected commitText(ev: Event, node: TaxNode, key: 'name' | 'tagline'): void {
    const next = (ev.target as HTMLInputElement).value.trim();
    const cur = key === 'name' ? node.cat.name : (node.cat.tagline ?? '');
    if (next === cur) return;
    void this.save(node, key === 'name' ? { name: next } : { tagline: next });
  }
  protected commitSort(ev: Event, node: TaxNode): void {
    const next = (ev.target as HTMLInputElement).value.trim();
    if (next === String(node.cat.sortOrder ?? 0)) return;
    void this.save(node, { sortOrder: Number(next) || 0 });
  }
  protected async save(node: TaxNode, patch: CategoryUpdate): Promise<void> {
    const before = node.cat;
    node.cat = { ...node.cat, ...patch } as CategoryInfo; this.bump();
    try {
      node.cat = await firstValueFrom(this.catalogue.updateCategory(node.cat.id, patch));
      this.bump(); this.error.set('');
    } catch (err) {
      console.warn('[Taxonomy] save failed', err);
      node.cat = before; this.bump();
      this.error.set(`Couldn't save "${before.name}" — change reverted.`);
    }
  }
}
