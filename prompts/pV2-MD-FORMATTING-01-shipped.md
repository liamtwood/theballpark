# pV2-MD-FORMATTING-01 — Markdown headings + Shout Out, and a formatting-help button

**Shipped:** 2026-11-22 (rebuild/org-slice) — Liam QC'd the render + approved the rollout.
**Commit:** `<sha on push>` (client-only)

## What shipped
Two things, both on the shared `| md` pipe so they apply **everywhere markdown renders**
(supplier/item descriptions, project description, SOW terms, quote/SOW documents, variants):

### 1. New markdown line syntax
- `# ` / `## ` / `### ` → **Heading 1 / 2 / 3** (`bp-md-h1`..`h3`: 22 / 18 / 16px)
- `!! ` → **Shout Out** — bold, centred, one size up (`bp-md-shout`, 16px)

Added to `markdown.pipe.ts` (line-based, alongside the existing bold/italic/bullets/spacers).
Still **safe**: the source is HTML-escaped and only whitelisted classes are emitted — no raw
HTML, never `bypassSecurityTrust`. Styles live in `styles.css` under the `.bp-md` scope.

### 2. Formatting-help button (`<app-md-help>`)
A new reusable `?` button (`shared/md-help.component.ts`) that pops a small reference of the
syntax (bold, italic, bullets, the three headings, the Shout Out, + the blank-line gap tip).
Self-contained, closes on outside-click / Escape.

Placed next to the label of **every markdown input field**:
- Item **Description** + **Included services** (`item-edit`)
- Supplier **About Us** — both the admin/reused editor (`org-profile-edit`) and the owner
  profile's inline About (`profile.component`)
- Project description — "What Ballpark will read" (`event-details-edit`)
- Item **variant descriptions** (`item-variants-editor`)
- The shared **`details-editor`** widget — one wire covers item **Details**, the SOW
  **Timeline**, and **Special / Payment Terms**
- `app-edit-field` gained a `[markdown]` flag that shows the button on any shared-field
  textarea (ready for future fields)

The `projects-new` "Brief text" box was deliberately skipped — it feeds the AI parse, it
isn't rendered through `| md`.

## Verification
- Clean Angular build after each step; Liam QC'd a live supplier profile using `!!`/headings
  (S2 Events "Stage. Light. Sound…" + centred Shout Outs) — "looks great".

## Notes
- One shared pipe + one shared button, so new markdown fields get both for free (add the
  button by the label, or `[markdown]="true"` on an `app-edit-field`).
- Not yet promoted to preview — rides the next code promote.
