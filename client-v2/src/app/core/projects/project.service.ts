import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api.service';
import { ProjectCard, ProjectCreatePayload, ProjectDetail, ProjectUpdate } from './project.types';

/** pV2-PROJECTS-01 — the v2 projects read path. INTERIM base
 *  `/api/projects-v2`: v1 owns the live ungated `/api/projects` until
 *  pV2-11; this is the gated, org-scoped (JWT) v2 surface. */
@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly api = inject(ApiService);

  /** The caller's org's projects (org scoping is server-side, from JWT). */
  list(): Observable<ProjectCard[]> {
    return this.api.get<ProjectCard[]>('/api/projects-v2');
  }

  /** Create a project from an AI-parsed brief (no items). Returns the new
   *  list card. org from JWT — never sent. */
  create(payload: ProjectCreatePayload): Observable<ProjectCard> {
    return this.api.post<ProjectCard>('/api/projects-v2', payload);
  }

  /** One project's full detail (inside-project view). */
  getDetail(id: string): Observable<ProjectDetail> {
    return this.api.get<ProjectDetail>(`/api/projects-v2/${id}`);
  }

  /** Partial update (Project Details tab). Returns the fresh detail. */
  update(id: string, patch: ProjectUpdate): Observable<ProjectDetail> {
    return this.api.put<ProjectDetail>(`/api/projects-v2/${id}`, patch);
  }
}
