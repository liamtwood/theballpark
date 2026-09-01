import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { CatalogueItem } from '../../../shared/catalogue/catalogue.types';
import { MarkdownPipe } from '../../../shared/markdown.pipe';
import { currencySymbol, detailsTotalStr } from '../../../shared/details-format';

/** pV2-06b — the rail's ITEM mode: image, name, supplier, price + unit,
 *  category context, full description. Pure preview over the already-
 *  loaded row (selection never fetches). The "Add to Quote" CTA slot
 *  joins in 06f; ownership edit/delete affordances with the /store arc. */
@Component({
  selector: 'app-item-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, FormsModule, RouterLink, LucideAngularModule, MarkdownPipe],
  host: { class: 'block' },
  template: `
    <div class="mb-3 flex items-start justify-between gap-2">
      @if (editable()) {
        <input class="bp-input-field bp-list-title min-w-0 flex-1" placeholder="Item name" [ngModel]="item().name" (ngModelChange)="nameChange.emit($event)" autocomplete="off" />
      } @else {
        <h3 class="bp-list-title">{{ item().name }}</h3>
      }
      <div class="flex items-center gap-2">
        @if (showStoreLink()) {
          @if (item().ownedByActiveOrg) {
            <!-- pV2-STORE-01 — owner edits their own item. -->
            <a [routerLink]="['/store/items', item().id]" class="bp-itemprev-close" title="Edit product" aria-label="Edit product" (click)="$event.stopPropagation()">
              <lucide-icon name="square-pen" [size]="14" />
            </a>
          } @else if (canModerate()) {
            <!-- pV2-STORE-01 — ballpark admin reviews / approves the item. -->
            <a [routerLink]="['/store/items', item().id]" class="bp-itemprev-close" title="Review product" aria-label="Review product" (click)="$event.stopPropagation()">
              <lucide-icon name="circle-check" [size]="14" />
            </a>
          } @else {
            <!-- pV2-STORE-01 — anyone else (e.g. an agent) opens the read-only view. -->
            <a [routerLink]="['/store/items', item().id]" [queryParams]="{ view: 1 }" class="bp-itemprev-close" title="View product" aria-label="View product" (click)="$event.stopPropagation()">
              <lucide-icon name="external-link" [size]="14" />
            </a>
          }
        }
        <button
          type="button"
          class="bp-itemprev-close"
          [attr.aria-label]="closeLabel()"
          [title]="closeLabel()"
          (click)="$event.stopPropagation(); closed.emit()"
        >
          <lucide-icon [name]="closeIcon()" [size]="14" />
        </button>
      </div>
    </div>

    @if (item().coverUrl) {
      <img class="bp-itemprev-img" [src]="item().coverUrl" [alt]="item().name" loading="eager" />
    } @else {
      <div class="bp-itemprev-img bp-itemprev-img--empty">
        <lucide-icon name="store" [size]="24" [strokeWidth]="1.5" />
      </div>
    }

    <!-- Mirrors the item card's price treatment (pV2-CARDS-01 QC #1).
         Project side (lineTotal set): the client-facing line TOTAL, always a
         value. Marketplace/store: the indicative "From £/unit". -->
    <div class="mt-3 flex items-baseline gap-1.5">
      @if (editable() && priceEditable()) {
        <span class="bp-price-large">£</span>
        <!-- .bp-input-field forces width:100%, so constrain it with a fixed-width
             wrapper (max cost 999,999 → ~6 digits). -->
        <span class="inline-block w-24 shrink-0">
          <input type="number" min="0" max="999999" step="1" class="bp-input-field" placeholder="0"
                 [ngModel]="item().basePrice" (ngModelChange)="priceChange.emit($event)" (click)="$event.stopPropagation()" />
        </span>
        <span class="bp-meta">/</span>
        <span class="inline-block w-20 shrink-0">
          <input type="text" class="bp-input-field" placeholder="unit"
                 [ngModel]="item().unit" (ngModelChange)="unitChange.emit($event)" (click)="$event.stopPropagation()" />
        </span>
      } @else if (lineTotal() !== null) {
        <span class="bp-price-large">{{ lineTotal() | currency: 'GBP' : 'symbol' : '1.0-0' }}</span>
        <span class="bp-meta uppercase tracking-wide">Total</span>
      } @else if (item().basePrice !== null) {
        <span class="bp-price-large">@if (showFromPrefix()) {From }{{ item().basePrice | currency: 'GBP' : 'symbol' : '1.0-0' }}</span>
        @if (item().unit) {
          <span class="bp-meta">/ {{ item().unit }}</span>
        }
      } @else {
        <span class="bp-caption">Price on request</span>
      }
    </div>

    <dl class="mt-3 flex flex-col gap-1.5">
      <div class="flex items-center justify-between gap-3">
        <dt class="bp-field-label">Supplier</dt>
        <dd class="bp-field-value truncate">{{ item().supplierName }}</dd>
      </div>
      @if (categoryName()) {
        <div class="flex items-center justify-between gap-3">
          <dt class="bp-field-label">Category</dt>
          <dd class="bp-field-value truncate">{{ categoryName() }}</dd>
        </div>
      }
    </dl>

    <!-- The four line text blocks in ONE fixed order (Client description → Item
         description → Services → Details); view mode hides any that are null so
         the card only shows what's filled in. Editable mode keeps just the two
         supplier-owned fields (description + services). -->

    <!-- 1 · Client description — the AGENT's text that prints on the quote. View
         only; a pencil (clientDescriptionEditable) hands editing back to the host. -->
    @if (!editable() && (clientDescription() || clientDescriptionEditable())) {
      <div class="mt-3 border-t border-hairline pt-3">
        <div class="flex items-center justify-between gap-2">
          <span class="bp-field-label">Client description <span class="bp-meta font-normal">· on the quote</span></span>
          @if (clientDescriptionEditable()) {
            <button type="button" class="rounded-md p-1 text-muted transition-colors hover:text-text"
                    (click)="$event.stopPropagation(); editClientDescription.emit()" title="Edit client description" aria-label="Edit client description">
              <lucide-icon name="square-pen" [size]="14" />
            </button>
          }
        </div>
        @if (clientDescription()) {
          <div class="bp-md bp-body-small mt-1 text-secondary" [innerHTML]="clientDescription() | md"></div>
        } @else {
          <p class="bp-meta mt-1 italic">No description yet — add one for the quote.</p>
        }
      </div>
    }

    <!-- 2 · Item description — the supplier's blurb (label overridable). -->
    @if (showDescription()) {
      @if (editable()) {
        <div class="mt-3 border-t border-hairline pt-3">
          <span class="bp-field-label">{{ descriptionLabel() }}</span>
          <textarea rows="6" class="bp-store-textarea mt-1 w-full" placeholder="Describe the item for the agent…" [ngModel]="item().description" (ngModelChange)="descChange.emit($event)"></textarea>
        </div>
      } @else if (item().description) {
        <div class="mt-3 border-t border-hairline pt-3">
          <span class="bp-field-label">{{ descriptionLabel() }}</span>
          <div class="bp-md bp-body-small mt-1 text-secondary" [innerHTML]="item().description | md"></div>
        </div>
      }
    }

    <!-- 3 · Services — what's included / done on-site. -->
    @if (editable()) {
      <div class="mt-3 border-t border-hairline pt-3">
        <span class="bp-field-label">Services</span>
        <textarea rows="4" class="bp-store-textarea mt-1 w-full" placeholder="Services included…" [ngModel]="item().installDescription" (ngModelChange)="servicesChange.emit($event)"></textarea>
      </div>
    } @else if (item().installDescription) {
      <div class="mt-3 border-t border-hairline pt-3">
        <span class="bp-field-label">Services</span>
        <div class="bp-md bp-body-small mt-1 text-secondary" [innerHTML]="item().installDescription | md"></div>
      </div>
    }

    <!-- 4 · Details — the supplier's costed breakdown + running total. View only. -->
    @if (!editable() && details()) {
      <div class="mt-3 border-t border-hairline pt-3">
        <div class="flex items-center justify-between gap-2">
          <span class="bp-field-label">Details</span>
          @if (detailsTotalDisplay()) {
            <span class="bp-body-small font-semibold tabular-nums text-text">{{ detailsTotalDisplay() }}</span>
          }
        </div>
        <div class="bp-md bp-body-small mt-1 text-secondary" [innerHTML]="details() | md"></div>
      </div>
    }
  `,
})
export class ItemPreviewComponent {
  private readonly auth = inject(AuthService);

