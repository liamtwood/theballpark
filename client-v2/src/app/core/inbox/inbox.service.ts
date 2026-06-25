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

  /** The caller-supplier's conversation threads for one project (per
   *  category) — items + bubbles + counterparty agency. */
  supplierThreads(projectId: string): Observable<InboxThread[]> {
    return this.api.get<InboxThread[]>(`/api/inbox/projects/${projectId}/threads`);
  }
}

export interface InboxThreadItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priceRef: number | null;
  priceCurrent: number | null;
  imageUrl: string | null;
}

export interface InboxBubble {
  id: string;
  mine: boolean;
  author: string;
  body: string;
  createdAt: string;
}

export interface InboxThread {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  agencyOrgId: string | null;
  agencyName: string | null;
  agencyLogoUrl: string | null;
  projectId: string;
  projectName: string | null;
  refCode: string | null;
  status: string;
  total: number;
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
