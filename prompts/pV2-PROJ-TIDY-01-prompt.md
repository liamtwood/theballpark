# pV2-PROJ-TIDY-01 — Projects table: remove 6 dead/redundant columns

**Type:** schema tidy (destructive DROP COLUMN) · dev-only this pass
**Owner:** CC implements + commits. Chat (design) authored this spec.
**Risk:** low — every target is proven 0-data or fully redundant, with no
client-v2 consumer. It is still a *destructive* migration (DROP, not the
additive path), so treat it deliberately: strip code refs first, then drop.

---

## Scope

Remove 6 columns from `projects`. Evidence (public/dev, 57 active projects):

| Column | Why remove |
|---|---|
| `ai_hints` | 0/57 populated. No live consumer. Superseded by `parsed_brief_json`. |
| `missing_fields` | 0/57 populated. Superseded by `parsed_brief_json.topQuestions`. |
| ~~`status_id`~~ | **DO NOT DROP** — CC's pre-check (2026-09) found it's the LIVE v2 status FK: `projects.service.js` dual-writes it (`resolveStatus`), `inbox.service.js` uses it in the message-suppliers flip, and v1 joins `statuses`. Chat's original "redundant" assumption was wrong. It needs a separate v1-status-FK decommission (logged as a follow-up), NOT a drop here. |
| `stand_size` | v1 exhibition legacy. 7/57, v1-only, unused in v2. |
| `stand_width_m` | v1 exhibition legacy. |
| `stand_depth_m` | v1 exhibition legacy. |
| `stand_type` | v1 exhibition legacy. |

Everything else on `projects` stays this pass (quote_*, sow_*, images/chrome,
financial defaults, client_* are all parked/kept deliberately).

---

## Pre-check — RESOLVED

`status_id` **is a live consumer** (CC pre-check, 2026-09) — v2
`projects.service.js` dual-writes it, `inbox.service.js` uses it in the
message-suppliers flip, v1 joins `statuses`. So it is **excluded from this drop**
and handled as a separate v1-status-FK decommission (tracked follow-up). The
other **6** (`ai_hints`, `missing_fields`, `stand_size/width_m/depth_m/type`) are
confirmed safe (0-data / v1-only) — proceed with those.

---

## Changes

### 1. `server/src/db/migrate-schemas.js`
- Remove the 6 columns from the `projects` `CREATE TABLE` definition.
- **Add idempotent drops** — the tables already exist in `public`, `preview`,
  and `master`, so a CREATE edit alone won't remove them. Add, scoped across
  all three schemas using the file's existing schema-loop/`format()` pattern:
  ```sql
  ALTER TABLE {schema}.projects DROP COLUMN IF EXISTS ai_hints;
  ALTER TABLE {schema}.projects DROP COLUMN IF EXISTS missing_fields;
  ALTER TABLE {schema}.projects DROP COLUMN IF EXISTS stand_size;
  ALTER TABLE {schema}.projects DROP COLUMN IF EXISTS stand_width_m;
  ALTER TABLE {schema}.projects DROP COLUMN IF EXISTS stand_depth_m;
  ALTER TABLE {schema}.projects DROP COLUMN IF EXISTS stand_type;
  ```
- `migrate.js` is deprecated — you may strip the same defs there for tidiness,
  but don't add new logic to it.

### 2. `server/src/services/project.service.js`
- Remove `ai_hints`, `missing_fields` from every SELECT / INSERT / UPDATE
  column list (7 call-sites) and renumber the `$n` params accordingly.
- Remove `stand_*` from any column list / mapping if referenced.
- Confirm the create/update payload builders no longer reference them.

### 3. `server/src/db/seed.js`
- Remove `stand_*` (and `ai_hints`/`missing_fields` if present) from any seed
  insert.

### 4. `client-angular/src/app/models/project.model.ts` (v1)
- Delete the `ai_hints`, `missing_fields`, and `stand_*` optional fields.

### 5. client-v2
- No changes expected (no references). Confirm by build.

---

## Acceptance

- [ ] `status_id` NOT dropped (live v2 consumer — separate decommission).
- [ ] `migrate-schemas.js` drops the 6 across public/preview/master
      idempotently; re-running the migration is a no-op.
- [ ] `SELECT` on `projects` no longer returns the 6 columns after migrate.
- [ ] Server boots; project create/read/update still works (spot-check one
      project round-trip).
- [ ] `client-v2` builds clean (no broken references).
- [ ] One atomic commit. Bump the v2 chip in `environment.ts`.

## Migration note
Destructive (DROP) — not the additive delta path. Dev-only this pass; it rides
to preview/master at the next promote (the promote's schema step must include
these drops, or migrate-schemas handles them idempotently there).

## Concerns not in spec
Write the shipped file with the standard sections. Note anything the drop
surfaces (e.g. an unexpected `status_id` consumer).
