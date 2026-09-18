# pV2-TAXONOMY-01 — Category / subcategory / tag model

**Type:** data-model + client-v2 (marketplace + supplier store) + server
**Owner:** CC implements + commits. Chat authored (design worked through against
yahire.com, 2026-09-18). Underpins the marketplace browse, the supplier store,
and the catalogue-import mapping.

## Purpose
Settle how categories, subcategories and tags work — depth, item binding,
rendering, and the marketplace-vs-store display — so the import (and the browse)
have one consistent model.

## The model (agreed)

**1. Categories are a self-referential tree, up to 5 levels.**
`categories.parent_id` (already exists) nests to any depth. We use up to **5**;
`level` is a denormalised copy of the `parent_id` depth — **never trust it as the
source of truth; derive depth from the `parent_id` chain.**

**2. An item has exactly 1 category + 1 subcategory:**
- **`category_id` = the MACRO** (the root/top of the item's branch, e.g.
  Furniture & Fixtures).
- **`subcategory_id` = the LEAF** (the deepest node the item belongs to, e.g.
  Banquet Chairs).
- **Everything in between (Seating › Chairs) DERIVES** by walking the leaf's
  `parent_id` up to the macro. The item stores only the two endpoints.

**3. The one schema change — relax the cat/subcat trigger.**
Today a DB trigger enforces `subcategory.parent_id == category_id` (subcat must be
a *direct* child of cat). That rejects `cat=Furniture, subcat=Banquet Chairs`
(Banquet's parent is Chairs, not Furniture). **Relax it to: `subcategory_id` must
be a *descendant* of `category_id`** (walk the parent chain; the macro is an
ancestor of the leaf). This is what makes cat=macro / subcat=leaf legal — and it
gives **consistent macro grouping** (every item's `category_id` is its macro, so
grouping by it is uniform, no ragged mix of levels).

**4. Rendering rule — roll UP, never group by raw `category_id`.**
Every surface that renders the tree (marketplace browse, supplier store, catalogue
admin) must **build the tree by walking `parent_id`**, not by grouping items on
their immediate `category_id`. Grouping on the raw column produces a ragged mix of
levels; rolling up places every item consistently.

**5. Display depth differs by surface (recursive rollup — nothing hidden):**
- **Marketplace: display 3 levels** (macro › subcat › leaf, e.g. Furniture ›
  Seating › Chairs). Items whose leaf is deeper than the 3rd shown level **roll
  up** to it. Drilling a node shows **every item in its subtree** (recursive
  descendant rollup), so nothing is ever hidden and an item is reachable at every
  ancestor level.
- **Supplier store (My Store): display up to 5 levels** — the vendor's own,
  fuller structure (see dual grouping).

**6. Tags / facets — orthogonal to the hierarchy.**
The hierarchy carries **KINDs**; tags carry **FACETS**. The test:
> **KIND** (a different type of product — Chairs vs Sofas) → a **category level**.
> **FACET** (a property — style/material/colour: chiavari, wood, green) → a **tag**.
Tags are **category-scoped** (assigned on the category — v1 model, the "Tags" field
on the category form — so they're the controlled vocab available to that category's
items) and surface as **marketplace filters** (the v1 filter panel: Price · Tier ·
Supplier · Event-Type · Lead Time — tags slot in here). Cross-cutting facets
(Wedding, Outdoor) → one shared **occasion/use-case** dimension rather than
re-adding per category. **Chair styles (banquet/chiavari/folding) are tags, not a
4th level.**

**7. Dual grouping — `_source` (store) vs global taxonomy (marketplace).**
- The import captures the vendor's **own hierarchy verbatim** (breadcrumb /
  JSON-LD category / URL path) as **`items.attributes._source.path`, up to 5
  levels.** This drives the **supplier store** — their sections, their words,
  their depth (a specialist chair vendor's "deep" is their top level).
- The **global `category_id`/`subcategory_id`** is the **derived mapping** into
  our 3-level tree for the **marketplace**. Re-runnable from `_source` if the
  taxonomy or classifier improves — the item's first mapping needn't be perfect.
- **Browse and search are independent** (Amazon-style): an item can be searchable
  without sitting in a browse section, and vice-versa. Search is the safety net
  under both.

**8. Depth is data-driven, not hand-designed.**
Reuse an existing node when the vendor's grouping matches (name/similarity match —
the anti-proliferation firewall). Only when there's no confident match do we
**propose-add** a node (human-gated). The tree's shape thus **emerges from what
vendors actually sell.** Later refinement: **count > X on a node → surface/deepen**
(the node's getting big → split it), so depth self-regulates.

## Concrete changes (for CC)

**V1 (build with the catalogue-import arc):**
- [ ] **Relax the cat/subcat trigger** to "subcat is a descendant of cat" (from
      direct-child). This is the enabling change for cat=macro / subcat=leaf.
- [ ] **Marketplace browse — recursive descendant rollup + roll-up rendering:**
      drilling a node shows all items in its subtree (recursive CTE on
      descendants), and the rail/tree is built by walking `parent_id`, not by
      grouping raw `category_id`. **Display capped at 3 levels** (deeper items roll
      up to the 3rd).
- [ ] **Supplier store (My Store)** — render up to 5 levels the same way (roll up
      `parent_id`), scoped to the vendor; source order from `_source` where set.
- [ ] **Import** stores `items.attributes._source.path` (≤5) verbatim; maps to the
      global 3-level `category_id`(macro)/`subcategory_id`(leaf) with reuse-or-
      propose-add.

**Later / V2:**
- [ ] **Leaf-name uniqueness** — enforce a partial unique index on catalogue
      leaf names so a leaf identifies its ancestors (and propose-add can't mint a
      duplicate). (Currently only the PK is unique.)
- [ ] **Tags → filters** wired into marketplace browse (the v1 filter panel reads
      category tags); the shared occasion/use-case tag dimension.
- [ ] **count > X → autogroup / deepen** affordance (icon at the 3rd level
      revealing tag-groups; render a rare real 4th/5th level).
- [ ] **Admin category tree / catalogue "All"** — render N levels (currently
      2-level; a 3rd-level node floats to the top).

## Acceptance (V1)
- [ ] An item bound `category_id=Furniture, subcategory_id=Banquet Chairs`
      (a non-adjacent descendant) **saves** (trigger relaxed) and its path
      (Furniture › Seating › Chairs › Banquet Chairs) derives from `parent_id`.
- [ ] Marketplace: browsing Furniture › Seating › Chairs shows the Banquet item
      (rolled up to the 3rd level); drilling any node shows its whole subtree;
      the item is reachable by browse (not search-only).
- [ ] Supplier store shows the vendor's own deeper structure (up to 5) from
      `_source`; the same item reads under the vendor's "Banquet Chairs" section.
- [ ] No ragged mix: every item's `category_id` is its macro; grouping is uniform.
- [ ] Chair styles are **tags**, not category levels.

## Concerns
- Relaxing the trigger is a **behaviour change on a validation** — confirm no code
  relies on the direct-child guarantee (pre-check, `status_id`-style).
- The recursive rollup replaces the 2-level query — check performance on the item
  query (index on `parent_id` exists: `public_categories_parent_id_idx`).
- Existing items are bound at mixed levels today (some at macro, some at subcat) —
  a one-off normalisation may be wanted so `category_id` is always the macro.
