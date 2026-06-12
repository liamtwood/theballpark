import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { CatalogueService } from '../../../core/marketplace/catalogue.service';
import { CategoryInfo, CategoryUpdate } from '../../../shared/catalogue/catalogue.types';
import { EditFieldComponent, EditFieldOption } from '../../../shared/edit-field/edit-field.component';
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
  imports: [EditFieldComponent, LucideAngularModule, PageHeroComponent],
  host: { class: 'block' },
  template: `
    <app-page-hero
      [back]="{ label: 'Back', href: '/home' }"
      title="Categories"
      subtitle="Curate the marketplace categories — names, taglines, visibility and order."
    />

    <div class="bp-page-body">
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
              <app-edit-field
                label=""
                type="text"
                [maxLength]="60"
                [value]="cat.name"
                [editing]="true"
                (valueChange)="save(cat, { name: $event })"
              />
              <app-edit-field
                label=""
                type="text"
                [maxLength]="120"
                placeholder="Shown on the category card"
                [value]="cat.tagline ?? ''"
                [editing]="true"
                (valueChange)="save(cat, { tagline: $event })"
              />
              <app-edit-field
                label=""
                type="select"
                [options]="visibility"
                [value]="cat.isActive ? 'visible' : 'hidden'"
                [editing]="true"
                (valueChange)="save(cat, { isActive: $event === 'visible' })"
              />
              <app-edit-field
                label=""
                type="number"
                [value]="String(cat.sortOrder ?? 0)"
                [editing]="true"
                (valueChange)="save(cat, { sortOrder: Number($event) || 0 })"
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
                  <app-edit-field
                    label=""
                    type="text"
                    [maxLength]="60"
                    [value]="sub.name"
                    [editing]="true"
                    (valueChange)="saveSub(sub, { name: $event })"
                  />
                  <app-edit-field
                    label=""
                    type="text"
                    [maxLength]="120"
                    placeholder="Shown on the subcategory chip"
                    [value]="sub.tagline ?? ''"
                    [editing]="true"
                    (valueChange)="saveSub(sub, { tagline: $event })"
                  />
                  <app-edit-field
                    label=""
                    type="select"
                    [options]="visibility"
                    [value]="sub.isActive ? 'visible' : 'hidden'"
                    [editing]="true"
                    (valueChange)="saveSub(sub, { isActive: $event === 'visible' })"
                  />
                  <app-edit-field
                    label=""
                    type="number"
                    [value]="String(sub.sortOrder ?? 0)"
                    [editing]="true"
                    (valueChange)="saveSub(sub, { sortOrder: Number($event) || 0 })"
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
  protected readonly Number = Number;
  protected readonly error = signal('');

  protected readonly visibility: EditFieldOption[] = [
    { label: 'Visible', value: 'visible' },
    { label: 'Hidden', value: 'hidden' },
  ];

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
