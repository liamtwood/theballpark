import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/auth/auth.service';
import { PageConfigService } from '../../../core/config/page-config.service';
import { SaveStatePillComponent } from '../../../shared/save-state-pill/save-state-pill.component';
import { DrawerComponent } from '../../../shared/drawer/drawer.component';
import { ImagePickerComponent } from '../../../shared/image-picker/image-picker.component';
import { OrgMediaComponent } from '../../../shared/org-media/org-media.component';
import { CompletenessCardComponent } from '../../../shared/completeness/completeness-card.component';
import { PageHeroComponent } from '../../../shell/page-hero/page-hero.component';
import { TabBandComponent, TabBandTab } from '../../../shared/tab-band/tab-band.component';
import { SelectComponent, SelectOption } from '../../../shared/select/select.component';
import { ProfileEditService } from './profile-edit.service';
import { ProfileTeamSectionComponent } from './profile-team-section.component';
import { ProfileShopfrontComponent } from './profile-shopfront.component';

/** pV2 Profile — /settings/profile: always-editable rounded ed-* fields that
 *  save on blur with the shared app-save-state-pill (the workspace standard;
 *  no Edit/Save buttons). Two tabs (Profile editor / Shopfront preview,
 *  suppliers only). The org state machine + media live in ProfileEditService;
 *  the Team roster + invite and the Shopfront body are extracted child
 *  components. This shell owns the hero, tab band, completeness deep-links,
 *  and the single-column section layout. */
