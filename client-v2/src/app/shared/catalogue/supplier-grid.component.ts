import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { SupplierCardComponent } from './supplier-card.component';
import { CatalogueSupplier, ViewMode, CARD_GRID_LOOSE, CARD_GRID_DENSE } from './catalogue.types';

interface SupSection { id: string; name: string | null; icon: string | null; sort: number; suppliers: CatalogueSupplier[]; }

/** pV2-06d (v2.15b QC fix) — the suppliers middle region with the SAME
 *  three view modes as items (the toggle was inert in suppliers mode).
 *  Pure: suppliers in, favourite events out; rows link to /suppliers/:id. */
@Component({
  selector: 'app-supplier-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SupplierCardComponent, LucideAngularModule],
  host: { class: 'block' },
  template: `
    @switch (viewMode()) {
      @case ('card') {
        <!-- Columns match the item grid exactly (catalogue-grid) so supplier
             cards are the same size as item cards (Liam 2026-10-29). When
             groupByTopCategory, suppliers group into their derived category
             sections — a supplier shows under each category it stocks
             (pV2-MKT-CATGROUP-01). -->
        @for (sec of sections(); track sec.id) {
          @if (sec.name) {
            <div class="mb-3 mt-6 flex items-center gap-2 first:mt-0">
              @if (sec.icon) { <lucide-icon [name]="sec.icon" [size]="16" style="color: var(--theme-accent)" class="shrink-0" /> }
              <h3 class="bp-list-title text-text">{{ sec.name }}</h3>
              <span class="bp-caption text-secondary">· {{ sec.suppliers.length }}</span>
            </div>
          }
          <div [class]="'grid gap-4 ' + (dense() ? denseCols : looseCols)">
            @for (sup of sec.suppliers; track sup.id) {
              <app-supplier-card
                [supplier]="sup"
                [favourited]="favouriteIds().has(sup.id)"
                [quotable]="quotable()"
                [inQuote]="quoteIds().has(sup.id)"
                (favouriteToggled)="favouriteToggled.emit($event)"
                (quoteToggled)="quoteToggled.emit($event)"
                (selected)="supplierSelected.emit($event)"
              />
            }
          </div>
        }
      }
      @case ('list') {
        <div class="overflow-hidden rounded-xl border border-hairline bg-surface">
          @for (sup of suppliers(); track sup.id) {
            <a
              [routerLink]="['/suppliers', sup.handle ?? sup.id]"
              class="grid grid-cols-[36px_1fr_auto] items-center gap-3 border-b border-hairline px-3 py-2 text-text no-underline last:border-b-0 hover:bg-fill"
            >
              <span class="bp-supplier-card__logo">{{ initial(sup) }}</span>
              <span class="min-w-0">
                <span class="block truncate text-md font-medium">{{ sup.name }}</span>
                <span class="bp-caption block truncate">{{ sup.city ?? '' }}</span>
              </span>
              <span class="bp-meta">{{ sup.count }} item{{ sup.count === 1 ? '' : 's' }}</span>
            </a>
          }
        </div>
      }
      @case ('table') {
        <div class="overflow-hidden rounded-xl border border-hairline bg-surface">
          <div class="grid grid-cols-[1.6fr_1fr_110px] gap-x-4 border-b border-hairline bg-fill px-4 py-2">
            <span class="bp-table-column-header">Supplier</span>
            <span class="bp-table-column-header">City</span>
            <span class="bp-table-column-header text-right">Items</span>
          </div>
          @for (sup of suppliers(); track sup.id) {
            <a
              [routerLink]="['/suppliers', sup.handle ?? sup.id]"
              class="grid grid-cols-[1.6fr_1fr_110px] gap-x-4 border-b border-hairline px-4 py-2 text-text no-underline last:border-b-0 hover:bg-fill"
            >
              <span class="truncate text-base">{{ sup.name }}</span>
              <span class="bp-body-small truncate text-secondary">{{ sup.city ?? '—' }}</span>
              <span class="bp-body-small text-right text-secondary">{{ sup.count }}</span>
            </a>
          }
        </div>
      }
    }
  `,
})
export class SupplierGridComponent {
  readonly suppliers = input.required<readonly CatalogueSupplier[]>();
  readonly viewMode = input<ViewMode>('card');
  /** Denser card grid for a constrained column (project Marketplace) — mirrors
   *  catalogue-grid so supplier + item cards are the same size. */
  readonly dense = input<boolean>(false);
  /** Group the card grid into derived category sections (a supplier shows under
   *  each top-level category it stocks), ordered by category sort_order. */
  readonly groupByTopCategory = input<boolean>(false);
  protected readonly looseCols = CARD_GRID_LOOSE;
  protected readonly denseCols = CARD_GRID_DENSE;

  /** Card-view sections: one per top-level category a supplier stocks (duplicated
   *  across categories), sorted by category sort_order; else one flat section. */
  protected readonly sections = computed<SupSection[]>(() => {
    const sups = this.suppliers();
    if (!this.groupByTopCategory()) {
      return [{ id: '__all', name: null, icon: null, sort: 0, suppliers: [...sups] }];
    }
    const out: SupSection[] = [];
    const idx = new Map<string, number>();
    for (const sup of sups) {
      // PRIMARY category only — the supplier appears ONCE, under the category it
      // stocks most (server orders topCategories primary-first). No duplication.
      const cat = sup.topCategories?.[0] ?? { id: '__none', name: 'Other', icon: null, sort: 9999 };
      let gi = idx.get(cat.id);
      if (gi === undefined) {
        gi = out.length;
        idx.set(cat.id, gi);
        out.push({ id: cat.id, name: cat.name, icon: cat.icon, sort: cat.sort ?? 9999, suppliers: [] });
      }
      out[gi].suppliers.push(sup);
    }
    out.sort((a, b) => a.sort - b.sort || (a.name ?? '').localeCompare(b.name ?? ''));
    return out;
  });
  readonly favouriteIds = input<ReadonlySet<string>>(new Set<string>());
  readonly favouriteToggled = output<string>();
  /** Card body click — the shell flips to Items + filters by this supplier. */
  readonly supplierSelected = output<string>();
  /** Project fan-out (pV2-INBOX-02): card-view "Add to Quote" CTA. */
  readonly quotable = input<boolean>(false);
  readonly quoteIds = input<ReadonlySet<string>>(new Set<string>());
  readonly quoteToggled = output<string>();

  protected initial(sup: CatalogueSupplier): string {
    return (sup.name || '?').charAt(0).toUpperCase();
  }
}
