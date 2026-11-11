import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { StoreItemService } from '../../core/store/store-item.service';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { LucideAngularModule } from 'lucide-angular';
import { DialogModule } from 'primeng/dialog';
import { CatalogueItem } from '../../shared/catalogue/catalogue.types';
import { itemEditLink } from '../../shared/catalogue/item-edit-link';
import { ItemAttributeCardsComponent } from '../../shared/catalogue/item-attribute-cards.component';
import { ItemVariantPickerComponent } from '../../shared/catalogue/item-variant-picker.component';
import { ImageCarouselComponent } from '../../shared/catalogue/image-carousel.component';
import { normalizeVariants, allVariantImages } from '../../shared/catalogue/variants.util';
import { SupplierProfilePaneComponent } from './supplier-profile-pane.component';

/** Add-to-ballpark payload — the item + the chosen variant (pV2-STORE-VARIANTS-
 *  UPCHARGE-01). `variant` is null when the item has no variants / nothing picked. */
export interface QuickAddEvent {
  id: string;
  variant: { values: Record<string, string>; upcharge: number; label: string } | null;
  /** Quantity chosen in the dialog (≥1). */
  quantity: number;
}

type Pane = 'item' | 'supplier';

/** The two demo layouts (Liam 2026-11-10) — 1 = the current single-column view,
 *  2 = the wider two-column view. Persisted per-browser so the pick sticks while
 *  demoing. */
const QV_LAYOUT_KEY = 'bp-qv-layout';
function readStoredLayout(): 1 | 2 {
  try { return localStorage.getItem(QV_LAYOUT_KEY) === '2' ? 2 : 1; } catch { return 1; }
}

/** pV2-STORE-QUICKVIEW-SUPPLIER-01 — the marketplace Quick View, now a TWO-PAGE
 *  overlay: "Item details" and "Supplier profile", switchable by a labelled segmented
 *  control (reusing the `.bp-projnav` pattern — white track / dark selected) AND a
 *  horizontal swipe on touch. The two panes live in a 200%-wide track that
 *  translateX-es between 0 and -50%; both inputs drive one `pane` signal; opening a
 *  new item resets to Item. Page 1 refines the existing item view (eyebrow → title →
 *  description → image carousel → supplier+location → price → variants → spec groups →
 *  Add to ballpark); the item image is plain object-contain on neutral (DECISION 2).
 *  Page 2 is `app-supplier-profile-pane` (cover+logo, name+location, website, markdown
 *  description, "Past projects" gallery). No "Source" field (display-only removal), no
 *  "approved" badge, no store navigation (deferred) — the switcher never routes, so
 *  Marketplace stays mounted behind and closing restores search/filters/scroll. */
