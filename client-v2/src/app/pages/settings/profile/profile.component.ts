import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/auth/auth.service';
import { PageConfigService } from '../../../core/config/page-config.service';
import { EditFieldComponent } from '../../../shared/edit-field/edit-field.component';
import { EditSectionComponent } from '../../../shared/edit-section/edit-section.component';
import { DrawerComponent } from '../../../shared/drawer/drawer.component';
import { ImagePickerComponent } from '../../../shared/image-picker/image-picker.component';
import { OrgMediaComponent } from '../../../shared/org-media/org-media.component';
import { CompletenessCardComponent } from '../../../shared/completeness/completeness-card.component';
import { PageHeroComponent } from '../../../shell/page-hero/page-hero.component';
import { TabBandComponent, TabBandTab } from '../../../shared/tab-band/tab-band.component';
import { ProfileEditService } from './profile-edit.service';
import { ProfileTeamSectionComponent } from './profile-team-section.component';
import { ProfileShopfrontComponent } from './profile-shopfront.component';

/** pV2 Profile — /settings/profile: the REFERENCE consumer of the page-density
 *  <app-edit-section> + <app-edit-field> standard. Two tabs (Profile editor /
 *  Shopfront preview, suppliers only). The org-editing state machine + media
 *  live in ProfileEditService; the Team roster + invite and the Shopfront body
 *  are extracted child components (STORE-01 audit bloat split). This shell owns
 *  the hero, tab band, completeness deep-links, and section layout. */
