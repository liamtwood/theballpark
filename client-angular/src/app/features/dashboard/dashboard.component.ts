import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { LucideAngularModule, Plus, CircleDot, CircleDashed, CircleCheck, Calendar, MapPin, Volleyball, FolderOpen, Heart, MessageCircle } from 'lucide-angular';
import { ProjectService } from '../../core/services/project.service';
import { OrgService } from '../../core/services/org.service';
import { SupplierService } from '../../core/services/supplier.service';
import { ConfigService } from '../../core/services/config.service';
import { Project, Org } from '../../core/models';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, LoadingSpinnerComponent],
  template: `
    <app-loading *ngIf="loading"></app-loading>
    <ng-container *ngIf="!loading">

      <!-- HERO BANNER -->
      <div class="bp-hero" [style.text-align]="heroAlign">
        <div class="bp-hero-pills" [style.justify-content]="heroAlign === 'center' ? 'center' : 'flex-start'">
          <div class="bp-hero-pill" *ngIf="showUpcoming && activeProjects.length > 0">
            <lucide-icon name="calendar" [size]="12" style="color:#3B82F6;"></lucide-icon>
            {{ activeProjects.length }} upcoming {{ activeProjects.length === 1 ? projectLabel.toLowerCase() : projectLabel.toLowerCase() + 's' }}
          </div>
          <div class="bp-hero-pill" *ngIf="showLocation && org?.city">
            <lucide-icon name="map-pin" [size]="12" style="color:#EF4444;"></lucide-icon>
            {{ org?.city }}
          </div>
        </div>
        <h1 class="bp-hero-org-name">{{ org?.name || 'My Organisation' }}</h1>
        <p class="bp-hero-sub" *ngIf="showUserName">{{ userName }} &middot; {{ org?.type === 'agency' ? 'Agency account' : 'Supplier account' }}</p>
      </div>

      <!-- STATS BAR -->
      <div class="bp-stats-bar" *ngIf="showStats">
        <div class="bp-stat-cell">
          <div class="bp-stat-label themed"><lucide-icon name="volleyball" [size]="10" style="display:inline;vertical-align:middle;margin-right:3px;"></lucide-icon>{{ creditLabel }}s remaining</div>
          <div class="bp-stat-number">{{ org?.balls_balance ?? 0 }}</div>
          <div class="bp-stat-sub themed">resets in {{ daysUntilReset }} days</div>
        </div>
        <div class="bp-stat-cell">
          <div class="bp-stat-label">Active {{ projectLabel }}s</div>
          <div class="bp-stat-number">{{ activeProjects.length }}</div>
          <div class="bp-stat-sub" *ngIf="activeProjects.length > 0">{{ activeProjects[0].client_name || activeProjects[0].name }}</div>
          <div class="bp-stat-sub" *ngIf="activeProjects.length === 0">none yet</div>
        </div>
        <div class="bp-stat-cell">
          <div class="bp-stat-label">Saved suppliers</div>
          <div class="bp-stat-number">{{ supplierCount }}</div>
          <div class="bp-stat-sub">across categories</div>
        </div>
        <div class="bp-stat-cell">
          <div class="bp-stat-label">Quotes in progress</div>
          <div class="bp-stat-number">0</div>
          <div class="bp-stat-sub">awaiting response</div>
        </div>
      </div>

      <!-- TWO-COLUMN BODY -->
      <div class="bp-body">
        <div class="bp-body-left">
          <!-- Active projects -->
          <div class="bp-section-header">
            <span class="bp-section-title">Active {{ projectLabel }}s</span>
            <a routerLink="/projects/new" class="bp-section-action"><lucide-icon name="plus" [size]="12"></lucide-icon> New {{ projectLabel }}</a>
          </div>
          <div *ngIf="activeProjects.length === 0" class="bp-empty">No active {{ projectLabel.toLowerCase() }}s yet.</div>
          <div *ngFor="let p of activeProjects" class="bp-project-card" [routerLink]="['/projects', p.id]">
            <div class="bp-project-card-top">
              <span class="bp-project-name">{{ p.name }}</span>
              <span class="bp-badge bp-badge-active">{{ p.status_name || 'Active' }}</span>
            </div>
            <div class="bp-project-meta">
              <lucide-icon name="circle-dot" [size]="10" style="color:#00B84A;"></lucide-icon>
              {{ p.client_name || '' }}{{ p.client_name && p.event_date ? ' \u00B7 ' : '' }}{{ p.event_date || '' }}{{ (p.stand_width_m && p.stand_depth_m) ? ' \u00B7 ' + p.stand_width_m + '\u00D7' + p.stand_depth_m + 'm' : '' }}{{ p.total_client_cost ? ' \u00B7 ' + fmtCurrency(p.total_client_cost) : '' }}
            </div>
          </div>

          <!-- Completed projects -->
          <div class="bp-section-spacer" *ngIf="completedProjects.length > 0">
            <div class="bp-section-header">
              <span class="bp-section-title">Completed {{ projectLabel }}s</span>
            </div>
          </div>
          <div *ngFor="let p of completedProjects" class="bp-project-card" [routerLink]="['/projects', p.id]">
            <div class="bp-project-card-top">
              <span class="bp-project-name">{{ p.name }}</span>
              <span class="bp-badge bp-badge-closed">{{ p.status_name || 'Closed' }}</span>
            </div>
            <div class="bp-project-meta">
              {{ p.client_name || '' }}{{ p.client_name && p.event_date ? ' \u00B7 ' : '' }}{{ p.event_date || '' }}{{ p.total_client_cost ? ' \u00B7 ' + fmtCurrency(p.total_client_cost) + ' final' : '' }}
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN -->
        <div class="bp-body-right">
          <a routerLink="/projects/new" class="bp-cta-btn"><lucide-icon name="plus" [size]="14" style="display:inline;vertical-align:middle;margin-right:4px;"></lucide-icon> Start new {{ projectLabel }}</a>

          <!-- Credits card -->
          <div class="bp-credits-card">
            <div class="bp-credits-number">{{ org?.balls_balance ?? 0 }}</div>
            <div class="bp-credits-label">{{ creditLabel }}s remaining this month</div>
            <div class="bp-credits-dots">
              <div *ngFor="let dot of creditDots" class="bp-credit-dot" [class.filled]="dot" [class.empty]="!dot"></div>
            </div>
            <p class="bp-credits-desc">
              Each project fires simultaneously to all selected suppliers.
              Build and estimate for free — only spend a {{ creditLabel }} when ready to engage.
            </p>
          </div>

          <!-- Saved suppliers -->
          <div class="bp-saved-suppliers-title"><lucide-icon name="heart" [size]="11" style="display:inline;vertical-align:middle;margin-right:4px;"></lucide-icon> Saved suppliers</div>
          <div *ngIf="suppliers.length === 0" class="bp-empty">No suppliers saved yet.</div>
          <div *ngFor="let s of suppliers.slice(0, 5)" class="bp-supplier-row">
            <div class="bp-supplier-icon">
              <lucide-icon name="heart" [size]="14" style="color:var(--theme-accent);"></lucide-icon>
            </div>
            <div class="bp-supplier-info">
              <div class="bp-supplier-name">{{ s.name }}</div>
              <div class="bp-supplier-meta">{{ s.category || 'Supplier' }} &middot; {{ s.city || 'UK' }}</div>
            </div>
            <div class="bp-supplier-price" *ngIf="s.price">from {{ s.price }}</div>
          </div>
        </div>
      </div>

    </ng-container>
  `,
  styles: [`
    .bp-hero {
      background: var(--theme-bg); padding: 32px var(--section-pad) 28px;
      border-bottom: 0.5px solid var(--theme-border);
    }
    .bp-hero-pills { display: flex; gap: 8px; margin-bottom: 16px; }
    .bp-hero-pill {
      display: flex; align-items: center; gap: 5px;
      font-size: var(--text-sm); color: var(--color-text-secondary);
      background: var(--color-surface); border: 0.5px solid var(--color-border);
      border-radius: 20px; padding: 4px 12px;
    }
    .bp-hero-pill-dot { width: 7px; height: 7px; border-radius: 50%; }
    .bp-hero-org-name {
      font-family: var(--font-display); font-size: var(--text-hero); font-weight: 400;
      color: var(--color-text-primary); letter-spacing: -0.02em; line-height: 1.1; margin-bottom: 8px;
    }
    .bp-hero-sub { font-size: var(--text-base); color: var(--color-text-muted); }
    .bp-stats-bar {
      display: grid; grid-template-columns: repeat(4, 1fr);
      border-bottom: 0.5px solid var(--color-border); background: var(--color-surface);
    }
    .bp-stat-cell { padding: 18px 24px; border-right: 0.5px solid var(--color-border); }
    .bp-stat-cell:last-child { border-right: none; }
    .bp-stat-label {
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.1em; color: var(--color-text-muted); margin-bottom: 6px;
    }
    .bp-stat-label.themed { color: var(--theme-accent); }
    .bp-stat-number { font-size: 26px; font-weight: 700; color: var(--color-text-primary); line-height: 1; margin-bottom: 4px; }
    .bp-stat-sub { font-size: 11px; color: var(--color-text-muted); }
    .bp-stat-sub.themed { color: var(--theme-accent); }
    .bp-body {
      display: grid; grid-template-columns: 1fr 320px;
      background: var(--color-bg);
      min-height: calc(100vh - var(--nav-height) - 120px - 80px - 64px);
    }
    .bp-body-left { padding: var(--section-pad); border-right: 0.5px solid var(--color-border); }
    .bp-body-right { padding: 24px; background: var(--color-surface); }
    .bp-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .bp-section-title { font-size: var(--text-md); font-weight: 600; color: var(--color-text-primary); }
    .bp-section-action {
      font-size: var(--text-sm); color: var(--theme-accent); font-weight: 500;
      cursor: pointer; text-decoration: none;
    }
    .bp-section-action:hover { text-decoration: underline; }
    .bp-section-spacer { margin-top: 24px; }
    .bp-project-card {
      background: var(--color-surface); border: 0.5px solid var(--color-border);
      border-radius: 10px; padding: 16px 18px; margin-bottom: 10px;
      cursor: pointer; transition: border-color 0.15s;
    }
    .bp-project-card:hover { border-color: #ccc; }
    .bp-project-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .bp-project-name { font-size: var(--text-md); font-weight: 600; color: var(--color-text-primary); }
    .bp-project-meta {
      font-size: var(--text-sm); color: var(--color-text-muted);
      display: flex; align-items: center; gap: 5px;
    }
    .bp-project-meta-dot { width: 6px; height: 6px; border-radius: 50%; background: #00B84A; }
    .bp-badge { font-size: 10px; font-weight: 600; padding: 3px 10px; border-radius: 20px; text-transform: capitalize; }
    .bp-badge-active { background: var(--theme-bg); color: var(--theme-text); }
    .bp-badge-closed { background: #F3F4F6; color: #9CA3AF; }
    .bp-cta-btn {
      display: block; width: 100%;
      background: var(--theme-bg); color: var(--theme-text);
      border: 0.5px solid var(--theme-border);
      padding: 13px; border-radius: 8px;
      font-size: var(--text-md); font-weight: 600; cursor: pointer;
      font-family: var(--font-body); margin-bottom: 16px;
      transition: all 0.2s ease; text-align: center; text-decoration: none;
    }
    .bp-cta-btn:hover { background: var(--theme-accent); color: #fff; }
    .bp-credits-card {
      background: var(--theme-bg); border: 0.5px solid var(--theme-border);
      border-radius: 10px; padding: 18px; margin-bottom: 16px;
    }
    .bp-credits-number { font-size: 40px; font-weight: 700; color: var(--color-text-primary); line-height: 1; margin-bottom: 4px; }
    .bp-credits-label { font-size: var(--text-sm); font-weight: 600; color: var(--theme-accent); margin-bottom: 12px; }
    .bp-credits-dots { display: flex; gap: 5px; margin-bottom: 10px; flex-wrap: wrap; }
    .bp-credit-dot { width: 10px; height: 10px; border-radius: 50%; }
    .bp-credit-dot.filled { background: var(--theme-accent); }
    .bp-credit-dot.empty { background: var(--theme-empty); }
    .bp-credits-desc { font-size: 11px; color: var(--theme-text); line-height: 1.5; }
    .bp-saved-suppliers-title {
      font-size: 11px; font-weight: 600; color: var(--color-text-primary);
      text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px;
    }
    .bp-supplier-row {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 0; border-bottom: 0.5px solid var(--color-border);
    }
    .bp-supplier-row:last-child { border-bottom: none; }
    .bp-supplier-icon {
      width: 32px; height: 32px; border-radius: 6px; background: var(--theme-bg);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .bp-supplier-info { flex: 1; min-width: 0; }
    .bp-supplier-name { font-size: var(--text-base); font-weight: 500; color: var(--color-text-primary); }
    .bp-supplier-meta { font-size: 11px; color: var(--color-text-muted); }
    .bp-supplier-price { font-size: var(--text-sm); color: var(--color-text-secondary); margin-left: auto; white-space: nowrap; }
    .bp-empty { font-size: var(--text-sm); color: var(--color-text-muted); padding: 16px 0; }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly icons = { Plus, CircleDot, CircleDashed, CircleCheck, Calendar, MapPin, Volleyball, FolderOpen, Heart, MessageCircle };
  loading = true;
  org: Org | null = null;
  projects: Project[] = [];
  activeProjects: Project[] = [];
  completedProjects: Project[] = [];
  suppliers: any[] = [];
  supplierCount = 0;
  creditDots: boolean[] = [];
  projectLabel = 'Event';
  creditLabel = 'Ball';
  userName = '';
  daysUntilReset = 0;
  heroAlign = 'center';
  showUserName = true;
  showLocation = true;
  showUpcoming = true;
  showStats = true;

  private sub?: Subscription;

  constructor(
    private projectService: ProjectService,
    private orgService: OrgService,
    private supplierService: SupplierService,
    private configService: ConfigService,
    private cdr: ChangeDetectorRef,
  ) {}

  fmtCurrency(v: any): string { return ConfigService.formatCurrency(v); }

  ngOnInit() {
    this.daysUntilReset = ConfigService.daysUntilReset();

    this.sub = this.configService.config$.subscribe(() => {
      this.projectLabel = this.configService.projectLabel;
      this.creditLabel = this.configService.creditLabel;
      this.heroAlign = this.configService.heroAlign;
      this.showUserName = this.configService.showUserName;
      this.showLocation = this.configService.showLocation;
      this.showUpcoming = this.configService.showUpcoming;
      this.showStats = this.configService.showStats;
      this.cdr.detectChanges();
    });

    this.orgService.getCurrentOrg().subscribe({
      next: (org) => { this.org = org; this.buildCreditDots(); this.cdr.detectChanges(); },
      error: () => {},
    });

    this.orgService.getUsers().subscribe({
      next: (users) => {
        if (users?.length) this.userName = users[0].name || 'User';
        this.cdr.detectChanges();
      },
      error: () => { this.userName = 'User'; },
    });

    this.projectService.getAll().subscribe({
      next: (data) => {
        this.projects = data;
        this.activeProjects = data.filter(p => p.status_name === 'active' || p.status_name === 'draft');
        this.completedProjects = data.filter(p => p.status_name === 'completed' || p.status_name === 'cancelled');
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); },
    });

    this.supplierService.getAll().subscribe({
      next: (data) => {
        this.suppliers = data.map(s => ({
          name: s.name,
          city: s.city || '',
          category: s.description || '',
          price: '',
        }));
        this.supplierCount = data.length;
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  private buildCreditDots() {
    const balance = this.org?.balls_balance ?? 0;
    const total = this.org?.balls_monthly_allowance ?? 10;
    this.creditDots = [];
    for (let i = 0; i < total; i++) {
      this.creditDots.push(i < balance);
    }
  }
}
