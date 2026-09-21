import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SaveStatePillComponent } from '../../../shared/save-state-pill/save-state-pill.component';
import { DrawerComponent } from '../../../shared/drawer/drawer.component';
import { ImagePickerComponent } from '../../../shared/image-picker/image-picker.component';
import { OrgMediaComponent } from '../../../shared/org-media/org-media.component';
import { SelectComponent, SelectOption } from '../../../shared/select/select.component';
import { ProfileEditService } from './profile-edit.service';

/** pV2-ADMIN-ORG-PROFILE-EDIT-01 — the reusable org-profile EDITOR sections
 *  (About Us · Branding/media · Company Information · Gallery), driven by the
 *  shared ProfileEditService (save-on-blur, "Details saved" pill). Provides its
 *  OWN ProfileEditService instance and targets an org via [orgId]:
 *    - [orgId] set  → admin editing another org (GET/PUT /api/admin/orgs/:id)
 *    - [orgId] unset→ the caller's own org (GET/PUT /api/organisation)
 *  The admin mount deliberately OMITS Team + Finance (owner-only). The owner
 *  /settings/profile keeps its own full layout unchanged (this is the focused,
 *  reuse-the-service branch — Liam's reuse rule — since the owner page interleaves
 *  owner-only sections between these in a fixed order). */
@Component({
  selector: 'app-org-profile-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, ToastModule, SaveStatePillComponent, DrawerComponent,
    ImagePickerComponent, OrgMediaComponent, SelectComponent,
  ],
  providers: [MessageService, ProfileEditService],
  host: { class: 'block' },
  template: `
    @if (store.profile.isLoading()) {
      <p class="bp-body-small text-secondary">Loading…</p>
    } @else if (store.profile.error()) {
      <p class="bp-body-small text-warn">Couldn't load this organisation.</p>
    } @else {
      <div class="mx-auto flex w-full max-w-[var(--workspace-max)] flex-col gap-5">
        <!-- About Us -->
        <div class="ed-card p-6">
          <div class="flex items-center justify-between">
            <h2 class="bp-card-title">About Us</h2>
            <app-save-state-pill [state]="store.saveState()" [idleShowsSaved]="true" />
          </div>
          <textarea class="ed-textarea mt-4" rows="5" placeholder="Tell customers about this company…"
            [disabled]="!store.canEdit()" [ngModel]="store.form().description"
            (ngModelChange)="store.patch({ description: $event })" (blur)="store.saveSection('about')"></textarea>
        </div>

        <!-- Branding — cover + logo -->
        @if (store.profile.value(); as org) {
          <div>
            <div class="ed-card p-6">
              <h2 class="bp-card-title">Branding</h2>
              <div class="mt-4">
                <app-org-media mode="edit" show="banner" [canEdit]="store.canEdit()"
                  [name]="org.name" [subtitle]="org.description ?? ''"
                  [coverUrl]="org.coverImageUrl" [logoUrl]="org.logoUrl" [images]="org.images"
                  (editCover)="store.coverDrawer.set(true)" (editLogo)="store.logoDrawer.set(true)" />
              </div>
            </div>
            <app-drawer [(open)]="store.coverDrawer" title="Cover image">
              <app-image-picker entityType="profile" [enabledTabs]="store.coverTabs" [focalStep]="false"
                [searchSeed]="org.name" [currentImageUrl]="org.coverImageUrl" previewAspect="4/3"
                (chosen)="store.onPickCover($event)" (removed)="store.onRemoveCover()" (cancelled)="store.coverDrawer.set(false)" />
            </app-drawer>
            <app-drawer [(open)]="store.logoDrawer" title="Logo">
              <app-image-picker entityType="profile" [enabledTabs]="store.logoTabs" [focalStep]="false"
                [currentImageUrl]="org.logoUrl" previewAspect="1/1"
                (chosen)="store.onPickLogo($event)" (removed)="store.onRemoveLogo()" (cancelled)="store.logoDrawer.set(false)" />
            </app-drawer>
          </div>
        }

        <!-- Company Information -->
        <div class="ed-card p-6">
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
              <span class="bp-caption text-secondary">Fetch pulls branding + About from the site.</span></label>
            <label class="block"><span class="ed-label mb-1.5 block">Organisation name</span>
              <input class="ed-input" [disabled]="!store.canEdit()" [ngModel]="store.form().name" (ngModelChange)="store.patch({ name: $event })" (blur)="store.saveSection('org')" /></label>
            <label class="block"><span class="ed-label mb-1.5 block">Company number</span>
              <input class="ed-input" [disabled]="!store.canEdit()" [ngModel]="store.form().companyNumber" (ngModelChange)="store.patch({ companyNumber: $event })" (blur)="store.saveSection('org')" /></label>
            <label class="block"><span class="ed-label mb-1.5 block">City</span>
              <input class="ed-input" [disabled]="!store.canEdit()" [ngModel]="store.form().city" (ngModelChange)="store.patch({ city: $event })" (blur)="store.saveSection('org')" /></label>
            <label class="block"><span class="ed-label mb-1.5 block">Country</span>
              <app-select ariaLabel="Country" [filter]="true" [disabled]="!store.canEdit()" [options]="countrySelectOptions()" [value]="store.form().country" (changed)="store.patch({ country: $event }); store.saveSection('org')" /></label>
            <label class="block sm:col-span-2"><span class="ed-label mb-1.5 block">Address</span>
              <input class="ed-input" [disabled]="!store.canEdit()" [ngModel]="store.form().address" (ngModelChange)="store.patch({ address: $event })" (blur)="store.saveSection('org')" /></label>
            <label class="block"><span class="ed-label mb-1.5 block">Email</span>
              <input class="ed-input" type="email" [disabled]="!store.canEdit()" [ngModel]="store.form().email" (ngModelChange)="store.patch({ email: $event })" (blur)="store.saveSection('org')" /></label>
            <label class="block"><span class="ed-label mb-1.5 block">Phone</span>
              <input class="ed-input" type="tel" [disabled]="!store.canEdit()" [ngModel]="store.form().phone" (ngModelChange)="store.patch({ phone: $event })" (blur)="store.saveSection('org')" /></label>
          </div>
        </div>

        <!-- Gallery -->
        @if (store.profile.value(); as org) {
          <app-org-media mode="edit" show="portfolio" [canEdit]="store.canEdit()"
            [name]="org.name" [coverUrl]="org.coverImageUrl" [logoUrl]="org.logoUrl" [images]="org.images"
            (imagesChange)="store.saveImages($event)" (primarySet)="store.setCover($event)" />
        }
      </div>
    }
    <p-toast position="bottom-right" styleClass="bp-toast" />
  `,
})
export class OrgProfileEditComponent {
  /** Target org to edit; unset = the caller's own org (self endpoints). */
  readonly orgId = input<string | null>(null);

  protected readonly store = inject(ProfileEditService);

  protected readonly countrySelectOptions = computed<SelectOption[]>(
    () => [{ value: '', label: '—' }, ...this.store.countryOptions()],
  );

  constructor() {
    // Point the shared state machine at the target org (reactive → reloads).
    effect(() => this.store.targetOrgId.set(this.orgId() || null));
  }
}
