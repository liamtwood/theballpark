// pV2-SOW-01 (Phase 2) — client types for the SOW document (server /api/sow).
// Mirrors the server DTO (sow.service.js toSowDto). content is the authored,
// ordered narrative the supplier writes the SOW into.

export interface SowSection {
  name: string;
  content: string;
  order: number;
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
  content: SowSection[];
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
  // present on GET /:id (render payload)
  parties?: { agency: SowPartyRef | null; supplier: SowPartyRef | null };
  signatures?: SowSignature[];
  platformFeePct?: number;
}

export interface SowCreate {
  projectId: string;
  supplierOrgId?: string; // only when the agency authors
  name: string;
  content?: SowSection[];
  depositPct?: number;
}

export interface SowUpdate {
  name?: string;
  content?: SowSection[];
  depositPct?: number;
  presentation?: Record<string, unknown>;
}

export interface SowSign {
  name: string;
  title?: string;
}
