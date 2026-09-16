# pV2-RELEASE-SEQUENCE-01 — Preview release sequence: v0.1.0 → v0.1.1 → v0.1.2

**Type:** release / deploy runbook · preview only (internal-facing)
**Owner:** CC executes + commits + runs each promote. Chat authored this.
**Gate:** Liam has given the go. Each promote's force-push is irreversible — do
it last in that promote, after prerequisites are green. **Promote in the order
work lands on dev** — a promote force-pushes *all* of `dev`, so you can't
separate two releases that are both already on dev.

Preview is internal-facing (Beth + team). Prod (v1.0.0) is handled separately.

---

## The three releases

### v0.1.0 — Ballpark Base Release  *(baseline — documentary, no separate promote)*
- The current preview (built from `v2.464`) **is** v0.1.0 — the product
  baseline. Note: `docs/release-notes/v0.1.0.md` (prose by area + Platform &
  Admin). It's the "we started here" entry in changelog history.
- The versioning chip/About code doesn't reach preview until v0.1.1, so the
  first *live* versioned chip a client sees is **v0.1.1**. (If you'd rather the
  first live chip read v0.1.0, tell chat — but that would bundle the fixes into
  the base, which is what we're deliberately splitting.)

### v0.1.1 — Bug fixes (Beth review)  *(THE NEXT PROMOTE)*
Prereqs on dev, in order — **NOT** TIDY-01:
1. **pV2-FEEDBACK-REF-01** — `F-#####` refs (flat, type-independent; **exclude
   `type='test_case'`** by default).
2. **pV2-RELEASE-VERSIONING-01** — the versioning machinery (release/build
   fields, chip, About, changelog re-key). Set staging **release = v0.1.1**,
   `build` = the promoted dev build. v0.1.0 stays as the baseline entry in
   changelog history.
3. UX fixes already on dev (v2.465–469): F-00131/132/133/134/135, all done, all
   `target_version=v0.1.1`.

Release note — **fixes-table format** (`docs/release-notes/v0.1.1.md`):
a table auto-derived from the tracker for issues where `target_version='v0.1.1'`:

| Ref | Reported by | Issue | Fixed |
|---|---|---|---|
| F-00xxx | Beth Pizey | Collapse cart → single "Go with this Ballpark" | ✓ |
| F-00xxx | Beth Pizey | Supplier name on estimate rows (+ marketplace cards) | ✓ |
| F-00xxx | Beth Pizey | Back from Quote/SOW → Reports, button "Back" | ✓ |
| F-00xxx | Beth Pizey | Inbox tab next to Overview | ✓ |
| F-00xxx | Beth Pizey | Message suppliers → live Overview + Inbox badge | ✓ |

(F-numbers come from the FEEDBACK-REF backfill; reporter from the issue; ✓ where
status=done. The v0.1.0 base note stays in history alongside.)

Promote:
1. `environment.staging.ts`: `release:'v0.1.1'`, `build:'<v2.NNN>'`,
   `versionChip:'Preview v0.1.1'`. Run `npm run changelog`.
2. `git push --force-with-lease origin dev:preview`.
3. **Schema catch-up on `preview`** — additive only: FEEDBACK-REF `ref` column +
   `shared.feedback_ref_seq` + `uq_feedback_ref` + the `F-` backfill. **No TIDY
   drops in this delta.** (`shared` is cross-schema, so the Release/issue rows
   are already visible; only the `ref` machinery needs applying.)
4. Verify: chip "Preview v0.1.1"; What's New shows v0.1.1 fixes table + v0.1.0
   base note; About = v0.1.1 + build; smoke-test the 5 fixes.

### v0.1.2 — Project tidy  *(AFTER v0.1.1 is promoted)*
- Only now land **pV2-PROJ-TIDY-01** on dev (7-column removal). Landing it
  earlier would make it ride the v0.1.1 promote.
- Release note (`docs/release-notes/v0.1.2.md`): brief — internal schema tidy,
  no user-facing change (drop 7 dead/legacy `projects` columns).
- Promote: `environment.staging.ts` `release:'v0.1.2'` + build; force-push
  `dev:preview`.
- **Schema catch-up on `preview`** — the **destructive** delta: the 7
  `ALTER TABLE projects DROP COLUMN IF EXISTS …`. Idempotent. (This delta is
  add-nothing / drop-7 — call it out; not the usual additive-only.)
- Verify: chip "Preview v0.1.2"; `SELECT` on preview `projects` no longer
  returns the 7 columns; app still boots + round-trips a project.

---

## Post each promote
- Mark the release record + its issues appropriately (v0.1.1 issues already
  done; set the v0.1.1 Release record status when promoted).
- Update `docs/PROGRESS.md` + backlog.
- Report promoted build + assigned `F-` numbers back to chat/Liam.

## Concerns not in spec
Standard. Flag: the v0.1.2 delta is destructive (drops); confirm nothing on
preview still reads the 7 columns before dropping; confirm preview `shared`
ref backfill matches dev numbering.
