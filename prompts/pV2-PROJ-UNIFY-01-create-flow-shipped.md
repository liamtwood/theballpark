# pV2-PROJ-UNIFY-01 — Project unify Stage 1: create-flow + one view

**Shipped:** 2026-11-06, `[Dev v2]` (rebuild/org-slice) · **Ref:** FR-00257
**Spec:** prompts/pV2-PROJ-UNIFY-01-create-flow-prompt.md (designer) · **Workstream:** WS1

## What landed
- **Create flow re-architected** (Liam's shape): brief (+ optional details form) →
  **Create** = fast parse+create, **no** awaiting recommend → land on the project
  (**draft, hero + full tab set**) → a **confirm dialog** surfaces the parsed
  details → **Save & continue** writes them and **animates** a thumbnail into the
  **Details tab** (FLIP, measured target, `prefers-reduced-motion` fallback, tab
  highlight) → the ballpark **builds below** the tabs.
- **recommend owned by the project page** — kicks off on landing (runs during the
  dialog), shows a **"Finding items…" banner** on Ballpark, and a **reload token**
  re-fetches the estimate's own lines when it finishes (the fix for "items never
  display": the hero refreshed but the estimate component's `lines` didn't).
- **Details fold deleted** from the estimate — project details live **only** on
  the Details tab.
- **Full tab set always** (draft included) — `project.status` no longer gates the
  nav/layout. Tabs renamed **Ballpark · Marketplace · Inbox · Details · Documents**.
- **Shared `project-details-fields` component** — one layout used by the
  add-project page AND the welcome dialog, so they can't drift.
- **Estimate polish:** supplier = **soft-pink banner** with an **in-context add
  icon** (existing add flow, scoped to the row's category); **category sections
  ordered by the categories table `sort_order`** (keyed by name); **"Your own
  costs" + agency row always present** at the end.

## Files
| File | Note |
|---|---|
| projects-new.component.ts | brief + optional form → fast create → `?welcome=1` |
| project-detail.component.ts | welcome dialog + FLIP + building state; full tab set; relabel |
| project-details-fields.component.ts | NEW — shared add-project form (model signals) |
| project-estimate.component.ts | fold delete; reload token; supplier banner + add; category sort; always own-costs |
| styles.css | `.bp-proj-fly` + `.bp-projnav-opt--land` animations |

## QC (Liam) — passed
Create → fast land → confirm dialog (shared form) → Save & continue → fly into
Details tab → building banner → list fills with items; category order = sort_order
(Venues first); tabs renamed; supplier banner + add icon.

## Explicitly OUT of Stage 1
Grouping toggle (Stage 2), Cart/Final split (Liam, Stage 2), the ~20
`isDraft`/`isDraftProject` layout branches (Stage 2, branch-by-branch), per-supplier
send + the message/remove supplier icons (Stage 3 / WS2), retire/delete + `retired`
seed (own stage). The create coachmark + Inbox/Documents empty-state copy are the
designer's to spec.

## Concerns not in spec
### project-id raw UUID in URL (EP-00021)
**Where:** `/projects/:id` shows the UUID. Projects have a stored `ref`, so the
id-or-ref resolve is clean (inbox precedent). Follow-up, flagged to Liam.
**Severity:** LOW

### Custom lines can't be supplier-attributed yet
**Where:** the supplier-row add uses the existing category-scoped add (not pinned
to the supplier) — the `SHOW_CARD_ADD` model limitation. Liam accepted for now.
**Severity:** LOW

### Chat audit
(chat fills this in.)
