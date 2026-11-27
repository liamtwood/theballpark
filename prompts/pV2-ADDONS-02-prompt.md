# pV2-ADDONS-02 — Related items & Collections (tag-based)

**Status:** SPEC (design locked with Liam 2026-11-26). Supersedes pV2-ADDONS-01 (association/
copy models) and retires the `type='addon'` child model built earlier this session.

## Thesis
"Add-ons" and "collections" are not a new object — they are **relationships between real
items, expressed with tags**. One item, one source of truth, one price; referenced from
many places; edit once. No copies, no `type='addon'` children, no bespoke cart composition.
Reuses the existing `tags` + `item_tags` almost entirely.

## GOVERNING RULE (Liam 2026-11-26) — tiers vs everything else
There is ONE option-picker case and ONE linking mechanism:
- **Tiers → options.** Bronze/Silver/Gold (and sizes treated as levels) are a *pick-one
  level of the same offering* → the variant/option picker, which CONFIGURES ONE line. This
  is the only place the variant machinery (`attributes.variants` / `type='variant'`) is used.
- **Everything else → tag-linked items (same path as add-ons).** Colours, seasons, styles,
  accessories, product families — ALL of it — is separate real items grouped/linked via
  Collection/Related tags, each ADDED AS ITS OWN LINE. Not variants.

Why: items carry their own BPIN, photos + details (an Autumn centrepiece vs a Summer one are
two *items*, not one relabelled), and are searchable/source-SKU-mappable. A variant value in
the matrix can't hold photos/details; a tier doesn't need to. So: **BPIN is the identity for
everything; `seq` is only sort order; the option-picker exists solely for tiers.**

## Two concepts, one mechanism
- **Collection** — a group of items (a tag). Its MEMBERS are the items in it.
- **Related** — an item points AT a collection as its related/add-on pool.

The direction (pool vs referrer) is carried by a **role** on the tag application:
- `role='member'` → the item IS in the collection.
- `role='related'` → the item REFERENCES the collection (shows its members).

### Patterns this gives (both from the same two roles)
- **Asymmetric (add-ons):** accessories → Collection `Tipi Accessories` (member); each tent →
  Related `Tipi Accessories`. Tents show the accessories; accessories don't show the tents.
  A Disco ball tagged `member` of `Tipi Accessories` appears on EVERY tent related to it —
  tag once, shows everywhere, edit once.
- **Symmetric (coordinated range):** every Palm item → BOTH `member` AND `related` of
  `Palm`. Each piece shows the rest of the range ("shop the Palm collection"). Requires
  **self-exclusion** in the picker (an item must not list itself).

## Data model
Reuse `tags` (org-scoped; `name`, `ref`, `description`, `status`, `dimension`, `category_id`)
and `item_tags` (M2M, soft-delete). ONE additive change:
- **`item_tags.role` TEXT, nullable, default `'member'`** (`'member' | 'related'`). Additive
  nullable column (quick ALTER + migrate-schemas.js, per feedback_additive_column_ok).
- `tags.dimension='collection'` marks a tag as a collection so Classify groups it under the
  Collection facet and it stays OUT of the browse/theme tag facets and search.
- Parent points at a collection purely via its `role='related'` `item_tags` row(s) — no new
  column on `items`, no `attributes.addons` list, no `item_associations` table.

## Classify UX (authoring)
Bulk-select items → **Classify** shows Category + two tag facets beside it:
- **Collection** picker → writes `item_tags(role='member')`.
- **Related** picker → writes `item_tags(role='related')`.
Examples:
- Tipi accessories: select all accessories → Collection `Tipi Accessories`. Then select the
  3 tents → Related `Tipi Accessories`.
- Palm range: select all Palm items → Collection `Palm` AND Related `Palm` in one go.

## Buyer: the Related strip (quick-view)
- For an item, read its `role='related'` tags → list each tag's `role='member'` items,
  **excluding self** and non-visible items (active+approved, honour the marketplace gate).
- Group label from the related tag's `name` (or `addons_meta.label` if we keep it).
- Each row has an **Add** button → the NORMAL add-to-project flow. The related item lands as
  its own ordinary line in the estimate. No base-required rule, no order-list composition.

## "Added up with the parent" (optional rollup — cart side, not catalogue)
- When a related item is added **from a parent's Related strip**, set the new
  `project_items.parent_id` to the parent line (reuse the existing recursive project_items
  tree — see project_recursive_lineitem_model). The estimate then nests it under the parent
  and subtotals the subtree → it behaves like an add-on summed with the parent.
