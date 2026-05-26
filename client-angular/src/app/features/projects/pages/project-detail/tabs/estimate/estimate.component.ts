import { Component, OnInit, ChangeDetectorRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ProjectService } from '../../../../../../core/services/project.service';
import { ProjectItemService } from '../../../../../../core/services/project-item.service';
import { GbpPipe } from '../../../../../../shared/pipes/gbp.pipe';
import { LoadingSpinnerComponent } from '../../../../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-estimate',
  standalone: true,
  imports: [
    CommonModule, RouterModule,
    LucideAngularModule,
    GbpPipe, LoadingSpinnerComponent
  ],
  template: `
    <div class="bp-page">
    <app-loading *ngIf="loading"></app-loading>
    <ng-container *ngIf="!loading">

      <div class="bp-est-body">

        <!-- CATEGORY ROWS -->
        <!-- v1.65co — uses category_name + category_icon_name from the
             joined /projects/:id/categories endpoint (was hitting the
             bare /project-categories endpoint with no JOIN, so name
             came back null and the rows were nameless). -->
        <div class="bp-est-section-label">Categories</div>
        <div class="bp-est-cats">
          <div *ngFor="let cat of categories" class="bp-est-cat-row">
            <lucide-icon [name]="iconFor(cat)" [size]="16" class="bp-est-cat-icon"></lucide-icon>
            <span class="bp-est-cat-name">{{ cat.category_name || cat.name || 'Untitled' }}</span>
            <span class="bp-est-cat-cost">{{ costOf(cat) | gbp }}</span>
          </div>
          <div *ngIf="categories.length === 0" class="bp-est-empty">
            No categories yet — add some in the Marketplace.
          </div>
        </div>

        <!-- TOTALS -->
        <!-- v1.65co — delivery row dropped (price assumed all-in).
             Contingency stays, VAT row added between Margin and the
             client total. -->
        <div class="bp-est-totals" *ngIf="categories.length > 0">
          <div class="bp-est-total-row">
            <span>Subtotal</span>
            <span>{{ subtotal | gbp }}</span>
          </div>
          <div class="bp-est-total-row" *ngIf="contingencyPct > 0">
            <span>Contingency ({{ contingencyPct }}%)</span>
            <span>{{ contingency | gbp }}</span>
          </div>
        </div>

        <!-- YOUR COST -->
        <div class="bp-est-your-cost" *ngIf="categories.length > 0">
          <div class="bp-est-your-label">Your cost</div>
          <div class="bp-est-your-value">{{ ourCost | gbp }}</div>
        </div>

        <!-- MARGIN + VAT + CLIENT TOTAL -->
        <div class="bp-est-totals bp-est-totals--client" *ngIf="categories.length > 0">
          <div class="bp-est-total-row">
            <span>Margin ({{ marginPct }}%)</span>
            <span>{{ marginAmount | gbp }}</span>
          </div>
          <div class="bp-est-total-row" *ngIf="vatPct > 0">
            <span>VAT ({{ vatPct }}%)</span>
            <span>{{ vatAmount | gbp }}</span>
          </div>
        </div>
        <div class="bp-est-client-total" *ngIf="categories.length > 0">
          <div class="bp-est-client-label">Client total</div>
          <div class="bp-est-client-value">{{ clientTotal | gbp }}</div>
        </div>

        <!-- BUDGET INDICATOR -->
        <div class="bp-est-budget-card" *ngIf="budget > 0 && categories.length > 0"
          [class.over]="clientTotal > budget">
          <div class="bp-est-budget-header">
            <lucide-icon [name]="clientTotal <= budget ? 'check-square' : 'alert-triangle'" [size]="16"></lucide-icon>
            <span class="bp-est-budget-label">{{ clientTotal <= budget ? 'Within budget' : 'Over budget' }}</span>
            <span class="bp-est-budget-diff">{{ budgetDiff | gbp }}</span>
          </div>
          <div class="bp-est-budget-bar-wrap">
            <div class="bp-est-budget-bar" [style.width.%]="barPct"></div>
          </div>
          <div class="bp-est-budget-footer">
            <span>Client total {{ clientTotal | gbp }}</span>
            <span>Budget {{ budget | gbp }}</span>
          </div>
          <div class="bp-est-budget-sub">
            {{ barPct | number:'1.0-0' }}% {{ clientTotal <= budget ? 'under budget — you have headroom to add more' : 'over budget' }}
          </div>
        </div>

      </div>

    </ng-container>
    </div>
  `,
  styles: [`
    .bp-est-body  { padding: 20px var(--section-pad); max-width: 640px; margin: 0 auto; }

    /* v1.65co — section eyebrow (theme-accent uppercase) replaces the
       Playfair "Summary" h2 — the drawer's accent header now owns
       the page-level title, so we just need a subtle "Categories"
       eyebrow to anchor the list. */
    .bp-est-section-label {
      font-family: var(--font-body);
      font-size: 11px; font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--theme-accent);
      margin-bottom: 8px;
    }

    /* CATEGORY ROWS */
    .bp-est-cats { margin-bottom: 0; }
    .bp-est-cat-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 0.5px solid var(--color-border); }
    .bp-est-cat-icon { color: var(--theme-accent); flex-shrink: 0; }
    .bp-est-cat-name { flex: 1; font-size: 14px; color: var(--color-text-primary); }
    .bp-est-cat-cost { font-size: 14px; font-weight: 500; color: var(--color-text-primary); }
    .bp-est-empty { font-size: 13px; color: var(--color-text-muted); padding: 20px 0; text-align: center; }

    /* TOTALS */
    .bp-est-totals { padding: 12px 0; border-bottom: 0.5px solid var(--color-border); margin-bottom: 0; }
    .bp-est-totals--client { border-bottom: none; padding-bottom: 4px; }
    .bp-est-total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: var(--color-text-muted); }

    /* YOUR COST */
    .bp-est-your-cost { display: flex; align-items: baseline; justify-content: space-between; padding: 16px 0 4px; border-bottom: 0.5px solid var(--color-border); }
    .bp-est-your-label { font-family: var(--font-display); font-size: 20px; font-weight: 400; color: var(--color-text-primary); }
    .bp-est-your-value { font-family: var(--font-display); font-size: 28px; font-weight: 700; color: var(--color-text-primary); }

    /* CLIENT TOTAL — v1.65co. Theme-accent display row so the
       VAT-inclusive client price reads as the headline number. */
    .bp-est-client-total {
      display: flex; align-items: baseline; justify-content: space-between;
      padding: 12px 14px; margin-top: 8px; margin-bottom: 16px;
      background: var(--theme-soft);
      border: var(--border-hairline);
      border-radius: var(--radius-button);
    }
    .bp-est-client-label {
      font-family: var(--font-body); font-size: 12px; font-weight: 600;
      letter-spacing: 0.06em; text-transform: uppercase;
      color: var(--theme-accent);
    }
    .bp-est-client-value {
      font-family: var(--font-display); font-size: 22px; font-weight: 500;
      color: var(--theme-accent);
    }

    /* BUDGET CARD — v1.65co token-migrated from hardcoded hex.
       success path → --color-booked-*, danger path → --color-action-*. */
    .bp-est-budget-card {
      border: 0.5px solid var(--color-booked-border);
      background: var(--color-booked-bg);
      border-radius: var(--radius-card);
      padding: 14px;
    }
    .bp-est-budget-card.over {
      border-color: var(--color-action-border);
      background: var(--color-action-bg);
    }
    .bp-est-budget-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .bp-est-budget-header lucide-icon { color: var(--color-booked-text); }
    .bp-est-budget-card.over .bp-est-budget-header lucide-icon { color: var(--color-action-text); }
    .bp-est-budget-label { font-size: 13px; font-weight: 600; color: var(--color-booked-text); flex: 1; }
    .bp-est-budget-card.over .bp-est-budget-label { color: var(--color-action-text); }
    .bp-est-budget-diff { font-size: 13px; font-weight: 600; color: var(--color-booked-text); }
    .bp-est-budget-card.over .bp-est-budget-diff { color: var(--color-action-text); }
    .bp-est-budget-bar-wrap { height: 6px; background: rgba(0,0,0,0.08); border-radius: var(--radius-pill); overflow: hidden; margin-bottom: 8px; }
    .bp-est-budget-bar { height: 100%; background: var(--color-success); border-radius: var(--radius-pill); transition: width 0.4s; max-width: 100%; }
    .bp-est-budget-card.over .bp-est-budget-bar { background: var(--color-danger); }
    .bp-est-budget-footer { display: flex; justify-content: space-between; font-size: 11px; color: var(--color-text-muted); margin-bottom: 4px; }
    .bp-est-budget-sub { font-size: 11px; color: var(--color-text-muted); }

    @media (max-width: 768px) {
      .bp-est-body { padding: 16px; }
    }
  `]
})
export class EstimateComponent implements OnInit {
  /** v1.64 — when set, this overrides the route param; lets the
      EstimateDrawerComponent reuse this view outside the /estimate-legacy
      route (project home, Overview, Marketplace). */
  @Input() projectId?: string;

