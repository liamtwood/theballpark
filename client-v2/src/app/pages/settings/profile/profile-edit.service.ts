import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/auth/auth.service';
import { can } from '../../../core/auth/permissions';
import { errorDetail } from '../../../core/http-error';
import { CodelistService } from '../../../core/codelists/codelist.service';
import { OrgProfile, OrgProfileUpdate, OrganisationService } from '../../../core/organisation.service';
import { GalleryImage, PickerResult, PickerTab } from '../../../core/media/media.types';
import { MediaService } from '../../../core/media/media.service';
import { EditFieldOption } from '../../../shared/edit-field/edit-field.component';
import { CompletenessConfig } from '../../../shared/completeness/completeness.types';

/** The editable form state (strings throughout — edit-field's surface). */
export interface ProfileForm {
  name: string;
  description: string;
  city: string;
  country: string;
  address: string;
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

  /** The org profile — resource per the v2 fetch-into-state standard. */
  readonly profile = resource<OrgProfile, void>({
    loader: async () => {
      const org = await firstValueFrom(this.orgs.get());
      this.form.set(toForm(org));
      this.refCounter.set(org.refCounter);
      return org;
    },
  });

  readonly form = signal<ProfileForm>(toForm(null));
  readonly refCounter = signal(0);

  readonly editingAbout = signal(false);
  readonly editingOrg = signal(false);
  readonly editingFin = signal(false);
  readonly saving = signal(false);

  /** Pencils mirror the server's PUT gate (org.manage_billing = org admins). */
  readonly canEdit = computed(() => can(this.auth.role(), 'org.manage_billing'));

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

  private snapshots: { about?: ProfileForm; org?: ProfileForm; fin?: ProfileForm } = {};

  patch(p: Partial<ProfileForm>): void {
    this.form.update((f) => ({ ...f, ...p }));
  }
  snapshot(section: 'about' | 'org' | 'fin'): void {
    this.snapshots[section] = { ...this.form() };
  }
  restore(section: 'about' | 'org' | 'fin'): void {
    const snap = this.snapshots[section];
    if (snap) this.form.set({ ...snap });
  }

  async save(section: 'about' | 'org' | 'fin'): Promise<void> {
    this.saving.set(true);
    const f = this.form();
    // Per-section payloads (audit 02-F-2): each section's PUT carries only its
    // own fields, so saving one never writes possibly-stale values from another.
    const patch =
      section === 'about'
        ? { description: f.description.trim() }
        : section === 'org'
        ? {
            name: f.name,
            address: f.address,
            city: f.city,
            country: f.country,
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
      const fresh = await firstValueFrom(this.orgs.update(patch));
      this.form.set(toForm(fresh));
      this.refCounter.set(fresh.refCounter);
      if (section === 'about') this.editingAbout.set(false);
      else if (section === 'org') this.editingOrg.set(false);
      else this.editingFin.set(false);
      this.toast.add({ severity: 'success', summary: 'Saved.', life: 3000 });
    } catch (e) {
      this.toast.add({ severity: 'error', summary: "Couldn't save — please try again.", detail: errorDetail(e), life: 5000 });
    } finally {
      this.saving.set(false);
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
      const fresh = await firstValueFrom(this.orgs.update(patch));
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
    city: org?.city ?? '',
    country: org?.country ?? '',
    address: org?.address ?? '',
    email: org?.email ?? '',
    phone: org?.phone ?? '',
    refPrefix: (org?.refPrefix ?? '').toUpperCase(),
    vat: String(org?.defaultVatPct ?? 20),
    margin: String(org?.defaultMarginPct ?? 20),
    contingency: String(org?.defaultContingencyPct ?? 5),
    currency: org?.defaultCurrency ?? 'GBP',
  };
}
