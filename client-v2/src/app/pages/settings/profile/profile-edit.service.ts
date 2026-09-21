import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/auth/auth.service';
import { can } from '../../../core/auth/permissions';
import { errorDetail } from '../../../core/http-error';
import { CodelistService } from '../../../core/codelists/codelist.service';
import { OrgProfile, OrgProfileUpdate, OrganisationService } from '../../../core/organisation.service';
import { AdminOrgService } from '../../../core/admin-org.service';
import { GalleryImage, PickerResult, PickerTab } from '../../../core/media/media.types';
import { MediaService } from '../../../core/media/media.service';
import { EditFieldOption } from '../../../shared/edit-field/edit-field.component';
import { CompletenessConfig } from '../../../shared/completeness/completeness.types';
import { SaveState } from '../../../shared/save-state-pill/save-state-pill.component';

/** The editable form state (strings throughout — edit-field's surface). */
export interface ProfileForm {
  name: string;
  description: string;
  website: string;
  city: string;
  country: string;
  address: string;
  companyNumber: string;
  email: string;
  phone: string;
  refPrefix: string;
  vat: string;
  margin: string;
  contingency: string;
  currency: string;
}

/** pV2-STORE-01 — the Profile org-editing state machine, extracted from
 *  profile.component.ts (STORE-01 audit bloat). Owns the org load, the form +
 *  per-section edit lifecycle (About / Company / Finance), the codelist-fed
 *  selects, and the immediate-save media operations (cover / logo / gallery).
 *  COMPONENT-SCOPED — provided in ProfileComponent.providers so it shares that
 *  component's MessageService instance (toasts land in its p-toast). */
@Injectable()
export class ProfileEditService {
  private readonly orgs = inject(OrganisationService);
  private readonly media = inject(MediaService);
  private readonly toast = inject(MessageService);
  private readonly codelists = inject(CodelistService);
  private readonly auth = inject(AuthService);
  private readonly adminOrgs = inject(AdminOrgService);

  /** pV2-ADMIN-ORG-PROFILE-EDIT-01 — when set, this service targets ANOTHER org
   *  via the admin endpoints (platform admin editing a supplier). Unset = the
   *  caller's own org (the /settings/profile owner path, unchanged). */
  readonly targetOrgId = signal<string | null>(null);

  /** The org profile — resource per the v2 fetch-into-state standard. Reloads
   *  when targetOrgId changes (admin opening a supplier's Profile tab). */
  readonly profile = resource<OrgProfile, string | null>({
    params: () => this.targetOrgId(),
    loader: async ({ params: orgId }) => {
      const org = await firstValueFrom(orgId ? this.orgs.getById(orgId) : this.orgs.get());
      this.form.set(toForm(org));
      this.refCounter.set(org.refCounter);
      return org;
    },
  });

  readonly form = signal<ProfileForm>(toForm(null));
  readonly refCounter = signal(0);

  /** Save-on-blur pill state, shared across the editable sections (the standard
   *  app-save-state-pill). */
  readonly saveState = signal<SaveState>('idle');

  /** Fetch-from-website state: in-flight flag + medium-confidence field flags
   *  ("please check") from the last refresh. */
  readonly fetching = signal(false);
  readonly flagged = signal<Set<string>>(new Set());

  /** Editable by org admins (mirrors the server PUT gate, org.manage_billing);
   *  AND by a platform admin when targeting another org (admin cross-org edit —
   *  the server admin.cross_org_view gate authorises the write). Non-admins see
   *  the fields read-only. */
  readonly canEdit = computed(
    () => can(this.auth.role(), 'org.manage_billing')
      || (!!this.targetOrgId() && this.auth.user()?.activeOrgType === 'ballpark'),
  );

  /** Route saves to the admin endpoint when targeting another org, else self. */
  private save(patch: OrgProfileUpdate) {
    const orgId = this.targetOrgId();
    return firstValueFrom(orgId ? this.orgs.updateById(orgId, patch) : this.orgs.update(patch));
  }

  // ── Codelist-fed selects (RP-04: no inline arrays) ────────────────────────
  private readonly countryRes = resource({ loader: () => this.codelists.list('country') });
  private readonly currencyRes = resource({ loader: () => this.codelists.list('currency') });
  readonly countryOptions = computed<EditFieldOption[]>(
    () => this.countryRes.value()?.map((v) => ({ label: v.label, value: v.code })) ?? []
  );
  readonly currencyOptions = computed<EditFieldOption[]>(
    () => this.currencyRes.value()?.map((v) => ({ label: v.label, value: v.code })) ?? []
  );

