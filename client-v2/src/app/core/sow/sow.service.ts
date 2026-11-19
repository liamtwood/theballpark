// pV2-SOW-01 (Phase 2) — client service for the SOW document. ApiService-backed
// (cookie auth, base URL), one method per /api/sow endpoint. The server scopes
// everything to the JWT caller; the client never passes an org.

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api.service';
import { Sow, SowComment, SowCreate, SowHistory, SowParties, SowPrefill, SowReviewAction, SowSuggestions, SowUpdate } from './sow.types';

@Injectable({ providedIn: 'root' })
export class SowService {
  private readonly api = inject(ApiService);

  /** The SOWs on a project visible to the caller (own + counterparty-authored). */
  list(projectId: string): Observable<Sow[]> {
    return this.api.get<Sow[]>(`/api/sow?projectId=${encodeURIComponent(projectId)}`);
  }

  /** One SOW as a render payload (doc + parties + signatures + fee). */
  get(id: string): Observable<Sow> {
    return this.api.get<Sow>(`/api/sow/${id}`);
  }

  /** Create a draft (the caller is the author; engagement derived from project + supplier). */
  create(payload: SowCreate): Observable<Sow> {
    return this.api.post<Sow>('/api/sow', payload);
  }

  /** Edit a draft (author only; rejected once signed). */
  update(id: string, patch: SowUpdate): Observable<Sow> {
    return this.api.patch<Sow>(`/api/sow/${id}`, patch);
  }

  /** Suggested content for a new SOW, from the project + the supplier's items. */
  prefill(projectId: string): Observable<SowPrefill> {
    return this.api.get<SowPrefill>(`/api/sow/prefill?projectId=${encodeURIComponent(projectId)}`);
  }

  /** Both parties' legal details (gated cross-org resolver). */
  partiesFor(id: string): Observable<SowParties> {
    return this.api.get<SowParties>(`/api/sow/${id}/parties`);
  }

  /** Render the SOW to a PDF from the client's flat print model (+ header meta). */
  pdf(id: string, blocks: unknown[], meta?: unknown): Observable<Blob> {
    return this.api.postBlob(`/api/sow/${id}/pdf`, { blocks, meta });
  }

  /** A lifecycle transition — send / revise (author) or accept / decline (counterparty). */
  review(id: string, action: SowReviewAction): Observable<{ status: string }> {
    return this.api.post<{ status: string }>(`/api/sow/${id}/review`, { action });
  }

  /** The review-comment thread on a SOW (both parties; RLS-scoped). */
  comments(id: string): Observable<SowComment[]> {
    return this.api.get<SowComment[]>(`/api/sow/${id}/comments`);
  }

  /** Post a comment; `anchorId` = the SOW node id (null = whole document). */
  addComment(id: string, body: string, anchorId: string | null): Observable<SowComment> {
    return this.api.post<SowComment>(`/api/sow/${id}/comments`, { body, anchorId });
  }

  /** Resolve/close a comment (owner side). */
  resolveComment(id: string, commentId: string): Observable<SowComment> {
    return this.api.post<SowComment>(`/api/sow/${id}/comments/${commentId}/resolve`, {});
  }

  /** Edit your own comment's body (author side, while open). */
  editComment(id: string, commentId: string, body: string): Observable<SowComment> {
    return this.api.patch<SowComment>(`/api/sow/${id}/comments/${commentId}`, { body });
  }

  /** Delete your own comment (author side). */
  deleteComment(id: string, commentId: string): Observable<{ id: string }> {
    return this.api.delete<{ id: string }>(`/api/sow/${id}/comments/${commentId}`);
  }

  /** Status-change history + total comment count. */
  history(id: string): Observable<SowHistory> {
    return this.api.get<SowHistory>(`/api/sow/${id}/history`);
  }

  /** AI change proposals from the conversation (author runs it on demand). */
  suggest(id: string): Observable<SowSuggestions> {
    return this.api.get<SowSuggestions>(`/api/sow/${id}/suggest`);
  }

  /** Apply the accepted/edited suggestions (SOW content + the live lines). */
  applySuggestions(id: string, accepted: Partial<SowSuggestions>): Observable<{ ok: boolean }> {
    return this.api.post<{ ok: boolean }>(`/api/sow/${id}/apply-suggestions`, accepted);
  }
}
