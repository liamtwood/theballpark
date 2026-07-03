import { ChangeDetectionStrategy, Component, computed, inject, input, output, resource, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { ProjectService } from '../../core/projects/project.service';
import { EstimateBreakdown, ProjectDetail, QuoteLine, groupByCategory } from '../../core/projects/project.types';
import { errorDetail } from '../../core/http-error';
import { QtyInputComponent } from './qty-input.component';
import { ProjectOutreachStore } from './project-outreach.store';

/** pV2-PROJECTS-02 slice 3 — the Estimate tab. Ports the v1 estimate
 *  breakdown (Subtotal → Contingency → Your cost → Margin → VAT → Client
 *  total + budget bar) computed from the project's quote items + its
 *  financial defaults — exactly v1's recalc() math (which itself sums the
 *  cart when category costs are stale, our case). INDICATIVE: the
 *  server-side priced rollup + checkout land in 06f. */
@Component({
  selector: 'app-project-estimate',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, LucideAngularModule, QtyInputComponent],
  host: { class: 'block' },
  template: `
    <div>
      <h2 class="bp-page-title pt-2 text-center">Project Quote</h2>

      <!-- Summary tiles span the full page width as one row (Liam 2026-06-14):
           5 cards — Date / Location / Duration / Guest count / Budget. The rest
           of the quote keeps the narrower max-w-2xl column below. flex sits on
           an INNER div — .bp-card is display:block and beats a flex utility. -->
      <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        <div class="bp-card p-3.5">
          <div class="flex items-start gap-3">
            <span class="bp-icon-block h-10 w-10 shrink-0"><lucide-icon name="calendar" [size]="18" [strokeWidth]="1.75" /></span>
            <span class="min-w-0">
              <span class="bp-field-label block">Date</span>
              <span class="bp-body-small block truncate text-text">{{ project().eventDate || '—' }}</span>
            </span>
          </div>
        </div>
        <div class="bp-card p-3.5">
          <div class="flex items-start gap-3">
            <span class="bp-icon-block h-10 w-10 shrink-0"><lucide-icon name="map-pin" [size]="18" [strokeWidth]="1.75" /></span>
            <span class="min-w-0">
              <span class="bp-field-label block">Location</span>
              <span class="bp-body-small block truncate text-text">{{ project().venueCity || project().venueName || '—' }}</span>
            </span>
          </div>
        </div>
        <div class="bp-card p-3.5">
          <div class="flex items-start gap-3">
            <span class="bp-icon-block h-10 w-10 shrink-0"><lucide-icon name="clock" [size]="18" [strokeWidth]="1.75" /></span>
            <span class="min-w-0">
              <span class="bp-field-label block">Duration</span>
              <span class="bp-body-small block truncate text-text">{{ project().durationDays ? project().durationDays + (project().durationDays === 1 ? ' day' : ' days') : '—' }}</span>
            </span>
          </div>
        </div>
        <div class="bp-card p-3.5">
          <div class="flex items-start gap-3">
            <span class="bp-icon-block h-10 w-10 shrink-0"><lucide-icon name="users" [size]="18" [strokeWidth]="1.75" /></span>
            <span class="min-w-0">
              <span class="bp-field-label block">Guest count</span>
              <span class="bp-body-small block truncate text-text">{{ project().guestCount ?? '—' }}</span>
            </span>
          </div>
        </div>
        <div class="bp-card p-3.5">
          <div class="flex items-start gap-3">
            <span class="bp-icon-block h-10 w-10 shrink-0"><lucide-icon name="wallet" [size]="18" [strokeWidth]="1.75" /></span>
            <span class="min-w-0">
              <span class="bp-field-label block">Budget</span>
              <span class="bp-body-small block truncate text-text">{{ project().projectBudget ? (project().projectBudget | currency: cur() : 'symbol' : '1.0-0') : '—' }}</span>
            </span>
          </div>
        </div>
      </div>

      <!-- The rest of the quote keeps the narrower reading column. -->
      <div class="mx-auto max-w-2xl">

      <!-- Estimated Ballpark Cost banner (the headline = client total). -->
      <div class="bp-quote-banner mt-5 px-6 py-7 text-center">
        <div class="bp-body-small">Estimated Ballpark Cost</div>
        <div class="bp-amount-hero mt-1">{{ bd().clientTotal | currency: cur() : 'symbol' : '1.0-0' }}</div>
      </div>

      <div class="mt-5"></div>

      @if (lines.isLoading()) {
        <p class="bp-body-small text-secondary">Loading…</p>
      } @else if (lines.error()) {
        <p class="bp-body-small text-warn">Couldn't load the quote — please refresh.</p>
      } @else if (rows().length === 0) {
        <p class="bp-body-small text-secondary">No items in the quote yet — add some from the Marketplace tab.</p>
      } @else {
        <p class="bp-field-label uppercase tracking-wide">Categories</p>
        <div class="mt-2 flex flex-col gap-2.5">
          @for (g of groups(); track g.id) {
            <!-- Category card (add-project-2 style): cat image left in the
                 home action-card rounded square, name, cat total right, a
                 chevron that expands the items underneath. -->
            <div class="bp-card overflow-hidden">
              <button type="button" class="flex w-full items-center gap-3.5 p-3 text-left" (click)="toggle(g.id)">
                @if (g.image) {
                  <img [src]="g.image" alt="" class="bp-est-thumb shrink-0 object-cover" />
                } @else {
                  <span class="bp-icon-block bp-est-thumb shrink-0">
                    <lucide-icon [name]="g.iconName || 'folder-open'" [size]="20" [strokeWidth]="1.5" />
                  </span>
                }
                <span class="min-w-0 flex-1">
                  <span class="bp-list-title block truncate">{{ g.name }}</span>
                  <span class="bp-meta">{{ g.items.length }} item{{ g.items.length === 1 ? '' : 's' }}</span>
                </span>
                <span class="bp-amount shrink-0 text-text">{{ g.total | currency: cur() : 'symbol' : '1.0-0' }}</span>
                <lucide-icon [name]="expanded().has(g.id) ? 'chevron-down' : 'chevron-right'" [size]="18" class="shrink-0 text-muted" />
              </button>

              @if (expanded().has(g.id)) {
                <div class="border-t border-hairline">
                  @for (l of g.items; track l.id) {
                    <!-- Item row — the marketplace list-view shape (thumb + name + price). -->
                    <div class="flex items-center gap-3 border-b border-hairline px-3 py-2 last:border-b-0">
                      @if (l.imageUrl) {
                        <img [src]="l.imageUrl" alt="" class="h-9 w-9 shrink-0 rounded-md object-cover" />
                      } @else {
                        <span class="bp-icon-block h-9 w-9 shrink-0"><lucide-icon name="store" [size]="14" /></span>
                      }
                      <span class="bp-body min-w-0 flex-1 truncate">{{ l.name }}</span>
                      <app-qty-input class="shrink-0" [value]="l.quantity" [label]="l.name" (qtyCommit)="onQtyChange(l.itemId, $event)" />
                      <span class="bp-body-small w-20 shrink-0 text-right text-secondary">{{ lineCost(l) | currency: cur() : 'symbol' : '1.0-0' }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- Subtotal → contingency → your cost (v1 layout). -->
        <div class="mt-5 flex flex-col gap-1.5">
          <div class="flex justify-between bp-body-small text-secondary"><span>Subtotal</span><span>{{ bd().subtotal | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          @if (bd().contingencyPct > 0) {
            <div class="flex justify-between bp-body-small text-secondary"><span>Contingency ({{ bd().contingencyPct }}%)</span><span>{{ bd().contingency | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          }
        </div>
        <div class="mt-3 flex items-baseline justify-between border-t border-hairline pt-3">
          <span class="bp-field-label">Your cost</span>
          <span class="bp-amount text-text">{{ bd().ourCost | currency: cur() : 'symbol' : '1.0-0' }}</span>
        </div>

        <!-- Margin → VAT → client total. -->
        <div class="mt-3 flex flex-col gap-1.5">
          <div class="flex justify-between bp-body-small text-secondary"><span>Margin ({{ bd().marginPct }}%)</span><span>{{ bd().marginAmount | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          @if (bd().vatPct > 0) {
            <div class="flex justify-between bp-body-small text-secondary"><span>VAT ({{ bd().vatPct }}%)</span><span>{{ bd().vatAmount | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          }
        </div>
        <div class="mt-3 flex items-baseline justify-between border-t border-hairline pt-3">
          <span class="bp-list-title">Client total</span>
          <span class="bp-price-large">{{ bd().clientTotal | currency: cur() : 'symbol' : '1.0-0' }}</span>
        </div>

        @if (budget() > 0) {
          <div class="bp-card mt-5 p-4">
            <div class="flex items-center justify-between">
              <span class="bp-field-label">{{ bd().clientTotal <= budget() ? 'Within budget' : 'Over budget' }}</span>
              <span class="bp-amount" [class.text-success]="bd().clientTotal <= budget()" [class.text-danger]="bd().clientTotal > budget()">
                {{ budgetDiff() | currency: cur() : 'symbol' : '1.0-0' }}
              </span>
            </div>
            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-fill">
              <div class="h-full rounded-full" [class.bg-success]="bd().clientTotal <= budget()" [class.bg-danger]="bd().clientTotal > budget()" [style.width.%]="barPct()"></div>
            </div>
            <div class="mt-1.5 flex justify-between"><span class="bp-meta">Client total {{ bd().clientTotal | currency: cur() : 'symbol' : '1.0-0' }}</span><span class="bp-meta">Budget {{ budget() | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          </div>
        }

        <p class="bp-caption mt-4">Indicative — based on marketplace base prices. Final supplier quotes and the priced rollup land with checkout.</p>

        <!-- Forward action. With suppliers picked, this IS the final quote
             view: send the brief out. Otherwise, go pick suppliers. -->
        @if (outreach.supplierCount(); as n) {
          <button type="button" class="bp-btn-grad mt-5 w-full" (click)="messageSuppliers.emit()">
            <lucide-icon name="send" [size]="16" />
            Message {{ n }} supplier{{ n === 1 ? '' : 's' }}
          </button>
          <button type="button" class="bp-btn-outline mt-2 w-full" (click)="goToMarketplace.emit()">
            Add more suppliers
          </button>
        } @else {
          <button type="button" class="bp-btn-grad mt-5 w-full" (click)="goToMarketplace.emit()">
            Go with this Ballpark
            <lucide-icon name="arrow-right" [size]="16" />
          </button>
        }
      }
      </div>
    </div>
  `,
})
export class ProjectEstimateComponent {
  private readonly projects = inject(ProjectService);
  private readonly toast = inject(MessageService);
  protected readonly outreach = inject(ProjectOutreachStore);

