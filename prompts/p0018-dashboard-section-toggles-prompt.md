# CC Prompt — p0018 — Dashboard SECTIONS checkbox toggles

Close the loop on p0016 + p0017. The drawer was built to host these. This prompt extends the SECTIONS group with per-section show/hide checkboxes for every body section on the dashboard, so a user can curate their visible layout from the cog.

Single-user for now (Liam only). Flat `ConfigService` flags, no per-persona storage — we'll cross that bridge when supplier/admin dashboards become real.

## What changes

### 1. New flags on ConfigService

Add five new boolean flags to the `Config` model + `ConfigService.config$` emit shape. Defaults all `true` (everything visible by default).

```typescript
showQuickActions:    boolean;  // left column — Quick Actions panel
showActiveProjects:  boolean;  // centre — Active {Events} grid
showCredits:         boolean;  // right column — big credits card (Balls)
showSavedSuppliers:  boolean;  // right column — saved suppliers grid
showRecentActivity:  boolean;  // left column — Recent Activity panel
```

Existing flags stay as they are: `showUserName`, `showLocation`, `showUpcoming`, `showStats`.

Update `ConfigService.update()` to accept these new fields. Migrate any persistence (localStorage or backend) so existing saved configs default to `true` for new fields.

### 2. Wrap each dashboard section in *ngIf

In `dashboard.component.ts`, wrap each section in `*ngIf="config.showX"` where the new flag drives visibility:

| Section | Existing flag | New flag |
|---|---|---|
| Stats bar (4 stat cards) | `showStats` | — |
| Upcoming panel (left) | `showUpcoming` | — |
| Recent Activity panel (left) | — | `showRecentActivity` |
| Quick Actions panel (left) | — | `showQuickActions` |
| Active Events panel (centre) | — | `showActiveProjects` |
| Credits card (right) | — | `showCredits` |
| Saved Suppliers panel (right) | — | `showSavedSuppliers` |

When all sections in a column are hidden, the column itself should collapse cleanly (no empty column eating horizontal space). If your current layout uses CSS Grid columns with fixed widths, wrap each column's contents in `*ngIf="hasAnyVisibleInColumn"` to collapse the column when empty. If you're using flex with `flex: 1`, hidden columns naturally take no space — no change needed.

The hero User / Location chips already gate via `showUserName` / `showLocation` in the AppShell hero — no change there, just exposed in the new drawer group.

### 3. Replace the SECTIONS pill row with a checkbox list

In `page-config-drawer.component.ts`, the current SECTIONS group uses `bp-cfg-seg--multi` pill buttons for the 4 existing toggles. Replace it with a vertical checkbox list using `p-checkbox` (per the PrimeNG standard). Split into two sub-groups so the drawer reads:

```
GENERAL
  Page label    [Projects     ]
  Credits       [Ball          ]
  Events        [Event         ]

APPEARANCE
  Theme         ◯ ◯ ◉ ◯ ◯
  Align         [Left] [Centre]
  Nav           [Tabs] [Menu]

HERO
  ☑ User name
  ☑ Location

SECTIONS
  ☑ Upcoming
  ☑ Stats
  ☑ Quick Actions
  ☑ Active {{ projectLabel }}s
  ☑ {{ creditLabel }}s card
  ☑ Saved Suppliers
  ☑ Recent Activity
```

Four top-level groups now: GENERAL / APPEARANCE / HERO / SECTIONS. Each labelled with a `bp-drawer-label` eyebrow + 16px gap below.

Checkbox rows:
- 32px row height
- `p-checkbox` on the left (themed accent fill on check)
- Label text on the right (default body font, 14px, `--color-text-primary`)
- Whole row is clickable — clicking the label toggles the checkbox (use `<p-checkbox>` with binary mode + a wrapping `<label>` or the standard PrimeNG inputId pattern)
- Save on change — no Save/Cancel buttons (matches existing drawer behaviour)

The labels interpolate the configurable label tokens (`projectLabel`, `creditLabel`) so they read with whatever the user has set those to. If `projectLabel` = "Event", the row reads "Active Events"; if it's "Project", "Active Projects".

### 4. Remove the old pill row

Delete the `componentOptions` array, the `isComponentActive()` / `toggleComponent()` handlers, and the pill-row template inside the SECTIONS group. The new checkbox list replaces them entirely. The flags they were toggling (`showUserName`, `showLocation`, `showUpcoming`, `showStats`) are now in the checkbox list above.

## What NOT to do

- Don't add per-persona storage. Flat flags, single user.
- Don't add a Save / Cancel footer to the drawer. Checkboxes save on change.
- Don't add "Reset to defaults" — not needed; user can re-tick everything if they want defaults back.
- Don't reorder existing sections in the dashboard. Just wrap them in *ngIf.
- Don't touch the GENERAL or APPEARANCE groups. Those stay exactly as p0017 shipped.

## Verify

- Open the cog drawer on dashboard. Four groups visible: GENERAL / APPEARANCE / HERO / SECTIONS.
- All 9 checkboxes default to ticked (everything visible).
- Untick "Quick Actions" → Quick Actions panel disappears from the left column. Reload → still hidden (state persists).
- Untick all three left-column items (Upcoming / Recent Activity / Quick Actions) → left column collapses cleanly, centre + right shift left to fill the space.
- Untick "Active Events" → centre column empty; left + right columns redistribute.
- Untick all right-column items (Credits + Saved Suppliers) → right column collapses.
- Untick "Stats" → stats bar at the top disappears.
- HERO toggles (User name / Location) still gate the hero chips correctly.
- Label interpolation: change `creditLabel` to "Token" in GENERAL → the SECTIONS row updates to "Tokens card" live. Change `projectLabel` to "Show" → row updates to "Active Shows".
- Re-tick everything → dashboard returns to its full default layout.
- Theme switch via APPEARANCE still works while the drawer is open.

When complete and verified, mark p0018 `Done` in `prompts/backlog.md` and write `p0018-dashboard-section-toggles-shipped.md` per the cc-onboarding ship-report convention.
