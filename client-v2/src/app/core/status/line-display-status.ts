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
  | 'booked' | 'declined'
  // Conversation-TURN codes (used when the last event on a line is a message
  // with NO price action) — Liam 2026-10-30.
  | 'reply_needed' | 'replied';

export const LINE_DISPLAY_FALLBACK: Record<LineDisplayCode, string> = {
  to_agree: 'To agree',
  quoted: 'Quoted',
  new_cost: 'New cost',
  you_accepted: 'You accepted',
  they_accepted: 'They accepted',
  all_confirmed: 'All confirmed',
  booked: 'Booked',
  declined: 'Declined',
  reply_needed: 'Reply needed',
  replied: 'Replied',
};

/** The two inputs that carry the conversation TURN (who spoke last on the line),
 *  layered onto the deal-state inputs. Optional so surfaces without message data
 *  (e.g. the standalone estimate) keep producing pure deal codes. `lastMessageBy`
 *  = who sent the most recent message on the line ('buyer' = agency, 'seller' =
 *  supplier), null if none. `lastEventIsMessage` = that message is newer than the
 *  last price/accept action (i.e. a message-only turn). */
export interface LineStatusInput {
  status?: string | null;
  buyerAccepted?: boolean | null;
  sellerAccepted?: boolean | null;
  lastMessageBy?: 'buyer' | 'seller' | null;
  lastEventIsMessage?: boolean | null;
}

/** A line is TERMINAL (settled — no turn, never bold) when both sides have
 *  accepted, or it is booked or declined/cancelled. */
export function isTerminal(s: LineStatusInput): boolean {
  if (s.buyerAccepted && s.sellerAccepted) return true;
  const st = (s.status ?? '').toString();
  return st === 'booked' || st.startsWith('declined') || st === 'cancelled';
}

/** Whether the pill should render BOLD for `viewer`: the OTHER party sent the
 *  last message on a non-terminal line, so a reply/action is owed by you. Covers
 *  both their price actions and their plain messages (same last-sender read). */
export function needsYou(s: LineStatusInput, viewer: 'buyer' | 'seller'): boolean {
  if (isTerminal(s)) return false;
  return s.lastMessageBy != null && s.lastMessageBy !== viewer;
}

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
  s: LineStatusInput,
  viewer: 'buyer' | 'seller',
): LineDisplayCode {
  const st = (s.status ?? '').toString();
  // 1) Terminal deal states win — settled, no turn (Liam 2026-10-30).
  if (s.buyerAccepted && s.sellerAccepted) return 'all_confirmed';
  if (st === 'booked') return 'booked';
  if (st.startsWith('declined') || st === 'cancelled') return 'declined';
  // 2) If the LAST event on the line is a message-only (newer than the last
  //    price/accept action), the status IS the turn: you replied, or a reply is
  //    needed from you. (Bold — needsYou — is applied separately by the surface.)
  if (s.lastEventIsMessage && s.lastMessageBy != null) {
    return s.lastMessageBy === viewer ? 'replied' : 'reply_needed';
  }
  // 3) Otherwise the last event was an ACTION → its deal code.
  const code = acceptanceCode(s, viewer);
  if (code) return code;
  // Role-based (Liam 2026-10-29): the SUPPLIER pricing it → Quoted (inbox
  // adjusted_by_supplier, budget 'quoted'); the AGENCY countering → New cost.
  if (st === 'adjusted_by_supplier' || st === 'quoted') return 'quoted';
  if (st === 'adjusted_by_agent') return 'new_cost';
  return 'to_agree';
}

/** The per-supplier ROLLUP status — a coarser summary than the per-line
 *  lineDisplayCode, shown on the Running budget supplier cards and the Messages
 *  landing. Codelist: `supplier_summary_status` (ballpark/editable). Action wins,
 *  else awaiting, else all confirmed (Liam 2026-10-29). */
export type SupplierSummaryCode = 'action_required' | 'awaiting_supplier' | 'all_confirmed';
export function supplierSummaryCode(hasAction: boolean, hasAwaiting: boolean): SupplierSummaryCode {
  if (hasAction) return 'action_required';
  if (hasAwaiting) return 'awaiting_supplier';
  return 'all_confirmed';
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
