# Item Composition Model

**Status:** Decided (design-locked) · **Date:** 2026-11-23 · **Deciders:** Liam
**Supersedes/generalises:** pV2-ADDONS-01 (add-ons) · **Builds on:** existing `items.parent_item_id` + `items.type` (today: `null` base, `component`) and `attributes.price_tiers` (volume).

Worked out over a long design walk prompted by a venue supplier (Location Live) whose
catalogue is **venues with multiple spaces + availability**. The question "how do spaces
fit our item model?" forced a general answer for composition — and, on the way, surfaced
that **variants were implemented wrong** for anything richer than a trivial difference.

## The core decision

**There are two kinds of thing on an item:**

1. **Pure attribute / pricing of the one row → JSON on the item.**
   Descriptive groups (materials, measurements, style, features, specifications) and
   **volume** (`attributes.price_tiers`, `{min,max,price}[]`). These are *facets* of the
   single item — never chosen or added as a separate thing, no identity of their own.

2. **A choosable or addable thing → a row.** A variant option, a space, a cost
   component, an add-on. Each is a real `items` row with its own BPIN, able to carry its
   own build-up. Two sub-cases by relationship:
   - **Owned, typed child** (`parent_item_id` + `type`): `variant` / `space` / `component`(estimate). Reuse = **COPY**.
   - **Assigned standalone** (M2M link): `add-on`. Reuse = **LINK**.

**Variants move from JSON to child rows** (`type='variant'`). This is the reversal of the
earlier "variants stay JSON" note — see "Why variants were wrong" below.

## Owned, typed child rows — `type` drives line behaviour

All are full `items` rows (own BPIN, own attributes, can nest / carry their own build-up),
owned by one parent via `parent_item_id`. `items.type` is the only discriminator:

- **`variant`** → **discrete, single-dimension** "pick one"; the choice **folds into the parent's single line** ("Cocktail party, Gold" = one line). Constrained to **one dimension** by design (events, not apparel — no Size×Colour matrices; if a true multi-axis case ever appears it's nested children, not built now).
- **`space`** → **its own line** (bookable); **discrete** (pick one — Battersea) or **additive** (add any — conference centre + breakout rooms), a flag on the relationship.
- **`component` / estimate** → **no line**; **rolls up as cost** into the parent (the build-up).

Reuse = **COPY**: a template is a **hidden item**; reusing it copies a new owned child into the parent, cost recalled as the opening number, then editable → the estimate owns its copy → estimates stay **stable** (price-is-a-guide).

## Assigned standalone item — `add-on`
A **standalone** item (own catalogue row, publishable) **linked** to a parent via M2M — not owned. **Additive**, its own line, bookable. Reuse = **LINK**: one supplier-maintained definition propagates to every offering; when it lands in a **deal line** it **snapshots** (like all lines) → live maintenance *and* stable deals.

## Why variants were wrong (the trigger)
BP9K15616J ("Cocktail party for 30") stored Bronze/Silver/Gold as `attributes.variants` JSON — but each had `mode:absolute` (own full price), its own image, and a long inclusions description. Those aren't "orange vs blue"; they're **distinct packages**, and each wants its **own cost build-up** (different staff/drinks/kit). A JSON variant value **can't have children**, so packages could never carry a build-up or an addressable id. *Hierarchy is the tell:* a package needs hierarchy → it isn't a variant value, it's a child item. Data check: **127 variant items, all single-dimension** (zero matrices), **17 package-like**. So the only thing JSON bought (matrices) we don't use and, as an events marketplace, won't.

## Boundary — not variants: the configurator (graphics / print)
Print/signage (Solopress) is a **configurator**, not variants or components. Real shape (Liam, from Solopress): **~30 products** (Poster, Pen, Booklet …), each with a **grid of option dimensions** (Material silk/linen · Finish matte/gloss · Size A4/A3 · Quantity …) and a **price per combination from the live API** — not stored per combo.

Model it as **one item per product + its multi-dimensional option schema + external pricing**:
- The **option schema** is multi-dimensional dimensions+values — the same shape the old `attributes.variants` JSON had, now **repurposed** here (this is the one place multi-dim dimensions live on; single-dim enumerable choices are `type='variant'` child items instead).
- **Pricing is external** (Solopress "check price" API per chosen combination), not per-option amounts — the part variants never did.

Do NOT enumerate print into child rows (30 × 2×2×2×N = thousands of rows for nothing) or force it into the variant/component model. It is a separate pattern (`project_solopress_api`: mirror catalogue + live price, no orders). The single-dimension variant rule is safe precisely because the multi-level case (print) isn't a variant — it's a configurator.

## The litmus tests
1. **Pure attribute/pricing of the one item, or a choosable/addable thing?** → **JSON facet** (volume, describe-groups) vs **row** (variant/space/component/add-on).
2. **If a row — owned or assigned?** *Exists only within this parent* → **owned child** (`variant`/`space`/`component`), **copy** on reuse. *Stands alone, reused by reference* → **assigned** (`add-on`), **link**.
3. **Within owned, `type` sets the line behaviour** — fold-into-parent (`variant`) / own-line (`space`) / cost-rollup (`component`).

