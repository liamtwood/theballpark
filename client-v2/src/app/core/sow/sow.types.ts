// pV2-SOW-01 (Phase 2) — client types for the SOW document (server /api/sow).
// The SOW body is a set of sections rendered as cards with pill headers:
//  • Timeline  — a table of dated entries (Date / To / From / Details)
//  • Services & Goods — a list of sub-sections (Scope, Design, Included Services…)
//  • Fees & Payment — a table of payment rows (Date / Grace / Amount / Refundable / Details)
// Boilerplate (intro/parties/schedule/signature) is fixed and hidden.

export type SowRefundable = 'yes' | 'no' | 'partial' | 'na';

export interface SowTimelineEntry {
  date: string | null;
  to: string | null;
  from: string | null;
  details: string | null;
}

export interface SowPaymentRow {
  date: string | null;
  grace: string | null;
  amount: string | null; // e.g. "50%"
  refundable: SowRefundable | null;
  details: string | null;
}

/** Which bound table (if any) a subsection renders below its text. */
export type SowTableKind = 'parties' | 'projectDetails' | 'timeline' | 'production' | 'payment';

/** A subsection block (e.g. 2.1 SOW Parties, 4.1 Scope): editable title + text,
 *  an optional bound table, and an N/A toggle. */
export interface SowSubsection {
  title: string;
  text?: string | null;
  na?: boolean;
  table?: SowTableKind | null;
  /** Appendix attachment (special case). Upload UI is the deferred Documents
   *  work; the slot is here so a subsection can hold a file later. */
  file?: { url: string; name: string } | null;
}

/** A lead (numbered) section: editable title + its own text + a list of
 *  subsections. `signature` flags the special sign block (no text/subs). */
export interface SowSection {
  title: string;
  text?: string | null;
  na?: boolean;
  signature?: boolean;
  subs: SowSubsection[];
}

/** A row in the Production, Pricing & Price-Matched Items table (Section 4).
 *  DERIVED on the draft from the thread's approved (both-accepted) line items —
 *  not a manually-built list. item/spec/qty/total are the agreed facts (read-
 *  only); source/priceNotes are the author's overlay (see SowItemOverride). */
export interface SowProductionItem {
  itemId: string; // the line's catalogue item_id (or line id) — overlay key
  item: string;
  spec: string | null;
  qty: number | null;
  variant: string | null; // the agreed line's chosen variant label (read-only)
  priceNotes: string | null;
  total: number | null;
}

/** Author-set overlay on one derived item row, stored on the SOW and merged
 *  over the live thread facts (spec / price note; keyed by itemId —
 *  Item/Qty/Variant/Total stay the agreed deal facts, read-only). */
export interface SowItemOverride {
  itemId: string;
  spec?: string | null;
  priceNotes: string | null;
}

export interface SowContent {
  /** The document structure — lead sections, each with text + subsections.
   *  Absent on older/never-edited SOWs → the panel falls back to the seeded
   *  default structure; materialized here the first time the author edits it. */
  sections?: SowSection[];
  // Table DATA — rendered wherever a subsection binds the matching table kind;
  // independent of the section structure above.
  timeline?: { na?: boolean; entries: SowTimelineEntry[] };
  payment?: { na?: boolean; rows: SowPaymentRow[] };
  itemOverrides?: SowItemOverride[]; // Production table · author overlay on derived items
  /** Parties / Project Details author overrides (live value shown by default,
   *  an edit replaces it). */
  partyOverrides?: { agency: string | null; supplier: string | null };
  projectDetailOverrides?: Record<string, string>; // keyed by field label
}

export interface SowPartyRef {
  id: string;
  name: string | null;
  logoUrl?: string | null;
  city?: string | null;
}

export type SowRole = 'agency' | 'supplier' | 'client';

export interface SowSignature {
  role: SowRole;
  name: string;
  title: string | null;
  signedAt: string;
}

export type SowStatus = 'draft' | 'counterparty_signed' | 'executed' | 'declined';

export interface Sow {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: SowStatus | string;
  content: SowContent;
  presentation: Record<string, unknown>;
  depositPct: number | null;
  projectId: string;
  projectProviderId: string;
  orgId: string;
  supplierOrgId: string;
  supersedesDocumentId: string | null;
  issuedAt: string | null;
  createdAt: string;
  updatedAt: string;
  parties?: { agency: SowPartyRef | null; supplier: SowPartyRef | null };
  signatures?: SowSignature[];
  platformFeePct?: number;
}

export interface SowCreate {
  projectId: string;
  supplierOrgId?: string;
  name: string;
  content?: SowContent;
  depositPct?: number;
}

export interface SowUpdate {
  name?: string;
  content?: SowContent;
  depositPct?: number;
  presentation?: Record<string, unknown>;
}

export interface SowSign {
  name: string;
  title?: string;
}

// ── prefill (GET /api/sow/prefill) ───────────────────────────────────────────
export interface SowPrefillItem {
  id: string;
  name: string;
  description: string | null;
  installDescription: string | null;
  price: number | null;
}
export interface SowPartyLegal {
  orgId: string;
  name: string | null;
  companyNumber: string | null;
  vatNumber: string | null;
  jurisdiction: string | null;
  address: string | null;
}
export interface SowParties {
  agency: SowPartyLegal | null;
  supplier: SowPartyLegal | null;
}

export interface SowPrefill {
  project: {
    name: string;
    venueName: string | null;
    eventDate: string | null;
    durationDays: number | null;
    guestCount: number | null;
  } | null;
  items: SowPrefillItem[];
}
