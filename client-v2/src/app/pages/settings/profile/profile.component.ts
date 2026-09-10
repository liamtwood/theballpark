import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
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
  ],
  providers: [MessageService, ProfileEditService],
  // bp-vpfit: hero (and the supplier tab-band) stay anchored; only the content
  // below scrolls — the Past projects standard.
  host: { class: 'block bp-vpfit' },
  template: `
    <app-page-hero align="block" [eyebrow]="hero().eyebrow" [title]="hero().title" [subtitle]="hero().subtitle" />

    <!-- Profile (editable) + Shopfront (consumer view). Suppliers only. -->
    @if (isSupplier()) {
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
              <!-- About Us — the public description blurb (orgs.description). -->
              <div class="ed-card p-6">
                <div class="flex items-center justify-between">
                  <h2 class="bp-card-title">About Us</h2>
                  <app-save-state-pill [state]="store.saveState()" [idleShowsSaved]="true" />
                </div>
                <textarea class="ed-textarea mt-4" rows="5"
                          placeholder="Tell customers about your company…"
                          [disabled]="!store.canEdit()"
                          [ngModel]="store.form().description"
                          (ngModelChange)="store.patch({ description: $event })"
                          (blur)="store.saveSection('about')"></textarea>
              </div>

              <!-- Branding — cover + logo, under About Us. The drawers ride WITH
                   it so their (empty) hosts don't add stray gaps. -->
              @if (store.profile.value(); as org) {
                <div>
                <div class="ed-card p-6">
                  <h2 class="bp-card-title">Branding</h2>
                  <div class="mt-4">
                  <app-org-media
                    mode="edit"
                    show="banner"
                    [canEdit]="store.canEdit()"
                    [name]="org.name"
                    [subtitle]="org.description ?? ''"
                    [coverUrl]="org.coverImageUrl"
                    [logoUrl]="org.logoUrl"
                    [images]="org.images"
                    (editCover)="store.coverDrawer.set(true)"
                    (editLogo)="store.logoDrawer.set(true)"
                  />
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
                  <label class="block"><span class="ed-label mb-1.5 block">Organisation name</span>
                    <input class="ed-input" [disabled]="!store.canEdit()" [ngModel]="store.form().name" (ngModelChange)="store.patch({ name: $event })" (blur)="store.saveSection('org')" /></label>
                  <label class="block"><span class="ed-label mb-1.5 block">Company number</span>
                    <input class="ed-input" [disabled]="!store.canEdit()" [ngModel]="store.form().companyNumber" (ngModelChange)="store.patch({ companyNumber: $event })" (blur)="store.saveSection('org')" /></label>
                  <label class="block"><span class="ed-label mb-1.5 block">City</span>
                    <input class="ed-input" [disabled]="!store.canEdit()" [ngModel]="store.form().city" (ngModelChange)="store.patch({ city: $event })" (blur)="store.saveSection('org')" /></label>
                  <label class="block"><span class="ed-label mb-1.5 block">Country</span>
                    <select class="ed-select" [disabled]="!store.canEdit()" [ngModel]="store.form().country" (ngModelChange)="store.patch({ country: $event }); store.saveSection('org')">
                      <option value="">—</option>
                      @for (o of store.countryOptions(); track o.value) { <option [value]="o.value">{{ o.label }}</option> }
                    </select></label>
                  <label class="block sm:col-span-2"><span class="ed-label mb-1.5 block">Address</span>
                    <input class="ed-input" [disabled]="!store.canEdit()" [ngModel]="store.form().address" (ngModelChange)="store.patch({ address: $event })" (blur)="store.saveSection('org')" /></label>
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
                    <select class="ed-select" [disabled]="!store.canEdit()" [ngModel]="store.form().currency" (ngModelChange)="store.patch({ currency: $event }); store.saveSection('fin')">
                      @for (o of store.currencyOptions(); track o.value) { <option [value]="o.value">{{ o.label }}</option> }
                    </select></label>
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

  // ── Profile / Shopfront tabs (suppliers only). ────────────────────────────
  protected readonly isSupplier = computed(() => this.auth.user()?.activeOrgType === 'supplier');
  protected readonly tab = signal<'profile' | 'shopfront'>('profile');
  protected readonly tabs: TabBandTab[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'shopfront', label: 'Shopfront' },
  ];
  /** pV2-BUILDUP-04 — file input → upload the T&C PDF, then clear the input. */
  protected onTermsFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void this.store.uploadTerms(file);
    input.value = '';
  }
  protected setTab(key: string): void {
    this.tab.set(key === 'shopfront' ? 'shopfront' : 'profile');
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