@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    LucideAngularModule,
    ToastModule,
    PageHeroComponent,
    SaveStatePillComponent,
    DrawerComponent,
    ImagePickerComponent,
    OrgMediaComponent,
    CompletenessCardComponent,
    TabBandComponent,
    ProfileTeamSectionComponent,
    ProfileShopfrontComponent,
    SelectComponent,
  ],
  providers: [MessageService, ProfileEditService],
  // bp-vpfit: hero (and the supplier tab-band) stay anchored; only the content
  // below scrolls — the Past projects standard.
  // Flowing page (standard): whole page scrolls at the window edge under the fixed
  // nav; the hero (and supplier tab-band) scroll with the content (Liam 2026-10-30).
  host: { class: 'block' },
  template: `
    <app-page-hero align="block" [eyebrow]="hero().eyebrow" [title]="hero().title" [subtitle]="hero().subtitle" />

    <!-- Profile (editable) + Shopfront (consumer view). Suppliers only.
         Tab-band shows only with >1 tab — Shopfront is hidden for now. -->
    @if (isSupplier() && tabs.length > 1) {
      <div class="flex justify-center px-6 pt-4">
        <app-tab-band [tabs]="tabs" [active]="tab()" (activeChange)="setTab($event)" />
      </div>
    }

    @if (isSupplier() && tab() === 'shopfront') {
      <div class="min-h-0 overflow-y-auto md:flex-1">
        <app-profile-shopfront [orgId]="auth.user()?.activeOrgId ?? ''" />
      </div>
    } @else {
    <div class="bp-page-body">
      <div class="min-h-0 overflow-y-auto md:flex-1">
      @if (store.profile.isLoading()) {
        <p class="bp-body-small text-secondary">Loading…</p>
      } @else if (store.profile.error()) {
        <p class="bp-body-small text-warn">Couldn't load your organisation.</p>
      } @else {
        <div class="mx-auto flex w-full max-w-[var(--workspace-max)] flex-col gap-5">
          <!-- Profile completeness — full width across the top. -->
          @if (store.profile.value(); as org) {
            @if (store.canEdit()) {
              <app-completeness-card
                [entity]="org"
                [config]="store.completenessConfig"
                title="Profile completeness"
                entityLabel="profile"
                (actionClicked)="handleCompletenessAction($event)"
              />
            }
          }

          <!-- Single column (narrow workspace): About Us → Branding → details,
               with Availability + Gallery at the bottom. -->
          <div class="flex flex-col gap-5">
            <!-- ── Details ─────────────────────────────────────────────── -->
            <div class="flex flex-col gap-5">
              <!-- Branding — cover banner + logo + name/role, with About Us moved
                   in beneath the identity label (Liam 2026-11-02). The drawers ride
                   WITH it so their (empty) hosts don't add stray gaps. -->
              @if (store.profile.value(); as org) {
                <div>
                <div class="ed-card p-6">
                  <!-- "Branding" title removed (Liam 2026-11-02); save pill stays top-right. -->
                  <div class="flex justify-end">
                    <app-save-state-pill [state]="store.saveState()" [idleShowsSaved]="true" />
                  </div>
                  <div class="mt-4 bp-branding-media">
                  <!-- org-media renders the cover banner + circular logo only; the
                       identity (name + approved check + locality) is rendered below
                       so we can add the check icon (Liam screenshot 2026-11-02). -->
                  <app-org-media
                    mode="edit"
                    show="banner"
                    [canEdit]="store.canEdit()"
                    [name]="''"
                    [subtitle]="''"
                    [coverUrl]="org.coverImageUrl"
                    [logoUrl]="org.logoUrl"
                    [images]="org.images"
                    (editCover)="store.coverDrawer.set(true)"
                    (editLogo)="store.logoDrawer.set(true)"
                  />
                  </div>
                  <!-- Identity: name + approved check, then "Approved Ballpark
                       supplier · <pin> <city>". Lifted up beside the logo (negative
                       top margin into the banner's bottom reserve; left padding clears
                       the 88px logo at left:16px) so it sits just under the banner to
                       the right of the logo (Liam 2026-11-02). -->
                  <div class="-mt-10 pl-32">
                    <div class="flex items-center gap-1.5">
                      <h3 class="bp-card-title">{{ org.name }}</h3>
                      <lucide-icon name="circle-check" [size]="20" class="bp-verified" />
                    </div>
                    <div class="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-secondary">
                      <span class="bp-body-small">Approved Ballpark {{ isSupplier() ? 'supplier' : 'agency' }}</span>
                      @if (org.city) {
                        <span class="bp-body-small">·</span>
                        <lucide-icon name="map-pin" [size]="14" [strokeWidth]="1.75" />
                        <span class="bp-body-small">{{ org.city }}</span>
                      }
                    </div>
                  </div>
                  <!-- About Us — the public description blurb (orgs.description),
                       rendered as inline editable text: no label, no border; click
                       into the paragraph to edit (Liam 2026-11-02). -->
                  <textarea class="bp-about-edit bp-body mt-3 block w-full resize-none border-0 text-secondary focus:outline-none"
                            rows="5"
                            placeholder="Tell customers about your company…"
                            [disabled]="!store.canEdit()"
                            [ngModel]="store.form().description"
                            (ngModelChange)="store.patch({ description: $event })"
                            (blur)="store.saveSection('about')"></textarea>

                  <!-- Contact pills: website · instagram (empty for now) · email.
                       Centred, each a fixed ~30ch width. Values come from Company
                       Information below. -->
                  <div class="bp-contact-row mt-4 flex flex-wrap justify-center gap-2">
                    @if (org.website) {
                      <a class="bp-contact-pill" [href]="webHref(org.website)" target="_blank" rel="noopener noreferrer">
                        <lucide-icon name="globe" [size]="15" /><span>{{ webText(org.website) }}</span>
                      </a>
                    } @else {
                      <span class="bp-contact-pill bp-contact-pill--empty">
                        <lucide-icon name="globe" [size]="15" /><span>Add website</span>
                      </span>
                    }
                    <span class="bp-contact-pill bp-contact-pill--empty">
                      <lucide-icon name="instagram" [size]="15" /><span>Instagram</span>
                    </span>
                    @if (org.email) {
                      <a class="bp-contact-pill" [href]="'mailto:' + org.email">
                        <lucide-icon name="mail" [size]="15" /><span>{{ org.email }}</span>
                      </a>
                    } @else {
                      <span class="bp-contact-pill bp-contact-pill--empty">
                        <lucide-icon name="mail" [size]="15" /><span>Add email</span>
                      </span>
                    }
                  </div>
                </div>

                <app-drawer [(open)]="store.coverDrawer" title="Cover image">
                  <app-image-picker
                    entityType="profile"
                    [enabledTabs]="store.coverTabs"
                    [focalStep]="false"
                    [searchSeed]="org.name"
                    [currentImageUrl]="org.coverImageUrl"
                    previewAspect="4/3"
                    (chosen)="store.onPickCover($event)"
                    (removed)="store.onRemoveCover()"
                    (cancelled)="store.coverDrawer.set(false)"
                  />
                </app-drawer>
                <app-drawer [(open)]="store.logoDrawer" title="Logo">
                  <app-image-picker
                    entityType="profile"
                    [enabledTabs]="store.logoTabs"
                    [focalStep]="false"
                    [currentImageUrl]="org.logoUrl"
                    previewAspect="1/1"
                    (chosen)="store.onPickLogo($event)"
                    (removed)="store.onRemoveLogo()"
                    (cancelled)="store.logoDrawer.set(false)"
                  />
                </app-drawer>
                </div>
              }

              <div #companySection class="ed-card p-6">
                <div class="flex items-center justify-between">
                  <h2 class="bp-card-title">Company Information</h2>
                  <app-save-state-pill [state]="store.saveState()" [idleShowsSaved]="true" />
                </div>
                <div class="mt-4 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                  <label class="block sm:col-span-2"><span class="ed-label mb-1.5 block">Website</span>
                    <div class="flex gap-2">
                      <input class="ed-input min-w-0 flex-1" type="url" placeholder="https://example.com"
                        [disabled]="!store.canEdit()" [ngModel]="store.form().website"
                        (ngModelChange)="store.patch({ website: $event })" (blur)="store.saveSection('org')" />
                      <button type="button" class="bp-btn-outline shrink-0"
                        [disabled]="!store.canEdit() || store.fetching() || !store.form().website.trim()"
                        (click)="store.fetchFromWebsite()">{{ store.fetching() ? 'Fetching…' : 'Fetch' }}</button>
                    </div>
                    <span class="bp-caption text-secondary">Fetch refreshes branding + About from your site.</span></label>
                  <label class="block"><span class="ed-label mb-1.5 block">Organisation name</span>
                    <input class="ed-input" [disabled]="!store.canEdit()" [ngModel]="store.form().name" (ngModelChange)="store.patch({ name: $event })" (blur)="store.saveSection('org')" /></label>
                  <label class="block"><span class="ed-label mb-1.5 block">Company number</span>
                    <input class="ed-input" [disabled]="!store.canEdit()" [ngModel]="store.form().companyNumber" (ngModelChange)="store.patch({ companyNumber: $event })" (blur)="store.saveSection('org')" /></label>
                  <!-- Primary address (addresses satellite). Type stays 'site' (the primary);
                       the type picker belongs to the deferred multi-address work (FR-00239). -->
                  <label class="block sm:col-span-2"><span class="ed-label mb-1.5 block">Address line 1</span>
                    <input class="ed-input" [disabled]="!store.canEdit()" [ngModel]="store.form().address" (ngModelChange)="store.patch({ address: $event })" (blur)="store.saveSection('org')" /></label>
                  <label class="block sm:col-span-2"><span class="ed-label mb-1.5 block">Address line 2</span>
                    <input class="ed-input" [disabled]="!store.canEdit()" [ngModel]="store.form().line2" (ngModelChange)="store.patch({ line2: $event })" (blur)="store.saveSection('org')" /></label>
                  <label class="block"><span class="ed-label mb-1.5 block">City</span>
                    <input class="ed-input" [disabled]="!store.canEdit()" [ngModel]="store.form().city" (ngModelChange)="store.patch({ city: $event })" (blur)="store.saveSection('org')" /></label>
                  <label class="block"><span class="ed-label mb-1.5 block">Postcode</span>
                    <input class="ed-input" [disabled]="!store.canEdit()" [ngModel]="store.form().postcode" (ngModelChange)="store.patch({ postcode: $event })" (blur)="store.saveSection('org')" /></label>
                  <label class="block"><span class="ed-label mb-1.5 block">Region / county</span>
                    <input class="ed-input" [disabled]="!store.canEdit()" [ngModel]="store.form().region" (ngModelChange)="store.patch({ region: $event })" (blur)="store.saveSection('org')" /></label>
                  <label class="block"><span class="ed-label mb-1.5 block">Country</span>
                    <app-select ariaLabel="Country" [filter]="true" [disabled]="!store.canEdit()" [options]="countrySelectOptions()" [value]="store.form().country" (changed)="store.patch({ country: $event }); store.saveSection('org')" /></label>
                  <label class="block"><span class="ed-label mb-1.5 block">Email</span>
                    <input class="ed-input" type="email" [disabled]="!store.canEdit()" [ngModel]="store.form().email" (ngModelChange)="store.patch({ email: $event })" (blur)="store.saveSection('org')" /></label>
                  <label class="block"><span class="ed-label mb-1.5 block">Phone</span>
                    <input class="ed-input" type="tel" [disabled]="!store.canEdit()" [ngModel]="store.form().phone" (ngModelChange)="store.patch({ phone: $event })" (blur)="store.saveSection('org')" /></label>
                  <label class="block"><span class="ed-label mb-1.5 block">Project reference prefix</span>
                    <input class="ed-input" maxlength="4" placeholder="e.g. WA" [disabled]="!store.canEdit()" [ngModel]="store.form().refPrefix" (ngModelChange)="store.patch({ refPrefix: $event.toUpperCase() })" (blur)="store.saveSection('org')" /></label>
                  <label class="block"><span class="ed-label mb-1.5 block">Projects numbered so far</span>
                    <input class="ed-input" disabled [value]="store.refCounter()" /></label>
                </div>
              </div>

              <app-profile-team-section [canEdit]="store.canEdit()" />

              <div class="ed-card p-6">
                <div class="flex items-center justify-between">
                  <h2 class="bp-card-title">Finance</h2>
                  <app-save-state-pill [state]="store.saveState()" [idleShowsSaved]="true" />
                </div>
                <div class="mt-4 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                  <label class="block"><span class="ed-label mb-1.5 block">Currency</span>
                    <app-select ariaLabel="Currency" [disabled]="!store.canEdit()" [options]="store.currencyOptions()" [value]="store.form().currency" (changed)="store.patch({ currency: $event }); store.saveSection('fin')" /></label>
                  <label class="block"><span class="ed-label mb-1.5 block">VAT (%)</span>
                    <input class="ed-input" type="number" [disabled]="!store.canEdit()" [ngModel]="store.form().vat" (ngModelChange)="store.patch({ vat: $event })" (blur)="store.saveSection('fin')" /></label>
                  <label class="block"><span class="ed-label mb-1.5 block">Margin (%)</span>
                    <input class="ed-input" type="number" [disabled]="!store.canEdit()" [ngModel]="store.form().margin" (ngModelChange)="store.patch({ margin: $event })" (blur)="store.saveSection('fin')" /></label>
                  <label class="block"><span class="ed-label mb-1.5 block">Contingency (%)</span>
                    <input class="ed-input" type="number" [disabled]="!store.canEdit()" [ngModel]="store.form().contingency" (ngModelChange)="store.patch({ contingency: $event })" (blur)="store.saveSection('fin')" /></label>
                </div>
              </div>

              <!-- pV2-BUILDUP-04 — standard Terms & Conditions PDF (SOW Annex A). -->
              @if (store.profile.value(); as org) {
              <div class="ed-card p-6">
                <h2 class="bp-card-title">Terms &amp; Conditions</h2>
                <p class="bp-caption mt-2">Your standard Terms &amp; Conditions PDF — attached as Annex A on Statements of Work.</p>
                <div class="mt-3 flex flex-wrap items-center gap-3">
                  @if (org.termsPdfUrl) {
                    <a [href]="org.termsPdfUrl" target="_blank" rel="noopener" class="flex items-center gap-2 bp-body-small text-text underline">
                      <lucide-icon name="file-text" [size]="15" /> View current T&amp;Cs
                    </a>
                  } @else {
                    <span class="bp-body-small text-secondary">No T&amp;Cs uploaded yet.</span>
                  }
                  @if (store.canEdit()) {
                    <label class="bp-btn-outline flex cursor-pointer items-center gap-2">
                      <lucide-icon name="upload" [size]="15" /> {{ store.savingTerms() ? 'Uploading…' : (org.termsPdfUrl ? 'Replace' : 'Upload PDF') }}
                      <input type="file" accept="application/pdf" class="hidden" [disabled]="store.savingTerms()" (change)="onTermsFile($event)" />
                    </label>
                    @if (org.termsPdfUrl) {
                      <button type="button" class="bp-body-small text-danger transition-colors hover:underline" (click)="store.removeTerms()">Remove</button>
                    }
                  }
                </div>
              </div>
              }

              <div class="ed-card p-6">
                <h2 class="bp-card-title">Social Links</h2>
                <p class="bp-caption mt-2">Coming soon.</p>
              </div>
              <div class="ed-card p-6">
                <h2 class="bp-card-title">Most Viewed Products This Month</h2>
                <p class="bp-caption mt-2">Coming soon.</p>
              </div>
              <div class="ed-card p-6">
                <h2 class="bp-card-title">Payment Information</h2>
                <p class="bp-caption mt-2">Coming soon.</p>
              </div>
            </div>

            <!-- ── Bottom: Availability + Gallery ─────────────────────────── -->
            <div class="flex flex-col gap-5">
              <div class="ed-card p-6">
                <h2 class="bp-card-title">Availability</h2>
                <p class="bp-caption mt-2">Coming soon.</p>
              </div>

              @if (store.profile.value(); as org) {
                <!-- Gallery — org-media's portfolio mode renders its own card. -->
                <div #mediaSection>
                  <app-org-media
                    mode="edit"
                    show="portfolio"
                    [canEdit]="store.canEdit()"
                    [name]="org.name"
                    [coverUrl]="org.coverImageUrl"
                    [logoUrl]="org.logoUrl"
                    [images]="org.images"
                    (imagesChange)="store.saveImages($event)"
                    (primarySet)="store.setCover($event)"
                  />
                </div>
              }
            </div>
          </div>
        </div>
      }
      </div>
    </div>
    }

    <p-toast position="bottom-right" styleClass="bp-toast" />
  `,
})
export class ProfileComponent {
  protected readonly auth = inject(AuthService);
  private readonly pageConfig = inject(PageConfigService);
  protected readonly store = inject(ProfileEditService);

