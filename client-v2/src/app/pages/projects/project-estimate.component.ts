import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { ProjectService } from '../../core/projects/project.service';
import { ProjectDetail, QuoteLine } from '../../core/projects/project.types';

/** pV2-PROJECTS-02 slice 3 — the Estimate tab. Ports the v1 estimate
 *  breakdown (Subtotal → Contingency → Your cost → Margin → VAT → Client
 *  total + budget bar) computed from the project's quote items + its
 *  financial defaults — exactly v1's recalc() math (which itself sums the
 *  cart when category costs are stale, our case). INDICATIVE: the
 *  server-side priced rollup + checkout land in 06f. */
@Component({
  selector: 'app-project-estimate',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, LucideAngularModule],
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
        <div class="bp-amount-hero mt-1">{{ clientTotal() | currency: cur() : 'symbol' : '1.0-0' }}</div>
      </div>

      <div class="mt-5"></div>

      @if (lines.isLoading()) {
        <p class="bp-body-small text-secondary">Loading…</p>
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
                      <span class="bp-body-small shrink-0 text-secondary">{{ lineCost(l) | currency: cur() : 'symbol' : '1.0-0' }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- Subtotal → contingency → your cost (v1 layout). -->
        <div class="mt-5 flex flex-col gap-1.5">
          <div class="flex justify-between bp-body-small text-secondary"><span>Subtotal</span><span>{{ subtotal() | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          @if (contingencyPct() > 0) {
            <div class="flex justify-between bp-body-small text-secondary"><span>Contingency ({{ contingencyPct() }}%)</span><span>{{ contingency() | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          }
        </div>
        <div class="mt-3 flex items-baseline justify-between border-t border-hairline pt-3">
          <span class="bp-field-label">Your cost</span>
          <span class="bp-amount text-text">{{ ourCost() | currency: cur() : 'symbol' : '1.0-0' }}</span>
        </div>

        <!-- Margin → VAT → client total. -->
        <div class="mt-3 flex flex-col gap-1.5">
          <div class="flex justify-between bp-body-small text-secondary"><span>Margin ({{ marginPct() }}%)</span><span>{{ marginAmount() | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          @if (vatPct() > 0) {
            <div class="flex justify-between bp-body-small text-secondary"><span>VAT ({{ vatPct() }}%)</span><span>{{ vatAmount() | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          }
        </div>
        <div class="mt-3 flex items-baseline justify-between border-t border-hairline pt-3">
          <span class="bp-list-title">Client total</span>
          <span class="bp-price-large">{{ clientTotal() | currency: cur() : 'symbol' : '1.0-0' }}</span>
        </div>

        @if (budget() > 0) {
          <div class="bp-card mt-5 p-4">
            <div class="flex items-center justify-between">
              <span class="bp-field-label">{{ clientTotal() <= budget() ? 'Within budget' : 'Over budget' }}</span>
              <span class="bp-amount" [class.text-success]="clientTotal() <= budget()" [class.text-danger]="clientTotal() > budget()">
                {{ budgetDiff() | currency: cur() : 'symbol' : '1.0-0' }}
              </span>
            </div>
            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-fill">
              <div class="h-full rounded-full" [class.bg-success]="clientTotal() <= budget()" [class.bg-danger]="clientTotal() > budget()" [style.width.%]="barPct()"></div>
            </div>
            <div class="mt-1.5 flex justify-between"><span class="bp-meta">Client total {{ clientTotal() | currency: cur() : 'symbol' : '1.0-0' }}</span><span class="bp-meta">Budget {{ budget() | currency: cur() : 'symbol' : '1.0-0' }}</span></div>
          </div>
        }

        <p class="bp-caption mt-4">Indicative — based on marketplace base prices. Final supplier quotes and the priced rollup land with checkout.</p>
      }
      </div>
    </div>
  `,
})
export class ProjectEstimateComponent {
  private readonly projects = inject(ProjectService);

  readonly projectId = input.required<string>();
  readonly project = input.required<ProjectDetail>();

  protected readonly lines = resource<QuoteLine[], string>({
    params: () => this.projectId(),
    loader: ({ params }) => firstValueFrom(this.projects.quoteItems(params)),
  });
  protected readonly rows = computed(() => this.lines.value() ?? []);

  /** Quote lines grouped by category — one card per category, with its
   *  summed total + the first item's image as the cover. */
  protected readonly groups = computed(() => {
    const byCat = new Map<string, { id: string; name: string; items: QuoteLine[] }>();
    for (const l of this.rows()) {
      const id = l.categoryId ?? '__none';
      const name = l.categoryName ?? 'Uncategorised';
      let g = byCat.get(id);
      if (!g) {
        g = { id, name, items: [] };
        byCat.set(id, g);
      }
      g.items.push(l);
    }
    return [...byCat.values()].map((g) => ({
      ...g,
      total: g.items.reduce((s, l) => s + this.lineCost(l), 0),
      // Category card icon: the category's cover image, else its Lucide
      // icon (Liam 2026-06-14). All lines in a group share the category.
      image: g.items[0]?.categoryCoverUrl ?? null,
      iconName: g.items[0]?.categoryIconName ?? null,
    }));
  });

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

  // v1 defaults when the project's are unset: margin 20 / contingency 10 / vat 20.
  protected readonly marginPct = computed(() => this.project().defaultMarginPct ?? 20);
  protected readonly contingencyPct = computed(() => this.project().defaultContingencyPct ?? 10);
  protected readonly vatPct = computed(() => this.project().defaultVatPct ?? 20);
  protected readonly budget = computed(() => this.project().projectBudget ?? 0);

  // v1 recalc(), verbatim.
  protected readonly subtotal = computed(() =>
    this.rows().reduce((s, l) => s + this.lineCost(l), 0)
  );
  protected readonly contingency = computed(() => this.subtotal() * (this.contingencyPct() / 100));
  protected readonly ourCost = computed(() => this.subtotal() + this.contingency());
  protected readonly marginAmount = computed(() => this.ourCost() * (this.marginPct() / 100));
  private readonly preVat = computed(() => this.ourCost() + this.marginAmount());
  protected readonly vatAmount = computed(() => this.preVat() * (this.vatPct() / 100));
  protected readonly clientTotal = computed(() => this.preVat() + this.vatAmount());
  protected readonly budgetDiff = computed(() => (this.budget() > 0 ? this.clientTotal() - this.budget() : 0));
  protected readonly barPct = computed(() =>
    this.budget() > 0 ? Math.min((this.clientTotal() / this.budget()) * 100, 100) : 0
  );
}