@Component({
  selector: 'app-quick-view-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    RouterLink,
    LucideAngularModule,
    DialogModule,
    ItemAttributeCardsComponent,
    ItemVariantPickerComponent,
    ImageCarouselComponent,
    SupplierProfilePaneComponent,
    MarkdownPipe,
  ],
  template: `
    <p-dialog
      [visible]="!!item()"
      (visibleChange)="onVisible($event)"
      styleClass="bp-modal bp-quickview"
      [closable]="true"
      [closeOnEscape]="true"
      [dismissableMask]="true"
      [modal]="true"
      [style]="dialogStyle()"
    >
      <!-- Templates stay UNCONDITIONAL so PrimeNG's ContentChildren registers
           them (an outer @if hid them → empty dialog); guard inside instead. -->
      <!-- The page switcher lives in the header (never scrolls) — a labelled
           segmented control + roving tabindex; arrow keys move between panes. -->
      <ng-template pTemplate="header">
        @if (item(); as it) {
          <div class="bp-qv-head grid w-full items-center gap-3">
            <!-- Supplier context, top-left (Liam 2026-11-10): the supplier's logo
                 (store icon fallback) + name. -->
            <div class="bp-qv-head__supplier flex min-w-0 items-center gap-2">
              @if (it.supplierLogoUrl) {
                <img class="bp-qv-head__logo" [src]="it.supplierLogoUrl" [alt]="it.supplierName" />
              } @else {
                <lucide-icon name="store" [size]="18" class="shrink-0" />
              }
              <span class="truncate">{{ it.supplierName }}</span>
            </div>
            <div class="bp-projnav justify-self-center" role="tablist" aria-label="Quick view pages"
                 (keydown.arrowright)="setPane('supplier', true)"
                 (keydown.arrowleft)="setPane('item', true)">
              <button type="button" role="tab" id="qv-tab-item" class="bp-projnav-opt"
                      [class.bp-projnav-opt--active]="pane() === 'item'"
                      [attr.aria-selected]="pane() === 'item'"
                      [attr.tabindex]="pane() === 'item' ? 0 : -1"
                      aria-controls="qv-pane-item"
                      (click)="setPane('item')">
                @if (pane() === 'item') { <lucide-icon name="check" [size]="15" /> }
                Item details
              </button>
              <button type="button" role="tab" id="qv-tab-supplier" class="bp-projnav-opt"
                      [class.bp-projnav-opt--active]="pane() === 'supplier'"
                      [attr.aria-selected]="pane() === 'supplier'"
                      [attr.tabindex]="pane() === 'supplier' ? 0 : -1"
                      aria-controls="qv-pane-supplier"
                      (click)="setPane('supplier')">
                @if (pane() === 'supplier') { <lucide-icon name="check" [size]="15" /> }
                Supplier profile
              </button>
            </div>
            <!-- Layout picker (Liam 2026-11-10) — flip between two Quick View
                 layouts live to demo to a customer; the choice persists per-browser. -->
            <div class="bp-qv-layout justify-self-end" role="group" aria-label="Quick view layout">
              <button type="button" class="bp-qv-layout__opt" [class.bp-qv-layout__opt--on]="layout() === 1"
                      [attr.aria-pressed]="layout() === 1" title="Layout 1" (click)="setLayout(1)">1</button>
              <button type="button" class="bp-qv-layout__opt" [class.bp-qv-layout__opt--on]="layout() === 2"
                      [attr.aria-pressed]="layout() === 2" title="Layout 2" (click)="setLayout(2)">2</button>
            </div>
          </div>
        }
      </ng-template>

      @if (item(); as it) {
        <div class="bp-qv-viewport"
             (touchstart)="onTouchStart($event)"
             (touchmove)="onTouchMove($event)"
             (touchend)="onTouchEnd()"
             (touchcancel)="onTouchEnd()">
          <div class="bp-qv-track" [class.bp-qv-track--drag]="dragging()"
               [style.transform]="trackTransform()"
               [style.height]="trackH() ? trackH() + 'px' : null">
            <!-- PAGE 1 — Item details. -->
            <section #itemPane class="bp-qv-pane bp-qv-pane--item" role="tabpanel"
                     id="qv-pane-item" aria-labelledby="qv-tab-item"
                     [attr.aria-hidden]="pane() !== 'item' ? 'true' : null"
                     [attr.inert]="pane() !== 'item' ? '' : null">
              @if (layout() === 1) {
              <div class="flex flex-col gap-4">
                <div class="min-w-0">
                  <span class="bp-qv-eyebrow">Quick view</span>
                  <h2 class="bp-card-title mt-0.5">{{ it.name }}</h2>
                  @if (it.description) {
                    <div class="bp-md bp-body mt-1 text-secondary bp-qv-desc" [class.bp-qv-desc--clamp]="descLong() && !descOpen()" [innerHTML]="it.description | md"></div>
                    @if (descLong()) {
                      <button type="button" class="bp-qv-morebtn" (click)="descOpen.set(!descOpen())">{{ descOpen() ? 'Show less' : 'Show more' }}</button>
                    }
                  }
                </div>

                <!-- Item image(s): the cover + each variant option's image, paged by the
                     shared carousel. Plain object-contain on neutral (DECISION 2) — the
                     whole product, no crop, matching the plain card the user clicked.
                     Picking a variant option jumps to its image (via jumpTo). -->
                <app-image-carousel [images]="imageList()" [alt]="it.name" fit="contain" emptyIcon="store" [jumpTo]="variantImg()" />

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
              } @else {
                <!-- LAYOUT 2 (Liam 2026-11-10) — wider two-column: LEFT = name,
                     description, From £, hero photo + rounded thumbnail strip, specs;
                     RIGHT = variant configurator + quantity + Add. -->
                <div class="bp-qv2">
                  <div class="bp-qv2__main min-w-0">
                    <h2 class="bp-qv2__name">{{ it.name }}</h2>
                    @if (it.description) {
                      <div class="bp-md bp-body mt-2 text-secondary" [innerHTML]="it.description | md"></div>
                    }

                    <!-- Hero photo + rounded thumbnails (standard card radius). -->
                    @if (imageList().length) {
                      <img class="bp-qv2__hero mt-3" [src]="heroImage()" [alt]="it.name" />
                      @if (imageList().length > 1) {
                        <div class="bp-qv2__thumbs mt-2">
                          @for (img of imageList(); track img; let i = $index) {
                            <button type="button" class="bp-qv2__thumb" [class.bp-qv2__thumb--on]="heroIdx() === i"
                                    [attr.aria-label]="'Image ' + (i + 1)" (click)="heroIdx.set(i)">
                              <img [src]="img" [alt]="it.name + ' image ' + (i + 1)" />
                            </button>
                          }
                        </div>
                      }
                    } @else {
                      <div class="bp-qv2__hero bp-qv2__hero--empty mt-3 flex items-center justify-center text-secondary">
                        <lucide-icon name="store" [size]="28" [strokeWidth]="1.5" />
                      </div>
                    }

                    @if (tiers().length) {
                      <div class="bp-qv-spec mt-3">
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
                      <div class="bp-qv-spec mt-3">
                        <span class="bp-qv-spec__label"><lucide-icon name="wrench" [size]="13" /> Included services</span>
                        <p class="bp-qv-spec__val">{{ it.installDescription }}</p>
                      </div>
                    }
                    <app-item-attribute-cards [attributes]="it.attributes ?? null" />
                  </div>

                  <div class="bp-qv2__side">
                    <!-- No variants → the picker renders nothing, so show the base
                         price on the right so it's always present (Liam 2026-11-11). -->
                    <!-- Standing base price shows unless PRICED variants own the price
                         (free-choice dimensions like a menu picker don't — Liam 2026-11-11). -->
                    @if (!hasVariants() && it.basePrice !== null) {
                      <div class="bp-price-large">From {{ it.basePrice | currency: 'GBP' : 'symbol' : '1.0-2' }}</div>
                    }
                    <app-item-variant-picker [attributes]="it.attributes ?? null" [basePrice]="it.basePrice"
                                             (selectionChange)="chosenCombo.set($event)" (imageChange)="onVariantImage($event)" />
                    @if (showAdd()) {
                      <div class="bp-qv2__buy">
                        <div class="flex items-center gap-1.5">
                          <span class="bp-field-label">Qty</span>
                          <button type="button" class="bp-qty-step" aria-label="Decrease quantity" (click)="stepQty(-1)"><lucide-icon name="minus" [size]="13" /></button>
                          <input type="number" min="1" step="1" inputmode="numeric" class="bp-input-field text-center" style="width: 4rem;"
                                 [value]="qty()" (input)="setQty($any($event.target).value)" aria-label="Quantity" />
                          <button type="button" class="bp-qty-step" aria-label="Increase quantity" (click)="stepQty(1)"><lucide-icon name="plus" [size]="13" /></button>
                        </div>
                        @if (needsSelection()) {
                          <button type="button" class="bp-btn-grad w-full" disabled>Select options</button>
                        } @else {
                          <button type="button" class="bp-btn-grad w-full" (click)="emitAdd(it)">
                            Add to ballpark@if ((chosenCombo()?.price ?? it.basePrice) !== null) { &nbsp;·&nbsp;{{ (chosenCombo()?.price ?? it.basePrice) | currency: 'GBP' : 'symbol' : '1.0-2' }} }
                          </button>
                        }
                      </div>
                    }
                    <p class="bp-caption text-secondary">
                      Specs are indicative and confirmed by the supplier when you message them. Ballpark estimates
                      are indicative and subject to supplier confirmation, final scope, availability, delivery
                      requirements and VAT.
                    </p>
                  </div>
                </div>
              }
            </section>

            <!-- PAGE 2 — Supplier profile (reads GET /api/marketplace/suppliers/:id). -->
            <section #supplierPane class="bp-qv-pane bp-qv-pane--supplier" role="tabpanel"
                     id="qv-pane-supplier" aria-labelledby="qv-tab-supplier"
                     [attr.aria-hidden]="pane() !== 'supplier' ? 'true' : null"
                     [attr.inert]="pane() !== 'supplier' ? '' : null">
              <app-supplier-profile-pane [supplierId]="it.supplierId" [wide]="layout() === 2" />
            </section>
          </div>
        </div>
      }

      <ng-template pTemplate="footer">
        @if (item(); as it) {
          @if (canManage() && editLink(); as link) {
            <!-- Edit pencil — ONLY in a management surface (My Shop / Approvals), never on
                 the read-only Marketplace browse. Gated by canManage so an admin peeking at
                 a live item from the browse can't jump to the editor (Liam 2026-10-28). -->
            <a [routerLink]="link" class="bp-btn-outline" (click)="close.emit()">
              <lucide-icon name="square-pen" [size]="15" /> Edit
            </a>
          }
          @if (canManage() && canDecide()) {
            <!-- pV2-STORE-APPROVALS-01 — moderator approve/reject (parity with the
                 card queue). Soft green / red (feedback). Server enforces authority. -->
            <button type="button" class="bp-act bp-act--green" [disabled]="busy()" (click)="decide('approve')">
              <lucide-icon name="check" [size]="15" /> Approve
            </button>
            <button type="button" class="bp-act bp-act--red" [disabled]="busy()" (click)="decide('reject')">
              <lucide-icon name="octagon-x" [size]="15" /> Reject
            </button>
          }
          @if (showAdd() && layout() === 1) {
            <!-- Quantity — enter it here rather than nudging the card stepper (Liam).
                 Layout 2 moves Qty + Add into the right column. -->
            <div class="mr-auto flex items-center gap-1.5">
              <span class="bp-field-label">Qty</span>
              <button type="button" class="bp-qty-step" aria-label="Decrease quantity" (click)="stepQty(-1)"><lucide-icon name="minus" [size]="13" /></button>
              <input type="number" min="1" step="1" inputmode="numeric" class="bp-input-field text-center" style="width: 4rem;"
                     [value]="qty()" (input)="setQty($any($event.target).value)" aria-label="Quantity" />
              <button type="button" class="bp-qty-step" aria-label="Increase quantity" (click)="stepQty(1)"><lucide-icon name="plus" [size]="13" /></button>
            </div>
          }
          <button type="button" class="bp-btn-outline" (click)="close.emit()">Close</button>
          @if (showAdd() && layout() === 1) {
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
      /* Two-page switcher (pV2-STORE-QUICKVIEW-SUPPLIER-01). The viewport clips the
         200%-wide track horizontally; touch-action pan-y lets the dialog body scroll
         vertically while we own horizontal swipes. */
      .bp-qv-viewport { overflow: hidden; width: 100%; touch-action: pan-y; }
      .bp-qv-track {
        position: relative;
        width: 200%;
        min-height: 160px;
        transition: transform 0.32s cubic-bezier(0.4, 0, 0.2, 1), height 0.24s ease;
        will-change: transform;
      }
      /* Follow the finger with no animation during an active drag. */
      .bp-qv-track--drag { transition: none; }
      /* Each pane = one viewport width (50% of the 200% track); absolute so the
         inactive (offscreen) pane never adds to the measured height — the track
         height is driven to the ACTIVE pane's height in TS (ResizeObserver). */
      .bp-qv-pane { position: absolute; top: 0; width: 50%; }
      .bp-qv-pane--item { left: 0; }
      .bp-qv-pane--supplier { left: 50%; }
      @media (prefers-reduced-motion: reduce) {
        .bp-qv-track { transition: none; }
      }

      .bp-qv-eyebrow {
        font-size: var(--text-xs);
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-secondary);
      }
      /* .bp-qv-spec* now live in global styles.css (shared with the item view).
         The image carousel chrome moved to app-image-carousel (extract-before-
         duplicate — shared with the supplier "Past projects" gallery). */
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

      /* ── Layout picker (1 | 2) — a small segmented pill in the header ─────── */
      .bp-qv-layout {
        display: inline-flex;
        gap: 2px;
        padding: 2px;
        border-radius: var(--radius-pill);
        background: var(--color-fill);
        border: 1px solid var(--color-border-hairline);
      }
      .bp-qv-layout__opt {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border: 0;
        border-radius: var(--radius-pill);
        background: transparent;
        color: var(--color-text-secondary);
        font-family: var(--font-body);
        font-size: var(--text-sm);
        font-weight: 600;
        line-height: 1;
        cursor: pointer;
      }
      .bp-qv-layout__opt--on {
        background: var(--color-surface);
        color: var(--theme-accent);
        box-shadow: var(--shadow-xs);
      }

      /* ── Layout 2 — wider two-column item view ───────────────────────────── */
      .bp-qv2 {
        display: grid;
        grid-template-columns: 1.35fr 1fr;
        gap: 1.75rem;
        align-items: start;
      }
      /* The configurator column stays in view while the left column scrolls. */
      /* Larger product name in layout 2 (Liam: "make the Name a larger font"). */
      .bp-qv2__name {
        font-family: var(--font-display, var(--font-body));
        font-size: var(--text-2xl, 1.5rem);
        font-weight: 600;
        line-height: var(--leading-tight, 1.2);
        color: var(--color-text);
        margin: 0;
      }
      .bp-qv2__side { position: sticky; top: 0; display: flex; flex-direction: column; gap: 1rem; }
      /* Header: supplier left · page switcher centred · layout picker right. */
      .bp-qv-head { grid-template-columns: 1fr auto 1fr; }
      .bp-qv-head__supplier { min-width: 0; font-size: var(--text-lg); font-weight: 600; color: var(--color-text); }
      .bp-qv-head__supplier lucide-icon { color: var(--theme-accent); }
      .bp-qv-head__logo {
        width: 28px;
        height: 28px;
        flex: none;
        border-radius: 50%;
        object-fit: cover;
        border: 1px solid var(--color-border-hairline);
      }
      .bp-qv2__buy { display: flex; flex-direction: column; gap: 0.75rem; }
      /* Hero photo + thumbnails — standard card radius (Liam: "our standard round").
         height:auto lets the image keep its OWN aspect ratio (a wide shot renders
         short, a tall one tall) so varied image sizes sit naturally with no forced
         letterbox; max-height caps it (a touch smaller) and contain handles the
         rare over-tall image within that cap. */
      .bp-qv2__hero {
        display: block;
        width: 100%;
        height: auto;
        max-height: 280px;
        object-fit: contain;
        border-radius: var(--radius-card);
      }
      /* The empty placeholder still needs a visible frame to hold the icon. */
      .bp-qv2__hero--empty {
        height: 200px;
        background: var(--color-fill);
        border-radius: var(--radius-card);
      }
      .bp-qv2__thumbs { display: flex; flex-wrap: wrap; gap: 0.5rem; }
      .bp-qv2__thumb {
        width: 56px;
        height: 56px;
        padding: 0;
        overflow: hidden;
        border-radius: var(--radius-card);
        border: 1px solid var(--color-border-hairline);
        background: var(--color-fill);
        cursor: pointer;
      }
      .bp-qv2__thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .bp-qv2__thumb--on { border-color: var(--theme-accent); box-shadow: 0 0 0 1px var(--theme-accent); }
      /* Single column on narrow viewports — the configurator drops below. */
      @media (max-width: 720px) {
        .bp-qv2 { grid-template-columns: 1fr; gap: 1.25rem; }
        .bp-qv2__side { position: static; }
      }
    `,
  ],
})
export class QuickViewDialogComponent {
  readonly item = input<CatalogueItem | null>(null);
  /** Whether this surface is a management view (My Shop / Approvals). Default false
   *  = read-only: no Edit, no Approve/Reject. The Marketplace browse leaves it false
   *  so the dialog is a pure peek even for owners/admins (Liam 2026-10-28). */
  readonly canManage = input<boolean>(false);
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
  private readonly store = inject(StoreItemService);

