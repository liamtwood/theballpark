# Designer review — Project-Item Composition & SOW model

**Date:** 2026-11-25 · **Reviewer:** design-review agent (read-only) · **Subject:** [../PROJECT-ITEM-COMPOSITION.md](../PROJECT-ITEM-COMPOSITION.md)
**Verdict:** structure validated (recursive tree is the right engine-native call); the gap is a **presentation contract** — three load-bearing rules are invisible to the people using the quote/SOW.

## Overall read
The recursive-tree decision is right. But the model is specified from the data outward, and three of its most important rules are invisible to users: when a line folds vs splits, why child prices stop summing to the parent after negotiation, and how a configured poster's dimensions render. Biggest opportunity: a thin presentation contract — "parent = agreed, children = indicative breakdown" — so suppliers/clients don't stare at line items whose numbers don't add up.

## Findings

| # | Finding | Sev | Direction |
|---|---|---|---|
| 1 | **Children stop summing to the parent after negotiation** (roll-up is guide, `flat_total` is the deal) → itemised children don't reconcile to the line total; reads as a bug on a binding SOW. | 🔴 | Parent row "As agreed £X"; children under a muted "Itemised (indicative)" treatment + a one-line note when agreed ≠ roll-up. Decide in the model. |
| 2 | **Doc contradicts itself on free-pick child pricing** — rule 1 says free-pick child = £0; rule 2 says Orange = 2×unit. Can't both render. | 🔴 | Free-pick child shows **qty × resolved-unit** (rule 2 wins) so the breakdown reconciles; kill the "£0 breakdown" framing; reserve £0 for genuine no-delta facets. |
| 3 | **Fold-vs-own-line is an invisible, supplier-triggered mode switch** — same buyer gesture yields one folded line (free-pick) or separate child lines (priced), driven by hidden catalogue config. | 🟡 | Keep ONE product line in both cases; priced variants render as nested priced children *under* it, not promoted to siblings. Reserve top-level lines for conceptually separate purchases (add-ons, spaces). |
| 4 | **Option-Levels renders as per-dimension child rows** (Poster → A4 → Silk → Gloss = 3 rows) — a configured poster is one SKU in the buyer's head. | 🟡 | Render a combo as a **single configured-SKU line** with dimensions as inline spec chips/sub-label; per-dimension children stay in data, not as visible rows. |
| 5 | **Option-Levels pricing collides with the Solopress external-pricing boundary** — `ITEM-COMPOSITION-MODEL.md` reserves the multi-dimension configurator for external (Solopress API) pricing, not per-option amounts enumerated into rows; this doc gives option-level picks static upcharge/absolute £. Two locked docs disagree. | 🟡 | Reconcile before build: either Option-Levels is internally priced (print/Solopress stays separate), or combos price externally and the parent shows an API-resolved total with children as spec-only, £-less chips. |
| 6 | **Add-on and variant children visually flattened** — "Fridge" (extra charge) and "Amber" (colour) read differently to a human. | 🟡 | Keep uniform data; lightly type the display — spec children as muted sub-labels, add-ons/components as itemised priced rows. One mechanism, two renderings. |
| 7 | **£0 lines look free/broken on a client document** (Dinner Drinks, no-base free-picks). | 🟡 | Mirror the photo-gate with a **price-gate**: no base/tier → "Price TBC / on application" + block publish/accept; never a bare £0. |
| 8 | **Change-of-mind swap has no affordance** — buyers whose instinct is delete+re-add need to find the in-place swap. | 🟡 | Visible per-line **"Change option"** control opening the sibling picker in place; never expose destructive delete as the path to change a variant. |
| 9 | Derived combo BPIN surfacing raw on the SOW (open item 2). | 🟢 | Present as a clean human SKU or keep the derived id internal; anchor on parent BPIN + readable config sub-label. |
| 10 | Qty editing in a folded line unspecified. | 🟢 | Qty edited per child in the expanded breakdown; parent shows Σ read-only. |

