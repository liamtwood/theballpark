// pV2-PRICING-SSOT-01 — types for the canonical pricing module (line-pricing.js).
// Consumed by client-v2 via the `@ballpark/line-pricing` path alias; the .js is
// bundled at build time. Keep in step with line-pricing.js.

export interface PriceTierInput {
  min: number | string | null;
  max: number | string | null;
  price: number | string;
}

export interface LinePricingInput {
  /** Guide base price (per unit). */
  basePrice?: number | string | null;
  /** Negotiated per-unit rate (inbox). When set, wins outright — no tier. */
  priceCurrent?: number | string | null;
  /** Briefed per-unit rate ("Original" surface, frozen). When set, wins over
   *  the guide — no tier. */
  priceRef?: number | string | null;
  /** Volume tiers (guide). Only reached when neither priceCurrent nor priceRef
   *  is set. */
  priceTiers?: PriceTierInput[] | null;
  quantity?: number | null;
  /** null/true = installed; false = install opted out. */
  installed?: boolean | null;
  installCost?: number | string | null;
  /** 'per_order' | 'per_item' | 'percentage' | null (null = per_item). */
  installUnit?: string | null;
  /** A negotiated flat line total that overrides everything when honourFlat. */
  flatTotal?: number | string | null;
  /** Whether this surface honours flat_total (Revised/current/estimate: yes;
   *  "Original"/price_ref: no). */
  honourFlat?: boolean;
}

export function effectiveUnitPrice(input: LinePricingInput): number;
export function lineTotal(input: LinePricingInput): number;
export function tierUnitPrice(
  tiers: PriceTierInput[] | null | undefined,
  quantity: number | null | undefined,
): number | null;
