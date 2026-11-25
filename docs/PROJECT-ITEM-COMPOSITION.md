# Project-Item Composition & SOW Model

**Status:** Design-locked (pending designer review) · **Date:** 2026-11-25 · **Deciders:** Liam
**Catalogue side:** [ITEM-COMPOSITION-MODEL.md](ITEM-COMPOSITION-MODEL.md) · **SOW side:** [sow-invoice/SOW-QUOTES-ARCHITECTURE.md](sow-invoice/SOW-QUOTES-ARCHITECTURE.md)
**Builds on:** the existing recursive `project_items.parent_id` tree + build-up roll-up + whole-line (`flat_total`) override + per-line conversation (UNIFY-01), and catalogue variant **child items** (`items.type='variant'`, pV2-STORE-VARIANT-CHILDREN-01).

This doc answers one question the catalogue model left open: **when a buyer adds a configured
product to a project, how is it represented on the quote lines, priced, identified, and
rendered on the SOW?** Worked out in a design walk on 2026-11-25 (armchair with volume
pricing + free-pick colours; cocktail Bronze/Silver/Gold; poster A4/Silk/Gloss).

---

## The core decision — a recursive tree, not a flat line

**Every project line is a product *parent* with priced *children*.** The parent is the spine;
the children are everything attached to it. This reuses the recursive `project_items.parent_id`
tree you already have — it is **not** new machinery.

```
▸ Lush Armchair            (parent · holds the conversation · holds the agreed £)
    ├─ Amber        option      ×1
    ├─ Bronze       option      ×1      ← change of mind: swap this child for Silver
    ├─ Fridge       add-on      ×1
    └─ Freezer      add-on      ×1
   parent £ = base + Σ children  →  negotiated  →  stored on the parent
```

The **parent project_item**:
- is **what the conversation is pinned to** (one thread per product line, covering all its children);
- carries the **final agreed price** (the whole-line `flat_total` override — the roll-up is the guide, the stored number is the deal);
- is the **SOW source**: the SOW renders the parent + its children nested beneath it.

### Why the tree beats a single merged line
A single line (`parent ref + one variant field + qty`) was the first instinct and reads cleanest
for the trivial case, but it **breaks** on the real cases:
- **2 orange + 3 grey** — a single line holds one pick; the tree holds two children (and volume
  sees the combined qty — see Pricing).
- **Option Levels** — a configured poster is *several* picks (A4 + Silk + Gloss); the tree holds
  one child per dimension; a single field can't.
- **Add-ons** — already separate attached lines; the tree makes variants/options/add-ons **one
  uniform mechanism** instead of three.

The tree is the engine-native answer and the no-fork choice.

### Line structure — always one product line
- **One product line per added product (the parent); every pick is a nested child.** Variants,
  option-level picks, and add-ons all render *under* the one product line — never promoted to
  separate top-level lines. (The Gold/Bronze flat top-level lines seen pre-design were the
  anomaly; they nest under a single "Cocktails" parent.)
- **Per-add = pick one; multi-pick is un-policed, not multi-select.** The item picker is
  single-select — choose one level, click Add → one child; the picker *does* enforce one-per-pick.
  What we **don't** police is a buyer going back and **adding the item again** with a different
  level → a second child. If Gold-and-Silver-on-one-quote is odd for that supplier, the
  **conversation resolves it** (Liam: "who cares — it'll get solved during conversation"). No global
  pick-one logic to build.
- **An Option-Levels combo is ONE configured-SKU line**, not one row per dimension. The dimensions
  render as an inline spec line / chips ("Poster — A4 · Silk · Gloss"); the per-dimension children
  stay in the data for the price breakdown but are never separate visible rows.

---

## One shape, four sources of children

Every child shares the same line shape — `parent_id` + label + qty + price contribution — and
differs only in **where the child points**:

| child is… | source | price contribution |
|---|---|---|
| **variant option** (Amber, Bronze) | ref to a catalogue **child item** (`type='variant'`) | its price / upcharge |
| **option-level pick** (A4, Silk, Gloss) | a **dimension-value** from the parent's `attributes.variants` (no catalogue item) | that value's upcharge / absolute |
| **add-on** (Fridge, Freezer) | an owned **`type='addon'` child item** (authored inline, exactly like a variant — no M2M; cart line carries `kind='addon'`) | its own price |
| **component / estimate** | ref or inline | its cost |

---

## Pricing rules

1. **The parent price is a RESOLVED value with a pluggable source** — today the **roll-up** of its
   children; tomorrow an **external API** (Solopress-style) keyed on the combo id (see BPIN). The
   model never hard-couples the per-child £ as the only truth, so "internal now, API later" is a
   **source swap, not a redesign.**
