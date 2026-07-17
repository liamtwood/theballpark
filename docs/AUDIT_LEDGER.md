# Ballpark v2 — Audit Ledger

Tracks every audit pass per file: when it was audited, by whom, against
what standard, and the file's size + SHA at audit time. When a file's
current SHA differs from its recorded SHA, it's drifted since audit and
needs a re-pass.

**Soft caps to prevent bloat** ("behemoth watch"):

| File kind | Warning | Alarm |
|---|---|---|
| Component (`*.component.ts`) | 250 lines | 400 lines |
| Service (`*.service.ts`) | 200 lines | 350 lines |
| Route file (server) | 200 lines | 300 lines |
| Schema / types / helpers | 150 lines | 250 lines |

Files at Warning trigger a "consider extracting" note in the next audit
pass. Alarm requires extraction before the next ship lands on that file.

**Auditor codes:** `chat` = code review by Claude chat; `cc` = code review
by Claude Code; `both` = audited and re-verified.

---

## INBOX + CART-01 arc audit (2026-07-08, `cc` + `chat`)

Full report: `docs/audits/2026-07-08-inbox-cart-arc-architect-audit.md`.
Audited at `v2.41g`; **all H/M/L + RP findings remediated same session** in
four commits. Verdict: healthy + idiomatic; no correctness/security risk.

| File | Before | After (SHA) | Status | Notes |
|---|---|---|---|---|
| `client-v2/.../projects/project-estimate.component.ts` | 805 | **444** (`8ac0a6cb`) | ✓ clean | M1 — 5 children + `quote-line.util`; `.bp-*` → global (RP-05) |
| `client-v2/.../inbox/inbox-project.component.ts` | 600 | **360** (`64e8153a`) | ✓ clean | M2/M5 — `app-inbox-rail` + `inbox-status`; `.bp-*` → global |
| `client-v2/.../store/item-edit.component.ts` | 438 | **398** (`5072e519`) | ✓ clean | M3 — `app-item-edit-actions` |
| `client-v2/.../projects/project-detail.component.ts` | — | (`23586099`) | ✓ clean | H1/H2 — dead send path + `ProjectOutreachStore` retired |

New extracted units (all under caps): `project-summary-tiles`,
`estimate-breakdown`, `estimate-preview-rail`, `estimate-item-row`,
`custom-line-dialog`, `quote-line.util`, `inbox-rail`, `inbox-status`,
`item-edit-actions`. Deleted: `project-outreach.store.ts`.

Open (product backlog, not audit debt): custom-line persistence (needs a
`project_items` column); Message-Suppliers Ball debit (`skip_balls`); the
"only «Supplier» offers «Item X»" leftover flag.

### Follow-on — pV2-UNIFY-01 (2026-07-08)

A live drift bug surfaced post-audit: the inbox rendered per-head price
(£105) where the Final Quote rendered £105 × qty + install (£17,325). Root
cause = the same conceptual line stored in two tables (`project_items` +
`message_items`) read by two formulas. Fixed by **unifying onto
`project_items`** (single line-state table; one price-parametrised formula in
`server/src/services/line-total.util.js`); `message_items` demoted to a
`(message_id, project_item_id)` tag join; `message_item_events` +
`message_item_decisions` FKs repointed to `project_items(id)`. Dev-mode
destructive migration (no backfill). **Closes RP-INB6** — no second
representation can drift when there's one table. Client: zero component
changes (the render corrects itself when the reader source flips).

---

## Diagnostic learnings — read before every audit

Patterns where chat's initial hypothesis turned out wrong; root cause was
something else. Captured so future audits don't repeat the misdiagnosis.

| Symptom | Initial hypothesis (wrong) | Actual root cause | Learning |
|---|---|---|---|
| First request slow with pg/Supabase | non-indexed ILIKE / missing trigram index | pool `min: 0` + grow-on-demand → second concurrent request paid TCP+TLS+auth | When seeing "first request slow" with pg, check pool `min:` / growth before reaching for index hypotheses. Closed v2.14c (pool `min: 2` + warm-up pair). |
| Dropdown opens UNDER the table (`p-select` in /settings/codelists) | overlay z-index — preset-level fix | overflow clipping (`overflow-hidden` on rounded wrapper + `opacity-60` stacking contexts on rows) — z-index can't escape clipping or stacking contexts | When an overlay "renders below" a container with `overflow-hidden` ancestors, the answer is usually portaling (`appendTo="body"`), not z-index. Fix lives at the equivalent "one place" though — `<app-edit-field>` is the choke for every dropdown app-wide. Closed v2.18d. |
| Specced sessionStorage secret-entry UI for ballpark admin (EA arc) | v2 has no working ballpark_admin auth → need an interim secret-entry pattern | v2 ALREADY had `ballpark_admin` role check working on existing settings pages (Page Settings / Categories / Codelists). Spec assumed "no auth exists yet" without auditing what's actually there | **Before specifying interim auth (or any interim infrastructure), audit what already exists.** Cost of over-spec: built a secret-entry UI nobody needed; CC had to retire it; spec-writing chat got pushback. Banked 2026-06-22 (pV2-EA-02). |
| Drawer flicker + dual-render on first MEDIA picker (welcome → MEDIA-01b QC) | focus trap fighting body scroll lock; backdrop click handler bug | content projection / portal issue with PrimeNG p-drawer wrapper — drawer content rendered in TWO places (overlay + original page DOM) because of missing `appendTo="body"` | When wrapping a PrimeNG primitive (p-drawer, p-dialog), verify `appendTo="body"` is set OR equivalent portal mechanism — without it, content stays in original DOM position AND gets cloned into overlay = dual render + focus chaos. Fix at primitive level so every consumer inherits. Closed MEDIA-01b. |

## Risk patterns — read before every audit

QC findings sharpen the next audit. When a bug class emerges, log it here
and grep against it across every subsequent audit pass. Each audit closes
out any pattern it disproves.

