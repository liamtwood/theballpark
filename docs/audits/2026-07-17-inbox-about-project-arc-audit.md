# Inbox + About Project arc — pre-preview architect audit (read-only)

**Date:** 2026-07-17
**Scope:** everything on `dev` not yet on `origin/preview` — v2.57 (pV2-INBOX-05),
v2.58 (project Budget), v2.59 (About Project: completeness / client type-ahead /
budget formatting), v2.60 (What's new + curated release notes).
Diff: `git diff origin/preview..dev`.
**Auditors:** three independent read-only passes — Angular architect, backend
architect, security review. No code changed during the audit.
**Standards:** `docs/ENGINEERING.md` (hygiene rules + anti-pattern classes),
`docs/CLAUDE.md`, `prompts/pV2-INBOX-05-shipped.md`.

**Verdict: NOT safe to promote as-is.** Three blockers, all small. Details below.

---

## Blockers (fix before promote)

### B1 — Armed decline survives Accept / Suggest / Request Info → silent, unintended decline
**Severity:** HIGH (data-destructive, silent)
**Where:** `client-v2/src/app/pages/inbox/inbox-project.component.ts`
— `decliningId` `:417`; `decline()` `:467-472`; `accept()` `:459-462`;
`startPropose()` `:473-479`; `requestInfo()` `:526-530`; `send()` `:422-446`

`decline()` arms `decliningId` and seeds the compose box; the next `send()` posts
`action:'decline'`. But `decliningId` is only cleared by `send()` success `:438`,
`selectThread()` `:324` and `selectItem()` `:330` — **not** by `accept()`,
`startPropose()` or `requestInfo()`, all reachable from the same action bar on the
same item without changing selection. There is no visual affordance that a decline
is armed: the compose box and Send button are identical to the unarmed state.

**Failure scenario (likely):** Supplier clicks **Decline** → reconsiders → clicks
**Request Information** (which *overwrites* the seeded reason text, destroying the
only clue) → types "what's the lead time?" → Send. The server records
`declined_by_supplier` plus that bubble as the decline reason. The user believes
they asked a question. `server/src/services/inbox.service.js:490-505` performs no
from→to legality check, so the flip lands unconditionally.

**Variant (worse):** Decline → **Accept Cost** → the item is accepted → user types
"happy to proceed" → Send → the item they just accepted is declined and drops out
of the Final Quote subtotal (`projects.service.js:82,506`).

**Fix (minimum):** clear `decliningId` at the top of `accept()`, `startPropose()`,
`requestInfo()`.
**Fix (structural, preferred):** one `composeIntent = signal<'chat' | {decline:id} |
{info:id}>` so the three seeders are mutually exclusive by construction — `draft` +
`decliningId` are currently two variables encoding one intent, and they drift. Make
the armed state visible (red "Send & Decline" + explicit disarm).

---

### B2 — `listItems` never got the declined exclusion → the line list and the total pick different rows
**Severity:** HIGH (wrong money on screen)
**Where:** `server/src/services/projects.service.js:467-478` (`listItems`) vs the new
filter at `:82` (`LIST_SELECT`) and `:506` (`getEstimate`)

v2.57 added the declined exclusion to `getEstimate` and `LIST_SELECT` but not to
`listItems`, which feeds `GET /:id/items` — the Final Quote line list. All three run
`DISTINCT ON (logical_line_id)` with the same tiebreak but now select from
**different row sets**, breaking the invariant the code comment at `:507-509`
explicitly claims ("IDENTICAL across getEstimate / LIST_SELECT / listItems so the
banner total and the line list can't pick different competing clones").

**Failure scenario:** one logical line fanned out to two suppliers → row `A`
(supplier X, `declined_by_supplier`, £4,000) and `B` (supplier Y, `quoted`, £5,000).
- `getEstimate`: `A` filtered in the WHERE → picks `B` → subtotal **£5,000**.
- `listItems`: no filter → neither row is accepted/booked so the boolean sort key
  ties; fan-out rows share `created_at`, so the winner is decided by UUID order.
  When `A` wins, the Final Quote renders supplier X, red Declined pill, £4,000.

Net: supplier Y's live quote is invisible; the client category total reads **£0**
(`project-estimate.component.ts:276` zeroes declined) while the banner reads
£5,000 + cascade. Three numbers, one line. This is the same bug class
pV2-UNIFY-01a's M-2 tiebreak fix addressed — reintroduced.

**Fix:** don't filter in `listItems` (declined lines must still list) — de-prioritise
them in the pick so both surfaces land on the same row:
```sql
ORDER BY sub.logical_line_id,
         (sub.sent_status IN ('accepted','booked')) DESC NULLS LAST,
         (sub.sent_status IN ('declined_by_supplier','declined_by_agent')) ASC,
         sub.created_at ASC, sub.id
```
When a non-declined sibling exists both surfaces pick it; when all siblings are
declined the line still lists and contributes £0.

---

### B3 — `changelog.json` is a build-time snapshot → the What's new page is inverted on preview
**Severity:** HIGH (the feature is wrong on the environment it ships to)
**Where:** `client-v2/public/changelog.json:2`; `scripts/gen-changelog.js:139-141,175`;
`client-v2/src/app/pages/whats-new/whats-new.component.ts:144-147`

The generator computes `pending = origin/preview..dev` and `previewVersion` **at
generate time** and writes them into a committed static asset. Promote this arc and
the preview build serves the committed file verbatim: the headline section will list
v2.57–v2.60 as "On dev — not yet on preview … ready to demo before the next
promote", and the "On preview" pill will read **v2.56** — four versions stale, and
all four actually on preview. The page whose entire stated purpose is the split is
inverted on the one environment a customer would read it. The `?v=versionChip`
cache-bust doesn't help; the file *content* is stale.

**Fix:** make `npm run changelog` a required promote step (regenerate + commit on the
`preview` branch alongside the `environment.staging.ts` chip bump). See the promote
checklist below.

---

## Should fix in the same pass (cheap, user-visible)

### S1 — Inbox tears down on every message (`isLoading()` is true while *reloading*)
**Where:** `inbox-project.component.ts:37`, reloads at `:439`/`:557`
`resource.isLoading()` is `status === 'loading' || status === 'reloading'`
(verified against `@angular/core` `core.mjs:2859`). Every Send/Accept/Suggest/Decline
destroys the whole grid — rail, bubbles, action bar, compose — and rebuilds it.
Consequences: full-pane flash; the rail's `collapsed` signal is re-created so
deliberately-collapsed cards spring open; `#composeInput` is destroyed so **focus is
lost after every send**.
**Fix:** `@if (threadsRes.isLoading() && !threadsRes.hasValue())`.

### S2 — v2.59's client name is invisible on the supplier's inbox card
**Where:** `server/src/services/inbox.service.js:354` — `cl.name AS client_name`
`LIST_SELECT` and `getDetail` both moved to `COALESCE(p.client_name, c.name)`; this
third site didn't. v2 never writes `clients`, so `p.client_id` is always NULL → the
supplier's inbox project summary shows **no client at all** while the agent's card
shows it. Affects every v2-native project.
**Fix:** `COALESCE(p.client_name, cl.name)`. Better: one exported `CLIENT_NAME_SQL`
consumed by all three (this is anti-pattern #2 — shared standard, hand-applied).

### S3 — `changelog.json` is served unauthenticated (726 internal commit subjects)
**Where:** `client-v2/public/changelog.json`; the `/whats-new` route is behind
`requiresOrgGuard` but `public/` is served flat.
All three auditors flagged this independently. `GET /<preview-host>/changelog.json`
returns 726 commit subjects + hashes to anyone, including a map of the admin surface
and its interim gates, e.g. *"interim admin-secret gate on /api/admin/* …"*,
*"/ballpark-settings home + Early Access (3 tabs) + secret gate"*.
Not a vulnerability (internal info, not user data) — a **product decision** about who
preview is shown to.
**Recommended fix:** ship only the curated `notes[]` (already customer-facing prose)
and drop `groups[]`/`hash` from the deployed artifact. The full commit list stays in
`CHANGELOG.md`, which isn't deployed. Solves the disclosure *and* makes the page
purely customer-readable.

---

## Follow-ups (promotable, but queue them)

| # | Finding | Where |
|---|---|---|
| F1 | Selection resets on every action — `linkedSignal` sources on the `threads` array identity, so `selectedId` → null and `selectedThreadId` → `ts[0]` after each reload. Only masked because `sortThreads` floats the replied thread to index 0 (accidental invariant). | `inbox-project.component.ts:299-306` |
| F2 | `QuoteLine.itemId` typed `string`, `null` at runtime for custom lines → the new attachment's "View product" link routes to `/store/items/null`. The attachment is a *new consumer* of a latent bug. | `project.types.ts:38`, `quote-line.util.ts:69`, `item-preview.component.ts:23-33` |
| F3 | "Declined" is a business rule with 5 hand-typed copies and **divergent semantics** — client tests `status === 'declined'` (from `quoteStatus`'s `startsWith('declined')`), server tests two literal `declined_by_*` codes. Add `declined_by_system` and totals silently drift. Rule 7. | `projects.service.js:82,506`, `project-estimate.component.ts:276`, `project-quote-rail.component.ts:88`, `estimate-item-row.component.ts:89` |
| F4 | Inbox totals still include declined lines (thread totals, project summary, supplier project cards) — same rule, applied inconsistently. Supplier declines £5k of £20k; their inbox card still reads £20,000. | `inbox.service.js:326-328`, `:372-373`, `:83` |
| F5 | N+1: `linesByIds` is a batched primitive called **inside** the per-thread loop, sequentially. 24 threads → ~24 extra round-trips. Rule 10. Fix is a hoist; the batching already exists. | `inbox.service.js:295-299`, `:401-405` |
| F6 | Line caps: `inbox-project.component.ts` 433 → **566** (alarm is 400); `project-detail.component.ts` 489 → **547**. B1 is a direct consequence of the crowding — three seeders writing `draft`/`decliningId` in one 566-line class. Extract `<app-inbox-item-actions>`. | — |
| F7 | Duplicate `client_name` output column in `getDetail` (`SELECT p.*, … COALESCE(…) AS client_name`) resolves correctly only via `pg`'s last-write-wins (`pg/lib/result.js:63-74`). Reorder the SELECT and it silently returns NULL. Also: opening + saving About Project on a legacy project implicitly backfills `clients.name` into `p.client_name`. | `projects.service.js:198` |
| F8 | `listClientNames` unbounded (no LIMIT — Rule 10 caps collections); `linesByIds` is an exported primitive with no org/`deleted_at` predicate (not exploitable at current call sites, which are ownership-checked, but undocumented). | `projects.service.js:141-150`, `:447-453` |
| F9 | Dead code + a stale docblock that now describes the opposite of the shipped behaviour; `singleCategory`/`headerLabel` have zero callers. `InboxThreadItem.itemId` typed nullable but never null → dead guards. | `inbox-project.component.ts:254`, `:256-259`, `:407-409`; `core/inbox/inbox.service.ts:82` |

---

## Promote checklist (preview)

1. Fix **B1**, **B2**, **B3** (+ ideally S1, S2, and a decision on S3).
2. `npm run changelog` on the `preview` branch → commit the regenerated
   `CHANGELOG.md` + `client-v2/public/changelog.json` (else B3 recurs).
3. Bump `client-v2/src/environments/environment.staging.ts` to the promoted version
   (it reads `v2.31p`; it's bumped on `preview` and never merged back — normal
   topology, but it lies if skipped and contradicts `changelog.json`).
4. **DB:** `projects.client_name` — **verified present in `public` and `preview`**
   (applied when v2.59 landed), so the promote is not gated on it. `master` does NOT
   have it; `migrate-schemas.js:496-498` carries it for whenever master is run.
   Note nothing runs the migration automatically — `LIST_SELECT:65` and
   `getDetail:198` reference `p.client_name` unconditionally, so a schema without it
   500s the whole projects list.

---

## Checked and OK (verified, not findings)

- **Security: no findings.** `GET /client-names` takes no client input at all — org
  from `req.user.org_id` only; declared before `/:id`; behind `authenticate` +
  `requireActiveMembership`. `clientName` is Zod-bounded (`max(200)`, nullable) and
  reaches SQL only via the server-side `EDITABLE` allow-list, always as `$n`.
  `linesByIds` ids are server-derived from ownership-checked threads. No
  interpolation of user input anywhere in the diff. No `bypassSecurityTrust*` /
  `innerHTML`. `gen-changelog.js` interpolates only module constants and is dev-only.
- **NULL-status (cart) lines still counted** — the explicit `pi.status IS NULL OR …`
  branch is *required* (bare `NOT IN` yields NULL for NULL status → row dropped).
  Correct at both sites. `scope=cart` unaffected.
- **Filtering declined *before* the DISTINCT ON pick is the right order** — it fixes a
  prior bug where a declined row could win the tiebreak and have its price counted.
  The defect is only that `listItems` didn't follow (B2).
- **Lucide registration** — every icon in the new templates is registered in
  `app.config.ts`, including those reached via the newly-mounted `item-preview`. No
  blank-list risk (the failure mode that bit us at v2.56).
- **Custom-line message filtering is correct** — the server coalesces on both the item
  side (`inbox.service.js:239`) and the tag side (`:217`), so custom lines filter and
  tag correctly.
- **Item-action id plumbing** — actions send `project_items.id`, tags send the
  COALESCE key; the two keys are correctly distinct. No read/write key mismatch.
- **Rail grouping edges** — a supplier spanning N categories yields one outer card
  with N bands (the previously-punted edge is genuinely fixed); null org ids fall back
  to the thread id so threads split rather than wrongly merging.
- **`resource` params idiom** clean across `threadsRes`, `est`, `clientNamesRes` — no
  signal-read inside a loader.
- **Multi-schema** — additive, nullable, `IF NOT EXISTS`, no table rewrite; safe on a
  live table. **Transactions** — no new writes needed one.
- **Design tokens** — no raw hex / rgb / Tailwind colour utilities in the diff;
  `.bp-act--red` matches the three existing soft fills.
- **`editFieldUid` module counter** — no SSR in v2; datalist ids need only
  per-document uniqueness. Fine.

---

## Note on process

Every blocker here is in code written in the same session that shipped it, and none
were caught by the shipping author. B1 and B2 are both "applied a change to N-1 of N
sites" — the exact anti-pattern class (#2, shared standard hand-applied) the
ENGINEERING checklist enumerates. The independent read is what surfaced them.