2. **Roll-up = parent base (if any) + Σ children, each priced at its RESOLVED unit.** The per-child
   rule is the existing `computeUnitPrice`: *start at the parent base, then per child — `absolute`
   sets, `upcharge` adds, free-pick inherits the resolved unit.* A **free-pick child shows
   `qty × resolved-unit`**, not £0 — so the breakdown **reconciles** to the parent pre-negotiation.
   (£0 is reserved for genuine no-delta *facets*, never for a priced product's colour split.)
3. **Volume resolves on the combined qty of a parent's variant children.** 2 Orange + 3 Grey →
   unit = `volume_tier(5)`; Orange child = 2×unit, Grey = 3×unit; parent = 5×unit. Volume sees the
   total — the discount is never fragmented across colours — and because free-pick children carry
   `qty × unit` (rule 2), the children still sum to the parent.
4. **The agreed final price is stored on the parent** as the whole-line override (`flat_total`).
   The resolved value is the opening guide; negotiation moves it; the stored number is the SOW
   figure. (Consistent with *price-is-a-guide*.) **Once agreed, children no longer sum to the
   parent** — which is why the presentation contract below labels them *indicative*.

### Presentation contract — "parent = the deal, children = the breakdown"
The single most important legibility rule (designer review, finding 1): the children are a
breakdown that **may not add up to the parent** once a price is agreed. So every surface renders:
- **Parent row** = product name + the **authoritative price** ("As agreed £X" post-negotiation),
  with a collapse control.
- **Children** = an indented, muted **"Itemised (indicative)"** breakdown; a one-line caption
  ("Agreed price; breakdown shown for reference") appears only when agreed ≠ roll-up.
- **Differentiate child types by weight, not colour** (semantic tokens): spec picks
  (variant / option-level) render as muted sub-labels; priced add-ons/components as £ rows.
- **Collapse by default in-app**; the **SOW** (non-collapsible) renders a compact nested block —
  picks as an inline spec line ("A4 · Silk · Gloss" / "Amber ×2, Grey ×3"), add-ons/components as
  itemised priced sub-rows, the parent carrying the agreed figure.
- **Price-gate:** a line with no base/tier never renders a bare **£0** on a client surface — show
  "Price TBC / on application" and block publish/accept (mirrors the photo-gate).
- **Reconciliation guard:** when a negotiated parent diverges hard from its roll-up, flag it to the
  **agent** (not the client) — catches fat-finger overrides before they reach a client.

---

## Variant BPIN identity — unique AND consistent

**Requirement: every variant resolves to a BPIN that is both _unique_ (distinct per
variant/configuration) and _consistent_ (the same variant always resolves to the same BPIN —
for everyone, forever).** Two mechanisms, both valid:

| variant | BPIN | how |
|---|---|---|
| **stored variant child** (Amber, Bronze) | **minted once + stored**, one per catalogue row | the normal catalogue BPIN — unique + stable by definition |
| **option-level combo** (A4·Silk·Gloss) | **derived, never minted** | a **pure function** of `parent BPIN + the selected value ids in canonical order` |

**The rule that makes "consistent" hold:** a configured combo must **never** go through the
random/sequential BPIN minter — that would give two people two different ids for the same thing.
It is a deterministic encoding, with two guardrails:
- **Canonical dimension order** — so `A4·Silk·Gloss` and `Gloss·A4·Silk` cannot produce two
  spellings of the same combo.
- **Canonical value ids** — reference each value by its stable id/code, never its label, so a
  rename never shifts the BPIN.

**Corollary — a combo BPIN is a SKU label, not a row key.** Two people configuring A4/Silk/Gloss
get the *same* BPIN, by design (it means "the A4 silk-gloss poster" is one SKU everywhere:
same id on both quotes, recognisable to supplier / pricing / reorder / reporting). Therefore:
- it will **legitimately repeat** across project lines — each line still has its own unique `id`;
  nothing may treat the combo BPIN as unique on `project_items`;
- we **never materialise a catalogue item per configuration** — that would collide on the
  catalogue's unique-BPIN constraint the moment a second person picks the same combo. The combo
  BPIN stays **virtual/derived**, computed on the fly.

Uniqueness comes from encoding the full ordered selection (different configs can't collide);
consistency comes from it being a pure function (no randomness, counter, or timestamp).

---

## Change of mind — in-place, never remove-and-re-add

On Amazon you'd delete the blue-shoe line and add orange, because a cart row has nothing
attached to it. **In Ballpark the conversation and the SOW lineage are pinned to the line**, so
remove-and-re-add would orphan the thread and the agreed terms. Instead:

- **Switch a variant** = swap that one **child** (Bronze → Silver) under the same parent. Anchor,
  name root, qty, thread, and SOW line all stay; only the pick + resolved price move.
- **A visible per-line "Change option" affordance** opens the sibling picker in place. Delete is
  **never** the path to changing a variant — it would orphan the thread the model exists to protect.
- **Siblings are never lost** — they live on the parent (catalogue) and are one hop away whenever
  the line is opened; you only *add* what you picked.
- **Price carry-over on switch (resolved — do not defer):** when a buyer switches *after* a price
  was negotiated, **carry the agreed £ but flag it** — flip the line to a "Variant changed —
  reconfirm" state (reuse the line-review vocab: Request-info / gray) and notify the supplier
  thread. Silent re-seed hides the new spec; silent carry hides that the spec changed. Both are
  trust/legal risks on a line that becomes an SOW.

---

## SOW rendering

The SOW reads straight off the tree: **one block per product parent**, children nested beneath
(options, option-level picks, add-ons), the parent carrying the agreed price. Open question below
on which BPIN surfaces on the line.

---

## Resolved (designer review 2026-11-25)

1. **Price carry-over on variant switch** — **carry the agreed £, flag "Variant changed —
   reconfirm", notify the supplier.** Not deferred (see change-of-mind). Silent drift on an SOW line
   is a trust/legal issue.
2. **Which BPIN on the SOW line** — **parent BPIN as the anchor + the variant/combo as a human
   sub-label.** The derived combo id stays internal (never a raw hash on a client document).
3. **Volume roll-up mechanics** — the **parent resolves the unit from Σ child qty; children priced
   at that unit** (so the displayed per-child £ is the resolved-unit share and the breakdown
   reconciles pre-negotiation).
4. **Standalone / £0 lines** — a **display contract, not just authoring**: the **price-gate** above
   means no base/tier → "Price TBC / on application" + publish/accept blocked; never a bare £0 on a
   client surface. (Authoring still needs to add the base/tier — e.g. *Dinner Drinks (200)*.)

## Option-Levels pricing — internal now, API-ready

Decided 2026-11-25: Option-Levels is **internally priced for now** (per-option `upcharge`/`absolute`
from `attributes.variants`, rolled up). This supersedes the earlier "configurator = external
(Solopress) only" note in [ITEM-COMPOSITION-MODEL.md](ITEM-COMPOSITION-MODEL.md). It is **not**
counter to a future external API — the opposite: the **derived combo BPIN** (one stable id per
distinct configuration) is exactly the key an external pricer quotes against. When API pricing
lands, the parent's **resolved price source swaps** from roll-up to API lookup (Pricing rule 1);
the tree, the children, and the ids are unchanged, and the per-dimension children become
**spec-only, £-less** chips while the API supplies the parent total.

---

## Decision log

- **2026-11-25** — Chose the **recursive tree** (parent product + priced children) over a merged
  single line. Driver: 2-orange-3-grey + Option Levels + add-ons all need multiple priced children;
  the single line couldn't hold them and fragmented volume. Reuses the existing `parent_id` tree +
  roll-up + `flat_total` + per-line conversation.
- **2026-11-25** — Variants, option-level picks, and add-ons unified as **children** of the product
  line (one shape, four sources).
- **2026-11-25** — **Variant BPIN = unique + consistent**; stored-and-minted for catalogue children,
  **derived-and-deterministic** (never minted, canonical encoding) for option-level combos; combo
  BPIN is an SKU label, never materialised as a catalogue row.
- **2026-11-25** — Variant change is **in-place child swap**, never remove-and-re-add, because the
  conversation + SOW are pinned to the line.
- **2026-11-25 (designer review)** — Added the **presentation contract** (parent = authoritative /
  "as agreed", children = indicative breakdown); fixed the free-pick pricing contradiction
  (children carry **qty × resolved-unit**, not £0, so the breakdown reconciles); **always one
  product line** with nested children (no pick-one enforcement — Gold+Silver = two children);
  **Option-Levels combo = one configured-SKU line** with spec chips, not per-dimension rows;
  **parent price is a resolved value with a pluggable source** (roll-up now, external API later via
  the combo id); **price-gate** (never a bare £0 on a client surface); **"Change option"**
  affordance + **carry-and-flag** on variant switch; **parent BPIN + human sub-label** on the SOW.
- **2026-11-25** — Option-Levels **internally priced for now**; external/Solopress is a future
  **price-source swap** keyed on the derived combo id. Supersedes the "configurator = external
  only" note in ITEM-COMPOSITION-MODEL.md.