## Visibility & personas (why "component" is a hidden item)
- **publish/hide** (the existing approve/publish split — no new column) separates **marketplace items** from the **library**. The "library" is simply *the set of hidden items*; no new container/table. A template and a sellable item are the same structure, differing only by the flag.
- **Personas:** suppliers create items in their **store**; agents (who have **no store UI**) create components in the **estimate builder**. The hidden-item model is the only one that serves agents — cost lines (PM, delivery, management fee, fridge) are what they re-key every estimate. Store = supplier catalogue; estimate builder = agent components + templates + spaces/add-ons.

## How things get added (cart/estimate)
A child/leaf is added as a **line referencing the item, grouped by `parent_id`** — the existing line table (UNIFY-01) + `kind`. Same gesture; the UI **picker is unchanged** (reads child items instead of JSON):
- **variant** → specifies the item's single line (no separate line); single-dimension flat list; 1-value auto-picks, picker shows only when >1.
- **space (discrete)** → marketplace shows the *venue*; picker → one space line under a zero-cost venue container (1:1 auto-adds).
- **space (additive)** → venue is purchasable → base line + "add space" adds more space lines.
- **add-on** → pick a standalone item → additive line, snapshotting the linked definition.
- **reusable component** → pick a hidden template → copies an owned component in, cost recalled.

## Two reuse modes (both justified)
- **Owned → copy** (template is a hidden item copied into an owned component; estimate owns its copy → stable deals).
- **Assigned → link** (add-on referenced; one maintained definition; snapshots at the deal line).

## Consequences / what to build
- **Variant migration:** `attributes.variants` JSON → `type='variant'` child rows. **127 items → ~720 child rows** (all single-dimension, flat → mechanical; pre-launch, cheap). The picker reads children; variant-components fold into the parent line (via `type`). After migration, `attributes.variants` retires.
- **Single-dimension constraint** on variants is a product decision (events, not apparel) — enforce it so the picker is always "choose one from a flat list," never a matrix.
- **Volume stays JSON** (`attributes.price_tiers`) — it's pricing, not a choosable thing.
- Spaces + add-ons are new; most machinery exists (`parent_item_id`, `type`, line table, approve/publish). New: `space` behaviour, the add-on **assignment** (M2M) + link/snapshot, template-copy reuse.

## Recommended sequence
1. **Lock this doc** (done).
2. **Variant → component migration** (pre-launch; fixes the 17 package misfits + gives all variants BPINs/build-ups; UI unchanged).
3. **Add-ons** — low–moderate effort, broad value, ungated; lays the child-line plumbing (assignment → additive line; link + snapshot).
4. **Reuse-components / template library** — agent-facing, high value; exercises "pick a hidden item, copy as child".
5. **Spaces** — container-not-purchasable + discrete/additive picker + owned; gate on a **real venue vertical** (Location Live API), not imminent.
6. **Availability** — new engine (calendar, date pricing, booking); a **layer on the `space` node** (a real row → keys cleanly); supplier-maintained or **API-fed**. Never block spaces on it.

## Addendum 2026-11-24 — authoring surface (quick-view as editor) + lazy migration

The model above (variants → `type='variant'` child rows) was settled for the **buyer**
side (the picker). This addendum records the **supplier/author** side, walked through with
Liam on 2026-11-24.

**Decision: the quick-view window *is* the composition editor.** In edit mode the parent
(e.g. 1234 "Cocktail party for 30") shows its options as a chip row — **`Bronze · Silver ·
Gold · ＋`** — where each chip is a **child item** (`type='variant'`, hidden, own BPIN) and
**＋** creates a new one. Clicking a chip loads that child **in place** (its own gallery,
price, "what's included"); edits **save to that child row**. ＋ ("Add Platinum") creates a
new child. This is the same gesture as "add a child" — authoring options and adding a child
are one action. **Why:** the client's own sketch (image 51/52) asked for exactly this — edit
the options without hopping across several screens; WYSIWYG on the surface the buyer sees.
The gallery-per-option is what forces child items (JSON can't hold a photo set per option),
so the authoring surface and the data model agree.

**Decision: lazy migration, not bulk.** Honours "no migrate for now" (Liam, 2026-11-24).
An item still holding `attributes.variants` JSON is converted to child rows **on first edit
in this window** (open → materialise children from JSON → thereafter the window reads/writes
children). New items start as children from the start. No one-shot migration script; items
convert as they're touched. The bulk `attributes.variants` → rows migration in
"Consequences" below remains the *option* to finish the tail pre-launch, not a prerequisite.

**Scope now:** options only (the fold-into-line `variant` children). Spaces, add-ons and
reusable components stay on the sequence below; this addendum doesn't pull them forward.

## Open follow-ons
- Availability shape (calendar storage; supplier-maintained vs API-fed) — deferred with spaces.
- Variant **BPIN postfix / SKU** (ADR-0002, main repo) — once variants are rows they get their own BPIN, so the derived `<BPIN>-<postfix>` SKU may become moot or simplify; reconcile at migration time.
- Location Live: integrate via **API/partnership, not scrape** (custom Next.js SPA; no WooCommerce/Shopify profile). The forcing case for spaces + availability.