## Display / presentation recommendations
- **Two-tier line row:** parent = product name + **agreed price** (authoritative) + collapse chevron; children = indented breakdown under a quiet "Itemised (indicative)" label. Build the agreed/indicative distinction into the shared line component, not per surface.
- **Collapse by default in-app** (a 10-product quote with children is 30–40 rows); expand on click.
- **SOW (print, non-collapsible):** compact nested block per parent — variant/option picks as an inline spec line ("A4 · Silk · Gloss" / "Amber ×2, Grey ×3"), add-ons/components as itemised priced sub-rows, parent carrying the agreed figure.
- **Differentiate child types by weight, not colour** (honour semantic tokens): spec children muted/smaller; priced add-ons body weight + £.
- **When agreed ≠ roll-up, show it once, calmly** ("Agreed price; breakdown for reference").
- **Reconciliation guard:** subtle flag to the *agent* (not the client) when a negotiated parent diverges hard from its roll-up.

## Open-item opinions
1. **Price carry-over on switch** — carry the agreed £ but flag it (flip line to "Variant changed — reconfirm", notify supplier thread). **Do not defer** — silent terms drift on an SOW line is a trust/legal problem.
2. **Which BPIN on SOW** — parent anchor + variant/combo as a human sub-label; don't lead a client doc with a derived hash.
3. **Volume roll-up** — parent resolves unit from Σ child qty; children priced at that unit; displayed per-child £ must be the resolved-unit share (ties to finding 2).
4. **Standalone £0 gap** — a display contract, not just authoring: price-gate, never bare £0 on a client surface.

## Priority (most impactful first)
1. Define the **"agreed vs indicative" presentation contract** and resolve the free-pick £0-vs-2×unit contradiction (findings 1 + 2).
2. Make line structure predictable + collapse Option-Levels to one configured-SKU line; reconcile the Solopress boundary (findings 3 + 4 + 5).
3. Design the change-of-mind flow end to end — visible "Change option" + the post-negotiation reconfirm nudge (findings 8 + open item 1).

## Triage (Liam + CC, 2026-11-25)

**All findings accepted.** Folded into [../PROJECT-ITEM-COMPOSITION.md](../PROJECT-ITEM-COMPOSITION.md) and [../ITEM-COMPOSITION-MODEL.md](../ITEM-COMPOSITION-MODEL.md).

| # | Disposition |
|---|---|
| 1 Agreed-vs-indicative | **Accepted** → "Presentation contract" section: parent authoritative ("As agreed £X"), children indicative, caption when agreed ≠ roll-up. |
| 2 Free-pick £0 contradiction | **Accepted (my doc bug)** → free-pick child = `qty × resolved-unit`; £0 reserved for no-delta facets; breakdown reconciles pre-negotiation. |
| 3 Fold-vs-split invisible | **Accepted** → **always one product line**, picks nested as children; no pick-one enforcement (Gold+Silver = two children — Liam: "who cares"). Gold/Bronze flat lines were the anomaly. |
| 4 Option-Levels per-dimension rows | **Accepted** → combo = **one configured-SKU line** with inline spec chips; per-dimension children stay in data, not visible rows. |
| 5 Solopress boundary conflict | **Accepted + reconciled (Liam's call)** → Option-Levels **internally priced now**, external API a future **price-source swap** via the combo id; note reconciled in ITEM-COMPOSITION-MODEL.md. Approach is *pro*-API, not counter. |
| 6 Child type flattening | **Accepted** → differentiate by **weight**: spec picks muted sub-labels, add-ons/components £ rows. |
| 7 £0 looks broken | **Accepted** → **price-gate** (never bare £0 on a client surface; block publish/accept). |
| 8 Change-of-mind affordance | **Accepted** → visible per-line **"Change option"**; delete never the path to change. |
| 9 Raw combo BPIN on SOW | **Accepted** → parent BPIN anchor + human sub-label; derived id stays internal. |
| 10 Folded-line qty | **Accepted** → qty edited per child; parent shows Σ read-only. |
| Open 1 Price carry-over | **Accepted — not deferred** → carry agreed £ + "Variant changed — reconfirm" + notify supplier. |
| Open 2 BPIN on SOW | = finding 9. |
| Open 3 Volume roll-up | **Accepted** → parent resolves unit from Σ child qty; children at resolved unit. |
| Open 4 £0 gap | = finding 7 (display contract + price-gate). |

No rejections. The structure stands as designed; the review's value was the **presentation layer** and catching the free-pick contradiction + the Solopress cross-doc conflict.