- Added **independently** (browsed on its own) → flat line, no `parent_id`.
- Decision: does the strip's Add nest-under-parent by DEFAULT, or offer "Add" vs "Add with
  <parent>"? (lean: default nest when added from the strip.)

## Clean separation (don't conflate)
- **Variants** = configure THIS item (Configuration / Finish / Size) → one configured line.
  Unchanged — sell modes / Option Levels / `type='variant'` children stay.
- **Related / Collections** = discover OTHER items via tags → each its own line, optionally
  nested under the parent for rollup.

### Cart mechanics — the two adds (both snapshot into project_items)
- **Add a variant** → copies the item CONFIGURED with the chosen variant onto ONE line
  (name·variant label + resolved price + selected values). A choice within the item → one line.
- **Add a related item** → copies that OTHER item as a NEW line at its own price; if added
  from a parent's Related strip, its `project_items.parent_id` = the parent line (rollup).
- Same snapshot model, different granularity: a variant SHAPES a line; a related item ADDS one.

## Retire (code reduction)
- Remove the `type='addon'` child mechanism: the addon branch of `saveChildren`, the
  `listAddons`/`saveAddons` wrappers as the add-on path, and `addons_meta` if unused.
- Remove the add-on multipicker's base-anchor / order-list / "base required first"
  composition. The Related strip is a plain add-to-cart list.
- **Delete** the 5 existing `type='addon'` child rows (they were copies); the real source
  items get tagged into collections instead. (`type='variant'` children are untouched.)

## Open decisions
1. UI terminology: "Related items" and "Collections" (Liam 2026-11-26).
2. Strip Add → nest-under-parent by default vs explicit "Add with <parent>".
3. Self-exclusion (required for symmetric collections) — confirm it's the only picker rule.
4. Whether `role` should be a free enum (future roles: 'bundle', 'upsell') or fixed two.

## Related work
- Collections also feed the engine's "complete the look" association capture
  (project_extract_merge_design) — the name-stem → collection tag is the cheap auto-path;
  this spec is the manual/authoring path.

---

## Addendum — Related items + cart wiring (locked with Liam 2026-11-27)

### The two relationships (both on `item_tags.role`)
- **Collections — `role='member'`**: the base item *belongs to* the collection. Peers are
  siblings / **alternatives** (the 4 armchair colours — pick one). Quick-view shows this as a
  read-only "see also" row. **No `+`.**
- **Related items — `role='related'`**: the base item *points at* a collection it is **NOT** a
  member of. That collection's members are the base's **complements** (Tipi → Tipi Accessories).
  Quick-view shows this with a **`+`** on each member.

An item links to a **whole collection** under Related items (never hand-picked items), so new
members propagate automatically: add a Disco Ball to "Tipi Accessories" → it appears under every
Tipi that links to that collection.

### Authoring (item editor, Tags tab)
Two identical pickers (reuse `collections-picker.component`, parameterised by role):
1. **Collections** (top) — writes `item_tags(item_id, tag_id, role='member')`.
2. **Related items** (below) — writes `item_tags(item_id, tag_id, role='related')`.
Same create/pick/autosave UX; role is the only difference.

### Quick-view (add context only)
- **Row 1 — Related items**: members of the collections the base links via `role='related'`,
  priced, each with a `+`.
- **Row 2 — Collections**: the base's own membership peers, read-only, no `+`.

### Cart behaviour (finishes the deferred pV2-ADDONS-01 wiring — serves add-ons AND related)
- The staged line is source-agnostic: `AddedAddon { id, name, cost, qty }`. Both the add-on picker
  and the Related-items `+` push into **one** staged order in the quick-view.
- Single **Add to ballpark** emits base + extras.
- Each extra becomes its **own visible** `kind='addon'` line **nested under the base line**
  (decision B, not a folded build-up component): own qty/price, separately negotiable per supplier.
- Base price stays the base item's; add-ons are additive.

### Schema / RLS
- `item_tags` PK → `(item_id, tag_id, role)` (was `(item_id, tag_id)`), so a tag can be linked at
  different roles cleanly.
- `role='related'` write path: owner may write own-org related links only (mirror
  `tags_collection_owner` / `item_tags_write`); no cross-org writes.
- Cart add accepts a base-line reference; the adder must own the parent line (its project).
- `kind='addon'` children must SURFACE in the cart read (unlike `kind='component'` build-up
  children, which `listItems` hides via `parent_id IS NULL`) — nested under their base.

### Active projects
Out of scope for v1: active-project adds keep today's base-only settlement dialog. Related/add-on
rollup applies to the normal draft-ballpark add path for now.
