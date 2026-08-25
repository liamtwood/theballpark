# pV2-BUILDUP-01 — End-of-arc architect audit (read-only)

Independent Angular/Node architect audit of the pV2-BUILDUP-01 changes
(v2.62–v2.64, dev only). Run 2026-08-25 by a background agent (CC side), in
parallel with the chat-side ledger/one-pager audit.

## Summary & verdict

Sound and ships-quality on the security/schema axes — `org_id` is JWT-only
throughout, the new `supplierOrgId` is UUID-validated + server-guarded to real
supplier orgs, the supplier-tick write sits inside the existing
`withTransaction` (Rule 1 satisfied), the schema block is additive/idempotent
across all three schemas, and `items.kind` / `project_items.kind` /
`project_items.parent_id` are genuinely inert (grep confirms zero
readers/writers). The private-cost boundary (RP-11) is not at risk — the buildup
tree is dormant; nothing new renders internal cost on a client surface. Real
findings: **component bloat** (both touched components at/over the cap) and a
**non-atomic explore-reconcile that can act on sent/locked lines**. No
blocker-class defect. **Verdict: accept with two MED fixes.**

## Findings (most severe first)

### MED-1 — `project-estimate.component.ts` over the 400-line alarm cap (525 lines)
Ledger note said "extract custom-line modal on next touch" at 444; the arc landed
it at 525. The reconcile block + dialog-seeding methods are the extraction seam.
**Rec:** extract the explore-reconcile into a util (also aids testability) before
the next touch.

### MED-2 — Explore reconcile is non-atomic and can act on sent/locked lines
`onExploreMore` pre-loads existing picks filtering only `!isDeclined(q)`, not
editable status. Because the Add/Explore entry is now on both Cart and Final,
picks can include `out_for_quote`/`quoted`/`booked` lines; the reconcile then
issues remove/setQty on them → server 409 `'locked'`. The N awaits have no
transaction and removes run before adds → a mid-loop failure leaves the quote
partially reconciled with only a generic toast.
**Rec:** filter the pre-load to `editable(q)` (`status === 'to_send'`, the
existing one-place predicate — RP-11) so Explore never stages locked lines.

### MED-3 — `custom-line-dialog.component.ts` at the alarm cap (399), two jobs fused
The `'new'` form/grid and the `'explore'` browse→shuttle→reconcile share almost
no template/state — a clean split candidate the cap rule is designed to force.
**Rec:** split into two sibling components before the next touch.

### LOW-1 — Explore rail ignores pagination (`hasMore`), silently caps at 48
`catalogue.items` is born-paginated (PAGE_SIZE 48); the rail drops `hasMore`. A
supplier with >48 items in the category shows only the first 48 with no signal.
**Rec:** surface "showing first 48" / load-more, or request an uncapped scope.

### LOW-2 — Explore data load uses `effect()` + manual stale-guard, not `resource()`
v2 standard is `resource()`/`httpResource()` for HTTP state. The hand-rolled
guard also only checks `supplierId`, not `categoryId` (safe today — inputs set
once on open). **Rec:** convert to `resource()` keyed on `{ supplier, cat }`.

### LOW-3 — Server supplier-tag plumbing + `supplierOrgId` unreachable from UI today
`'new'` always emits `supplierOrgId: null`; explore uses `addQuoteItem`. The new
`project_item_suppliers` tick via `addCustomItem` is dormant forward-plumbing
(like the schema columns). **Rec:** none — record it so it isn't read as live.

### LOW-4 — Dead `matched` field on `GridRow`
Written in `blankRow`/`ngOnInit`/`addFromRail`, read nowhere. **Rec:** remove.

### Note — `QuoteLine.itemId` typed non-nullable
`itemId: string` while custom lines carry none; the `!!q.itemId` guard is a
runtime guard against an always-truthy type. Pre-existing, not from this arc.

## Looks good
- org_id JWT-only; `supplierOrgId` UUID-validated + guarded to `orgs.type='supplier'` with ON CONFLICT DO NOTHING.
- Rule 1: supplier-tick INSERT inside the existing `withTransaction`.
- Zod `.strip()`; PATCH/DELETE return 409 `'locked'` / 404 correctly.
- Schema block additive/idempotent across public/preview/master; columns inert.
- RP-11: no leaf/internal cost on any client surface; cascade stays server-side.
- Tokens only; no raw hex / raw Tailwind color utilities; RP-05 clean.
- Angular idioms: signals/`computed`/`@if`/`@for` + `track`; `input()`/`output()`; `inject()`; OnPush; `host: { class: 'contents' }`; `layout-grid` registered centrally.
- Collapse fix (expanded→collapsed) is the right shape.
- Hand-rolled explore rail rows (not reusing `catalogue-grid`) justified — the shuttle is a genuinely different interaction.
- Version chip bumped v2.61 → v2.64.

## CC triage (2026-08-25)
- **MED-2 — ACCEPT + FIX NOW.** Real partial-write footgun. Filter pre-load to `editable(q)`.
- **LOW-4 — ACCEPT + FIX NOW.** Trivial dead-field removal.
- **MED-1 / MED-3 — ACCEPT, required before next touch.** Extract the reconcile into a util + split the dialog into `new`/`explore` components. Deferred to the components/T&M build (which touches these files next) so the extraction is done with knowledge of the buildup shape, not speculatively.
- **LOW-1 — ACCEPT, defer.** Surface the 48-cap when the components rail (larger sets) lands.
- **LOW-2 — ACCEPT, defer.** Convert to `resource()` during the MED-3 split.
- **LOW-3 — ACCEPT as noted forward-plumbing.** No action; recorded here.
- **Type note — ACCEPT, low.** Widen `QuoteLine.itemId` to `string | null` opportunistically.
