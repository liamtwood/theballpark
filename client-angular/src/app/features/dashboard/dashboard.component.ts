import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { LucideAngularModule, Plus, CircleDot, CircleDashed, CircleCheck, Calendar, MapPin, Volleyball, FolderOpen, Heart, MessageCircle } from 'lucide-angular';
import { ProjectService } from '../../core/services/project.service';
import { OrgService } from '../../core/services/org.service';
import { SupplierService } from '../../core/services/supplier.service';
import { ConfigService } from '../../core/services/config.service';
import { Project, Org } from '../../models';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { ImageUploadPanelComponent } from '../../shared/components/image-upload-panel/image-upload-panel.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, ButtonModule, CardModule, LoadingSpinnerComponent, ImageUploadPanelComponent, StatusBadgeComponent],
  template: `
    <div class="bp-page">
    <app-loading *ngIf="loading"></app-loading>
    <ng-container *ngIf="!loading">

      <!-- STATS SUMMARY -->
      <div class="bp-dash-stats">
        <div class="bp-dash-stat">
          <span class="bp-dash-stat-label">{{ creditLabel }}s remaining</span>
          <span class="bp-dash-stat-value">{{ org?.balls_balance ?? 0 }}</span>
          <span class="bp-dash-stat-sub">resets in {{ daysUntilReset }} days</span>
        </div>
        <div class="bp-dash-stat">
          <span class="bp-dash-stat-label">Active {{ projectLabel }}s</span>
          <span class="bp-dash-stat-value">{{ activeProjects.length }}</span>
          <span class="bp-dash-stat-sub">{{ activeProjects.length > 0 ? activeProjects[0].name : 'none yet' }}</span>
        </div>
        <div class="bp-dash-stat">
          <span class="bp-dash-stat-label">Saved suppliers</span>
          <span class="bp-dash-stat-value">{{ supplierCount }}</span>
          <span class="bp-dash-stat-sub">across categories</span>
        </div>
        <div class="bp-dash-stat" style="border-right:none;">
          <span class="bp-dash-stat-label">Quotes in progress</span>
          <span class="bp-dash-stat-value">0</span>
          <span class="bp-dash-stat-sub">awaiting response</span>
        </div>
      </div>

      <!-- THREE-COLUMN BODY -->
      <div class="bp-body">

        <!-- LEFT PANEL — Upcoming / Recent Activity / Quick Actions -->
        <div class="bp-body-panel">

          <!-- UPCOMING -->
          <div class="bp-panel-section">
            <div class="bp-section-header">
              <span class="bp-section-title">Upcoming</span>
            </div>
            <ng-container *ngIf="nextProject">
              <p class="bp-upcoming-name">{{ nextProject.event_name || nextProject.name }}</p>
              <p class="bp-upcoming-meta">{{ nextProject.client_name }}</p>
              <p class="bp-upcoming-meta" *ngIf="nextProject.venue_name">{{ nextProject.venue_name }}</p>
              <p class="bp-upcoming-date" *ngIf="nextProject.event_date">{{ nextProject.event_date }}</p>
            </ng-container>
            <p *ngIf="!nextProject" class="bp-empty">No upcoming events.</p>
          </div>

          <!-- RECENT ACTIVITY -->
          <div class="bp-panel-section">
            <div class="bp-section-header">
              <span class="bp-section-title">Recent Activity</span>
            </div>
            <div class="bp-activity-item">
              <div class="bp-activity-dot"></div>
              <span>Brief updated — TechVista London</span>
              <span class="bp-activity-time">2h ago</span>
            </div>
            <div class="bp-activity-item">
              <div class="bp-activity-dot"></div>
              <span>Project created — Food &amp; Drink Expo</span>
              <span class="bp-activity-time">1d ago</span>
            </div>
            <div class="bp-activity-item">
              <div class="bp-activity-dot"></div>
              <span>Supplier saved — Construct &amp; Co.</span>
              <span class="bp-activity-time">2d ago</span>
            </div>
          </div>

          <!-- QUICK ACTIONS -->
          <div class="bp-panel-section">
            <div class="bp-section-header">
              <span class="bp-section-title">Quick Actions</span>
            </div>
            <a routerLink="/projects/new" class="bp-quick-action">
              <i class="pi pi-plus" style="font-size:11px;"></i> New Project
            </a>
            <a routerLink="/suppliers" class="bp-quick-action">
              <i class="pi pi-building" style="font-size:11px;"></i> Browse Suppliers
            </a>
            <a routerLink="/settings/team" class="bp-quick-action">
              <i class="pi pi-user-plus" style="font-size:11px;"></i> Invite Member
            </a>
          </div>

        </div>

        <!-- CENTRE — Active + Completed projects -->
        <div class="bp-body-left">
          <!-- Active projects -->
          <div class="bp-section-header">
            <span class="bp-section-title">Active {{ projectLabel }}s</span>
            <a routerLink="/projects/new" class="bp-section-action"><lucide-icon name="plus" [size]="12"></lucide-icon> New {{ projectLabel }}</a>
          </div>
          <p *ngIf="activeProjects.length === 0" class="bp-empty">
            No active {{ projectLabel.toLowerCase() }}s yet.
          </p>

          <div class="bp-project-grid">
            <div *ngFor="let p of activeProjects"
              class="bp-project-card-wrap"
              [routerLink]="['/projects', p.id]">
              <p-card styleClass="bp-project-card">
                <ng-template pTemplate="header">
                  <div class="bp-card-header"
                    [style.background-image]="p.cover_image_url ? 'url(' + p.cover_image_url + ')' : null"
                    [class.bp-card-header-active]="!p.cover_image_url && p.status_name !== 'draft'"
                    [class.bp-card-header-draft]="!p.cover_image_url && p.status_name === 'draft'">
                    <span class="bp-card-client-chip">{{ p.client_name || 'No client' }}</span>
                    <app-status-badge [status]="p.status_name" class="bp-card-status"></app-status-badge>
                  </div>
                </ng-template>
                <div class="bp-card-content">
                  <div class="bp-card-name">{{ p.event_name || p.name }}</div>
                  <div class="bp-card-meta">
                    {{ p.client_name || '' }}{{ p.client_name && p.event_date ? ' · ' : '' }}{{ p.event_date || '' }}
                  </div>
                  <div class="bp-card-cost" *ngIf="p.total_client_cost">
                    Est. {{ fmtCurrency(p.total_client_cost) }}
                  </div>
                </div>
              </p-card>
            </div>
          </div>

          <!-- Completed projects -->
          <div class="bp-section-spacer" *ngIf="completedProjects.length > 0">
            <div class="bp-section-header">
              <span class="bp-section-title">Completed {{ projectLabel }}s</span>
            </div>
          </div>
          <div class="bp-project-grid" *ngIf="completedProjects.length > 0">
            <div *ngFor="let p of completedProjects"
              class="bp-project-card-wrap"
              [routerLink]="['/projects', p.id]">
              <p-card styleClass="bp-project-card">
                <ng-template pTemplate="header">
                  <div class="bp-card-header bp-card-header-closed"
                    [style.background-image]="p.cover_image_url ? 'url(' + p.cover_image_url + ')' : null">
                    <span class="bp-card-client-chip">{{ p.client_name || 'No client' }}</span>
                    <app-status-badge [status]="p.status_name" class="bp-card-status"></app-status-badge>
                  </div>
                </ng-template>
                <div class="bp-card-content">
                  <div class="bp-card-name">{{ p.event_name || p.name }}</div>
                  <div class="bp-card-meta">
                    {{ p.client_name || '' }}{{ p.client_name && p.event_date ? ' · ' : '' }}{{ p.event_date || '' }}
                  </div>
                  <div class="bp-card-cost" *ngIf="p.total_client_cost">
                    {{ fmtCurrency(p.total_client_cost) }} final
                  </div>
                </div>
              </p-card>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN — Credits + Saved Suppliers -->
        <div class="bp-body-right">

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

          <!-- Saved Suppliers -->
          <div class="bp-saved-hd">SAVED SUPPLIERS</div>

          <div *ngIf="suppliers.length === 0" class="bp-empty">No suppliers saved yet.</div>

          <div *ngFor="let s of suppliers.slice(0,2)" class="bp-sup-card" style="border-radius:10px;overflow:hidden;">
            <div class="bp-sup-img"
                 [class]="'bp-sup-bg-' + getCategoryClass(s.category)"
                 [style.background-image]="s.hero_image_url ? 'url(' + s.hero_image_url + ')' : null">
              <div class="bp-sup-cat">{{ s.category }}</div>
              <div class="bp-sup-heart">&hearts;</div>
              <div class="bp-sup-price" *ngIf="s.price">from {{ s.price }}</div>
              <div class="bp-sup-desc">{{ s.description }}</div>
              <div class="bp-sup-overlay" (click)="openSupplierUpload($event, s)">
                <lucide-icon name="pencil" [size]="16" color="white"></lucide-icon>
              </div>
            </div>
            <app-image-upload-panel *ngIf="uploadSupplierPanelId === s.id" [entityId]="s.id" type="supplier" [subtitle]="s.name" [existingCoverUrl]="s.hero_image_url || ''" (imagesUpdated)="onSupplierImagesUpdated(s, $event)" (closed)="uploadSupplierPanelId = ''"></app-image-upload-panel>
            <div class="bp-sup-body">
              <div class="bp-sup-name">{{ s.name }}</div>
              <div class="bp-sup-meta">{{ s.city || 'London' }}</div>
              <div class="bp-sup-footer">
                <div class="bp-sup-rating">
                  <span class="bp-sup-star">&starf;</span>
                  {{ s.rating || '4.8' }}
                  <span class="bp-sup-count">({{ s.review_count || 24 }})</span>
                </div>
                <div class="bp-sup-action">View &rarr;</div>
              </div>
            </div>
          </div>

          <p-button
            label="View all {{ supplierCount }} saved suppliers →"
            styleClass="w-full p-button-outlined mt-1"
            routerLink="/suppliers">
          </p-button>
        </div>
      </div>

    </ng-container>
    </div>
  `,
  styles: [`
    .bp-dash-stats {
      display: grid; grid-template-columns: repeat(4, 1fr);
      border-bottom: 0.5px solid var(--color-border); background: var(--color-surface);
    }
    .bp-dash-stat {
      display: flex; flex-direction: column; align-items: center;
      padding: 14px 20px; border-right: 0.5px solid var(--color-border);
    }
    .bp-dash-stat:last-child { border-right: none; }
    .bp-dash-stat-label {
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--theme-accent); margin-bottom: 2px;
    }
    .bp-dash-stat-value { font-size: 26px; font-weight: 700; color: var(--color-text-primary); line-height: 1.1; }
    .bp-dash-stat-sub   { font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }

    /* ── THREE-COLUMN BODY ── */
    .bp-body {
      display: grid; grid-template-columns: 384px minmax(400px, 1fr) 384px;
      background: var(--color-bg);
      min-height: calc(100vh - var(--nav-height) - 120px - 80px - 64px);
    }

    /* LEFT PANEL */
    .bp-body-panel   { padding: 24px; background: var(--color-surface); border-right: 0.5px solid var(--color-border); }
    .bp-panel-section { margin-bottom: 28px; }
    .bp-upcoming-name { font-size: 13px; font-weight: 500; color: var(--color-text-primary); margin-bottom: 4px; }
    .bp-upcoming-meta { font-size: 11px; color: var(--color-text-muted); margin-bottom: 2px; }
    .bp-upcoming-date { font-size: 11px; color: var(--theme-accent); font-weight: 500; margin-top: 4px; }
    .bp-activity-item { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; border-bottom: 0.5px solid var(--color-border); font-size: 12px; color: var(--color-text-secondary); line-height: 1.4; }
    .bp-activity-dot  { width: 6px; height: 6px; border-radius: 50%; background: var(--theme-accent); margin-top: 4px; flex-shrink: 0; }
    .bp-activity-time { font-size: 11px; color: var(--color-text-muted); margin-left: auto; white-space: nowrap; padding-left: 8px; }
    .bp-quick-action  { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; margin-bottom: 8px; border: 0.5px solid var(--color-border); border-radius: 8px; background: #fff; font-size: 13px; font-weight: 500; color: var(--color-text-primary); cursor: pointer; text-decoration: none; transition: border-color 0.15s, color 0.15s; font-family: var(--font-body); }
    .bp-quick-action:hover { border-color: var(--theme-accent); color: var(--theme-accent); }

    /* CENTRE */
    .bp-body-left { padding: var(--section-pad); border-right: 0.5px solid var(--color-border); }

    /* RIGHT */
    .bp-body-right { padding: 24px; background: var(--color-surface); }

    .bp-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .bp-section-title { font-size: 11px; font-weight: 700; color: var(--theme-accent); text-transform: uppercase; letter-spacing: 0.1em; }
    .bp-section-action {
      font-size: var(--text-sm); color: var(--theme-accent); font-weight: 500;
      cursor: pointer; text-decoration: none;
      display: inline-flex; align-items: center; gap: 4px; transition: color 0.15s;
    }
    .bp-section-action:hover { color: var(--color-text-primary); }
    .bp-section-spacer { margin-top: 24px; }

    /* PROJECT CARDS */
    /* PROJECT CARD GRID */
    .bp-project-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; margin-bottom: 8px; }
    .bp-project-card-wrap { cursor: pointer; text-decoration: none; display: block; }

    /* p-card overrides */
    :host ::ng-deep .bp-project-card.p-card { border: 0.5px solid var(--color-border); border-radius: 10px !important; overflow: hidden; margin: 0; box-shadow: none !important; transition: border-color 0.15s; }
    :host ::ng-deep .bp-project-card.p-card:hover { border-color: var(--color-text-muted); }
    :host ::ng-deep .bp-project-card .p-card-body { padding: 0 !important; }
    :host ::ng-deep .bp-project-card .p-card-content { padding: 0 !important; }
    :host ::ng-deep .bp-project-card .p-card-header { padding: 0 !important; }

    /* CARD HEADER — image or gradient */
    .bp-card-header {
      height: 110px; position: relative;
      display: flex; align-items: flex-end; justify-content: space-between;
      padding: 8px 10px;
      background-size: cover; background-position: center;
    }
    .bp-card-header-active { background-image: linear-gradient(160deg, #1e3a5f, #2563eb); }
    .bp-card-header-draft  { background-image: linear-gradient(160deg, #374151, #4B5563); }
    .bp-card-header-closed { background-image: linear-gradient(160deg, #374151, #6B7280); }

    /* Client chip */
    .bp-card-client-chip {
      background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 6px; padding: 3px 8px;
      font-size: 10px; font-weight: 600; color: #fff;
    }

    /* Status badge positioning */
    .bp-card-status { position: absolute; top: 8px; right: 8px; }

    /* CARD CONTENT */
    .bp-card-content { padding: 12px 14px 14px; }
    .bp-card-name { font-size: 13px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bp-card-meta { font-size: 11px; color: var(--color-text-muted); margin-bottom: 6px; }
    .bp-card-cost { font-size: 13px; font-weight: 500; color: var(--color-text-secondary); }

    /* CREDITS CARD */
    .bp-credits-card   { background: var(--theme-bg); border: 0.5px solid var(--theme-border); border-radius: 10px; padding: 18px; margin-bottom: 16px; }
    .bp-credits-number { font-size: 40px; font-weight: 700; color: var(--color-text-primary); line-height: 1; margin-bottom: 4px; }
    .bp-credits-label  { font-size: var(--text-sm); font-weight: 600; color: var(--theme-accent); margin-bottom: 12px; }
    .bp-credits-dots   { display: flex; gap: 5px; margin-bottom: 10px; flex-wrap: wrap; }
    .bp-credit-dot     { width: 10px; height: 10px; border-radius: 50%; }
    .bp-credit-dot.filled { background: var(--theme-accent); }
    .bp-credit-dot.empty  { background: var(--theme-empty); }
    .bp-credits-desc   { font-size: 11px; color: var(--theme-text); line-height: 1.5; }

    /* SAVED SUPPLIERS */
    .bp-saved-hd { font-size: 11px; font-weight: 700; color: var(--theme-accent); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 14px; }
    .bp-sup-card { border: 0.5px solid var(--color-border); border-radius: 10px; overflow: hidden; margin-bottom: 10px; cursor: pointer; transition: border-color 0.15s; background: var(--color-surface); }
    .bp-sup-card:hover { border-color: var(--color-text-muted); }
    .bp-sup-img  { width: 100%; height: 120px; position: relative; display: flex; align-items: center; justify-content: center; background-size: cover; background-position: center; overflow: hidden; }
    .bp-sup-desc { position: absolute; inset: 0; background: rgba(0,0,0,0.7); color: #fff; font-size: 11px; line-height: 1.5; padding: 12px; display: flex; align-items: center; opacity: 0; transition: opacity 0.15s; }
    .bp-sup-img:hover .bp-sup-desc { opacity: 1; }
    .bp-sup-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.45); opacity: 0; transition: opacity 0.15s; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 2; }
    .bp-sup-img:hover .bp-sup-overlay { opacity: 1; }
    .bp-sup-bg-setbuild { background-image: linear-gradient(160deg, #1a1a2e, #16213e); }
    .bp-sup-bg-av { background-image: linear-gradient(160deg, #0d1b2a, #1b2838); }
    .bp-sup-bg-florist { background-image: linear-gradient(160deg, #2d1b2e, #4a1942); }
    .bp-sup-bg-catering { background-image: linear-gradient(160deg, #1a2e1a, #162116); }
    .bp-sup-bg-default { background-image: linear-gradient(160deg, #1a1a2e, #2e1a2e); }
    .bp-sup-cat   { position: absolute; top: 8px; left: 8px; font-size: 9px; font-weight: 600; padding: 2px 8px; border-radius: 20px; background: rgba(0,0,0,0.5); color: #fff; }
    .bp-sup-heart { position: absolute; top: 8px; right: 8px; width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,0.9); display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--theme-accent); }
    .bp-sup-price { position: absolute; bottom: 8px; right: 8px; font-size: 9px; font-weight: 600; padding: 2px 8px; border-radius: 20px; background: rgba(0,0,0,0.5); color: #fff; }
    .bp-sup-body  { padding: 10px 12px 12px; }
    .bp-sup-name  { font-size: 13px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 2px; }
    .bp-sup-meta  { font-size: 11px; color: var(--color-text-secondary); margin-bottom: 6px; }
    .bp-sup-footer { display: flex; align-items: center; justify-content: space-between; }
    .bp-sup-rating { display: flex; align-items: center; gap: 3px; font-size: 11px; color: var(--color-text-secondary); }
    .bp-sup-star  { color: var(--theme-accent); }
    .bp-sup-count { color: var(--color-text-muted); }
    .bp-sup-action { font-size: 11px; font-weight: 500; color: var(--theme-accent); cursor: pointer; }
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

  uploadSupplierPanelId = '';

  get nextProject(): Project | null {
    return this.activeProjects.length > 0 ? this.activeProjects[0] : null;
  }

  constructor(
    private projectService: ProjectService,
    private orgService: OrgService,
    private supplierService: SupplierService,
    private configService: ConfigService,
    private cdr: ChangeDetectorRef,
  ) {}

  fmtCurrency(v: any): string { return ConfigService.formatCurrency(v); }

  openSupplierUpload(event: MouseEvent, s: any) {
    event.stopPropagation();
    event.preventDefault();
    this.uploadSupplierPanelId = this.uploadSupplierPanelId === s.id ? '' : s.id;
  }


  onSupplierImagesUpdated(s: any, urls: { coverUrl: string }) {
    s.hero_image_url = urls.coverUrl;
    this.uploadSupplierPanelId = '';
    this.cdr.detectChanges();
  }


  getCategoryClass(cat: string): string {
    const map: Record<string, string> = {
      'set build': 'setbuild', 'av': 'av', 'audio visual': 'av',
      'florals': 'florist', 'catering': 'catering',
    };
    return map[(cat || '').toLowerCase()] || 'default';
  }

  ngOnInit() {
    this.sub = this.configService.config$.subscribe(cfg => {
      this.projectLabel = cfg.projectLabel || 'Event';
      this.creditLabel  = cfg.creditLabel  || 'Ball';
      this.heroAlign    = cfg.heroAlign    || 'center';
      this.showUserName = cfg.showUserName !== false;
      this.showLocation = cfg.showLocation !== false;
      this.showUpcoming = cfg.showUpcoming !== false;
      this.showStats    = cfg.showStats    !== false;
      this.cdr.detectChanges();
    });

    this.orgService.getCurrentOrg().subscribe(org => {
      if (org) {
        this.org = org;
        const allowance = org.balls_monthly_allowance || 10;
        const balance   = org.balls_balance || 0;
        const used      = allowance - balance;
        this.creditDots = Array.from({ length: allowance }, (_, i) => i < used);
        const resetDate = new Date();
        resetDate.setDate(1);
        resetDate.setMonth(resetDate.getMonth() + 1);
        this.daysUntilReset = Math.ceil((resetDate.getTime() - Date.now()) / 86400000);
        this.cdr.detectChanges();
      }
    });

    // TODO: v1.3 auth — replace with getCurrentUser()
    this.orgService.getUsers().subscribe((users: any[]) => {
      if (users?.length) { this.userName = users[0].name || ''; this.cdr.detectChanges(); }
    });

    this.projectService.refresh$.subscribe(() => this.loadProjects());
    this.loadProjects();
    this.loadSuppliers();
  }

  loadProjects() {
    this.projectService.getAll().subscribe({
      next: projects => {
        this.projects = projects || [];
        this.activeProjects    = this.projects.filter(p => ['active','costing','draft'].includes(p.status_name || ''));
        this.completedProjects = this.projects.filter(p => ['completed','closed','cancelled'].includes(p.status_name || ''));
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  loadSuppliers() {
    this.supplierService.getAll().subscribe({
      next: (suppliers: any[]) => {
        this.suppliers = suppliers || [];
        this.supplierCount = this.suppliers.length;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }
}