  /** Edit destination for viewers with rights (owner → their editor; platform admin →
   *  the org-scoped editor/approve page); null otherwise (no pencil). Shared with the
   *  item card's moderation row (extract-before-duplicate). */
  protected readonly editLink = computed<string[] | null>(() => itemEditLink(this.auth.user(), this.item()));

  // ── Moderation (pV2-STORE-APPROVALS-01) ───────────────────────────────────
  /** Approve/Reject show for a ballpark admin on a PENDING item — parity with the
   *  card's inline moderation. A supplier (owner) sees only Edit; client gate only,
   *  the server enforces moderator authority. */
  protected readonly canDecide = computed(
    () => this.auth.user()?.activeOrgType === 'ballpark' && this.item()?.approvalStatus === 'pending'
  );
  protected readonly busy = signal(false);

  /** Approve/reject, then close — the grid reloads via bust() (rev bump), so the
   *  item leaves the pending queue behind the closing dialog. */
  protected decide(decision: 'approve' | 'reject'): void {
    const it = this.item();
    if (!it || this.busy()) return;
    this.busy.set(true);
    firstValueFrom(this.store.decide(it.id, decision))
      .then(() => this.close.emit())
      .catch(() => { /* host keeps the dialog open; a toast lands with the dialog work */ })
      .finally(() => this.busy.set(false));
  }

