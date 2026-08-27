# pV2-BUILDUP-04 — supplier edits line details (description + Services) in the inbox

**Shipped:** 2026-08-27, chip `[Dev v2] v2.67`
**Commit:** `<pending>`

The lightweight substitute for the shelved composition/options feature: instead
of a structured build-up, the **supplier annotates the project line in prose** —
so when they change an item (upgrade to a Gourmet menu, add a fridge) they can
**record it** on the line. Reuses the exact editable item card that fed the
Customize screen.

## What landed

### Inbox — "Edit item" on the supplier's line
- New **Edit item** button (pencil) on the supplier's selected-line header
  (supplier-only; the agent doesn't see it). Toggles an inline editor in the
  thread pane (replaces the conversation, like Customize did).
- The editor is the same **`app-item-preview` in editable mode** reused from
  Customize — **Name, Description, and Services** are editable. **Save details**
  / **Cancel**.

### Server — a details PATCH that isn't lock-gated
- New **`PATCH /api/projects-v2/:id/items/:itemId/details`** →
  `projects.updateLineDetails`. Saves `name` / `description` /
  `install_description` (Services); only provided fields change.
- **Not lock-gated** (the existing quantity/installed PATCH 409s a line that's
  out-for-quote — exactly when the supplier needs to annotate). Authority: the
  caller owns the row — their own per-supplier fan-out row (supplier) OR the
  project's canonical row (agent).
- **No schema change** — both columns already exist. `QUOTE_LINE_JOIN` already
  `COALESCE`s the line's own `description`/`install_description` over the
  catalogue's, so edits show immediately in the **inbox card and Final Quote**.

## Notes
- Supplier-only in the UI; the endpoint also permits the agent's canonical row
  (unused today) if we later want agent-side annotation.

## Iteration — v2.68 (2026-08-27)
- **Revised item card is now show/hide collapsible**, same pattern as the brief
  "original item" attachment: collapsed = paperclip + name + a muted "Revised"
  pill + chevron; expands in place to the item-preview (minimise chevron).
  Defaults collapsed; independent toggle from the original (different message id,
  same `toggleAttachment(messageId, lineId)` key).
- Name is editable because the shared card exposes it; can be locked to
  description+Services only if wanted.
