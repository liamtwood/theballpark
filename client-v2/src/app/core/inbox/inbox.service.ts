import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api.service';
import { ProjectCard } from '../projects/project.types';

/** pV2-INBOX-01 — the v2 inbox read path (gated `/api/inbox/*`; org from
 *  JWT, RP-INB1). Slice 1: the supplier's quote-request projects, shaped
 *  as the existing ProjectCard so `/projects?bucket=quoting` reuses the
 *  agency card grid (Defer 1 — a bespoke supplier card comes later). */
@Injectable({ providedIn: 'root' })
export class InboxService {
  private readonly api = inject(ApiService);

  /** Projects an agency has reached out to the caller-supplier about. */
  supplierProjects(): Observable<ProjectCard[]> {
    return this.api.get<ProjectCard[]>('/api/inbox/projects');
  }

  /** Fan a project's quote out to the picked suppliers — one thread per
   *  (category × supplier). org from JWT. */
  send(projectId: string, roster: OutreachRosterEntry[]): Observable<OutreachSendResult> {
    return this.api.post<OutreachSendResult>('/api/inbox/send', { projectId, roster });
  }

  /** The caller's inbox for one project — role-aware server-side: a
   *  supplier gets their own threads; an agency gets every supplier's
   *  threads on a project it owns. Same response shape. */
  projectInbox(projectId: string): Observable<InboxProjectView> {
    return this.api.get<InboxProjectView>(`/api/inbox/projects/${projectId}/threads`);
  }

  /** Reply in a thread — a chat message and/or per-item actions. */
  reply(threadId: string, body: InboxReplyBody): Observable<InboxReplyResult> {
    return this.api.post<InboxReplyResult>(`/api/inbox/threads/${threadId}/reply`, body);
  }
}

export interface InboxItemAction {
  itemId: string;
  action: 'accept' | 'adjust' | 'decline';
  price?: number;
  note?: string;
}

export interface InboxReplyBody {
  text?: string;
  itemActions?: InboxItemAction[];
  /** Tag a free-text message to a catalogue item (filters the thread). */
  taggedItemId?: string;
}

export interface InboxReplyResult {
  ok: boolean;
  replyId: string;
  changes: { name: string; from: string; to: string }[];
}

export interface InboxProjectSummary {
  id: string;
  name: string | null;
  clientName: string | null;
  eventDate: string | null;
  location: string | null;
  agencyName: string | null;
  agencyLogoUrl: string | null;
  itemCount: number;
  originalTotal: number;
  revisedTotal: number;
}

export interface InboxProjectView {
  project: InboxProjectSummary;
  threads: InboxThread[];
}

export interface InboxThreadItem {
  id: string;
  /** Catalogue item_id — the key messages are tagged against. */
  itemId: string | null;
  name: string;
  description: string | null;
  status: string;
  /** pV2-UNIFY-01: LINE totals (per-unit rate × qty + install). */
  priceRef: number | null;
  priceCurrent: number | null;
  /** The per-unit rate being negotiated (Cost), plus the breakdown basis. */
  unitPriceRef: number | null;
  unitPriceCurrent: number | null;
  quantity: number | null;
  unit: string | null;
  installed: boolean | null;
  installCost: number | null;
  installUnit: string | null;
  imageUrl: string | null;
  /** Latest accept per side (buyer = agency, seller = supplier). */
  buyerAccepted: boolean;
  sellerAccepted: boolean;
}

export interface InboxBubble {
  id: string;
  mine: boolean;
  author: string;
  body: string;
  createdAt: string;
  /** Catalogue item_ids this message is tagged to (empty = broadcast). */
  taggedItemIds: string[];
}

export interface InboxThread {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  agencyOrgId: string | null;
  agencyName: string | null;
  agencyLogoUrl: string | null;
  supplierOrgId: string | null;
  supplierName: string | null;
  supplierLogoUrl: string | null;
  projectId: string;
  projectName: string | null;
  refCode: string | null;
  status: string;
  total: number;
  originalTotal: number;
  revisedTotal: number;
  items: InboxThreadItem[];
  messages: InboxBubble[];
}

export interface OutreachRosterEntry {
  categoryId: string;
  supplierIds: string[];
}

export interface OutreachSendResult {
  categories: number;
  threads: number;
}
