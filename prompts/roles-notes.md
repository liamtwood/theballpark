# Roles & permissions — running notes

A scratchpad for permission/ownership rules surfaced during the persona reviews. Feeds the eventual user-management work — this is the input spec, not the design.

## Baseline rule

**Objects are owned by whoever created them (their `org_id`).** Add / edit / delete is permitted **only** if your org created the object.

This applies to every row that has a creator: items, projects, messages, suppliers (the catalogue listing), categories created by an org, etc.

## Layered rules to settle during reviews

The baseline covers CRUD on the row itself, but some objects have **actions** on them that aren't simple writes — those need their own rules layered on top.

### Read access (the implicit other half)

- **Marketplace listings:** any agency can read any supplier's items (that's the whole point of the marketplace). So `items` are owner-only for write but world-readable for browse.
- **Project details:** an agency's own — owner reads. A supplier sees only the slice of a project they've been invited into (via `messages` + `message_items`), not the full project.
- **Threads:** both parties on a thread can read it. Agency org reads its own outbound; supplier org reads its own inbound.
- **Categories / codelists:** world-readable. Edit = system / Ballpark admin only.

### Actions vs writes

- **`message_items.status` transitions** (Accept / Decline / Adjust / Think / Pay) — *not* covered by baseline. Both parties act on the same row from opposite sides. Rule should probably be: "you can transition an item if your org is on the thread (agency_org_id or supplier_org_id) AND the action is in your action set for the current status." Driven by p0011's symmetric action table.
- **`messages.reply`** — anyone on the thread can append a reply. Owner-only doesn't apply here; thread-membership does.

### Org-internal hierarchy

Within an org (agency or supplier), users have roles. Baseline rule says "your org created it" — but within the org, do all users have the same rights, or do roles further restrict?

Open questions (capture as they come up):

- Can any agency member edit any project in their agency, or just projects they're a member of?
- Can a supplier "sales contact" role add catalogue items, or only an "admin" role?
- Who in an agency can send a brief (= mint a `messages` row)? Anyone, or admin only?
- Who can invite new members? Probably admin only.

## Roles known so far

Drawn from chrome / personas in the app today — not yet a complete list, fill in as reviews surface them.

- **Agency Admin** (Sarah Mitchell) — full CRUD over her agency's objects. Sends briefs. Invites members. Configures agency settings.
- **Agency Member** — TBD scope.
- **Agency Viewer** — TBD scope. Maybe read-only.
- **Supplier Admin** — full CRUD over their supplier org's items, shopfront, contacts. Manages who in the org can reply to which threads.
- **Supplier Sales Contact** — TBD. Probably: replies to threads, edits items they own?
- **Ballpark Admin** (Beth Pizey) — cross-org. Sees everything. Can switch persona, edit codelists / categories / system data. Not a customer; internal only.

## Things that DON'T follow the baseline

- **Public `/brief/:token` route** — token-gated, no auth. Supplier acts on the thread without being a logged-in user. The "ownership" check is the token itself.
- **Marketplace browse** — read-world.
- **Codelists, categories, themes** — system-level. Ballpark Admin only for writes.

## How to use this file

During each persona review (supplier → agent → admin), note any UI element that feels role-gated:

- "This button should be admin-only" — write the rule here.
- "This page should only be visible to people on this project" — write it here.
- "This action shouldn't be available to a viewer-tier user" — write it here.

By the time the persona reviews are done, this file should be a checklist for the user management implementation, not a design exercise.
