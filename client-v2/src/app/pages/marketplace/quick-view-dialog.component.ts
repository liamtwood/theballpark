import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { LucideAngularModule } from 'lucide-angular';
import { DialogModule } from 'primeng/dialog';
import { CatalogueItem } from '../../shared/catalogue/catalogue.types';
import { ItemAttributeCardsComponent } from '../../shared/catalogue/item-attribute-cards.component';
import { ItemVariantPickerComponent } from '../../shared/catalogue/item-variant-picker.component';
import { normalizeVariants, allVariantImages } from '../../shared/catalogue/variants.util';

/** Add-to-ballpark payload — the item + the chosen variant (pV2-STORE-VARIANTS-
 *  UPCHARGE-01). `variant` is null when the item has no variants / nothing picked. */
export interface QuickAddEvent {
  id: string;
  variant: { values: Record<string, string>; upcharge: number; label: string } | null;
  /** Quantity chosen in the dialog (≥1). */
  quantity: number;
}

/** pV2 marketplace-redesign — the item Quick View dialog (replaces the right
 *  rail preview). Renders from the already-loaded CatalogueItem: name,
 *  description, cover, category/supplier/location, indicative price, and the
 *  spec sections. Fields not on the marketplace list projection show
 *  "Coming soon" (Liam: attributes should map, any that don't say coming
 *  soon). The supplier-profile swipe/carousel + coachmark are a later pass —
 *  for now a "View supplier profile" link. "Add to ballpark" emits `add`. */