  readonly item = input.required<CatalogueItem>();
  /** Resolved category name (the store has the rail list — no fetch). */
  readonly categoryName = input<string | null>(null);
  /** Header close/toggle affordance — the marketplace rail closes (x); the
   *  quote views hide the preview (eye). */
  readonly closeIcon = input<string>('x');
  readonly closeLabel = input<string>('Close preview');
  /** Show the store-item link (edit/review/view product) in the header. Off for
   *  the inbox conversation cards, which shouldn't jump out to the library. */
  readonly showStoreLink = input<boolean>(true);
  /** Prefix the price with "From" (indicative marketplace price). Off when the
   *  price is a firm, agreed cost (e.g. the inbox revised card). */
  readonly showFromPrefix = input<boolean>(true);
  /** Show the (item) Description block. */
  readonly showDescription = input<boolean>(true);
  /** Label for the supplier description block — project surfaces pass
   *  "Item description" to disambiguate it from the Client description. */
  readonly descriptionLabel = input<string>('Description');
  /** Project side: the client-facing line TOTAL (what they'll pay). When set,
   *  the price shows this as "£X TOTAL" instead of "From £/unit". */
  readonly lineTotal = input<number | null>(null);
  /** The AGENT's client-facing quote text (rendered as the first block, view
   *  mode). null → an empty prompt when editable, else the block is hidden. */
  readonly clientDescription = input<string | null>(null);
  /** Show a pencil on the Client description block that emits editClientDescription
   *  (the host — the estimate rail — opens its own editor). */
  readonly clientDescriptionEditable = input<boolean>(false);
  /** The line's Details free-text (markdown) — rendered as the last block with
   *  its running total (view mode). */
  readonly details = input<string | null>(null);
  /** ISO currency for the Details total symbol (defaults to £). */
  readonly currencyCode = input<string | null>(null);
  readonly closed = output<void>();
  readonly editClientDescription = output<void>();
  /** Formatted Details total ("£3,100"), or '' when no line carries a cost. */
  protected readonly detailsTotalDisplay = computed(() => detailsTotalStr(this.details(), currencySymbol(this.currencyCode())));
  /** Opt-in edit mode — the name + description become editable and emit changes
   *  (used by the supplier Customize to set the final item the agent sees). */
  readonly editable = input<boolean>(false);
  /** Also allow the PRICE to be edited (a number input). Opt-in on top of
   *  `editable` — the inbox revised card lets the supplier change the cost. */
  readonly priceEditable = input<boolean>(false);
  readonly nameChange = output<string>();
  readonly descChange = output<string>();
  readonly servicesChange = output<string>();
  readonly priceChange = output<number>();
  readonly unitChange = output<string>();

  /** Ballpark admins get a Review entry on items they don't own (moderation). */
  protected readonly canModerate = computed(() => this.auth.user()?.activeOrgType === 'ballpark');
}
