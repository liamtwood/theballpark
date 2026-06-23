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

interface ItemForm {
  name: string;
  category_id: string;
  base_price: string;
  lead_time_days: string;
  description: string;
}

/** pV2-STORE-01 — supplier Add/Edit product page. Mirrors /settings/profile:
 *  a Main Image (image-picker in a drawer) + a Gallery (image-gallery) + edit
 *  fields, with Save draft / Submit for approval. New products land as `draft`
 *  (or `pending` on submit), always is_active=false until a ballpark admin
 *  approves. Reached from the supplier's own storefront. */
@Component({
  selector: 'app-item-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [
    FormsModule, ToastModule, PageHeroComponent, EditFieldComponent,
    ImageGalleryComponent, ImagePickerComponent, DrawerComponent,
  ],
  providers: [MessageService],
  template: `
    <app-page-hero [back]="{ label: 'Back to store', href: '/store' }" [title]="heroTitle()" [subtitle]="heroSubtitle()" />

    <div class="bp-page-body">
      @if (loading()) {
        <p class="bp-body-small text-secondary">Loading…</p>
      } @else {
        <div class="bp-settings-body">
          <!-- Product details -->
          <div class="bp-card p-5">
            <h3 class="bp-edit-section-title">Product details</h3>
            <div class="mt-3 bp-field-grid-2">
              <app-edit-field label="Product name" density="page" [editing]="true" [value]="form().name" (valueChange)="patch({ name: $event })" />
              <app-edit-field label="Category" type="select" density="page" [filter]="true" [options]="categoryOptions()" [editing]="true" [value]="form().category_id" (valueChange)="patch({ category_id: $event })" />
              <app-edit-field label="Ballpark cost (£)" type="number" density="page" [editing]="true" [value]="form().base_price" (valueChange)="patch({ base_price: $event })" />
              <app-edit-field label="Lead time (days)" type="number" density="page" [editing]="true" [value]="form().lead_time_days" (valueChange)="patch({ lead_time_days: $event })" />
            </div>
            <div class="mt-4">
              <label class="bp-field-label">Description</label>
              <textarea class="bp-store-textarea mt-1" rows="4" [ngModel]="form().description" (ngModelChange)="patch({ description: $event })" placeholder="Describe the product…"></textarea>
            </div>
          </div>

          <!-- Main image -->
          <div class="bp-card p-5">
            <h3 class="bp-edit-section-title">Main image</h3>
            <div class="mt-3 flex flex-col items-start gap-3">
              <div class="bp-media-preview">
                @if (imageUrl()) {
                  <img [src]="imageUrl()" alt="" />
                } @else {
                  <span class="bp-caption">Click to upload main image</span>
                }
              </div>
              <button type="button" class="bp-btn-outline" (click)="imageDrawer.set(true)">
                {{ imageUrl() ? 'Change image' : 'Upload image' }}
              </button>
            </div>
          </div>

          <!-- Gallery -->
          <div class="bp-card p-5">
            <h3 class="bp-edit-section-title">Gallery images</h3>
            <p class="bp-caption mt-1">Add up to 5 photos.</p>
            <div class="mt-3">
              <app-image-gallery
                entityType="item"
                [images]="images()"
                [primaryUrl]="imageUrl()"
                [searchSeed]="form().name"
                [editable]="true"
                (imagesChange)="images.set($event)"
                (primarySet)="onSetPrimary($event)"
              />
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap items-center justify-end gap-3">
            <button type="button" class="bp-btn-outline" [disabled]="saving()" (click)="save('draft')">
              {{ saving() ? 'Saving…' : 'Save draft' }}
            </button>
            <button type="button" class="bp-btn-grad" [disabled]="saving()" (click)="save('pending')">
              Submit for approval
            </button>
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
  styles: `
    .bp-store-textarea {
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
    .bp-store-textarea:focus-visible {
      outline: 2px solid var(--theme-accent);
      outline-offset: 1px;
    }
  `,
})
export class ItemEditComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly store = inject(StoreItemService);
  private readonly toast = inject(MessageService);

  /** Route :id — absent on /store/items/new. */
  protected readonly itemId = this.route.snapshot.paramMap.get('id');
  protected readonly isEdit = !!this.itemId;

  protected readonly form = signal<ItemForm>({
    name: '', category_id: '', base_price: '', lead_time_days: '', description: '',
  });
  protected readonly imageUrl = signal<string | null>(null);
  protected readonly images = signal<GalleryImage[]>([]);
  protected readonly saving = signal(false);
  protected readonly imageDrawer = signal(false);
  protected readonly imageTabs: PickerTab[] = ['upload', 'find'];

  protected readonly heroTitle = computed(() => (this.isEdit ? 'Edit product' : 'Add product'));
  protected readonly heroSubtitle = computed(() =>
    this.isEdit ? 'Update your product, then save or resubmit.' : 'Add a product to your store.'
  );

  /** Categories for the select (top-level browse categories). */
  private readonly categoriesRes = this.api.getResource<CategoryInfo[]>('/api/marketplace/categories');
  protected readonly categoryOptions = computed<EditFieldOption[]>(
    () => (this.categoriesRes.value() ?? []).map((c) => ({ label: c.name, value: c.id }))
  );

  /** Load the item when editing; blank for a new product. */
  protected readonly itemRes = resource({
    params: () => this.itemId ?? undefined,
    loader: async ({ params }) => {
      const item = await firstValueFrom(this.store.get(params));
      this.form.set({
        name: item.name ?? '',
        category_id: item.category_id ?? '',
        base_price: item.base_price != null ? String(item.base_price) : '',
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

  protected async save(status: 'draft' | 'pending'): Promise<void> {
    const f = this.form();
    if (!f.name.trim()) {
      this.toast.add({ severity: 'warn', summary: 'Product name is required', life: 3000 });
      return;
    }
    if (!f.category_id) {
      this.toast.add({ severity: 'warn', summary: 'Pick a category', life: 3000 });
      return;
    }
    const body: StoreItemWrite = {
      name: f.name.trim(),
      category_id: f.category_id,
      description: f.description.trim() || null,
      base_price: f.base_price === '' ? null : Number(f.base_price),
      lead_time_days: f.lead_time_days === '' ? null : Number(f.lead_time_days),
      image_url: this.imageUrl(),
      images: this.images(),
      approval_status: status,
    };
    this.saving.set(true);
    try {
      if (this.itemId) {
        await firstValueFrom(this.store.update(this.itemId, body));
      } else {
        await firstValueFrom(this.store.create(body));
      }
      this.toast.add({
        severity: 'success',
        summary: status === 'pending' ? 'Submitted for approval.' : 'Draft saved.',
        life: 3000,
      });
      // Back to the supplier's own storefront.
      const orgId = this.auth.user()?.activeOrgId;
      void this.router.navigate(orgId ? ['/suppliers', orgId] : ['/store']);
    } catch (e) {
      this.toast.add({ severity: 'error', summary: "Couldn't save — please try again.", detail: errorDetail(e), life: 5000 });
    } finally {
      this.saving.set(false);
    }
  }
}
