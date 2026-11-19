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

/** A node's type — what its BODY renders below its title + text. Absent on a node
 *  means a plain prose node (title + text + children only). The rest bind derived
 *  data (parties/projectDetails/timeline/production/payment/services), the live
 *  sign block (signature), or an attachment (appendix). One field, not two. */
export type SowNodeType =
  | 'parties' | 'projectDetails' | 'timeline'
  | 'production' | 'deliverables' | 'payment' | 'services'
  | 'signature'
  | 'appendix'  // the (un-numbered) Appendices container section; its children are the items
  | 'termsPdf'; // an appendix item that embeds the supplier's standard T&C PDF

/** ONE recursive document node. A node has an editable title + its own text, an
 *  N/A toggle, an optional bound table (derived content), an optional appendix
 *  file, and `children` — nodes of the same shape, to any depth. Numbering
 *  (1, 1.1, 1.1.1 …) falls out of the position in the tree. `signature` flags the
 *  special sign block (no text/children). Replaces the old 2-level
 *  Section/Subsection split so authors can nest sub-subsections anywhere. */
export interface SowNode {
  /** Stable identity, seeded on create + preserved through edits. Anchors
   *  review comments to a section even as the tree is reordered. */
  id?: string;
  title: string;
  text?: string | null;
  na?: boolean;
  /** What the node's body renders. Absent = plain prose. See SowNodeType. */
  type?: SowNodeType;
  /** Appendix attachment (for type 'appendix'). Upload UI is the deferred
   *  Documents work; the slot is here so a node can hold a file later. */
  file?: { url: string; name: string } | null;
  children: SowNode[];
}

/** A row in the Production, Pricing & Price-Matched Items table (Section 4).
 *  DERIVED on the draft from the thread's approved (both-accepted) line items —
 *  not a manually-built list, and all columns are the agreed deal facts (read-
 *  only). Richer per-item copy (description, variant detail) renders below the
 *  table as "Item Details", not in a cell. */
export interface SowProductionItem {
  itemId: string; // the line's catalogue item_id (or line id)
  item: string;
  sku: string | null; // catalogue ref (items.ref); blank until refs are populated
  qty: number | null;
  unit: string | null; // item_unit code (each / per_guest / platter / time / size)
  unitSize: number | string | null; // unit-driven size (platter → serves, time → time_unit)
  variant: string | null; // the agreed line's chosen variant label
  total: number | null;
  // Richer copy (all PROJECT-ITEM sourced) for the derived per-item sections.
  description: string | null; // the item description (markdown)
  variantDescription: string | null; // the chosen variant's own copy (markdown)
  installDescription: string | null; // the item's services / install copy (markdown)
}

/** Author-set overlay on one derived item row, stored on the SOW and merged
 *  over the live thread facts (spec / price note; keyed by itemId —
 *  Item/Qty/Variant/Total stay the agreed deal facts, read-only). */
export interface SowItemOverride {
  itemId: string;
  spec?: string | null;
  priceNotes: string | null;
}

/** A review comment on the SOW (generic review_comments machine). Anchored to a
 *  section via `anchorId` (a SowNode.id), or whole-document when null. */
export interface SowComment {
  id: string;
  anchorId: string | null;
  body: string;
  status: 'open' | 'resolved';
  authorOrgId: string;
  authorUserId: string;
  authorName: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  mine: boolean;
}

export interface SowContent {
  /** The document structure — a tree of nodes (section → sub → sub-sub …).
   *  Absent on older/never-edited SOWs → the panel falls back to the seeded
   *  default structure; materialized here the first time the author edits it. */
  sections?: SowNode[];
  // Table DATA — rendered wherever a node binds the matching table kind;
  // independent of the section structure above.
  timeline?: { na?: boolean; entries: SowTimelineEntry[] };
  payment?: { na?: boolean; rows: SowPaymentRow[] };
  itemOverrides?: SowItemOverride[]; // Production table · author overlay on derived items
  /** Parties / Project Details author overrides (live value shown by default,
   *  an edit replaces it). */
  partyOverrides?: { agency: string | null; supplier: string | null };
  projectDetailOverrides?: Record<string, string>; // keyed by field label
  /** Per-item deliverable/services prose overrides (derived from the item by
   *  default, an edit replaces it). Keyed by `${itemId}:description|options|services`. */
  blockOverrides?: Record<string, string | null>;
}

/** AI change proposals from the conversation (sow/:id/suggest). Nothing is applied
 *  until the supplier accepts (and optionally edits) each in the dialog. */
export interface SowSuggestionItem {
  itemId: string;
  itemName: string;
  description: string | null;
  variantChange: string | null;
  newVariant: string | null;
  install: string | null;
  cost: number | null;
}
export interface SowSuggestions {
  milestones: { from: string | null; to: string | null; details: string | null }[];
  payment: { amount: string | null; grace: string | null; details: string | null; refundable: SowRefundable | null }[];
  depositPct: number | null;
  items: SowSuggestionItem[];
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

/** One status-change entry (generic status_history) for the History view.
 *  `event` is the action label (e.g. "Send for review"); `commentCount` is the
 *  acting person's running comment tally on the entity. */
export interface SowHistoryEvent {
  status: string;
  event: string | null;
  changedAt: string;
  changedByName: string | null;
  commentCount: number;
}
export interface SowHistory {
  events: SowHistoryEvent[];
  commentCount: number;
}

export type SowStatus = 'draft' | 'in_review' | 'reviewed' | 'agent_approved' | 'accepted' | 'declined';
export type SowReviewAction = 'send' | 'revise' | 'review' | 'accept' | 'co_approve' | 'decline';

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
  /** The supplier's standard T&C PDF (embedded as Appendix A). Null when absent
   *  or not resolvable (cross-org agency view). */
  termsPdfUrl?: string | null;
  issuedAt: string | null;
  createdAt: string;
  updatedAt: string;
  parties?: { agency: SowPartyRef | null; supplier: SowPartyRef | null };
  signatures?: SowSignature[];
  platformFeePct?: number;
  /** Frozen production lines, snapshotted at execution (null on a draft — the
   *  Production table then derives live from the thread). Same shape as the
   *  derived SowProductionItem, so the panel renders either source identically. */
  lines?: SowProductionItem[] | null;
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
  /** AI-proposed SOW content extracted from the negotiation conversation (timeline /
   *  payment / deposit / scope notes). Supplier edits before sending. */
  suggested?: {
    timeline: { from: string | null; to: string | null; details: string | null }[];
    payment: { amount: string | null; grace: string | null; details: string | null; refundable: SowRefundable | null }[];
    depositPct: number | null;
    notes: string | null;
  };
}
