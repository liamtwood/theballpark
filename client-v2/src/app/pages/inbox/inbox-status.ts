import { InboxThreadItem } from '../../core/inbox/inbox.service';
import { acceptanceCode, LINE_DISPLAY_FALLBACK } from '../../core/status/line-display-status';

export type PillTone = 'green' | 'yellow' | 'gray' | 'red';
export interface PillView {
  label: string;
  tone: PillTone;
}

/** Terminal item statuses — no further action. Only `booked` is truly final;
 *  a declined/cancelled line keeps the action bar so either side can change
 *  their mind (re-accept, suggest a new cost) or undo a mis-click. */
export const TERMINAL_STATUSES = new Set(['booked']);

/** message_item_status → the pill (label + tone). Supplier perspective is the
 *  base; the agency view only overrides the four perspective-sensitive rows
 *  (M5 — was two near-identical maps). Pills text-transform to uppercase. */
const STATUS_VIEW: Record<string, PillView> = {
  brief_sent: { label: 'Quote requested', tone: 'gray' },
  holding: { label: 'On hold', tone: 'gray' },
  quoted: { label: 'Quoted', tone: 'gray' },
  adjusted_by_supplier: { label: 'New cost suggested', tone: 'yellow' },
  adjusted_by_agent: { label: 'Agency revised', tone: 'yellow' },
  accepted: { label: 'You accepted', tone: 'green' },
  booked: { label: 'Booked', tone: 'green' },
  declined_by_supplier: { label: 'You declined', tone: 'red' },
  declined_by_agent: { label: 'Agency cancelled', tone: 'red' },
};
const STATUS_VIEW_AGENCY: Record<string, PillView> = {
  ...STATUS_VIEW,
  adjusted_by_agent: { label: 'You revised', tone: 'yellow' },
  accepted: { label: 'Accepted', tone: 'green' },
  declined_by_supplier: { label: 'Supplier declined', tone: 'red' },
  declined_by_agent: { label: 'You cancelled', tone: 'red' },
};

/** The per-item status pill from the viewer's perspective. `accepted` resolves
 *  to YOU / THEY / BOTH from the two sides' decisions; everything else reads
 *  from the viewer's label map. */
export function statusPill(it: InboxThreadItem, isAgency: boolean): PillView {
  if (it.status === 'accepted') {
    // ONE shared accept→code deriver (viewer-relative: agency=buyer); label from
    // the line_display_status fallback so the inbox, Running budget and estimate
    // rows all read alike ("All confirmed", not "Both accepted").
    const code = acceptanceCode(it, isAgency ? 'buyer' : 'seller');
    if (code) return { label: LINE_DISPLAY_FALLBACK[code], tone: 'green' };
    return { label: 'Accepted', tone: 'green' };
  }
  const map = isAgency ? STATUS_VIEW_AGENCY : STATUS_VIEW;
  return map[it.status] ?? { label: it.status, tone: 'gray' };
}

/** Whose move is one line, from the VIEWER's perspective: 'me' (the current
 *  user must act), 'them' (the counterparty), or 'settled'. Agency = buyer,
 *  supplier = seller. Deterministic, mirrors the server rollup. */
export function itemAction(it: InboxThreadItem, isAgency: boolean): 'me' | 'them' | 'settled' {
  const s = it.status;
  const mineAccepted = isAgency ? it.buyerAccepted : it.sellerAccepted;
  const theirsAccepted = isAgency ? it.sellerAccepted : it.buyerAccepted;
  // Settled — no one owes an action: booked, both accepted, or declined by
  // either side (a cancelled/declined line is done — no glisten, no action).
  if (s === 'booked' || (it.buyerAccepted && it.sellerAccepted)) return 'settled';
  if (s === 'declined_by_agent' || s === 'declined_by_supplier') return 'settled';
  // The counterparty accepted and I haven't → my move.
  if (theirsAccepted && !mineAccepted) return 'me';
  if (isAgency) {
    if (s === 'quoted' || s === 'adjusted_by_supplier') return 'me';
    return 'them'; // brief_sent / holding / adjusted_by_agent
  }
  // Supplier viewer.
  if (s === 'brief_sent' || s === 'holding' || s === 'adjusted_by_agent') return 'me';
  return 'them';
}

/** Per-counterparty rollup for the rail header: total lines, how many are
 *  accepted (both sides / booked), and how many need the current user. */
export function supplierRollup(items: InboxThreadItem[], isAgency: boolean): { items: number; accepted: number; action: number } {
  let count = 0;
  let accepted = 0;
  let action = 0;
  for (const it of items) {
    // Cancelled/declined lines are done — don't count them at all.
    if (it.status === 'declined_by_agent' || it.status === 'declined_by_supplier') continue;
    count++;
    if (it.status === 'booked' || (it.buyerAccepted && it.sellerAccepted)) accepted++;
    if (itemAction(it, isAgency) === 'me') action++;
  }
  return { items: count, accepted, action };
}

/** Whole-pound GBP for the action chat lines ("Cost Accepted £10,000"). */
export function gbp(n: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Two ISO timestamps fall on the same calendar day (local). */
export function sameDay(a: string, b: string): boolean {
  const da = new Date(a), db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return startOfDay(da) === startOfDay(db);
}

/** WhatsApp-style day label for a timestamp (Liam 2026-10-31): Today / Yesterday /
 *  the weekday within the past week, else a dd-MMM[-yyyy] date for older ones.
 *  `withYear` on → the conversation day dividers keep the year; off (default) →
 *  the rail's compact "last response" stamp drops it. */
export function dayLabel(iso: string | null, withYear = false): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString('en-GB', { weekday: 'long' });
  const dd = String(d.getDate()).padStart(2, '0');
  const mon = d.toLocaleDateString('en-GB', { month: 'short' });
  return withYear ? `${dd}-${mon}-${d.getFullYear()}` : `${dd}-${mon}`;
}

/** "Last activity" stamp for the Messages card (Liam 2026-10-31): today → time,
 *  within the past week → weekday, older → dd-MMM. Unlike dayLabel, today shows
 *  the actual time rather than the word "Today". */
export function lastActivity(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (days <= 0) return d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });
  if (days < 7) return d.toLocaleDateString('en-GB', { weekday: 'long' });
  const dd = String(d.getDate()).padStart(2, '0');
  const mon = d.toLocaleDateString('en-GB', { month: 'short' });
  return `${dd}-${mon}`;
}
