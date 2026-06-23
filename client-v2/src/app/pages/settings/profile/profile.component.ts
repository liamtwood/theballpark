import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, resource, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/auth/auth.service';
import { can } from '../../../core/auth/permissions';
import { errorDetail } from '../../../core/http-error';
import { PageConfigService } from '../../../core/config/page-config.service';
import { CodelistService } from '../../../core/codelists/codelist.service';
import { LucideAngularModule } from 'lucide-angular';
import { OrgProfile, OrgProfileUpdate, OrganisationService } from '../../../core/organisation.service';
import { GalleryImage, PickerResult, PickerTab } from '../../../core/media/media.types';
import { EditFieldComponent, EditFieldOption } from '../../../shared/edit-field/edit-field.component';
import { EditSectionComponent } from '../../../shared/edit-section/edit-section.component';
import { DrawerComponent } from '../../../shared/drawer/drawer.component';
import { ImagePickerComponent } from '../../../shared/image-picker/image-picker.component';
import { OrgMediaComponent } from '../../../shared/org-media/org-media.component';
import { CompletenessCardComponent } from '../../../shared/completeness/completeness-card.component';
import { CompletenessConfig } from '../../../shared/completeness/completeness.types';
import { PageHeroComponent } from '../../../shell/page-hero/page-hero.component';
import { Router } from '@angular/router';
import { TabBandComponent, TabBandTab } from '../../../shared/tab-band/tab-band.component';
import { StorefrontPanelComponent } from '../../suppliers/storefront-panel.component';
import { CatalogueService } from '../../../core/marketplace/catalogue.service';
import { SupplierSubcategory } from '../../../shared/catalogue/catalogue.types';

