import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ProjectService } from '../../../../../../core/services/project.service';
import { ProjectCategoryService } from '../../../../../../core/services/project-category.service';
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
        <div class="bp-est-title">Summary</div>

        <!-- CATEGORY ROWS -->
        <div class="bp-est-cats">
          <div *ngFor="let cat of categories" class="bp-est-cat-row">
            <lucide-icon [name]="getCatIcon(cat.name)" [size]="16" style="color:var(--theme-accent);flex-shrink:0;"></lucide-icon>
            <span class="bp-est-cat-name">{{ cat.name }}</span>
            <span class="bp-est-cat-cost">{{ cat.ballpark_cost | gbp }}</span>
          </div>
          <div *ngIf="categories.length === 0" class="bp-est-empty">
            No categories yet — add some in the Build tab.
          </div>
        </div>

        <!-- TOTALS -->
        <div class="bp-est-totals" *ngIf="categories.length > 0">
          <div class="bp-est-total-row">
            <span>Subtotal</span>
            <span>{{ subtotal | gbp }}</span>
          </div>
          <div class="bp-est-total-row">
            <span>Est. delivery & setup (12%)</span>
            <span>{{ delivery | gbp }}</span>
          </div>
          <div class="bp-est-total-row">
            <span>Contingency ({{ contingencyPct }}%)</span>
            <span>{{ contingency | gbp }}</span>
          </div>
        </div>

        <!-- YOUR COST -->
        <div class="bp-est-your-cost" *ngIf="categories.length > 0">
          <div class="bp-est-your-label">Your cost</div>
          <div class="bp-est-your-value">{{ ourCost | gbp }}</div>
        </div>

        <!-- CLIENT TOTAL -->
        <div class="bp-est-client-row" *ngIf="categories.length > 0">
          <span>At {{ marginPct }}% margin</span>
          <span class="bp-est-client-val">{{ clientTotal | gbp }} client total</span>
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
    .bp-est-title { font-family: var(--font-display); font-size: 22px; font-weight: 400; color: var(--color-text-primary); margin-bottom: 20px; }

    /* CATEGORY ROWS */
    .bp-est-cats { margin-bottom: 0; }
    .bp-est-cat-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 0.5px solid var(--color-border); }
    .bp-est-cat-name { flex: 1; font-size: 14px; color: var(--color-text-primary); }
    .bp-est-cat-cost { font-size: 14px; font-weight: 500; color: var(--color-text-primary); }
    .bp-est-empty { font-size: 13px; color: var(--color-text-muted); padding: 20px 0; text-align: center; }

    /* TOTALS */
    .bp-est-totals { padding: 12px 0; border-bottom: 0.5px solid var(--color-border); margin-bottom: 0; }
    .bp-est-total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: var(--color-text-muted); }

    /* YOUR COST */
    .bp-est-your-cost { display: flex; align-items: baseline; justify-content: space-between; padding: 16px 0 4px; border-bottom: 0.5px solid var(--color-border); }
    .bp-est-your-label { font-family: var(--font-display); font-size: 20px; font-weight: 400; color: var(--color-text-primary); }
    .bp-est-your-value { font-family: var(--font-display); font-size: 28px; font-weight: 700; color: var(--color-text-primary); }

    /* CLIENT TOTAL */
    .bp-est-client-row { display: flex; justify-content: space-between; padding: 8px 0 16px; font-size: 12px; color: var(--color-text-muted); }
    .bp-est-client-val { font-weight: 500; color: var(--color-text-secondary); }

    /* BUDGET CARD */
    .bp-est-budget-card { border: 0.5px solid #6EE7B7; background: #ECFDF5; border-radius: 10px; padding: 14px; }
    .bp-est-budget-card.over { border-color: #FCA5A5; background: #FEF2F2; }
    .bp-est-budget-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .bp-est-budget-header lucide-icon { color: #059669; }
    .bp-est-budget-card.over .bp-est-budget-header lucide-icon { color: #DC2626; }
    .bp-est-budget-label { font-size: 13px; font-weight: 600; color: #059669; flex: 1; }
    .bp-est-budget-card.over .bp-est-budget-label { color: #DC2626; }
    .bp-est-budget-diff { font-size: 13px; font-weight: 600; color: #059669; }
    .bp-est-budget-card.over .bp-est-budget-diff { color: #DC2626; }
    .bp-est-budget-bar-wrap { height: 6px; background: rgba(0,0,0,0.08); border-radius: 20px; overflow: hidden; margin-bottom: 8px; }
    .bp-est-budget-bar { height: 100%; background: #059669; border-radius: 20px; transition: width 0.4s; max-width: 100%; }
    .bp-est-budget-card.over .bp-est-budget-bar { background: #DC2626; }
    .bp-est-budget-footer { display: flex; justify-content: space-between; font-size: 11px; color: #6B7280; margin-bottom: 4px; }
    .bp-est-budget-sub { font-size: 11px; color: #6B7280; }

    @media (max-width: 768px) {
      .bp-est-body { padding: 16px; }
    }
  `]
})
export class EstimateComponent implements OnInit {
  loading = true;
  categories: any[] = [];
  subtotal = 0;
  delivery = 0;
  contingency = 0;
  ourCost = 0;
  clientTotal = 0;
  budget = 0;
  budgetDiff = 0;
  barPct = 0;
  contingencyPct = 10;
  marginPct = 20;
  private pid = '';

  constructor(
    private route: ActivatedRoute,
    private projectSvc: ProjectService,
    private projectCategorySvc: ProjectCategoryService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    let r = this.route;
    while (r.parent) r = r.parent;
    this.pid = r.snapshot.paramMap.get('id') || this.route.parent?.snapshot.paramMap.get('id') || '';

    if (this.pid) {
      this.projectSvc.getById(this.pid).subscribe({
        next: (p: any) => {
          this.budget = p?.project_budget || 0;
          this.marginPct = p?.default_margin_pct || 20;
          this.contingencyPct = p?.default_contingency_pct || 10;
          this.cdr.detectChanges();
        }
      });

      this.projectCategorySvc.getByProject(this.pid).subscribe({
        next: cats => {
          this.categories = cats || [];
          this.recalc();
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => { this.loading = false; this.cdr.detectChanges(); }
      });
    } else {
      this.loading = false;
    }
  }

  recalc() {
    this.subtotal    = this.categories.reduce((s, c) => s + (parseFloat(c.ballpark_cost) || 0), 0);
    this.delivery    = this.subtotal * 0.12;
    this.contingency = this.subtotal * (this.contingencyPct / 100);
    this.ourCost     = this.subtotal + this.delivery + this.contingency;
    this.clientTotal = this.ourCost * (1 + this.marginPct / 100);
    this.budgetDiff  = this.budget > 0 ? this.clientTotal - this.budget : 0;
    this.barPct      = this.budget > 0 ? Math.min((this.clientTotal / this.budget) * 100, 100) : 0;
  }

  getCatIcon(name: string): string {
    const n = (name || '').toLowerCase();
    if (n.includes('structure') || n.includes('set build') || n.includes('stand')) return 'warehouse';
    if (n.includes('lighting')) return 'spotlight';
    if (n.includes('av') || n.includes('audio') || n.includes('technology')) return 'headset';
    if (n.includes('graphics') || n.includes('signage') || n.includes('print') || n.includes('permits')) return 'signature';
    if (n.includes('catering') || n.includes('hospitality') || n.includes('bar')) return 'martini';
    if (n.includes('talent') || n.includes('staffing') || n.includes('entertainment') || n.includes('security')) return 'person-standing';
    return 'warehouse';
  }
}
