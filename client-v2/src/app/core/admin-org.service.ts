import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

/** BE-00127 — an org row as the admin Orgs page sees it. */
export interface AdminOrg {
  id: string;
  name: string;
  type: string;
  city?: string | null;
  country?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  description?: string | null;
  address?: string | null;
  company_number?: string | null;
  vat_number?: string | null;
  default_currency?: string | null;
  logo_url?: string | null;
  cover_image_url?: string | null;
  is_active: boolean;
  created_at: string;
}

/** Create payload — the fields the admin create form (and website import) fill. */
export interface CreateOrgInput {
  name: string;
  type: string;
  website?: string;
  description?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  company_number?: string;
  vat_number?: string;
  default_currency?: string;
  logo_url?: string;
  cover_image_url?: string;
}

/** Confidence-tagged field from the website-import preview (pV2-IMPORT-ORG-01). */
export interface ImportField {
  value: string;
  confidence: 'high' | 'medium' | 'low';
}
export interface OrgImportPreview {
  org: Record<string, ImportField>;
  source: { jsonLd: boolean; og: boolean };
}

/** Admin-only org management (server: /api/admin/orgs, gated admin.cross_org_view)
 *  + the website-import preview (/api/v2/org-import/preview). */
@Injectable({ providedIn: 'root' })
export class AdminOrgService {
  private readonly api = inject(ApiService);

  list(): Observable<AdminOrg[]> {
    return this.api.get<AdminOrg[]>('/api/admin/orgs');
  }

  get(id: string): Observable<AdminOrg> {
    return this.api.get<AdminOrg>(`/api/admin/orgs/${id}`);
  }

  create(body: CreateOrgInput): Observable<AdminOrg> {
    return this.api.post<AdminOrg>('/api/admin/orgs', body);
  }

  /** Approve (activate) / suspend (deactivate) — is_active toggle. */
  setActive(id: string, active: boolean): Observable<AdminOrg> {
    return this.api.patch<AdminOrg>(`/api/admin/orgs/${id}/active`, { active });
  }

  /** Preview-only extraction from a vendor website (BE-00127 slice 3). */
  importPreview(url: string): Observable<OrgImportPreview> {
    return this.api.post<OrgImportPreview>('/api/v2/org-import/preview', { url });
  }
}