  readonly projectId = input.required<string>();
  readonly project = input.required<ProjectDetail>();
  /** "Go with this Ballpark" — hand off to the in-project Marketplace's
   *  supplier fan-out (project-detail switches the tab + supplier mode). */
  readonly goToMarketplace = output<void>();
  /** "Message suppliers" — fire the outreach send (wired in slice 4). */
  readonly messageSuppliers = output<void>();

  /** Quote lines as writable state (seeded from the resource load) so qty
   *  edits can update optimistically + revert on failure. */
  protected readonly rows = signal<QuoteLine[]>([]);
  protected readonly lines = resource<QuoteLine[], string>({
    params: () => this.projectId(),
    loader: async ({ params }) => {
      const ls = await firstValueFrom(this.projects.quoteItems(params));
      this.rows.set(ls);
      return ls;
    },
  });

  /** Inline quantity edit on a quote line — optimistic, revert + toast on
   *  failure. The cascade (subtotal → … → client total) and the category
   *  totals are qty-weighted via lineCost(), so they recompute automatically. */
  protected async onQtyChange(itemId: string, quantity: number): Promise<void> {
    const before = this.rows();
    this.rows.update((ls) => ls.map((l) => (l.itemId === itemId ? { ...l, quantity } : l)));
    try {
      await firstValueFrom(this.projects.setQuoteItemQuantity(this.projectId(), itemId, quantity));
      // The cascade is server-authoritative — pull the fresh breakdown.
      this.est.reload();
    } catch (err) {
      this.rows.set(before);
      this.toast.add({ severity: 'error', summary: "Couldn't update the quantity — please try again.", detail: errorDetail(err), life: 4000 });
    }
  }