@Component({
  selector: 'app-quick-view-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, RouterLink, LucideAngularModule, DialogModule, ItemAttributeCardsComponent, ItemVariantPickerComponent, MarkdownPipe],
  template: `
    <p-dialog
      [visible]="!!item()"
      (visibleChange)="onVisible($event)"
      styleClass="bp-modal bp-quickview"
      [closable]="true"
      [closeOnEscape]="true"
      [dismissableMask]="true"
      [modal]="true"
      [style]="{ width: '780px', maxWidth: '94vw' }"
    >
      <!-- Templates stay UNCONDITIONAL so PrimeNG's ContentChildren registers
           them (an outer @if hid them → empty dialog); guard inside instead. -->
      <ng-template pTemplate="header">
        @if (item(); as it) {
          <div class="min-w-0">
            <h2 class="bp-card-title">{{ it.name }}</h2>
            @if (it.description) {
              <div class="bp-md bp-body mt-1 text-secondary bp-qv-desc" [class.bp-qv-desc--clamp]="descLong() && !descOpen()" [innerHTML]="it.description | md"></div>
              @if (descLong()) {
                <button type="button" class="bp-qv-morebtn" (click)="descOpen.set(!descOpen())">{{ descOpen() ? 'Show less' : 'Show more' }}</button>
              }
            }
          </div>
        }
      </ng-template>

      @if (item(); as it) {
        <div class="flex flex-col gap-4">
          <!-- Supplier profile (swipe carousel is a later pass). -->
          <a [routerLink]="['/suppliers', it.supplierId]" [queryParams]="{ view: 1 }" class="bp-qv-supplier self-start">
            <span>View supplier profile</span>
            <lucide-icon name="chevron-right" [size]="15" />
          </a>

          <!-- Cover carousel (pV2-STORE-IMAGE-VARIANTS-01): arrows page through the item
               cover + each variant option's image; picking an option jumps to its image
               (does nothing if that option has none). -->
          <div class="bp-qv-imgwrap">
            @if (currentImage(); as cover) {
              <img class="bp-qv-img" [src]="cover" [alt]="it.name" loading="eager" />
            } @else {
              <div class="bp-qv-img bp-qv-img--empty"><lucide-icon name="store" [size]="26" [strokeWidth]="1.5" /></div>
            }
            @if (imageList().length > 1) {
              <button type="button" class="bp-qv-arrow bp-qv-arrow--l" (click)="prevImage()" aria-label="Previous image"><lucide-icon name="chevron-left" [size]="20" /></button>
              <button type="button" class="bp-qv-arrow bp-qv-arrow--r" (click)="nextImage()" aria-label="Next image"><lucide-icon name="chevron-right" [size]="20" /></button>
            }
          </div>

          <div class="flex items-center justify-between gap-3">
            <div class="flex min-w-0 items-center gap-2">
              @if (it.subcategoryName || it.categoryName; as chip) {
                <span class="bp-tag-chip">{{ chip }}</span>
              }
              <span class="bp-meta truncate">{{ it.supplierName }}{{ it.supplierCity ? ' · ' + it.supplierCity : '' }}</span>
            </div>
            @if (it.basePrice !== null && !hasVariants()) {
              <span class="bp-price-large shrink-0">From {{ it.basePrice | currency: 'GBP' : 'symbol' : '1.0-2' }}</span>
            }
          </div>

          <!-- Variant configurator (pV2-STORE-VARIANTS-01) — owns the price when the
               item is a variable product; renders nothing otherwise. The chosen combo
               drives the "Add to ballpark" value below. -->
          <app-item-variant-picker [attributes]="it.attributes ?? null" [basePrice]="it.basePrice" (selectionChange)="chosenCombo.set($event)" (imageChange)="onVariantImage($event)" />

          <!-- pV2-STORE-ATTRIBUTE-GROUPS-01 — KEY: Volume pricing (guide tiers);
               then the shared Options picklist + Show-more spec-group cards. Only
               renders what's present — no "Coming soon" placeholders. -->
          @if (tiers().length) {
            <div class="bp-qv-spec">
              <span class="bp-qv-spec__label"><lucide-icon name="tags" [size]="13" /> Volume pricing</span>
              <dl class="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5">
                @for (t of tiers(); track $index) {
                  <dt class="bp-body-small text-secondary">{{ t.min }}@if (t.max != null) {–{{ t.max }}} @else {+}</dt>
                  <dd class="bp-body-small text-text">£{{ t.price }}</dd>
                }
              </dl>
            </div>
          }
          @if (it.installDescription) {
            <div class="bp-qv-spec">
              <span class="bp-qv-spec__label"><lucide-icon name="wrench" [size]="13" /> Included services</span>
              <p class="bp-qv-spec__val">{{ it.installDescription }}</p>
            </div>
          }

          <app-item-attribute-cards [attributes]="it.attributes ?? null" />

          <p class="bp-caption text-secondary">
            Specs are indicative and confirmed by the supplier when you message them. Ballpark estimates
            are indicative and subject to supplier confirmation, final scope, availability, delivery
            requirements and VAT.
          </p>
        </div>

      }

      <ng-template pTemplate="footer">
        @if (item(); as it) {
          @if (editLink(); as link) {
            <!-- Edit pencil for people with edit rights (owner or platform admin) — the
                 way to reach the editor/approve page from a browse surface (Liam). -->
            <a [routerLink]="link" class="bp-btn-outline" (click)="close.emit()">
              <lucide-icon name="square-pen" [size]="15" /> Edit
            </a>
          }
          @if (showAdd()) {
            <!-- Quantity — enter it here rather than nudging the card stepper (Liam). -->
            <div class="mr-auto flex items-center gap-1.5">
              <span class="bp-field-label">Qty</span>
              <button type="button" class="bp-qty-step" aria-label="Decrease quantity" (click)="stepQty(-1)"><lucide-icon name="minus" [size]="13" /></button>
              <input type="number" min="1" step="1" inputmode="numeric" class="bp-input-field text-center" style="width: 4rem;"
                     [value]="qty()" (input)="setQty($any($event.target).value)" aria-label="Quantity" />
              <button type="button" class="bp-qty-step" aria-label="Increase quantity" (click)="stepQty(1)"><lucide-icon name="plus" [size]="13" /></button>
            </div>
          }
          <button type="button" class="bp-btn-outline" (click)="close.emit()">Close</button>
          @if (showAdd()) {
            @if (needsSelection()) {
              <!-- Variants: force a choice first (Liam) — no blind add-to-cart. -->
              <button type="button" class="bp-btn-grad" disabled>Select options</button>
            } @else {
              <button type="button" class="bp-btn-grad" (click)="emitAdd(it)">
                Add to ballpark@if ((chosenCombo()?.price ?? it.basePrice) !== null) { &nbsp;·&nbsp;{{ (chosenCombo()?.price ?? it.basePrice) | currency: 'GBP' : 'symbol' : '1.0-2' }} }
              </button>
            }
          }
        }
      </ng-template>
    </p-dialog>
  `,
  styles: [
    `
      .bp-qv-supplier {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 14px;
        border: 1px solid var(--color-border-hairline);
        border-radius: var(--radius-pill);
        background: var(--color-surface);
        color: var(--color-text);
        text-decoration: none;
        font-family: var(--font-body);
        font-size: var(--text-sm);
        box-shadow: var(--shadow-md);
      }
      .bp-qv-imgwrap { position: relative; }
      .bp-qv-img {
        width: 100%;
        aspect-ratio: 16 / 10;
        object-fit: cover;
        border-radius: var(--radius-lg);
      }
      .bp-qv-arrow {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: var(--radius-pill);
        background: color-mix(in srgb, var(--color-surface) 88%, transparent);
        color: var(--color-text);
        border: 1px solid var(--color-border-hairline);
        box-shadow: var(--shadow-md);
        cursor: pointer;
      }
      .bp-qv-arrow:hover { background: var(--color-surface); border-color: var(--theme-accent); }
      .bp-qv-arrow--l { left: 10px; }
      .bp-qv-arrow--r { right: 10px; }
      .bp-qv-img--empty {
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--color-fill);
        color: var(--color-text-secondary);
      }
      /* .bp-qv-spec* now live in global styles.css (shared with the item view). */
      /* Block-level markdown (paragraphs, lists) can't clamp with -webkit-line-clamp,
         so cap the height instead — a soft fade would need a mask; a hard cut + Show
         more reads fine for a Quick View header. */
      .bp-qv-desc--clamp {
        max-height: 4.8em;
        overflow: hidden;
      }
      /* Tighten the markdown block so it sits like the old <p> in the header. */
      .bp-qv-desc.bp-md :first-child { margin-top: 0; }
      .bp-qv-desc.bp-md :last-child { margin-bottom: 0; }
      .bp-qv-morebtn {
        margin-top: 4px;
        background: none;
        border: 0;
        padding: 0;
        color: var(--theme-accent);
        font-family: var(--font-body);
        font-size: var(--text-sm);
        font-weight: 500;
        cursor: pointer;
      }
      .bp-qv-morebtn:hover { text-decoration: underline; }
    `,
  ],
})
export class QuickViewDialogComponent {
  readonly item = input<CatalogueItem | null>(null);
  /** Show the "Add to ballpark" action (off when the item is already in a
   *  project's estimate — a read-only quick view). */
  readonly showAdd = input<boolean>(true);
  readonly close = output<void>();
  readonly add = output<QuickAddEvent>();