  /** Volume price tiers (guide pricing) — KEY data shown up top. */
  protected readonly tiers = computed(() => {
    const a = this.item()?.attributes as Record<string, unknown> | null | undefined;
    return (a && Array.isArray(a['price_tiers']) ? a['price_tiers'] : []) as { min: number; max: number | null; price: number }[];
  });

  /** The combo chosen in the variant picker (null until a full combo is picked) —
   *  drives the "Add to ballpark" value. */
  protected readonly chosenCombo = signal<{ values: Record<string, string>; price: number } | null>(null);

  // ── Item image carousel (pV2-STORE-IMAGE-VARIANTS-01) ─────────────────────────
  /** The item's full gallery (cover first) + each variant option's image, deduped —
   *  what the shared carousel pages. Falls back to [coverUrl] when a projection didn't
   *  send the gallery array. */
  protected readonly imageList = computed(() => {
    const it = this.item();
    const gallery = it?.images?.length ? it.images : (it?.coverUrl ? [it.coverUrl] : []);
    const m = normalizeVariants((it?.attributes as Record<string, unknown> | null)?.['variants']);
    const imgs = [...gallery, ...allVariantImages(m)].filter((u): u is string => !!u);
    return [...new Set(imgs)];
  });
  /** The variant option's image to jump the carousel to (null = no jump). */
  protected readonly variantImg = signal<string | null>(null);
  /** Layout 2 uses a hero + thumbnail gallery instead of the carousel; this is the
   *  selected image index into imageList(). */
  protected readonly heroIdx = signal(0);
  protected readonly heroImage = computed(() => {
    const imgs = this.imageList();
    if (!imgs.length) return null;
    return imgs[Math.min(Math.max(this.heroIdx(), 0), imgs.length - 1)];
  });
  /** Picking an option jumps to its image (carousel in L1, hero in L2); if it has
   *  none, stay put (Liam). */
  protected onVariantImage(img: string | null): void {
    if (!img) return;
    this.variantImg.set(img);
    const i = this.imageList().indexOf(img);
    if (i >= 0) this.heroIdx.set(i);
  }

