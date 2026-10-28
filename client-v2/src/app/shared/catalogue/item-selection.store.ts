import { Injectable, computed, signal } from '@angular/core';

/** pV2-ITEM-BULK-ACTIONS-01 — the SHARED multi-select state for the marketplace
 *  management grid (list + table + card). Provided per marketplace context
 *  (alongside MarketplaceStore), so the global marketplace, a supplier's My Shop
 *  and the admin Approvals queue each get their own selection — never a leak
 *  between contexts. The grid reads `ids()` and calls `toggle()`; the bulk-action
 *  bar reads the selection + clears it after an action. ONE definition, both
 *  views (ENGINEERING "extract before duplicate"). */
@Injectable()
export class ItemSelectionStore {
  /** The selected item ids. A fresh Set each mutation so OnPush consumers react. */
  private readonly _ids = signal<ReadonlySet<string>>(new Set<string>());
  readonly ids = this._ids.asReadonly();
  readonly count = computed(() => this._ids().size);
  readonly hasSelection = computed(() => this._ids().size > 0);

  isSelected(id: string): boolean {
    return this._ids().has(id);
  }

  toggle(id: string): void {
    this._ids.update((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /** Select every id in `pageIds` (the "select all on this page" affordance). */
  selectMany(pageIds: readonly string[]): void {
    this._ids.update((set) => {
      const next = new Set(set);
      for (const id of pageIds) next.add(id);
      return next;
    });
  }

  /** True when every id in `pageIds` is selected (and there is at least one). */
  allSelected(pageIds: readonly string[]): boolean {
    if (!pageIds.length) return false;
    const set = this._ids();
    return pageIds.every((id) => set.has(id));
  }

  clear(): void {
    this._ids.set(new Set<string>());
  }

  /** Drop ids no longer present in the live grid (e.g. after a page reload trims
   *  rows a bulk action removed) — keeps the selection honest without a full clear. */
  retainOnly(presentIds: readonly string[]): void {
    const present = new Set(presentIds);
    this._ids.update((set) => {
      const next = new Set<string>();
      for (const id of set) if (present.has(id)) next.add(id);
      return next.size === set.size ? set : next;
    });
  }
}
