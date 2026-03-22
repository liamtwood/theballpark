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

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, ButtonModule, LoadingSpinnerComponent, ImageUploadPanelComponent, StatusBadgeComponent],
  template: `
    <div class="bp-page">
    <app-loading *ngIf="loading"></app-loading>
    <ng-container *ngIf="!loading">

      <!-- TWO-COLUMN BODY -->
      <div class="bp-body">
        <div class="bp-body-left">
          <!-- Active projects -->
          <div class="bp-section-header">
            <span class="bp-section-title">Active {{ projectLabel }}s</span>
            <a routerLink="/projects/new" class="bp-section-action"><lucide-icon name="plus" [size]="12"></lucide-icon> New {{ projectLabel }}</a>
          </div>
          <div *ngIf="activeProjects.length === 0" class="bp-empty">No active {{ projectLabel.toLowerCase() }}s yet.</div>
          <div *ngFor="let p of activeProjects" class="bp-card" [routerLink]="['/projects', p.id]">
            <div class="bp-card-img" [style.background-image]="p.cover_image_url ? 'url(' + p.cover_image_url + ')' : cardGradient(p)" [class.bp-card-grad-draft]="!p.cover_image_url && !p.card_color && p.status_name === 'draft'" [class.bp-card-grad-active]="!p.cover_image_url && !p.card_color && p.status_name !== 'draft'">
              <div class="bp-card-img-hover" (click)="openUploadPanel($event, p)"><lucide-icon name="pencil" [size]="16"></lucide-icon></div>
              <div *ngIf="p.client_logo_url" class="bp-card-logo" [style.background-image]="'url(' + p.client_logo_url + ')'"></div>
              <div *ngIf="!p.client_logo_url && p.client_name" class="bp-card-logo bp-card-logo-text">{{ clientInitials(p.client_name) }}</div>
            </div>
            <div class="bp-card-body">
              <div class="bp-card-row1">
                <span class="bp-card-name">{{ p.name }}</span>
                <app-status-badge [status]="p.status_name"></app-status-badge>
              </div>
              <div class="bp-card-row2">{{ p.client_name || '' }}{{ p.client_name && p.event_date ? ' · ' : '' }}{{ p.event_date || '' }}{{ (p.stand_width_m && p.stand_depth_m) ? ' · ' + p.stand_width_m + '×' + p.stand_depth_m + 'm' : '' }}</div>
              <div class="bp-card-row3" *ngIf="p.total_client_cost">Est. {{ fmtCurrency(p.total_client_cost) }}</div>
            </div>
            <app-image-upload-panel *ngIf="uploadPanelProjectId === p.id" [projectId]="p.id" [existingCoverUrl]="p.cover_image_url || ''" [existingLogoUrl]="p.client_logo_url || ''" [existingCardColor]="p.card_color || ''" (imagesUpdated)="onImagesUpdated(p, $event)" (closed)="uploadPanelProjectId = ''"></app-image-upload-panel>
          </div>

          <!-- Completed projects -->
          <div class="bp-section-spacer" *ngIf="completedProjects.length > 0">
            <div class="bp-section-header">
              <span class="bp-section-title">Completed {{ projectLabel }}s</span>
            </div>
          </div>
          <div *ngFor="let p of completedProjects" class="bp-card" [routerLink]="['/projects', p.id]">
            <div class="bp-card-img" [style.background-image]="p.cover_image_url ? 'url(' + p.cover_image_url + ')' : ''" [class.bp-card-grad-closed]="!p.cover_image_url">
              <div *ngIf="p.client_logo_url" class="bp-card-logo" [style.background-image]="'url(' + p.client_logo_url + ')'"></div>
              <div *ngIf="!p.client_logo_url && p.client_name" class="bp-card-logo bp-card-logo-text">{{ clientInitials(p.client_name) }}</div>
            </div>
            <div class="bp-card-body">
              <div class="bp-card-row1">
                <span class="bp-card-name">{{ p.name }}</span>
                <app-status-badge [status]="p.status_name"></app-status-badge>
              </div>
              <div class="bp-card-row2">{{ p.client_name || '' }}{{ p.client_name && p.event_date ? ' · ' : '' }}{{ p.event_date || '' }}</div>
              <div class="bp-card-row3" *ngIf="p.total_client_cost">{{ fmtCurrency(p.total_client_cost) }} final</div>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN -->
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
    .bp-hero {
      background: var(--theme-bg); padding: 32px var(--section-pad) 28px;
      border-bottom: 0.5px solid var(--color-border);
    }
    .bp-hero-pills { display: flex; gap: 8px; margin-bottom: 16px; }
    .bp-hero-pill {
      display: flex; align-items: center; gap: 5px;
      font-size: var(--text-sm); color: var(--color-text-secondary);
      background: var(--color-surface); border: 0.5px solid var(--color-border);
      border-radius: 20px; padding: 4px 12px;
    }
    .bp-hero-org-name {
      font-family: var(--font-display); font-size: var(--text-hero); font-weight: 400;
      color: var(--color-text-primary); letter-spacing: -0.02em; line-height: 1.1; margin-bottom: 8px;
    }
    .bp-hero-sub { font-size: var(--text-base); color: var(--color-text-muted); }
    .bp-body {
      display: grid; grid-template-columns: 1fr 320px;
      background: var(--color-bg);
      min-height: calc(100vh - var(--nav-height) - 120px - 80px - 64px);
    }
    .bp-body-left { padding: var(--section-pad); border-right: 0.5px solid var(--color-border); }
    .bp-body-right { padding: 24px; background: var(--color-surface); }
    .bp-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .bp-section-title { font-size: 11px; font-weight: 700; color: var(--theme-accent); text-transform: uppercase; letter-spacing: 0.1em; }
    .bp-section-action {
      font-size: var(--text-sm); color: var(--theme-accent); font-weight: 500;
      cursor: pointer; text-decoration: none;
      display: inline-flex; align-items: center; gap: 4px;
      transition: color 0.15s;
    }
    .bp-section-action:hover { color: var(--color-text-primary); }
    .bp-section-spacer { margin-top: 24px; }
    .bp-card {
      display: flex; flex-direction: row;
      border: 0.5px solid var(--color-border); border-radius: 10px;
      overflow: visible; position: relative;
      margin-bottom: 10px; background: var(--color-surface);
      cursor: pointer; transition: border-color 0.15s;
    }
    .bp-card:hover { border-color: var(--color-text-muted); }
    .bp-card-img {
      width: 160px; flex-shrink: 0; position: relative;
      background-size: cover; background-position: center;
      border-radius: 10px 0 0 10px; overflow: hidden; min-height: 90px;
    }
    .bp-card-grad-active { background-image: linear-gradient(160deg, #1a1a2e, #16213e); }
    .bp-card-grad-draft { background-image: linear-gradient(160deg, #1a4a2e, #0d2b1a); }
    .bp-card-grad-closed { background-image: linear-gradient(160deg, #2a2a2a, #1a1a1a); }
    .bp-card-img-hover {
      position: absolute; inset: 0; background: rgba(0,0,0,0.45);
      opacity: 0; transition: opacity 0.15s;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: white;
    }
    .bp-card-img:hover .bp-card-img-hover { opacity: 1; }
    .bp-card-logo {
      position: absolute; bottom: 50%; left: 50%;
      transform: translate(-50%, 50%);
      width: 128px; height: 128px; border-radius: 0;
      background: transparent; background-size: contain;
      background-repeat: no-repeat; background-position: center;
      border: none;
    }
    .bp-card-logo-text {
      display: flex; align-items: center; justify-content: center;
      font-size: 9px; font-weight: 700; color: #111;
    }
    .bp-card-body {
      flex: 1; padding: 14px 16px;
      display: flex; flex-direction: column; justify-content: space-between;
      min-width: 0;
    }
    .bp-card-row1 { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 5px; }
    .bp-card-name { font-size: 14px; font-weight: 500; color: var(--color-text-primary); line-height: 1.3; }
    .bp-card-row2 { font-size: 12px; color: var(--color-text-secondary); margin-bottom: 10px; }
    .bp-card-row3 { font-size: 12px; color: var(--color-text-secondary); }
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
    .bp-saved-hd {
      font-size: 11px; font-weight: 700; color: var(--theme-accent);
      text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 14px;
    }
    .bp-sup-card {
      border: 0.5px solid var(--color-border); border-radius: 10px;
      overflow: hidden; margin-bottom: 10px; cursor: pointer; transition: border-color 0.15s;
      background: var(--color-surface);
    }
    .bp-sup-card:hover { border-color: var(--color-text-muted); }
    .bp-sup-img {
      width: 100%; height: 120px; position: relative;
      display: flex; align-items: center; justify-content: center;
      background-size: cover; background-position: center; overflow: hidden;
    }
    .bp-sup-desc {
      position: absolute; inset: 0; background: rgba(0,0,0,0.7);
      color: #fff; font-size: 11px; line-height: 1.5; padding: 12px;
      display: flex; align-items: center; opacity: 0; transition: opacity 0.15s;
    }
    .bp-sup-img:hover .bp-sup-desc { opacity: 1; }
    .bp-sup-overlay {
      position: absolute; inset: 0; background: rgba(0,0,0,0.45);
      opacity: 0; transition: opacity 0.15s;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; z-index: 2;
    }
    .bp-sup-img:hover .bp-sup-overlay { opacity: 1; }
    .bp-sup-bg-setbuild { background-image: linear-gradient(160deg, #1a1a2e, #16213e); }
    .bp-sup-bg-av { background-image: linear-gradient(160deg, #0d1b2a, #1b2838); }
    .bp-sup-bg-florist { background-image: linear-gradient(160deg, #2d1b2e, #4a1942); }
    .bp-sup-bg-catering { background-image: linear-gradient(160deg, #1a2e1a, #162116); }
    .bp-sup-bg-default { background-image: linear-gradient(160deg, #1a1a2e, #2e1a2e); }
    .bp-sup-cat {
      position: absolute; top: 8px; left: 8px;
      font-size: 9px; font-weight: 600; padding: 2px 8px; border-radius: 20px;
      background: rgba(0,0,0,0.5); color: #fff;
    }
    .bp-sup-heart {
      position: absolute; top: 8px; right: 8px;
      width: 26px; height: 26px; border-radius: 50%;
      background: rgba(255,255,255,0.9);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; color: var(--theme-accent);
    }
    .bp-sup-price {
      position: absolute; bottom: 8px; right: 8px;
      font-size: 9px; font-weight: 600; padding: 2px 8px; border-radius: 20px;
      background: rgba(0,0,0,0.5); color: #fff;
    }
    .bp-sup-body { padding: 10px 12px 12px; }
    .bp-sup-name { font-size: 13px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 2px; }
    .bp-sup-meta { font-size: 11px; color: var(--color-text-secondary); margin-bottom: 6px; }
    .bp-sup-footer { display: flex; align-items: center; justify-content: space-between; }
    .bp-sup-rating { display: flex; align-items: center; gap: 3px; font-size: 11px; color: var(--color-text-secondary); }
    .bp-sup-star { color: var(--theme-accent); }
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

  uploadPanelProjectId = '';
  uploadSupplierPanelId = '';

  constructor(
    private projectService: ProjectService,
    private orgService: OrgService,
    private supplierService: SupplierService,
    private configService: ConfigService,
    private cdr: ChangeDetectorRef,
  ) {}

  fmtCurrency(v: any): string { return ConfigService.formatCurrency(v); }

  clientInitials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  openUploadPanel(event: MouseEvent, project: Project) {
    event.stopPropagation();
    event.preventDefault();
    this.uploadPanelProjectId = this.uploadPanelProjectId === project.id ? '' : project.id;
  }

  onImagesUpdated(project: Project, urls: { coverUrl: string; logoUrl: string; cardColor?: string }) {
    if (urls.coverUrl !== undefined) project.cover_image_url = urls.coverUrl || '';
    if (urls.logoUrl !== undefined) project.client_logo_url = urls.logoUrl || '';
    if (urls.cardColor !== undefined) project.card_color = urls.cardColor || '';
    this.uploadPanelProjectId = '';
    this.cdr.detectChanges();
  }

  openSupplierUpload(event: MouseEvent, s: any) {
    event.stopPropagation();
    event.preventDefault();
    this.uploadSupplierPanelId = this.uploadSupplierPanelId === s.id ? '' : s.id;
  }

  onSupplierImagesUpdated(s: any, urls: { coverUrl: string; logoUrl: string }) {
    s.hero_image_url = urls.coverUrl;
    this.suppliers = [...this.suppliers];
    this.uploadSupplierPanelId = '';
    this.cdr.detectChanges();
  }

  private cardColorMap: Record<string, string> = {
    slate:  'linear-gradient(160deg, #2a2a2a, #1a1a1a)',
    navy:   'linear-gradient(160deg, #1a1a2e, #16213e)',
    wine:   'linear-gradient(160deg, #4a1a2e, #2e0d1a)',
    sky:    'linear-gradient(160deg, #a8d8ea, #6bb7d4)',
    peach:  'linear-gradient(160deg, #f5c6aa, #e8a87c)',
    mint:   'linear-gradient(160deg, #a8e6cf, #6bc4a6)',
  };

  getCategoryClass(category: string): string {
    if (!category) return 'default';
    const c = category.toLowerCase();
    if (c.includes('build') || c.includes('stand')) return 'setbuild';
    if (c.includes('av') || c.includes('audio') || c.includes('visual')) return 'av';
    if (c.includes('flor')) return 'florist';
    if (c.includes('cater')) return 'catering';
    return 'default';
  }

  cardGradient(p: Project): string {
    if (!p.card_color || !this.cardColorMap[p.card_color]) return '';
    return this.cardColorMap[p.card_color];
  }

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
        this.completedProjects = data.filter(p => p.status_name === 'completed' || p.status_name === 'cancelled');
        this.activeProjects = data.filter(p => !this.completedProjects.includes(p));
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); },
    });

    this.supplierService.getAll().subscribe({
      next: (data) => {
        this.suppliers = data.map((s: any) => ({
          id: s.id,
          name: s.name,
          city: s.city || '',
          category: s.category || s.category_name || '',
          description: s.description || '',
          price: s.base_price ? 'from £' + s.base_price : '',
          rating: s.rating || null,
          review_count: s.review_count || null,
          hero_image_url: s.cover_image_url || s.hero_image_url || null,
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
