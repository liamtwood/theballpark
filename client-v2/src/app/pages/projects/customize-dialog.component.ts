import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { CatalogueService } from '../../core/marketplace/catalogue.service';
import { CategoryInfo, CatalogueItem } from '../../shared/catalogue/catalogue.types';
import { ProjectService, MyComponent, ComponentInput } from '../../core/projects/project.service';
import { StoreItemService } from '../../core/store/store-item.service';
import { QuoteLine } from '../../core/projects/project.types';
import { quoteLineToCatalogueItem } from './quote-line.util';
import { ItemPreviewComponent } from '../marketplace/rail/item-preview.component';
import { ShuttleComponent, ShuttleItem, ShuttlePick } from '../../shared/shuttle/shuttle.component';
import { RateInputComponent } from './rate-input.component';

interface Row {
  id: string | null;
  name: string;
  cost: number | null;
  qty: number;
  unit: string | null;
  categoryId: string | null;
  included: boolean;
  /** Draft enrichment shown in the right rail (client-only for now — not yet
   *  persisted): a free-text description and an image (data URL). */
  description: string | null;
  image: string | null;
  _k: number;
}
let RUID = 0;

/** Common component units (labour + materials) for the unit pick-list. */
const UNITS = ['day', 'hour', 'week', 'night', 'head', 'cover', 'each', 'unit', 'sheet', 'length', 'm', 'kg', 'litre', 'roll', 'pack', 'box', 'hire', 'job', 'lot'];

/** pV2-BUILDUP-02 — the supplier "Customize" dialog. Builds a line up from child
 *  components, grouped by category. LEFT = the supplier's reusable components.
 *  RIGHT = the editable table (category · name · cost · qty · unit-picklist ·
 *  include), grouped into category bands. Re-openable (pre-loads + reconciles);
 *  a pricing footer rolls the cost up and sets the revised item price. */