  // ── Layout picker (Liam 2026-11-10) ───────────────────────────────────────
  protected readonly layout = signal<1 | 2>(readStoredLayout());
  protected setLayout(n: 1 | 2): void {
    this.layout.set(n);
    try { localStorage.setItem(QV_LAYOUT_KEY, String(n)); } catch { /* private mode */ }
  }
  /** Layout 2 is a wider dialog (two columns); layout 1 keeps the current width. */
  protected readonly dialogStyle = computed(() =>
    this.layout() === 2 ? { width: '1040px', maxWidth: '96vw' } : { width: '780px', maxWidth: '94vw' });

  // ── Two-page switcher (pV2-STORE-QUICKVIEW-SUPPLIER-01) ────────────────────────
  protected readonly pane = signal<Pane>('item');
  /** Horizontal drag offset in px during a touch swipe (0 at rest). */
  protected readonly dragDx = signal(0);
  protected readonly dragging = signal(false);

  private readonly itemPane = viewChild<ElementRef<HTMLElement>>('itemPane');
  private readonly supplierPane = viewChild<ElementRef<HTMLElement>>('supplierPane');
  private readonly itemH = signal(0);
  private readonly supplierH = signal(0);
  /** Track height follows the ACTIVE pane (so a short pane leaves no whitespace and a
   *  tall one scrolls the dialog body); during a drag it's the taller of the two so the
   *  incoming pane isn't clipped mid-slide. */
  protected readonly trackH = computed(() =>
    this.dragging() ? Math.max(this.itemH(), this.supplierH()) : (this.pane() === 'item' ? this.itemH() : this.supplierH())
  );
  protected readonly trackTransform = computed(() => {
    const base = this.pane() === 'item' ? 0 : -50;
    return `translateX(calc(${base}% + ${this.dragDx()}px))`;
  });

