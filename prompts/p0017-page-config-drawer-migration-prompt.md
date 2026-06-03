# CC Prompt — p0017 — Migrate page-config-strip → page-config-drawer

A container swap, nothing more. p0016 did the hard work — extracted the strip into a single shared standalone component. This prompt swaps the strip container for the standard `bp-drawer` so the settings UI can scroll and accommodate the new section-visibility toggles coming next.

## Why

The strip is locked to one horizontal row at the top of the page. The next round of work adds section-visibility toggles to the COMPONENTS area (Quick Actions / Active Events / Credits / Saved Suppliers / Recent Activity, on top of the existing User / Location / Upcoming / Stats). That's ~9 toggles in a row — fights for space, looks cramped, and will need migrating later anyway. Drawer scrolls, doesn't compete with content, matches every other "configure this" surface in the app.

## What changes

In `client-angular/src/app/shared/components/page-config-strip/`:

1. **Rename** the folder + file: `page-config-strip` → `page-config-drawer`. Selector: `<app-page-config-drawer>`. Update the two consumer references in `dashboard.component.ts` + `agent.component.ts`.
2. **Wrap the template body in a `<p-sidebar>`** per the WORKING_STANDARDS drawer pattern:
   ```html
   <p-sidebar [(visible)]="visible"
              position="right"
              styleClass="bp-drawer"
              [style]="{width:'480px'}"
              [showCloseIcon]="false">
     <ng-template pTemplate="header">
       <div class="bp-drawer-header-row">
         <div class="bp-drawer-header">
           <span class="bp-drawer-label">CUSTOMISE</span>
           <div class="bp-drawer-title">Page settings</div>
         </div>
         <button class="bp-icon-btn" (click)="close()"><i class="pi pi-times"></i></button>
       </div>
     </ng-template>
     <div class="bp-drawer-body">
       <!-- existing settings, sub-grouped — see §3 -->
     </div>
   </p-sidebar>
   ```
3. **Sub-group the existing settings** under three eyebrows (use the `bp-drawer-label` style so the sub-eyebrows match the header eyebrow visually):
   - **GENERAL** — page label / credits / events
   - **APPEARANCE** — theme swatches / align / nav
   - **SECTIONS** — the existing components toggle row (will become a checkbox list in a follow-up prompt; leave the existing pill UI for now, just inside this sub-group)

   Each sub-group: small caps eyebrow + 16px vertical gap below it before the controls. Standard `--theme-text` colour for the eyebrow.
4. **Wire visibility** through the `ConfigStripService` (rename to `PageConfigService` if a clean rename is cheap; if not, keep the name with a comment). Replace the `setTemplate(template)` pattern with a simpler `register(this)` / `unregister()` + a `visible$` signal the drawer subscribes to and the top-nav cog toggles. The cog button stays in the top-nav; clicking it calls `pageConfig.toggle()`. The drawer's `visible` two-way binds against the service's signal.
5. **Each consumer page** still adds `<app-page-config-drawer />` once in its template. The drawer's lifecycle (register on init, unregister on destroy) means navigating away from a page with a drawer correctly hides the cog on the next page.
6. **Delete the strip-specific CSS** (`.bp-cfg-row` flex row layout). The drawer's standard body padding + a simple vertical stack handle the layout now. Keep the form-control styling for theme swatches, segmented buttons, and inputs — they look the same inside the drawer body.

## What NOT to do

- Don't change ConfigService or the settings that the drawer writes back. Same flags, same handlers, same save-on-change behaviour.
- Don't add the new SECTIONS checkbox list yet (Quick Actions / Active Events / etc.). That's the next prompt — this one is a pure container migration so the diff stays reviewable.
- Don't add a Save/Cancel footer to the drawer. Settings still save on change. Just the X close button in the header.

## Verify

- Cog in top-nav on dashboard + agent. Click → drawer slides in from the right. Click X (or click outside) → drawer closes.
- All existing settings work identically: page label / credits / events save on blur; theme swatches change accent live; align + nav segmented buttons update the shell; components pill toggle still toggles user/location/upcoming/stats.
- Switching pages (dashboard → agent → inbox → back to home) shows the cog only on pages with a drawer mounted. No leaked cog on inbox.
- Drawer scrolls when content exceeds height (test by squashing the viewport short).
- The strip-specific top horizontal layout is GONE — no horizontal toolbar at the top of dashboard or agent any more. Page content sits directly under the page header.
- Theme switch via the drawer propagates to the rest of the app immediately (the existing ConfigService → AppShell wiring is unchanged).

When complete and verified, mark p0017 `Done` in `prompts/backlog.md`.
