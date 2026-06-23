import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { SupplierDetail, SupplierSubcategory } from '../../shared/catalogue/catalogue.types';
import { SubcatCardComponent } from '../../shared/catalogue/subcat-card.component';
import { OrgMediaComponent } from '../../shared/org-media/org-media.component';

/** pV2-06d (v2.15c audit fix M7) — the Storefront tab content extracted
 *  from supplier-detail: brand panel + contact card + (pV2-CARDS-01 QC #5)
 *  the subcat-card grid per CARDS.md image 7 — one card per subcategory
 *  the supplier sells in, covered by their first item's image. Cards
 *  emit — the shell owns the Store drill. */
@Component({
  selector: 'app-storefront-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, SubcatCardComponent, OrgMediaComponent],
  host: { class: 'mx-auto flex w-full max-w-4xl flex-col gap-8' },
  template: `
    <!-- 1. Hero banner + logo pill (pV2-MEDIA-01e), at the top of the page. -->
    <app-org-media
      show="banner"
      mode="view"
      [name]="supplier().name"
      [coverUrl]="supplier().coverUrl"
      [logoUrl]="supplier().logoUrl"
    />

    <!-- 2. Company Information — bordered card, left-aligned. -->
    <section class="rounded-[var(--radius-card)] border border-hairline bg-surface p-6">
      <h3 class="bp-edit-section-title">Company Information</h3>
      <p class="mt-2 text-md font-medium text-text">{{ supplier().name }}</p>
      <p class="bp-caption">{{ location() }}</p>
      @if (supplier().description) {
        <p class="bp-body mt-3 text-secondary">{{ supplier().description }}</p>
      }
    </section>

    <!-- 3. Contact — bordered card, left-aligned. -->
    @if (hasContact()) {
      <section class="rounded-[var(--radius-card)] border border-hairline bg-surface p-6">
        <h3 class="bp-edit-section-title">Contact</h3>
        <div class="mt-3 flex flex-col gap-2.5">
          @if (supplier().address) {
            <div class="flex items-center gap-2.5">
              <lucide-icon name="map-pin" [size]="15" class="text-muted" />
              <span class="bp-body-small text-secondary">{{ supplier().address }}{{ location() ? ', ' + location() : '' }}</span>
            </div>
          }
          @if (supplier().phone) {
            <div class="flex items-center gap-2.5">
              <lucide-icon name="phone" [size]="15" class="text-muted" />
              <a class="bp-body-small text-secondary hover:text-accent" [href]="'tel:' + supplier().phone">{{ supplier().phone }}</a>
            </div>
          }
          @if (supplier().email) {
            <div class="flex items-center gap-2.5">
              <lucide-icon name="mail" [size]="15" class="text-muted" />
              <a class="bp-body-small text-secondary hover:text-accent" [href]="'mailto:' + supplier().email">{{ supplier().email }}</a>
            </div>
          }
          @if (supplier().website) {
            <div class="flex items-center gap-2.5">
              <lucide-icon name="globe" [size]="15" class="text-muted" />
              <a class="bp-body-small break-all text-secondary hover:text-accent" [href]="supplier().website" target="_blank" rel="noopener">{{ supplier().website }}</a>
            </div>
          }
        </div>
      </section>
    }

    <!-- 4. Categories the supplier sells in — left-aligned header, card grid. -->
    @for (group of groups(); track group.id) {
      <section>
        <div class="flex items-center gap-2">
          <h3 class="bp-edit-section-title">{{ group.name }}</h3>
          <span class="bp-meta ml-auto">{{ group.cards.length }} categor{{ group.cards.length === 1 ? 'y' : 'ies' }}</span>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          @for (sub of group.cards; track sub.id) {
            <app-subcat-card [subcat]="sub" (clicked)="subcategorySelected.emit($event)" />
          }
        </div>
      </section>
    }

    <!-- 5. Portfolio — below the categories (pV2-MEDIA-01e QC). -->
    <app-org-media
      show="portfolio"
      mode="view"
      [name]="supplier().name"
      [images]="supplier().images"
    />
  `,
})
export class StorefrontPanelComponent {
  readonly supplier = input.required<SupplierDetail>();
  readonly subcategories = input<SupplierSubcategory[]>([]);
  readonly subcategorySelected = output<SupplierSubcategory>();

  /** One group per category the supplier sells in (supplier.categories is
   *  already items-only), holding its subcat cards + the catch-all. */
  protected readonly groups = computed(() =>
    this.supplier()
      .categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        // Defensive per-group sort (audit cards-F-7) — the visual order
        // must not silently shift if the endpoint's ORDER BY changes.
        cards: this.subcategories()
          .filter((s) => s.parentId === cat.id)
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((g) => g.cards.length > 0)
  );

  protected readonly hasContact = computed(() => {
    const s = this.supplier();
    return !!(s.address || s.phone || s.email || s.website);
  });

  protected location(): string {
    const s = this.supplier();
    return [s.city, s.country].filter((x): x is string => !!x).join(', ');
  }
}
