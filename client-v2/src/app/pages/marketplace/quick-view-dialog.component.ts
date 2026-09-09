import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { DialogModule } from 'primeng/dialog';
import { CatalogueItem } from '../../shared/catalogue/catalogue.types';

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
  imports: [CurrencyPipe, RouterLink, LucideAngularModule, DialogModule],
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
              <p class="bp-body mt-1 text-secondary">{{ it.description }}</p>
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
            @if (it.basePrice !== null) {
              <span class="bp-price-large shrink-0">From {{ it.basePrice | currency: 'GBP' : 'symbol' : '1.0-0' }}</span>
            }
          </div>

          <!-- Spec cards: MATERIALS maps to Included Services; the rest are
               not on the list projection yet → Coming soon. -->
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="bp-qv-spec">
              <span class="bp-qv-spec__label"><lucide-icon name="package" [size]="13" /> Materials</span>
              <p class="bp-qv-spec__val">{{ it.installDescription || 'Coming soon' }}</p>
            </div>
            <div class="bp-qv-spec">
              <span class="bp-qv-spec__label"><lucide-icon name="clock" [size]="13" /> Turnaround</span>
              <p class="bp-qv-spec__val bp-qv-spec__val--soon">Coming soon</p>
            </div>
            <div class="bp-qv-spec">
              <span class="bp-qv-spec__label"><lucide-icon name="wrench" [size]="13" /> Install and derig</span>
              <p class="bp-qv-spec__val bp-qv-spec__val--soon">Coming soon</p>
            </div>
            <div class="bp-qv-spec">
              <span class="bp-qv-spec__label"><lucide-icon name="maximize-2" [size]="13" /> Sizing</span>
              <p class="bp-qv-spec__val bp-qv-spec__val--soon">Coming soon</p>
            </div>
          </div>

          <div class="bp-qv-spec">
            <span class="bp-qv-spec__label"><lucide-icon name="sparkles" [size]="13" /> Finish</span>
            <p class="bp-qv-spec__val bp-qv-spec__val--soon">Coming soon</p>
          </div>

          <div>
            <span class="bp-field-label">Included</span>
            <p class="bp-caption mt-1 italic text-secondary">Coming soon</p>
          </div>

          <p class="bp-caption text-secondary">Availability: Coming soon</p>

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
              Add to ballpark@if (it.basePrice !== null) { &nbsp;·&nbsp;{{ it.basePrice | currency: 'GBP' : 'symbol' : '1.0-0' }} }
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
      .bp-qv-spec {
        border: 1px solid var(--color-border-hairline);
        border-radius: var(--radius-lg);
        padding: 12px 14px;
        background: var(--color-surface);
      }
      .bp-qv-spec__label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-family: var(--font-body);
        font-size: var(--text-2xs);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-secondary);
      }
      .bp-qv-spec__val {
        margin-top: 6px;
        font-family: var(--font-body);
        font-size: var(--text-sm);
        color: var(--color-text);
        white-space: pre-line;
      }
      .bp-qv-spec__val--soon {
        color: var(--color-text-secondary);
        font-style: italic;
      }
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

  protected onVisible(visible: boolean): void {
    if (!visible) this.close.emit();
  }
}