  /** Select a pane (click/swipe/arrows). `focusTab` moves focus to the tab (keyboard). */
  protected setPane(p: Pane, focusTab = false): void {
    this.pane.set(p);
    if (focusTab && typeof document !== 'undefined') {
      queueMicrotask(() => document.getElementById('qv-tab-' + p)?.focus());
    }
  }

  // Swipe mechanics: axis-lock on gesture start so a horizontal pane-swipe doesn't
  // fight the dialog body's vertical scroll; commit on ~45% width OR a velocity flick,
  // else snap back. Touch-only — desktop uses the control + arrow keys.
  private sx = 0;
  private sy = 0;
  private st = 0;
  private axis: 'none' | 'h' | 'v' = 'none';
  private vw = 1;

  protected onTouchStart(e: TouchEvent): void {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    this.sx = t.clientX;
    this.sy = t.clientY;
    this.st = performance.now();
    this.axis = 'none';
    this.dragDx.set(0);
    this.vw = (e.currentTarget as HTMLElement).clientWidth || 1;
  }

  protected onTouchMove(e: TouchEvent): void {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - this.sx;
    const dy = t.clientY - this.sy;
    if (this.axis === 'none') {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      this.axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (this.axis === 'h') this.dragging.set(true);
    }
    if (this.axis !== 'h') return;
    e.preventDefault(); // owns the horizontal gesture → stop the body scrolling sideways
    // Rubber-band to the one reachable direction: Item can only swipe left, Supplier right.
    let d = this.pane() === 'item' ? Math.min(0, dx) : Math.max(0, dx);
    d = Math.max(-this.vw, Math.min(this.vw, d));
    this.dragDx.set(d);
  }

