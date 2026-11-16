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

/** A row in Services & Goods (or a custom Add-section). na = marked N/A. */
export interface SowSubSection {
  name: string;
  content: string | null;
  na?: boolean;
}

export interface SowContent {
  timeline?: { na?: boolean; entries: SowTimelineEntry[] };
  services?: SowSubSection[];
  payment?: { na?: boolean; rows: SowPaymentRow[] };
  specialTerms?: SowSubSection; // under Fees & Payment
  extra?: SowSubSection[];
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
