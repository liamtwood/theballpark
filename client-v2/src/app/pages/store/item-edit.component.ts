import {
  ChangeDetectionStrategy, Component, computed, inject, resource, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { errorDetail } from '../../core/http-error';
import { StoreItemService, StoreItemWrite } from '../../core/store/store-item.service';
import { AdminOrgService } from '../../core/admin-org.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { CategoryInfo } from '../../shared/catalogue/catalogue.types';
import { ItemAttributeCardsComponent } from '../../shared/catalogue/item-attribute-cards.component';
import { GalleryImage, PickerResult, PickerTab } from '../../core/media/media.types';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { SaveStatePillComponent, SaveState } from '../../shared/save-state-pill/save-state-pill.component';
import { EditFieldComponent, EditFieldOption } from '../../shared/edit-field/edit-field.component';
import { ImageGalleryComponent } from '../../shared/image-gallery/image-gallery.component';
import { ImagePickerComponent } from '../../shared/image-picker/image-picker.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { ItemApprovalPanelComponent } from './item-approval-panel.component';
import { ItemEditActionsComponent } from './item-edit-actions.component';

interface ItemForm {
  name: string;
  category_id: string;
  subcategory_id: string;      // the DEEPEST chosen node (subcat or sub-subcat)
  unit: string;                // item_unit code (per head / day / each…)
  base_price: string;          // "Ballpark cost"
  install_cost: string;        // installation cost (separate line)
  install_unit: string;        // how install_cost applies (per_item/order/percentage)
  install_description: string; // "Included Services"
  location_coverage: string;   // free text
  lead_time_days: string;
  description: string;
}

/** pV2-STORE-01 — the product page, ONE definition in three modes: supplier
 *  (editable + Save/Submit), ballpark admin (read-only + Approve/Reject), agent
 *  (?view, read-only + Cancel). Attributes left, the Image Approval Process +
 *  Status panel right (app-item-approval-panel). Pricing = base_price + separate
 *  install_cost, plus install_description + location_coverage. */
@Component({
  selector: 'app-item-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [
    FormsModule, LucideAngularModule, ToastModule, DialogModule, PageHeroComponent, EditFieldComponent,
    ImageGalleryComponent, ImagePickerComponent, DrawerComponent, ItemApprovalPanelComponent,
    ItemEditActionsComponent, ItemAttributeCardsComponent, SaveStatePillComponent,
  ],
  providers: [MessageService],
  template: `
    <!-- align="block" + bp-page-body--workspace put the hero, the section header,
         and the form on the SAME --workspace-max column / left edge (project_workspace
         _layout_reference); the old max-w-4xl body used a different width → misaligned. -->
    <app-page-hero align="block" [back]="heroBack()" [title]="heroTitle()" [subtitle]="heroSubtitle()" />

    <div class="bp-page-body bp-page-body--workspace">
      @if (loading()) {
        <p class="bp-body-small text-secondary">Loading…</p>
      } @else if (itemRes.error()) {
        <!-- Cross-org / missing id (the API 404/403s) — don't show a blank form. -->
        <p class="bp-body-small text-warn">This item couldn’t be loaded — it may not exist or isn’t yours to view.</p>
      } @else {
        <div class="w-full">
        <!-- Save-on-blur confirmation (existing items) — the shared pill, like profile. -->
        @if (isEdit && editing() && !isModerator() && !isViewer()) {
          <div class="mb-3 flex justify-end"><app-save-state-pill [state]="saveState()" [idleShowsSaved]="true" /></div>
        }
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1.7fr_1fr]">
          <!-- LEFT — item attributes (one per row) + save actions. -->
          <div>
          <!-- PRIMARY INFORMATION (open by default) — name + category on one line,
               description, cost. Renamed from "Product" (Liam). -->
          <div class="bp-card bp-edit-section" [class.is-collapsed]="!sectionOpen('primary')">
            <button type="button" class="flex w-full items-center justify-between bp-accordion-toggle" (click)="toggleSection('primary')">
              <h3 class="bp-edit-section-title">{{ isModerator() ? 'Review Product' : (isEdit ? 'Primary Information' : 'Add New Product') }}</h3>
              <lucide-icon [name]="sectionOpen('primary') ? 'chevron-down' : 'chevron-right'" [size]="16" class="text-muted" />
            </button>
            @if (sectionOpen('primary')) {
              <div class="mt-4 flex flex-col gap-5">
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <app-edit-field label="Product Name" density="page" [editing]="editing()" [value]="form().name" (valueChange)="patch({ name: $event })" />
                  <app-edit-field label="Category" type="select" density="page" [filter]="true" [options]="categoryOptions()" [editing]="editing()" [value]="form().category_id" (valueChange)="onCategory($event)" />
                </div>
                <div>
                  <label class="bp-field-label">Description</label>
                  <textarea class="bp-store-textarea mt-1" rows="4" [ngModel]="form().description" (ngModelChange)="patch({ description: $event })" [readonly]="!editing()" placeholder="Describe the product…"></textarea>
                </div>
                <div class="bp-qv-spec">
                  <span class="bp-qv-spec__label"><lucide-icon name="wallet" [size]="13" /> Cost</span>
                  <div class="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <app-edit-field [label]="'Ballpark Cost' + currencySuffix()" type="number" density="page" [editing]="editing()" [value]="form().base_price" (valueChange)="patch({ base_price: $event })" />
                    <app-edit-field label="Unit" type="select" density="page" [options]="unitOptions()" [editing]="editing()" [value]="form().unit" (valueChange)="patch({ unit: $event })" />
                  </div>
                </div>
              </div>
            }
          </div>

          <!-- DETAILS (collapsed by default) — the 5 describe-attribute groups. -->
          <div class="bp-card bp-edit-section mt-4" [class.is-collapsed]="!sectionOpen('details')">
            <button type="button" class="flex w-full items-center justify-between bp-accordion-toggle" (click)="toggleSection('details')">
              <h3 class="bp-edit-section-title">Details</h3>
              <lucide-icon [name]="sectionOpen('details') ? 'chevron-down' : 'chevron-right'" [size]="16" class="text-muted" />
            </button>
            @if (sectionOpen('details')) {
              <!-- Location + Lead Time (moved here from Cost, Liam). -->
              <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <app-edit-field label="Location" density="page" [editing]="editing()" [value]="form().location_coverage" (valueChange)="patch({ location_coverage: $event })" placeholder="e.g. London &amp; South East" />
                <app-edit-field label="Lead Time (days)" type="number" density="page" [editing]="editing()" [value]="form().lead_time_days" (valueChange)="patch({ lead_time_days: $event })" />
              </div>
              @if (editing()) {
                <datalist id="measure-suggestions">
                  @for (s of measureSuggestions; track s) { <option [value]="s"></option> }
                </datalist>
                <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  @for (grp of GROUP_DEF; track grp.key) {
                    <div class="bp-qv-spec relative">
                      <span class="bp-qv-spec__label"><lucide-icon [name]="grp.icon" [size]="13" /> {{ grp.title }}</span>
                      <button type="button" class="absolute right-3 top-3 text-secondary hover:text-text" (click)="addRow(grp.key)" aria-label="Add row">
                        <lucide-icon name="plus" [size]="17" />
                      </button>
                      @for (r of groupRows()[grp.key]; track $index) {
                        <div class="mt-1.5 flex items-center gap-2">
                          <input class="bp-input-field flex-1" [attr.list]="grp.key === 'measurements' ? 'measure-suggestions' : null" placeholder="Label"
                                 [value]="r.label" (input)="patchRow(grp.key, $index, 'label', $any($event.target).value)" />
                          <input class="bp-input-field flex-1" placeholder="Value" style="background: var(--color-surface);"
                                 [value]="r.value" (input)="patchRow(grp.key, $index, 'value', $any($event.target).value)" />
                          <button type="button" class="shrink-0 text-muted hover:text-text" (click)="removeRow(grp.key, $index)" aria-label="Remove row">
                            <lucide-icon name="trash-2" [size]="15" />
                          </button>
                        </div>
                      }
                    </div>
                  }
                </div>
              } @else {
                <div class="mt-4"><app-item-attribute-cards [attributes]="rawAttributes()" /></div>
              }
            }
          </div>

          <!-- INSTALLATION (collapsed by default) — its own section (Liam). -->
          <div class="bp-card bp-edit-section mt-4" [class.is-collapsed]="!sectionOpen('installation')">
            <button type="button" class="flex w-full items-center justify-between bp-accordion-toggle" (click)="toggleSection('installation')">
              <h3 class="bp-edit-section-title">Installation</h3>
              <lucide-icon [name]="sectionOpen('installation') ? 'chevron-down' : 'chevron-right'" [size]="16" class="text-muted" />
            </button>
            @if (sectionOpen('installation')) {
              <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <app-edit-field [label]="'Install Cost' + currencySuffix()" type="number" density="page" [editing]="editing()" [value]="form().install_cost" (valueChange)="patch({ install_cost: $event })" />
                <app-edit-field label="Unit" type="select" density="page" [options]="installUnitOptions" [editing]="editing()" [value]="form().install_unit" (valueChange)="patch({ install_unit: $event })" />
              </div>
              <div class="mt-4">
                <label class="bp-field-label">Included services</label>
                <textarea class="bp-store-textarea mt-1" rows="3" [ngModel]="form().install_description" (ngModelChange)="patch({ install_description: $event })" [readonly]="!editing()" placeholder="What the install covers…"></textarea>
              </div>
            }
          </div>

          <!-- pV2-STORE-TAXONOMY-01 — Volume pricing + Options as their OWN section
               (Liam), separate from the 5 describe-groups. Editing only; the
               read-only view renders them via app-item-attribute-cards below. -->
          @if (editing()) {
            <div class="bp-card bp-edit-section mt-4" [class.is-collapsed]="!sectionOpen('extras')">
              <button type="button" class="flex w-full items-center justify-between bp-accordion-toggle" (click)="toggleSection('extras')">
                <h3 class="bp-edit-section-title">Volume pricing &amp; Options</h3>
                <lucide-icon [name]="sectionOpen('extras') ? 'chevron-down' : 'chevron-right'" [size]="16" class="text-muted" />
              </button>
              @if (sectionOpen('extras')) {
              <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <!-- Volume pricing — preview + edit-in-dialog -->
                <div class="bp-qv-spec">
                  <span class="bp-qv-spec__label"><lucide-icon name="tags" [size]="13" /> Volume pricing</span>
                  @if (filledTiers().length) {
                    <dl class="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
                      @for (t of filledTiers().slice(0, 3); track $index) {
                        <dt class="bp-body-small text-secondary">{{ t.min || '1' }}@if (t.max !== '' && t.max != null) {–{{ t.max }}} @else {+}</dt>
                        <dd class="bp-body-small text-text">£{{ t.price }}</dd>
                      }
                    </dl>
                    @if (filledTiers().length > 3) { <p class="bp-caption text-secondary mt-1">+{{ filledTiers().length - 3 }} more</p> }
                  } @else {
                    <p class="bp-qv-spec__val bp-qv-spec__val--soon">No volume pricing</p>
                  }
                  <button type="button" class="bp-btn-outline bp-body-small mt-2" (click)="openVolumeDialog()">
                    <lucide-icon name="pencil" [size]="14" /> Edit volume pricing
                  </button>
                </div>

                <!-- Options — preview + edit-in-dialog -->
                <div class="bp-qv-spec">
                  <span class="bp-qv-spec__label"><lucide-icon name="list" [size]="13" /> Options</span>
                  @if (filledOptions().length) {
                    <dl class="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
                      @for (o of filledOptions().slice(0, 3); track $index) {
                        <dt class="bp-body-small text-secondary">{{ o.name }}</dt>
                        <dd class="bp-body-small text-text">{{ o.price ? ('+£' + o.price) : 'included' }}</dd>
                      }
                    </dl>
                    @if (filledOptions().length > 3) { <p class="bp-caption text-secondary mt-1">+{{ filledOptions().length - 3 }} more</p> }
                  } @else {
                    <p class="bp-qv-spec__val bp-qv-spec__val--soon">No options</p>
                  }
                  <button type="button" class="bp-btn-outline bp-body-small mt-2" (click)="openOptionsDialog()">
                    <lucide-icon name="pencil" [size]="14" /> Edit options
                  </button>
                </div>
              </div>
              }
            </div>
          }

          <!-- pV2-STORE-TAXONOMY-01 — Classification (collapsed by default) above the
               action buttons (Liam): Category cascade → Subcategory → Sub-subcategory. -->
          @if (isEdit) {
            <div class="bp-card bp-edit-section mt-4" [class.is-collapsed]="!sectionOpen('classification')">
              <button type="button" class="flex w-full items-center justify-between bp-accordion-toggle" (click)="toggleSection('classification')">
                <h3 class="bp-edit-section-title">Classification</h3>
                <lucide-icon [name]="sectionOpen('classification') ? 'chevron-down' : 'chevron-right'" [size]="16" class="text-muted" />
              </button>
              @if (sectionOpen('classification')) {
              <div class="mt-3">
                @if (editing()) {
                  <!-- Classify: cascade under the chosen Category — Subcategory, then
                       Sub-subcategory when the picked subcategory has children. The
                       DEEPEST pick is stored as subcategory_id. -->
                  <app-edit-field label="Subcategory" type="select" density="page" [filter]="true"
                    [options]="subL2Options()" [editing]="true" [value]="subL2()" (valueChange)="onSubL2($event)" />
                  @if (subL3Options().length) {
                    <div class="mt-3">
                      <app-edit-field label="Sub-subcategory" type="select" density="page" [filter]="true"
                        [options]="subL3Options()" [editing]="true" [value]="subL3()" (valueChange)="onSubL3($event)" />
                    </div>
                  }
                  @if (subcategoryLabel(); as sc) { <div class="bp-caption text-muted mt-2">Currently: {{ sc }}</div> }
                } @else {
                  <div class="bp-field-label">Subcategory</div>
                  @if (subcategoryLabel(); as sc) {
                    <div class="bp-body-small text-text">{{ sc }}</div>
                  } @else {
                    <div class="bp-body-small text-muted">Not yet classified</div>
                  }
                }
              </div>
              <div class="mt-3">
                <div class="bp-field-label">Tags</div>
                @if (classificationTags().length) {
                  <div class="mt-1 flex flex-col gap-2">
                    @for (g of classificationTags(); track g.dimension) {
                      <div class="flex flex-wrap items-baseline gap-1.5">
                        <span class="bp-caption w-20 shrink-0 text-muted">{{ g.dimension }}</span>
                        @for (label of g.labels; track label) {
                          <span class="bp-tag-chip">{{ label }}</span>
                        }
                      </div>
                    }
                  </div>
                } @else {
                  <div class="bp-body-small text-muted">No tags</div>
                }
              </div>
              }
            </div>
          }

          <app-item-edit-actions
            [autosave]="isEdit"
            [isModerator]="isModerator()" [isViewer]="isViewer()" [isApproved]="isApproved()"
            [currentStatus]="currentStatus()" [deciding]="deciding()" [saving]="saving()"
            [canDelete]="canDelete()" [deleting]="deleting()"
            (approve)="decide('approve')" (reject)="decide('reject')" (cancel)="cancel()"
            (saveApproved)="saveApproved()" (saveDraft)="save('draft')" (submit)="save('pending')"
            (cancelRequest)="cancelRequest()" (deleteRequested)="onDelete()" />
          </div>

          <!-- pV2-STORE-ITEM-EDIT-LAYOUT-01 — images live in the right column beside
               the Image Approval Process (moved out of the left to gain room):
               main image large on top, gallery thumbnails below to review. -->
          <div class="bp-card bp-edit-section self-start" [class.is-collapsed]="!sectionOpen('images')">
            <button type="button" class="flex w-full items-center justify-between bp-accordion-toggle" (click)="toggleSection('images')">
              <h3 class="bp-edit-section-title">Images</h3>
              <lucide-icon [name]="sectionOpen('images') ? 'chevron-down' : 'chevron-right'" [size]="16" class="text-muted" />
            </button>
            @if (sectionOpen('images')) {
              <label class="bp-field-label mt-4 block">Main Image</label>
              <div
                class="bp-item-banner mt-2"
                [class.bp-item-banner--readonly]="!canEditPhotos()"
                [attr.role]="canEditPhotos() ? 'button' : null"
                [attr.tabindex]="canEditPhotos() ? 0 : null"
                (click)="canEditPhotos() && imageDrawer.set(true)"
                (keydown.enter)="canEditPhotos() && imageDrawer.set(true)"
              >
                @if (imageUrl()) {
                  <img [src]="imageUrl()" alt="" />
                } @else {
                  <span class="bp-caption">{{ canEditPhotos() ? 'Click to upload main image' : 'No image' }}</span>
                }
              </div>
              @if (editing() && isApproved()) {
                <p class="bp-caption mt-1 text-secondary">Photos are locked on approved items — duplicate to change them.</p>
              }
              <label class="bp-field-label mt-4 block">Gallery Images</label>
              <div class="mt-2">
                <app-image-gallery
                  entityType="item"
                  [images]="images()"
                  [primaryUrl]="imageUrl()"
                  [searchSeed]="form().name"
                  [editable]="canEditPhotos()"
                  [columns]="4"
                  [tileAspect]="'1 / 1'"
                  [maxSlots]="4"
                  (imagesChange)="onImagesChange($event)"
                  (primarySet)="onSetPrimary($event)"
                />
              </div>
              <!-- Image Approval Process copy + status, under the gallery (Liam). -->
              <div class="mt-5 border-t border-hairline pt-4">
                <app-item-approval-panel [status]="currentStatus()" [statusAt]="statusAt()" />
              </div>
            }
          </div>
        </div>
        </div>

        <!-- pV2-BUILDUP-03 — the supplier-side "Options & build-up" (Customize)
             entry is intentionally hidden for now (kept simple for the demo).
             The composition code + endpoints remain; only this entry is removed. -->
      }
    </div>

    <app-drawer [(open)]="imageDrawer" title="Main image">
      <app-image-picker
        entityType="item"
        [enabledTabs]="imageTabs"
        [focalStep]="false"
        [searchSeed]="form().name"
        [currentImageUrl]="imageUrl()"
        previewAspect="4/3"
        (chosen)="onPickImage($event)"
        (removed)="onRemoveImage()"
        (cancelled)="imageDrawer.set(false)"
      />
    </app-drawer>

    <!-- pV2-STORE-ATTRIBUTE-GROUPS-01 — Volume pricing add/edit (Ballpark dialog,
         bp-modal — same styling as the quick-view dialog). Edits a draft; Done
         commits, Cancel discards. -->
    <p-dialog [visible]="volumeDialogOpen()" (visibleChange)="onVolumeVisible($event)"
      styleClass="bp-modal" [modal]="true" [closable]="true" [dismissableMask]="true"
      [style]="{ width: '540px', maxWidth: '94vw' }">
      <ng-template pTemplate="header"><h2 class="bp-card-title">Volume pricing</h2></ng-template>
      <div class="flex flex-col gap-2">
        <div class="grid grid-cols-[1fr_1fr_1fr_28px] gap-2">
          <span class="bp-caption text-muted">Min qty</span>
          <span class="bp-caption text-muted">Max qty</span>
          <span class="bp-caption text-muted">Unit price £</span><span></span>
        </div>
        @for (t of volumeDraft(); track $index) {
          <div class="grid grid-cols-[1fr_1fr_1fr_28px] items-center gap-2">
            <input type="number" class="bp-input-field" placeholder="1" [value]="t.min" (input)="patchDraftTier($index, 'min', $any($event.target).value)" />
            <input type="number" class="bp-input-field" placeholder="∞" [value]="t.max" (input)="patchDraftTier($index, 'max', $any($event.target).value)" />
            <input type="number" class="bp-input-field" placeholder="0.00" [value]="t.price" (input)="patchDraftTier($index, 'price', $any($event.target).value)" />
            <button type="button" class="text-muted hover:text-text" (click)="removeDraftTier($index)" aria-label="Remove tier"><lucide-icon name="trash-2" [size]="16" /></button>
          </div>
        }
        <button type="button" class="bp-btn-outline bp-body-small self-start" (click)="addDraftTier()"><lucide-icon name="plus" [size]="14" /> Add tier</button>
      </div>
      <ng-template pTemplate="footer">
        <button type="button" class="bp-btn-outline" (click)="cancelVolumeDialog()">Cancel</button>
        <button type="button" class="bp-btn-grad" (click)="saveVolumeDialog()">Done</button>
      </ng-template>
    </p-dialog>

    <!-- Options add/edit (name + additive £ delta). -->
    <p-dialog [visible]="optionsDialogOpen()" (visibleChange)="onOptionsVisible($event)"
      styleClass="bp-modal" [modal]="true" [closable]="true" [dismissableMask]="true"
      [style]="{ width: '540px', maxWidth: '94vw' }">
      <ng-template pTemplate="header"><h2 class="bp-card-title">Options</h2></ng-template>
      <div class="flex flex-col gap-2">
        <div class="grid grid-cols-[2fr_1fr_28px] gap-2">
          <span class="bp-caption text-muted">Option name</span>
          <span class="bp-caption text-muted">+ £ delta</span><span></span>
        </div>
        @for (o of optionsDraft(); track $index) {
          <div class="grid grid-cols-[2fr_1fr_28px] items-center gap-2">
            <input class="bp-input-field" placeholder="e.g. Medium Orange" [value]="o.name" (input)="patchDraftOption($index, 'name', $any($event.target).value)" />
            <input type="number" class="bp-input-field" placeholder="0.00" [value]="o.price" (input)="patchDraftOption($index, 'price', $any($event.target).value)" />
            <button type="button" class="text-muted hover:text-text" (click)="removeDraftOption($index)" aria-label="Remove option"><lucide-icon name="trash-2" [size]="16" /></button>
          </div>
        }
        <button type="button" class="bp-btn-outline bp-body-small self-start" (click)="addDraftOption()"><lucide-icon name="plus" [size]="14" /> Add option</button>
      </div>
      <ng-template pTemplate="footer">
        <button type="button" class="bp-btn-outline" (click)="cancelOptionsDialog()">Cancel</button>
        <button type="button" class="bp-btn-grad" (click)="saveOptionsDialog()">Done</button>
      </ng-template>
    </p-dialog>

    <p-toast position="bottom-right" styleClass="bp-toast" />
  `,
})
export class ItemEditComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly store = inject(StoreItemService);
  private readonly admin = inject(AdminOrgService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(MessageService);

  protected readonly itemId = this.route.snapshot.paramMap.get('id');
  protected readonly isEdit = !!this.itemId;

  /** pV2-ADMIN-ORG-ITEM-CREATE-01 — admin editing ANOTHER org's item, scoped by
   *  the /admin/orgs/:orgId/items route param. When set, load/save go through the
   *  admin org-scoped endpoints and the page is a normal editor (not moderation). */
  protected readonly targetOrgId = this.route.snapshot.paramMap.get('orgId');

  /** Moderation mode — a ballpark admin REVIEWING someone's item (Approve/Reject,
   *  read-only). NOT the admin-create/edit route (targetOrgId) — that's a normal
   *  editor. Suppliers never see either. */
  protected readonly isModerator = computed(
    () => !this.targetOrgId && this.auth.user()?.activeOrgType === 'ballpark'
  );
  /** Pure view (read-only, Cancel only) — opened with ?view=1 (e.g. an agent
   *  from the marketplace). Ownership-agnostic: the entry point signals intent,
   *  so a supplier viewing someone else's item lands here too. Moderator wins. */
  private readonly viewParam = this.route.snapshot.queryParamMap.get('view') === '1';
  protected readonly isViewer = computed(() => this.viewParam && !this.isModerator());
  /** Fields are editable for the owning supplier (incl. approved items —
   *  Liam 2026-07-08: approved items CAN be edited). Moderators/viewers are
   *  read-only. */
  protected readonly editing = computed(
    () => !this.isModerator() && !this.isViewer()
  );
  /** Photos are the one exception: you can't ADD/change photos on an approved
   *  (live) item — new images need moderation. Editable only on non-approved. */
  protected readonly canEditPhotos = computed(() => this.editing() && !this.isApproved());
  protected readonly deciding = signal(false);
  /** Delete shows for the OWNER (own item) and the PLATFORM ADMIN via the admin-
   *  edit route (targetOrgId) — never the review route (moderator) or a viewer. */
  protected readonly canDelete = computed(() => this.isEdit && !this.isViewer() && !this.isModerator());
  protected readonly deleting = signal(false);

  protected readonly form = signal<ItemForm>({
    name: '', category_id: '', subcategory_id: '', unit: '', base_price: '', install_cost: '', install_unit: '',
    install_description: '', location_coverage: '', lead_time_days: '', description: '',
  });
  protected readonly imageUrl = signal<string | null>(null);
  protected readonly images = signal<GalleryImage[]>([]);
  protected readonly saving = signal(false);
  protected readonly imageDrawer = signal(false);
  protected readonly imageTabs: PickerTab[] = ['upload', 'find'];

  // pV2-STORE-ATTRIBUTE-GROUPS-01 — the 5 canonical descriptive groups (fixed
  // order + keys), each editable as [{label,value}] rows. `rawAttributes` keeps
  // the keys we don't manage (options, _source, price_tiers) across save.
  readonly GROUP_DEF: { key: string; title: string; icon: string }[] = [
    { key: 'measurements', title: 'Measurements', icon: 'ruler' },
    { key: 'materials', title: 'Materials', icon: 'package' },
    { key: 'style', title: 'Style', icon: 'palette' },
    { key: 'features', title: 'Features', icon: 'sparkles' },
    { key: 'specifications', title: 'Specifications', icon: 'info' },
  ];
  protected readonly groupRows = signal<Record<string, { label: string; value: string }[]>>({
    specifications: [], features: [], style: [], measurements: [], materials: [],
  });
  protected readonly priceTiers = signal<{ min: string; max: string; price: string }[]>([]);
  protected readonly optionsRows = signal<{ name: string; price: string }[]>([]);
  protected readonly rawAttributes = signal<Record<string, unknown>>({});
  protected readonly measureSuggestions = ['Height', 'Width', 'Depth', 'Weight', 'Seat Height', 'Volume', 'Material'];

  /** Rows with BOTH a label and a value, for one group — what saves on submit. */
  protected filledFor(key: string): { label: string; value: string }[] {
    return (this.groupRows()[key] ?? []).filter((r) => r.label.trim() !== '' && r.value.trim() !== '');
  }

  // ── Group row editing (generic across the 5 groups) ──────────────────────
  protected addRow(key: string): void {
    this.groupRows.update((g) => {
      const rows = g[key] ?? [];
      // Measurements' first Add seeds the 4 common labels (fill-in-the-blanks).
      const next = key === 'measurements' && rows.length === 0
        ? ['Height', 'Width', 'Depth', 'Weight'].map((label) => ({ label, value: '' }))
        : [...rows, { label: '', value: '' }];
      return { ...g, [key]: next };
    });
    this.scheduleSave();
  }
  protected removeRow(key: string, i: number): void {
    this.groupRows.update((g) => ({ ...g, [key]: (g[key] ?? []).filter((_, x) => x !== i) }));
    this.scheduleSave();
  }
  protected patchRow(key: string, i: number, field: 'label' | 'value', val: string): void {
    this.groupRows.update((g) => ({ ...g, [key]: (g[key] ?? []).map((r, x) => (x === i ? { ...r, [field]: val } : r)) }));
    this.scheduleSave();
  }

  /** The 5 groups as filled [{label,value}] arrays — written to attributes on save. */
  private filledGroups(): Record<string, { label: string; value: string }[]> {
    const out: Record<string, { label: string; value: string }[]> = {};
    for (const { key } of this.GROUP_DEF) out[key] = this.filledFor(key);
    return out;
  }

  /** rawAttributes minus the keys the editors rewrite (legacy `dimensions`, the 5
   *  groups, `options`, `price_tiers`) — keeps _source + anything else untouched. */
  private strippedRawAttributes(): Record<string, unknown> {
    const { dimensions: _legacy, specifications: _s, features: _f, style: _st,
      measurements: _m, materials: _mt, options: _o, price_tiers: _pt, ...rest } = this.rawAttributes();
    void _legacy; void _s; void _f; void _st; void _m; void _mt; void _o; void _pt;
    return rest;
  }

  /** Current persisted approval status — drives the status pill. A new product
   *  is a draft until first saved. */
  protected readonly currentStatus = computed(() => this.itemRes.value()?.approval_status ?? 'draft');
  /** Approved items are locked from editing (owner duplicates to change). */
  protected readonly isApproved = computed(() => this.currentStatus() === 'approved');

  /** When the current status was last set (best proxy = the row's updated_at,
   *  else created_at). Null for an unsaved product. */
  protected readonly statusAt = computed(() => {
    const item = this.itemRes.value();
    const iso = item?.updated_at ?? item?.created_at;
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  });

  protected readonly heroTitle = computed(() =>
    this.isModerator() ? 'Review product'
    : this.isViewer() || this.isApproved() ? 'Product'
    : this.isEdit ? 'Edit product' : 'Add product'
  );
  protected readonly heroSubtitle = computed(() =>
    this.isModerator() ? 'Approve or reject this submission.'
    : this.isApproved() ? 'Approved — duplicate to make changes.'
    : this.isViewer() ? 'Product details.'
    : this.isEdit ? 'Update your product details.'
    : 'Add a product to your store.'
  );
  /** Moderators + viewers came from the marketplace; suppliers from their store. */
  protected readonly heroBack = computed(() =>
    this.isModerator() || this.isViewer()
      ? { label: 'Back to marketplace', href: '/marketplace' }
      : { label: 'Back to store', href: '/store' }
  );

  /** Currency suffix for the cost labels — the item's currency (defaults to the
   *  supplier's org currency server-side; GBP until a saved value loads). */
  protected readonly currencySuffix = computed(() => {
    const c = this.itemRes.value()?.currency ?? 'GBP';
    const sym = c === 'GBP' ? '£' : c === 'USD' ? '$' : c === 'EUR' ? '€' : c;
    return ` (${sym})`;
  });

  private readonly categoriesRes = this.api.getResource<CategoryInfo[]>('/api/marketplace/categories');
  protected readonly categoryOptions = computed<EditFieldOption[]>(
    () => (this.categoriesRes.value() ?? []).map((c) => ({ label: c.name, value: c.id }))
  );

  // pV2-STORE-TAXONOMY-01 — manual Classify: cascade under the chosen Category.
  // subL2 = the picked subcategory, subL3 = the picked sub-subcategory (shown only
  // when subL2 has children). The DEEPEST pick becomes form.subcategory_id.
  protected readonly subL2 = signal('');
  protected readonly subL3 = signal('');
  protected readonly subL2Options = signal<EditFieldOption[]>([]);
  protected readonly subL3Options = signal<EditFieldOption[]>([]);

  /** Collapsible sections — all minimised by default except Primary Information +
   *  Images (Liam). A key in the set is COLLAPSED. */
  protected readonly collapsed = signal<Set<string>>(new Set(['details', 'installation', 'extras', 'classification']));
  protected sectionOpen(key: string): boolean { return !this.collapsed().has(key); }
  protected toggleSection(key: string): void {
    const next = new Set(this.collapsed());
    next.has(key) ? next.delete(key) : next.add(key);
    this.collapsed.set(next);
  }
  private async childOptions(parentId: string): Promise<EditFieldOption[]> {
    if (!parentId) return [];
    try {
      const kids = await firstValueFrom(this.api.get<CategoryInfo[]>(`/api/marketplace/categories/${parentId}/subcategories`));
      return kids.map((c) => ({ label: c.name, value: c.id }));
    } catch { return []; }
  }
  /** Seed the cascade from a saved classification: fill L2 options for the category,
   *  pre-select L2 (+ load its L3 options) only when subId is a DIRECT child — a
   *  deeper saved value is preserved on the form and shown in the "Currently" line. */
  private async initCascade(categoryId: string, subId: string): Promise<void> {
    this.subL2.set(''); this.subL3.set(''); this.subL2Options.set([]); this.subL3Options.set([]);
    if (!categoryId) return;
    const l2 = await this.childOptions(categoryId);
    this.subL2Options.set(l2);
    if (!subId) return;
    // Direct child (L2 leaf): select it, load its children for the L3 dropdown.
    if (l2.some((o) => o.value === subId)) {
      this.subL2.set(subId);
      this.subL3Options.set(await this.childOptions(subId));
      return;
    }
    // A 3rd-level (L3) saved value: find its parent among the L2 children so both
    // dropdowns reflect the saved classification on reopen (else it looks unsaved).
    for (const node of l2) {
      const kids = await this.childOptions(node.value);
      if (kids.some((k) => k.value === subId)) {
        this.subL2.set(node.value);
        this.subL3Options.set(kids);
        this.subL3.set(subId);
        return;
      }
    }
  }
  /** Category changed (top field): reset the cascade + reload its subcategories. */
  protected async onCategory(categoryId: string): Promise<void> {
    this.patch({ category_id: categoryId, subcategory_id: '' });
    this.subL2.set(''); this.subL3.set(''); this.subL3Options.set([]);
    this.subL2Options.set(await this.childOptions(categoryId));
  }
  protected async onSubL2(id: string): Promise<void> {
    this.subL2.set(id); this.subL3.set(''); this.subL3Options.set([]);
    this.patch({ subcategory_id: id || '' }); // deepest pick so far
    if (id) this.subL3Options.set(await this.childOptions(id));
  }
  protected onSubL3(id: string): void {
    this.subL3.set(id);
    this.patch({ subcategory_id: id || this.subL2() || '' });
  }

  private readonly unitsRes = this.api.getResource<{ code: string; label: string }[]>('/api/codelists/item_unit/values');
  protected readonly unitOptions = computed<EditFieldOption[]>(() => (this.unitsRes.value() ?? []).map((u) => ({ label: u.label, value: u.code })));

  /** How install_cost applies (fixed set — not a codelist). */
  protected readonly installUnitOptions: EditFieldOption[] = [
    { label: 'Per item (× quantity)', value: 'per_item' },
    { label: 'Per order (one-off)', value: 'per_order' },
    { label: 'Percentage of cost', value: 'percentage' },
  ];

  protected readonly itemRes = resource({
    params: () => this.itemId ?? undefined,
    loader: async ({ params }) => {
      // Read path by mode: moderator → admin, viewer → public, owner → own.
      // Mode is read here (NOT in params) on purpose — it's stable for the
      // page's lifetime (role/org switch reloads; ?view re-navigates), so it's
      // intentionally not a reactive dep.
      const item = await firstValueFrom(
        this.targetOrgId ? this.store.getForOrg(this.targetOrgId, params)
        : this.isModerator() ? this.store.getForReview(params)
        : this.isViewer() ? this.store.getPublic(params)
        : this.store.get(params)
      );
      const base = item.base_price != null ? Number(item.base_price) : null;
      const install = item.install_cost != null ? Number(item.install_cost) : null;
      this.form.set({
        name: item.name ?? '',
        category_id: item.category_id ?? '',
        subcategory_id: item.subcategory_id ?? '',
        unit: item.unit ?? '',
        base_price: base != null ? String(base) : '',
        install_cost: install != null ? String(install) : '',
        install_unit: item.install_unit ?? '',
        install_description: item.install_description ?? '',
        location_coverage: item.location_coverage ?? '',
        lead_time_days: item.lead_time_days != null ? String(item.lead_time_days) : '',
        description: item.description ?? '',
      });
      await this.initCascade(item.category_id ?? '', item.subcategory_id ?? '');
      this.imageUrl.set(item.image_url ?? null);
      this.images.set(item.images ?? []);
      // pV2-STORE-ITEM-MEASURE-VOLUME-01 — hydrate the attributes editors.
      const attrs = (item.attributes ?? {}) as Record<string, unknown>;
      this.rawAttributes.set(attrs);
      // pV2-STORE-ATTRIBUTE-GROUPS-01 — hydrate all 5 group editors. Measurements
      // REPLACES the legacy `dimensions` key — alias it so pre-migration items
      // still show (never "No dimensions" for extracted data).
      const nextGroups: Record<string, { label: string; value: string }[]> = {
        specifications: [], features: [], style: [], measurements: [], materials: [],
      };
      for (const { key } of this.GROUP_DEF) {
        let src = Array.isArray(attrs[key]) ? attrs[key] : [];
        if (key === 'measurements' && !src.length && Array.isArray(attrs['dimensions'])) src = attrs['dimensions'];
        nextGroups[key] = (src as { label?: string; value?: string }[]).map((d) => ({ label: d?.label ?? '', value: d?.value ?? '' }));
      }
      this.groupRows.set(nextGroups);
      const tiers = Array.isArray(attrs['price_tiers']) ? (attrs['price_tiers'] as { min?: number; max?: number | null; price?: number }[]) : [];
      this.priceTiers.set(tiers.map((t) => ({
        min: t.min == null ? '' : String(t.min),
        max: t.max == null ? '' : String(t.max),
        price: t.price == null ? '' : String(t.price),
      })));
      const opts = Array.isArray(attrs['options']) ? (attrs['options'] as { name?: string; price?: number }[]) : [];
      this.optionsRows.set(opts.map((o) => ({ name: o.name ?? '', price: o.price == null ? '' : String(o.price) })));
      return item;
    },
  });

  protected readonly loading = computed(() => this.isEdit && this.itemRes.isLoading());

  /** pV2-STORE-ITEM-INDEX-VIEW-01 — read-only classification. Breadcrumb
   *  "{category} › {subcategory}" (or just the subcat), null when unclassified. */
  protected readonly subcategoryLabel = computed(() => {
    const item = this.itemRes.value();
    if (!item?.subcategory_name) return null;
    return item.category_name ? `${item.category_name} › ${item.subcategory_name}` : item.subcategory_name;
  });
  /** Structured dimension tags grouped by dimension (colour/material/…). */
  protected readonly classificationTags = computed(() => {
    const groups = new Map<string, string[]>();
    for (const t of this.itemRes.value()?.item_tags ?? []) {
      if (!groups.has(t.dimension)) groups.set(t.dimension, []);
      groups.get(t.dimension)!.push(t.label);
    }
    return [...groups.entries()].map(([dimension, labels]) => ({ dimension, labels }));
  });

  protected patch(p: Partial<ItemForm>): void {
    this.form.update((f) => ({ ...f, ...p }));
    this.scheduleSave();
  }

  // ── Volume pricing + Options — preview cards + Ballpark-dialog add/edit ───
  protected readonly filledTiers = computed(() => this.priceTiers().filter((t) => String(t.price).trim() !== ''));
  protected readonly filledOptions = computed(() => this.optionsRows().filter((o) => o.name.trim() !== ''));

  protected readonly volumeDialogOpen = signal(false);
  protected readonly optionsDialogOpen = signal(false);
  protected readonly volumeDraft = signal<{ min: string; max: string; price: string }[]>([]);
  protected readonly optionsDraft = signal<{ name: string; price: string }[]>([]);

  // Volume dialog — edits a draft; Done commits to priceTiers, Cancel discards.
  protected openVolumeDialog(): void { this.volumeDraft.set(this.priceTiers().map((t) => ({ ...t }))); this.volumeDialogOpen.set(true); }
  protected cancelVolumeDialog(): void { this.volumeDialogOpen.set(false); }
  protected saveVolumeDialog(): void { this.priceTiers.set(this.volumeDraft().map((t) => ({ ...t }))); this.volumeDialogOpen.set(false); this.scheduleSave(); }
  protected onVolumeVisible(v: boolean): void { if (!v) this.cancelVolumeDialog(); }
  protected addDraftTier(): void { this.volumeDraft.update((d) => [...d, { min: '', max: '', price: '' }]); }
  protected removeDraftTier(i: number): void { this.volumeDraft.update((d) => d.filter((_, x) => x !== i)); }
  protected patchDraftTier(i: number, key: 'min' | 'max' | 'price', val: string): void {
    this.volumeDraft.update((d) => d.map((r, x) => (x === i ? { ...r, [key]: val } : r)));
  }

  // Options dialog — edits a draft; Done commits to optionsRows, Cancel discards.
  protected openOptionsDialog(): void { this.optionsDraft.set(this.optionsRows().map((o) => ({ ...o }))); this.optionsDialogOpen.set(true); }
  protected cancelOptionsDialog(): void { this.optionsDialogOpen.set(false); }
  protected saveOptionsDialog(): void { this.optionsRows.set(this.optionsDraft().map((o) => ({ ...o }))); this.optionsDialogOpen.set(false); this.scheduleSave(); }
  protected onOptionsVisible(v: boolean): void { if (!v) this.cancelOptionsDialog(); }
  protected addDraftOption(): void { this.optionsDraft.update((d) => [...d, { name: '', price: '' }]); }
  protected removeDraftOption(i: number): void { this.optionsDraft.update((d) => d.filter((_, x) => x !== i)); }
  protected patchDraftOption(i: number, key: 'name' | 'price', val: string): void {
    this.optionsDraft.update((d) => d.map((r, x) => (x === i ? { ...r, [key]: val } : r)));
  }

  protected onPickImage(r: PickerResult): void {
    if (r.type === 'image') this.imageUrl.set(r.url);
    this.imageDrawer.set(false);
    this.scheduleSave();
  }
  protected onRemoveImage(): void {
    this.imageUrl.set(null);
    this.imageDrawer.set(false);
    this.scheduleSave();
  }
  protected onSetPrimary(img: GalleryImage): void {
    this.imageUrl.set(img.url);
    this.scheduleSave();
  }
  /** Gallery images changed — persist (save-on-blur). */
  protected onImagesChange(imgs: GalleryImage[]): void {
    this.images.set(imgs);
    this.scheduleSave();
  }

  protected save(status: 'draft' | 'pending'): Promise<void> {
    return this.persist(status, status === 'pending' ? 'Submitted for approval.' : 'Draft saved.');
  }

  /** Owner edits an already-approved item — field changes persist and it stays
   *  live (photos are locked separately). */
  protected saveApproved(): Promise<void> {
    return this.persist('approved', 'Changes saved.');
  }

  /** Supplier withdraws a pending submission — reverts the item to draft so the
   *  approval queue no longer holds it (the Submit button becomes this). */
  protected cancelRequest(): Promise<void> {
    return this.persist('draft', 'Approval request cancelled.');
  }

  /** Cancel out of the view (read-only) page — back where they came from. */
  protected cancel(): void {
    void this.router.navigateByUrl(this.heroBack().href);
  }

  /** The full write body from the form + attribute editors. `status` drives
   *  approval_status (omitted for 'approved' — the server keeps it live). */
  private buildBody(status: 'draft' | 'pending' | 'approved'): StoreItemWrite {
    const f = this.form();
    return {
      name: f.name.trim(),
      category_id: f.category_id,
      subcategory_id: f.subcategory_id || null,
      unit: f.unit || null,
      description: f.description.trim() || null,
      base_price: f.base_price === '' ? null : Number(f.base_price),
      install_cost: f.install_cost === '' ? null : Number(f.install_cost),
      install_unit: f.install_unit || null,
      install_description: f.install_description.trim() || null,
      location_coverage: f.location_coverage.trim() || null,
      lead_time_days: f.lead_time_days === '' ? null : Number(f.lead_time_days),
      image_url: this.imageUrl(),
      images: this.images(),
      attributes: {
        ...this.strippedRawAttributes(),
        ...this.filledGroups(),
        price_tiers: this.priceTiers()
          .filter((t) => String(t.price).trim() !== '')
          .map((t) => ({ min: t.min === '' ? 0 : Number(t.min), max: t.max === '' ? null : Number(t.max), price: Number(t.price) })),
        options: this.optionsRows()
          .filter((o) => o.name.trim() !== '')
          .map((o) => ({ name: o.name.trim(), price: Number(o.price) || 0 })),
      },
      ...(status === 'approved' ? {} : { approval_status: status }),
    };
  }

  private async persist(status: 'draft' | 'pending' | 'approved', successMsg: string): Promise<void> {
    const f = this.form();
    if (!f.name.trim()) {
      this.toast.add({ severity: 'warn', summary: 'Product Name is required', life: 3000 });
      return;
    }
    if (!f.category_id) {
      this.toast.add({ severity: 'warn', summary: 'Pick a category', life: 3000 });
      return;
    }
    const body = this.buildBody(status);
    this.saving.set(true);
    try {
      if (this.targetOrgId) {
        if (this.itemId) await firstValueFrom(this.store.updateForOrg(this.targetOrgId, this.itemId, body));
        else await firstValueFrom(this.store.createForOrg(this.targetOrgId, body));
      } else if (this.itemId) {
        await firstValueFrom(this.store.update(this.itemId, body));
      } else {
        await firstValueFrom(this.store.create(body));
      }
      this.toast.add({ severity: 'success', summary: successMsg, life: 3000 });
      if (this.targetOrgId) {
        void this.router.navigate(['/suppliers', this.targetOrgId], { queryParams: { tab: 'store' } });
      } else {
        const orgId = this.auth.user()?.activeOrgId;
        void this.router.navigate(orgId ? ['/suppliers', orgId] : ['/store']);
      }
    } catch (e) {
      this.toast.add({ severity: 'error', summary: "Couldn't save — please try again.", detail: errorDetail(e), life: 5000 });
    } finally {
      this.saving.set(false);
    }
  }

  // ── Save-on-blur (existing items) — the shared "Details saved" pill, like the
  //    profile pages. Keeps the item's CURRENT status (never auto-submits). New
  //    items (no id) fall back to the explicit Create/Submit buttons. ───────────
  protected readonly saveState = signal<SaveState>('idle');
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  /** Only autosave an EXISTING item being edited by the owner/admin with the
   *  required fields present. */
  private autosaveEligible(): boolean {
    const f = this.form();
    return this.editing() && !!this.itemId && !this.isModerator() && !this.isViewer()
      && !!f.name.trim() && !!f.category_id;
  }
  /** Debounced trigger — call from any edit handler; collapses rapid edits. */
  protected scheduleSave(): void {
    if (!this.autosaveEligible()) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.autosaveNow(), 700);
  }
  private async autosaveNow(): Promise<void> {
    if (!this.autosaveEligible()) return;
    const cs = this.currentStatus();
    const status: 'draft' | 'pending' | 'approved' = cs === 'approved' ? 'approved' : cs === 'pending' ? 'pending' : 'draft';
    const body = this.buildBody(status);
    this.saveState.set('saving');
    try {
      if (this.targetOrgId) await firstValueFrom(this.store.updateForOrg(this.targetOrgId, this.itemId!, body));
      else await firstValueFrom(this.store.update(this.itemId!, body));
      this.saveState.set('saved');
    } catch (e) {
      console.warn('[ItemEdit] autosave failed', e);
      this.saveState.set('error');
    }
  }

  /** Ballpark-admin moderation — approve (publish) or reject (hide), then back
   *  to the approval queue. */
  protected async decide(decision: 'approve' | 'reject'): Promise<void> {
    if (!this.itemId) return;
    this.deciding.set(true);
    try {
      await firstValueFrom(this.store.decide(this.itemId, decision));
      this.toast.add({
        severity: 'success',
        summary: decision === 'approve' ? 'Item approved.' : 'Item rejected.',
        life: 3000,
      });
      void this.router.navigate(['/marketplace'], { queryParams: { status: 'pending' } });
    } catch (e) {
      this.toast.add({ severity: 'error', summary: "Couldn't update — please try again.", detail: errorDetail(e), life: 5000 });
    } finally {
      this.deciding.set(false);
    }
  }

  /** Delete this item (owner → own; platform admin → the targeted org). Confirms
   *  first; server soft-deletes + cascades to option children. Then back to the
   *  supplier Shop grid. */
  protected async onDelete(): Promise<void> {
    if (!this.itemId || this.deleting()) return;
    const ok = await this.confirm.ask({
      title: 'Delete this item?',
      message: "It'll be removed from the shop. This can't be undone here.",
      confirmLabel: 'Delete',
      danger: true,
      icon: 'trash-2',
    });
    if (!ok) return;
    this.deleting.set(true);
    try {
      if (this.targetOrgId) await firstValueFrom(this.admin.deleteForOrg(this.targetOrgId, this.itemId));
      else await firstValueFrom(this.store.remove(this.itemId));
      this.toast.add({ severity: 'success', summary: 'Item deleted.', life: 3000 });
      const orgId = this.targetOrgId || this.auth.user()?.activeOrgId;
      void this.router.navigate(orgId ? ['/suppliers', orgId] : ['/store'], { queryParams: { tab: 'store' } });
    } catch (e) {
      this.toast.add({ severity: 'error', summary: "Couldn't delete — please try again.", detail: errorDetail(e), life: 5000 });
    } finally {
      this.deleting.set(false);
    }
  }
}
