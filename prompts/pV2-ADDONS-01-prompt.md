# pV2-ADDONS-01 — Item add-ons (associated items, independent pricing)

**Status:** ⚠️ SUPERSEDED (2026-11-25) — the **M2M-association** model below is dropped for
simplicity. Add-ons are now modelled **exactly like variants: a `type='addon'` child item**,
authored inline in the Add Ons tab, reusing the whole variants mechanism (`saveVariants` →
`saveChildren(type)`, same chip UI). Consequences consciously accepted (Liam): **no cross-item
reuse** (no single-source sharing — that's the complexity we skip) and **no standalone browse** of
an add-on. **Copy-reuse** (hidden template copied per product, per ITEM-COMPOSITION-MODEL.md's
"reuse = COPY") is the fallback **if demand appears** — not built now. Note (Liam 2026-11-25): the
per-parent copy is a **feature, not just a simplification** — each copy is independently priced, so
a supplier can charge differently for the same add-on across parents (fridge £50 on the premium
truck, £40 on the basic one). M2M single-source would have forced one price everywhere — the wrong
constraint. Project/cart side is
unchanged from the composition model: an add-on is a child line (`parent_id` + `kind='addon'`),
shown as its own line, excluded from the cost roll-up. See
[../docs/PROJECT-ITEM-COMPOSITION.md](../docs/PROJECT-ITEM-COMPOSITION.md). The M2M design below is
retained only as the record of the path not taken.

---

**Status (original):** AGREED DESIGN — not built. Spec to build from when scheduled.
**Decided:** 2026-11-21 (Liam + Claude, with designer input). Supersedes the earlier
"add-ons as inline spec lines" and "add-ons as cost-build-up children" directions.
**Related:** `[[project_item_attribute_model]]` (variants), `[[project_price_is_a_guide]]`
(volume tiers), `[[project_item_buildup_estimate_v2dev]]` (components — DISTINCT from this),
`[[project_extras_pricing_arc]]`, `[[project_add_item_active_project]]`.

## The problem (why independence is forced)
Suppliers want to offer optional extras alongside a base item — a fridge with a truck
hire, table linen with a dinner. The tempting-but-wrong model is to make the add-on a
**modifier on the base** (roll it into the base line, or a cost-build-up child that sums
into the base price). That breaks the moment the base has **volume tiers or variants**:

- The base price is a **moving target** (Dinner for 90 / 100 / 110 is three prices). An
  add-on expressed as "+X on the base" has to be re-derived every time the volume or
  variant changes.
- The add-on often has its **own basis** — linen is per-table (or its own per-guest
  tiers), not a flat bump on a per-guest dinner. It can't be expressed as a modifier at all.

So an add-on must be an **independent item** carrying its **own** full pricing (unit,
variants, volume tiers) and priced on its own line. No coupling to the base price.

## The model
1. **An add-on is a normal item.** Full item model (unit, variants, volume tiers). There
   is NO `type='addon'`, no special "add-on" column. "Add-on" is a **role conferred by an
   association**, not a property of the item. The same fridge item can be sold standalone
   AND offered as a truck add-on — supplier's choice.
2. **Status gate = approval; publish is optional and independent.**
   - `approval_status = 'approved'` is **required** — an add-on reaches a buyer via the
     association, so it's moderated to the same bar as anything browsable. This is the gate
     that stops an unapproved item leaking to buyers through the add-on path.
   - `status` (publish) is the supplier's free choice: `active` = also browsable standalone;
     `retired`/unpublished = hidden from browse but still fully usable as an add-on.
   - **Add-on surface rule:** list associated items `WHERE approval_status = 'approved'`,
     **ignoring** the publish status. Approved-but-unpublished items appear as add-ons.
     The existing approve/publish split already expresses exactly this — no new column.
3. **Association = the one new thing.** A lightweight M2M link "offer item X alongside
   item Y." Discovery-only — it **never touches price**; each item keeps its own pricing.
   One add-on → many parents; one parent → many add-ons. An item can be standalone, an
   add-on, or both.
4. **Cart/quote = separate independent lines, with provenance.** Ticking an add-on adds it
   as its **own** `project_items` line, priced on its own basis — never a roll-up or a
   cost-child of the base. BUT record where it came from on the LINE:
   **`parent_id` = the base line + `kind='addon'`.**
   - `parent_id` gives provenance → "added from the dinner" → clean remove-together when the
     base line goes (no orphans).
   - `kind='addon'` is the DISCRIMINATOR that keeps it out of the cost-build-up. `project_items.parent_id`
     today means "dormant buildup child": such rows are hidden as their own line (the line
     queries filter `parent_id IS NULL`, e.g. project-line.service.js:162, projects.service.js:719)
     and summed into the parent. So `kind='addon'` is REQUIRED — the line queries must show
     add-on children as their own lines (`parent_id IS NULL OR kind='addon'`) and the cost
     rollup must exclude them (`kind <> 'addon'`). `kind` already exists on `project_items`
     ('estimate' is a used value); no new column.
   - This is the CART half; the CATALOGUE association (what's offered) stays `item_associations`
     / `attributes.addons`. Two halves: catalogue = "offered together", cart = "added from here".

## Storage — a NEW relation, NOT `items.parent_item_id`
`parent_item_id` is the wrong tool and overloading it is *more* complex than a new link:
- It is **single-parent** — one value per item; add-ons are many-to-many (one fridge on
  many trucks).
- Setting it makes the item a **child**, which the browse filter already hides
  (`parent_item_id IS NOT NULL`) — that kills the "sell the fridge standalone too" case.
- It is already owned by the **cost-build-up components** (they sum into the parent's
  estimate); reusing it re-entangles add-ons with the estimate.

Two storage flavours, pick on appetite (both are cheap; both are owner-scoped, own items only):

**(A) MVP, zero schema** — an array on the parent's `attributes`:
`attributes.addons = ["<itemId>", …]`. Quick view fetches those items, filters to
`approval_status='approved'`, renders the ticks. A deleted/retired add-on simply doesn't
resolve and is skipped. No migration, no FK integrity, no reverse lookup.

**(B) Clean (preferred)** — a tiny M2M table:
```sql
CREATE TABLE item_associations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES orgs(id),      -- owner; both items are this org's
  parent_item_id uuid NOT NULL REFERENCES items(id),     -- the item the add-on is offered ON
  addon_item_id  uuid NOT NULL REFERENCES items(id),     -- the offered item (its own pricing)
  sort_order     int,                                    -- display order on the parent
  created_by     uuid, updated_by uuid,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), deleted_at timestamptz,
  UNIQUE (parent_item_id, addon_item_id)
);
-- RLS: owner-scoped (org_id = app.current_org_id). A supplier associates only their OWN items.
-- NO price_override column — pricing is independent by design. Add one only if bundle-specific
-- pricing ever becomes a real need (YAGNI).
```
Gets FK integrity (handle a deleted add-on), a reverse lookup ("where is this fridge
offered?"), and room for sort/metadata.

## UI
- **Authoring (parent item edit):** an "Add-ons" section → click add → pick from a search
  picker **scoped to the owner's own `approval_status='approved'` items** → associates.
  Reuse the existing store item search/picker, don't build new.
- **Buyer (Quick View):** an "Add-ons" section listing the approved associated items with a
  **tick** each; ticking adds that item to the cart as its own separate line (its own pricing
  basis), unticking removes it. No roll-up into the base line.

## Build order / interim
- **Deferred until scheduled:** the `item_associations` table + RLS, the "Add-ons" authoring
  section + picker, the buyer "add these too" strip, and the cart wiring (separate lines).
- **Holding pen now:** DCLX / Inchmere add-on rows live as `Add-on — …` spec rows in each
  parent's `attributes`, marked `_addons_pending:true`. When the feature ships, ONE migration
  converts those into real `type=NULL` approved items + `item_associations` links. Nothing
  hidden/orphaned sits in the catalogue before then.

## Build-time flags (banked; not spec changes — designer review 2026-11-21)
1. **The specs don't express generic-sharing — a naive name-dedup under-links.** Each vehicle's
   `_addons_pending` rows list only ITS OWN add-ons (the source sheet only itemised the
   Airstreamer fully). So the reusable generics — insurance, electrical cert, RAMS, project
   management, freezer, fridge — appear **only on the Airstreamer**, not on the bus/trucks/tuk-tuk
   that also need them. A "create from specs + dedup by name" migration would create those
   generics once and link them to the Airstreamer alone. The migration needs a **conscious
   generic-vs-per-vehicle mapping** (which add-on names are shared-generic → create once, link to
   all vehicles), not pure name-dedup — decide that mapping with Liam when scheduled. And **dedup
   on name + price, not name alone**: "Exterior wrap" £5,500 (Airstream) vs the bus's £16,000
   "Full graphic wrap" are genuinely different items that share a word.
2. **Audit EVERY `parent_id IS NULL` / child-sum site when wiring `kind='addon'`**, not just the
   two named (project-line.service.js:162, projects.service.js:719). Grep all line queries and
   cost rollups so an add-on child can't slip into a buildup sum or vanish from a line list
   somewhere unpatched.

## Explicitly NOT this
- NOT cost-build-up components (`type='component'`, which sum INTO a parent's estimate). An
  add-on is an optional, independently-priced, buyer-facing extra — the opposite of a cost
  component. Keep the two concepts separate.
- NOT inline modifier lines on the base (breaks under volume/variant pricing — see above).
