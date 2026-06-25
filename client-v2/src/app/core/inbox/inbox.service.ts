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
}