  /** Assemble the add payload — the item id + the chosen variant (values, per-unit
   *  upcharge relative to base, and a display label), or null variant when none. */
  protected emitAdd(it: CatalogueItem): void {
    const c = this.chosenCombo();
    const base = it.basePrice ?? 0;
    const variant = c
      ? { values: c.values, upcharge: Math.round((c.price - base) * 100) / 100, label: Object.values(c.values).join(' · ') }
      : null;
    this.add.emit({ id: it.id, variant, quantity: this.qty() });
  }

  private readonly auth = inject(AuthService);

  /** Edit destination for viewers with rights (owner → their editor; platform admin →
   *  the org-scoped editor/approve page); null otherwise (no pencil). */
  protected readonly editLink = computed<unknown[] | null>(() => {
    const it = this.item();
    const u = this.auth.user();
    if (!it || !u) return null;
    const owned = u.activeOrgId === it.supplierId;
    if (u.activeOrgType === 'ballpark' && !owned) return ['/admin/orgs', it.supplierId, 'items', it.id];
    if (owned) return ['/store/items', it.id];
    return null;
  });

  /** Volume price tiers (guide pricing) — KEY data shown up top. */
  protected readonly tiers = computed(() => {
    const a = this.item()?.attributes as Record<string, unknown> | null | undefined;
    return (a && Array.isArray(a['price_tiers']) ? a['price_tiers'] : []) as { min: number; max: number | null; price: number }[];
  });