/** The editable form state (strings throughout — edit-field's surface). */
interface ProfileForm {
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

/** pV2 Profile — /settings/profile: the v2 port of v1's
 *  /settings/organisation, and the REFERENCE consumer of the page-density
 *  <app-edit-section> + <app-edit-field> standard. Two sections
 *  (Organisation 2-col / Financial defaults 3-col), per-section pencil →
 *  snapshot → Cancel restores / Save PUTs. Members view read-only; org
 *  admins (org.manage_billing — matches the server's PUT gate) edit. */
@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ToastModule,
    LucideAngularModule,
    PageHeroComponent,
    EditSectionComponent,
    EditFieldComponent,
    DrawerComponent,
    ImagePickerComponent,
    OrgMediaComponent,
    CompletenessCardComponent,
    TabBandComponent,
    StorefrontPanelComponent,
  ],
  providers: [MessageService],
  host: { class: 'block' },
  template: `
    <app-page-hero [back]="{ label: 'Back', href: '/home' }" [title]="heroTitle()" [subtitle]="heroSubtitle()" />

    <!-- Profile (the editable view) + Shopfront (the consumer-facing view).
         Suppliers only — agencies/ballpark have no public shopfront. -->
    @if (isSupplier()) {
      <div class="flex justify-center px-6 pt-4">
        <app-tab-band [tabs]="tabs" [active]="tab()" (activeChange)="setTab($event)" />
      </div>
    }

    @if (isSupplier() && tab() === 'shopfront') {
      <div class="bp-page-body">
        @if (shopfront.isLoading()) {
          <p class="bp-body-small text-secondary">Loading…</p>
        } @else if (shopfront.value(); as sup) {
          <div class="bp-settings-body">
            <app-storefront-panel
              [supplier]="sup"
              [subcategories]="shopfrontSubcats.value() ?? []"
              (subcategorySelected)="openStoreSubcat($event)"
            />
          </div>
        } @else {
          <p class="bp-body-small text-warn">Couldn't load your shopfront.</p>
        }
      </div>
    } @else {
    <div class="bp-page-body">
      @if (profile.isLoading()) {
        <p class="bp-body-small text-secondary">Loading…</p>
      } @else if (profile.error()) {
        <p class="bp-body-small text-warn">Couldn't load your organisation.</p>
      } @else {
        <div class="bp-settings-body">
          @if (profile.value(); as org) {
            @if (canEdit()) {
              <!-- pV2-MEDIA-01f — weighted % complete + suggested-action
                   deep-links into the editors below. Editors only (canEdit). -->
              <app-completeness-card
                [entity]="org"
                [config]="completenessConfig"
                title="Profile completeness"
                entityLabel="profile"
                (actionClicked)="handleCompletenessAction($event)"
              />
            }
          }

          @if (profile.value(); as org) {
            <!-- Branding — cover first, then logo + portfolio (pV2-STORE-01).
                 The SAME media component the shopfront renders; edits ride
                 canEdit. Titled container only (org-media owns its own editing,
                 so the section's button row stays off). -->
            <app-edit-section title="Branding" [editable]="false">
              <app-org-media
                mode="edit"
                show="banner"
                [canEdit]="canEdit()"
                [name]="org.name"
                [coverUrl]="org.coverImageUrl"
                [logoUrl]="org.logoUrl"
                [images]="org.images"
                (editCover)="coverDrawer.set(true)"
                (editLogo)="logoDrawer.set(true)"
              />
            </app-edit-section>

            <app-drawer [(open)]="coverDrawer" title="Cover image">
              <app-image-picker
                entityType="profile"
                [enabledTabs]="coverTabs"
                [focalStep]="false"
                [searchSeed]="org.name"
                [currentImageUrl]="org.coverImageUrl"
                previewAspect="4/3"
                (chosen)="onPickCover($event)"
                (removed)="onRemoveCover()"
                (cancelled)="coverDrawer.set(false)"
              />
            </app-drawer>
            <app-drawer [(open)]="logoDrawer" title="Logo">
              <app-image-picker
                entityType="profile"
                [enabledTabs]="logoTabs"
                [focalStep]="false"
                [currentImageUrl]="org.logoUrl"
                previewAspect="1/1"
                (chosen)="onPickLogo($event)"
                (removed)="onRemoveLogo()"
                (cancelled)="logoDrawer.set(false)"
              />
            </app-drawer>
          }

          <!-- About Us — the public description blurb (orgs.description, also
               rendered on the shopfront). Its own section + edit lifecycle. -->
          <app-edit-section
            title="About Us"
            [editable]="canEdit()"
            [(editing)]="editingAbout"
            [saving]="saving()"
            (edit)="snapshot('about')"
            (cancelled)="restore('about')"
            (save)="save('about')"
          >
            @if (editingAbout()) {
              <textarea
                class="bp-profile-textarea"
                rows="5"
                [ngModel]="form().description"
                (ngModelChange)="patch({ description: $event })"
                placeholder="Tell customers about your company…"
              ></textarea>
            } @else {
              <p class="bp-body whitespace-pre-line text-secondary">{{ form().description || '—' }}</p>
            }
          </app-edit-section>

          <div #companySection>
          <app-edit-section
            title="Company Information"
            [editable]="canEdit()"
            [(editing)]="editingOrg"
            [saving]="saving()"
            (edit)="snapshot('org')"
            (cancelled)="restore('org')"
            (save)="save('org')"
          >
            <div class="bp-field-grid-2">
              <app-edit-field label="Organisation name" density="page" [editing]="editingOrg()" [value]="form().name" (valueChange)="patch({ name: $event })" />
              <app-edit-field label="City" density="page" [editing]="editingOrg()" [value]="form().city" (valueChange)="patch({ city: $event })" />
              <app-edit-field label="Country" type="select" density="page" [filter]="true" [options]="countryOptions()" [editing]="editingOrg()" [value]="form().country" (valueChange)="patch({ country: $event })" />
              <app-edit-field label="Address" density="page" [editing]="editingOrg()" [value]="form().address" (valueChange)="patch({ address: $event })" />
              <app-edit-field label="Email" type="email" density="page" [editing]="editingOrg()" [value]="form().email" (valueChange)="patch({ email: $event })" />
              <app-edit-field label="Phone" type="tel" density="page" [editing]="editingOrg()" [value]="form().phone" (valueChange)="patch({ phone: $event })" />
              <app-edit-field label="Project reference prefix" density="page" [maxLength]="4" placeholder="e.g. WA" [editing]="editingOrg()" [value]="form().refPrefix" (valueChange)="patch({ refPrefix: $event.toUpperCase() })" />
              <app-edit-field label="Projects numbered so far" density="page" [readonlyAlways]="true" [value]="String(refCounter())" />
            </div>
          </app-edit-section>
          </div>

          @if (profile.value(); as org) {
            <!-- Gallery — org-media's portfolio (edit) mode renders its OWN
                 bp-card + "Gallery" title, so NO outer edit-section here (that
                 produced a card-in-a-card). Saves immediately like Branding. -->
            <div #mediaSection>
              <app-org-media
                mode="edit"
                show="portfolio"
                [canEdit]="canEdit()"
                [name]="org.name"
                [coverUrl]="org.coverImageUrl"
                [logoUrl]="org.logoUrl"
                [images]="org.images"
                (imagesChange)="saveImages($event)"
                (primarySet)="setCover($event)"
              />
            </div>
          }

          <app-edit-section
            title="Finance"
            [editable]="canEdit()"
            [(editing)]="editingFin"
            [saving]="saving()"
            (edit)="snapshot('fin')"
            (cancelled)="restore('fin')"
            (save)="save('fin')"
          >
            <div class="bp-field-grid-3">
              <app-edit-field label="Currency" type="select" density="page" [options]="currencyOptions()" [editing]="editingFin()" [value]="form().currency" (valueChange)="patch({ currency: $event })" />
              <app-edit-field label="VAT" type="number" suffix="%" density="page" [editing]="editingFin()" [value]="form().vat" (valueChange)="patch({ vat: $event })" />
              <app-edit-field label="Margin" type="number" suffix="%" density="page" [editing]="editingFin()" [value]="form().margin" (valueChange)="patch({ margin: $event })" />
              <app-edit-field label="Contingency" type="number" suffix="%" density="page" [editing]="editingFin()" [value]="form().contingency" (valueChange)="patch({ contingency: $event })" />
            </div>
          </app-edit-section>

        </div>
      }
    </div>
    }

    <!-- MessageService supplies aria-live by severity (polite success/info,
         assertive error) — no explicit role needed (audit F-10). -->
    <p-toast position="bottom-right" styleClass="bp-toast" />
  `,
  styles: `
    .bp-profile-textarea {
      width: 100%;
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-input, 8px);
      background: var(--color-surface);
      color: var(--color-text);
      padding: 10px 12px;
      font-family: var(--bp-font);
      font-size: var(--text-base);
      line-height: var(--leading-normal);
      resize: vertical;
    }
    .bp-profile-textarea:focus-visible {
      outline: 2px solid var(--theme-accent);
      outline-offset: 1px;
    }
  `,
})
export class ProfileComponent {
  protected readonly auth = inject(AuthService);
  private readonly orgs = inject(OrganisationService);
  private readonly toast = inject(MessageService);
  private readonly pageConfig = inject(PageConfigService);
  private readonly codelists = inject(CodelistService);
  private readonly catalogue = inject(CatalogueService);
  private readonly router = inject(Router);

