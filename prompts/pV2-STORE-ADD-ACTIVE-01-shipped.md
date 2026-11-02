# pV2-STORE-ADD-ACTIVE-01 — Add item to an active project · SHIPPED

**Branch:** rebuild/org-slice · commit `e8ddd70f`
**Status:** Shipped (awaiting Liam QC on :4202) — built to Liam's mockup 2026-11-02

## What it does

Adding a marketplace item to an **already-live (active)** project opens a dialog
instead of a silent add — the new line needs a supplier behind it:

- **Settlement** (intent only, no payments yet — per payments roadmap): *Add it to the
  final balance* / *Pay 50% up front · £X* (X = half the indicative).
- **Who prices it** (single-select):
  - The item's **own supplier** → *"Start a new conversation with {name}"* (tagged
    *"(already on this project)"* when they're on it → "adds another item thread").
  - Each **other existing supplier** → *"Ask {name} to quote for it"* (joins their thread).
- Editable **brief** (pre-filled with item + project names), indicative marketplace price.
- **"Add as ballpark and message"** → creates the line as a ballpark, stamps the
  settlement intent, ensures the engagement, posts the brief tagged to the line.

## Changes

| File | What |
|---|---|
| `server/src/services/inbox.service.js` | `getActiveAddContext` (item owner + existing suppliers; cross-org names via `supplier_directory`) + `addItemToActiveProject` (addItem → `attributes.settlement` → ensureProvider → brief + relation). |
| `server/src/routes/inbox.js` | GET `/projects/:id/active-add-context?itemId=` + POST `/projects/:id/active-add` (agency-only). |
| `core/inbox/inbox.service.ts` | `activeAddContext()` / `addToActiveProject()` + `ActiveAddContext`/`ActiveAddBody`. |
| `marketplace/add-to-active-project-dialog.component.ts` | NEW dialog. |
| `marketplace/add-to-project-dialog.component.ts` | emits `addToActive` when the chosen project is `active` (else silent add as before). |
| `marketplace/marketplace-page.component.ts` | hosts the active-add dialog. |

## Settlement storage

`project_items.attributes.settlement = 'balance' | 'deposit_50'` (intent only; no
Stripe). Deferred (Liam's call): the settlement decision really belongs at **confirm/
agree time** for a supplier that already has a **paid deposit** — parked with payments.

## Scope / follow-ups

- **Trigger wired:** the marketplace **"Add to project"** flow (choose an active project).
- **Not yet wired:** adding from **inside** a project (project-marketplace tab,
  project-estimate) still does the plain add — same dialog can hook there next.
- **Single supplier** per addition (the mockup's single-select); multi-select / "all
  suppliers" discussed but parked.

## Acceptance (to QC on :4202)

1. Marketplace → Add to project → pick an **active** project → the supplier+settlement
   dialog opens (draft project → plain add, unchanged).
2. Owner shown first (correct "(already on this project)" wording); other suppliers as
   "ask to quote". Pick one.
3. Confirm → the line appears on the project as a ballpark; the chosen supplier gets the
   brief in their inbox thread; `attributes.settlement` set.
