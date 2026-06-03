# CC Prompt — p0015 — Single shared Inbox + supplier persona surface

Two threads of work, both rooted in the same instinct: there should be **one** inbox surface, not two. The supplier sees their side; the agent sees theirs; the component is the same.

Mockup: `p0015-supplier-inbox-mockup.html` — open it to see the target chrome + the persona-switcher dropdown shape.

Same rules as ever: v1.22 tokens only, Lucide icons only, theme-vs-semantic split, no hardcoded shadows / radii / hex.

## 1. One shared Inbox component, driven by `viewer`

Today the agency inbox lives in `messages-inbox.component.ts`. The supplier doesn't have one yet (replies arrive via email + the public `/brief/:token` view).

Lift the agency inbox into a standalone component that takes a `viewer: 'agency' | 'supplier'` prop. Both surfaces — `/messages` for the agency, `/inbox` for the supplier — mount the same component, just pass a different `viewer`.

Where the views diverge inside the component:

| Slot | agency view | supplier view |
|---|---|---|
| Thread row "From" | supplier_name | agency_name |
| Thread row logo | supplier logo / initials | agency logo / initials |
| Conversation header From/To | From = agency, To = supplier | From = agency, To = supplier (unchanged — the brief always originates from the agency) |
| Conversation lane side | agent on right, supplier on left | supplier on right, agent on left |
| Action sets on items | agency-side action table | supplier-side action table |
| Compose chips | agency seed list | supplier seed list |

Everything else — chrome, filter chip rail, collapsible sections, email-style metadata header, item card shape, stream layout — is **identical**.

## 2. Strip the heavier chrome from the agency inbox

Before this work the agency inbox carried extras the supplier mockup doesn't:

- A search bar over the thread list — **drop it.**
- View-mode toggles (list / card / table) — **drop them.** Pick the list view as canonical.
- Sort dropdown — **drop it.** Default sort = most-recent activity descending.

Keep:

- The status filter chip rail (`All N · Action N · Waiting N · Quoted N · Booked`). It's small, calm, useful. Stays exactly as shown in the mockup — pill chips, active chip uses `--theme-accent` fill, others outlined.
- The thread row card shape from p0006 — logo + From + subject + project pin + status pill + time + unread dot.
- The conversation panel from p0013 — email-style metadata header + three collapsible sections (Event Details / Items / Conversation).

## 3. New supplier surface

Add `/inbox` (or whatever the route path becomes under the supplier persona shell). Mounts the shared component with `viewer='supplier'`. Threads queried as "all threads where supplier_id = the active supplier's org id."

Also wire the three other supplier tabs (Home / Front / Store) into the supplier-persona top-nav. Front = the existing public shopfront component (currently labelled "Home" on supplier pages — rename to **Front** everywhere). Store + Home stay as they are for now; they'll get their own polish passes.

## 4. Persona switcher

The SM avatar in the top-right opens the persona dropdown shown in the mockup. Three rows:

- **Sarah Mitchell** — Woodland Agency · Admin (pink avatar `SM`)
- **Beth Pizey** — Ballpark · Admin (indigo avatar `BP`)
- **Rocket Food** — Supplier · London (themed-dark avatar `RF`)

Active persona shows the tick. Clicking another row:

1. Updates the active persona in app state (a `PersonaService` or similar).
2. Swaps the top-nav set (agency: Home / Admin / Welcome → supplier: Home / Front / Store / Inbox; admin: whatever Ballpark Admin shows).
3. Updates the avatar in the top-right to reflect the new active persona's initials.
4. Routes to that persona's Home.

Gate behind a dev-only flag (or admin role) so it doesn't show up for real production users. Suppliers see only their persona; agency users see only theirs; only admins/dev see the switcher.

## What NOT to do

- Don't build a second inbox component. One component, one source of truth.
- Don't restyle the supplier shopfront (`Front` tab) in this pass — it gets its own prompt later.
- Don't change the underlying data model — the threads, messages, and items are the same; we're just rendering the same data from two viewpoints.

## Verify

- One Angular component class drives both `/messages` and `/inbox`. Diff the routes: same component, different `viewer` input.
- Agency inbox no longer has search bar, view-mode toggles, or sort dropdown.
- Filter chip rail renders identically in both surfaces.
- Persona switcher opens from the avatar; clicking Rocket Food swaps the top-nav to Home / Front / Store / Inbox, lands on `/inbox` (or wherever supplier Home routes), avatar shows `RF`.
- Clicking back to Sarah Mitchell restores agency chrome.
- Thread rows in supplier view show agency names as "From" (Woodland Agency, Elite Agency, etc.); in agency view they show supplier names.

When complete and verified, mark p0015 `Done` in `prompts/backlog.md`.
