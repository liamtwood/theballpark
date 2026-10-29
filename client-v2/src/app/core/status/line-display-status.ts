import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { from } from 'rxjs';
import { CodelistService } from '../codelists/codelist.service';
import { CodelistValue } from '../codelists/codelist.types';

/** The per-line DISPLAY status shown as a pill on the Running budget, the inbox
 *  rail and the estimate rows. It is a viewer-relative rollup DERIVED from both
 *  sides' acceptance (NOT a stored column). The CODES are fixed — every surface
 *  branches on them through the ONE shared `acceptanceCode()` deriver, so they
 *  can never drift — while the LABELS come from the `line_display_status`
 *  codelist (editable in /settings/codelists), falling back to the constants
 *  below. Consolidation: previously `project-estimate`, `quote-line.util` and
 *  `inbox-status` each had their own accept→label branch ("Both accepted" vs
 *  "All confirmed"); this is the single source. */
export type LineDisplayCode =
  | 'to_agree' | 'quoted' | 'new_cost'
  | 'you_accepted' | 'they_accepted' | 'all_confirmed'
  | 'booked' | 'declined';

export const LINE_DISPLAY_FALLBACK: Record<LineDisplayCode, string> = {
  to_agree: 'To agree',
  quoted: 'Quoted',
  new_cost: 'New cost',
  you_accepted: 'You accepted',
  they_accepted: 'They accepted',
  all_confirmed: 'All confirmed',
  booked: 'Booked',
  declined: 'Declined',
};

/** THE single line-status vocabulary + deriver used by EVERY status pill (inbox
 *  rail + header, Running budget, estimate). ONE codelist (`line_display_status`,
 *  ballpark/editable) now covers the whole negotiation: the viewer-relative accept
 *  rollup (acceptanceCode → you/they/all) wins; else booked, declined/cancelled,
 *  a new-cost suggestion (adjusted_by_*), a quote, or the to_agree catch-all.
 *  Works for InboxThreadItem + QuoteLine (both carry status + buyerAccepted +
 *  sellerAccepted); each surface only ever produces the codes its data supports.
 *  Consolidated from the old message_item_status + line_display_status split
 *  (Liam 2026-10-29). Text + colour are edited in Settings ▸ Codelists. */
export function lineDisplayCode(
  s: { status?: string | null; buyerAccepted?: boolean | null; sellerAccepted?: boolean | null },
  viewer: 'buyer' | 'seller',
): LineDisplayCode {
  const code = acceptanceCode(s, viewer);
  if (code) return code;
  const st = (s.status ?? '').toString();
  if (st === 'booked') return 'booked';
  if (st.startsWith('declined') || st === 'cancelled') return 'declined';
  // Role-based (Liam 2026-10-29): the SUPPLIER pricing it → Quoted (inbox
  // adjusted_by_supplier, budget 'quoted'); the AGENCY countering → New cost.
  if (st === 'adjusted_by_supplier' || st === 'quoted') return 'quoted';
  if (st === 'adjusted_by_agent') return 'new_cost';
  return 'to_agree';
}

/** The acceptance code from the two sides' accept flags, viewer-relative, or
 *  null if neither side has accepted yet (the caller then falls back to its own
 *  pre-acceptance state — `to_agree` for the budget, the granular inbox vocab
 *  for the rail). `viewer` = which side is "you" (agency = buyer, supplier =
 *  seller). This is the ONLY place the Both/You/They split is computed. */
export function acceptanceCode(
  s: { buyerAccepted?: boolean | null; sellerAccepted?: boolean | null },
  viewer: 'buyer' | 'seller',
): 'all_confirmed' | 'you_accepted' | 'they_accepted' | null {
  const you = viewer === 'buyer' ? s.buyerAccepted : s.sellerAccepted;
  const they = viewer === 'buyer' ? s.sellerAccepted : s.buyerAccepted;
  if (you && they) return 'all_confirmed';
  if (you) return 'you_accepted';
  if (they) return 'they_accepted';
  return null;
}

/** Resolves a {@link LineDisplayCode} to its editable label. Reads the
 *  `line_display_status` codelist once (shared CodelistService cache) and falls
 *  back to {@link LINE_DISPLAY_FALLBACK} until it loads / if a code is missing. */
@Injectable({ providedIn: 'root' })
export class LineDisplayStatusService {
  private readonly codelists = inject(CodelistService);
  private readonly values = toSignal(from(this.codelists.list('line_display_status')), {
    initialValue: [] as CodelistValue[],
  });
  /** code → label from the codelist (empty until the first load resolves). */
  readonly labels = computed(() => {
    const m = new Map<string, string>();
    for (const v of this.values()) m.set(v.code, v.label);
    return m;
  });
  label(code: LineDisplayCode): string {
    return this.labels().get(code) ?? LINE_DISPLAY_FALLBACK[code] ?? code;
  }
}
