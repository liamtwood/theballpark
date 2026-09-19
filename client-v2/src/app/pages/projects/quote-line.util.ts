import { QuoteLine, QuoteLineStatus } from '../../core/projects/project.types';
import { CatalogueItem } from '../../shared/catalogue/catalogue.types';
import { effectiveUnitPrice, lineTotal, LinePricingInput } from '@ballpark/line-pricing';

/** Per-item send-state badge labels + soft-token pill classes (Final view). */
export const STATUS_LABELS: Record<QuoteLineStatus, string> = {
  to_send: 'To send',
  out_for_quote: 'Out for quote',
  quoted: 'Quoted',
  booked: 'Booked',
  declined: 'Declined',
};
const STATUS_PILL: Record<QuoteLineStatus, string> = {
  to_send: 'bp-pill--muted',
  out_for_quote: 'bp-pill--warn',
  quoted: 'bp-pill--warn',
  booked: 'bp-pill--success',
  declined: 'bp-pill--danger',
};

export function statusLabel(l: QuoteLine): string {
  return STATUS_LABELS[l.status] ?? '';
}
export function statusPill(l: QuoteLine): string {
  return `bp-pill ${STATUS_PILL[l.status] ?? 'bp-pill--muted'}`;
}

/** Quote rows are read-only once the item is out for quote — edits move to the
 *  inbox thread (pV2-CART-01). */
export function editable(l: QuoteLine): boolean {
  return l.status === 'to_send';
}

/** The ONE client-side "is this line declined?" rule (audit 2026-07-17 B2).
 *  A declined line never counts toward a total; the surfaces then differ on
 *  PRESENTATION by design — the Final Quote lists it struck-through at £0, the
 *  Project Quote rail drops it entirely — but they must agree on the predicate.
 *  The server mirrors this in SQL (line-total.util `notDeclinedSql`), matching on
 *  the same `declined` prefix `quoteStatus()` collapses to, so a new `declined_*`
 *  code can't be seen by one side and missed by the other. */
export function isDeclined(l: QuoteLine): boolean {
  return l.status === 'declined';
}

/** Whether the line has an install price to offer (else the checkbox is
 *  greyed + disabled). */
export function hasInstall(l: QuoteLine): boolean {
  return (l.installCost ?? 0) > 0;
}
/** Installed = has an install price AND not explicitly opted out (persisted
 *  `installed`; null/true = on, false = off). */
export function isInstalled(l: QuoteLine): boolean {
  return hasInstall(l) && l.installed !== false;
}

/** pV2-PRICING-SSOT-01 — adapt a QuoteLine to the canonical pricing module's
 *  input. The client's `basePrice` is the server-resolved
 *  COALESCE(price_current, base_price), so it can't tell a negotiated rate from
 *  the guide base on its own; `negotiated` (price_current IS NOT NULL) carries
 *  that, and we feed the resolved value in as `priceCurrent` when negotiated so
 *  the module suppresses tiers (Part A 2a). The estimate/cart is always a
 *  flat-honouring guide surface; `priceRef` (the inbox "Original") is server-only. */
function pricingInput(l: QuoteLine): LinePricingInput {
  return {
    basePrice: l.basePrice,
    priceCurrent: l.negotiated ? l.basePrice : null,
    priceTiers: l.priceTiers ?? null,
    quantity: l.quantity ?? 1,
    installed: l.installed,
    installCost: l.installCost,
    installUnit: l.installUnit,
    flatTotal: l.flatTotal ?? null,
    honourFlat: true,
  };
}

/** The per-unit price for a line at its current qty — the ONE definition
 *  (server line-pricing.js). Thin wrapper over the canonical module. */
export function unitPrice(l: QuoteLine): number {
  return effectiveUnitPrice(pricingInput(l));
}

/** The full line total — the ONE definition (server line-pricing.js). Thin
 *  wrapper over the canonical module; every client total routes through here. */
export function lineCost(l: QuoteLine): number {
  return lineTotal(pricingInput(l));
}

/** The unit code ('head', 'linear_m') as a plain label ("head", "linear m")
 *  — reads naturally after the cost ("£42 / head"). */
export function unitPlain(unit: string | null): string {
  return unit ? unit.replace(/_/g, ' ') : '';
}

/** The one revised-line-total formula: base (flat) + included components + margin
 *  ON the components only. Shared by the Customize builder (`withMargin`) and the
 *  inbox intent-apply path so they can't drift. */
export function revisedFromParts(baseCost: number, costTotal: number, marginPct: number): number {
  return Math.round(baseCost + costTotal + Math.round(costTotal * ((marginPct || 0) / 100)));
}

/** A row in the derived "Itemized" table — name + how-many, no prices. */
export interface ItemizedRow { name: string; qty: number; unit: string | null; lead?: boolean; }

/** The Itemized rows for a line: the item itself leads, then its INCLUDED
 *  components (name/qty/unit only). The single definition both the read-only
 *  preview (from `line.components`) and Customize (from the live rows) format. */
export function lineItemized(l: QuoteLine): ItemizedRow[] {
  const rows: ItemizedRow[] = [{ name: l.name ?? '', qty: l.quantity ?? 1, unit: l.unit, lead: true }];
  for (const c of l.components ?? []) {
    if (c.included) rows.push({ name: c.name, qty: c.quantity ?? 1, unit: c.unit });
  }
  return rows;
}

/** Map a quote line to the marketplace preview's CatalogueItem shape — the line
 *  already carries everything the preview card renders. Shared by the Estimate
 *  right-rail and the inbox attachment so the SAME card renders in both (no
 *  duplicated mapping). */
export function quoteLineToCatalogueItem(l: QuoteLine): CatalogueItem {
  return {
    id: l.itemId,
    name: l.name ?? '',
    description: l.description,
    installDescription: l.installDescription,
    basePrice: l.basePrice,
    unit: l.unit,
    coverUrl: l.imageUrl,
    categoryId: l.categoryId ?? '',
    subcategoryId: null,
    supplierId: l.supplierId ?? '',
    supplierName: l.supplierName ?? '',
    supplierCity: l.supplierCity,
    categoryName: l.categoryName,
    subcategoryName: null,
    ownedByActiveOrg: false,
    approvalStatus: 'approved',
    isActive: true,
  };
}

/** The line's ORIGINAL library item (the request) — name/price/description/
 *  services from the catalogue item, NOT the (possibly-revised) line. Falls back
 *  to the line itself for custom lines (no catalogue backing). */
export function quoteLineToRequestedItem(l: QuoteLine): CatalogueItem {
  const base = quoteLineToCatalogueItem(l);
  if (!l.itemId) return base; // custom line — nothing to fall back to
  return {
    ...base,
    name: l.libName ?? base.name,
    description: l.libDescription ?? base.description,
    installDescription: l.libServices ?? base.installDescription,
    basePrice: l.libBasePrice ?? base.basePrice,
    coverUrl: l.libImageUrl ?? base.coverUrl,
  };
}
