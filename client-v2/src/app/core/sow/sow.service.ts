// pV2-SOW-01 (Phase 2) — client service for the SOW document. ApiService-backed
// (cookie auth, base URL), one method per /api/sow endpoint. The server scopes
// everything to the JWT caller; the client never passes an org.

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api.service';
import { Sow, SowCreate, SowSign, SowUpdate } from './sow.types';

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

  /** Sign — counterparty first, author counter-signs. */
  sign(id: string, payload: SowSign): Observable<Sow> {
    return this.api.post<Sow>(`/api/sow/${id}/sign`, payload);
  }
}
