import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { DialogModule } from 'primeng/dialog';
import { CatalogueItem } from '../../shared/catalogue/catalogue.types';
import { ItemAttributeCardsComponent } from '../../shared/catalogue/item-attribute-cards.component';
import { ItemVariantPickerComponent } from '../../shared/catalogue/item-variant-picker.component';

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
  imports: [CurrencyPipe, RouterLink, LucideAngularModule, DialogModule, ItemAttributeCardsComponent, ItemVariantPickerComponent],
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
              <p class="bp-body mt-1 text-secondary bp-qv-desc" [class.bp-qv-desc--clamp]="descLong() && !descOpen()">{{ it.description }}</p>
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

          @if (it.coverUrl) {
            <img class="bp-qv-img" [src]="it.coverUrl" [alt]="it.name" loading="eager" />
          } @else {
            <div class="bp-qv-img bp-qv-img--empty"><lucide-icon name="store" [size]="26" [strokeWidth]="1.5" /></div>
          }

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
               item is a variable product; renders nothing otherwise. -->
          <app-item-variant-picker [attributes]="it.attributes ?? null" [basePrice]="it.basePrice" />

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
          <button type="button" class="bp-btn-outline" (click)="close.emit()">Close</button>
          @if (showAdd()) {
            <button type="button" class="bp-btn-grad" (click)="add.emit(it.id)">
              Add to ballpark@if (it.basePrice !== null) { &nbsp;·&nbsp;{{ it.basePrice | currency: 'GBP' : 'symbol' : '1.0-2' }} }
            </button>
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
      .bp-qv-img {
        width: 100%;
        aspect-ratio: 16 / 10;
        object-fit: cover;
        border-radius: var(--radius-lg);
      }
      .bp-qv-img--empty {
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--color-fill);
        color: var(--color-text-secondary);
      }
      /* .bp-qv-spec* now live in global styles.css (shared with the item view). */
      .bp-qv-desc--clamp {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
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
  readonly add = output<string>();

  /** Volume price tiers (guide pricing) — KEY data shown up top. */
  protected readonly tiers = computed(() => {
    const a = this.item()?.attributes as Record<string, unknown> | null | undefined;
    return (a && Array.isArray(a['price_tiers']) ? a['price_tiers'] : []) as { min: number; max: number | null; price: number }[];
  });

  /** Variable product? — the variant picker then owns the price display. */
  protected readonly hasVariants = computed(() => {
    const a = this.item()?.attributes as Record<string, unknown> | null | undefined;
    const v = a && typeof a === 'object' ? (a['variants'] as { combos?: unknown } | undefined) : undefined;
    return !!(v && Array.isArray(v.combos) && v.combos.length);
  });

  /** Long descriptions (e.g. a supplier who put the whole page in the body) clamp to a
   *  few lines with a Show more toggle, so the header doesn't swamp the dialog. */
  protected readonly descOpen = signal(false);
  protected readonly descLong = computed(() => (this.item()?.description ?? '').length > 220);

  protected onVisible(visible: boolean): void {
    if (!visible) { this.descOpen.set(false); this.close.emit(); }
  }
}
