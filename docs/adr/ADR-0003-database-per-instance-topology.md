# ADR-0003: Database-per-instance topology (portable, current stack)

**Status:** Accepted
**Date:** 2026-10-04
**Deciders:** Liam (product owner / lead)
**Related:** ADR-0002 (read-views/write-tables), `project_deploy_topology`, `project_launch_prep_plan`, EP-00020 (RLS)

## Context

v2 runs on **one Supabase Postgres database** where the three environments are **schemas** —
`public` (dev), `preview`, `master` (prod) — plus a `shared` schema that is **cross-environment**
(e.g. `shared.feedback`, reference codelists). Railway watches branches for deploys.

This is the pre-launch data-model rebuild, and the schema-per-env model has friction:

- **`shared` leaks across environments** — one `shared.feedback` / reference set is seen by dev,
  preview *and* prod. Env isolation is incomplete by construction.
- **Envs are coupled** — a mistake in a migration that writes `public`/`preview`/`master`
  explicitly can touch the wrong env; blast radius spans all three.
- **Prod has never existed** — no data to preserve, so we are free to choose the clean shape now.
- **A rebuild wants a clean slate** — on the current model that means a wipe/backup dance on the
  shared DB; a fresh database sidesteps it entirely.
- **Future flexibility** — the wider dev team uses Azure DevOps; we may later self-host or hand
  over an install package. We must not weld ourselves to Supabase-only features.

## Decision

**Move to a database per instance, on the current stack, kept portable.**

1. **One database per environment** — dev, preview and prod are **separate databases**, each with
   its own `public` + `shared` schemas. `shared` stops being cross-env; every env owns its copy.
2. **Stay on the current tech stack for now** — Supabase Postgres + Railway. No migration to Azure
   or self-host today.
3. **Near-term scope = dev only** — stand up a **new dev database** and build the redesigned schema
   into it fresh (no wipe, no backup juggling on the shared DB).
4. **Keep it portable** — plain Postgres; avoid hard dependencies on Supabase-only surfaces so the
   whole thing can later move to Azure / self-host / an install package. Supabase is a host, not a
   lock-in.
5. **Prod is a standalone new database at launch** — created clean, **RLS `FORCE`d from day one**
   (which forces closing the `app_is_admin()` backdoor, FR-00215 / BE-00132, before go-live).

## Options considered

### A — Keep schema-per-env on one database (status quo)
| dimension | assessment |
|---|---|
| Isolation | poor — `shared` is cross-env; one DB = one blast radius |
| Migration cost | zero (already here) |
| Clean rebuild | needs wipe/backup on the shared DB |
| Portability | same as B |

**Rejected:** incomplete isolation is the exact thing a rebuild should fix.

### B — Database-per-instance, current stack (**chosen**)
| dimension | assessment |
|---|---|
| Isolation | strong — each env fully separate, `shared` per-env |
| Migration cost | low — new dev DB on the stack we already run |
| Clean rebuild | trivial — build into an empty DB |
| Portability | preserved — plain Postgres |

### C — Migrate to Azure now
**Rejected (for now):** real migration cost + new ops surface, with no launch benefit yet. Kept
open by the portability constraint — revisit if the dev team standardises on Azure.

### D — Self-host now
**Rejected (for now):** ops burden we don't need pre-launch. Portability keeps it available later.

## Trade-offs

- **+** Clean env isolation; clean rebuild; prod born correct (RLS-forced); no lock-in.
- **−** More databases to provision/manage (connection strings, migrations run per-DB).
- **−** `shared.feedback` currently cross-env must be **migrated per-env** or consciously centralised
  — a known follow-up (the feedback-subsystem walk, ~2026-10-08).

## Consequences

- **Easier:** reasoning about blast radius; wiping/rebuilding dev; launching prod clean.
- **Harder:** cross-env reporting on feedback (now per-DB) — acceptable; feedback is internal tooling.
- **Revisit when:** the dev team commits to Azure, or self-hosting/an install package is required —
  the portability rule is what keeps those cheap.

## Action items

1. [ ] Provision a **new dev database** on Supabase; wire `DIRECT_URL`/`DATABASE_URL` + Railway.
2. [ ] Build the redesigned schema into it fresh (tables + the locked standards: audit, soft-delete,
       self-ref guards, constraints, RLS helpers).
3. [ ] Decide the **`shared.feedback`** path — migrate per-env vs keep one central tooling DB
       (defer to the feedback walk).
4. [ ] Keep migrations **portable** — plain Postgres DDL, no Supabase-only dependencies.
5. [ ] At launch: **standalone prod DB, RLS `FORCE`d**, `app_is_admin()` backdoor closed first.
