// pV2-SOW-01 (Phase 2) — client types for the SOW document (server /api/sow).
// content is the STRUCTURED SOW: fixed sections (prose blocks + payment fields)
// plus a free-form `extra` list. Boilerplate (intro/parties/schedule/signature)
// is not stored — it's fixed and hidden in the display.

export type SowRefundable = 'yes' | 'no' | 'partial' | 'na';

export interface SowPaymentRow {
  pct: number | null;
  dateLabel: string | null; // "SOW date" / "Event date" / a specific date
  graceDays: number | null;
  refundable: SowRefundable | null;
  description: string | null;
}

export interface SowExtraSection {
  name: string;
  content: string;
}

/** The structured SOW body. Every prose field is null = N/A (shown as "N/A"). */
export interface SowContent {
  timeline?: string | null;
  projectDetails?: string | null; // location · date · duration (from the project)
  conceptDesign?: string | null;
  bespokeRender?: string | null;
  includedServices?: string | null; // from each item's install description
  scope?: string | null; // the item menu(s) + price
  payment?: { deposit: SowPaymentRow; final: SowPaymentRow };
  specialTerms?: string | null;
  extra?: SowExtraSection[];
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
  orgId: string; // the author org
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