  /** Quote lines grouped by category — one card per category, with its
   *  summed total + the first item's image as the cover. */
  protected readonly groups = computed(() =>
    groupByCategory(this.rows()).map((g) => ({
      ...g,
      total: g.items.reduce((s, l) => s + this.lineCost(l), 0),
      // Category card icon: the category's cover image, else its Lucide
      // icon (Liam 2026-06-14). All lines in a group share the category.
      image: g.items[0]?.categoryCoverUrl ?? null,
      iconName: g.items[0]?.categoryIconName ?? null,
    }))
  );

  protected readonly expanded = signal<ReadonlySet<string>>(new Set());
  protected toggle(catId: string): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  protected lineCost(l: QuoteLine): number {
    return (l.basePrice ?? 0) * (l.quantity ?? 1);
  }
  protected readonly cur = computed(() => this.project().currency || 'GBP');
  protected readonly budget = computed(() => this.project().projectBudget ?? 0);

  /** The estimate cascade — SERVER-computed (services/estimate.js), consumed
   *  as-is so this tab and the project card can't drift. Reloaded after a qty
   *  edit (qtyCommit → onQtyChange). */
  protected readonly est = resource<EstimateBreakdown, string>({
    params: () => this.projectId(),
    loader: ({ params }) => firstValueFrom(this.projects.estimate(params)),
  });

  /** The breakdown the template renders: the server value once loaded, else a
   *  zeroed placeholder seeded with the project's rates so the "%" labels don't
   *  flash before the first load. */
  protected readonly bd = computed<EstimateBreakdown>(() => {
    const v = this.est.value();
    if (v) return v;
    return {
      subtotal: 0,
      contingencyPct: this.project().defaultContingencyPct ?? 10,
      marginPct: this.project().defaultMarginPct ?? 20,
      vatPct: this.project().defaultVatPct ?? 20,
      contingency: 0,
      ourCost: 0,
      marginAmount: 0,
      vatAmount: 0,
      clientTotal: 0,
    };
  });

  protected readonly budgetDiff = computed(() => (this.budget() > 0 ? this.bd().clientTotal - this.budget() : 0));
  protected readonly barPct = computed(() =>
    this.budget() > 0 ? Math.min((this.bd().clientTotal / this.budget()) * 100, 100) : 0
  );
}
