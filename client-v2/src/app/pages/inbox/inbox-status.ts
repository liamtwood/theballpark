import { InboxThreadItem } from '../../core/inbox/inbox.service';

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
    const mine = isAgency ? it.buyerAccepted : it.sellerAccepted;
    const theirs = isAgency ? it.sellerAccepted : it.buyerAccepted;
    if (mine && theirs) return { label: 'Both accepted', tone: 'green' };
    if (mine) return { label: 'You accepted', tone: 'green' };
    if (theirs) return { label: 'They accepted', tone: 'green' };
    return { label: 'Accepted', tone: 'green' };
  }
  const map = isAgency ? STATUS_VIEW_AGENCY : STATUS_VIEW;
  return map[it.status] ?? { label: it.status, tone: 'gray' };
}

/** Whole-pound GBP for the action chat lines ("Cost Accepted £10,000"). */
export function gbp(n: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
}
