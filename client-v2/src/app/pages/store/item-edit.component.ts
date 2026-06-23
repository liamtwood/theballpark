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
  base_price: string;     // "Ballpark cost"
  installed_cost: string; // optional install add-on; stored as max_price = base + install
  lead_time_days: string;
  description: string;
}

/** pV2-STORE-01 — supplier Add/Edit product page (profile-style: image picker +
 *  gallery + edit-field rows). Attributes stack one-per-row on the left; an
 *  Image Approval Process panel sits on the right. Saved products go live
 *  immediately for now (active + approved) — the draft→submit→approve flow is
 *  deferred. "Installed Cost" is the optional install add-on; we store the
 *  installed total (ballpark + install) in max_price (no new column). */
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
        <div class="mx-auto w-full max-w-4xl">
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1.7fr_1fr]">
          <!-- LEFT — item attributes, one per row, in order. -->
          <div class="bp-card p-5">
            <div class="flex flex-col gap-5">
              <app-edit-field label="Product Name" density="page" [editing]="true" [value]="form().name" (valueChange)="patch({ name: $event })" />

              <app-edit-field label="Category" type="select" density="page" [filter]="true" [options]="categoryOptions()" [editing]="true" [value]="form().category_id" (valueChange)="patch({ category_id: $event })" />

              <div>
                <label class="bp-field-label">Main Image</label>
                <div
                  class="bp-item-banner mt-2"
                  role="button"
                  tabindex="0"
                  (click)="imageDrawer.set(true)"
                  (keydown.enter)="imageDrawer.set(true)"
                >
                  @if (imageUrl()) {
                    <img [src]="imageUrl()" alt="" />
                  } @else {
                    <span class="bp-caption">Click to upload main image</span>
                  }
                </div>
                <button type="button" class="bp-btn-outline mt-3" (click)="imageDrawer.set(true)">
                  {{ imageUrl() ? 'Change image' : 'Upload image' }}
                </button>
              </div>

              <div>
                <label class="bp-field-label">Gallery Images</label>
                <div class="mt-2">
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

              <app-edit-field label="Ballpark Cost (£)" type="number" density="page" [editing]="true" [value]="form().base_price" (valueChange)="patch({ base_price: $event })" />

              <div>
                <app-edit-field label="Installed Cost (Optional) (£)" type="number" density="page" [editing]="true" [value]="form().installed_cost" (valueChange)="patch({ installed_cost: $event })" />
                @if (installedLabel()) {
                  <p class="bp-caption mt-1">Installed: {{ installedLabel() }}</p>
                }
              </div>

              <app-edit-field label="Lead Time (days)" type="number" density="page" [editing]="true" [value]="form().lead_time_days" (valueChange)="patch({ lead_time_days: $event })" />

              <div>
                <label class="bp-field-label">Description</label>
                <textarea class="bp-store-textarea mt-1" rows="4" [ngModel]="form().description" (ngModelChange)="patch({ description: $event })" placeholder="Describe the product…"></textarea>
              </div>
            </div>
          </div>

          <!-- RIGHT — Image Approval Process. -->
          <aside class="bp-card p-5 self-start">
            <h3 class="bp-edit-section-title">Image Approval Process</h3>
            <p class="bp-body-small mt-3 text-secondary">
              All images uploaded to Ballpark Marketplace must be reviewed and approved by the Ballpark team.
            </p>
            <p class="bp-body-small mt-3 text-secondary">
              This helps maintain a consistent and high-quality marketplace experience for all users.
            </p>
            <p class="bp-body-small mt-3 text-secondary">
              If you need help preparing your images or listings, please contact the Ballpark team.
            </p>
          </aside>
        </div>

        <div class="mt-6 flex justify-end">
          <button type="button" class="bp-btn-grad" [disabled]="saving()" (click)="save()">
            {{ saving() ? 'Saving…' : 'Save product' }}
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
    /* Main image as a wide cover banner — matches the supplier storefront. */
    .bp-item-banner {
      width: 100%;
      aspect-ratio: 16 / 7;
      border-radius: var(--radius-card);
      overflow: hidden;
      border: 1px solid var(--color-border-hairline);
      background: var(--color-surface);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .bp-item-banner img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
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

  protected readonly itemId = this.route.snapshot.paramMap.get('id');
  protected readonly isEdit = !!this.itemId;

  protected readonly form = signal<ItemForm>({
    name: '', category_id: '', base_price: '', installed_cost: '', lead_time_days: '', description: '',
  });
  protected readonly imageUrl = signal<string | null>(null);
  protected readonly images = signal<GalleryImage[]>([]);
  protected readonly saving = signal(false);
  protected readonly imageDrawer = signal(false);
  protected readonly imageTabs: PickerTab[] = ['upload', 'find'];

  protected readonly heroTitle = computed(() => (this.isEdit ? 'Edit product' : 'Add product'));
  protected readonly heroSubtitle = computed(() =>
    this.isEdit ? 'Update your product details.' : 'Add a product to your store.'
  );

  /** Installed total = ballpark cost + install add-on (the stored max_price). */
  private readonly installedTotal = computed<number | null>(() => {
    const f = this.form();
    if (f.installed_cost === '') return null;
    const base = Number(f.base_price) || 0;
    const install = Number(f.installed_cost) || 0;
    return base + install;
  });
  protected readonly installedLabel = computed(() => {
    const t = this.installedTotal();
    return t === null ? null : '£' + t.toLocaleString('en-GB');
  });

  private readonly categoriesRes = this.api.getResource<CategoryInfo[]>('/api/marketplace/categories');
  protected readonly categoryOptions = computed<EditFieldOption[]>(
    () => (this.categoriesRes.value() ?? []).map((c) => ({ label: c.name, value: c.id }))
  );

  protected readonly itemRes = resource({
    params: () => this.itemId ?? undefined,
    loader: async ({ params }) => {
      const item = await firstValueFrom(this.store.get(params));
      const base = item.base_price != null ? Number(item.base_price) : null;
      const max = item.max_price != null ? Number(item.max_price) : null;
      this.form.set({
        name: item.name ?? '',
        category_id: item.category_id ?? '',
        base_price: base != null ? String(base) : '',
        // Install add-on recovered from the stored installed total.
        installed_cost: max != null ? String(Math.max(0, max - (base ?? 0))) : '',
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

  protected async save(): Promise<void> {
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
      description: f.description.trim() || null,
      base_price: f.base_price === '' ? null : Number(f.base_price),
      // Installed total (ballpark + install) → max_price; null clears it.
      max_price: this.installedTotal(),
      lead_time_days: f.lead_time_days === '' ? null : Number(f.lead_time_days),
      image_url: this.imageUrl(),
      images: this.images(),
    };
    this.saving.set(true);
    try {
      if (this.itemId) {
        await firstValueFrom(this.store.update(this.itemId, body));
      } else {
        await firstValueFrom(this.store.create(body));
      }
      this.toast.add({ severity: 'success', summary: 'Product saved.', life: 3000 });
      const orgId = this.auth.user()?.activeOrgId;
      void this.router.navigate(orgId ? ['/suppliers', orgId] : ['/store']);
    } catch (e) {
      this.toast.add({ severity: 'error', summary: "Couldn't save — please try again.", detail: errorDetail(e), life: 5000 });
    } finally {
      this.saving.set(false);
    }
  }
}