  /** Country list is long → app-select with type-ahead; leading "—" clears it. */
  protected readonly countrySelectOptions = computed<SelectOption[]>(
    () => [{ value: '', label: '—' }, ...this.store.countryOptions()],
  );

  /** Website pill: safe absolute href (prefix https:// when missing). */
  protected webHref(u: string): string {
    const r = (u ?? '').trim();
    return /^https?:\/\//i.test(r) ? r : `https://${r}`;
  }
  /** Website pill label — host without protocol / www / trailing slash. */
  protected webText(u: string): string {
    try {
      return new URL(this.webHref(u)).host.replace(/^www\./, '');
    } catch {
      return (u ?? '').replace(/^https?:\/\//i, '').replace(/\/$/, '');
    }
  }

  // ── Profile / Shopfront tabs (suppliers only). ────────────────────────────
  protected readonly isSupplier = computed(() => this.auth.user()?.activeOrgType === 'supplier');

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  /** Tab lives in the URL (?tab=shopfront) so the Storefront hub's "My
   *  Shopfront" tile can deep-link straight to it. */
  private readonly tabParam = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('tab'))),
    { initialValue: this.route.snapshot.queryParamMap.get('tab') },
  );
  protected readonly tab = computed<'profile' | 'shopfront'>(() =>
    // Shopfront hidden for now (Liam 2026-11-02) — always the Profile editor,
    // even if a stale ?tab=shopfront deep-link lands here. Restore the param
    // read below when Shopfront returns.
    // this.tabParam() === 'shopfront' ? 'shopfront' : 'profile',
    'profile',
  );
  // Shopfront tab hidden for now (Liam 2026-11-02); may return later. With one
  // tab the tab-band is suppressed in the template (tabs.length > 1).
  protected readonly tabs: TabBandTab[] = [
    { key: 'profile', label: 'Profile' },
    // { key: 'shopfront', label: 'Shopfront' },
  ];
  /** pV2-BUILDUP-04 — file input → upload the T&C PDF, then clear the input. */
  protected onTermsFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void this.store.uploadTerms(file);
    input.value = '';
  }
  protected setTab(key: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: key === 'shopfront' ? 'shopfront' : null },
      queryParamsHandling: 'merge',
    });
  }

  /** Hero (eyebrow / title / subtitle): /settings/pages overrides win over
   *  PAGE_HERO_DEFAULTS; the subtitle default resolves {email} + {orgType}. */
  protected readonly hero = computed(() => this.pageConfig.pageHero('profile'));

  // Completeness deep-links scroll/enter-edit the matching editor.
  private readonly companySection = viewChild<ElementRef<HTMLElement>>('companySection');
  private readonly mediaSection = viewChild<ElementRef<HTMLElement>>('mediaSection');

  protected handleCompletenessAction(action: string): void {
    switch (action) {
      case 'cover':
        this.store.coverDrawer.set(true);
        break;
      case 'logo':
        this.store.logoDrawer.set(true);
        break;
      case 'gallery':
        this.scrollTo(this.mediaSection());
        break;
      case 'company':
        // Fields are always editable now — just bring the section into view.
        this.scrollTo(this.companySection());
        break;
    }
  }

  private scrollTo(ref: ElementRef<HTMLElement> | undefined): void {
    ref?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
