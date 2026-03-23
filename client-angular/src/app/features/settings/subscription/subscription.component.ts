import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { OrgService } from '../../../core/services/org.service';
import { Org } from '../../../models';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

interface Plan {
  id: string;
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  highlight: string;
  badge?: string;
}

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [CommonModule, ButtonModule, ToastModule, LoadingSpinnerComponent],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading">
      <div class="bp-settings-body">
        <h2 class="bp-page-title">Subscription</h2>
        <div class="bp-page-divider"></div>

        <!-- CURRENT PLAN SUMMARY -->
        <div class="bp-section" *ngIf="org">
          <div class="bp-section-header">
            <span class="bp-section-title">CURRENT PLAN</span>
          </div>
          <div class="bp-plan-summary">
            <div class="bp-plan-summary-row">
              <span class="bp-field-label" style="margin:0;">Plan</span>
              <span class="bp-plan-badge">{{ currentPlanName }}</span>
            </div>
            <div class="bp-plan-summary-row">
              <span class="bp-field-label" style="margin:0;">Balls balance</span>
              <span class="bp-field-value-inline">{{ org.balls_balance }}</span>
            </div>
            <div class="bp-plan-summary-row" style="border-bottom:none;">
              <span class="bp-field-label" style="margin:0;">Monthly allowance</span>
              <span class="bp-field-value-inline">{{ org.balls_monthly_allowance }}</span>
            </div>
          </div>
        </div>

        <!-- PLAN CARDS -->
        <div class="bp-section">
          <div class="bp-section-header">
            <span class="bp-section-title">CHOOSE YOUR PLAN</span>
          </div>
          <p class="bp-muted-text mb-6" style="text-align:center;">Start free, upgrade any time. No contract.</p>

          <div class="bp-plan-grid">
            <div *ngFor="let plan of plans"
              class="bp-plan-card"
              [class.bp-plan-card-active]="isCurrentPlan(plan.id)"
              [class.bp-plan-card-popular]="plan.badge">

              <div *ngIf="plan.badge" class="bp-plan-badge-popular">{{ plan.badge }}</div>

              <div class="bp-plan-name">{{ plan.name }}</div>

              <div class="bp-plan-price">
                <span class="bp-plan-amount">{{ plan.price }}</span>
                <span class="bp-plan-period">{{ plan.period }}</span>
              </div>

              <p class="bp-plan-tagline">{{ plan.tagline }}</p>

              <div class="bp-plan-divider"></div>

              <ul class="bp-plan-features">
                <li *ngFor="let f of plan.features" class="bp-plan-feature">
                  <span class="bp-plan-check">✓</span>
                  {{ f }}
                </li>
              </ul>

              <div class="bp-plan-highlight">
                <span class="bp-plan-highlight-icon">{{ plan.id === 'free' ? '◎' : '∞' }}</span>
                {{ plan.highlight }}
              </div>

              <p-button
                *ngIf="!isCurrentPlan(plan.id)"
                [label]="'Upgrade to ' + plan.name"
                styleClass="w-full mt-4"
                (onClick)="selectPlan(plan)">
              </p-button>
              <div *ngIf="isCurrentPlan(plan.id)" class="bp-plan-current-label">Current plan</div>

            </div>
          </div>
        </div>

      </div>
    </ng-container>

    <p-toast></p-toast>
  `,
  styles: [`
    .bp-page-divider { border: none; border-top: 0.5px solid var(--color-border); margin: 0 0 32px; }

    /* ── CURRENT PLAN SUMMARY ── */
    .bp-plan-summary     { border: 0.5px solid var(--color-border); border-radius: 10px; overflow: hidden; }
    .bp-plan-summary-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 0.5px solid var(--color-border); }
    .bp-plan-badge       { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--theme-text); background: var(--theme-bg); border: 0.5px solid var(--theme-border); padding: 3px 10px; border-radius: 20px; }

    /* ── PLAN GRID ── */
    .bp-plan-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

    /* ── PLAN CARD ── */
    .bp-plan-card {
      border: 0.5px solid var(--color-border);
      border-radius: 12px;
      padding: 28px 24px 24px;
      position: relative;
      background: #fff;
      display: flex;
      flex-direction: column;
    }
    .bp-plan-card-active  { border-color: var(--theme-accent); background: var(--theme-bg); }
    .bp-plan-card-popular { border-color: var(--color-text-primary); border-width: 1.5px; }

    /* ── POPULAR BADGE ── */
    .bp-plan-badge-popular {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--color-text-primary);
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 4px 14px;
      border-radius: 20px;
      white-space: nowrap;
    }

    /* ── PLAN CONTENT ── */
    .bp-plan-name    { font-family: var(--font-display); font-size: 22px; font-weight: 400; color: var(--color-text-primary); margin-bottom: 10px; }
    .bp-plan-price   { display: flex; align-items: baseline; gap: 4px; margin-bottom: 6px; }
    .bp-plan-amount  { font-family: var(--font-display); font-size: 36px; font-weight: 700; color: var(--color-text-primary); }
    .bp-plan-period  { font-size: 13px; color: var(--color-text-muted); }
    .bp-plan-tagline { font-size: 13px; color: var(--color-text-muted); margin-bottom: 16px; }
    .bp-plan-divider { border: none; border-top: 0.5px solid var(--color-border); margin-bottom: 16px; }

    /* ── FEATURES ── */
    .bp-plan-features { list-style: none; padding: 0; margin: 0 0 16px; flex: 1; }
    .bp-plan-feature  { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: var(--color-text-primary); padding: 4px 0; }
    .bp-plan-check    { color: var(--theme-accent); font-weight: 600; flex-shrink: 0; }

    /* ── HIGHLIGHT ROW ── */
    .bp-plan-highlight {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 500;
      color: var(--color-text-primary);
      margin-top: auto;
    }
    .bp-plan-highlight-icon { font-size: 16px; color: var(--theme-accent); }

    /* ── CURRENT PLAN LABEL ── */
    .bp-plan-current-label {
      text-align: center;
      font-size: 12px;
      font-weight: 600;
      color: var(--theme-accent);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 0.5px solid var(--theme-border);
    }
  `]
})
export class SubscriptionComponent implements OnInit {
  org: Org | null = null;
  loading = true;

  plans: Plan[] = [
    {
      id: 'free',
      name: 'Free',
      price: '£0',
      period: 'forever',
      tagline: 'Get started at no cost',
      features: [
        '10 projects per month',
        'Full cost builder',
        'Supplier catalogue access',
        'Email notifications'
      ],
      highlight: '10 projects/month'
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '£29.99',
      period: 'per month',
      tagline: 'For agencies that run events regularly',
      features: [
        'Unlimited projects',
        'Full cost builder',
        'Supplier catalogue',
        'AI brief parsing',
        'Past projects library',
        'Priority support'
      ],
      highlight: 'Unlimited projects',
      badge: 'MOST POPULAR'
    }
  ];

  constructor(
    private orgSvc: OrgService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.orgSvc.getCurrentOrg().subscribe({
      next: (org) => { this.org = org || null; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  get currentPlanName(): string {
    const tier = this.org?.subscription_tier || 'free';
    return this.plans.find(p => p.id === tier)?.name || tier;
  }

  isCurrentPlan(planId: string): boolean {
    return (this.org?.subscription_tier || 'free') === planId;
  }

  selectPlan(plan: Plan) {
    // TODO: wire to billing/payment flow when pricing confirmed with Beth & Megan
    this.msg.add({ severity: 'info', summary: `${plan.name} plan — upgrade coming soon` });
  }
}