  loading = true;
  categories: any[] = [];
  /** v1.65cq — project_items loaded so we can heal a stale
      ballpark_cost in costOf() by summing the cart directly. */
  projectItems: any[] = [];
  subtotal = 0;
  contingency = 0;
  ourCost = 0;
  marginAmount = 0;
  vatAmount = 0;
  clientTotal = 0;
  budget = 0;
  budgetDiff = 0;
  barPct = 0;
  contingencyPct = 10;
  marginPct = 20;
  vatPct = 20;
  private pid = '';

  constructor(
    private route: ActivatedRoute,
    private projectSvc: ProjectService,
    private projectItemSvc: ProjectItemService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    if (this.projectId) {
      this.pid = this.projectId;
    } else {
      let r = this.route;
      while (r.parent) r = r.parent;
      this.pid = r.snapshot.paramMap.get('id') || this.route.parent?.snapshot.paramMap.get('id') || '';
    }

    if (this.pid) {
      // v1.65cq — load project + categories + project_items together so
      // costOf() can fall back to summing the cart when both
      // ballpark_cost and base_cost are stale (which is most legacy
      // projects, since the server-side recompute only ran on the
      // AI-matcher path before v1.65cq).
      forkJoin({
        project: this.projectSvc.getById(this.pid).pipe(catchError(() => of(null as any))),
        cats:    this.projectSvc.getCategories(this.pid).pipe(catchError(() => of([] as any[]))),
        items:   this.projectItemSvc.getByProject(this.pid).pipe(catchError(() => of([] as any[]))),
      }).subscribe(({ project, cats, items }) => {
        const p: any = project;
        this.budget         = +p?.project_budget          || 0;
        this.marginPct      = +p?.default_margin_pct      || 20;
        this.contingencyPct = +p?.default_contingency_pct || 10;
        this.vatPct         = +p?.default_vat_pct         || 20;
        this.categories     = (cats || []).filter((c: any) => c.is_active !== false);
        this.projectItems   = items || [];
        this.recalc();
        this.loading = false;
        this.cdr.detectChanges();
      });
    } else {
      this.loading = false;
    }
  }

