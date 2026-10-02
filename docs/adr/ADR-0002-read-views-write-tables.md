# ADR-0002: Read through `security_invoker` views, write to base tables (CQRS-lite)

**Status:** Accepted
**Date:** 2026-10-02
**Deciders:** Liam (architecture/product owner)

## Context

The pre-launch data-model rebuild (see `docs/DATA-MODEL-REDESIGN.md`) recreates the
`projects`-and-below cluster from scratch. Three forces showed up repeatedly during the
2026-10-01/02 walkthrough and want a single answer:

- **RLS enforcement (EP-00020, acquisition-grade).** Security must be *enforced* at the
  DB, not just *set* per query. A plain `CREATE VIEW` runs `security_definer` (as the view
  **owner**), which **silently bypasses RLS** on the underlying tables — the classic
  view-layer footgun. Postgres 15+ `WITH (security_invoker = true)` runs the view as the
  **querying** role, so RLS + column grants apply to the caller. Supabase is PG15+.

- **A stable application contract.** The rebuild changes physical storage (frozen
  `project_items` + overlay `project_item_quotes`, dropped columns, renames parked to
  FR-00229). We want to refactor storage *underneath* the app without breaking every query.

- **Computed / overlay read-models.** The line cluster's "current form" is literally a
  read shape: `COALESCE(quote.field, project_items.field)` joining requirement + quote +
  matches. That logic should live in **one** place, not be reassembled in every caller.

A secondary wish — **ideal, stable column order** — is real but cosmetic: the app must
reference columns by **name**, never ordinal, and Postgres appends on `ALTER ... ADD`
(no physical reorder without a rewrite). So column order cannot, on its own, justify a
view layer; it rides along for free if we build one for the reasons above.

The usual objection to view layers is **writability**: any view with a join or `COALESCE`
is not auto-updatable and would need fragile `INSTEAD OF` triggers. Ballpark dodges this
because **writes already funnel through application services** (`projects.service` etc.),
not scattered SQL.

## Decision

Adopt a **CQRS-lite** split:

- **Base tables = storage and the sole write target.** Physical column order is whatever
  `CREATE TABLE` sets at rebuild time; later columns append. **Services write directly to
  base tables** (as today).
- **`security_invoker` read views = the application read surface**, in a dedicated
  schema (e.g. `api`/`read`). They carry the curated column order, the overlay/join/
  computed logic (e.g. `vw_project_line` = requirement + quote overlay + matches), and the
  RLS-enforcing read edge. **The app reads these.**
- **No `INSTEAD OF` triggers.** Writes never pass through views, so view (non-)updatability
  is a non-issue.
- **Views are added selectively** — where they add **security, a contract, or logic** —
  **not** as a blind 1:1 mapping over every table.

## Options considered

### A — Tables only (status quo)
| Dimension | Assessment |
|---|---|
| Complexity | Low |
| RLS enforcement | Weak — policies hand-applied per query; easy to miss |
| Contract stability | Poor — storage == contract; every refactor ripples |
**Rejected:** doesn't meet the acquisition-grade RLS bar or give a refactor buffer.

### B — Updatable views (reads *and* writes through views) + `INSTEAD OF` triggers
**Rejected:** the overlay/join views aren't auto-updatable; `INSTEAD OF` triggers are the
most fragile part of a view layer, and they duplicate logic the services already own.

### C — Read-views + service writes (CHOSEN)
| Dimension | Assessment |
|---|---|
| Complexity | Moderate, bounded (views only where they earn it) |
| RLS enforcement | Strong — `security_invoker` at the read edge |
| Contract stability | Strong — logical layer decoupled from storage |
| Write path | Simple — unchanged; services → base tables |

### D — Blind 1:1 view per table (for column order)
**Rejected:** doubles DDL (every column touches table **and** view), column drops fight
view dependencies, and the only gain is cosmetic order. Over-engineering.

## Consequences

**Easier**
- RLS is enforced for the caller at the read edge (`security_invoker`).
- Storage can be normalised/refactored under a stable read contract.
- Overlay/computed surfaces (the line "current form") live in one definition.
- Curated, stable column order in the read layer — for free.
- Writes stay fast and simple (direct to tables, through services).

**Harder / to watch**
- Two objects to maintain **where a view exists** (table + view); keep them in
  `migrate-schemas.js` together.
- Dropping/altering a base column fights view dependencies → drop/recreate the dependent
  view (or `CASCADE`), deliberately.
- The querying role (`web_app_user`) needs its **own `SELECT` grants** on base tables — it
  is *its* permissions `security_invoker` uses. (This is the point, for acquisition-grade.)
- **Discipline:** writes must never go through views. Enforced by convention (services) +
  not building `INSTEAD OF` triggers.

## Action items
1. [ ] Create the read schema (`api`/`read`) and the first view — `vw_project_line`
   (requirement + quote overlay + matches) — during the line-cluster build.
2. [ ] All cross-org/public views created `security_invoker = true` from the start —
   notably `orgs_public` (BE-00139).
3. [ ] Grant `web_app_user` the base-table `SELECT`s the invoker views need (EP-00020).
4. [ ] Note in `WORKING_STANDARDS.md`: app reads go through views; writes go to base
   tables via services; no `INSTEAD OF` triggers.

## Related
ADR-0001 (taxonomy); EP-00020 (RLS, acquisition-grade); BE-00139 (orgs_public cross-org
read); `docs/DATA-MODEL-REDESIGN.md` (line cluster — the motivating overlay view);
FR-00229 (field/table naming — the view layer is where any renames surface safely).
