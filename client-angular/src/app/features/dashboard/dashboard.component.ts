import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { LucideAngularModule, Plus, Folder, Building2, ChevronRight, Calendar, MapPin, Heart, MessageCircle } from 'lucide-angular';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfigStripComponent } from '../../shared/components/config-strip/config-strip.component';
import { ProjectService } from '../../core/services/project.service';
import { OrgService } from '../../core/services/org.service';
import { SupplierService } from '../../core/services/supplier.service';
import { ConfigService } from '../../core/services/config.service';
import { ShellContextService } from '../../core/services/shell-context.service';
import { Project, Org } from '../../models';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { ImageUploadPanelComponent } from '../../shared/components/image-upload-panel/image-upload-panel.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { EventDatePipe } from '../../shared/pipes/event-date.pipe';
import { CompactCurrencyPipe } from '../../shared/pipes/compact-currency.pipe';
import { FavouriteService, Favourite } from '../../core/services/favourite.service';

type DashTab = 'projects';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    LucideAngularModule,
    CardModule, ButtonModule, CheckboxModule, InputTextModule,
    ConfirmDialogModule, ToastModule,
    LoadingSpinnerComponent, ImageUploadPanelComponent, StatusBadgeComponent,
    ConfigStripComponent,
    EventDatePipe, CompactCurrencyPipe
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <div class="bp-page">
    <app-loading *ngIf="loading"></app-loading>
    <ng-container *ngIf="!loading">

      <!-- ── v1.23 ADMIN SETTINGS STRIP ────────────────────────────
           Mounted via <app-config-strip>; the top-nav cog button
           (already wired in top-nav, gated by hasConfig && isAdmin)
           toggles open/closed via ConfigStripService. The mount
           itself is what registers the cog button to appear, so
           non-admin users see neither the strip nor the cog. -->
      <app-config-strip>
        <!-- v1.23b: reuse the global .bp-cfg-* classes so the strip
             reads identically to the marketplace ConfigStrip (same
             label sizing, segmented buttons, theme swatches). The
             dashboard-specific row is COMPONENTS — a segmented
             button group where each pill is an independent toggle. -->
        <div class="bp-cfg-row">

          <!-- Labels -->
          <span class="bp-cfg-lab">PAGE LABEL</span>
          <input pInputText
                 class="bp-cfg-page-label"
                 [(ngModel)]="settingsDraft.homePageLabel"
                 (blur)="saveLabels()"
                 placeholder="Projects"/>
          <span class="bp-cfg-divider"></span>

          <span class="bp-cfg-lab">CREDITS</span>
          <input pInputText
                 class="bp-cfg-page-label"
                 [(ngModel)]="settingsDraft.creditLabel"
                 (blur)="saveLabels()"
                 placeholder="Balls"/>
          <span class="bp-cfg-divider"></span>

          <span class="bp-cfg-lab">EVENTS</span>
          <input pInputText
                 class="bp-cfg-page-label"
                 [(ngModel)]="settingsDraft.projectLabel"
                 (blur)="saveLabels()"
                 placeholder="Events"/>
          <span class="bp-cfg-divider"></span>

          <!-- Theme — round dot swatches, identical to marketplace. -->
          <span class="bp-cfg-lab">THEME</span>
          <div class="bp-cfg-swatches-row">
            <button *ngFor="let t of themeOptions"
                    type="button"
                    class="bp-cfg-swatch-btn"
                    [class.active]="settingsDraft.themeName === t.value"
                    [style.background]="t.color"
                    [title]="t.label"
                    (click)="onThemeChange(t.value)">
            </button>
          </div>
          <span class="bp-cfg-divider"></span>

          <!-- Components — segmented button group, each pill is an
               independent toggle. Active pill fills theme accent;
               inactive renders flush in the shared rounded outline.
               Organisation is disabled (always on). -->
          <span class="bp-cfg-lab">COMPONENTS</span>
          <div class="bp-cfg-seg bp-cfg-seg--multi">
            <button *ngFor="let opt of componentOptions"
                    type="button"
                    class="bp-cfg-seg-btn"
                    [class.p-highlight]="isComponentActive(opt.value)"
                    [disabled]="opt.disabled"
                    [title]="opt.disabled ? opt.label + ' — always on' : opt.label"
                    (click)="toggleComponent(opt.value)">
              {{ opt.label }}
            </button>
          </div>
          <span class="bp-cfg-divider"></span>

          <!-- v1.23e: NAV — Tabs vs Menu (sidenav). Mirrors the
               Marketplace settings page's "Navigation" picker but
               rendered inline in the strip. Single-pick segmented
               group so it's visually distinct from the multi-toggle
               COMPONENTS row above. Writes ConfigService.navMode;
               AppShell picks it up via config$ and re-renders. -->
          <span class="bp-cfg-lab">NAV</span>
          <div class="bp-cfg-seg">
            <button *ngFor="let opt of navOptions"
                    type="button"
                    class="bp-cfg-seg-btn"
                    [class.p-highlight]="settingsDraft.navMode === opt.value"
                    (click)="selectNavMode(opt.value)">
              {{ opt.label }}
            </button>
          </div>

        </div>
      </app-config-strip>

      <!-- STATS BAR — always visible on desktop, Summary tab on mobile -->
      <div class="bp-dash-stats" *ngIf="settingsDraft.showStats !== false">
        <div class="bp-dash-stat">
          <span class="bp-dash-stat-label">{{ creditLabel }}s remaining</span>
          <span class="bp-dash-stat-value">{{ org?.balls_balance ?? 0 }}</span>
          <span class="bp-dash-stat-sub">resets in {{ daysUntilReset }} days</span>
        </div>
        <div class="bp-dash-stat">
          <span class="bp-dash-stat-label">Active {{ projectLabel }}s</span>
          <span class="bp-dash-stat-value">{{ activeProjects.length }}</span>
          <span class="bp-dash-stat-sub">{{ activeProjects[0]?.name || 'none yet' }}</span>
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

      <!-- ══════════════════════════════════════════════════
           DESKTOP — three column layout
           MOBILE — hidden, replaced by tab panels below
      ══════════════════════════════════════════════════ -->
      <div class="bp-body bp-desktop-only">

        <!-- LEFT PANEL -->
        <div class="bp-body-panel">
          <div class="bp-panel-section">
            <div class="bp-section-header"><span class="bp-section-title">Upcoming</span></div>
            <ng-container *ngIf="nextProject">
              <p class="bp-upcoming-name">{{ nextProject.event_name || nextProject.name }}</p>
              <p class="bp-upcoming-meta">{{ nextProject.client_name }}</p>
              <p class="bp-upcoming-meta" *ngIf="nextProject.venue_name">{{ nextProject.venue_name }}</p>
              <p class="bp-upcoming-date" *ngIf="nextProject.event_date">{{ nextProject.event_date | eventDate }}</p>
            </ng-container>
            <p *ngIf="!nextProject" class="bp-empty">No upcoming events.</p>
          </div>
          <div class="bp-panel-section">
            <div class="bp-section-header"><span class="bp-section-title">Recent Activity</span></div>
            <div class="bp-activity-item"><div class="bp-activity-dot"></div><span>Brief updated — TechVista London</span><span class="bp-activity-time">2h ago</span></div>
            <div class="bp-activity-item"><div class="bp-activity-dot"></div><span>Project created — Food &amp; Drink Expo</span><span class="bp-activity-time">1d ago</span></div>
            <div class="bp-activity-item"><div class="bp-activity-dot"></div><span>Supplier saved — Construct &amp; Co.</span><span class="bp-activity-time">2d ago</span></div>
          </div>
          <div class="bp-panel-section">
            <div class="bp-section-header"><span class="bp-section-title">Quick Actions</span></div>
            <!-- v1.22b: "+ New Project" removed from Quick Actions —
                 it already lives next to the Active Events header.
                 v1.22i: Browse Suppliers now lands on the Suppliers
                 toggle (was defaulting to Items).
                 v1.22j: icons dropped from the links so every Quick
                 Action reads as one clean outlined CTA; Settings
                 added as the third entry. -->
            <a [routerLink]="['/suppliers']"
               [queryParams]="{ view: 'suppliers' }"
               class="bp-quick-action">Browse Suppliers</a>
            <a routerLink="/settings/team" class="bp-quick-action">Invite Member</a>
            <a routerLink="/settings" class="bp-quick-action">Settings</a>
          </div>
        </div>

        <!-- CENTRE -->
        <div class="bp-body-left">
          <div class="bp-section-header">
            <span class="bp-section-title">Active {{ projectLabel }}s</span>
            <!-- v1.22: in-header "+ New project" CTA. The Quick Actions
                 link stays — this position is more discoverable.
                 v1.23d: label cascades from ConfigService.projectLabel
                 — Title Case + plural ("Event" → "+ New Events",
                 "Show" → "+ New Shows"). projectLabel is stored
                 singular; we append "s" the same way "Active {label}s"
                 does elsewhere on the dashboard. -->
            <button type="button" class="bp-section-new-btn" (click)="createProject()">
              + New {{ projectLabel }}s
            </button>
          </div>
          <p *ngIf="activeProjects.length === 0" class="bp-empty">No active {{ projectLabel.toLowerCase() }}s yet.</p>
          <div class="bp-project-grid">
            <div *ngFor="let p of activeProjects"
                 class="bp-project-card-wrap"
                 [class.bp-project-card-wrap--menu-open]="openMenuProjectId === p.id">
              <p-card styleClass="bp-project-card" [routerLink]="['/projects', p.id]">
                <ng-template pTemplate="header">
                  <div class="bp-card-header"
                    [style.background-image]="p.cover_image_url ? 'url(' + p.cover_image_url + ')' : null"
                    [class.bp-card-header-active]="!p.cover_image_url && projectStatus(p).key !== 'draft'"
                    [class.bp-card-header-draft]="!p.cover_image_url && projectStatus(p).key === 'draft'">
                    <!-- v1.22 status pill — sentence case, solid colour
                         (Draft amber, Active green, Closed grey). Replaces
                         the previous app-status-badge in this slot. -->
                    <span class="bp-card-status-pill"
                          [class.bp-card-status-pill--draft]="projectStatus(p).key === 'draft'"
                          [class.bp-card-status-pill--active]="projectStatus(p).key === 'active'"
                          [class.bp-card-status-pill--closed]="projectStatus(p).key === 'closed'">
                      {{ projectStatus(p).label }}
                    </span>
                    <!-- Client chip moved bottom-left per v1.22. -->
                    <span *ngIf="p.client_name" class="bp-card-client-chip">{{ p.client_name }}</span>
                    <img *ngIf="p.client_logo_url" [src]="p.client_logo_url" class="bp-card-logo" alt="client logo"/>
                  </div>
                </ng-template>
                <div class="bp-card-content">
                  <div class="bp-card-name-row">
                    <div class="bp-card-name">{{ p.event_name || p.name }}</div>
                    <button type="button" class="bp-card-menu-btn"
                            (click)="toggleMenu($event, p)"
                            title="More actions">⋯</button>
                  </div>
                  <div class="bp-card-meta">{{ p.event_date | eventDate }}</div>
                  <div class="bp-card-cost">Est. {{ p.total_client_cost | compactCurrency }}</div>
                  <!-- "..." dropdown menu. Click-outside closes via the
                       host listener; stopPropagation on the menu itself
                       so clicks inside don't bubble to the card-link. -->
                  <div *ngIf="openMenuProjectId === p.id"
                       class="bp-card-menu"
                       (click)="$event.stopPropagation(); $event.preventDefault()">
                    <button type="button" class="bp-card-menu-item"
                            (click)="onMenuAction('edit-image', p, $event)">
                      Edit image
                    </button>
                    <button type="button" class="bp-card-menu-item"
                            (click)="onMenuAction('copy', p, $event)">
                      Copy
                    </button>
                    <div class="bp-card-menu-sep"></div>
                    <button type="button" class="bp-card-menu-item bp-card-menu-item--danger"
                            (click)="onMenuAction('delete', p, $event)">
                      Delete
                    </button>
                  </div>
                </div>
              </p-card>
              <app-image-upload-panel *ngIf="uploadPanelProjectId === p.id" [projectId]="p.id" [existingCoverUrl]="p.cover_image_url || ''" [existingLogoUrl]="p.client_logo_url || ''" [existingCardColor]="p.card_color || ''" (imagesUpdated)="onImagesUpdated(p, $event)" (closed)="uploadPanelProjectId = ''"></app-image-upload-panel>
            </div>
          </div>

          <!-- ── v1.22 PAST EVENTS CAROUSEL ──────────────────────────
               Horizontal scrolling list of closed projects. Replaces the
               previous full-size "Completed Events" grid. Hidden when
               there are no closed projects. -->
          <div class="bp-section-spacer" *ngIf="completedProjects.length > 0">
            <div class="bp-section-header">
              <span class="bp-section-title">Past {{ projectLabel }}s</span>
              <a routerLink="/projects" class="bp-section-link">
                View all {{ completedProjects.length }} closed →
              </a>
            </div>
          </div>
          <div class="bp-past-carousel" *ngIf="completedProjects.length > 0">
            <a *ngFor="let p of completedProjects.slice(0, 10); let i = index"
               class="bp-past-card"
               [class.bp-past-card--fade]="i === 9 && completedProjects.length > 10"
               [routerLink]="['/projects', p.id]">
              <div class="bp-past-cover"
                   [style.background-image]="p.cover_image_url ? 'url(' + p.cover_image_url + ')' : null"
                   [class.bp-past-cover--empty]="!p.cover_image_url">
                <span class="bp-past-year">{{ extractYear(p.event_date) || '—' }}</span>
                <span class="bp-past-status-pill">Closed</span>
              </div>
              <div class="bp-past-body">
                <div class="bp-past-name">{{ p.event_name || p.name }}</div>
                <div class="bp-past-sub">
                  <ng-container *ngIf="p.client_name">{{ p.client_name }} · </ng-container>
                  Est. {{ p.total_client_cost | compactCurrency }}
                </div>
              </div>
            </a>
          </div>
        </div>

        <!-- RIGHT -->
        <div class="bp-body-right">
          <div class="bp-credits-card">
            <div class="bp-credits-number">{{ org?.balls_balance ?? 0 }}</div>
            <div class="bp-credits-label">{{ creditLabel }}s remaining this month</div>
            <div class="bp-credits-dots">
              <div *ngFor="let dot of creditDots" class="bp-credit-dot" [class.filled]="dot" [class.empty]="!dot"></div>
            </div>
            <p class="bp-credits-desc">Build and estimate for free — only spend a {{ creditLabel }} when ready to engage.</p>
          </div>
          <div class="bp-saved-hd">SAVED SUPPLIERS</div>
          <ng-container *ngIf="favSuppliers.length > 0; else noFavSuppliers">
            <!-- 2-column grid so each card sits at ~160px wide and the
                 140px cover lands ~1.15:1 (matches marketplace). -->
            <div class="bp-sup-grid">
              <div *ngFor="let s of favSuppliers.slice(0,2)" class="bp-sup-card">
                <div class="bp-sup-img bp-sup-bg-default"
                     [style.background-image]="s.ref_image_url ? 'url(' + s.ref_image_url + ')' : null">
                  <!-- v1.22i: lucide heart in a small white circle.
                       The previous &hearts; entity was rendered white,
                       so it disappeared on white card backgrounds. -->
                  <div class="bp-sup-heart">
                    <lucide-icon name="heart" [size]="11"></lucide-icon>
                  </div>
                </div>
                <div class="bp-sup-body">
                  <div class="bp-sup-name">{{ s.ref_name }}</div>
                  <div class="bp-sup-meta">Saved</div>
                </div>
              </div>
            </div>
            <a [routerLink]="['/suppliers']"
               [queryParams]="{ view: 'suppliers' }"
               class="bp-quick-action">
              My Suppliers
            </a>
          </ng-container>
          <ng-template #noFavSuppliers>
            <div class="bp-empty">No saved suppliers yet</div>
            <a [routerLink]="['/suppliers']"
               [queryParams]="{ view: 'suppliers' }"
               class="bp-quick-action">
              My suppliers
            </a>
          </ng-template>
        </div>

      </div>

      <!-- ══════════════════════════════════════════════════
           MOBILE TAB PANELS — hidden on desktop
      ══════════════════════════════════════════════════ -->

      <!-- PROJECTS TAB -->
      <div class="bp-mobile-panel" [class.active]="activeTab === 'projects'">
        <div class="bp-section-header">
          <span class="bp-section-title">Active {{ projectLabel }}s</span>
          <!-- <a routerLink="/projects/new" class="bp-section-action">+ New</a> -->
        </div>
        <p *ngIf="activeProjects.length === 0" class="bp-mobile-empty">No active projects yet.</p>
        <a *ngFor="let p of activeProjects" class="bp-row-card" [routerLink]="['/projects', p.id]">
          <lucide-icon name="folder" [size]="18" class="bp-row-icon" [class.muted]="p.status_name === 'draft'"></lucide-icon>
          <div class="bp-row-body">
            <div class="bp-row-name">{{ p.event_name || p.name }}</div>
            <div class="bp-row-meta">{{ p.client_name }}<ng-container *ngIf="p.event_date"> · {{ p.event_date | eventDate }}</ng-container></div>
          </div>
          <lucide-icon name="chevron-right" [size]="16" class="bp-row-chev"></lucide-icon>
        </a>
        <div class="bp-section-header" *ngIf="completedProjects.length > 0" style="margin-top:8px;">
          <span class="bp-section-title">Completed</span>
        </div>
        <a *ngFor="let p of completedProjects" class="bp-row-card" [routerLink]="['/projects', p.id]">
          <lucide-icon name="folder" [size]="18" class="bp-row-icon muted"></lucide-icon>
          <div class="bp-row-body">
            <div class="bp-row-name">{{ p.event_name || p.name }}</div>
            <div class="bp-row-meta">{{ p.client_name }}<ng-container *ngIf="p.event_date"> · {{ p.event_date | eventDate }}</ng-container></div>
          </div>
          <lucide-icon name="chevron-right" [size]="16" class="bp-row-chev"></lucide-icon>
        </a>
      </div>

    </ng-container>
    </div>

    <p-confirmDialog styleClass="bp-confirm"></p-confirmDialog>
    <p-toast></p-toast>
  `,
  styles: [`
    /* STATS */
    .bp-dash-stats { display:grid; grid-template-columns:repeat(4,1fr); border-bottom:0.5px solid var(--color-border); background:var(--color-surface); }
    .bp-dash-stat  { display:flex; flex-direction:column; align-items:center; padding:14px 20px; border-right:0.5px solid var(--color-border); }
    .bp-dash-stat:last-child { border-right:none; }
    .bp-dash-stat-label { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:var(--theme-accent); margin-bottom:2px; }
    .bp-dash-stat-value { font-size:26px; font-weight:700; color:var(--color-text-primary); line-height:1.1; }
    .bp-dash-stat-sub   { font-size:11px; color:var(--color-text-muted); margin-top:2px; }

    /* DESKTOP 3-COL */
    .bp-body { display:grid; grid-template-columns:384px minmax(400px,1fr) 384px; background:var(--color-bg); min-height:calc(100vh - var(--nav-height) - 64px); }
    .bp-body-panel { padding:24px; background:var(--color-surface); border-right:0.5px solid var(--color-border); }
    .bp-panel-section { margin-bottom:28px; }
    .bp-upcoming-name { font-size:13px; font-weight:500; color:var(--color-text-primary); margin-bottom:4px; }
    .bp-upcoming-meta { font-size:11px; color:var(--color-text-muted); margin-bottom:2px; }
    .bp-upcoming-date { font-size:11px; color:var(--theme-accent); font-weight:500; margin-top:4px; }
    .bp-activity-item { display:flex; align-items:flex-start; gap:8px; padding:6px 0; border-bottom:0.5px solid var(--color-border); font-size:12px; color:var(--color-text-secondary); line-height:1.4; }
    .bp-activity-dot  { width:6px; height:6px; border-radius:50%; background:var(--theme-accent); margin-top:4px; flex-shrink:0; }
    .bp-activity-time { font-size:11px; color:var(--color-text-muted); margin-left:auto; white-space:nowrap; padding-left:8px; }
    /* v1.22b: unified outlined-CTA style. Matches the "View all saved →"
       p-button-outlined treatment (amber border + amber text, fills
       amber on hover) so every dashboard CTA reads as one family.
       The only filled exception is the "+ New project" primary button
       in the Active Events header. */
    .bp-quick-action  {
      display:flex; align-items:center; justify-content:center; gap:8px;
      width:100%; padding:8px 12px; margin-bottom:8px;
      border:0.5px solid var(--theme-accent);
      border-radius: var(--radius-button);
      background:var(--color-surface);
      font-size:13px; font-weight:500; color:var(--theme-accent);
      cursor:pointer; text-decoration:none;
      transition:background 0.15s, color 0.15s;
      font-family:var(--font-body);
    }
    .bp-quick-action:hover {
      background:var(--theme-accent);
      color:var(--color-surface);
    }
    .bp-body-left { padding:var(--section-pad); border-right:0.5px solid var(--color-border); }
    .bp-section-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
    /* v1.22: section eyebrow standardised — weight 500 (was 700) and
       letter-spacing 0.06em (was 0.1em) so the labels feel less
       heavy. Applied to .bp-section-title + .bp-saved-hd below. */
    .bp-section-title { font-size:11px; font-weight:500; color:var(--theme-accent); text-transform:uppercase; letter-spacing:0.06em; }
    .bp-section-action { font-size:var(--text-sm); color:var(--theme-accent); font-weight:500; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; gap:4px; transition:color 0.15s; }
    .bp-section-action:hover { color:var(--color-text-primary); }
    .bp-section-spacer { margin-top:24px; }

    /* P-CARD GRID */
    .bp-project-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; margin-bottom:8px; }
    .bp-project-card-wrap { display:block; }
    /* v1.22 elevation: Level 1 at rest (shadow-xs + hairline), Level 2
       on hover (shadow-sm + stronger hairline + translateY(-1px)).
       overflow:visible kept from v1.22g so the "..." dropdown can
       extend past the card edge; the cover image's rounded top is
       clipped by .bp-card-header below. */
    :host ::ng-deep .bp-project-card.p-card {
      border: var(--border-hairline) !important;
      border-radius: var(--radius-card) !important;
      box-shadow: var(--shadow-xs) !important;
      overflow: visible !important;
      margin: 0;
      cursor: pointer;
      position: relative;
      transition: box-shadow 150ms ease, border-color 150ms ease, transform 150ms ease;
    }
    :host ::ng-deep .bp-project-card-wrap:hover .bp-project-card.p-card {
      border: var(--border-hairline-strong) !important;
      box-shadow: var(--shadow-sm) !important;
      transform: translateY(-1px);
    }
    :host ::ng-deep .bp-project-card .p-card-body, :host ::ng-deep .bp-project-card .p-card-content, :host ::ng-deep .bp-project-card .p-card-header { padding:0 !important; }
    .bp-card-header {
      height:110px; position:relative;
      display:flex; align-items:flex-end; justify-content:space-between;
      padding:8px 10px;
      background-size:cover; background-position:center;
      /* Top-corner clip lives on the header, not the parent card —
         keeps the cover image from spilling out of the rounded
         corners now that the p-card itself is overflow:visible. */
      border-top-left-radius: var(--radius-card);
      border-top-right-radius: var(--radius-card);
      overflow:hidden;
    }
    .bp-card-header-active { background-image:linear-gradient(160deg,#1e3a5f,#2563eb); }
    .bp-card-header-draft  { background-image:linear-gradient(160deg,#374151,#4B5563); }
    .bp-card-header-closed { background-image:linear-gradient(160deg,#374151,#6B7280); }
    /* v1.22: client chip moved to bottom-left of cover. Lighter
       white-translucent treatment so it doesn't fight the cover image. */
    .bp-card-client-chip {
      position:absolute; bottom:8px; left:8px;
      background:rgba(255,255,255,0.92); color:var(--color-text-primary);
      border-radius: var(--radius-pill); padding:3px 10px;
      font-size:10px; font-weight:500;
      font-family: var(--font-body);
    }

    /* v1.22: solid-fill status pill in top-right. Sentence case, white
       text, themed colours. Replaces the previous app-status-badge in
       this slot — kept smaller and quieter so it reads as a chip not a
       full label. */
    .bp-card-status-pill {
      position:absolute; top:8px; right:8px;
      font-size:10px; font-weight:500;
      padding:3px 10px;
      border-radius: var(--radius-pill);
      color:var(--color-surface);
      background:var(--color-text-secondary);
      font-family: var(--font-body);
      letter-spacing: 0.01em;
    }
    .bp-card-status-pill--draft  { background: var(--theme-accent); }
    .bp-card-status-pill--active { background: var(--color-booked-text); }
    .bp-card-status-pill--closed { background: var(--color-text-muted); }
    .bp-card-logo          { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); max-width:70%; max-height:70%; object-fit:contain; pointer-events:none; }
    .bp-card-edit-overlay  { position:absolute; inset:0; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.15s; cursor:pointer; }
    .bp-card-header:hover .bp-card-edit-overlay { opacity:1; }
    .bp-card-content { padding:12px 14px 14px; position: relative; }
    /* v1.22: name + "..." menu sit on the same row so the menu trigger
       is reachable without overlapping the cover image. */
    .bp-card-name-row {
      display:flex; align-items:flex-start; gap:6px;
      margin-bottom:4px;
    }
    .bp-card-name { font-size:13px; font-weight:600; color:var(--color-text-primary); flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .bp-card-menu-btn {
      width:24px; height:24px;
      border-radius:50%;
      border:none; background:none;
      color:var(--color-text-muted);
      cursor:pointer;
      flex-shrink:0;
      font-size:16px; line-height:1;
      display:flex; align-items:center; justify-content:center;
      transition: background 0.15s, color 0.15s;
    }
    .bp-card-menu-btn:hover {
      background:var(--theme-bg);
      color:var(--theme-accent);
    }
    /* Dropdown — anchored bottom-right of the name row. v1.22
       elevation: Level 3 (shadow-md) + hairline + button radius.
       z-index + card overflow:visible let it overlay siblings. */
    .bp-card-menu {
      position:absolute;
      top:32px; right:12px;
      width:150px;
      background:var(--color-surface);
      border: var(--border-hairline);
      border-radius: var(--radius-button);
      padding:4px 0;
      z-index:50;
      box-shadow: var(--shadow-md);
    }
    /* Lift the wrap (and therefore its dropdown menu) above sibling
       cards when the menu is open, so the dropdown isn't covered by
       the next card's border / hero image. The wrap is always
       position:relative so z-index applies; the --menu-open modifier
       is added by the template via [class.…] when openMenuProjectId
       matches this card. */
    .bp-project-card-wrap { position:relative; }
    .bp-project-card-wrap--menu-open { z-index:30; }
    .bp-card-menu-item {
      display:block;
      width:100%;
      padding:8px 12px;
      font-size:12px;
      font-weight:500;
      text-align:left;
      background:none;
      border:none;
      cursor:pointer;
      color:var(--color-text-primary);
      font-family: var(--font-body);
      transition: background 0.1s;
    }
    .bp-card-menu-item:hover { background:var(--theme-bg); }
    .bp-card-menu-item--danger { color:var(--color-danger); }
    .bp-card-menu-item--danger:hover {
      background:rgba(225, 29, 72, 0.06);
    }
    .bp-card-menu-sep {
      height:0.5px;
      background:var(--color-border);
      margin:4px 0;
    }
    .bp-card-meta { font-size:11px; color:var(--color-text-muted); margin-bottom:6px; }
    .bp-card-cost { font-size:13px; font-weight:500; color:var(--color-text-secondary); }

    /* v1.22 elevation: "+ New project" is the one primary CTA in
       the button standard — filled themed accent, white text. The
       secondary outlined family (Quick Actions etc.) stays around it.
         rest:   no shadow (the colour does the lifting)
         hover:  shadow-sm
         active: scale(0.98) — physical press feedback */
    .bp-section-new-btn {
      display:inline-flex; align-items:center; gap:6px;
      padding:8px 12px;
      font-size:13px;
      font-weight:500;
      font-family: var(--font-body);
      color:var(--color-surface);
      background:var(--theme-accent);
      border:none;
      border-radius: var(--radius-button);
      cursor:pointer;
      transition: box-shadow 150ms ease, transform 150ms ease, filter 150ms ease;
    }
    .bp-section-new-btn:hover {
      box-shadow: var(--shadow-sm);
      filter: brightness(1.05);
    }
    .bp-section-new-btn:active { transform: scale(0.98); }
    /* v1.22d: section-header CTA — same font / padding as
       .bp-quick-action (13px / 8px 12px). The whole CTA family now
       reads at one size whether it's stacked in the sidebar or
       inline next to a section title. */
    .bp-section-link {
      display:inline-flex; align-items:center; gap:6px;
      padding:8px 12px;
      font-size:13px;
      font-weight:500;
      color:var(--theme-accent);
      background:var(--color-surface);
      border:0.5px solid var(--theme-accent);
      border-radius: var(--radius-button);
      text-decoration:none;
      font-family: var(--font-body);
      transition:background 0.15s, color 0.15s;
    }
    .bp-section-link:hover {
      background:var(--theme-accent);
      color:var(--color-surface);
    }

    /* ── PAST EVENTS CAROUSEL ──────────────────────────────────────
       Horizontal scroll, snap-to-card, hidden scrollbar. Compact
       cards (130px) replace the previous full-grid "Completed
       Events" section. */
    .bp-past-carousel {
      display:flex;
      gap:8px;
      overflow-x:auto;
      padding:0 0 8px;
      scroll-snap-type: x mandatory;
      scrollbar-width:none;
      -ms-overflow-style:none;
    }
    .bp-past-carousel::-webkit-scrollbar { display:none; }
    .bp-past-card {
      flex-shrink:0;
      width:130px;
      scroll-snap-align:start;
      border: var(--border-hairline);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-xs);
      overflow:hidden;
      background:var(--color-surface);
      text-decoration:none;
      color:inherit;
      transition: box-shadow 150ms ease, border-color 150ms ease, transform 150ms ease;
    }
    .bp-past-card:hover {
      border: var(--border-hairline-strong);
      box-shadow: var(--shadow-sm);
      transform: translateY(-1px);
    }
    .bp-past-card--fade { opacity: 0.6; }
    .bp-past-cover {
      position:relative;
      height:72px;
      background-size:cover;
      background-position:center;
      background-color: var(--theme-bg);
    }
    .bp-past-cover--empty {
      background-image: linear-gradient(160deg, var(--theme-bg), var(--theme-border));
    }
    .bp-past-year {
      position:absolute;
      bottom:6px; left:8px;
      font-family: var(--font-display);
      font-size:14px;
      color:var(--color-surface);
      text-shadow: 0 1px 3px rgba(0,0,0,0.4);
      letter-spacing: 0.02em;
    }
    .bp-past-status-pill {
      position:absolute;
      top:6px; right:6px;
      font-size:9px;
      font-weight:500;
      padding:2px 8px;
      border-radius: var(--radius-pill);
      color:var(--color-surface);
      background: var(--color-text-muted);
      font-family: var(--font-body);
    }
    .bp-past-body { padding:6px 8px 8px; }
    .bp-past-name {
      font-size:10px;
      font-weight:500;
      color:var(--color-text-primary);
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
      margin-bottom:2px;
    }
    .bp-past-sub {
      font-size:9px;
      color:var(--color-text-muted);
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }

    /* RIGHT PANEL */
    .bp-body-right { padding:24px; background:var(--color-surface); }
    .bp-credits-card   { background:var(--theme-bg); border:0.5px solid var(--theme-border); border-radius: var(--radius-card); padding:18px; margin-bottom:16px; }
    .bp-credits-number { font-size:40px; font-weight:700; color:var(--color-text-primary); line-height:1; margin-bottom:4px; }
    .bp-credits-label  { font-size:var(--text-sm); font-weight:600; color:var(--theme-accent); margin-bottom:12px; }
    .bp-credits-dots   { display:flex; gap:5px; margin-bottom:10px; flex-wrap:wrap; }
    .bp-credit-dot     { width:10px; height:10px; border-radius:50%; }
    .bp-credit-dot.filled { background:var(--theme-accent); }
    .bp-credit-dot.empty  { background:var(--theme-empty); }
    .bp-credits-desc   { font-size:11px; color:var(--theme-text); line-height:1.5; }
    .bp-saved-hd { font-size:11px; font-weight:500; color:var(--theme-accent); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:14px; }
    /* v1.22e: 2-column grid mirroring the marketplace /suppliers
       layout. Each card lands at ~160px wide so the 140px cover
       reads square-ish (~1.15:1) instead of getting stretched.
       v1.22-elevation: Level 1 at rest, Level 2 on hover. */
    .bp-sup-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
    .bp-sup-card {
      border: var(--border-hairline);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-xs);
      overflow:hidden;
      background:var(--color-surface);
      cursor:pointer;
      transition: box-shadow 150ms ease, border-color 150ms ease, transform 150ms ease;
    }
    .bp-sup-card:hover {
      border: var(--border-hairline-strong);
      box-shadow: var(--shadow-sm);
      transform: translateY(-1px);
    }
    .bp-sup-img  { width:100%; height:140px; background-size:cover; background-position:center; position:relative; }
    .bp-sup-cat  { position:absolute; top:6px; left:6px; font-size:9px; font-weight:600; padding:2px 7px; border-radius: var(--radius-pill); background:rgba(0,0,0,0.5); color:#fff; }
    /* v1.22i: heart sits in a small white circle so the red lucide
       glyph reads on any cover image — the previous white-on-white
       entity was invisible. Suppliers in this panel are by definition
       favourited, so the heart is always "filled" (red). */
    .bp-sup-heart {
      position:absolute; top:6px; right:6px;
      width:20px; height:20px;
      border-radius:50%;
      background:var(--color-surface);
      color:var(--color-danger);
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 1px 3px rgba(0,0,0,0.15);
    }
    .bp-sup-heart lucide-icon { fill:currentColor; }
    .bp-sup-bg-setbuild { background-image:linear-gradient(160deg,#1a1a2e,#16213e); }
    .bp-sup-bg-av       { background-image:linear-gradient(160deg,#0d1b2a,#1b2838); }
    .bp-sup-bg-default  { background-image:linear-gradient(160deg,#1a1a2e,#2e1a2e); }
    .bp-sup-body { padding:8px 12px 10px; }
    .bp-sup-name { font-size:12px; font-weight:600; color:var(--color-text-primary); }
    .bp-sup-meta { font-size:11px; color:var(--color-text-muted); }
    .bp-empty { font-size:var(--text-sm); color:var(--color-text-muted); padding:16px 0; }

    /* ── v1.23 home settings strip ──────────────────────────────
       Most styling is inherited from the global .bp-cfg-* classes in
       styles.css (same source the marketplace's PageConfigTogglesComponent
       uses). Only the bits unique to this page live here:
         - theme swatch row (button-driven, not p-selectButton)
         - segmented COMPONENTS group with multi-toggle semantics */

    /* Theme swatches — round, ring on active. Same visual as the
       marketplace's .bp-cfg-swatches but plain buttons (no p-selectButton). */
    .bp-cfg-swatches-row { display: inline-flex; gap: 8px; }
    .bp-cfg-swatch-btn {
      width: 22px; height: 22px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      padding: 0;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .bp-cfg-swatch-btn:hover { transform: scale(1.1); }
    .bp-cfg-swatch-btn.active {
      box-shadow:
        0 0 0 2px var(--color-surface),
        0 0 0 3.5px var(--color-text-primary);
    }

    /* Segmented multi-toggle — same outline + accent fill as
       .bp-cfg-seg but each button is an independent toggle (not a
       single-pick group). Reuses the global .bp-cfg-seg outline. */
    .bp-cfg-seg.bp-cfg-seg--multi {
      display: inline-flex;
      border: 0.5px solid var(--color-border);
      border-radius: 6px;
      overflow: hidden;
    }
    .bp-cfg-seg-btn {
      padding: 4px 12px;
      height: 28px;
      font-size: 12px;
      font-weight: 500;
      background: var(--color-surface);
      color: var(--color-text-secondary);
      border: none;
      border-left: 0.5px solid var(--color-border);
      cursor: pointer;
      font-family: var(--font-body);
      transition: background 0.15s, color 0.15s;
    }
    .bp-cfg-seg-btn:first-child { border-left: none; }
    .bp-cfg-seg-btn:hover:not(:disabled):not(.p-highlight) {
      background: var(--theme-bg);
      color: var(--theme-accent);
    }
    .bp-cfg-seg-btn.p-highlight {
      background: var(--theme-accent);
      color: var(--color-surface);
      font-weight: 600;
    }
    .bp-cfg-seg-btn:disabled {
      cursor: not-allowed;
      opacity: 0.85;
    }
    /* Disabled + highlight (Organisation always-on) keeps the accent
       fill so it visually reads as ON; just no hover / click effect. */
    .bp-cfg-seg-btn:disabled.p-highlight {
      opacity: 1;
    }

    /* MOBILE TAB PANELS — hidden on desktop */
    .bp-mobile-panel { display:none; }
    .bp-desktop-only { display:grid; }

    /* MOBILE ROW CARDS */
    .bp-row-card  { display:flex; align-items:center; gap:14px; padding:12px 16px; border-bottom:0.5px solid var(--color-border); background:var(--color-surface); cursor:pointer; text-decoration:none; }
    .bp-row-card:active { background:var(--color-surface); }
    .bp-row-icon  { flex-shrink:0; color:var(--theme-accent); }
    .bp-row-icon.muted { color:var(--color-text-muted); }
    .bp-row-body  { flex:1; min-width:0; }
    .bp-row-name  { font-size:14px; font-weight:500; color:var(--color-text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .bp-row-meta  { font-size:12px; color:var(--color-text-muted); margin-top:1px; }
    .bp-row-chev  { color:var(--color-border); flex-shrink:0; }
    .bp-mobile-empty { padding:12px 16px; font-size:13px; color:var(--color-text-muted); }

    /* FAVOURITES SUB-TABS */
    .bp-fav-subtabs { display: flex; border-bottom: 0.5px solid var(--color-border); background: var(--color-surface); }
    .bp-fav-subtab  { flex: 1; padding: 10px; font-size: 13px; font-weight: 500; color: var(--color-text-muted); background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-family: var(--font-body); display: flex; align-items: center; justify-content: center; gap: 6px; transition: color 0.15s; }
    .bp-fav-subtab.active { color: var(--theme-accent); border-bottom-color: var(--theme-accent); font-weight: 600; }
    .bp-fav-count { font-size: 11px; background: var(--color-surface); border: 0.5px solid var(--color-border); border-radius: 20px; padding: 1px 7px; color: var(--color-text-muted); }
    .bp-fav-subtab.active .bp-fav-count { background: var(--theme-bg); border-color: var(--theme-border); color: var(--theme-accent); }

    /* ── RESPONSIVE ── */
    @media (max-width: 900px) {
      .bp-desktop-only  { display:none !important; }
      .bp-mobile-panel  { display:none; }
      .bp-mobile-panel.active { display:block; }
      .bp-dash-stats    { display:none; }
      .bp-dash-stats.bp-dash-stats-mobile-visible { display:grid; grid-template-columns:1fr 1fr !important; }
      .bp-dash-stat:nth-child(2) { border-right:none; }
      .bp-dash-stat:nth-child(3) { border-top:0.5px solid var(--color-border); }
      .bp-dash-stat:nth-child(4) { border-top:0.5px solid var(--color-border); border-right:none !important; }
      .bp-section-header { padding:12px 16px 6px !important; margin-bottom:0 !important; }
    }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  loading = true;
  org: Org | null = null;
  projects: Project[] = [];
  activeProjects: Project[] = [];
  completedProjects: Project[] = [];
  suppliers: any[] = [];
  supplierCount = 0;
  creditDots: boolean[] = [];
  projectLabel = 'Event';
  creditLabel  = 'Ball';
  daysUntilReset = 0;
  activeTab: DashTab = 'projects';
  uploadPanelProjectId = '';
  /** v1.22: id of the project whose "..." dropdown is open. Empty
      string = no menu open. Click-outside closes via HostListener. */
  openMenuProjectId = '';

  // ── v1.23 admin settings strip ────────────────────────────────────
  /** Draft copy of the configurable fields; bound to the inputs +
      checkboxes in the settings strip. Saved back to ConfigService on
      blur / change. Defaults populated from configService.current in
      ngOnInit, then kept in sync via the config$ subscription. */
  settingsDraft: {
    homePageLabel: string;
    creditLabel: string;
    projectLabel: string;
    themeName: string;
    navMode: 'tabs' | 'sidenav';
    showUserName: boolean;
    showLocation: boolean;
    showUpcoming: boolean;
    showStats: boolean;
  } = {
    homePageLabel: 'Projects',
    creditLabel: 'Ball',
    projectLabel: 'Event',
    themeName: 'amber',
    navMode: 'tabs',
    showUserName: true,
    showLocation: true,
    showUpcoming: false,
    showStats: true
  };

  /** Theme dot swatches — values match ConfigService.THEME_PRESETS keys. */
  readonly themeOptions = [
    { value: 'amber',   label: 'Amber',   color: '#D97706' },
    { value: 'emerald', label: 'Emerald', color: '#00B84A' },
    { value: 'pink',    label: 'Pink',    color: '#FF0066' },
    { value: 'ocean',   label: 'Ocean',   color: '#2563EB' },
    { value: 'slate',   label: 'Slate',   color: '#64748B' }
  ];

  /** v1.23b: COMPONENTS row — segmented buttons, each pill an
      independent toggle. 'org' is disabled (always on) so the
      Organisation pill renders permanently active. Order matters —
      the disabled pill leads so it's the first thing the user reads. */
  readonly componentOptions: Array<{ value: string; label: string; disabled?: boolean }> = [
    { value: 'org',      label: 'Organisation', disabled: true },
    { value: 'user',     label: 'User' },
    { value: 'location', label: 'Location' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'stats',    label: 'Stats' }
  ];

  /** v1.23e: NAV row — single-pick segmented group. Values map to
      ConfigService.navMode; 'sidenav' is labelled 'Menu' in the
      strip (shorter than 'Side navigation') to match the dashboard's
      compact label voice. */
  readonly navOptions: Array<{ value: 'tabs' | 'sidenav'; label: string }> = [
    { value: 'tabs',    label: 'Tabs' },
    { value: 'sidenav', label: 'Menu' }
  ];
  uploadSupplierPanelId = '';
  favTab: 'suppliers' | 'items' = 'suppliers';
  favSuppliers: Favourite[] = [];
  favItems: Favourite[] = [];
  favsLoading = false;
  private sub?: Subscription;

  get nextProject(): Project | null { return this.activeProjects.length > 0 ? this.activeProjects[0] : null; }

  constructor(
    private projectService: ProjectService,
    private orgService: OrgService,
    private supplierService: SupplierService,
    private configService: ConfigService,
    private shellCtx: ShellContextService,
    private favSvc: FavouriteService,
    private confirm: ConfirmationService,
    private msg: MessageService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  fmtCurrency(v: any): string { return ConfigService.formatCurrency(v); }

  openUploadPanel(event: MouseEvent, p: Project) {
    event.stopPropagation(); event.preventDefault();
    this.uploadPanelProjectId = this.uploadPanelProjectId === p.id ? '' : p.id;
  }

  // ── v1.22 project-card menu ────────────────────────────────────────

  /** Normalise the project's status_name into the three-bucket scheme
      the card pill renders (Draft / Active / Closed). Falls back to
      Draft when status_name is missing — matches the spec. */
  projectStatus(p: Project): { key: 'draft' | 'active' | 'closed'; label: string } {
    const s = (p.status_name || '').toLowerCase();
    if (s === 'active' || s === 'costing') return { key: 'active', label: 'Active' };
    if (['closed', 'completed', 'cancelled'].includes(s)) return { key: 'closed', label: 'Closed' };
    return { key: 'draft', label: 'Draft' };
  }

  toggleMenu(event: MouseEvent, p: Project) {
    event.stopPropagation();
    event.preventDefault();
    this.openMenuProjectId = this.openMenuProjectId === p.id ? '' : p.id;
    this.cdr.detectChanges();
  }

  /** Click anywhere outside the open menu closes it. Card clicks
      (route navigation) are bubble events that hit document too, so
      this catches both the "click another card" and "click empty
      space" cases. The menu-button's stopPropagation prevents this
      from firing when the user is just toggling. */
  @HostListener('document:click')
  onDocumentClick() {
    if (this.openMenuProjectId) {
      this.openMenuProjectId = '';
      this.cdr.detectChanges();
    }
  }

  onMenuAction(action: 'edit-image' | 'copy' | 'delete', p: Project, event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    this.openMenuProjectId = '';
    if (action === 'edit-image') {
      this.uploadPanelProjectId = p.id;
    } else if (action === 'copy') {
      this.duplicateProject(p);
    } else if (action === 'delete') {
      this.confirmDelete(p);
    }
    this.cdr.detectChanges();
  }

  duplicateProject(p: Project) {
    this.projectService.duplicate(p.id).subscribe({
      next: (created: Project) => {
        this.msg.add({
          severity: 'success',
          summary: 'Project copied',
          detail: created.name,
          life: 2500
        });
        // Land the user on the new project's Brief tab so they can
        // immediately scope categories — that's the natural next step
        // after a copy.
        this.router.navigate(['/projects', created.id, 'brief']);
      },
      error: () => {
        this.msg.add({
          severity: 'error',
          summary: 'Copy failed',
          detail: 'Could not duplicate the project.',
          life: 3500
        });
      }
    });
  }

  confirmDelete(p: Project) {
    this.confirm.confirm({
      header: `Delete ${p.event_name || p.name}?`,
      message: 'This will permanently remove the project and all its categories, items, and estimates.',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => {
        this.projectService.delete(p.id).subscribe({
          next: () => {
            // Drop the row from both lists optimistically so the UI
            // settles immediately; the real refresh fires from the
            // projectService.refresh$ subscription too.
            this.activeProjects    = this.activeProjects.filter(x => x.id !== p.id);
            this.completedProjects = this.completedProjects.filter(x => x.id !== p.id);
            this.msg.add({
              severity: 'success',
              summary: 'Project deleted',
              life: 2500
            });
            this.cdr.detectChanges();
          },
          error: () => {
            this.msg.add({
              severity: 'error',
              summary: 'Delete failed',
              life: 3500
            });
          }
        });
      }
    });
  }

  createProject() {
    this.router.navigate(['/projects/new']);
  }

  /** Extract the year from an event_date for the past-events carousel
      year overlay. Returns null when the date can't be parsed — caller
      shows "—" in that case. */
  extractYear(dateStr?: string): string | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return String(d.getFullYear());
  }

  onImagesUpdated(project: Project, urls: { coverUrl: string; logoUrl: string; cardColor?: string }) {
    project.cover_image_url = urls.coverUrl;
    project.client_logo_url = urls.logoUrl;
    if (urls.cardColor) project.card_color = urls.cardColor;
    this.uploadPanelProjectId = '';
    this.cdr.detectChanges();
  }

  getCategoryClass(cat: string): string {
    const map: Record<string, string> = { 'set build': 'setbuild', 'av': 'av', 'audio visual': 'av' };
    return map[(cat || '').toLowerCase()] || 'default';
  }

  private setTab(tab: DashTab) {
    this.activeTab = tab;
    // Update activeTabPath so AppShell highlights correct tab
    const tabMap: Record<DashTab, string> = {
      projects: 'tab:projects',
    };
    this.shellCtx.set({
      ...this.shellCtx.current,
      activeTabPath: tabMap[tab]
    });
    this.cdr.detectChanges();
  }

  ngOnInit() {
    this.sub = this.configService.config$.subscribe(cfg => {
      this.projectLabel = cfg.projectLabel || 'Event';
      this.creditLabel  = cfg.creditLabel  || 'Ball';
      // v1.23: keep the local draft bound to the inputs in sync with
      // the canonical config — other tabs (or settings pages) can
      // mutate ConfigService and the dashboard's strip should reflect
      // it without a reload.
      this.settingsDraft = {
        homePageLabel: cfg.homePageLabel || 'Projects',
        creditLabel:   cfg.creditLabel   || 'Ball',
        projectLabel:  cfg.projectLabel  || 'Event',
        themeName:     cfg.themeName     || 'amber',
        navMode:       (cfg.navMode === 'sidenav' ? 'sidenav' : 'tabs'),
        showUserName:  cfg.showUserName  !== false,
        showLocation:  cfg.showLocation  !== false,
        showUpcoming:  cfg.showUpcoming  === true,
        showStats:     cfg.showStats     !== false
      };
      this.pushShellContext();
      this.cdr.detectChanges();
    });

    this.orgService.getCurrentOrg().subscribe(org => {
      if (org) {
        this.org = org;
        const allowance = org.balls_monthly_allowance || 10;
        const used = allowance - (org.balls_balance || 0);
        this.creditDots = Array.from({ length: allowance }, (_, i) => i < used);
        const resetDate = new Date(); resetDate.setDate(1); resetDate.setMonth(resetDate.getMonth() + 1);
        this.daysUntilReset = Math.ceil((resetDate.getTime() - Date.now()) / 86400000);
        this.pushShellContext();
        this.cdr.detectChanges();
      }
    });

    this.projectService.refresh$.subscribe(() => this.loadProjects());
    this.loadProjects();
    this.loadSuppliers();
    this.loadFavourites();
  }

  // ── v1.23 settings persistence ────────────────────────────────────

  /** Push hero context to the shell. Called whenever org / config /
      project data changes so the eyebrow + upcoming pill stay in sync
      with the settings draft. */
  private pushShellContext() {
    if (!this.org) return;
    const ctx: any = {
      heroTitle: this.org.name,
      heroSub: (this.settingsDraft.homePageLabel || 'Projects').toUpperCase(),
      pills: [],
      tabs: [],
    };
    // Upcoming pill — when enabled AND we've got a future project.
    if (this.settingsDraft.showUpcoming && this.nextProject) {
      const dateLine = new EventDatePipe().transform(this.nextProject.event_date);
      // EventDatePipe returns "02-Jun-2026 · in 20 days" — split on the
      // first " · " so the pill reads "{event name} · in 20 days".
      const tail = dateLine.includes(' · ')
        ? dateLine.substring(dateLine.indexOf(' · ') + 3)
        : dateLine;
      const name = this.nextProject.event_name || this.nextProject.name;
      ctx.upcomingPill = { text: `${name} · ${tail}` };
    }
    this.shellCtx.set(ctx);
  }

  /** Persist label changes (page / credits / events) on blur. Each
      input is two-way bound to settingsDraft; pushing to ConfigService
      re-emits config$ which re-runs pushShellContext above. */
  saveLabels() {
    this.configService.update({
      homePageLabel: this.settingsDraft.homePageLabel || 'Projects',
      creditLabel:   this.settingsDraft.creditLabel   || 'Ball',
      projectLabel:  this.settingsDraft.projectLabel  || 'Event'
    });
  }

  /** Theme dot click. Updates config + the local draft; the
      ConfigService applies the CSS variables immediately. */
  onThemeChange(theme: string) {
    this.settingsDraft.themeName = theme;
    this.configService.update({ themeName: theme });
  }

  /** v1.23e: persist NAV choice. Writes ConfigService.navMode; the
      AppShell subscribes to config$ and re-renders the hero/body
      with either the tab strip or the sidenav. */
  selectNavMode(mode: 'tabs' | 'sidenav') {
    this.settingsDraft.navMode = mode;
    this.configService.update({ navMode: mode });
  }

  /** Component visibility toggles. Single handler — re-reads every
      flag from the draft and pushes the whole bag to ConfigService. */
  saveToggles() {
    this.configService.update({
      showUserName: this.settingsDraft.showUserName,
      showLocation: this.settingsDraft.showLocation,
      showUpcoming: this.settingsDraft.showUpcoming,
      showStats:    this.settingsDraft.showStats
    });
  }

  /** v1.23b: segmented-button mapping. componentOptions uses opaque
      string keys; we translate to the ConfigService flags here.
      'org' is always active (always-on Organisation pill). */
  isComponentActive(key: string): boolean {
    switch (key) {
      case 'org':      return true;
      case 'user':     return this.settingsDraft.showUserName;
      case 'location': return this.settingsDraft.showLocation;
      case 'upcoming': return this.settingsDraft.showUpcoming;
      case 'stats':    return this.settingsDraft.showStats;
      default:         return false;
    }
  }

  toggleComponent(key: string) {
    // 'org' is permanent — disabled in the template so this is just
    // defensive. Same for unknown keys.
    if (key === 'org') return;
    switch (key) {
      case 'user':     this.settingsDraft.showUserName = !this.settingsDraft.showUserName; break;
      case 'location': this.settingsDraft.showLocation = !this.settingsDraft.showLocation; break;
      case 'upcoming': this.settingsDraft.showUpcoming = !this.settingsDraft.showUpcoming; break;
      case 'stats':    this.settingsDraft.showStats    = !this.settingsDraft.showStats;    break;
      default: return;
    }
    this.saveToggles();
  }

  loadProjects() {
    this.projectService.getAll().subscribe({
      next: projects => {
        this.projects = projects || [];
        this.activeProjects    = this.projects.filter(p => ['active','costing','draft'].includes(p.status_name || ''));
        this.completedProjects = this.projects.filter(p => ['completed','closed','cancelled'].includes(p.status_name || ''));
        this.loading = false;
        // v1.23: refresh hero context so the upcoming-event pill (when
        // enabled) reflects the freshly-loaded nextProject.
        this.pushShellContext();
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  loadSuppliers() {
    // v1.22h: this.suppliers (every platform supplier) is still loaded
    // because mobile panels reference it. supplierCount is NO LONGER
    // sourced from here — see loadFavourites() below. The previous
    // assignment was the bug: "Saved Suppliers" KPI showed every
    // supplier, not the user's favourites.
    this.supplierService.getAll().subscribe({
      next: (suppliers: any[]) => {
        this.suppliers = suppliers || [];
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  loadFavourites() {
    this.favsLoading = true;
    this.favSvc.getAll().subscribe({
      next: (favs: any[]) => {
        this.favSuppliers = (favs || []).filter((f: any) => f.type === 'supplier');
        this.favItems = (favs || []).filter((f: any) => f.type === 'item');
        // v1.22h: count of saved suppliers drives the KPI stat in the
        // dashboard header. Was wrongly counting every supplier on the
        // platform before this fix.
        this.supplierCount = this.favSuppliers.length;
        this.favsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.favsLoading = false; this.cdr.detectChanges(); }
    });
  }

  ngOnDestroy() {
    this.shellCtx.reset();
    this.sub?.unsubscribe();
  }
}
