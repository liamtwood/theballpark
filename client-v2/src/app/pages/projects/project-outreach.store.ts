import { Injectable, computed, signal } from '@angular/core';

const EMPTY: ReadonlySet<string> = new Set<string>();

/** pV2-INBOX-02 — the ephemeral supplier roster for an agency's outreach.
 *
 *  Holds, per category, the set of suppliers the agent has added to the
 *  quote ("Add to Quote" on a supplier card). Deliberately EPHEMERAL
 *  (v1-parity, Liam 2026-06-25): nothing is persisted until "Message
 *  suppliers" fires the send — the threads are then the durable record.
 *  Provided at the project-detail level so the picks survive tab switches
 *  (Marketplace ↔ Estimate / final quote) within the project, and is
 *  injected by both the supplier fan-out and the send. */
@Injectable()
export class ProjectOutreachStore {
  /** Map<categoryId, Set<supplierOrgId>> — the per-category roster. */
  private readonly roster = signal<ReadonlyMap<string, ReadonlySet<string>>>(new Map());

  /** The roster as a reactive read (categories → supplier sets). */
  readonly byCategory = computed(() => this.roster());

  /** Total distinct suppliers enlisted across all categories. */
  readonly supplierCount = computed(() => {
    const all = new Set<string>();
    for (const set of this.roster().values()) for (const id of set) all.add(id);
    return all.size;
  });

  enlistedFor(categoryId: string): ReadonlySet<string> {
    return this.roster().get(categoryId) ?? EMPTY;
  }

  isEnlisted(categoryId: string, supplierId: string): boolean {
    return this.roster().get(categoryId)?.has(supplierId) ?? false;
  }

  /** Toggle a supplier across a set of categories: if it's already in ALL
   *  of them, remove from each; otherwise add to each. Empty categories
   *  collapse out of the map so reads stay clean. */
  toggleSupplier(categoryIds: readonly string[], supplierId: string): void {
    if (!categoryIds.length) return;
    const fully = categoryIds.every((c) => this.isEnlisted(c, supplierId));
    this.roster.update((prev) => {
      const next = new Map<string, Set<string>>([...prev].map(([k, v]) => [k, new Set(v)]));
      for (const c of categoryIds) {
        const set = next.get(c) ?? new Set<string>();
        if (fully) set.delete(supplierId);
        else set.add(supplierId);
        if (set.size) next.set(c, set);
        else next.delete(c);
      }
      return next;
    });
  }

  /** Remove a supplier from one category (the rail's chip remove). */
  remove(categoryId: string, supplierId: string): void {
    this.toggleSupplier(
      this.isEnlisted(categoryId, supplierId) ? [categoryId] : [],
      supplierId
    );
  }

  clear(): void {
    this.roster.set(new Map());
  }
}
