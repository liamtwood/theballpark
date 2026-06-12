import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CatalogueService } from './catalogue.service';

/** pV2-06d — the active org's favourites as signal state. Root-provided
 *  (favourites are org-wide, not per route); loaded once on first
 *  injection; toggles are OPTIMISTIC with revert-on-failure (Rule 5: a
 *  failed write never lies). */
@Injectable({ providedIn: 'root' })
export class FavouritesStore {
  private readonly catalogue = inject(CatalogueService);

  private readonly itemIds = signal<ReadonlySet<string>>(new Set());
  private readonly supplierIds = signal<ReadonlySet<string>>(new Set());

  readonly items = this.itemIds.asReadonly();
  readonly suppliers = this.supplierIds.asReadonly();

  /** Convenience predicates for templates. */
  readonly isItemFav = computed(() => (id: string) => this.itemIds().has(id));

  private readonly loader = resource<void, void>({
    loader: async () => {
      const fav = await firstValueFrom(this.catalogue.favourites());
      this.itemIds.set(new Set(fav.items));
      this.supplierIds.set(new Set(fav.suppliers));
    },
  });

  async toggle(type: 'item' | 'supplier', refId: string): Promise<void> {
    const sig = type === 'item' ? this.itemIds : this.supplierIds;
    const before = sig();
    const next = new Set(before);
    const optimistic = !next.has(refId);
    if (optimistic) next.add(refId);
    else next.delete(refId);
    sig.set(next);
    try {
      const { favourited } = await firstValueFrom(this.catalogue.toggleFavourite(type, refId));
      if (favourited !== optimistic) {
        // Server disagreed (raced from another tab) — adopt its truth.
        const corrected = new Set(sig());
        if (favourited) corrected.add(refId);
        else corrected.delete(refId);
        sig.set(corrected);
      }
    } catch (err) {
      console.warn('[Favourites] toggle failed — reverting', err);
      sig.set(before);
    }
  }
}
