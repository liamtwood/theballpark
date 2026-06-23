# inbox-v2 — Plan & Conventions

Orientation doc for the inbox-v2 rebuild. Read this once before picking up p0038
or any follow-up prompt in the series. Each individual prompt assumes you've
read this.

## The approach — strangler fig

We're NOT doing a fresh repo rewrite, and we're NOT doing an in-place big-bang
refactor. We're using the **strangler fig** pattern:

- A new `client-angular/src/app/v2/` namespace holds new components built to
  stricter standards.
- Existing v1 components stay where they are.
- Each new component goes in `v2/`. Old components retire as their replacements
  ship.
- Angular major upgrade is a separate prompt of its own (TBD), NOT a precondition
  for the inbox-v2 work.

## What this means for the existing p0037 files

p0037 shipped two files outside the v2 namespace:

- `shared/components/messages-inbox-v2/messages-inbox-v2.component.ts`
- `features/messages/inbox-v2.component.ts`

These should move into the v2 namespace as part of p0038:

- `v2/inbox/messages-inbox-v2.component.ts`  (the shared component)
- `v2/inbox/inbox-v2-route.component.ts`     (the route wrapper)

Update the route's `loadComponent()` import path accordingly. Selectors stay the
same.

## Stricter standards for v2/

Any component in `app/v2/` follows these on top of `WORKING_STANDARDS.md`:

- Standalone components only.
- `ChangeDetectionStrategy.OnPush` mandatory.
- TypeScript strict mode (any new `tsconfig` overrides land here first).
- New Angular control-flow blocks (`@if`, `@for`, `@switch`) where reasonable —
  but keep `*ngIf` if a third-party directive doesn't support the new syntax.
- Signals over Subjects for new state primitives.
- No `any` — narrow types or `unknown` with a guard.
- No untyped `Output` events.
- Every input/output documented with a JSDoc one-liner.

These rules apply ONLY inside `app/v2/`. Existing v1 code is not in scope.

## The build order

Each row = one prompt. Ship and QC each before the next.

| Prompt | Scope | Status |
|---|---|---|
| p0037 | Shared shell + hero (route data) | DONE |
| p0038 | Mount marketplace 3-column shell — empty tree, empty middle, empty preview. Move p0037 files into `v2/inbox/`. Heroalign wired from route data. | Next |
| p0039 | `InboxTreeService` + render real tree (Project → Supplier → Item with status pills). Codelist seed for the four statuses (Negotiating costs / Signing SOW / Payment Processing / Live). | |
| p0040 | Wire middle col — supplier thread on supplier click, item-derived conversation on item click. Item conversation = audit trail + scoped messages, merged chronologically. | |
| p0041 | Wire right col — item preview (read-only card from marketplace) when item selected. | |
| p0042 | Chip rail above compose bar — context-aware per status. Typed intent parser (regex). Action endpoints. | |
| p0043 | Horizontal-resize splitter on the tree pane (new feature added to the marketplace 3-column shell). | |
| p0044 | Cart-drawer re-scope: confirm project-level cart, retire any per-category cart vestiges. | |

After p0044 the v1 messages-inbox can be marked for retirement (TBD prompt).

## Data model — no schema changes (so far)

The plan reuses v1's existing tables:

- `messages` — one row per inbound/outbound message; thread = (project, supplier)
- `message_items` — items quoted in a thread
- `message_item_decisions` — append-only audit per item (Accept / Decline / price change / qty change / etc.)
- `codelists` — add four rows for the new status taxonomy in p0039

No new tables. No new columns. The "item conversation" is a derived view over
`message_item_decisions` + `messages` filtered to ones that touched the item.

## The chatbot pattern (P0)

Deterministic, NOT AI. No LLM dependency. The compose surface in the middle
column is:

1. **Quick-reply chips** above the compose bar, context-aware per item status.
   E.g. Negotiating costs status shows: Accept cost · Change price · Change
   quantity · Can't do · Change description.