  /** Weighted profile completeness — each unmet item deep-links to its editor. */
  readonly completenessConfig: CompletenessConfig<OrgProfile> = [
    { weight: 25, label: 'Add a cover image', action: 'cover', done: (o) => !!o.coverImageUrl },
    { weight: 15, label: 'Add your logo', action: 'logo', done: (o) => !!o.logoUrl },
    { weight: 20, label: 'Add at least 3 gallery photos', action: 'gallery', done: (o) => (o.images?.length ?? 0) >= 3 },
    { weight: 10, label: 'Set your city & country', action: 'company', done: (o) => !!o.city && !!o.country },
    { weight: 10, label: 'Add your address', action: 'company', done: (o) => !!o.address },
    { weight: 10, label: 'Add a contact email', action: 'company', done: (o) => !!o.email },
    { weight: 10, label: 'Add a phone number', action: 'company', done: (o) => !!o.phone },
  ];

  patch(p: Partial<ProfileForm>): void {
    this.form.update((f) => ({ ...f, ...p }));
  }

  /** Save-on-blur: persist one section's fields and flash the shared pill. No
   *  edit-mode toggle, no toast — the pill is the confirmation (the standard).
   *  Per-section payloads (audit 02-F-2): each PUT carries only its own fields,
   *  so saving one never writes possibly-stale values from another. */
  async saveSection(section: 'about' | 'org' | 'fin'): Promise<void> {
    if (!this.canEdit()) return;
    this.saveState.set('saving');
    const f = this.form();
    const patch =
      section === 'about'
        ? { description: f.description.trim() }
        : section === 'org'
        ? {
            name: f.name,
            website: f.website.trim(),
            address: f.address,
            city: f.city,
            country: f.country,
            companyNumber: f.companyNumber.trim(),
            email: f.email,
            phone: f.phone,
            refPrefix: f.refPrefix.trim().toUpperCase(),
          }
        : {
            // defaultCurrency is never-clearable BY DESIGN (an org always has one).
            defaultCurrency: f.currency || 'GBP',
            defaultVatPct: Number(f.vat) || 0,
            defaultMarginPct: Number(f.margin) || 0,
            defaultContingencyPct: Number(f.contingency) || 0,
          };
    try {
      const fresh = await this.save(patch);
      this.profile.set(fresh);
      this.form.set(toForm(fresh));
      this.refCounter.set(fresh.refCounter);
      this.saveState.set('saved');
    } catch (e) {
      console.warn('[ProfileEdit] save failed', e);
      this.saveState.set('error');
    }
  }

  /** Refresh the profile from the org's website (Fetch button). Re-runs the
   *  org-import preview (self route for own-org; admin route when targeting
   *  another org — the owner can't call the admin-gated route), then applies the
   *  non-low extracted fields (branding + About + contact) in ONE save. Medium
   *  confidence → flag "please check". Country is only applied when it's already
   *  an ISO alpha-2 (the schema requires it), else left for manual edit. */
  async fetchFromWebsite(): Promise<void> {
    if (!this.canEdit() || this.fetching()) return;
    const url = this.form().website.trim();
    if (!url) return;
    this.fetching.set(true);
    try {
      const orgId = this.targetOrgId();
      const { org } = await firstValueFrom(
        orgId ? this.adminOrgs.importPreview(url) : this.orgs.importPreview(url),
      );
      const flags = new Set<string>();
      const patch: OrgProfileUpdate = {};
      const take = (key: string, apply: (v: string) => void, flagKey?: string, valid?: (v: string) => boolean) => {
        const f = org[key];
        if (!f || f.confidence === 'low' || (valid && !valid(f.value))) return;
        apply(f.value);
        if (f.confidence === 'medium' && flagKey) flags.add(flagKey);
      };
      take('description', (v) => (patch.description = v), 'description');
      take('city', (v) => (patch.city = v), 'city');
      take('country', (v) => (patch.country = v), 'country', (v) => /^[A-Z]{2}$/.test(v));
      take('address', (v) => (patch.address = v), 'address');
      take('email', (v) => (patch.email = v), 'email', (v) => v.includes('@'));
      take('phone', (v) => (patch.phone = v), 'phone');
      take('logo_url', (v) => (patch.logoUrl = v));
      take('cover_image_url', (v) => (patch.coverImageUrl = v));

      if (Object.keys(patch).length === 0) {
        this.toast.add({ severity: 'info', summary: 'Nothing new found on the site.', life: 3000 });
        return;
      }
      this.saveState.set('saving');
      const fresh = await this.save(patch);
      this.profile.set(fresh);
      this.form.set(toForm(fresh));
      this.refCounter.set(fresh.refCounter);
      this.flagged.set(flags);
      this.saveState.set('saved');
      this.toast.add({
        severity: 'success',
        summary: 'Profile refreshed from website' + (flags.size ? ' — please check flagged fields' : ''),
        life: 3500,
      });
    } catch (e) {
      this.saveState.set('error');
      this.toast.add({ severity: 'warn', summary: "Couldn't read that site — please try again.", detail: errorDetail(e), life: 5000 });
    } finally {
      this.fetching.set(false);
    }
  }

