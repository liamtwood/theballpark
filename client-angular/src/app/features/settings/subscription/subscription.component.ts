import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrgService } from '../../../core/services/org.service';
import { Org } from '../../../models';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent, StatusBadgeComponent],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading && org">
      <div class="bp-settings-body">
        <h2 class="bp-page-title">Subscription</h2>

        <div class="bp-section">
          <div class="bp-section-header">
            <span class="bp-section-title">CURRENT PLAN</span>
          </div>
          <app-status-badge [status]="org.subscription_tier"></app-status-badge>
          <div class="mt-4" style="border-top:0.5px solid var(--color-border);">
            <div class="flex justify-between py-3" style="border-bottom:0.5px solid var(--color-border);">
              <span class="bp-field-label" style="margin:0;">Balls balance</span>
              <span class="bp-field-value-inline">{{ org.balls_balance }}</span>
            </div>
            <div class="flex justify-between py-3">
              <span class="bp-field-label" style="margin:0;">Monthly allowance</span>
              <span class="bp-field-value-inline">{{ org.balls_monthly_allowance }}</span>
            </div>
          </div>
        </div>
      </div>
    </ng-container>
  `,
  // No component-specific styles — all shared CSS is in styles.css
  styles: []
})
export class SubscriptionComponent implements OnInit {
  org: Org | null = null;
  loading = true;

  constructor(private orgSvc: OrgService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.orgSvc.getCurrentOrg().subscribe({
      next: (org) => { this.org = org || null; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }
}
