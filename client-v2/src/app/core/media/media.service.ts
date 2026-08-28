import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api.service';
import { UnsplashPhoto } from './media.types';

/** pV2-MEDIA-01 — upload + Unsplash search for the image picker. Upload goes
 *  to the gated `/api/media/upload` (server picks the bucket from scope, so
 *  the client never hardcodes env bucket names). Unsplash search hits the
 *  shared proxy (paginated). */
@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly api = inject(ApiService);

  /** Upload an image file for an entity scope → Supabase URL. */
  upload(file: File, scope: 'project' | 'item' | 'supplier' | 'profile'): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    form.append('scope', scope);
    return this.api.postForm<{ url: string }>('/api/media/upload', form);
  }

  /** pV2-BUILDUP-04 — upload the agency's standard Terms & Conditions PDF
   *  (org-level, SOW Annex A) → Supabase URL. */
  uploadTermsPdf(file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    form.append('scope', 'terms');
    return this.api.postForm<{ url: string }>('/api/media/upload', form);
  }

  /** Search Unsplash (paginated). Returns a bare array; the picker infers
   *  "more" from a full page. */
  searchUnsplash(query: string, page = 1, perPage = 24): Observable<UnsplashPhoto[]> {
    const q = encodeURIComponent(query);
    return this.api.get<UnsplashPhoto[]>(`/api/unsplash/search?query=${q}&page=${page}&per_page=${perPage}`);
  }
}
