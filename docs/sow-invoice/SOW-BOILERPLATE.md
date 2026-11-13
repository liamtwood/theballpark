# SOW — Ballpark-standard boilerplate (verbatim)

The four "Ballpark Standard" blocks are **Ballpark-owned fixed legal text** (NOT
agency-editable), with **merge fields** marked `[[like-this]]`. Supplied by Liam
2026-11-13. Used by `prompts/pV2-SOW-01-prompt.md`.

Merge fields: `[[deposit_pct]]` and its complement `[[balance_pct]]` (= 100 −
deposit), `[[net_days]]` (default 30), the parties, `[[effective_date]]`, and the
Annex A reference. The deposit example shows 50% — it's a default; the supplier's
negotiated `deposit_pct` fills it.

---

## Ballpark Standard Intro

> This Statement of Work ("SOW") is entered into directly between the Agency and
> the Supplier named below in connection with the project described. It was
> generated using cost data and scope details submitted through the Ballpark
> platform (www.theballpark.ai — operated by The Ballpark Ai Ltd, "Ballpark").
>
> Ballpark is a technology platform that connects Agencies with Suppliers and
> provides ballpark cost estimates, booking tools and payment facilitation.
> Ballpark is not a party to this SOW, does not provide the Services or
> Deliverables described in it, and is not responsible for their delivery. See
> "Role of Ballpark" in Annex A for full detail.

## Ballpark Standard Payment Schedule

> - `[[deposit_pct]]`% of the Fee is invoiced and taken via Stripe upon signature
>   of this SOW by both the Agency and the Supplier.
> - The remaining `[[balance_pct]]`% of the Fee is invoiced on completion of the
>   Services (or as otherwise stated below), payable within `[[net_days]]` days.
> - Funds are collected and released by Ballpark acting solely as a payment
>   facilitator on the Supplier's behalf; Ballpark does not take title to, or earn
>   revenue from, the Fee itself beyond any separately agreed platform fee.

*(Example default = 50% / 50%. The Ballpark platform fee is a fixed 3% of
contract value, shown separately on the SOW. Money movement = WS6, Stripe
Connect; this build captures `deposit_pct` as intent only.)*

## Ballpark Standard Conclusion

> This Statement of Work is entered into on the Effective Date pursuant to the
> Supplier's standard terms of purchase set out in Annex A. Any terms and
> conditions on the Agency's form of purchase order, or otherwise communicated to
> the Supplier by the Agency, are void and have no legal effect unless otherwise
> agreed. Each party warrants that they have all right, title and interest to bind
> the applicable entity on whose behalf they are signing.

## Ballpark Standard Signature

> *(Standard signature block — the two-sided in-app sign: Supplier signs, then
> Agency signs. Tracked as `supplier_signed_at/by` + `agency_signed_at/by`.)*

---

## Annex A — Terms & Conditions

The supplier's standard T&C PDF, from the **supplier's** profile
(`orgs.terms_pdf_url`, read via `supplier_directory` — cross-org), merged after
the Conclusion. "Role of Ballpark" (referenced in the Intro) lives in Annex A.