  /** The combo chosen in the variant picker (null until a full combo is picked) —
   *  drives the "Add to ballpark" value. */
  protected readonly chosenCombo = signal<{ values: Record<string, string>; price: number } | null>(null);

  // ── Cover carousel (pV2-STORE-IMAGE-VARIANTS-01) ──────────────────────────────
  /** The item cover + each variant option's image, deduped — what the arrows page. */
  protected readonly imageList = computed(() => {
    const cover = this.item()?.coverUrl ?? null;
    const m = normalizeVariants((this.item()?.attributes as Record<string, unknown> | null)?.['variants']);
    const imgs = [cover, ...allVariantImages(m)].filter((u): u is string => !!u);
    return [...new Set(imgs)];
  });
  protected readonly imgIndex = signal(0);
  protected readonly currentImage = computed(() => this.imageList()[this.imgIndex()] ?? null);
  protected prevImage(): void { const n = this.imageList().length; if (n) this.imgIndex.set((this.imgIndex() - 1 + n) % n); }
  protected nextImage(): void { const n = this.imageList().length; if (n) this.imgIndex.set((this.imgIndex() + 1) % n); }
  /** Picking an option jumps to its image; if it has none, stay put (Liam). */
  protected onVariantImage(img: string | null): void {
    if (!img) return;
    const i = this.imageList().indexOf(img);
    if (i >= 0) this.imgIndex.set(i);
  }

  constructor() {
    // Reset the carousel to the cover whenever the dialog opens on a new item.
    effect(() => { this.item(); this.imgIndex.set(0); });
  }

  /** Quantity to add (pV2-STORE-VARIANTS-UPCHARGE-01 / Liam) — enterable in the
   *  dialog so you can type 100 rather than nudging the card stepper. Resets to 1
   *  when the dialog opens on a new item. */
  protected readonly qty = signal(1);
  protected stepQty(d: number): void { this.qty.set(Math.max(1, this.qty() + d)); }
  protected setQty(v: string): void { const n = Math.floor(Number(v)); this.qty.set(Number.isFinite(n) && n >= 1 ? n : 1); }

  /** Variable product? — the variant picker then owns the price display. */
  protected readonly hasVariants = computed(() => {
    const a = this.item()?.attributes as Record<string, unknown> | null | undefined;
    const v = a && typeof a === 'object' ? (a['variants'] as { combos?: unknown } | undefined) : undefined;
    return !!(v && Array.isArray(v.combos) && v.combos.length);
  });
  /** Has picker DIMENSIONS (incl. free-pick with no combos) — needs a choice before
   *  add-to-quote (Liam: variants → "Select options", never a blind add). */
  protected readonly hasVariantDims = computed(() => {
    const a = this.item()?.attributes as Record<string, unknown> | null | undefined;
    const v = a && typeof a === 'object' ? (a['variants'] as { dimensions?: unknown } | undefined) : undefined;
    return !!(v && Array.isArray(v.dimensions) && v.dimensions.length);
  });
  protected readonly needsSelection = computed(() => this.hasVariantDims() && !this.chosenCombo());

  /** Long descriptions (e.g. a supplier who put the whole page in the body) clamp to a
   *  few lines with a Show more toggle, so the header doesn't swamp the dialog. */
  protected readonly descOpen = signal(false);
  protected readonly descLong = computed(() => (this.item()?.description ?? '').length > 220);

  protected onVisible(visible: boolean): void {
    if (!visible) { this.descOpen.set(false); this.qty.set(1); this.close.emit(); }
  }
}
