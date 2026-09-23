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

/** pV2-STORE-EXTRACT-01 — the ANALYSE report (read-only). */
export interface ExtractReport {
  url: string;
  pageShape: 'detail' | 'listing' | 'marketing' | string;
  verdict: string;
  pullable?: boolean;
  estimatedItems?: number | null;
  mapped?: {
    categories?: string[];
    itemCount?: number | null;
    hasPrice?: boolean;
    hasVolumeTiers?: boolean;
    hasOptions?: boolean;
    hasSku?: boolean;
    hasImages?: boolean;
    knownAttributes?: string[];
  };
  alsoFound?: string[];
  sample?: Record<string, unknown> | null;
  productLinks?: string[];
  raw_response?: string;
}

/** pV2-STORE-EXTRACT-01 — the PULL summary. */
/** Prepare (step 2): the marketplace taxonomy + a per-group cat/subcat suggestion. */
export interface CatNode { id: string; name: string; subcats: Array<{ id: string; name: string; subcats?: Array<{ id: string; name: string }> }>; }
export interface PrepareGroup {
  key: string;
  label: string;
  /** Full supplier path humanised, e.g. "Catering Equipment Hire > Cutlery Hire". */
  path?: string;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  isNew: boolean;
  confidence: number;
}
export interface PrepareResult { categories: CatNode[]; groups: PrepareGroup[]; }

/** A confirmed cat/subcat mapping row sent to Pull, keyed by group. */
export interface MappingRow { categoryId: string | null; subcategoryId?: string | null; subcategoryName?: string; isNew?: boolean; newParentId?: string | null; }

export interface PullResult {
  created: number;
  skipped: number;
  failed: number;
  mode?: 'review' | 'full';
  /** The gap report: data found on the pages with no home in our model yet. */
  gaps?: Array<{ label: string; kind: string; count: number; example?: string | null }>;
  results: Array<{ url: string; status: 'created' | 'skipped' | 'error'; reason?: string; itemId?: string; name?: string; optionCount?: number }>;
}

/** Admin-only org management (server: /api/admin/orgs, gated admin.cross_org_view)
 *  + the website-import preview (/api/v2/org-import/preview) + the catalogue
 *  extract (Analyse → Pull, /api/admin/orgs/:id/extract/*). */
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

  /** ANALYSE (read-only) — a report on what's pull-able from a supplier page. */
  extractAnalyse(orgId: string, url: string): Observable<ExtractReport> {
    return this.api.post<ExtractReport>(`/api/admin/orgs/${orgId}/extract/analyse`, { url });
  }

  /** PREPARE — for the selected groups, get a Ballpark cat/subcat suggestion each
   *  + the taxonomy tree for the dropdowns (only AIs the groups you'll load). */
  extractPrepare(orgId: string, groups: Array<{ key: string; sample?: string }>): Observable<PrepareResult> {
    return this.api.post<PrepareResult>(`/api/admin/orgs/${orgId}/extract/prepare`, { groups });
  }

  /** PULL — create pending items on the org from these product URLs.
   *  mode 'review' = lean vetting set (name/description/price/one image);
   *  'full' = everything mappable (after the supplier contracts). mapping =
   *  confirmed cat/subcat per group key (authoritative; skips the AI classifier). */
  extractPull(
    orgId: string, urls: string[], mode: 'review' | 'full' = 'full',
    mapping?: Record<string, MappingRow>,
  ): Observable<PullResult> {
    return this.api.post<PullResult>(`/api/admin/orgs/${orgId}/extract/pull`, { urls, mode, mapping });
  }

  /** Admin soft-delete of an item on another org (cascades to its option children
   *  server-side). DELETE /api/admin/orgs/:orgId/items/:itemId (exists). */
  deleteForOrg(orgId: string, itemId: string): Observable<void> {
    return this.api.delete<void>(`/api/admin/orgs/${orgId}/items/${itemId}`);
  }
}
