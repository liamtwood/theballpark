import {
  ChangeDetectionStrategy, Component, computed, inject, resource, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { errorDetail } from '../../core/http-error';
import { StoreItemService, StoreItemWrite } from '../../core/store/store-item.service';
import { CategoryInfo } from '../../shared/catalogue/catalogue.types';
import { GalleryImage, PickerResult, PickerTab } from '../../core/media/media.types';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { EditFieldComponent, EditFieldOption } from '../../shared/edit-field/edit-field.component';
import { ImageGalleryComponent } from '../../shared/image-gallery/image-gallery.component';
import { ImagePickerComponent } from '../../shared/image-picker/image-picker.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { ItemApprovalPanelComponent } from './item-approval-panel.component';

interface ItemForm {
  name: string;
  category_id: string;
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
    FormsModule, ToastModule, PageHeroComponent, EditFieldComponent,
    ImageGalleryComponent, ImagePickerComponent, DrawerComponent, ItemApprovalPanelComponent,
  ],
  providers: [MessageService],
  template: `
    <app-page-hero [back]="heroBack()" [title]="heroTitle()" [subtitle]="heroSubtitle()" />

    <div class="bp-page-body">
      @if (loading()) {
        <p class="bp-body-small text-secondary">Loading…</p>
      } @else if (itemRes.error()) {
        <!-- Cross-org / missing id (the API 404/403s) — don't show a blank form. -->
        <p class="bp-body-small text-warn">This item couldn’t be loaded — it may not exist or isn’t yours to view.</p>
      } @else {
        <div class="mx-auto w-full max-w-4xl">
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1.7fr_1fr]">
          <!-- LEFT — item attributes (one per row) + save actions. -->
          <div>
          <div class="bp-card p-5">
            <h3 class="bp-edit-section-title mb-4">{{ isModerator() ? 'Review Product' : (isViewer() || isApproved()) ? 'Product' : (isEdit ? 'Edit Product' : 'Add New Product') }}</h3>
            <div class="flex flex-col gap-5">
              <app-edit-field label="Product Name" density="page" [editing]="editing()" [value]="form().name" (valueChange)="patch({ name: $event })" />

              <app-edit-field label="Category" type="select" density="page" [filter]="true" [options]="categoryOptions()" [editing]="editing()" [value]="form().category_id" (valueChange)="patch({ category_id: $event })" />

              <div>
                <label class="bp-field-label">Main Image</label>
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
              </div>

              <div>
                <label class="bp-field-label">Gallery Images</label>
                <div class="mt-2">
                  <app-image-gallery
                    entityType="item"
                    [images]="images()"
                    [primaryUrl]="imageUrl()"
                    [searchSeed]="form().name"
                    [editable]="canEditPhotos()"
                    (imagesChange)="images.set($event)"
                    (primarySet)="onSetPrimary($event)"
                  />
                </div>
              </div>

              <app-edit-field label="Unit" type="select" density="page" [options]="unitOptions()" [editing]="editing()" [value]="form().unit" (valueChange)="patch({ unit: $event })" />

              <app-edit-field [label]="'Ballpark Cost' + currencySuffix()" type="number" density="page" [editing]="editing()" [value]="form().base_price" (valueChange)="patch({ base_price: $event })" />

              <app-edit-field [label]="'Install Cost (Optional)' + currencySuffix()" type="number" density="page" [editing]="editing()" [value]="form().install_cost" (valueChange)="patch({ install_cost: $event })" />

              <app-edit-field label="Install Cost Applies" type="select" density="page" [options]="installUnitOptions" [editing]="editing()" [value]="form().install_unit" (valueChange)="patch({ install_unit: $event })" />

              <app-edit-field label="Lead Time (days)" type="number" density="page" [editing]="editing()" [value]="form().lead_time_days" (valueChange)="patch({ lead_time_days: $event })" />

              <div>
                <label class="bp-field-label">Description</label>
                <textarea class="bp-store-textarea mt-1" rows="4" [ngModel]="form().description" (ngModelChange)="patch({ description: $event })" [readonly]="!editing()" placeholder="Describe the product…"></textarea>
              </div>

              <app-edit-field label="Location Coverage" density="page" [editing]="editing()" [value]="form().location_coverage" (valueChange)="patch({ location_coverage: $event })" placeholder="e.g. London &amp; South East" />

              <div>
                <label class="bp-field-label">Included Services</label>
                <textarea class="bp-store-textarea mt-1" rows="3" [ngModel]="form().install_description" (ngModelChange)="patch({ install_description: $event })" [readonly]="!editing()" placeholder="What the install covers…"></textarea>
              </div>
            </div>
          </div>

          @if (isModerator()) {
            <!-- View (read-only) — ballpark admins Approve/Reject; everyone Cancels. -->
            <div class="mt-4 flex flex-wrap gap-3">
              <button type="button" class="bp-btn-grad" [disabled]="deciding()" (click)="decide('approve')">
                {{ deciding() ? 'Saving…' : 'Approve' }}
              </button>
              <button type="button" class="bp-btn-outline" [disabled]="deciding()" (click)="decide('reject')">
                {{ deciding() ? 'Saving…' : 'Reject' }}
              </button>
              <button type="button" class="bp-btn-outline" [disabled]="deciding()" (click)="cancel()">
                Cancel
              </button>
            </div>
          } @else if (isViewer()) {
            <!-- Pure viewer (e.g. an agent) — read-only, back out only. -->
            <div class="mt-4 flex flex-wrap gap-3">
              <button type="button" class="bp-btn-outline" (click)="cancel()">Cancel</button>
            </div>
          } @else if (isApproved()) {
            <!-- Owner, approved — editable (fields), photos locked. Stays live. -->
            <div class="mt-4 flex flex-wrap gap-3">
              <button type="button" class="bp-btn-grad" [disabled]="saving()" (click)="saveApproved()">
                {{ saving() ? 'Saving…' : 'Save Changes' }}
              </button>
              <button type="button" class="bp-btn-outline" [disabled]="saving()" (click)="cancel()">Back to store</button>
            </div>
          } @else {
            <div class="mt-4 flex flex-wrap gap-3">
              <button type="button" class="bp-btn-outline" [disabled]="saving()" (click)="save('draft')">
                {{ saving() ? 'Saving…' : 'Save Draft' }}
              </button>
              @if (currentStatus() === 'pending') {
                <!-- Submitted — withdraw the request instead of re-submitting. -->
                <button type="button" class="bp-btn-outline" [disabled]="saving()" (click)="cancelRequest()">
                  {{ saving() ? 'Saving…' : 'Cancel approval request' }}
                </button>
              } @else {
                <button type="button" class="bp-btn-grad" [disabled]="saving()" (click)="save('pending')">
                  {{ saving() ? 'Saving…' : 'Submit for Approval' }}
                </button>
              }
            </div>
          }
          </div>

          <app-item-approval-panel [status]="currentStatus()" [statusAt]="statusAt()" />
        </div>
        </div>
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

    <p-toast position="bottom-right" styleClass="bp-toast" />
  `,
})
export class ItemEditComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly store = inject(StoreItemService);
  private readonly toast = inject(MessageService);

  protected readonly itemId = this.route.snapshot.paramMap.get('id');
  protected readonly isEdit = !!this.itemId;

  /** Moderation mode — a ballpark admin reviewing someone's item. The page is
   *  read-only (Approve/Reject instead of Save). Suppliers never see this. */
  protected readonly isModerator = computed(() => this.auth.user()?.activeOrgType === 'ballpark');
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

  protected readonly form = signal<ItemForm>({
    name: '', category_id: '', unit: '', base_price: '', install_cost: '', install_unit: '',
    install_description: '', location_coverage: '', lead_time_days: '', description: '',
  });
  protected readonly imageUrl = signal<string | null>(null);
  protected readonly images = signal<GalleryImage[]>([]);
  protected readonly saving = signal(false);
  protected readonly imageDrawer = signal(false);
  protected readonly imageTabs: PickerTab[] = ['upload', 'find'];

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

  private readonly unitsRes = this.api.getResource<{ code: string; label: string }[]>('/api/codelists/item_unit/values');
  protected readonly unitOptions = computed<EditFieldOption[]>(
    () => (this.unitsRes.value() ?? []).map((u) => ({ label: u.label, value: u.code }))
  );

  /** How the install cost is applied (fixed set — not a codelist). */
  protected readonly installUnitOptions: EditFieldOption[] = [
    { label: 'Per item (× quantity)', value: 'per_item' },
    { label: 'Per order (one-off)', value: 'per_order' },
    { label: 'Percentage of cost', value: 'percentage' },
  ];

  protected readonly itemRes = resource({
    params: () => this.itemId ?? undefined,
    loader: async ({ params }) => {
      // Pick the read path by mode: moderators read cross-org (admin endpoint),
      // viewers read the public approved item (marketplace endpoint), owners
      // read their own (ownership-gated supplier endpoint).
      // NOTE: mode (isModerator/isViewer) is read here in the loader, NOT in
      // `params` — it is intentionally NOT a reactive dep. Mode is stable for
      // the page's lifetime (a role/org switch reloads the app; toggling ?view
      // re-navigates), so the resource never needs to re-fetch on a mode change.
      const item = await firstValueFrom(
        this.isModerator() ? this.store.getForReview(params)
        : this.isViewer() ? this.store.getPublic(params)
        : this.store.get(params)
      );
      const base = item.base_price != null ? Number(item.base_price) : null;
      const install = item.install_cost != null ? Number(item.install_cost) : null;
      this.form.set({
        name: item.name ?? '',
        category_id: item.category_id ?? '',
        unit: item.unit ?? '',
        base_price: base != null ? String(base) : '',
        install_cost: install != null ? String(install) : '',
        install_unit: item.install_unit ?? '',
        install_description: item.install_description ?? '',
        location_coverage: item.location_coverage ?? '',
        lead_time_days: item.lead_time_days != null ? String(item.lead_time_days) : '',
        description: item.description ?? '',
      });
      this.imageUrl.set(item.image_url ?? null);
      this.images.set(item.images ?? []);
      return item;
    },
  });

  protected readonly loading = computed(() => this.isEdit && this.itemRes.isLoading());

  protected patch(p: Partial<ItemForm>): void {
    this.form.update((f) => ({ ...f, ...p }));
  }

  protected onPickImage(r: PickerResult): void {
    if (r.type === 'image') this.imageUrl.set(r.url);
    this.imageDrawer.set(false);
  }
  protected onRemoveImage(): void {
    this.imageUrl.set(null);
    this.imageDrawer.set(false);
  }
  protected onSetPrimary(img: GalleryImage): void {
    this.imageUrl.set(img.url);
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
    const body: StoreItemWrite = {
      name: f.name.trim(),
      category_id: f.category_id,
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
      // Approved edits don't set a status — the server keeps it approved and
      // the schema only accepts draft|pending anyway.
      ...(status === 'approved' ? {} : { approval_status: status }),
    };
    this.saving.set(true);
    try {
      if (this.itemId) {
        await firstValueFrom(this.store.update(this.itemId, body));
      } else {
        await firstValueFrom(this.store.create(body));
      }
      this.toast.add({ severity: 'success', summary: successMsg, life: 3000 });
      const orgId = this.auth.user()?.activeOrgId;
      void this.router.navigate(orgId ? ['/suppliers', orgId] : ['/store']);
    } catch (e) {
      this.toast.add({ severity: 'error', summary: "Couldn't save — please try again.", detail: errorDetail(e), life: 5000 });
    } finally {
      this.saving.set(false);
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
}
