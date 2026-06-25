import { Injectable, computed, signal } from '@angular/core';

const EMPTY_SET: ReadonlySet<string> = new Set<string>();
const EMPTY_ROSTER: ReadonlyMap<string, ReadonlySet<string>> = new Map();

/** A supplier as held in the roster — just enough to render a chip. */
export interface RosterSupplier {
  id: string;
  name: string;
}

/** pV2-INBOX-02 — the agency's supplier roster, keyed by project.
 *
 *  `providedIn: 'root'` + keyed by projectId so the picks survive LEAVING
 *  and returning to a project within the session (project-detail being
 *  destroyed/recreated no longer wipes them). Still ephemeral across a hard
 *  reload — nothing is persisted until "Message suppliers" fires the send
 *  and the threads become the durable record (Liam 2026-06-25). A
 *  `project_category_suppliers` table is the reload-survival follow-up. */
@Injectable({ providedIn: 'root' })
export class ProjectOutreachStore {
  /** projectId → (categoryId → Set<supplierOrgId>). */
  private readonly projects = signal<ReadonlyMap<string, ReadonlyMap<string, ReadonlySet<string>>>>(new Map());
  /** supplierId → display name, registered as suppliers are added. */
  private readonly names = signal<ReadonlyMap<string, string>>(new Map());
  /** The project the reads/writes below operate on (set by project-detail). */
  private readonly current = signal<string | null>(null);

  /** Point the store at a project. Idempotent — re-entering a project just
   *  re-points at its retained roster. */
  setProject(projectId: string): void {
    this.current.set(projectId || null);
  }

  private readonly roster = computed<ReadonlyMap<string, ReadonlySet<string>>>(
    () => this.projects().get(this.current() ?? '') ?? EMPTY_ROSTER
  );

  /** Total distinct suppliers enlisted across the current project. */
  readonly supplierCount = computed(() => {
    const all = new Set<string>();
    for (const set of this.roster().values()) for (const id of set) all.add(id);
    return all.size;
  });

  enlistedFor(categoryId: string): ReadonlySet<string> {
    return this.roster().get(categoryId) ?? EMPTY_SET;
  }

  isEnlisted(categoryId: string, supplierId: string): boolean {
    return this.roster().get(categoryId)?.has(supplierId) ?? false;
  }

  nameOf(supplierId: string): string {
    return this.names().get(supplierId) ?? supplierId;
  }

  /** The enlisted suppliers for a category, name-resolved for the rail. */
  pickedFor(categoryId: string): RosterSupplier[] {
    const set = this.roster().get(categoryId);
    if (!set) return [];
    return [...set]
      .map((id) => ({ id, name: this.nameOf(id) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Enlist a supplier for each category — idempotent, NEVER removes. Used
   *  when adding an ITEM implies adding its supplier (Liam 2026-06-25): a
   *  second item from the same supplier must not toggle them back off. */
  addSupplier(categoryIds: readonly string[], supplier: RosterSupplier): void {
    if (!categoryIds.length || categoryIds.every((c) => this.isEnlisted(c, supplier.id))) return;
    this.mutate((roster) => {
      for (const c of categoryIds) {
        const set = roster.get(c) ?? new Set<string>();
        set.add(supplier.id);
        roster.set(c, set);
      }
    });
    this.registerName(supplier);
  }

  /** Remove a supplier from one category (the rail's chip remove). */
  remove(categoryId: string, supplierId: string): void {
    if (!this.isEnlisted(categoryId, supplierId)) return;
    this.mutate((roster) => {
      const set = roster.get(categoryId);
      if (!set) return;
      set.delete(supplierId);
      if (!set.size) roster.delete(categoryId);
    });
  }

  /** Apply a mutation to the current project's roster (deep-cloned so the
   *  signal sees a new reference), pruning empty rosters/categories. */
  private mutate(apply: (roster: Map<string, Set<string>>) => void): void {
    const pid = this.current();
    if (!pid) return;
    this.projects.update((prev) => {
      const next = new Map<string, Map<string, Set<string>>>(
        [...prev].map(([k, v]) => [k, new Map([...v].map(([ck, cv]) => [ck, new Set(cv)]))])
      );
      const roster = next.get(pid) ?? new Map<string, Set<string>>();
      apply(roster);
      if (roster.size) next.set(pid, roster);
      else next.delete(pid);
      return next;
    });
  }

  private registerName(supplier: RosterSupplier): void {
    if (!this.names().has(supplier.id)) {
      this.names.update((m) => new Map(m).set(supplier.id, supplier.name));
    }
  }

  /** Drop the current project's roster (after a successful send). */
  clear(): void {
    const pid = this.current();
    if (!pid) return;
    this.projects.update((prev) => {
      const next = new Map(prev);
      next.delete(pid);
      return next;
    });
  }
}
