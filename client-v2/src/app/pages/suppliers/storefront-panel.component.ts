import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { CatalogueItem, SupplierDetail, SupplierSubcategory } from '../../shared/catalogue/catalogue.types';
import { CatalogueGridComponent } from '../../shared/catalogue/catalogue-grid.component';
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
  imports: [LucideAngularModule, CatalogueGridComponent, SubcatCardComponent, OrgMediaComponent],
  host: { class: 'mx-auto flex w-full max-w-[var(--workspace-max)] flex-col gap-8' },
  template: `
    <!-- 1. Hero banner + an overlaid category menu. Automagic from the supplier's
         own catalogue: nav = the categories they sell in, mega-menu = each
         subcategory (column) listing its sub-subcategories. A click drills the
         Store. Lights up the moment their items are loaded (pV2-STOREFRONT-MENU-01). -->
    <!-- 1. Shopfront hero (Amazon Brand Store pattern): full-width cover with the org
         logo in the corner, then a nav bar (org name + category menu) BELOW the image.
         The mega-menu drops from the nav; a click drills the Store (pV2-STOREFRONT-MENU-01). -->
    <div class="bp-shopfront-cover" [class.bp-shopfront-cover--empty]="!supplier().coverUrl">
      @if (supplier().coverUrl) { <img [src]="supplier().coverUrl" alt="" /> }
      @if (logoSrc()) {
        <div class="bp-shopfront-cover__logo"><img [src]="logoSrc()" alt="" /></div>
      }
    </div>

    @if (navCats().length) {
      <div class="relative z-20">
        <nav class="flex items-center gap-1 overflow-x-auto rounded-[var(--radius-card)] border border-hairline bg-surface px-3 py-2">
          <span class="mr-3 shrink-0 whitespace-nowrap text-base font-medium text-text">{{ supplier().name }}</span>
          <button type="button" class="whitespace-nowrap px-3 py-1 text-base text-secondary hover:text-accent" (click)="pick(null, null, 'All items')">All items</button>
          @for (c of navCats(); track c.id) {
            <button
              type="button"
              class="flex items-center gap-1.5 whitespace-nowrap px-3 py-1 text-base hover:text-accent"
              [class.font-medium]="openCat() === c.id"
              [class.text-accent]="openCat() === c.id"
              [class.text-secondary]="openCat() !== c.id"
              [style.box-shadow]="openCat() === c.id ? 'inset 0 -2px 0 0 var(--theme-accent)' : 'none'"
              (click)="toggleCat(c.id)"
            >
              {{ c.name }}
              <lucide-icon name="chevron-down" [size]="16" [style.transform]="openCat() === c.id ? 'rotate(180deg)' : 'none'" />
            </button>
          }
        </nav>

        <!-- Mega-menu drops from the nav (Amazon-style), floating over the content below. -->
        @if (menu(); as m) {
          <div class="absolute inset-x-0 top-full z-10 mt-1 rounded-[var(--radius-card)] border border-hairline bg-surface p-6 shadow-[var(--shadow-md)]">
            <div class="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3">
              @for (col of m.columns; track col.l2.id) {
                <div class="flex flex-col gap-2">
                  <button type="button" class="text-left text-base font-medium text-accent hover:underline" (click)="pick(m.categoryId, col.l2.id, col.l2.name, col.l2.tagline)">{{ col.l2.name }}</button>
                  @for (leaf of col.children; track leaf.id) {
                    <button type="button" class="text-left text-base text-secondary hover:text-accent" (click)="pick(m.categoryId, leaf.id, leaf.name, leaf.tagline)">{{ leaf.name }}</button>
                  }
                </div>
              }
            </div>
          </div>
        }
      </div>
    }

    <!-- Browse-in-place: picking a category/sub renders the supplier's items right
         here (reuses catalogue-grid + the store's items) so buyers never leave the
         shopfront (pV2-STOREFRONT-MENU-01). -->
    @if (browsing()) {
      @if (selectedTitle()) {
        <div>
          <h3 class="bp-edit-section-title">{{ selectedTitle() }}</h3>
          @if (selectedTagline()) { <p class="bp-body-small mt-1 text-secondary">{{ selectedTagline() }}</p> }
        </div>
      }
      @if (items().length === 0 && !itemsLoading()) {
        <p class="bp-body-small text-secondary">No items in this selection.</p>
      } @else {
        <app-catalogue-grid
          [items]="items()"
          [favouriteIds]="favouriteIds()"
          [quoteDraftIds]="quoteDraftIds()"
          [showQuickView]="true"
          [dense]="true"
          (entitySelected)="quickView.emit($event)"
          (quickView)="quickView.emit($event)"
          (favouriteToggled)="favouriteToggled.emit($event)"
          (quoteToggled)="quoteToggled.emit($event)"
          (changed)="gridChanged.emit()"
        />
        @if (hasMore()) {
          <div class="mt-6 flex justify-center">
            <button type="button" class="bp-btn-outline" (click)="showMore.emit()">Show more</button>
          </div>
        }
      }
    }

    <!-- 2. Company Information — logo + name + description, left-aligned. -->
    <section class="rounded-[var(--radius-card)] border border-hairline bg-surface p-6">
      <h3 class="bp-edit-section-title">Company Information</h3>
      <div class="mt-3 flex items-start gap-4">
        @if (logoSrc()) {
          <img class="h-12 w-auto max-w-[12rem] shrink-0 object-contain" [src]="logoSrc()" alt="" />
        }
        <div class="min-w-0">
          <p class="text-md font-medium text-text">{{ supplier().name }}</p>
          <p class="bp-caption">{{ location() }}</p>
          @if (supplier().description) {
            <p class="bp-body mt-3 text-secondary">{{ supplier().description }}</p>
          }
        </div>
      </div>
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

    <!-- 4. Categories the supplier sells in — hidden while browsing (the menu +
         in-place grid replace it). -->
    @if (!browsing()) {
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
  /** Category-menu drill — a resolved {categoryId, subcategoryId} (sub may be an
   *  L2 or an L3; both null = "All items"). The shell navigates the Store. */
  readonly browse = output<{ categoryId: string | null; subcategoryId: string | null }>();

  /** Browse-in-place: the parent feeds its store's items back so the grid renders
   *  here (same visibility/pagination as the Store tab). */
  readonly items = input<readonly CatalogueItem[]>([]);
  readonly itemsLoading = input(false);
  readonly hasMore = input(false);
  readonly favouriteIds = input<ReadonlySet<string>>(new Set<string>());
  readonly quoteDraftIds = input<ReadonlySet<string>>(new Set<string>());
  readonly quickView = output<string>();
  readonly favouriteToggled = output<string>();
  readonly quoteToggled = output<string>();
  readonly showMore = output<void>();
  readonly gridChanged = output<void>();

  /** True once the visitor has picked a category/sub from the menu — shows the grid. */
  protected readonly browsing = signal(false);
  /** Title + tagline of the current selection, shown above the in-place grid. */
  protected readonly selectedTitle = signal<string | null>(null);
  protected readonly selectedTagline = signal<string | null>(null);

  /** The open category in the banner nav (null = menu closed). */
  protected readonly openCat = signal<string | null>(null);
  /** Nav tabs = the categories the supplier actually has items in. */
  protected readonly navCats = computed(() => this.supplier().categories.filter((c) => c.count > 0));
  protected toggleCat(id: string): void { this.openCat.update((v) => (v === id ? null : id)); }
  protected pick(categoryId: string | null, subcategoryId: string | null, title: string, tagline: string | null = null): void {
    this.selectedTitle.set(title);
    this.selectedTagline.set(tagline);
    this.openCat.set(null);      // close the dropdown
    this.browsing.set(true);     // reveal the in-place grid
    this.browse.emit({ categoryId, subcategoryId });
  }

  /** Mega-menu model for the open category: one column per L2 subcategory (with
   *  live items), each holding its L3 sub-subcategories. Both levels come from the
   *  org-scoped subcategories feed (it emits every node in each item's chain). */
  protected readonly menu = computed(() => {
    const open = this.openCat();
    if (!open) return null;
    const cat = this.supplier().categories.find((c) => c.id === open);
    if (!cat) return null;
    const subs = this.subcategories();
    const l2s = subs
      .filter((s) => !s.isCatchAll && s.parentId === cat.id && s.count > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!l2s.length) return null;
    return {
      categoryId: cat.id,
      columns: l2s.map((l2) => ({
        l2,
        children: subs
          .filter((s) => s.parentId === l2.id && s.count > 0)
          .sort((a, b) => a.name.localeCompare(b.name)),
      })),
    };
  });

  /** Logo src with spaces encoded — some imported logo URLs (e.g. Yahire's) carry
   *  raw spaces that break the <img> load, leaving an empty chip. */
  protected readonly logoSrc = computed(() => {
    const u = (this.supplier().logoUrl ?? '').trim();
    return u ? u.replace(/ /g, '%20') : null;
  });

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
