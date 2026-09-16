# pV2-PROMOTE-v0.1.0 — Promote the Ballpark Base Release to preview

**Type:** release / deploy runbook · preview only (internal-facing)
**Owner:** CC executes + commits + runs the promote. Chat authored this.
**Gate:** Liam has given the go for this promote. The force-push to preview is
the one irreversible step — do it last, after every prerequisite is green.

Target: **preview → v0.1.0 "Ballpark Base Release"** (built from the promoted
dev build). preview is internal-facing (Beth + team); prod is handled
separately later.

---

## Prerequisites — land these on dev first, in order (each its own commit)

1. **pV2-PROJ-TIDY-01** — remove the 7 dead/redundant `projects` columns.
2. **pV2-FEEDBACK-REF-01** — `F-#####` refs (flat, type-independent). **One
   tweak from the spec:** the `F-` sequence covers real issues only —
   **exclude `type='test_case'`** (test cases keep UUIDs / their TC identity).
   [Awaiting Liam's final yes on exclude vs include — default exclude.]
3. **pV2-RELEASE-VERSIONING-01** — `release`/`build` fields, chip, About,
   changelog re-key. Set staging **release = v0.1.0**, name **"Ballpark Base
   Release"**, date **2026-09-16**, built-from = the promoted dev build.

After each: build green, chip bumped, committed + pushed to dev.

Small add while in FEEDBACK-REF / migrate-schemas (shared schema): add
`'release'` to the `feedback_type_check` constraint so the Release folder record
can carry `type='release'` (it's currently null — cosmetic, low priority).

---

## Release notes (already drafted)

- Base-release note exists: `docs/release-notes/v0.1.0.md` (prose by area +
  Platform & Admin split). Run `npm run changelog` so it lands in
  `client-v2/public/changelog.json` as the **v0.1.0** preview headline
  (supersedes the old `v2.464` entry as the client-facing headline).
- **Two note formats going forward:**
  - **Base / feature releases** (v0.1.0, v0.2.0) → prose by area (as now).
  - **Patch / QC-fix releases** (v0.1.1) → a **fixes table** auto-built from the
    tracker: for issues where `target_version = '<release>'`, list
    **F-num · reporter · title · ✓ (status=done)**. (The Release object +
    `target_version` make this derivable — see below.)

---

## The Release object (already created — data, no migration)

`shared.feedback` now has a **Release** category + a **v0.1.0 — Ballpark Base
Release** record (`c41d5930`), and the 5 shipped UX issues carry
`target_version='v0.1.0'`. Nothing to build here — just be aware the release ↔
issue link is `target_version`, and future patch notes read from it. The
`shared` schema is cross-environment, so these rows are already visible to
preview; only FEEDBACK-REF's new `ref` column + sequence + index need applying
to `shared`.

---

## Promote steps (the actual deploy — last)

1. Confirm dev is green with all three prerequisites merged.
2. `environment.staging.ts`: `release: 'v0.1.0'`, `build: '<promoted v2.NNN>'`,
   `versionChip: 'Preview v0.1.0'`.
3. **Force-push:** `git push --force-with-lease origin dev:preview` (Railway +
   Vercel are branch-watched off `preview`).
4. **Schema catch-up on the `preview` schema** — build ONE idempotent delta:
   - **Additive:** FEEDBACK-REF `ref` column + `shared.feedback_ref_seq` +
     `uq_feedback_ref`; any other new nullable columns since the last promote.
   - **Destructive:** the TIDY-01 `DROP COLUMN IF EXISTS` for the 7 `projects`
     columns.
   - **Backfills:** FEEDBACK-REF `F-#####` chronological backfill.
   Run it against the preview schema (per the deploy topology — preview & prod
   share one Supabase DB, separate schemas; this promote touches preview only).
   Use the ADDITIVE-DELTA approach, NOT the forward-build migrate-schemas.js.
5. **Verify on preview:**
   - Chip reads **"Preview v0.1.0"**; About shows v0.1.0 + build.
   - What's New shows the **Ballpark Base Release** note.
   - Smoke test: sign in, open a project, marketplace, message-suppliers flow,
     back-from-quote → Reports.
   - `SELECT` on preview `projects` no longer returns the 7 dropped columns;
     `shared.feedback` refs backfilled.

---

## Post-promote
- Mark the v0.1.0 Release record + its 5 issues **done** (issues already done;
  set the Release record's status).
- Update `docs/PROGRESS.md` + backlog: v0.1.0 promoted, pV2-PROJ-UX-01 done.
- Report the promoted build + the assigned `F-` numbers back to chat/Liam.

## Concerns not in spec
Standard section. Flag: the destructive TIDY drops in a promote delta (call out
that this delta is add + drop, not additive-only); and confirm the preview
`shared` schema ref backfill matches dev.