@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    LucideAngularModule,
    ToastModule,
    PageHeroComponent,
    EditSectionComponent,
    EditFieldComponent,
    DrawerComponent,
    ImagePickerComponent,
    OrgMediaComponent,
    CompletenessCardComponent,
    TabBandComponent,
    ProfileTeamSectionComponent,
    ProfileShopfrontComponent,
  ],
  providers: [MessageService, ProfileEditService],
  host: { class: 'block' },
  template: `
    <app-page-hero align="block" [eyebrow]="hero().eyebrow" [title]="hero().title" [subtitle]="hero().subtitle" />

    <!-- Profile (editable) + Shopfront (consumer view). Suppliers only. -->
    @if (isSupplier()) {
      <div class="flex justify-center px-6 pt-4">
        <app-tab-band [tabs]="tabs" [active]="tab()" (activeChange)="setTab($event)" />
      </div>
    }

    @if (isSupplier() && tab() === 'shopfront') {
      <app-profile-shopfront [orgId]="auth.user()?.activeOrgId ?? ''" />
    } @else {
    <div class="bp-page-body bp-page-body--workspace">
      @if (store.profile.isLoading()) {
        <p class="bp-body-small text-secondary">Loading…</p>
      } @else if (store.profile.error()) {
        <p class="bp-body-small text-warn">Couldn't load your organisation.</p>
      } @else {
        <div class="flex flex-col gap-5">
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

          <!-- Two columns: LEFT = about + company + the rest; RIGHT =
               availability + the image containers (Branding, Gallery). -->
          <div class="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <!-- ── LEFT column ─────────────────────────────────────────── -->
            <div class="flex flex-col gap-5">
              <!-- About Us — the public description blurb (orgs.description). -->
              <app-edit-section
                title="About Us"
                [editable]="store.canEdit()"
                [(editing)]="store.editingAbout"
                [saving]="store.saving()"
                (edit)="store.snapshot('about')"
                (cancelled)="store.restore('about')"
                (save)="store.save('about')"
              >
                @if (store.editingAbout()) {
                  <textarea
                    class="bp-store-textarea"
                    rows="5"
                    [ngModel]="store.form().description"
                    (ngModelChange)="store.patch({ description: $event })"
                    placeholder="Tell customers about your company…"
                  ></textarea>
                } @else {
                  <p class="bp-body whitespace-pre-line text-secondary">{{ store.form().description || '—' }}</p>
                }
              </app-edit-section>

              <div #companySection>
              <app-edit-section
                title="Company Information"
                [editable]="store.canEdit()"
                [(editing)]="store.editingOrg"
                [saving]="store.saving()"
                (edit)="store.snapshot('org')"
                (cancelled)="store.restore('org')"
                (save)="store.save('org')"
              >
                <div class="bp-field-grid-2">
                  <app-edit-field label="Organisation name" density="page" [editing]="store.editingOrg()" [value]="store.form().name" (valueChange)="store.patch({ name: $event })" />
                  <app-edit-field label="Company number" density="page" [editing]="store.editingOrg()" [value]="store.form().companyNumber" (valueChange)="store.patch({ companyNumber: $event })" />
                  <app-edit-field label="City" density="page" [editing]="store.editingOrg()" [value]="store.form().city" (valueChange)="store.patch({ city: $event })" />
                  <app-edit-field label="Country" type="select" density="page" [filter]="true" [options]="store.countryOptions()" [editing]="store.editingOrg()" [value]="store.form().country" (valueChange)="store.patch({ country: $event })" />
                  <app-edit-field label="Address" density="page" [editing]="store.editingOrg()" [value]="store.form().address" (valueChange)="store.patch({ address: $event })" />
                  <app-edit-field label="Email" type="email" density="page" [editing]="store.editingOrg()" [value]="store.form().email" (valueChange)="store.patch({ email: $event })" />
                  <app-edit-field label="Phone" type="tel" density="page" [editing]="store.editingOrg()" [value]="store.form().phone" (valueChange)="store.patch({ phone: $event })" />
                  <app-edit-field label="Project reference prefix" density="page" [maxLength]="4" placeholder="e.g. WA" [editing]="store.editingOrg()" [value]="store.form().refPrefix" (valueChange)="store.patch({ refPrefix: $event.toUpperCase() })" />
                  <app-edit-field label="Projects numbered so far" density="page" [readonlyAlways]="true" [value]="'' + store.refCounter()" />
                </div>
              </app-edit-section>
              </div>

              <app-profile-team-section [canEdit]="store.canEdit()" />

              <app-edit-section
                title="Finance"
                [editable]="store.canEdit()"
                [(editing)]="store.editingFin"
                [saving]="store.saving()"
                (edit)="store.snapshot('fin')"
                (cancelled)="store.restore('fin')"
                (save)="store.save('fin')"
              >
                <div class="bp-field-grid-3">
                  <app-edit-field label="Currency" type="select" density="page" [options]="store.currencyOptions()" [editing]="store.editingFin()" [value]="store.form().currency" (valueChange)="store.patch({ currency: $event })" />
                  <app-edit-field label="VAT" type="number" suffix="%" density="page" [editing]="store.editingFin()" [value]="store.form().vat" (valueChange)="store.patch({ vat: $event })" />
                  <app-edit-field label="Margin" type="number" suffix="%" density="page" [editing]="store.editingFin()" [value]="store.form().margin" (valueChange)="store.patch({ margin: $event })" />
                  <app-edit-field label="Contingency" type="number" suffix="%" density="page" [editing]="store.editingFin()" [value]="store.form().contingency" (valueChange)="store.patch({ contingency: $event })" />
                </div>
              </app-edit-section>

              <!-- pV2-BUILDUP-04 — standard Terms & Conditions PDF (SOW Annex A). -->
              @if (store.profile.value(); as org) {
              <app-edit-section title="Terms &amp; Conditions" [editable]="false">
                <p class="bp-caption">Your standard Terms &amp; Conditions PDF — attached as Annex A on Statements of Work.</p>
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
              </app-edit-section>
              }

              <app-edit-section title="Social Links" [editable]="false">
                <p class="bp-caption">Coming soon.</p>
              </app-edit-section>
              <app-edit-section title="Most Viewed Products This Month" [editable]="false">
                <p class="bp-caption">Coming soon.</p>
              </app-edit-section>
              <app-edit-section title="Payment Information" [editable]="false">
                <p class="bp-caption">Coming soon.</p>
              </app-edit-section>
            </div>

            <!-- ── RIGHT column ────────────────────────────────────────── -->
            <div class="flex flex-col gap-5">
              <app-edit-section title="Availability" [editable]="false">
                <p class="bp-caption">Coming soon.</p>
              </app-edit-section>

              @if (store.profile.value(); as org) {
                <!-- Branding — cover + logo (the same media component the
                     shopfront renders); org-media owns its own editing. The
                     two drawers are wrapped WITH it so their (empty) hosts
                     don't add extra flex gaps before Gallery. -->
                <div>
                <app-edit-section title="Branding" [editable]="false">
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
                </app-edit-section>

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
        this.store.snapshot('org');
        this.store.editingOrg.set(true);
        this.scrollTo(this.companySection());
        break;
    }
  }

  private scrollTo(ref: ElementRef<HTMLElement> | undefined): void {
    ref?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