  // ── Branding media — logo / cover / gallery; saves immediately. ───────────
  readonly coverDrawer = signal(false);
  readonly logoDrawer = signal(false);
  readonly coverTabs: PickerTab[] = ['upload', 'find'];
  readonly logoTabs: PickerTab[] = ['upload'];

  onPickCover(r: PickerResult): void {
    if (r.type === 'image') void this.saveMedia({ coverImageUrl: r.url }, 'Cover updated.');
    this.coverDrawer.set(false);
  }
  onRemoveCover(): void {
    void this.saveMedia({ coverImageUrl: null }, 'Cover removed.');
    this.coverDrawer.set(false);
  }
  onPickLogo(r: PickerResult): void {
    if (r.type === 'image') void this.saveMedia({ logoUrl: r.url }, 'Logo updated.');
    this.logoDrawer.set(false);
  }
  onRemoveLogo(): void {
    void this.saveMedia({ logoUrl: null }, 'Logo removed.');
    this.logoDrawer.set(false);
  }
  saveImages(images: GalleryImage[]): void {
    void this.saveMedia({ images }, 'Gallery updated.');
  }
  setCover(img: GalleryImage): void {
    void this.saveMedia({ coverImageUrl: img.url }, 'Cover updated.');
  }
  // ── pV2-BUILDUP-04 — standard Terms & Conditions PDF (SOW Annex A). ────────
  readonly savingTerms = signal(false);
  async uploadTerms(file: File): Promise<void> {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      this.toast.add({ severity: 'error', summary: 'Please choose a PDF.', life: 4000 });
      return;
    }
    this.savingTerms.set(true);
    try {
      const { url } = await firstValueFrom(this.media.uploadTermsPdf(file));
      await this.saveMedia({ termsPdfUrl: url }, 'Terms & Conditions updated.');
    } catch (e) {
      this.toast.add({ severity: 'error', summary: "Couldn't upload — please try again.", detail: errorDetail(e), life: 5000 });
    } finally {
      this.savingTerms.set(false);
    }
  }
  removeTerms(): void {
    void this.saveMedia({ termsPdfUrl: null }, 'Terms & Conditions removed.');
  }

  private async saveMedia(patch: OrgProfileUpdate, summary: string): Promise<void> {
    try {
      const fresh = await this.save(patch);
      this.profile.set(fresh);
      this.form.set(toForm(fresh));
      this.refCounter.set(fresh.refCounter);
      this.toast.add({ severity: 'success', summary, life: 3000 });
    } catch (e) {
      this.toast.add({ severity: 'error', summary: "Couldn't update — please try again.", detail: errorDetail(e), life: 5000 });
    }
  }
}

/** Org → editable string form (and a blank default pre-load). */
export function toForm(org: OrgProfile | null): ProfileForm {
  return {
    name: org?.name ?? '',
    description: org?.description ?? '',
    website: org?.website ?? '',
    city: org?.city ?? '',
    country: org?.country ?? '',
    address: org?.address ?? '',
    companyNumber: org?.companyNumber ?? '',
    email: org?.email ?? '',
    phone: org?.phone ?? '',
    refPrefix: (org?.refPrefix ?? '').toUpperCase(),
    vat: String(org?.defaultVatPct ?? 20),
    margin: String(org?.defaultMarginPct ?? 20),
    contingency: String(org?.defaultContingencyPct ?? 5),
    currency: org?.defaultCurrency ?? 'GBP',
  };
}
