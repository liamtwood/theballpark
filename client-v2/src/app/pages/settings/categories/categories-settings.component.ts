import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { CatalogueService } from '../../../core/marketplace/catalogue.service';
import { CategoryInfo, CategoryUpdate } from '../../../shared/catalogue/catalogue.types';
import { SelectComponent, SelectOption } from '../../../shared/select/select.component';
import { PageHeroComponent } from '../../../shell/page-hero/page-hero.component';

/** pV2-MARKET-00 — /settings/categories: the minimal ballpark-admin
 *  curation table (MARKETPLACE.md "browse + curate"). One row per
 *  top-level catalogue category: Name / Tagline / Active / Sort,
 *  edit-fields save-on-change to PATCH /api/marketplace/categories/:id
 *  (optimistic; reload on failure) — the /settings/pages table pattern.
 *  Item counts are read-only context. Hierarchy, icons + images are NOT
 *  curated here (deferred with the image-upload arc). */
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
      subtitle="Curate the marketplace categories — names, taglines, visibility and order."
    />

    <div class="bp-page-body bp-page-body--workspace">
      @if (loader.isLoading()) {
        <p class="bp-body-small text-secondary">Loading…</p>
      } @else if (loader.error()) {
        <p class="bp-body-small text-warn">Couldn't load categories.</p>
      } @else {
        <div class="overflow-hidden rounded-xl border border-hairline bg-surface">
          <div class="grid grid-cols-[28px_1fr_1.4fr_110px_90px_70px] items-center gap-x-4 border-b border-hairline bg-fill px-4 py-2">
            <span></span>
          <span class="bp-table-column-header">Category</span>
            <span class="bp-table-column-header">Tagline</span>
            <span class="bp-table-column-header">Visibility</span>
            <span class="bp-table-column-header">Sort</span>
            <span class="bp-table-column-header">Items</span>
          </div>

          @for (cat of categories(); track cat.id) {
            <div
              class="grid grid-cols-[28px_1fr_1.4fr_110px_90px_70px] items-center gap-x-4 border-b border-hairline px-4 py-1.5"
              [class.opacity-60]="!cat.isActive"
            >
              <button
                type="button"
                class="bp-subcat-expander"
                [attr.aria-label]="(expanded() === cat.id ? 'Collapse ' : 'Expand ') + cat.name"
                (click)="toggleExpand(cat.id)"
              >
                <lucide-icon [name]="expanded() === cat.id ? 'chevron-down' : 'chevron-right'" [size]="14" />
              </button>
              <input
                class="ed-input"
                maxlength="60"
                aria-label="Category name"
                [ngModel]="cat.name"
                (blur)="commitText($event, cat, 'name', false)"
              />
              <input
                class="ed-input"
                maxlength="120"
                placeholder="Shown on the category card"
                aria-label="Tagline"
                [ngModel]="cat.tagline ?? ''"
                (blur)="commitText($event, cat, 'tagline', false)"
              />
              <app-select
                ariaLabel="Visibility"
                [options]="visibility"
                [value]="cat.isActive ? 'visible' : 'hidden'"
                (changed)="save(cat, { isActive: $event === 'visible' })"
              />
              <input
                class="ed-input"
                type="number"
                aria-label="Sort order"
                [ngModel]="String(cat.sortOrder ?? 0)"
                (blur)="commitSort($event, cat, false)"
              />
              <span class="bp-body-small text-secondary">{{ cat.count }}</span>
            </div>

            <!-- Subcategory curation rows (pV2-06-subcats) -->
            @if (expanded() === cat.id) {
              @if (subcats().length === 0) {
                <p class="bp-caption border-b border-hairline px-4 py-2 pl-12">
                  {{ subcatsLoading() ? 'Loading…' : 'No subcategories.' }}
                </p>
              }
              @for (sub of subcats(); track sub.id) {
                <div
                  class="grid grid-cols-[28px_1fr_1.4fr_110px_90px_70px] items-center gap-x-4 border-b border-hairline bg-fill/50 px-4 py-1.5 pl-8"
                  [class.opacity-60]="!sub.isActive"
                >
                  <span></span>
                  <input
                    class="ed-input"
                    maxlength="60"
                    aria-label="Subcategory name"
                    [ngModel]="sub.name"
                    (blur)="commitText($event, sub, 'name', true)"
                  />
                  <input
                    class="ed-input"
                    maxlength="120"
                    placeholder="Shown on the subcategory chip"
                    aria-label="Tagline"
                    [ngModel]="sub.tagline ?? ''"
                    (blur)="commitText($event, sub, 'tagline', true)"
                  />
                  <app-select
                    ariaLabel="Visibility"
                    [options]="visibility"
                    [value]="sub.isActive ? 'visible' : 'hidden'"
                    (changed)="saveSub(sub, { isActive: $event === 'visible' })"
                  />
                  <input
                    class="ed-input"
                    type="number"
                    aria-label="Sort order"
                    [ngModel]="String(sub.sortOrder ?? 0)"
                    (blur)="commitSort($event, sub, true)"
                  />
                  <span class="bp-body-small text-secondary">{{ sub.count }}</span>
                </div>
              }
            }
          }
        </div>

        @if (error()) {
          <p class="bp-caption mt-3 text-danger">{{ error() }}</p>
        }
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

  /** Save-on-blur for text cells: emit only when the trimmed value changed
   *  (parity with the legacy edit-field commitText — no redundant PATCH).
   *  `sub` routes to the subcategory optimistic path. */
  protected commitText(ev: Event, cat: CategoryInfo, key: 'name' | 'tagline', sub: boolean): void {
    const next = (ev.target as HTMLInputElement).value.trim();
    const cur = key === 'name' ? cat.name : (cat.tagline ?? '');
    if (next === cur) return;
    const patch: CategoryUpdate = key === 'name' ? { name: next } : { tagline: next };
    if (sub) void this.saveSub(cat, patch);
    else void this.save(cat, patch);
  }

  protected commitSort(ev: Event, cat: CategoryInfo, sub: boolean): void {
    const next = (ev.target as HTMLInputElement).value.trim();
    if (next === String(cat.sortOrder ?? 0)) return;
    const patch: CategoryUpdate = { sortOrder: Number(next) || 0 };
    if (sub) void this.saveSub(cat, patch);
    else void this.save(cat, patch);
  }

  /** Local optimistic copy of the curation list. */
  protected readonly categories = signal<CategoryInfo[]>([]);

  protected readonly loader = resource<void, void>({
    loader: async () => {
      this.categories.set(await firstValueFrom(this.catalogue.adminCategories()));
    },
  });

  /** Expanded category id (one at a time) + its subcategory rows. */
  protected readonly expanded = signal<string | null>(null);
  protected readonly subcats = signal<CategoryInfo[]>([]);
  protected readonly subcatsLoading = signal(false);

  protected async toggleExpand(catId: string): Promise<void> {
    if (this.expanded() === catId) {
      this.expanded.set(null);
      return;
    }
    this.expanded.set(catId);
    this.subcats.set([]);
    this.subcatsLoading.set(true);
    try {
      this.subcats.set(await firstValueFrom(this.catalogue.adminCategories(catId)));
    } catch (err) {
      console.warn('[CategoriesSettings] subcategory load failed', err);
      this.error.set('Could not load subcategories.');
    } finally {
      this.subcatsLoading.set(false);
    }
  }

  /** Same optimistic PATCH path as top-level rows. */
  protected async saveSub(sub: CategoryInfo, patch: CategoryUpdate): Promise<void> {
    const before = this.subcats();
    this.subcats.update((list) => list.map((c) => (c.id === sub.id ? { ...c, ...patch } : c)));
    try {
      const fresh = await firstValueFrom(this.catalogue.updateCategory(sub.id, patch));
      this.subcats.update((list) => list.map((c) => (c.id === sub.id ? fresh : c)));
      this.error.set('');
    } catch (err) {
      console.warn('[CategoriesSettings] subcategory save failed', err);
      this.subcats.set(before);
      this.error.set(`Couldn't save "${sub.name}" — change reverted.`);
    }
  }

  protected async save(cat: CategoryInfo, patch: CategoryUpdate): Promise<void> {
    // Optimistic row swap; the server returns the fresh row (live count).
    const before = this.categories();
    this.categories.update((list) =>
      list.map((c) => (c.id === cat.id ? { ...c, ...patch } : c))
    );
    try {
      const fresh = await firstValueFrom(this.catalogue.updateCategory(cat.id, patch));
      this.categories.update((list) => list.map((c) => (c.id === cat.id ? fresh : c)));
      this.error.set('');
    } catch (err) {
      // Failed save must not lie (Rule 5): restore truth + surface it.
      console.warn('[CategoriesSettings] save failed', err);
      this.categories.set(before);
      this.error.set(`Couldn't save "${cat.name}" — change reverted.`);
    }
  }
}