  /** v1.65co — cost-per-category fallback chain:
        1. ballpark_cost (manually set or server-recomputed)
        2. base_cost (legacy derived field)
        3. v1.65cq — sum of project_items.base_price for this category
           (heals projects whose ballpark_cost wasn't refreshed before
           the v1.65cq server-side recompute landed). Matches by either
           project_category_id (preferred) or item_category_id when the
           project_items row predates v1.18's bucket assignment. */
  costOf(cat: any): number {
    const bp = +cat?.ballpark_cost || 0;
    if (bp > 0) return bp;
    const base = +cat?.base_cost || 0;
    if (base > 0) return base;
    return this.cartCostFor(cat);
  }

  /** Sum project_items.base_price for one project_category. Used only
      as a last-ditch fallback when the stored ballpark_cost / base_cost
      haven't been recomputed yet. */
  private cartCostFor(cat: any): number {
    if (!this.projectItems.length) return 0;
    const pcId  = cat?.id;
    const catId = cat?.category_id;
    return this.projectItems
      .filter(pi =>
        (pcId && pi.project_category_id === pcId) ||
        (catId && pi.item_category_id    === catId))
      .reduce((s, pi) => s + (+pi.base_price || 0), 0);
  }

  /** v1.65co — icon picked straight from the joined category row when
      present; falls back to a name-keyword matcher only when DB icon
      isn't set (legacy categories). */
  iconFor(cat: any): string {
    if (cat?.category_icon_name) return cat.category_icon_name;
    const n = (cat?.category_name || cat?.name || '').toLowerCase();
    if (n.includes('structure') || n.includes('set build') || n.includes('stand')) return 'warehouse';
    if (n.includes('lighting')) return 'spotlight';
    if (n.includes('av') || n.includes('audio') || n.includes('technology')) return 'headset';
    if (n.includes('graphics') || n.includes('signage') || n.includes('print') || n.includes('permits')) return 'signature';
    if (n.includes('catering') || n.includes('hospitality') || n.includes('bar')) return 'martini';
    if (n.includes('talent') || n.includes('staffing') || n.includes('entertainment') || n.includes('security')) return 'person-standing';
    return 'warehouse';
  }

  /** v1.65co — Subtotal → Contingency → Your cost → Margin → VAT →
      Client total. Delivery (was 12% hardcoded) dropped — the per-
      category price is now treated as all-in. */
  recalc() {
    this.subtotal     = this.categories.reduce((s, c) => s + this.costOf(c), 0);
    this.contingency  = this.subtotal * (this.contingencyPct / 100);
    this.ourCost      = this.subtotal + this.contingency;
    this.marginAmount = this.ourCost * (this.marginPct / 100);
    const preVat      = this.ourCost + this.marginAmount;
    this.vatAmount    = preVat * (this.vatPct / 100);
    this.clientTotal  = preVat + this.vatAmount;
    this.budgetDiff   = this.budget > 0 ? this.clientTotal - this.budget : 0;
    this.barPct       = this.budget > 0 ? Math.min((this.clientTotal / this.budget) * 100, 100) : 0;
  }
}