| # | Pattern | First seen | Status | Grep / check |
|---|---|---|---|---|
| RP-01 | Cold-path latency family — sequential fetch chains, idle-pool reconnect, AND **pool-grows-on-demand stalls** (when concurrent requests overlap and the pool is below its capacity, the Nth request pays a fresh TCP+TLS+auth handshake) | Profile slow load (v2.11g QC); search-slow-first-time on `/marketplace` (pV2-06a QC 2026-06-12) | **RP-01 substantially closed.** v2.12 pool keepalive (10min) + v2.12c boot initializers parallel (983ms → 238ms) + v2.14c `min: 2` pool floor + boot warm-up pair. Search-cold-query root cause was NOT non-indexed ILIKE (chat's initial hypothesis) — it was pool concurrency: keepalive kept connection #1 warm, but the FIRST time two requests overlapped (debounced search firing next to anything else), request #2 paid TCP+TLS+auth (~1-2s). Verified post-fix: two parallel never-cached queries complete in 76ms total. Cold-start login still PARKED. | grep `firstValueFrom` inside `resource()` loaders without `Promise.all`; if cold-start picked back up, measure OAuth callback → first-paint window. **Learning: when seeing "first request slow" with pg/Supabase, check pool `min:`/growth before reaching for index hypotheses.** |
| RP-02 | "Simplifications" wrapped over deeper plumbing that lose the user's intended semantic | Persona switcher Liam→Beth (v2.11g QC); persona-chain Liam → Ryan → Sarah (v2.12b QC) | **CLOSED BY REMOVAL** v2.12d. Surface eliminated — header switcher gone, `/auth/orgs` + `/auth/switch-org` removed, `dev-personas.ts` deleted, one-account-one-role model adopted. Discovery preserved as learning. | re-open if a future real org-switcher surfaces customer-side |
| RP-06 | Marketplace surface features ship to `/marketplace` but miss `/suppliers/:id` Store tab — same engine, two consumers; second consumer routinely lags. The reuse infrastructure exists (`<app-catalogue-layout>`, pinned `MarketplaceStore`, `<app-category-strip>`); the gap is a checklist gap. | v2.15a view toggle + 3-rail layout missing on supplier-detail (closed v2.15b/c); v2.16a subcat strip missing on supplier-detail Store tab | OPEN — second occurrence. | Before any marketplace-feature ship, grep both consumer templates (`marketplace-page.component.ts` + `supplier-detail.component.ts`) for the new component/binding. Long-term: extract `<app-subcategory-strip>` as a shared primitive both surfaces mount (same pattern as `<app-view-toggle>` extraction at v2.15c). |
| RP-05 | Component-local `.bp-*` class declarations violating the one-definition rule. `.bp-*` prefix is reserved for global semantic classes in `styles.css`; defining them inside a component's `styles: [...]` array makes the inventory untrackable + makes reuse impossible. | `.bp-viewtoggle`/`.bp-viewtoggle--active` in `marketplace-page.component.ts` (v2.14b); `.bp-itemprev-img`/`.bp-itemprev-img--empty`/`.bp-itemprev-close` in `item-preview.component.ts` (v2.14e) | **CLOSED BY PREVENTION** v2.14f — all 8 marketplace-arc definitions (viewtoggle ×2, itemprev ×3, rail-empty, catstrip ×2, item-card__img ×2) moved to styles.css §Marketplace utilities; `check-style-guards.js` now FAILS any `.bp-*` selector definition in component .ts files (plant-fail-revert drilled). Pre-RP-05 BEM-element files ratchet-allowlisted (edit-field, home-launcher, launcher-tile, page-hero) — shrink-only list. | Guard enforces; sweep the 4 allowlisted legacy files opportunistically on their next touch. |

| RP-04 | Hardcoded inline `EditFieldOption[]` arrays where a codelist would extend better — UI pinned to a snapshot of the data instead of the live truth (logged in CODELISTS.md + PILLS.md before it had a ledger row). | `/settings/pages` titleModes/aligns inline arrays (CODELISTS.md audit 2026-06-12) | **CLOSED** v2.19b (pV2-CODELISTS-02): pages-settings title-mode + hero-align and Profile country/currency all read `codelists.list(name)`. Remaining `EditFieldOption[]` arrays are NOT codelist-shaped: binary visibility mappings of booleans (correct per CODELISTS.md), data-derived options (suppliers, price brackets), and the marketplace tier filter — which filters `items.tier` (basic/mid/premium), a DIFFERENT enum from the budget_tier codelist; flagged as a future `item_tier` codelist candidate for the /store arc. | grep `EditFieldOption\[\] = \[` — matches WILL include the allowed binary visibility arrays + data-derived options; the check is that NO match mirrors a codelist namespace (zero raw matches is not the bar — audit 02-F-4). |
| RP-09 | v1-inherited codelist meta carries LITERAL hex colors (`#22c55e`-style) instead of token refs — a deliberate transition state (the metaColor fn passes hex through; net-new lists seed token refs like `--color-info`). If CODELISTS-02 forgets the sweep, status pills on v1-era lists bypass the token system permanently. | codelists-seed.js comment + chat audit pass (2026-06-12, pV2-CODELISTS-01) | **CLOSED** v2.19a (pV2-CODELISTS-02): 13 hex rows migrated to `--color-state-*` refs (idempotent HEX_TO_TOKEN sweep + token-native seed INSERTs + a seed-time warn if any hex survives). Tokens defined in BOTH apps' styles.css with the original v1 hex — zero visual change; v1's 4 raw consumers wrapped with `resolveMetaColor()` (v1.70b). Verified live: the SQL check returns 0 rows. | `SELECT list_name, code, meta->>'color' FROM shared.reference_codelist_values WHERE meta->>'color' LIKE '#%'` — 0 rows (re-check whenever a list is seeded). |

| RP-06 | Engine features wired in the STORE but not mounted on every consumer surface — marketplace gets the UI, supplier-detail (same store, same data) silently lacks it. Three instances in one arc: view-toggle (v2.15a), layout shell (v2.15b), subcat strip (v2.16a). | subcat strip missing on supplier Store tab (Liam QC + chat audit 2026-06-12) | **CLOSED BY EXTRACTION** v2.16b — `<app-subcategory-strip>` shared primitive mounted on both surfaces (joins view-toggle + catalogue-layout). Standing rule: any store-fed UI feature ships as a shared/catalogue primitive and is mounted on EVERY page that provides MarketplaceStore, same commit. | When adding any marketplace UI feature: grep `providers: [MarketplaceStore]` and verify each provider page mounts it. |
| RP-10 | Back-link drops sticky context — leaf page's Back uses a fixed `href` (e.g. `/marketplace`, `/projects`) instead of browser history, OR uses a contextual label (`Marketplace`, `Project`) instead of `Back`. Returning user lands at a generic surface with category/filter/scroll state lost. Both shapes are the same bug class — the entry path is the source of truth, not the developer's guess at where the user "should" return. | Supplier-detail `/suppliers/:id` Back wired as fixed `href: '/marketplace'` — dropped project + Catering filter context when entered from project fan-out (Liam QC 2026-06-24, pV2-INBOX-01 producer slice 1). | OPEN — first occurrence. | Per DESIGN.md §7 Back-link convention (LOCKED 2026-06-24): every `<app-page-hero [back]>` renders the literal label `Back` and navigates via `Location.back()` with `href` as direct-load fallback only. Audit grep: `[back]=\{.*label:` (any `label:` on `[back]` is a violation); `[back]=\{.*href:.*\}` without a corresponding history-back path in the component (verify `<app-page-hero>` is the only owner of the click handler — consumers must not bypass with their own `<a routerLink>`). |
| RP-11 | **A state rule implemented in N sites — the (N-1)-of-N failure.** A predicate that decides *"does this line count / display / apply?"* gets hand-typed into every reader instead of living in one place. It ships correct, then the NEXT change reaches all-but-one site and the surfaces silently disagree about the same row. Distinct from RP-04 (that's inline enum ARRAYS vs codelists; this is a duplicated PREDICATE). The tell: the first sighting is never the bug — the bug is the second edit. Both sightings so far were introduced and shipped by the author of the change and caught only by an independent audit. | pV2-UNIFY-01a M-2: the `DISTINCT ON (logical_line_id)` tiebreak had to be identical across `getEstimate` / `LIST_SELECT` / `listItems` — a comment was the only enforcement. **Same class, reintroduced 8 days later (2026-07-17 audit B2):** v2.57 added the declined-exclusion to `getEstimate` + `LIST_SELECT` but not `listItems`, so the Final Quote line list and the banner total picked different rows of one logical line (a live £5,000 quote invisible; category £0; client total counting it). Related same-arc: S2 — `COALESCE(p.client_name, …)` applied to 2 of 3 read sites, so v2.59's client name never rendered on the supplier inbox card. | **PARTIALLY CLOSED BY EXTRACTION** v2.61 — the declined rule is now ONE definition: `isDeclinedSql()` / `notDeclinedSql()` in `server/src/services/line-total.util.js` (beside `lineTotalSql`, the same file that already exists because this exact class bit us on the line formula), referenced by all three SQL readers; `isDeclined(l)` in `client-v2/.../quote-line.util.ts` referenced by the three client readers. Both sides now match on the `declined` PREFIX — the same rule `quoteStatus()` collapses with `startsWith('declined')` — so a new `declined_*` codelist value can't be seen by one side and missed by the other (verified against the DB incl. a synthetic `declined_by_future_code`, and NULL/cart → counts). The `DISTINCT ON` tiebreak itself is still comment-enforced across 3 sites — the next occurrence of this class will most likely be there. | **Grep signature: any predicate that decides "does this line count / display / apply" and appears in more than one file.** Concretely: grep both apps for the same status/state literal used in a conditional — `NOT IN ('declined`, `status === 'declined'`, `IN ('accepted','booked')`, `status IS NULL OR` — and count the FILES. More than one file = it wants extracting. Corollary for reviewers: when a change adds a rule to a query, enumerate every reader of that table/shape and prove the rule reached all of them; "I updated the totals" is not the same as "I updated every surface that picks a row". |
| RP-04 | Hardcoded status-label / enum-option arrays in components instead of codelist lookup. Second sighting confirms this is a pattern, not a one-off. Every re-audit finds new instances as arcs ship. | Third occurrence pass 2026-06-29: `inbox-project.component.ts:568,572` (`TERMINAL_STATUSES` + `STATUS_VIEW`); `project-estimate.component.ts:41-46` (`STATUS_LABELS` for `to_send`/`out_for_quote`/`quoted`/`booked`/`declined`); `item-edit.component.ts:295-299` (`installUnitOptions`). | OPEN — pattern reconfirmed. | Grep app-wide: `Record<.*, string>\s*=\s*\{` inside .ts components as the shape signature; every hit that mirrors a stored enum should be codelist-driven. Fixed sets that are truly closed (three-value install_unit) can be documented as intentional-inline in the row; sets that carry customer-facing labels or grow over time (status codes, unit codes) must migrate. |

### 2026-06-29 audit pass — INBOX + CART-01 + FINAL + STORE v2.41 arcs (auditor: chat)

Auditor grounded in the four arcs shipped since the 2026-06-24 STORE-01 architect audit. Findings recorded per-arc; 1-pagers (INBOX.md, STORE.md, PROJECTS.md, ITEMS.md) updated same day to close the doc-lag. Overall: **security + correctness solid; documentation drift and behemoth alarms are the recurring themes.**

| Arc | Ships | Verdict | Behemoth | RP hits | Docs updated |
|---|---|---|---|---|---|
| **INBOX** (INBOX-01/02/03/04) | v2.34v–v2.36f | Ship-quality — RP-INB1 (participant-scoping), decision #15 (decisions-as-messages format) both implemented correctly. Locked decision #4 drifted supplier-only → per-category during INBOX-04; INBOX.md rewritten to match reality (2026-06-29). Chip handler writes chat bubble + `message_item_decisions` row in one txn. | ALARM — `inbox-project.component.ts` 600 lines. Split thread pane / action-chip bar / compose on next touch. | RP-04 (TERMINAL_STATUSES + STATUS_VIEW), RP-05 (9 component-local `.bp-*` classes) | INBOX.md §Locked decisions #4 rewritten + risk-patterns section extended with RP-04 / RP-05 / behemoth notes |
| **CART-01** (Cart/Final split, install fields, supplier bands) | v2.38–v2.41g | Ship-quality — unified `<app-project-estimate>` driven by `view` input avoids RP-06. Server + UI read-only-after-sent guards both present. Cart/Final split predicate is `status === 'to_send'`. Custom lines in-session only (flagged intentional). | ALARM — `project-estimate.component.ts` 806 lines. Extract custom-line modal on next touch. | RP-04 (`STATUS_LABELS` in-file) | PROJECTS.md §Layout rewritten — 5 tabs, Cart/Final subsections, install choice + basis, read-only-after-sent, Message Suppliers dialog |
| **FINAL-01 + single-source cascade** | v2.36i, v2.37 | Ship-quality — math single-source (`server/src/services/estimate.js`); both card + estimate consume same compute path; client renders pre-computed `EstimateBreakdown`, no re-math. `LINE_TOTAL_SQL` centralises install-basis formula. | (project-estimate.component.ts covered above) | — | PROJECTS.md §Final Quote tab + §Install choice & install basis + §Single-source Ballpark cascade sections added |
| **STORE v2.41a** (approved editability + install_unit) | v2.41a (schema in v2.34p) | Ship-quality — approved items become editable (fields only; photos lock) — material UX reversal from prior spec. Five new fields (`unit`, `install_cost`/renamed, `install_unit`, `install_description`, `location_coverage`, `currency`) all in schema + form + service. | — | RP-04 (`installUnitOptions` fixed set; acceptable inline per §RP-04 row notes) | STORE.md Fields table rewritten + decision #11 added (approved editability reversal); ITEMS.md `install_unit` row added + Unit "not editable" audit gap flipped to RESOLVED |

**Cross-arc themes:**

- **RP-04 pattern reconfirmed** — three new inline enum-shaped arrays across three ships. Standing rule updated: `Record<.*, string> = {` inside components is the grep signature. The `install_unit` fixed set is acceptable (documented intent); status-label arrays are not (customer-facing, growable) and should migrate.
- **Behemoth alarms in the two arcs with the most UX iteration** — INBOX (600) + Cart/Final (806). Both natural candidates for child-component extraction on next touch. Neither blocks ship but both go on the next-touch shortlist.
- **No RP-INB1, RP-INB2, RP-INB6 hits.** Message ownership scoping consistently derives org from JWT; no client-supplied org filters trusted. Attachment path deferred (out of scope this arc).
- **No RP-06 hits.** CART-01's biggest RP-06 risk (Cart-vs-Final drift) was pre-empted by the one-component-two-views design; INBOX's supplier-vs-agent variant is also one component with role-conditional rendering.
- **Doc drift is the biggest single finding.** All four arcs had material undocumented behaviour in their 1-pagers before this pass. Landing 1-pager updates in the same PR as the ship (or immediately after) would close this gap; the current post-hoc audit sweep is expensive.

Each future audit pass reads this section first and verifies every open
row's check against the current ship's surface area.

## Sunset-tracked tech debt

Deliberate interim measures that MUST be removed by a named future ship.
Each row carries a hard sunset condition — these are not "nice to clean up
someday," they are load-bearing-until-X and a liability past X.

| # | What | Where | Introduced | Sunset condition |
|---|---|---|---|---|
| TECH-DEBT-02 | **Signup PII capture — `ip_address` + `user_agent`.** `marketing.guestlist_signup` has captured `ip_address` + `user_agent` server-side on every signup since v1 — PII beyond the name + email a registrant knowingly provides. Not surfaced anywhere and not used, but collected + retained indefinitely. Needs: (a) a privacy-policy mention of what's captured, (b) a retention decision (how long / auto-purge), (c) potentially stop collecting it entirely if there's no analytics/anti-abuse use. Not blocking — bookmarking now so it isn't lost. | `server/src/services/marketing.service.js` (`createSignup` INSERT) + `server/src/db/migrate-schemas.js` (`marketing.guestlist_signup.ip_address` / `user_agent`) | 2026-06-22, pV2-EA-01 (pre-existing since v1; logged now) | **Address in a dedicated pV2-PRIVACY-01 ship** — decide collect/retain/purge + privacy-policy copy. Not gated to a single milestone; resolve before any public-marketing privacy review. |
| SUNSET-01 | **Vestigial `users` columns — `name` + `role` + `org_id`.** Three columns no longer architecturally meaningful but still load-bearing: `users.name` (NOT NULL, written by v2 `auth.service.js` (Google SSO) + `team.js` (invite) + `user.service.js` + all seeds — can't drop without first relaxing NOT NULL + stopping writes); `users.role` (still read by v1 client-angular admin UI — `app-shell.component.ts:752` + `top-nav.component.ts:439` do `users[0].role === 'admin'` — dropping would break v1 visually); `users.org_id` (written by seeds + `user.service.js`, read by v1 `item-detail` + persona — superseded by `default_org_id`/`user_orgs` but not unreferenced). Removing now = destructive migration on shared preview/prod DB + NOT NULL conflict + v1 still live = churn + risk for zero functional gain. | `server/src/db/migrate-schemas.js` (`users` table); writers in `server/src/services/auth.service.js`, `server/src/routes/team.js`, `server/src/services/user.service.js`, seeds; readers in `client-angular/src/app/shell/app-shell.component.ts`, `client-angular/src/app/.../top-nav.component.ts` | 2026-06-23, logged during STORE-01 doc sweep | **Fold into pV2-11 v1 retirement sweep.** Sequence: (1) v1 client off → nothing reads `role`/`org_id`; (2) update v2 inserts in auth.service.js + team.js + user.service.js + seeds to stop writing name/role/org_id; backfill any null `display_name` from `name`; (3) DROP three columns via `migrate-schemas.js` across all schemas, relax `name` to nullable or drop. **MUST NOT remain past pV2-11.** |
| TECH-DEBT-01 | **[`/api/admin/*` secret gate RETIRED 2026-06-22 / pV2-EA-02b — now gates on `authenticate` + `requireActiveMembership('admin.cross_org_view')`, the verified session role; `middleware/admin.js` deleted. The residual `GET /api/org/users` PII exposure below is the remaining open item until AUTH-01.]** **Interim admin gate — shared secret over forgeable header.** `/api/admin/*` is gated by an `x-bp-admin-secret` header matched against the `ADMIN_API_SECRET` env (constant-time compare); when the env is unset (local dev) it falls back to the legacy `x-bp-user-id` role lookup as an explicit dev-only bypass. Replaces the prior gate that trusted `x-bp-user-id` alone — which was forgeable because `GET /api/org/users` hands any anonymous caller every user's id + role, so knowing an admin UUID granted full read/write over the guestlist (PII) + welcome content/settings + Resend test-sends. The secret defangs that. **Residual (NOT closed here):** `GET /api/org/users` still returns `SELECT *` (incl. name/email/role) to anonymous callers — a v1-era dev-shim the v1 client depends on to self-identify (`users[0].id` → header) and that `user-context.js` audit attribution reads. It can't be hardened without breaking v1's identity bootstrap, and it's not part of the v2/welcome surface. The secret gate removes its value as an *escalation* vector; the remaining `users`-table PII exposure retires with v1 / at AUTH-01. | `server/src/middleware/admin.js`; consumed by `server/src/routes/adminMarketing.js`; residual at `server/src/index.js` (`GET /api/org/users`) + `server/src/services/user.service.js` (`getByOrg`) | 2026-06-18, interim welcome prod-gate fix | **Replace with v2 Supabase JWT auth at pV2-AUTH-01; MUST NOT remain past that ship.** At AUTH-01: delete the secret/header bypass in `admin.js` and gate `/api/admin/*` on the verified JWT subject + admin role; gate or scope `GET /api/org/users` so it no longer returns user PII to anonymous callers; retire `x-bp-user-id` everywhere it is still trusted. |

## How to use this ledger

1. **After every ship** — the chat audit-before-shipped pass updates rows
   for every file touched in that ship report, recording the new SHA + line
   count + date.
2. **Before any non-trivial code change** — author checks the row for that
   file. If "Last audited" is older than the file's last commit (SHA
   mismatch), audit-before-shipped is mandatory before the next merge.
3. **Periodic sweep** — once a month or before a major arc starts, run a
   pass over every row whose recorded SHA differs from current HEAD. Flag
   any new files in the tree that aren't in the ledger yet.
4. **Bloat watch** — any row whose line count hits Warning gets a
   "consider extracting" note; Alarm blocks the next change on that file.

**Status legend:**

- `✓ clean` — audit passed, no open concerns
- `✓ flagged` — audit passed but with minor concerns logged in Notes
- `△ drifted` — file changed since last audit; needs re-pass
- `○ unaudited` — never had a formal audit pass

---

## Client (v2) — Pages

| File | Lines | SHA | Last audited | By | Status | Notes |
|---|---|---|---|---|---|---|
| `client-v2/src/app/pages/landing/landing.component.ts` | 38 | `960ab5a` | — | — | ○ unaudited | Public landing, pV2-02b ship |
| `client-v2/src/app/pages/login/login.component.ts` | 36 | `e842a00` | 2026-06-12 | chat | ✓ clean | v2.12e: dev picker + devUsers resource + redirect effect REMOVED. Single Google-branded button on `.bp-btn-outline` chrome. `public/google-g.svg` brought in as ASSET (not inlined SVG) so style guard never scans the G mark's brand hex. Shrunk 83→36 lines. |
| `client-v2/src/app/pages/auth-callback/auth-callback.component.ts` | 38 | `8f2a47b` | — | — | ○ unaudited | OAuth callback |
| `client-v2/src/app/pages/onboarding/onboarding.component.ts` | 162 | `3714904` | — | — | ○ unaudited | Agency/Supplier radio tiles, pV2-02b ship |
| `client-v2/src/app/pages/onboarding/org-name-default.ts` | 23 | `ca5639c` | — | — | ○ unaudited | Helper |
| `client-v2/src/app/pages/home/home-agent.component.ts` | 36 | `f7884c1` | 2026-06-12 | chat | ✓ clean | v2.12f: role ternary replaced with `tilesForOrgType(orgType)` from launcher-tiles registry — clean one-switch dispatch ballpark→2 / supplier→3 / agency→5. One Definition holds. |
| `client-v2/src/app/pages/home/hero-title.ts` | 33 | `8e4ef60` | — | — | ○ unaudited | Title-mode resolver |
| `client-v2/src/app/pages/settings/team/team.component.ts` | 184 | `d2171f2` | — | — | ○ unaudited | pV2-03 ship; cap approaching (250) |
| `client-v2/src/app/pages/settings/team/team-member-row.component.ts` | 86 | `5d5af22` | — | — | ○ unaudited | Member row chrome |
| `client-v2/src/app/pages/settings/profile/profile.component.ts` | 170 | `4467616` | 2026-06-11 | chat | ✓ flagged | Re-audited at v2.11g. Typography + structure match locked v2 edit-form standard (`<app-edit-section>` + `<app-edit-field>` at page density). "Organisation" → "Company Information" retitle landed in v2.11e. canEdit gate still blocks Liam (ballpark_admin lacks `org.manage_billing`) — pending matrix change in in-flight ballpark-home work. |
| `client-v2/src/app/pages/settings/pages/pages-settings.component.ts` | 162 | `8e750f4` | 2026-06-11 | chat | ✓ flagged | Audited at commit `ae27fc8` (v2.10d). TYPE-01 classes ✓, no raw colors, two-layer auth, jsonb_set merge-write, audit columns + triggers on DB. Six minor concerns logged in chat transcript: updated_by not surfaced, no created_by stamping on first INSERT, no ballpark row yet, no save confirmation, title-mode 'username'/'orgName' show admin's own data not edited org's, permission semantic conflation (`admin.cross_org_view` doubling as page_config gate). |
| `client-v2/src/app/pages/stub/coming-soon.component.ts` | 36 | `4b754ea` | 2026-06-12 | chat | ✓ clean | v2.12f: AuthService inject + orgType arg → org-aware `tileForPath` so a supplier's stub hero shows supplier copy, an agent's shows agent copy. Stub hero plumbing One Definition. |
| `client-v2/src/app/pages/style/hero/hero-demo.component.ts` | 62 | `0b3fa16` | — | — | ○ unaudited | Dev-only style sandbox |

## Client (v2) — Shell

| File | Lines | SHA | Last audited | By | Status | Notes |
|---|---|---|---|---|---|---|
| `client-v2/src/app/shell/app-shell.component.ts` | 37 | `054ce72` | 2026-06-11 | chat | ✓ clean | Re-audited at v2.11g. Header now sticky + opaque (v2.11d — `bg-bg` instead of transparent); page-hero scroll-over fixed. Still 37 lines. |
| `client-v2/src/app/shell/page-hero/page-hero.component.ts` | 132 | `788f67c` | 2026-06-11 | chat | ✓ clean | Re-audited at v2.11g. Separator removed in v2.11d; title rides `--text-hero` (40); subtitle rides `--text-xl` (18) post v2.11g ramp. |
| `client-v2/src/app/shell/user-menu/user-menu.component.ts` | 89 | `b673317` | 2026-06-12 | chat | ✓ clean | v2.12d: persona switcher removed. Shrunk 126→89 lines (-29%). Identity is now stable across session — no header-side identity-swap surface. |
| `client-v2/src/app/shell/version-chip/version-chip.component.ts` | 31 | `3c61288` | — | — | ○ unaudited | `[Dev v2] vX.YYz` chip, fixed bottom-right |

## Client (v2) — Shared components + primitives

| File | Lines | SHA | Last audited | By | Status | Notes |
|---|---|---|---|---|---|---|
| `client-v2/src/app/shared/edit-field/edit-field.component.ts` | 205 | `9fae040` | 2026-06-11 | chat | ✓ flagged | Re-audited at v2.11g. 3 value-color pins added for `.bp-fld` chrome → `--color-text-strong` (PrimeNG select + inputnumber adapters). **Still at warning band (205/250)** — extract type-specific bodies (text vs select vs number) when next touched. |
| `client-v2/src/app/shared/edit-section/edit-section.component.ts` | 69 | `6b3fe17` | 2026-06-11 | chat | ✓ clean | Rewritten v2.11c — hover-pencil retired; bottom-left `.bp-card-foot` row with Edit / Cancel / Save changes per v1 standard; `.bp-edit-section-title` baked in. 45 lines lighter, cleaner template. The reference primitive for the locked edit-form pattern. |
| `client-v2/src/app/shared/launcher/home-launcher.component.ts` | 153 | `bf94771` | — | — | ○ unaudited | Master component (used by home + future ballpark home). pV2-04b1-qc QC'd. |
| `client-v2/src/app/shared/launcher/launcher-tile.component.ts` | 93 | `58dcbc1` | — | — | ○ unaudited | Tile chrome; pV2-04b2-qc QC'd through hover + rounding fixes |
| `client-v2/src/app/shared/launcher/launcher-tiles.ts` | 156 | `e264576` | 2026-06-12 | chat | ✓ clean | Renamed v2.13b from `agent-tiles.ts`. Holds AGENT_TILES (5), SUPPLIER_TILES (3), BALLPARK_TILES (2), STOREFRONT_HUB, PROJECTS_HUB. `tilesForOrgType(orgType)` is the dispatch; `tileForPath(path, orgType?)` is org-aware so shared routes (`/projects`, `/inbox`) render per-role copy. v2.13b §14 catch: `/my-shop` → `/store` (internal name follows §14 storefront/store distinction, UI label "My Shop" preserved). |
| `client-v2/src/app/pages/supplier/storefront.component.ts` | — | — | 2026-06-12 | chat | ✓ clean | v2.13b: replaces stub `/marketplace-profile`. Hub launcher (Marketplace / My Shop / Profile). Title "Storefront" per §14. |
| `client-v2/src/app/pages/supplier/projects-hub.component.ts` | — | — | 2026-06-12 | chat | ✓ clean | v2.13a: supplier sub-hub for project buckets (Quoting / Live / Completed). Bucket query params via new LauncherTile.query input. Live counts deferred (needs v2 projects count endpoint). |
| `client-v2/src/app/shared/launcher/launcher-tile.types.ts` | 9 | `af326ca` | — | — | ○ unaudited | Type defs |
| `client-v2/src/app/shared/user-avatar/user-avatar.component.ts` | 94 | `06e32de` | — | — | ○ unaudited | Initials circle + gradient + image variants |
| `client-v2/src/app/shared/wordmark/wordmark.component.ts` | 22 | `28d8621` | — | — | ○ unaudited | Brand wordmark |
| `client-v2/src/app/shared/public-header/public-header.component.ts` | 29 | `430fcbd` | — | — | ○ unaudited | Public landing header |

## Client (v2) — Core (services + auth + types)

| File | Lines | SHA | Last audited | By | Status | Notes |
|---|---|---|---|---|---|---|
| `client-v2/src/app/core/auth/auth.service.ts` | 101 | `d239b9b` | 2026-06-12 | chat | ✓ clean | v2.12d: `listDevUsers` removed; `devLogin` retained for tooling/QC against the still-live `POST /auth/dev/login`. Identity surface tightened. 115→101 lines. |
| `client-v2/src/app/core/auth/permissions.ts` | 33 | `1e53850` | 2026-06-11 | chat | ✓ clean | Matrix verified post-PAGES-01: ballpark_admin → `admin.cross_org_view` only (page_config.edit not added — deferred concern). |
| `client-v2/src/app/core/auth/dev-personas.ts` | — | — | 2026-06-12 | chat | DELETED (v2.12e) — zero consumers post login simplification; 57→54 specs. |
| `client-v2/src/app/core/auth/admin.guard.ts` | 14 | `0d1171a` | — | — | ○ unaudited | Generic admin guard |
| `client-v2/src/app/core/auth/ballpark-admin.guard.ts` | 15 | `df8df8b` | 2026-06-11 | chat | ✓ clean | New in PAGES-01. Checks `admin.cross_org_view`, redirects to `/home`. |
| `client-v2/src/app/core/auth/requires-org.guard.ts` | 16 | `e4c5831` | — | — | ○ unaudited | Bounces orgless users from /home |
| `client-v2/src/app/core/auth/needs-onboarding.guard.ts` | 13 | `c062760` | — | — | ○ unaudited | Inverse — bounces users WITH orgs from /onboarding |
| `client-v2/src/app/core/config/page-config.service.ts` | 63 | `e660e5f` | — | — | ○ unaudited | Reads org_type_config; called by home + table |
| `client-v2/src/app/core/config/page-config.types.ts` | 43 | `aeadfca` | — | — | ○ unaudited | Shared types between client + server |
| `client-v2/src/app/core/api.service.ts` | 52 | `8509346` | — | — | ○ unaudited | HTTP wrapper |
| `client-v2/src/app/core/brand-config.service.ts` | 51 | `ddcb960` | — | — | ○ unaudited | DB → `:root` runtime token bridge (`--bp-font` source) |
| `client-v2/src/app/core/runtime-config.service.ts` | 33 | `c4812e4` | — | — | ○ unaudited | `/runtime-config.json` bootstrap |
| `client-v2/src/app/core/team/team.service.ts` | 48 | `880ec91` | — | — | ○ unaudited | Team API |
| `client-v2/src/app/core/organisation.service.ts` | 36 | `a98c938` | — | — | ○ unaudited | Org API; profile page will use this |
| `client-v2/src/app/core/onboarding.service.ts` | 17 | `76ae001` | — | — | ○ unaudited | Onboarding API |
| `client-v2/src/app/core/http-error.ts` | 12 | `5821924` | — | — | ○ unaudited | Error type |

## Server — Routes + services

| File | Lines | SHA | Last audited | By | Status | Notes |
|---|---|---|---|---|---|---|
| `server/src/routes/config.js` | 132 | (see commit `ae27fc8`) | 2026-06-11 | chat | ✓ clean | PUT gate tightened to `admin.cross_org_view`; own-orgType check removed (platform admins write any row); Zod-validated; v1/v2 dual-auth shim documented for retire at pV2-11. |
| `server/src/services/config.service.js` | 108 | (see commit `ae27fc8`) | 2026-06-11 | chat | ✓ clean | jsonb_set merge-write avoids RMW races; v1 'admin' ↔ v2 'ballpark' boundary normalisation; degrades cleanly when migration absent (42P01 catch). |
| `server/src/schemas/page-config.schema.js` | 25 | (see commit `ae27fc8`) | 2026-06-11 | chat | ✓ clean | Zod schema; all fields optional (partial payloads valid); unknown keys stripped, not errored. |
| `server/src/services/permissions.service.js` | — | — | 2026-06-11 | chat | ✓ clean | Matrix mirrors client; `ballpark_admin → admin.cross_org_view`. |
| `server/src/middleware/require-active-membership.js` | — | — | — | — | ○ unaudited | Per-request live membership check |
| `server/src/middleware/authenticate.js` | — | — | — | — | ○ unaudited | JWT cookie auth |
| `server/src/services/auth.service.js` | — | — | — | — | ○ unaudited | Google OAuth upsert, deriveRole |
| `server/src/db/migrate-schemas.js` | (large — admin tool) | — | partial | chat | ✓ flagged | `org_type_config` migration verified for PAGES-01; audit columns + triggers correctly attached. Other tables not exhaustively re-audited. |

---

## Bloat watch — Files at or near soft caps

| File | Lines | Cap | Action |
|---|---|---|---|
| `client-v2/src/app/shared/edit-field/edit-field.component.ts` | 205 | 250 (component) | At warning. Extract type-specific bodies (text / select / number) into sub-components when next touched. Not blocking. |
| `client-v2/src/app/pages/settings/codelists/codelists-settings.component.ts` | ~~248~~ → 216 → **254** | 250 (component) | Resolved at v2.19b (value-row extraction, 248 → 216), drifted back over warning at v2.21b (toast outcome wiring → 254; dialogs audit F-6). Just over warning. Next growth → extract a values-grid subcomponent or a shared toast-message helper. |
| `client-v2/src/app/pages/settings/pages/pages-settings.component.ts` | 223 | 250 (component) | At warning (grew 162 → 223 in CODELISTS-02 sweep — codelist resources + computeds). Watch next touch; if title/subtitle for other pages multiply, extract a per-role-block component. |
| `client-v2/src/app/shared/edit-field/edit-field.component.ts` | 204 | 250 (component) | Stable in warning band. Architect's F-7 (CODELISTS-02 audit) restated: extract type-specific bodies (text / select / number) when next touched. |
| `client-v2/src/app/pages/settings/profile/profile.component.ts` | ~~218~~ → ~~660~~ → **274** | 250 warn / 400 alarm | **Resolved** v2.34u — extracted `ProfileEditService` (the org form/save/media state machine, 194), `<app-profile-team-section>` (142), `<app-profile-shopfront>` (59); shell now binds to the service + mounts the children. Under alarm; just over warn (template is the section layout). |
| `client-v2/src/app/pages/store/item-edit.component.ts` | ~~454~~ → **399** | 250 warn / 400 alarm | **Resolved** v2.34t (STORE-01 audit F-2): extracted `<app-item-approval-panel>` (39) + moved `.bp-*` styles to styles.css. Now just under alarm — watch on next touch. |
| `server/src/routes/marketplace.js` | ~~456~~ → **280** | 200 warn / 300 alarm | **Resolved** v2.34t (F-2): `/suppliers*` (4 endpoints) split to `marketplace-suppliers.js` (190). Under alarm. |
| `client-v2/src/app/shared/catalogue/item-card.component.ts` | 286 | 250 warn / 400 alarm | Warning band (97 → 286 across STORE-01 — owner actions + confirm flows). Watch; if a 4th action lands, extract the action row. |
| `client-v2/src/app/pages/marketplace/marketplace-store.ts` | 280 | 250 warn / 400 alarm | Warning band (owner/admin filters added). Watch. |
| `server/src/services/item.service.js` | 293 | 200 warn / 350 alarm | Warning band (data-model + duplicate). Watch. |

**At Alarm:** none. (`profile.component.ts` resolved at v2.34u — 660 → 274.)

## Bonus — styles.css

Not formally tracked above (rules vary widely) but worth noting: `client-v2/src/styles.css` is at **299 lines** as of v2.11g, SHA `aa8bb13`. Layer-1 tokens + ~25 Layer-2 role classes + §8 button chrome + drawer density variants. Healthy — central source of truth, no per-component CSS bloat.

## Codelists arc files (pV2-CODELISTS-01)

| File | Lines | Last audited | By | Status | Notes |
|---|---|---|---|---|---|
| `client-v2/src/app/core/codelists/codelist.service.ts` | 82 | 2026-06-12 | chat | ✓ clean | Same cache discipline as CatalogueService — promise-dedup + failed-flight eviction + `tap(() => invalidate())` on writes. Read path `/values`; admin paths gated server-side. |
| `client-v2/src/app/core/codelists/codelist.types.ts` | (small) | 2026-06-12 | chat | ✓ clean | Types + `metaColor()` helper for resolving token references vs literal hex |
| `client-v2/src/app/shared/status-pill/status-pill.component.ts` | 58 | 2026-06-12 | chat | ✓ clean | The locked primitive. Signal-driven, `resource()` for cached fetch, F-3 dedup explicitly commented. Inline style is the One Sanctioned Dynamic Style Case (codelist meta colors = data). Unknown codes render raw code on neutral chrome — never blank. |
| `client-v2/src/app/pages/settings/codelists/codelists-settings.component.ts` | 248 | 2026-06-12 | chat | ✓ flagged | Master/detail curation page, ballparkAdminGuard'd. Uses role classes throughout (`.bp-field-label`, `.bp-meta`, `.bp-table-column-header`, `.bp-body-small`, `.bp-caption`, `.bp-type-badge`). **At warning cap (248/250) — F-7: extract value-row component on next touch is required, not optional.** Without it, one more feature pushes past 400 (alarm) and forces emergency refactor. |
| `server/src/routes/codelists-v2.js` | 131 | 2026-06-12 | chat | ✓ clean | Mounted on gated v2 router. `admin.cross_org_view` on curation routes. parseList/parseCode Zod validators (F-1 contract). System-list write attempt → 403 with locked-rule pointer. Default deactivate attempt → 409 with reworded F-2 message. **DELETE → 405 with educational rationale + docs/CODELISTS.md pointer.** |
| `server/src/services/codelist.service.js` | (need to verify) | 2026-06-12 | chat | ✓ clean (sampled) | Houses `inUseCount`, `values`, `valuesAll`, `addValue`, `patchValue`, `lists`. F-1 whitelist + regex per audit triage. |
| `server/src/schemas/codelist-value.schema.js` | (small) | 2026-06-12 | chat | ✓ clean | Zod for `ListName`, `CodeParam`, `CodelistValueCreate`, `CodelistValuePatch` |
| `server/src/db/codelists-seed.js` | 60+ | 2026-06-12 | chat | ✓ clean | 12 locked parents present. message_status verbatim from CODELISTS.md worked example. Country = full ISO 3166-1 alpha-2 (249 entries, Intl-resolved labels). Three-layer no-DELETE documented in header. `default_code ↔ is_default` invariant noted. v1-inherited status lists keep hex `.color` until CODELISTS-02 migrates consumers (deliberate transition state — see RP-09 below). |
| `client-v2/src/styles.css` (`.bp-type-badge` at line 597 + 610) | n/a | 2026-06-12 | chat | ✓ clean | New utility class, properly global per RP-05 enforcement |

### Architect audit verdict (CC, 2026-06-12)

"Ships with strong architectural discipline and excellent safety guardrails" — production-ready, no new risk patterns. Full report: `docs/audits/2026-06-12-codelists-arc-architect-audit.md`. 4 accepted / 2 rejected with rationale / 1 noted (F-7 bloat).

### Chat audit verdict (2026-06-12)

✓ Clean. Aligns with locked `CODELISTS.md` spec. Adopts marketplace patterns (cache discipline, gated routes, role classes, edit-field reuse, Zod-validated params, ballparkAdminGuard). Three-layer no-DELETE enforcement verified at API + DB + seed. All audit F-1/F-2/F-3 fixes present in code. F-7 bloat watch tracked. RP-04 (inline option arrays) closure prep landed — primitive exists; consumer sweep is CODELISTS-02.

## Marketplace arc files (pV2-MARKET-00 + pV2-06a)

| File | Lines | SHA | Last audited | By | Status | Notes |
|---|---|---|---|---|---|---|
| `client-v2/src/app/pages/marketplace/marketplace-page.component.ts` | 154 | `c55da31` | 2026-06-12 | chat | ✓ flagged | Route shell mounts hero + search + 3 regions. Page hero pulls from PageConfigService (integrates with /settings/pages — `marketplaceTitle`/`marketplaceSubtitle` getters needed). **`.bp-viewtoggle` defined as component-local style — should promote to styles.css per the `.bp-*` one-definition rule.** allItemsCount derived from category counts sum (no extra request). |
| `client-v2/src/app/pages/marketplace/marketplace-store.ts` | 117 | `7571438` | 2026-06-12 | chat | ✓ clean | Route-scoped (no `providedIn:'root'`), URL-is-state via `toSignal(queryParamMap)`, `linkedSignal` for offset reset on filter change (right Angular 21 pattern), selection derived from already-loaded data (selection never fetches — architecture guarantee holds), railMode derived computed. Writers navigate via `merge()`; `void router.navigate(...)` discards promise (LOW — fire-and-forget for nav is fine). |
| `client-v2/src/app/pages/marketplace/rail/right-rail.component.ts` | 51 | `5b21a39` | 2026-06-12 | chat | ✓ clean | Polymorphic host; `@switch` on `store.railMode()` to mode component. Item/cat/quote placeholders for 06b/e/f. |
| `client-v2/src/app/pages/marketplace/rail/item-preview.component.ts` | 104 | `51d740b` | 2026-06-12 | chat | ✓ flagged | v2.14e (pV2-06b): real preview, not placeholder. Pure preview over loaded row (`input.required<CatalogueItem>` + categoryName input); zero `/items` fetches on selection verified by CC. Uses role classes (`.bp-card-title`, `.bp-meta`, `.bp-field-label/value`, `.bp-body-small`). **RP-05: 3 `.bp-*` classes defined component-local** (`.bp-itemprev-img`, `.bp-itemprev-img--empty`, `.bp-itemprev-close`) — promote to styles.css. |
| `client-v2/src/app/pages/marketplace/rail/right-rail.component.ts` (v2.14e update) | ~73 | `51d740b` | 2026-06-12 | chat | ✓ clean | Wired item-preview into the `railMode === 'item'` case; passes selectedItem + categoryName from the store. |
| `client-v2/src/app/shared/catalogue/catalogue-grid.component.ts` | 86 | `2b08823` | 2026-06-12 | chat | ✓ clean | Pure presentation (entities in / selection events out, zero fetching). `@switch` on viewMode → card grid / list rows / table. Uses TYPE-01 role classes + token-mapped Tailwind. First 6 cards eager-loaded for above-the-fold; rest lazy. |
| `client-v2/src/app/shared/catalogue/catalogue-search.component.ts` | 46 | `a4d5d88` | 2026-06-12 | chat | ✓ clean | Dumb input + count display. 300ms debounce in component before writing the `q` URL param. |
| `client-v2/src/app/shared/catalogue/category-strip.component.ts` | 68 | `2f61940` | 2026-06-12 | chat | ✓ clean | Port of v1 category-circles as the left rail. Counts baked into CategoryInfo from server GROUP BY. All + per-cat selection states. |
| `client-v2/src/app/shared/catalogue/item-card.component.ts` | 97 | `6874a2c` | 2026-06-12 | chat | ✓ clean | Card chrome via tokens + role classes. `eager` input for above-the-fold images. |
| `client-v2/src/app/shared/catalogue/catalogue.types.ts` | 66 | `aa5b65d` | 2026-06-12 | chat | ✓ clean | CatalogueItem, CategoryInfo, RailMode union, ViewMode + asViewMode parser (fail-safes to 'card' on garbage), Paginated envelope type. |
| `client-v2/src/app/core/marketplace/catalogue.service.ts` | 75 | `eb0954f` | 2026-06-12 | chat | ✓ clean | Session cache by URL with promise-keyed concurrent-request dedup. Failed flights evict (no cache poisoning). `invalidate()` busts everything; `updateCategory` busts via `tap()`. `adminCategories` bypasses cache (live editing surface). Matches architecture §4 spec verbatim. |
| `server/src/routes/marketplace.js` | 183 | `da65ee4` | 2026-06-12 | chat | ✓ clean | Mounted on the GATED v2 router. `requireActiveMembership('admin.cross_org_view')` on curation endpoints. Items endpoint: Zod-validated query (`uuid` cat/sub, q≤80, offset), born-paginated `{items, total, hasMore}` envelope (`PAGE_SIZE` 48), `ownedByActiveOrg` derived from `req.user.org_id` server-side (no client trust), ILIKE search with escaped wildcards (no LIKE injection), every value $n-bound, `COUNT(*) OVER()` for total in one query. |
| `server/src/routes/categories.js` | 32 | `f8e00b8` | 2026-06-12 | chat | ✓ clean | v2.14c: 4 ungated write verbs deleted (RP-03 closed). GETs remain for v1 browse until pV2-11 retirement window. Router fall-through delivers 401 on removed verbs (verified live). |
| `server/src/db/pool.js` | 98 | `0858895` | 2026-06-12 | chat | ✓ clean | v2.14c: `min: 2` floor + boot warm-up pair fix the slow-first-search RP-01 root cause (pool-grows-on-demand on overlapping requests). Audit-attribution wrap intact. |
| `server/src/schemas/marketplace-query.schema.js` | 18 | `be17ebd` | 2026-06-12 | chat | ✓ clean | `ItemsQuerySchema` (uuid cat/sub, q max 80, offset coerced int min 0). `PAGE_SIZE` constant exported. |

### Marketplace arc files — pV2-06d (v2.15a + v2.15b)

| File | Lines | SHA | Last audited | By | Status | Notes |
|---|---|---|---|---|---|---|
| `client-v2/src/app/pages/suppliers/supplier-detail.component.ts` | 224 | `e05d068` | 2026-06-12 | chat | ✓ flagged | v2.15b: mini-store deleted, mounts shared MarketplaceStore via `providers: [MarketplaceStore]` with pinned-supplier scope. Two tabs (Storefront / Store) via `<app-tab-band>`. **Approaching 250 warn cap** — ~50 lines is inline Storefront-tab markup (brand panel + contact card); extract `<app-storefront-panel>` + `<app-supplier-contact-card>` when next touched. **`viewMode="card"` hardcoded on Store-tab grid** — view toggle button row not rendered; clarify intentional vs missing. |
| `client-v2/src/app/shared/catalogue/supplier-grid.component.ts` | 75 | `9519e1c` | 2026-06-12 | chat | ✓ clean | New v2.15b. Mirrors catalogue-grid shape; supplier view modes work; favourites integrated; routes to `/suppliers/:id`. |
| `client-v2/src/app/shared/catalogue/catalogue-layout.component.ts` | 17 | (new v2.15b) | 2026-06-12 | chat | ✓ clean | The 3-region shell, ONE definition. `ng-content` slots `[strip]` / default / `[rail]`. Used by marketplace-page + supplier-detail Store tab. Pure structural primitive. |
| `client-v2/src/app/shared/catalogue/supplier-card.component.ts` | 55 | `a3fa4d8` | 2026-06-12 | chat | ✓ clean | Supplier card chrome — logo / name / city / count + favourite affordance. |

### Findings from the consolidated marketplace audit

| Severity | Finding | Action |
|---|---|---|
| MEDIUM | `.bp-viewtoggle` defined in `marketplace-page.component.ts` `styles: [...]` block. The `.bp-*` prefix is reserved for global semantic classes per ENGINEERING.md one-definition rule. Defining a `.bp-` class component-local conflicts with that contract. | Promote to `client-v2/src/styles.css` so future surfaces (supplier detail, project list) can reuse the view toggle without re-deriving the chrome. New row in DESIGN.md §5 if appropriate (likely an INLINE / utility role, not a type role). |
| LOW | `void this.router.navigate(...)` in `marketplace-store.merge()` discards the navigation promise. | Not blocking — fire-and-forget for navigation rarely fails. Worth a Rule 5 awareness note if errors ever surface. |

### Architecture conformance — all guarantees verified in code

- ✓ Route-scoped store (`@Injectable()` no `providedIn`, provided in `MarketplacePageComponent.providers`)
- ✓ URL is state (every selection signal `computed` from `toSignal(queryParamMap)`)
- ✓ Selection never fetches (`selectedItem`/`selectedCategory` derived `find()` over loaded data)
- ✓ railMode derived, never stored (single computed source of truth)
- ✓ List fetches through one cached choke point (CatalogueService session cache; failed flights evict; mutations bust)
- ✓ Pagination born-paginated (`{ items, total, hasMore }` envelope; `linkedSignal` resets offset on filter change)
- ✓ Server-side filtering + ownership-derived (`req.user.org_id` → `ownedByActiveOrg`; no `org_id` from client)
- ✓ Zod-validated query params with field-error mapping
- ✓ All standalone + OnPush + `inject()` + `input()`/`output()` + `host: { class: 'block' }`
- ✓ TYPE-01 role classes + token-mapped Tailwind utilities throughout

---

## Drift watch — Files that changed since last audit

(Empty currently — all audited rows match their recorded SHA. Re-run the
SHA check before any non-trivial change to verify.)

---

## Files in tree but missing from ledger

(To detect, walk `client-v2/src/app/**` and `server/src/**` for `*.ts` /
`*.js` and diff against the ledger. Add new entries with status
`○ unaudited` on discovery. Currently believed complete as of 2026-06-11.)