  // ── Profile / Shopfront tabs (pV2-STORE-01) ───────────────────────────────
  // Profile = the editable view; Shopfront = the consumer-facing view (the same
  // panel the marketplace renders). Suppliers only — others have no shopfront.
  protected readonly isSupplier = computed(() => this.auth.user()?.activeOrgType === 'supplier');
  protected readonly tab = signal<'profile' | 'shopfront'>('profile');
  protected readonly tabs: TabBandTab[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'shopfront', label: 'Shopfront' },
  ];
  protected setTab(key: string): void {
    this.tab.set(key === 'shopfront' ? 'shopfront' : 'profile');
  }

  /** The owner's own marketplace storefront — loaded when a supplier opens the
   *  Shopfront tab (skips for non-suppliers / before it's needed). */
  protected readonly shopfront = resource({
    params: () =>
      this.isSupplier() && this.tab() === 'shopfront'
        ? (this.auth.user()?.activeOrgId ?? undefined)
        : undefined,
    loader: ({ params }) => this.catalogue.supplierDetail(params),
  });
  protected readonly shopfrontSubcats = resource({
    params: () =>
      this.isSupplier() && this.tab() === 'shopfront'
        ? (this.auth.user()?.activeOrgId ?? undefined)
        : undefined,
    loader: ({ params }) => this.catalogue.supplierSubcategories(params),
  });

  /** Shopfront subcat card → open that category in the owner's item store. */
  protected openStoreSubcat(sub: SupplierSubcategory): void {
    const id = this.auth.user()?.activeOrgId;
    if (!id) return;
    this.router
      .navigate(['/suppliers', id], {
        queryParams: { tab: 'store', cat: sub.parentId, sub: sub.isCatchAll ? null : sub.id },
      })
      .catch((err) => console.warn('[Profile] navigation failed', err));
  }

  /** Codelist-fed selects (pV2-CODELISTS-02 — RP-04: no inline arrays).
   *  Country labels show the name; the stored value is the ISO-2 code. */
  private readonly countryRes = resource({
    loader: () => this.codelists.list('country'),
  });
  private readonly currencyRes = resource({
    loader: () => this.codelists.list('currency'),
  });
  protected readonly countryOptions = computed<EditFieldOption[]>(
    () => this.countryRes.value()?.map((v) => ({ label: v.label, value: v.code })) ?? []
  );
  protected readonly currencyOptions = computed<EditFieldOption[]>(
    () => this.currencyRes.value()?.map((v) => ({ label: v.label, value: v.code })) ?? []
  );

  /** Hero (title2/subtitle2 roles): /settings/pages overrides win;
   *  defaults are "Profile" / the org name. */
  protected readonly heroTitle = computed(() => this.pageConfig.profileTitle() || 'Profile');
  protected readonly heroSubtitle = computed(
    () => this.pageConfig.profileSubtitle() || (this.auth.user()?.activeOrgName ?? '')
  );

  protected readonly String = String;

  /** The org profile — resource per the v2 fetch-into-state standard. */
  protected readonly profile = resource<OrgProfile, void>({
    loader: async () => {
      const org = await firstValueFrom(this.orgs.get());
      this.form.set(toForm(org));
      this.refCounter.set(org.refCounter);
      return org;
    },
  });

  protected readonly form = signal<ProfileForm>(toForm(null));
  protected readonly refCounter = signal(0);

  protected readonly editingAbout = signal(false);
  protected readonly editingOrg = signal(false);
  protected readonly editingFin = signal(false);
  protected readonly saving = signal(false);

  /** Pencils mirror the server's PUT gate (org.manage_billing = org admins). */
  protected readonly canEdit = computed(() => can(this.auth.role(), 'org.manage_billing'));

  // ── Completeness (pV2-MEDIA-01f) — weighted % + suggested-action deep-links. ──
  private readonly companySection = viewChild<ElementRef<HTMLElement>>('companySection');
  private readonly mediaSection = viewChild<ElementRef<HTMLElement>>('mediaSection');

  /** Weighted profile completeness (sums to 100). Each unmet item surfaces a
   *  suggested action that deep-links to its editor (handleCompletenessAction). */
  protected readonly completenessConfig: CompletenessConfig<OrgProfile> = [
    { weight: 25, label: 'Add a cover image', action: 'cover', done: (o) => !!o.coverImageUrl },
    { weight: 15, label: 'Add your logo', action: 'logo', done: (o) => !!o.logoUrl },
    { weight: 20, label: 'Add at least 3 gallery photos', action: 'gallery', done: (o) => (o.images?.length ?? 0) >= 3 },
    { weight: 10, label: 'Set your city & country', action: 'company', done: (o) => !!o.city && !!o.country },
    { weight: 10, label: 'Add your address', action: 'company', done: (o) => !!o.address },
    { weight: 10, label: 'Add a contact email', action: 'company', done: (o) => !!o.email },
    { weight: 10, label: 'Add a phone number', action: 'company', done: (o) => !!o.phone },
  ];

  /** Maps a completeness action token to the matching editor. */
  protected handleCompletenessAction(action: string): void {
    switch (action) {
      case 'cover':
        this.coverDrawer.set(true);
        break;
      case 'logo':
        this.logoDrawer.set(true);
        break;
      case 'gallery':
        this.scrollTo(this.mediaSection());
        break;
      case 'company':
        // Enter edit on Company Information so the fields are ready to fill.
        this.snapshot('org');
        this.editingOrg.set(true);
        this.scrollTo(this.companySection());
        break;
    }
  }

  private scrollTo(ref: ElementRef<HTMLElement> | undefined): void {
    ref?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private snapshots: { about?: ProfileForm; org?: ProfileForm; fin?: ProfileForm } = {};

  // ── Branding (pV2-MEDIA-01d) — logo / cover / gallery; saves immediately. ──
  protected readonly coverDrawer = signal(false);
  protected readonly logoDrawer = signal(false);
  protected readonly coverTabs: PickerTab[] = ['upload', 'find'];
  protected readonly logoTabs: PickerTab[] = ['upload'];

  protected onPickCover(r: PickerResult): void {
    if (r.type === 'image') void this.saveMedia({ coverImageUrl: r.url }, 'Cover updated.');
    this.coverDrawer.set(false);
  }
  protected onRemoveCover(): void {
    void this.saveMedia({ coverImageUrl: null }, 'Cover removed.');
    this.coverDrawer.set(false);
  }
  protected onPickLogo(r: PickerResult): void {
    if (r.type === 'image') void this.saveMedia({ logoUrl: r.url }, 'Logo updated.');
    this.logoDrawer.set(false);
  }
  protected onRemoveLogo(): void {
    void this.saveMedia({ logoUrl: null }, 'Logo removed.');
    this.logoDrawer.set(false);
  }
  protected saveImages(images: GalleryImage[]): void {
    void this.saveMedia({ images }, 'Gallery updated.');
  }
  protected setCover(img: GalleryImage): void {
    void this.saveMedia({ coverImageUrl: img.url }, 'Cover updated.');
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

  protected patch(p: Partial<ProfileForm>): void {
    this.form.update((f) => ({ ...f, ...p }));
  }

  protected snapshot(section: 'about' | 'org' | 'fin'): void {
    this.snapshots[section] = { ...this.form() };
  }

  protected restore(section: 'about' | 'org' | 'fin'): void {
    const snap = this.snapshots[section];
    if (snap) this.form.set({ ...snap });
  }

  protected async save(section: 'about' | 'org' | 'fin'): Promise<void> {
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
            // defaultCurrency is never-clearable BY DESIGN (an org always
            // has one — unlike country, '' is not accepted server-side).
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
      // Locked toast copy (DIALOGS.md standard messages).
      this.toast.add({ severity: 'success', summary: 'Saved.', life: 3000 });
    } catch (e) {
      this.toast.add({ severity: 'error', summary: "Couldn't save — please try again.", detail: errorDetail(e), life: 5000 });
    } finally {
      this.saving.set(false);
    }
  }
}

/** Org → editable string form (and a blank default pre-load). */
function toForm(org: OrgProfile | null): ProfileForm {
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