2. **Typed shortcuts** — regex intent parser on Send. E.g. "change the price to
   39" matches `change_price` with amount 39 → opens inline confirm.
3. **Free text** — anything that doesn't match the regex set sends as a plain
   message.

No chat-library dependency. The existing v1 `bp-quick-replies` chip rail extends
naturally; we just add a richer chip definition (label + action + optional
inline-form spec) and a per-status chip-set config.

## Reused primitives (do NOT rebuild)

| Asset | Path |
|---|---|
| `<app-catalogue-grid>` 3-column shell | `shared/components/catalogue-grid/` |
| `.bp-list-row`, `.bp-cat-body`, `.bp-cat-sidebar`, `.bp-cat-rail` | `styles.css` (global) |
| `<app-message-item-card>` | `shared/components/message-item-card/` |
| `<app-cart-drawer>` (already project-scoped) | `shared/components/cart-drawer/` |
| `bp-quick-replies` chip rail | currently inline in v1 `messages-inbox.component.ts` — extract as part of p0042 |
| Filter drawer | existing built filter |
| `MessageItemService` | `core/services/message-item.service.ts` (extend, not replace) |
| `app-shell` hero + `HeroSettingsService` | unchanged |

## Status taxonomy (locked)

```
Negotiating costs    →  --color-action  (amber)
Signing SOW          →  --color-waiting (blue / yellow)
Payment Processing   →  --color-quoted  (purple)
Live                 →  --color-booked  (green)
```

Seeded as `codelist_status` rows in p0039.

## Where new logic lives

| Concern | Module (new, in `app/v2/`) | Key functions |
|---|---|---|
| Tree shape | `InboxTreeService` | `buildTree(projectId, viewerRole)` |
| Item conversation | `InboxTreeService` | `getItemConversation(itemId)` — merges audit + scoped messages |
| Selection state | `InboxV2Component` | `selectSupplier(id)`, `selectItem(id)` |
| Chip catalogue | `ChipCatalogService` | `chipsForStatus(status, viewerRole)` |
| Typed intent parsing | `intent-parser.ts` utility | `parseTypedAction(text)` |
| Action execution | `ItemActionService` (wraps existing endpoints) | `executeAction(intent, captures, itemId)` |
| Status pill UI | `status-pill.util.ts` | `pillClass(status)`, `pillLabel(status)` |
| Tree resize state | `InboxV2Component` local | `onResize(width)` (persists to localStorage) |

## Server endpoints

| Endpoint | Existing? | Added in |
|---|---|---|
| `GET /api/inbox/tree?projectId=&viewerRole=` | new | p0039 |
| `GET /api/message-items/:id/conversation` | new | p0040 |
| `POST /api/message-items/:id/decisions` | existing | extended in p0042 |
| `GET /api/messages/:supplierThreadId/messages` | existing | reused |
| `POST /api/messages/:supplierThreadId/reply` | existing | reused |

## How to work the prompts

1. Read this doc once.
2. For each prompt: read it + `WORKING_STANDARDS.md` + `prompts/backlog.md` (confirm Ready).
3. Implement per spec. If a prompt's interpretation drifts from this orientation
   doc, raise it before guessing.
4. Ship report per cc-onboarding format. Flip backlog row to Done. Bump
   `environment.ts`.
5. After ship, Liam QCs visually before the next prompt fires.

If a later prompt suggests something this orientation doc says we're not doing
(e.g. "create new threads per item" or "add an AI dependency"), the orientation
doc wins — surface the conflict, don't implement.

## Out of scope (in this whole arc)

- Angular major version upgrade (separate prompt later)
- v1 messages-inbox refactor or removal (separate retirement prompt)
- New schema tables or columns (zero changes planned)
- AI / NLU / LLM integration (deterministic only)
- Cross-project supplier views (future feature)
- Mobile-specific layouts (responsive within the existing breakpoints only)
