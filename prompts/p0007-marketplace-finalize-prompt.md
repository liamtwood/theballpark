# CC Prompt — p0007 — Marketplace finalize

A small punch list closing out the marketplace before we move to the supplier consumer view (p0008). All four items are scoped — no design exploration needed, just execute. Prompt only, no mockup; uses the existing live marketplace as the verification surface.

Same rules as ever: existing v1.22 tokens only, Lucide icons only, theme-vs-semantic split, no hardcoded shadows / radii / hex.

## 1. Drop the ✉ envelope icon from item cards

Item cards in the catalogue grid currently carry three action icons in the top-right of the cover image — **+** (add to project), **♥** (wishlist), and **✉** (email).

The simplified flow we settled on means email *never* fires from an individual item — it fires from the **cart**, one email per category, to suppliers in that category. So the envelope on item cards is now wrong. Remove it entirely.

After the change, item cards have **only** `+` and `♥` actions. Any code paths that called the per-item email action can be deleted (or, if anything else depends on them, point them to the cart's send action).

Files: `client-angular/src/app/shared/components/catalogue-grid/catalogue-grid.component.ts` (item card template) — plus any handler / service method only used by that envelope.

## 2. Panel headers stay calm — no bold accent fills

There was a brief experiment with bold `--theme-accent`-filled header strips on FILTER / RESULTS / PROJECT SUMMARY. The decision is **not adopted**. Panel headers stay as the calm eyebrow style: small Lucide leading icon + small-caps `--theme-text` label on the panel's white surface, hairline divider under.

If any code from that experiment shipped, revert to the calm version. If it didn't ship, this item is a no-op verification — confirm the headers render as calm eyebrows in the live marketplace.

## 3. Per-category brief editing — verification

With the Plan tab gone (p0005), per-category brief editing only lives in the marketplace's **category-context-panel**. The data path is already wired (`catalogue-grid` emits `categoryBriefChange` → marketplace persists via `projSvc.upsertCategory({ requirement_brief })`), but verify the user-facing UI for editing is actually present and works:

- Click a category circle → the right-column context panel shows that category's brief.
- The brief text is editable inline (pencil affordance + inline textarea, or a tap-to-edit pattern — whichever is already there).
- Edits persist on blur / save; reload and confirm.

If the edit affordance is missing or broken, fix it. The data flow is solid; this is about the UI surfacing it.

## 4. Theme-preset visual sweep

Walk the marketplace through all five theme presets — **Amber, Ocean, Emerald, Pink, Slate** — in both **Light** and **Bold** modes. For each, confirm:

- **Bold-mode hero** — accent base + `--theme-contrast` orbs + grain renders cleanly; white text on the accent passes WCAG AA for the title and the 11px eyebrow.
- **Active tab** — the white tab on the bold accent reads. Inactive tab labels at ~90% white are legible.
- **Active category circle** — `--theme-accent` fill + white icon. White-on-accent contrast passes for each preset.
- **Status pills** (`Action / Waiting / Quoted / Booked`) — stay on the semantic tokens, do not shift with the theme.
- **"Recommend" button** — outlined themed pill, label readable.
- **`--theme-contrast` pairings** — eyeball each (Pink→green, Ocean→amber, Emerald→pink, Amber→teal, Slate→coral). Slate is the one most likely to need a tweak; flag if it does.

Mark any contrast / colour issues you spot. Fix the obvious ones (e.g., a token value that fails AA); flag the subjective ones (e.g., a contrast pairing that feels off but is technically fine) for separate review.

## Verify

- Item cards show only `+` and `♥` in the top-right action cluster.
- Panel headers across the marketplace are the calm eyebrow style — no bold-fill bars.
- Per-category brief edits in the context panel persist across reload.
- All five theme presets render cleanly in Bold mode without contrast failures.
- No regression in the existing inbox / messages tab (we touched its sibling components in p0006; this prompt shouldn't affect it).

When complete and verified, mark p0007 `Done` in `prompts/README.md`.
