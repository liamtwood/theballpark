import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
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
  imports: [EditFieldComponent, PageHeroComponent],
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
          <div class="grid grid-cols-[1fr_1.4fr_110px_90px_70px] items-center gap-x-4 border-b border-hairline bg-fill px-4 py-2">
            <span class="bp-table-column-header">Category</span>
            <span class="bp-table-column-header">Tagline</span>
            <span class="bp-table-column-header">Visibility</span>
            <span class="bp-table-column-header">Sort</span>
            <span class="bp-table-column-header">Items</span>
          </div>

          @for (cat of categories(); track cat.id) {
            <div
              class="grid grid-cols-[1fr_1.4fr_110px_90px_70px] items-center gap-x-4 border-b border-hairline px-4 py-1.5 last:border-b-0"
              [class.opacity-60]="!cat.isActive"
            >
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
