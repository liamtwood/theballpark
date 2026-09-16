# pV2-RELEASE-VERSIONING-01 — Client release versioning + release notes + About

**Shipped:** 2026-09-16, chips `v2.471` (machinery) + `v2.472` (changelog schema enrichment).
**Owner:** CC. Chat authored the spec.

## What landed
- **Two-track versioning.** `environment.{ts,staging.ts,prod.ts}` gain `release` + `build`; `versionChip` is the derived label — dev "Dev v2.472", staging "Preview v0.1.1", prod "v1.0.0". Single source = environment.
- **Chip + About** (`user-menu`): shows the release headline + a muted "built from v2.NNN" sub-line (skipped on dev, where the chip is the build).
- **Release-keyed What's New pipeline.** `gen-changelog.js` reworked: the **preview** section is built from release-keyed `docs/release-notes/v[01].*.md`; the **dev** section stays build-keyed (pending commits). Meta comment `<!-- Release: v0.1.1 · <name> · <YYYY-MM-DD HH:MM> · built from v2.NNN -->` supplies name/datetime/build.
- **Enriched changelog schema** (for the redesign): each entry carries `version`, `name`, `build`, `date`, `datetime`, `env`, `notes:[{area,items:[{type,text}]}]`, `fixes:[{ref,reporter,text,done}]`. Note items are typed (`new|improved|fixed`); patch releases carry a `fixes` block; `**bold**` is stripped (structured, not markdown).
- **Notes:** `docs/release-notes/v0.1.0.md` (base, area sections) + `v0.1.1.md` (patch, `## Fixes` with F-refs) drive it. Promote routine documented in `project_preview_deploy_playbook`.

## Files touched
| File | Notes |
|---|---|
| client-v2/src/environments/*.ts | release/build/versionChip |
| client-v2/src/app/shell/user-menu/user-menu.component.ts | About = release + build |
| scripts/gen-changelog.js | release-keyed + enriched schema (name/datetime/typed items/fixes/env) |
| client-v2/src/app/pages/whats-new/whats-new.component.ts | consumes the schema (see WHATSNEW-REDESIGN) |
| docs/release-notes/v0.1.0.md, v0.1.1.md | base + patch notes |
| client-v2/public/changelog.json, CHANGELOG.md | regenerated |

## Acceptance
- [x] Env carries release + build; chip "Preview v0.1.1" (staging) / "Dev v2.472" (dev).
- [x] About shows release headline + build sub-label from env.
- [x] What's New preview section headlines the release + "built from vX.NNN".
- [x] gen-changelog carries release/name/datetime/type/fixes; re-run clean.
- [x] Promote routine documented; v2 builds; build chip bumped.

## Concerns not in spec
- **Old build-keyed notes** (`v2.376/440/464.md`) are now orphaned (superseded by the v0.1.0 base note); left in place, harmless.

## QC notes
(Liam)

## Chat audit
(chat)