@Component({
  selector: 'app-customize-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, FormsModule, LucideAngularModule, ItemPreviewComponent, ShuttleComponent, RateInputComponent],
  host: { class: 'contents' },
  styles: [`
    /* Native <select> chevrons crowd the value in narrow cells — replace the
       browser arrow with a padded custom chevron so it clears the text. */
    select.bp-select {
      appearance: none;
      -webkit-appearance: none;
      padding-right: 1.4rem;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 4.5 6 7.5 9 4.5'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.45rem center;
      background-size: 0.7rem;
    }
  `],
  template: `
    <div class="p-4">
      <!-- Back out of the builder without saving (returns to the thread) +
           the running totals (Customizations / Revised) in the header. -->
      <div class="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div class="flex items-center gap-5">
          <button type="button" class="flex items-center gap-2 bp-body-small text-secondary transition-colors hover:text-text" (click)="cancel.emit()">
            <lucide-icon name="arrow-left" [size]="16" /> Back to conversation
          </button>
          <button type="button" class="inline-flex items-center gap-1.5 bp-body-small text-secondary transition-colors hover:text-[var(--theme-accent)]" (click)="replayDemo()">
            <lucide-icon name="circle-help" [size]="15" /> Show me around
          </button>
        </div>
        <div class="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span><span class="bp-caption">Upgrades</span> <span class="bp-body-small ml-1 text-secondary tabular-nums">£{{ costTotal() | number: '1.0-0' }}</span></span>
          <span><span class="bp-caption">Revised</span> <span class="bp-price-large ml-1 tabular-nums">£{{ withMargin() | number: '1.0-0' }}</span></span>
        </div>
      </div>
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
          <!-- CENTRE: the editable estimate, grouped by category. -->
          <div class="relative min-w-0">

            <!-- Customize demo — the RUNNING steps show one bubble at the top of
                 the builder (own layer → no layout shift); the active field
                 GLOWS (.bp-demo-hl). The opt-in ("ask") is anchored to the Base
                 row itself (below). -->
            @if (coachPhase() === 'run') {
              <div class="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center">
                <div class="bp-coachmark bp-coachmark--down pointer-events-auto">
                  <p class="bp-coachmark__text">{{ demoText() }}</p>
                  <div class="bp-coachmark__foot">
                    <span class="bp-caption">{{ demoStep() + 1 }} / {{ demoCount }}</span>
                    <button type="button" class="bp-coachmark__ok" (click)="demoNext()">{{ isLastStep() ? 'Done' : 'Next' }}</button>
                  </div>
                </div>
              </div>
            }

            <!-- One card per category (Final-Quote card). The Extras/margin card
                 is hidden for now (cardGroups filters it). -->
            @for (grp of cardGroups(); track grp.categoryId ?? '__extras') {
              <!-- overflow:visible (inline — beats .bp-card's overflow:hidden) so
                   the coachmark anchored to a row isn't clipped by the card. -->
              <div class="mb-3 bp-card" style="overflow: visible">
                <button type="button" class="flex w-full items-center gap-3.5 p-3 text-left" (click)="toggleCat(grp.isExtras ? '__extras' : grp.categoryId)">
                  <lucide-icon [name]="grp.isExtras ? 'sparkles' : catIcon(grp.categoryId)" [size]="30" [strokeWidth]="1.5" class="shrink-0 text-[var(--theme-accent)]" />
                  <span class="min-w-0 flex-1">
                    <span class="bp-list-title block truncate text-[length:var(--text-2xl)]">{{ grp.isExtras ? 'Extras' : catName(grp.categoryId) }}</span>
                  </span>
                  <span class="bp-amount shrink-0 text-text tabular-nums">£{{ catCardTotal(grp) | number: '1.0-0' }}</span>
                  <lucide-icon [name]="isCatOpen(grp.isExtras ? '__extras' : grp.categoryId) ? 'chevron-down' : 'chevron-right'" [size]="18" class="shrink-0 text-muted" />
                </button>
                @if (isCatOpen(grp.isExtras ? '__extras' : grp.categoryId)) {
                <div class="border-t border-hairline">
                  @if (grp.isExtras || grp.rows.length || isBaseCat(grp.categoryId)) {
                    <div class="grid grid-cols-[108px_1fr_78px_104px_68px_84px_30px_24px] items-center gap-1.5 border-b border-hairline bg-fill px-2.5 py-2 bp-field-label">
                      <span>Category</span><span>Item</span><span class="text-center">Cost £</span><span class="text-center">Qty</span><span>Unit</span><span class="text-center">Total</span><span class="text-center" title="Include">Inc</span><span></span>
                    </div>
                  }
                  @if (isBaseCat(grp.categoryId)) {
                    <!-- The item itself — row-0, a "project component": editable
                         cost/qty/unit + Inc; can't be removed or re-categorised. -->
                    <div class="relative grid cursor-pointer grid-cols-[108px_1fr_78px_104px_68px_84px_30px_24px] items-center gap-1.5 border-b border-hairline px-2.5 py-1" [class.bg-fill]="parentSelected()" (click)="selectParent()">
                      <!-- Opt-in coachmark, anchored to (and pointing at) the Base row. -->
                      @if (coachPhase() === 'ask') {
                        <div class="pointer-events-none absolute bottom-full left-1/2 z-40 -translate-x-1/2 pb-1.5" (click)="$event.stopPropagation()">
                          <div class="bp-coachmark bp-coachmark--down pointer-events-auto">
                            <p class="bp-coachmark__text">This is your {{ parentName() || 'item' }} base cost. Adding extras is easy — want me to show you?</p>
                            <div class="bp-coachmark__foot">
                              <button type="button" class="bp-coachmark__skip" (click)="dismissDemo()">No thanks</button>
                              <button type="button" class="bp-coachmark__ok" (click)="startDemo()">Show me</button>
                            </div>
                          </div>
                        </div>
                      }
                      <span class="px-2 bp-body-small text-secondary">Base</span>
                      <span class="px-2 bp-body-small font-medium text-text truncate">{{ parentName() || 'Original item' }}</span>
                      <input type="number" class="bp-input-field text-center tabular-nums" [ngModel]="baseRate()" (ngModelChange)="baseRate.set($event)" (click)="$event.stopPropagation()" />
                      <span class="justify-self-center" (click)="$event.stopPropagation()">
                        <app-rate-input [value]="baseQty() || 1" [min]="1" label="base quantity" (rateCommit)="baseQty.set($event)" />
                      </span>
                      <select class="bp-input-field bp-select" [ngModel]="baseUnitDraft()" (ngModelChange)="baseUnitDraft.set($event || null)" (click)="$event.stopPropagation()">
                        <option [ngValue]="null">—</option>
                        @for (u of units; track u) { <option [ngValue]="u">{{ u }}</option> }
                      </select>
                      <span class="text-center tabular-nums bp-body-small" [class.text-muted]="!includeBase()" [class.text-text]="includeBase()">£{{ baseCost() | number: '1.0-0' }}</span>
                      <input type="checkbox" class="justify-self-center" [checked]="includeBase()" (change)="includeBase.set($any($event.target).checked)" (click)="$event.stopPropagation()" title="Include the item's base price (off = rebuild from parts)" />
                      <span></span>
                    </div>
                  }
                  @if (grp.isExtras) {
                    <!-- Margin as a grid row (same format as a component row):
                         Extra · Margin · % (in the Cost column) · Total. -->
                    <div class="grid grid-cols-[108px_1fr_78px_104px_68px_84px_30px_24px] items-center gap-1.5 border-b border-hairline px-2.5 py-1">
                      <span class="px-2 bp-body-small text-secondary">Extra</span>
                      <span class="px-2 bp-body-small font-medium text-text">Margin</span>
                      <input type="number" min="0" max="100" step="1" class="bp-input-field text-center tabular-nums" [ngModel]="margin()" (ngModelChange)="margin.set($event)" />
                      <span></span>
                      <span class="text-center bp-body-small text-muted">%</span>
                      <span class="text-center tabular-nums bp-body-small text-text">£{{ marginAmount() | number: '1.0-0' }}</span>
                      <span></span>
                      <span></span>
                    </div>
                  }
                  @for (r of grp.rows; track r._k) {
                    <div class="grid cursor-pointer grid-cols-[108px_1fr_78px_104px_68px_84px_30px_24px] items-center gap-1.5 border-b border-hairline px-2.5 py-1" [class.bg-fill]="r._k === selectedRowK()" (click)="selectRow(r)">
                      <select class="bp-input-field bp-select" [ngModel]="r.categoryId" (ngModelChange)="setCategory(r, $event)">
                        <option [ngValue]="null">—</option>
                        @for (c of categories(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
                      </select>
                      <input class="bp-input-field" [class.bp-demo-hl]="demoHl(r, 'name')" placeholder="Component" [ngModel]="r.name" (ngModelChange)="r.name = $event" autocomplete="off" />
                      <input type="number" class="bp-input-field text-center tabular-nums" [class.bp-demo-hl]="demoHl(r, 'cost')" placeholder="—" [ngModel]="r.cost" (ngModelChange)="r.cost = $event" />
                      <span class="justify-self-center" [class.bp-demo-hl]="demoHl(r, 'qty')" (click)="$event.stopPropagation()">
                        <app-rate-input [value]="r.qty || 1" [min]="1" label="quantity" (rateCommit)="r.qty = $event; rows.set([...rows()])" />
                      </span>
                      <select class="bp-input-field bp-select" [class.bp-demo-hl]="demoHl(r, 'unit')" [ngModel]="r.unit" (ngModelChange)="r.unit = $event || null">
                        <option [ngValue]="null">—</option>
                        @for (u of units; track u) { <option [ngValue]="u">{{ u }}</option> }
                      </select>
                      <span class="text-center tabular-nums bp-body-small" [class.text-muted]="!r.included || !r.name.trim()" [class.text-text]="r.included && r.name.trim()">{{ r.name.trim() && r.cost != null ? ('£' + (lineTotal(r) | number: '1.0-0')) : '—' }}</span>
                      <input type="checkbox" class="justify-self-center" [class.bp-demo-hl]="demoHl(r, 'inc')" [ngModel]="r.included" (ngModelChange)="r.included = $event" />
                      <button type="button" class="rounded-md p-1 text-muted hover:text-danger" [class.bp-demo-hl]="demoHl(r, 'remove')" aria-label="Remove" (click)="removeRow(r)"><lucide-icon name="trash-2" [size]="14" /></button>
                    </div>
                  }
                  <!-- Per-card footer: Explore (category-scoped) + Add. -->
                  <div class="flex items-center gap-4 p-3">
                    <button type="button" class="bp-body-small inline-flex items-center gap-1 text-secondary hover:text-text" (click)="openExplore(grp.isExtras ? null : grp.categoryId)">
                      <lucide-icon name="layout-grid" [size]="14" /> Explore components
                    </button>
                    <button type="button" class="bp-body-small inline-flex items-center gap-1 text-secondary hover:text-text" (click)="addRowIn(grp.isExtras ? null : grp.categoryId)">
                      <lucide-icon name="plus" [size]="14" /> Add component
                    </button>
                  </div>
                </div>
                }
              </div>
            }

            <div class="mt-3 flex items-center gap-2">
              @if (itemMode()) {
                <button type="button" class="bp-btn-grad flex-1" [disabled]="saving() || !loaded()" (click)="save(false)">{{ saving() ? 'Saving…' : 'Save options' }}</button>
              } @else {
                <button type="button" class="bp-btn-outline" [disabled]="saving()" (click)="cancel.emit()">Cancel</button>
                <button type="button" class="bp-btn-outline flex-1" [class.bp-demo-hl]="demoField() === 'save'" [disabled]="saving() || !loaded()" (click)="save(false)">{{ saving() ? 'Saving…' : 'Save draft' }}</button>
                <button type="button" class="bp-btn-grad flex-1" [class.bp-demo-hl]="demoField() === 'save'" [disabled]="saving() || !loaded()" (click)="openSend()">
                  <lucide-icon name="circle-dollar-sign" [size]="16" /> Send New Cost
                </button>
              }
            </div>
          </div>

          <!-- RIGHT: a selected component's card, else the item's own preview
               card (editable in place when the item header is selected). -->
          <div class="min-w-0">
            @if (selectedRow(); as sr) {
              <div class="bp-card p-4">
                <div class="mb-3 flex items-start justify-between gap-2">
                  <h3 class="bp-list-title min-w-0 truncate">{{ sr.name || 'New component' }}</h3>
                  <button type="button" class="bp-itemprev-close" title="Close" aria-label="Close" (click)="selectedRowK.set(null)">
                    <lucide-icon name="x" [size]="14" />
                  </button>
                </div>

                @if (sr.image) {
                  <img class="bp-itemprev-img" [src]="sr.image" [alt]="sr.name" />
                  <button type="button" class="mt-2 bp-body-small text-secondary hover:text-danger" (click)="clearImage(sr)">Remove image</button>
                } @else {
                  <button type="button" class="bp-itemprev-img bp-itemprev-img--empty flex-col gap-1 hover:bg-fill" (click)="imgInput.click()">
                    <lucide-icon name="upload" [size]="22" [strokeWidth]="1.5" />
                    <span class="bp-caption">Add image</span>
                  </button>
                  <input #imgInput type="file" accept="image/*" class="hidden" (change)="onPickImage(sr, $event)" />
                }

                <div class="mt-3 flex items-baseline gap-1.5">
                  @if (sr.cost != null) {
                    <span class="bp-price-large">£{{ sr.cost | number: '1.0-0' }}</span>
                    @if (sr.unit) { <span class="bp-meta">/ {{ sr.unit }}</span> }
                  } @else { <span class="bp-caption">No cost yet</span> }
                </div>

                <div class="mt-3 border-t border-hairline pt-3">
                  <span class="bp-field-label">Description</span>
                  <textarea rows="4" class="bp-store-textarea mt-1 w-full" placeholder="Describe this component…" [ngModel]="sr.description" (ngModelChange)="sr.description = $event"></textarea>
                </div>

                <p class="bp-caption mt-3">Saved with the estimate when you Save.</p>
              </div>
            } @else if (previewItem(); as pi) {
              @if (showPreview()) {
                <div class="bp-card p-4">
                  <app-item-preview [item]="pi" [categoryName]="previewLine()?.categoryName ?? null"
                                    [editable]="parentSelected()" (nameChange)="parentName.set($event)" (descChange)="parentDesc.set($event)" (servicesChange)="parentServices.set($event)"
                                    closeIcon="eye" closeLabel="Hide preview" (closed)="showPreview.set(false)" />
                </div>
              } @else {
                <div class="flex justify-end">
                  <button type="button" class="bp-itemprev-close" title="Show item preview" aria-label="Show item preview" (click)="showPreview.set(true)">
                    <lucide-icon name="eye" [size]="14" />
                  </button>
                </div>
              }
            }
          </div>
        </div>
    </div>

    <!-- Explore picker — the shared shuttle: browse the component library on
         the left, click to add it to the estimate (shown on the right). -->
    @if (exploring()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" (click)="exploring.set(false)">
        <div class="bp-card flex max-h-[88vh] w-full max-w-4xl flex-col p-6" (click)="$event.stopPropagation()">
          <div class="mb-3 flex items-start justify-between">
            <h3 class="bp-card-title text-lg">Explore your components</h3>
            <button type="button" class="text-muted hover:text-text" aria-label="Close" (click)="exploring.set(false)"><lucide-icon name="x" [size]="18" /></button>
          </div>
          <app-shuttle
            [available]="shuttleAvailable()"
            [picks]="shuttlePicks()"
            [initialCat]="exploreCatName()"
            leftPlaceholder="Filter components…"
            rightTitle="On this estimate"
            emptyLeft="No saved components yet — add new ones with “Add component”."
            emptyRight="Click components on the left to add them to the estimate."
            (add)="onShuttleAdd($event)"
            (remove)="onShuttleRemove($event)"
            (qtyChange)="onShuttleQty($event)" />
          <div class="mt-4 flex justify-end">
            <button type="button" class="bp-btn-grad" (click)="exploring.set(false)">Done</button>
          </div>
        </div>
      </div>
    }

    <!-- Send quote — confirm the breakdown the agent will see, then send. -->
    @if (sendConfirm()) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" (click)="sendConfirm.set(false)">
        <div class="bp-card w-full max-w-md p-6" (click)="$event.stopPropagation()">
          <h3 class="bp-card-title text-lg">Send New Cost</h3>
          <p class="bp-body-small mt-1 text-secondary">This is the new cost the agent will see for <span class="font-medium text-text">{{ itemName() }}</span>. Adjust it if you need to.</p>
          <div class="mt-4 flex items-baseline justify-between gap-2">
            <span class="bp-list-title">New cost</span>
            <div class="flex items-baseline gap-1 rounded-[var(--radius-field)] border border-hairline bg-surface px-2.5 py-1 focus-within:border-accent">
              <span class="bp-price-large">£</span>
              <input type="number" min="0" class="bp-price-large w-32 border-0 bg-transparent p-0 text-right tabular-nums outline-none focus:ring-0" [ngModel]="sendPrice()" (ngModelChange)="sendPrice.set($event)" />
            </div>
          </div>
          <div class="mt-5 flex items-center gap-2">
            <button type="button" class="bp-btn-outline flex-1" [disabled]="saving()" (click)="sendConfirm.set(false)">Cancel</button>
            <button type="button" class="bp-btn-grad flex-1" [disabled]="saving() || !loaded()" (click)="confirmSend()">
              <lucide-icon name="circle-dollar-sign" [size]="16" /> {{ saving() ? 'Sending…' : 'Send New Cost' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class CustomizeDialogComponent implements OnInit {
  private readonly catalogue = inject(CatalogueService);
  private readonly projects = inject(ProjectService);
  private readonly store = inject(StoreItemService);
  protected readonly units = UNITS;

  // Project mode (default): customize a project line. Item mode: build up a
  // catalogue item — pass [itemId] instead of projectId/lineId.
  readonly projectId = input<string>('');
  readonly lineId = input<string>('');
  /** pV2-BUILDUP-03 — when set, the buildup targets a catalogue ITEM (store
   *  side) instead of a project line. Hides the project-only chrome. */
  readonly itemId = input<string | null>(null);
  protected readonly itemMode = computed(() => !!this.itemId());
  readonly itemName = input<string>('');
  /** The line's ORIGINAL price (price_ref) — shown as "Original" in the header. */
  readonly originalPrice = input<number | null>(null);
  /** The line's CURRENT (possibly negotiated) total — the base is seeded so that
   *  base + upgrades = this, so opening Customize reflects the current price
   *  (not the original) and never double-counts saved components. */
  readonly currentPrice = input<number | null>(null);
  /** The line's per-unit rate + qty + unit — lets the base row rescale by head
   *  count (falls back to a flat originalPrice when the unit rate is unknown). */
  readonly baseUnitPrice = input<number | null>(null);
  readonly baseUnit = input<string | null>(null);
  readonly baseQuantity = input<number | null>(null);
  /** The item's own category — the base row folds in as row-0 of this card. */
  readonly baseCategoryId = input<string | null>(null);
  /** The line being customized, as a quote line — mapped to the same preview
   *  card the final quote renders (right rail: photo + description). */
  readonly previewLine = input<QuoteLine | null>(null);
  readonly saved = output<void>();
  readonly cancel = output<void>();
  /** Draft saved (stay open) — the inbox reloads the thread so the header's
   *  revised total refreshes without closing the estimate. */
  readonly changed = output<void>();
  /** Send New Cost — the confirmed total to send the agent as a new-cost
   *  proposal (the inbox posts the negotiation move). */
  readonly sendCost = output<number>();

  protected readonly showPreview = signal(true);
  /** The "Explore components" picker (browse the saved library, click to add). */
  protected readonly exploring = signal(false);
  /** The "Send New Cost" confirmation — the supplier confirms (and can tweak)
   *  the final total the agent will see, then it goes out as a new-cost proposal. */
  protected readonly sendConfirm = signal(false);
  protected readonly sendPrice = signal<number | null>(null);
  protected openSend(): void { this.sendPrice.set(this.withMargin()); this.sendConfirm.set(true); }
  /** The line mapped to the marketplace preview's CatalogueItem shape. */
  protected readonly previewItem = computed<CatalogueItem | null>(() => {
    const l = this.previewLine();
    if (!l) return null;
    const base = quoteLineToCatalogueItem(l);
    // Reflect the supplier's edited name/description/services on the card live.
    return { ...base, name: this.parentName() || base.name, description: this.parentDesc() || base.description, installDescription: this.parentServices() || base.installDescription };
  });
  protected readonly categories = signal<CategoryInfo[]>([]);
  protected readonly myComponents = signal<MyComponent[]>([]);
  protected readonly query = signal('');
  protected readonly rows = signal<Row[]>([]);
  /** The component row selected in the table — its card shows in the right rail. */
  protected readonly selectedRowK = signal<number | null>(null);
  protected readonly selectedRow = computed(() => this.rows().find((r) => r._k === this.selectedRowK()) ?? null);
  /** Clicking the header selects the PARENT item — the right rail becomes the
   *  editor for the item's final name + description (what the agent sees). */
  protected readonly parentSelected = signal(false);
  protected readonly parentName = signal('');
  protected readonly parentDesc = signal('');
  protected readonly parentServices = signal('');
  protected selectParent(): void { this.parentSelected.set(true); this.selectedRowK.set(null); this.showPreview.set(true); }
  protected readonly saving = signal(false);
  /** True once the components have loaded from the server. Save is blocked until
   *  then, so a failed/incomplete load can't send an empty reconcile that
   *  soft-deletes every existing component. */
  protected readonly loaded = signal(false);
  /** The line margin (%), saved on the parent, seeded from the org default.
   *  Revised price = cost + this margin, derived live (no Apply step). */
  protected readonly margin = signal<number | null>(0);

  /** Left-rail category filter (null = all). */
  protected readonly catFilter = signal<string | null>(null);
  protected readonly filteredComponents = computed(() => {
    const q = this.query().trim().toLowerCase();
    const cf = this.catFilter();
    return this.myComponents().filter((c) =>
      (!q || c.name.toLowerCase().includes(q)) && (cf === null || c.category_id === cf)
    );
  });
  /** The reusable components grouped into category bands (first-appearance
   *  order) — mirrors the table's banding so the left list reads the same. */
  protected readonly componentGroups = computed(() => {
    const groups: { categoryId: string | null; name: string; items: MyComponent[] }[] = [];
    const idx = new Map<string | null, { categoryId: string | null; name: string; items: MyComponent[] }>();
    for (const c of this.filteredComponents()) {
      let g = idx.get(c.category_id);
      if (!g) { g = { categoryId: c.category_id, name: this.catName(c.category_id), items: [] }; idx.set(c.category_id, g); groups.push(g); }
      g.items.push(c);
    }
    return groups;
  });
  /** Rows grouped into category bands (with per-band subtotal). */
  protected readonly rowGroups = computed(() => {
    const groups: { categoryId: string | null; rows: Row[]; total: number }[] = [];
    const idx = new Map<string | null, { categoryId: string | null; rows: Row[]; total: number }>();
    for (const r of this.rows()) {
      let g = idx.get(r.categoryId);
      if (!g) { g = { categoryId: r.categoryId, rows: [], total: 0 }; idx.set(r.categoryId, g); groups.push(g); }
      g.rows.push(r);
      if (r.name.trim() && r.included) g.total += (Number(r.cost) || 0) * Math.max(1, Number(r.qty) || 1);
    }
    return groups;
  });
  protected filledCount(): number { return this.rows().filter((r) => r.name.trim() && r.included).length; }
  protected readonly costTotal = computed(() =>
    this.rows().reduce((s, r) => s + (r.name.trim() && r.included ? (Number(r.cost) || 0) * Math.max(1, Number(r.qty) || 1) : 0), 0)
  );
  /** Revised (client) price = rolled-up cost + the line margin. Derived live. */
  /** Include the item's own base price in the revised total (default on).
   *  On = AUGMENT (base + customizations); off = DECOMPOSE (rebuild from parts,
   *  the pre-fix behaviour). Not yet persisted — resets to on each open. */
  protected readonly includeBase = signal(true);
  /** The base = the item itself as row-0 (a "project component"): editable
   *  cost (per-unit rate) / qty / unit, all seeded from the line. */
  protected readonly baseRate = linkedSignal(() => {
    // Seed from the FULL line total ÷ qty (so it INCLUDES install/extras) —
    // otherwise the base reads goods-only and the revised total undershoots the
    // thread's figure. Falls back to the goods rate when there's no line total.
    const q = this.baseQuantity() ?? 1;
    const op = this.originalPrice();
    return op != null && q > 0 ? Math.round((op / q) * 100) / 100 : this.baseUnitPrice();
  });
  protected readonly baseQty = linkedSignal(() => this.baseQuantity() ?? 1);
  protected readonly baseUnitDraft = linkedSignal(() => this.baseUnit());
  /** The base cost that seeds the buildup (0 when excluded). Uses the per-unit
   *  rate × the (editable) head count when known, else a flat total. */
  protected readonly baseCost = computed(() => {
    if (!this.includeBase()) return 0;
    const r = this.baseRate();
    return r != null ? r * Math.max(1, Number(this.baseQty()) || 1) : (this.originalPrice() ?? 0);
  });
  /** Margin £ on the customizations only — the base keeps its already-quoted
   *  price and is NOT re-margined. */
  protected readonly marginAmount = computed(() => Math.round(this.costTotal() * ((Number(this.margin()) || 0) / 100)));
  /** Revised = base (flat) + customizations + their margin. Base is preserved,
   *  never overwritten, so customizing augments instead of zeroing the price. */
  protected readonly withMargin = computed(() => Math.round(this.baseCost() + this.costTotal() + this.marginAmount()));
  protected catName(id: string | null): string {
    return id ? (this.categories().find((c) => c.id === id)?.name ?? 'Category') : 'Uncategorised';
  }
  /** The category's icon — same one the final quote renders on its cards. */
  protected catIcon(id: string | null): string {
    return (id ? this.categories().find((c) => c.id === id)?.iconName : null) || 'folder-open';
  }
  /** Category collapse — mirrors the final quote: track COLLAPSED so new
   *  categories default open. Chevron on the category card toggles it. */
  protected readonly collapsedCats = signal<ReadonlySet<string>>(new Set());
  protected isCatOpen(id: string | null): boolean { return !this.collapsedCats().has(id ?? '__null'); }
  protected toggleCat(id: string | null): void {
    const key = id ?? '__null';
    this.collapsedCats.update((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  }

  ngOnInit(): void {
    void this.catalogue.categories().then((cs) => this.categories.set(cs)).catch(() => {});
    this.projects.listMyComponents().subscribe({ next: (cs) => this.myComponents.set(cs), error: () => {} });
    const load$ = this.itemMode()
      ? this.store.getComponents(this.itemId()!)
      : this.projects.getComponents(this.projectId(), this.lineId());
    load$.subscribe({
      next: (res) => {
        const rows = res.components.map((c) => this.rowFrom(c));
        this.rows.set(rows.length ? rows : [this.blank()]);
        // Line margin: the saved value, else the supplier org default, else 20%.
        this.margin.set(res.marginPct ?? res.defaultMarginPct ?? 20);
        // The parent item's editable name + description + services.
        this.parentName.set(res.parentName || this.itemName());
        this.parentDesc.set(res.parentDescription ?? '');
        this.parentServices.set(res.parentServices ?? '');
        // Seed the base so base + upgrades = the line's CURRENT price. Handles a
        // negotiated price (no components → base = current) and a customize-saved
        // one (components → base = current − upgrades = the original base) without
        // double-counting. Only when we know the current line total.
        const current = this.currentPrice() ?? this.originalPrice();
        if (current != null) {
          const qty = Math.max(1, Number(this.baseQuantity()) || 1);
          const upContribution = this.costTotal() * (1 + (Number(this.margin()) || 0) / 100);
          const baseTotal = Math.max(0, current - upContribution);
          this.baseRate.set(Math.round((baseTotal / qty) * 100) / 100);
        }
        this.loaded.set(true);
      },
      // Load failed → leave `loaded` false so Save stays blocked (never wipe).
      error: () => this.rows.set([this.blank()]),
    });
    // Offer the demo (project mode only) when there's a base to build on.
    if (!this.itemMode() && this.originalPrice() != null && this.baseCategoryId() != null && !this.demoSuppressed()) {
      this.coachPhase.set('ask');
    }
  }

  private mk(r: Omit<Row, '_k'>): Row { return { ...r, _k: RUID++ }; }
  /** Map a stored child → a row (coerce NUMERIC strings to numbers). */
  private rowFrom(c: { id: string; name: string; base_price: number | null; quantity: number; unit: string | null; category_id: string | null; selection_type: string; description?: string | null; image_url?: string | null }): Row {
    return this.mk({
      id: c.id, name: c.name, cost: c.base_price == null ? null : Number(c.base_price),
      qty: c.quantity, unit: c.unit, categoryId: c.category_id, included: c.selection_type === 'selected',
      description: c.description ?? null, image: c.image_url ?? null,
    });
  }
  protected lineTotal(r: Row): number { return (Number(r.cost) || 0) * Math.max(1, Number(r.qty) || 1); }
  private blank(): Row {
    return this.mk({ id: null, name: '', cost: null, qty: 1, unit: null, categoryId: this.lastCategory(), included: true, description: null, image: null });
  }
  private lastCategory(): string | null {
    const rs = this.rows();
    return rs.length ? rs[rs.length - 1].categoryId : null;
  }
  /** Category change re-triggers the signal so the banding recomputes. */
  protected setCategory(r: Row, val: string | null): void {
    r.categoryId = val || null;
    this.rows.set([...this.rows()]);
  }
  protected addRow(): void { this.rows.set([...this.rows(), this.blank()]); }
  /** Add a blank row pre-set to a category (or null → the Extras card). */
  protected addRowIn(catId: string | null): void {
    this.rows.set([...this.rows(), this.mk({ id: null, name: '', cost: null, qty: 1, unit: null, categoryId: catId, included: true, description: null, image: null })]);
  }
  /** The category cards to render: real categories first, then an always-present
   *  "Extras" card (the null-category bucket) that houses the margin + the
   *  un-filtered add. */
  protected readonly displayGroups = computed(() => {
    const groups = this.rowGroups();
    const real = groups.filter((g) => g.categoryId != null).map((g) => ({ ...g, isExtras: false }));
    // Ensure the item's own category card exists even before any component is
    // added — the base row folds in as row-0 of it.
    const baseCat = this.baseCategoryId();
    if (baseCat != null && !real.some((g) => g.categoryId === baseCat)) {
      real.unshift({ categoryId: baseCat, rows: [], total: 0, isExtras: false });
    }
    const nul = groups.find((g) => g.categoryId == null);
    return [...real, { categoryId: null as string | null, rows: nul?.rows ?? [], total: nul?.total ?? 0, isExtras: true }];
  });
  /** The cards actually rendered — Extras (margin editor + uncategorised) is
   *  HIDDEN for now (Liam 2026-08-31); margin still applies at its default. */
  protected readonly cardGroups = computed(() => this.displayGroups().filter((g) => !g.isExtras));
  /** `{key}` substitutions for the Customize teaching coachmark — the specific
   *  item's numbers, so the bubble explains the base with real values. */
  protected readonly coachVars = computed(() => ({
    item: this.parentName() || 'this item',
    rate: '£' + (Number(this.baseRate()) || 0),
    unit: this.baseUnitDraft() || 'unit',
    qty: String(this.baseQty()),
    total: '£' + Math.round(this.baseCost()).toLocaleString('en-GB'),
  }));

  // ── Customize demo wizard — opt-in "want me to show you?" → a self-running
  //    example that adds an Insurance line, fills its fields, shows Include's
  //    effect on the total, then removes the demo line (no side effects). ─────
  protected readonly coachPhase = signal<'ask' | 'run' | 'off'>('off');
  protected readonly demoStep = signal(0);
  /** The demo builds up TWO example lines (Insurance, then a Project Manager);
   *  `row` on each step indexes into this list so the glow follows the right one. */
  private readonly demoRowKs = signal<number[]>([]);
  private readonly DEMO_KEY = 'bp-coachmark:customize:demo';
  private static readonly DEMO_STEPS: { text: string; field: string | null; apply: string | null; row: number | null }[] = [
    { text: "Why don't we add 'Cancellation Insurance'? Give the new line a name.", field: 'name', apply: 'ins-name', row: 0 },
    { text: "Insurance is a one-time £200 charge — so enter 200 in Cost.", field: 'cost', apply: 'ins-cost', row: 0 },
    { text: "Enter Qty 1, and you can leave the unit empty. Now let's add another line.", field: 'qty', apply: 'ins-qty', row: 0 },
    { text: "Add a Project Manager for 2 days to support the project — £200 a day, Qty 2, unit 'day'. That's £400.", field: 'name', apply: 'add-pm', row: 1 },
    { text: "The Include tick offers it to the client and counts it toward the total — watch the Revised go up.", field: 'inc', apply: 'include', row: 1 },
    { text: "Happy with it? Save draft to keep tweaking, or Send new cost for the client to accept.", field: 'save', apply: null, row: null },
  ];
  protected readonly demoCount = CustomizeDialogComponent.DEMO_STEPS.length;
  protected demoText(): string { return CustomizeDialogComponent.DEMO_STEPS[this.demoStep()]?.text ?? ''; }
  protected demoField(): string | null {
    return this.coachPhase() === 'run' ? (CustomizeDialogComponent.DEMO_STEPS[this.demoStep()]?.field ?? null) : null;
  }
  protected isLastStep(): boolean { return this.demoStep() >= this.demoCount - 1; }
  /** The demo row the CURRENT step is acting on (so only it glows). */
  private currentDemoRowK(): number | null {
    const idx = CustomizeDialogComponent.DEMO_STEPS[this.demoStep()]?.row;
    return idx == null ? null : (this.demoRowKs()[idx] ?? null);
  }
  protected isDemoRow(r: Row): boolean { return this.currentDemoRowK() === r._k; }
  protected demoHl(r: Row, field: string): boolean { return this.isDemoRow(r) && this.demoField() === field; }
  private demoSuppressed(): boolean { try { return localStorage.getItem(this.DEMO_KEY) === '1'; } catch { return false; } }

  protected startDemo(): void {
    if (this.baseCategoryId() == null) { this.dismissDemo(); return; }
    const row = this.mk({ id: null, name: '', cost: null, qty: 1, unit: null, categoryId: this.baseCategoryId(), included: true, description: null, image: null });
    this.demoRowKs.set([row._k]);
    this.rows.set([...this.rows(), row]);
    this.coachPhase.set('run');
    this.demoStep.set(0);
    this.applyDemoStep(0);
  }
  protected demoNext(): void {
    if (this.isLastStep()) { this.finishDemo(); return; }
    const next = this.demoStep() + 1;
    this.demoStep.set(next);
    this.applyDemoStep(next);
  }
  protected dismissDemo(): void {
    this.coachPhase.set('off');
    try { localStorage.setItem(this.DEMO_KEY, '1'); } catch { /* private mode */ }
  }
  /** "Show me around" — force the demo back on (clears any prior "No thanks"). */
  protected replayDemo(): void {
    try { localStorage.removeItem(this.DEMO_KEY); } catch { /* private mode */ }
    this.demoStep.set(0);
    this.coachPhase.set('ask');
  }
  private finishDemo(): void {
    // The demo lines were a demonstration — remove them both.
    for (const k of this.demoRowKs()) { const r = this.rows().find((x) => x._k === k); if (r) this.removeRow(r); }
    this.demoRowKs.set([]);
    // Don't suppress on finish — the opt-in returns next open (only "No thanks"
    // permanently hides it).
    this.coachPhase.set('off');
  }
  private applyDemoStep(step: number): void {
    const r0 = this.rows().find((x) => x._k === this.demoRowKs()[0]);
    switch (CustomizeDialogComponent.DEMO_STEPS[step]?.apply) {
      case 'ins-name': if (r0) r0.name = 'Cancellation Insurance'; break;
      case 'ins-cost': if (r0) r0.cost = 200; break;
      case 'ins-qty': if (r0) { r0.qty = 1; r0.unit = null; } break;
      case 'add-pm': {
        // Second example line: a 2-day Project Manager (£200/day × 2 = £400).
        const pm = this.mk({ id: null, name: 'Project Manager', cost: 200, qty: 2, unit: 'day', categoryId: this.baseCategoryId(), included: true, description: null, image: null });
        this.demoRowKs.set([...this.demoRowKs(), pm._k]);
        this.rows.set([...this.rows(), pm]);
        return; // rows already re-set
      }
      case 'include': for (const k of this.demoRowKs()) { const r = this.rows().find((x) => x._k === k); if (r) r.included = true; } break;
    }
    this.rows.set([...this.rows()]);
  }

  /** A category card's displayed total: Extras = the margin; the item's own
   *  category also adds the base row; others = just their component rows. */
  protected catCardTotal(grp: { categoryId: string | null; total: number; isExtras: boolean }): number {
    if (grp.isExtras) return this.marginAmount();
    return grp.total + (grp.categoryId === this.baseCategoryId() ? this.baseCost() : 0);
  }
  /** Is this the item's own category card (where the base row folds in)? */
  protected isBaseCat(categoryId: string | null): boolean {
    return this.originalPrice() != null && categoryId === this.baseCategoryId();
  }
  protected removeRow(r: Row): void {
    if (this.selectedRowK() === r._k) this.selectedRowK.set(null);
    const next = this.rows().filter((x) => x._k !== r._k);
    this.rows.set(next.length ? next : [this.blank()]);
  }
  /** Select a row → its card fills the right rail (add a description/image). */
  protected selectRow(r: Row): void { this.selectedRowK.set(r._k); this.parentSelected.set(false); }
  /** Read a picked image into a data URL held on the row (client-only draft). */
  protected onPickImage(r: Row, ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { r.image = reader.result as string; this.rows.set([...this.rows()]); };
    reader.readAsDataURL(file);
  }
  protected clearImage(r: Row): void { r.image = null; this.rows.set([...this.rows()]); }
  // ── Explore shuttle adapters (library ⇄ shuttle, estimate rows ⇄ picks) ──
  /** When Explore is opened from a category card, its id scopes the library to
   *  that category; null (the Extras card / global) shows everything. */
  protected readonly exploreCatId = signal<string | null>(null);
  protected openExplore(catId: string | null): void { this.exploreCatId.set(catId); this.exploring.set(true); }
  /** The launched category's NAME — seeds the shuttle's filter (still switchable). */
  protected readonly exploreCatName = computed(() => { const id = this.exploreCatId(); return id ? this.catName(id) : null; });
  /** The FULL library for the shuttle (the shuttle's dropdown filters it). */
  protected readonly shuttleAvailable = computed<ShuttleItem[]>(() =>
    this.myComponents().map((c) => ({
      id: c.id, name: c.name,
      price: c.base_price == null ? null : Number(c.base_price),
      groupName: this.catName(c.category_id),
    }))
  );
  protected readonly shuttlePicks = computed<ShuttlePick[]>(() =>
    this.rows().filter((r) => r.name.trim()).map((r) => ({
      id: String(r._k), name: r.name, cost: r.cost, qty: r.qty,
      groupName: this.catName(r.categoryId),
    }))
  );
  protected onShuttleAdd(si: ShuttleItem): void {
    const c = this.myComponents().find((x) => x.id === si.id);
    if (c) this.addFromComponent(c);
  }
  protected onShuttleRemove(id: string): void {
    const r = this.rows().find((x) => String(x._k) === id);
    if (r) this.removeRow(r);
  }
  protected onShuttleQty(e: { id: string; qty: number }): void {
    const r = this.rows().find((x) => String(x._k) === e.id);
    if (r) { r.qty = e.qty; this.rows.set([...this.rows()]); }
  }
  protected addFromComponent(c: MyComponent): void {
    const row = this.mk({ id: null, name: c.name, cost: c.base_price == null ? null : Number(c.base_price), qty: 1, unit: c.unit, categoryId: c.category_id ?? this.lastCategory(), included: true, description: c.description ?? null, image: c.image_url ?? null });
    this.rows.set([...this.rows().filter((r) => r.name.trim()), row]);
  }

  /** The rows as save inputs (named components only). */
  private buildComponents(): ComponentInput[] {
    return this.rows()
      .filter((r) => r.name.trim())
      .map((r) => ({
        id: r.id ?? undefined,
        categoryId: r.categoryId,
        name: r.name.trim(),
        cost: r.cost == null ? null : Number(r.cost),
        unit: r.unit || null,
        quantity: Math.max(1, Number(r.qty) || 1),
        kind: 'estimate',
        included: r.included,
        description: r.description,
        image: r.image,
      }));
  }
  private marginNum(): number | null { return this.margin() == null ? null : Number(this.margin()); }
  /** The parent item's edited name + description, for the save payload. */
  private parentPatch(): { name?: string; description: string | null; services: string | null; quantity?: number; unit?: string | null } {
    // The base row is the parent line itself — persist its edited qty/unit too,
    // but only when that row is actually shown/editable (originalPrice != null).
    const base = this.originalPrice() != null;
    return {
      name: this.parentName().trim() || undefined,
      description: this.parentDesc().trim() || null,
      services: this.parentServices().trim() || null,
      ...(base ? { quantity: Math.max(1, Number(this.baseQty()) || 1), unit: this.baseUnitDraft() ?? null } : {}),
    };
  }

  /** Send New Cost: persist the buildup (no price — the price rides the
   *  proposal), then hand the total to the inbox to post as a new-cost move. */
  protected confirmSend(): void {
    const total = this.sendPrice();
    if (total == null || this.saving() || !this.loaded()) return;
    this.saving.set(true);
    this.projects.saveComponents(this.projectId(), this.lineId(), this.buildComponents(), null, this.marginNum(), this.parentPatch()).subscribe({
      next: () => { this.saving.set(false); this.sendConfirm.set(false); this.sendCost.emit(total); },
      error: () => { this.saving.set(false); },
    });
  }

  /** Save draft — persist the buildup + margin + the current revised price, so
   *  the header's revised refreshes (no proposal message). Stays open. */
  protected save(close: boolean): void {
    if (this.saving() || !this.loaded()) return; // never reconcile before load
    const components = this.buildComponents();
    this.saving.set(true);
    // Item mode persists to the catalogue item (no price/margin — item-level);
    // project mode reconciles the line + the current revised price.
    const save$ = this.itemMode()
      ? this.store.saveComponents(this.itemId()!, components)
      : this.projects.saveComponents(this.projectId(), this.lineId(), components, this.withMargin(), this.marginNum(), this.parentPatch());
    save$.subscribe({
      next: (cs) => {
        this.saving.set(false);
        if (close) { this.saved.emit(); return; }
        // Save (stay open): keep the on-screen ORDER — don't re-sort from the
        // server's created_at (that jumps new rows to the bottom). Just stamp
        // the persisted id onto each row that lacked one (match by name).
        const claimed = new Set<string>();
        const next = this.rows().filter((r) => r.name.trim()).map((r) => {
          if (r.id && cs.some((c) => c.id === r.id)) { claimed.add(r.id); return r; }
          const m = cs.find((c) => !claimed.has(c.id) && c.name === r.name.trim());
          if (m) { claimed.add(m.id); return { ...r, id: m.id }; }
          return r;
        });
        this.rows.set(next.length ? next : [this.blank()]);
        this.projects.listMyComponents().subscribe({ next: (mc) => this.myComponents.set(mc), error: () => {} });
        this.changed.emit(); // refresh the thread header's revised total
      },
      error: () => { this.saving.set(false); },
    });
  }

  /** Persist the current buildup as a draft — used when the parent switches to a
   *  different line so edits aren't lost (save-before-switch). buildComponents()
   *  captures the rows synchronously; the request completes even as this dialog
   *  is torn down and reopened on the new line. No-op if nothing is loaded. */
  saveDraftPublic(): void { this.save(false); }
}
