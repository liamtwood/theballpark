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
  host: { class: 'grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]' },
  template: `
    <!-- Branding + portfolio gallery (pV2-MEDIA-01e) — the SAME component the
         owner edits on /settings/profile, here in read-only view mode. Spans
         both columns above the brand/contact/subcat content. -->
    <div class="flex flex-col gap-6 lg:col-span-2">
      <app-org-media
        mode="view"
        [name]="supplier().name"
        [coverUrl]="supplier().coverUrl"
        [logoUrl]="supplier().logoUrl"
        [images]="supplier().images"
      />
    </div>

    <!-- Brand panel -->
    <section class="rounded-[var(--radius-card)] border border-hairline bg-surface p-6">
      <div class="flex items-center gap-3">
        <span class="bp-supplier-card__logo !h-10 !w-10 text-md">{{ initial() }}</span>
        <span>
          <span class="block text-md font-medium text-text">{{ supplier().name }}</span>
          <span class="bp-caption">{{ location() }}</span>
        </span>
      </div>
      @if (supplier().description) {
        <p class="bp-body mt-4 text-secondary">{{ supplier().description }}</p>
      }

    </section>

    <!-- Contact card -->
    <section class="rounded-[var(--radius-card)] border border-hairline bg-surface p-6">
      <h3 class="bp-field-label uppercase tracking-wide">Contact info</h3>
      <dl class="mt-3 flex flex-col gap-3">
        @if (supplier().address) {
          <div class="flex items-start gap-2.5">
            <lucide-icon name="map-pin" [size]="15" class="mt-0.5 text-muted" />
            <dd class="bp-body-small text-secondary">{{ supplier().address }}<br />{{ location() }}</dd>
          </div>
        }
        @if (supplier().phone) {
          <div class="flex items-center gap-2.5">
            <lucide-icon name="phone" [size]="15" class="text-muted" />
            <dd><a class="bp-body-small text-secondary hover:text-accent" [href]="'tel:' + supplier().phone">{{ supplier().phone }}</a></dd>
          </div>
        }
        @if (supplier().email) {
          <div class="flex items-center gap-2.5">
            <lucide-icon name="mail" [size]="15" class="text-muted" />
            <dd><a class="bp-body-small text-secondary hover:text-accent" [href]="'mailto:' + supplier().email">{{ supplier().email }}</a></dd>
          </div>
        }
        @if (supplier().website) {
          <div class="flex items-center gap-2.5">
            <lucide-icon name="globe" [size]="15" class="text-muted" />
            <dd><a class="bp-body-small break-all text-secondary hover:text-accent" [href]="supplier().website" target="_blank" rel="noopener">{{ supplier().website }}</a></dd>
          </div>
        }
      </dl>
    </section>

    <!-- Subcat cards GROUPED per category (screenshot reference,
         2026-06-12): folder + uppercase accent category header + count,
         mini-card grid beneath. Only cats/subcats with live items. -->
    @for (group of groups(); track group.id) {
      <section class="lg:col-span-2">
        <div class="flex items-center gap-2">
          <lucide-icon name="folder" [size]="14" class="text-accent" />
          <h3 class="bp-ref-eyebrow">{{ group.name }}</h3>
          <span class="bp-meta ml-auto">{{ group.cards.length }} categor{{ group.cards.length === 1 ? 'y' : 'ies' }}</span>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          @for (sub of group.cards; track sub.id) {
            <app-subcat-card [subcat]="sub" (clicked)="subcategorySelected.emit($event)" />
          }
        </div>
      </section>
    }
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

  protected initial(): string {
    return (this.supplier().name || '?').charAt(0).toUpperCase();
  }

  protected location(): string {
    const s = this.supplier();
    return [s.city, s.country].filter((x): x is string => !!x).join(', ');
  }
}
