import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { GalleryImage } from './media/media.types';

/** pV2 Profile — /api/organisation shapes (server: routes/organisation.js). */
export interface OrgProfile {
  id: string;
  name: string;
  /** "About Us" blurb (pV2-STORE-01) — also rendered on the shopfront. */
  description: string | null;
  address: string | null;
  city: string | null;
  /** ISO 3166-1 alpha-2 — fed by the `country` codelist (pV2-CODELISTS-02). */
  country: string | null;
  email: string | null;
  phone: string | null;
  refPrefix: string | null;
  refCounter: number;
  defaultVatPct: number;
  defaultMarginPct: number;
  defaultContingencyPct: number;
  /** ISO 4217 alpha-3 — fed by the `currency` codelist (pV2-CODELISTS-02). */
  defaultCurrency: string;
  /** Branding (pV2-MEDIA-01d) — logo + cover + gallery; cover feeds the
   *  supplier card image. */
  logoUrl: string | null;
  coverImageUrl: string | null;
  images: GalleryImage[];
}

export type OrgProfileUpdate = Partial<
  Omit<OrgProfile, 'id' | 'refCounter'>
>;

/** The signed-in org's own profile — GET any member, PUT org admins. */
@Injectable({ providedIn: 'root' })
export class OrganisationService {
  private readonly api = inject(ApiService);

  get(): Observable<OrgProfile> {
    return this.api.get<OrgProfile>('/api/organisation');
  }

  update(patch: OrgProfileUpdate): Observable<OrgProfile> {
    return this.api.put<OrgProfile>('/api/organisation', patch);
  }
}
