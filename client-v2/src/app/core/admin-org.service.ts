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
  /** The org's owner(s) — comma-joined emails of user_orgs role='owner'; null =
   *  no owner (an orphan the admin should adopt/clean up). */
  owner_emails?: string | null;
  member_count?: number;
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
  /** Woo profile: permalink → its category group {key,label} (grouping isn't in the
   *  flat /product/ URL, so the server supplies it). Absent for crawl/path sites. */
  linkGroups?: Record<string, { key: string; label: string }>;
  /** Which profile produced this report — 'woo' | 'generic' (crawl) | undefined. */
  source?: string;
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
  /** AI-suggested 3rd level (only under an existing subcategory). */
  subsubcategoryId?: string | null;
  subsubcategoryName?: string | null;
  subsubIsNew?: boolean;
  confidence: number;
}
export interface PrepareResult { categories: CatNode[]; groups: PrepareGroup[]; }

/** A confirmed cat/subcat mapping row sent to Pull, keyed by group. */
export interface MappingRow { categoryId: string | null; subcategoryId?: string | null; subcategoryName?: string; isNew?: boolean; newParentId?: string | null; }

/** Starting a pull now returns a JOB id (the pull runs in the background) + the
 *  plan snapshot counts — the panel polls the job and can re-attach after leaving. */
export interface PullStart { jobId: string; selected: number; total: number; dropped: number; }

/** A whole-site (homepage) Analyse fans out over sections as a background job and
 *  returns this instead of a report; the panel polls the job then builds the report. */
export interface AnalyseJobStart { jobId: string; kind: 'analyse'; async: true; }

/** A background pull job — live status/progress plus the same results/gaps a
 *  finished PullResult carries. Polled while running; terminal when status is
 *  done | cancelled | error. */
export interface PullJob {
  jobId: string;
  kind?: 'pull' | 'analyse';
  status: 'running' | 'cancelling' | 'cancelled' | 'done' | 'error';
  mode?: 'review' | 'full';
  selected: number;
  total: number;
  processed: number;
  created: number;
  skipped: number;
  failed: number;
  dropped: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  gaps?: PullResult['gaps'];
  results: PullResult['results'];
  // Analyse (fan-out) jobs carry these instead — a report-shaped payload + coverage.
  productLinks?: string[];
  sections?: Array<{ section: string; path: string; count: number }>;
  url?: string;
  pageShape?: string;
  pullable?: boolean;
  verdict?: string;
  mapped?: { itemCount?: number | null };
  error?: string | null;
  updatedAt?: string;
}

export interface PullResult {
  created: number;
  skipped: number;
  failed: number;
  /** Dropped BEFORE the loop (duplicate handle / over the per-pull cap) — recorded
   *  so created+skipped+failed+dropped reconciles against `selected`. */
  dropped?: number;
  /** What the caller selected — the four outcome counts sum to this. */
  selected?: number;
  mode?: 'review' | 'full';
  /** AI token usage + estimated cost (Haiku). Review-from-JSON-LD adds nothing. */
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  /** The gap report: data found on the pages with no home in our model yet. */
  gaps?: Array<{ label: string; kind: string; count: number; example?: string | null }>;
  results: Array<{ url: string; status: 'created' | 'skipped' | 'error' | 'dropped'; reason?: string; itemId?: string; name?: string; optionCount?: number }>;
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

  // pV2-STORE-EXTRACT-01 — the extractor's HTTP calls moved to CatalogueExtractClient
  // (base-keyed) so the admin cross-org mount and the self-serve own-org mount share
  // one client. website-import-panel builds the base and calls that.

  /** Admin soft-delete of an item on another org (cascades to its option children
   *  server-side). DELETE /api/admin/orgs/:orgId/items/:itemId (exists). */
  deleteForOrg(orgId: string, itemId: string): Observable<void> {
    return this.api.delete<void>(`/api/admin/orgs/${orgId}/items/${itemId}`);
  }
}
