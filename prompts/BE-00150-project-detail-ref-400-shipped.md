# BE-00150 — Create project hangs: `/projects-v2/:id` 400s on the EP-00021 ref

**Shipped:** 2026-11-11 (rebuild/org-slice) — hotfix for preview v0.9.0
**Commit:** `<sha on push>` (server-only)

## Symptom
After creating a project, the page sat on "loading" forever and never showed the ballpark.
Intermittent-looking, so it read like a flaky/slow or even security issue — it wasn't.

## Root cause
EP-00021 (`15e19c75`) changed project URLs to use the human **ref** (e.g. `EV-020`) instead of the UUID.
But `server/src/routes/projects-v2.js` had an audit-M1 guard `router.param('id', uuidParam('project id'))`
that **rejects any non-UUID `:id` with a 400 before the handler**. So `GET /api/projects-v2/EV-020` returned
400, the project page's detail `resource` errored, `detail.value()` stayed undefined, and the template's
`@if (detail.value())` gate left the page on its loading state indefinitely — the "hang". `getDetail` itself
already resolves ref-or-UUID safely (`p.id::text = $1 OR p.ref = $1`); only the param guard was stale.

## Fix (server-only, 3 files)
- **`routes/projects-v2.js`** — `:id` param now accepts a **UUID OR a project ref** (`/^[A-Za-z]{1,12}-\d{1,8}$/`).
  `lineId`/`itemId`/`supplierId` stay strict UUIDs (they feed uuid casts / row lookups).
- **`services/ai.service.js`** (hardening, surfaced while diagnosing) — the Haiku client was `maxRetries: 8`
  with **no timeout**, so a transient Anthropic 429/529 overload hung the synchronous create/recommend flow for
  minutes. Now `maxRetries: 2` + `timeout: 45_000`, and connection-timeout errors map to a clean 503.
- **`db/pool.js`** (hardening) — added `connectionTimeoutMillis: 10000` + `max: 20`. `request-context` pins one
  client per request for its whole duration; a burst of slow requests could exhaust the default-10 pool, after
  which `pool.connect()` hung **forever** (no timeout), wedging every later request before it reached any route.
  Now it fails fast instead of hanging.

## Verification
Two fresh end-to-end runs after a clean server bounce: parse → create → **detail 200 (16–19 ms, ref resolved)** →
recommend added 6 items (~15–18 s). No 400, no hang. `node --check` clean on all edited files; server healthy.

## Notes
- The AI-timeout and pool-timeout changes are latent-hazard hardening, not the regression itself, but kept —
  they convert "indefinite hang" into "fast, visible error" under API overload / pool pressure.
- Diagnostic request/route logging added while chasing this was all removed before commit.