  protected onTouchEnd(): void {
    if (this.axis === 'h') {
      const d = this.dragDx();
      const dt = performance.now() - this.st;
      const vel = Math.abs(d) / Math.max(dt, 1); // px/ms
      const commit = Math.abs(d) > this.vw * 0.45 || vel > 0.5;
      if (commit) {
        if (this.pane() === 'item' && d < 0) this.pane.set('supplier');
        else if (this.pane() === 'supplier' && d > 0) this.pane.set('item');
      }
    }
    this.dragging.set(false);
    this.dragDx.set(0);
    this.axis = 'none';
  }

  constructor() {
    // Opening the dialog on a new item resets to the Item pane + the per-item UI state.
    effect(() => {
      this.item();
      this.pane.set('item');
      this.descOpen.set(false);
      this.variantImg.set(null);
      this.heroIdx.set(0);
      this.qty.set(1);
    });

    // Track the active pane's height (ResizeObserver → auto-height the sliding track).
    // Re-runs as the pane elements mount/unmount with the dialog.
    effect((onCleanup) => {
      if (typeof ResizeObserver === 'undefined') return;
      const pairs: readonly [HTMLElement | undefined, (n: number) => void][] = [
        [this.itemPane()?.nativeElement, (n) => this.itemH.set(n)],
        [this.supplierPane()?.nativeElement, (n) => this.supplierH.set(n)],
      ];
      const observers: ResizeObserver[] = [];
      for (const [el, set] of pairs) {
        if (!el) continue;
        const ro = new ResizeObserver(() => set(el.offsetHeight));
        ro.observe(el);
        set(el.offsetHeight);
        observers.push(ro);
      }
      onCleanup(() => observers.forEach((o) => o.disconnect()));
    });
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
