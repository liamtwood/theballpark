// v1.65hG (p0016 Step 2): ViewChild + TemplateRef dropped from imports
// — the strip template's ViewChild now lives in
// <app-page-config-drawer>'s class, not here.
import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { LucideAngularModule, Plus, Folder, Building2, ChevronRight, Calendar, MapPin, Heart, MessageCircle } from 'lucide-angular';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { ProjectService } from '../../core/services/project.service';
import { OrgService } from '../../core/services/org.service';
import { SupplierService } from '../../core/services/supplier.service';
import { ConfigService } from '../../core/services/config.service';
import { ShellContextService } from '../../core/services/shell-context.service';
// v1.65hG (p0016 Step 2): ConfigStripService import removed — strip
// lifecycle owned by <app-page-config-drawer>.
import { Project, Org } from '../../models';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { EventDatePipe } from '../../shared/pipes/event-date.pipe';
import { CompactCurrencyPipe } from '../../shared/pipes/compact-currency.pipe';
import { FavouriteService, Favourite } from '../../core/services/favourite.service';
import { CreateProjectService } from '../../core/services/create-project.service';
import { CodelistService } from '../../core/services/codelist.service';
import { PersonaService } from '../../core/services/persona.service';
import { ActionTileComponent } from '../../shared/components/action-tile/action-tile.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    LucideAngularModule,
    ButtonModule, CheckboxModule, InputTextModule,
    LoadingSpinnerComponent, StatusBadgeComponent,
    ActionTileComponent,
    EventDatePipe, CompactCurrencyPipe
  ],
  template: `
    <!-- v1.66l (p0015 close-out) — the dashboard no longer embeds the
         inbox. Inbox is its own canonical /inbox route; the hero Inbox
         tab + the launcher Inbox tile both navigate there. -->
    <div class="bp-page">
    <!-- v1.66at — page-settings drawer now mounted globally in app-shell,
         so the cog appears on every page (not just the dashboard). -->

    <app-loading *ngIf="loading"></app-loading>
    <ng-container *ngIf="!loading">

      <!-- v1.65dh — Stats bar is now 4 floating cards (shadow-only,
           no hairline). The label/value/sub triplets are unchanged. -->
      <div class="bp-dash-stats" *ngIf="pageCfg.showStats !== false">
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
        <div class="bp-dash-stat">
          <span class="bp-dash-stat-label">Quotes in progress</span>
          <span class="bp-dash-stat-value">0</span>
          <span class="bp-dash-stat-sub">awaiting response</span>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════
           DESKTOP — three column layout
           MOBILE — hidden, replaced by tab panels below
      ══════════════════════════════════════════════════ -->
      <!-- v1.66b — fixed 3-track grid (320 / 1fr / 320); each column is
           pinned to its track via grid-column, so hiding a side column's
           sections leaves its track reserved (empty) and the centre
           launcher stays dead-centre rather than sliding over. -->
      <div class="bp-body bp-desktop-only">

        <!-- LEFT PANEL — v1.65dh: each section is now its own
             elevated card (shadow-only, no border) instead of all
             three sharing one panel. Section eyebrows gain a Lucide
             icon next to the label.
             p0018: column collapses when Upcoming + Recent Activity +
             Quick Actions are all hidden. -->
        <div class="bp-body-panel" *ngIf="hasLeftColumn">
          <div class="bp-panel-section bp-dash-card" *ngIf="pageCfg.showUpcoming">
            <div class="bp-section-header">
              <lucide-icon name="calendar-days" [size]="13" class="bp-section-icon"></lucide-icon>
              <span class="bp-section-title">Upcoming</span>
            </div>
            <ng-container *ngIf="nextProject">
              <p class="bp-upcoming-name">{{ nextProject.event_name || nextProject.name }}</p>
              <p class="bp-upcoming-meta">{{ nextProject.client_name }}</p>
              <p class="bp-upcoming-meta" *ngIf="nextProject.venue_name">{{ nextProject.venue_name }}</p>
              <p class="bp-upcoming-date" *ngIf="nextProject.event_date">{{ nextProject.event_date | eventDate }}</p>
            </ng-container>
            <p *ngIf="!nextProject" class="bp-empty">No upcoming events.</p>
          </div>
          <div class="bp-panel-section bp-dash-card" *ngIf="pageCfg.showRecentActivity">
            <div class="bp-section-header">
              <lucide-icon name="clock" [size]="13" class="bp-section-icon"></lucide-icon>
              <span class="bp-section-title">Recent Activity</span>
            </div>
            <div class="bp-activity-item"><div class="bp-activity-dot"></div><span>Brief updated — TechVista London</span><span class="bp-activity-time">2h ago</span></div>
            <div class="bp-activity-item"><div class="bp-activity-dot"></div><span>Project created — Food &amp; Drink Expo</span><span class="bp-activity-time">1d ago</span></div>
            <div class="bp-activity-item"><div class="bp-activity-dot"></div><span>Supplier saved — Construct &amp; Co.</span><span class="bp-activity-time">2d ago</span></div>
          </div>
          <div class="bp-panel-section bp-dash-card" *ngIf="pageCfg.showQuickActions">
            <div class="bp-section-header">
              <lucide-icon name="zap" [size]="13" class="bp-section-icon"></lucide-icon>
              <span class="bp-section-title">Quick Actions</span>
            </div>
            <!-- v1.22b: "+ New Project" removed from Quick Actions —
                 it already lives next to the Active Events header.
                 v1.22i: Browse Suppliers now lands on the Suppliers
                 toggle (was defaulting to Items).
                 v1.22j: icons dropped from the links so every Quick
                 Action reads as one clean outlined CTA.
                 v1.35: Marketplace nav link removed — Browse
                 Marketplace lives here now. Settings link removed —
                 lives behind the cog icon in the header. -->
            <!-- v1.65hQ (p0019 §2): Browse Marketplace dropped — it's now
                 the Marketplace launcher tile in the centre column. -->
            <a [routerLink]="['/shop']"
               [queryParams]="{ view: 'suppliers' }"
               class="bp-quick-action">Browse Suppliers</a>
            <a routerLink="/settings/team" class="bp-quick-action">Invite Member</a>
          </div>
        </div>

        <!-- CENTRE — v1.65hQ (p0019 §2): the Active / Inactive / Past
             events grid moved to its own /projects page (built in
             p0020). The centre column is now a launcher — a 5-tile grid
             routing to the app's main surfaces. Always visible (no
             per-section flag); tiles are their own elevated surfaces,
             not wrapped in a bp-dash-card. -->
        <div class="bp-body-left">
          <div class="bp-launcher-grid">
            <!-- Supplier persona (e.g. Ryan @ Rocket Food) — their home is
                 their own shop: Shopfront / Store / Inbox / Profile. -->
            <ng-container *ngIf="isSupplier; else agencyLauncher">
              <app-action-tile
                icon="store"
                title="Shopfront"
                subtitle="Your public storefront"
                (action)="goToSupplierTab('front')">
              </app-action-tile>

              <app-action-tile
                icon="package"
                title="Store"
                subtitle="Manage your catalogue"
                (action)="goToSupplierTab('store')">
              </app-action-tile>

              <app-action-tile
                icon="inbox"
                title="Inbox"
                subtitle="Enquiries and threads"
                (action)="goToSupplierTab('inbox')">
              </app-action-tile>

              <app-action-tile
                icon="circle-user"
                title="Profile"
                subtitle="Your account and settings"
                (action)="goToProfile()">
              </app-action-tile>
            </ng-container>

            <!-- Agency / admin launcher -->
            <ng-template #agencyLauncher>
            <app-action-tile
              icon="folder-plus"
              title="Add {{ projectLabel }}"
              [subtitle]="'Start a new ' + projectLabel.toLowerCase()"
              (action)="openNewProject()">
            </app-action-tile>

            <app-action-tile
              icon="folder-open"
              title="View {{ projectLabel }}s"
              [subtitle]="'Browse all your ' + projectLabel.toLowerCase() + 's'"
              (action)="goToProjects()">
            </app-action-tile>

            <app-action-tile
              icon="inbox"
              title="Inbox"
              subtitle="Supplier replies and threads"
              (action)="goToInbox()">
            </app-action-tile>

            <app-action-tile
              icon="store"
              title="Marketplace"
              subtitle="Browse items and suppliers"
              (action)="goToMarketplace()">
            </app-action-tile>

            <app-action-tile
              icon="circle-user"
              title="Profile"
              subtitle="Your account and settings"
              (action)="goToProfile()">
            </app-action-tile>
            </ng-template>
          </div>
        </div>

        <!-- RIGHT — v1.65dh: each section is its own elevated card
             (shadow-only, no border) so it floats on the parchment.
             p0018: column collapses when Credits + Saved Suppliers are
             both hidden. -->
        <div class="bp-body-right" *ngIf="hasRightColumn">
          <div class="bp-credits-card bp-dash-card" *ngIf="pageCfg.showCredits">
            <div class="bp-credits-number">{{ org?.balls_balance ?? 0 }}</div>
            <div class="bp-credits-label">{{ creditLabel }}s remaining this month</div>
            <div class="bp-credits-dots">
              <div *ngFor="let dot of creditDots" class="bp-credit-dot" [class.filled]="dot" [class.empty]="!dot"></div>
            </div>
            <p class="bp-credits-desc">Build and estimate for free — only spend a {{ creditLabel }} when ready to engage.</p>
          </div>
          <div class="bp-dash-card" *ngIf="pageCfg.showSavedSuppliers">
          <!-- v1.65dl — use the shared .bp-section-title eyebrow so the
               header matches every other section's typography + spacing
               (was .bp-saved-hd which carried a stray margin-bottom). -->
          <div class="bp-section-header">
            <lucide-icon name="heart" [size]="13" class="bp-section-icon"></lucide-icon>
            <span class="bp-section-title">Saved suppliers</span>
          </div>
          <ng-container *ngIf="favSuppliers.length > 0; else noFavSuppliers">
            <!-- 2-column grid so each card sits at ~160px wide and the
                 140px cover lands ~1.15:1 (matches marketplace).
                 v1.32: each card is now an <a> linking to the
                 supplier's shop front (/suppliers/:id). -->
            <div class="bp-sup-grid">
              <a *ngFor="let s of favSuppliers.slice(0,2)"
                 [routerLink]="['/suppliers', s.ref_id]"
                 class="bp-sup-card bp-card-hover">
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
              </a>
            </div>
            <!-- v1.32: "My Suppliers" lands on the marketplace
                 (a.k.a. supplier-list at /suppliers) pre-filtered
                 to the user's hearted suppliers. -->
            <a [routerLink]="['/shop']"
               [queryParams]="{ view: 'suppliers', favourites: 'true' }"
               class="bp-quick-action">
              My Suppliers
            </a>
          </ng-container>
          <ng-template #noFavSuppliers>
            <div class="bp-empty">No saved suppliers yet</div>
            <a [routerLink]="['/shop']"
               [queryParams]="{ view: 'suppliers', favourites: 'true' }"
               class="bp-quick-action">
              My suppliers
            </a>
          </ng-template>
          </div><!-- /Saved suppliers card -->
        </div>

      </div>

      <!-- ══════════════════════════════════════════════════
           MOBILE TAB PANELS — hidden on desktop
      ══════════════════════════════════════════════════ -->

      <!-- PROJECTS TAB — v1.66l: the dashboard has a single view now
           (inbox moved to /inbox), so this mobile panel is always on. -->
      <div class="bp-mobile-panel active">
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
  `,
  styles: [`
    /* v1.65dh — Dashboard styling: panels float as elevated cards on a
       parchment ground. Card chrome is shadow-only — no hairline border
       on any card on this page — so they read as floating, not outlined.
       (The mockup spec is explicit on this; see commit message.) */

    /* Shared card primitive used by every floating panel on this page. */
    .bp-dash-card {
      background: var(--color-surface);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-xs);
      padding: 16px 18px;
    }

    /* v1.65di — STATS row sits on the parchment ground (same as the
       body below). 24px gap from the hero divider above; wider 16px
       gap between the 4 tiles so they read as distinct cards. */
    .bp-dash-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      padding: 24px 20px 0;
      background: var(--theme-bg);
    }
    .bp-dash-stat {
      display: flex; flex-direction: column;
      padding: 16px 18px;
      background: var(--color-surface);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-xs);
    }
    .bp-dash-stat-label { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:var(--theme-accent); margin-bottom:4px; }
    .bp-dash-stat-value { font-size:26px; font-weight:700; color:var(--color-text-primary); line-height:1.1; }
    .bp-dash-stat-sub   { font-size:11px; color:var(--color-text-muted); margin-top:2px; }

    /* DESKTOP 3-COL — parchment ground, 16px gap between columns
       and a matching 16px top padding above the row so the stats
       and the 3-col body share the same rhythm. */
    /* v1.66b — fixed 3-track grid; columns are pinned to their tracks
       (grid-column below) so hiding a side column reserves its track
       and the centre launcher stays put. */
    .bp-body {
      display: grid;
      grid-template-columns: 320px minmax(400px, 1fr) 320px;
      gap: 16px;
      background: var(--theme-bg);
      padding: 16px 20px 24px;
      min-height: calc(100vh - var(--nav-height) - 64px);
    }
    /* v1.66b — pin each column to its grid track so a hidden side
       column leaves its 320px track reserved (empty) and the centre
       launcher stays centred instead of sliding into the freed space. */
    .bp-body-panel { grid-column: 1; display: flex; flex-direction: column; gap: 14px; }
    .bp-body-left  { grid-column: 2; display: flex; flex-direction: column; gap: 14px; }
    .bp-body-right { grid-column: 3; display: flex; flex-direction: column; gap: 14px; }
    /* v1.65hQ (p0019 §2) — centre-column launcher. auto-fit wraps 2 per
       row at typical centre widths, 3 at wider viewports. Tiles bring
       their own elevated chrome (<app-action-tile>) — no panel wrapper. */
    /* v1.66d — match the agent page's tile sizing (.bp-agent-cards):
       auto-fit + minmax(280px, 350px), capped (not 1fr) so tiles keep
       their roomy rectangular footprint instead of stretching; centred
       and wraps onto new rows as the centre column narrows. */
    .bp-launcher-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 350px));
      justify-content: center;
      gap: 16px;
    }
    /* Make each .bp-panel-section in the left column inherit the
       shared card chrome. (.bp-dash-card on the element does it; this
       is just the layout/gap reset.) */
    .bp-panel-section { margin-bottom: 0; }
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
    /* v1.65dh — calmer outline. Was --theme-accent border + text,
       now a neutral hairline with secondary-text colour so the
       buttons read as quiet utility, with the accent reserved for
       the "+ New Event" primary CTA. */
    .bp-quick-action  {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; padding: 9px 12px; margin-bottom: 8px;
      border: 0.5px solid var(--color-border);
      border-radius: var(--radius-button);
      background: var(--color-surface);
      font-size: 13px; font-weight: 500; color: var(--color-text-secondary);
      cursor: pointer; text-decoration: none;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
      font-family: var(--font-body);
    }
    .bp-quick-action:hover {
      border-color: var(--theme-accent);
      color: var(--theme-accent);
      background: var(--theme-soft);
    }
    /* v1.65dh — legacy .bp-body-left padding + border rules retired.
       Each card now owns its own padding via .bp-dash-card. Kept here
       defined-but-empty as a no-op for any stale references. */
    .bp-body-left-legacy { /* no-op */ }
    .bp-section-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
    /* v1.22: section eyebrow standardised — weight 500 (was 700) and
       letter-spacing 0.06em (was 0.1em) so the labels feel less
       heavy. Applied to .bp-section-title + .bp-saved-hd below. */
    .bp-section-title { font-size:11px; font-weight:500; color:var(--theme-accent); text-transform:uppercase; letter-spacing:0.06em; }
    .bp-section-action { font-size:var(--text-sm); color:var(--theme-accent); font-weight:500; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; gap:4px; transition:color 0.15s; }
    .bp-section-action:hover { color:var(--color-text-primary); }
    .bp-section-spacer { margin-top:24px; }

    /* v1.66e (p0024): the project-card grid, "+ New" pill, collapsible
       headers and past-events carousel CSS that lived here (retained
       dead since p0019) moved to projects-list.component.ts with the
       /projects page. Shared section-header / icon / title primitives
       below stay — the left column still uses them. */

    /* Section header icon — small, theme-accent, fixed size. */
    .bp-section-icon { color: var(--theme-accent); flex-shrink: 0; }
    /* v1.65dj — section header: left-justified flow (icon → title →
       trailing actions) with a hairline divider underneath that spans
       the card's full width. Negative side margins pull the divider
       edge-to-edge inside the card's --18px padding.
       v1.65dk — !important justify-content:flex-start to override the
       legacy global rule (was space-between, which pushed the title
       away from the icon on sections without a trailing element).
       Trailing buttons / count badges get margin-left:auto to flow
       to the right. */
    .bp-section-header {
      display: flex; align-items: center; gap: 8px;
      justify-content: flex-start !important;
      padding-bottom: 10px;
      margin: 0 -18px 14px;
      padding-left: 18px;
      padding-right: 18px;
      border-bottom: var(--border-hairline);
    }
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


    /* RIGHT PANEL */
    /* v1.65dh — right-column padding now lives on each .bp-dash-card;
       the column itself is just a flex column with gap. Legacy
       padding+surface rule retired. */
    .bp-body-right-legacy { /* no-op */ }
    /* Credits card — shadow-only chrome (was a tinted border tile). */
    .bp-credits-card   { background: var(--color-surface); border-radius: var(--radius-card); box-shadow: var(--shadow-xs); padding: 18px; text-align: center; }
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
      transition: var(--card-hover-transition);   /* card hover standard */
    }
    /* Hover (lift + accent shadow/border) via the global .bp-card-hover class
       on the element — see template. No per-card hover declared here. */
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
export class DashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  // v1.65hG (p0016 Step 2): cfgStripTpl ViewChild removed — the strip
  // is now an <app-page-config-drawer> child component that owns its
  // own ViewChild + setTemplate lifecycle.
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
  // v1.65hQ (p0019 §2): the Active/Inactive/Past project-card grid +
  // its "..." menu / image-upload / collapse state moved out of the
  // dashboard with the centre column. activeProjects / completedProjects
  // are still loaded below — the stats bar + Upcoming + mobile list read
  // them. The card machinery returns with the /projects page (p0020).

  // ── v1.65hG (p0016 Step 2) — page-settings strip extracted ─────────
  // The full strip (template + draft + handlers + options + lifecycle)
  // moved to <app-page-config-drawer>. The dashboard keeps a slim,
  // read-only mirror of just the fields its own templates / methods
  // read (stats bar visibility, hero context labels). The strip owns
  // writes; this mirror is one-way from ConfigService.config$.
  pageCfg: {
    homePageLabel: string;
    showUpcoming: boolean;
    showStats: boolean;
    // p0018 — body section visibility, mirrored read-only from
    // ConfigService.config$ (the drawer owns the writes).
    showQuickActions: boolean;
    showCredits: boolean;
    showSavedSuppliers: boolean;
    showRecentActivity: boolean;
  } = {
    homePageLabel: 'Projects',
    showUpcoming: true,
    showStats: true,
    showQuickActions: true,
    showCredits: true,
    showSavedSuppliers: true,
    showRecentActivity: true,
  };

  /** p0018 — column presence for the 3-col body. When all of a side
      column's sections are hidden, the column div is omitted (no empty
      card chrome). v1.66b: its grid track is still reserved (each column
      is pinned via grid-column in CSS) so the centre launcher stays
      centred. */
  get hasLeftColumn(): boolean {
    return this.pageCfg.showUpcoming || this.pageCfg.showRecentActivity || this.pageCfg.showQuickActions;
  }
  get hasRightColumn(): boolean {
    return this.pageCfg.showCredits || this.pageCfg.showSavedSuppliers;
  }
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
    private createProjectSvc: CreateProjectService,
    private codelistSvc: CodelistService,
    private personaSvc: PersonaService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  /** v1.65hG (p0016 Step 2): ngAfterViewInit no longer registers the
      strip template — that's owned by <app-page-config-drawer>. Kept as
      an empty hook for future view-init needs. */
  ngAfterViewInit() { /* intentionally empty */ }

  fmtCurrency(v: any): string { return ConfigService.formatCurrency(v); }

  /** v1.31: codelist-driven status bucketing.
      Resolves the project's `status_name` (joined from the statuses
      table) against the shared.codelists `project_status` list and
      returns the canonical code + label + colour from meta JSONB.
      Null / missing → "draft" (active bucket). One source of truth
      for the dashboard filter, the project-card pill, and any future
      surface that renders project status. */
  projectStatus(p: Project): { key: string; label: string; color: string } {
    const code = (p.status_name || 'draft').toLowerCase();
    const label = this.codelistSvc.getLabel('project_status', code) || 'Draft';
    const meta  = this.codelistSvc.getMeta('project_status', code);
    return { key: code, label, color: meta?.['color'] || '#F59E0B' };
  }

  // ── v1.65hQ (p0019 §2) — launcher-tile action wiring ───────────────
  // The project-card "..." menu (estimate / edit-image / copy / delete)
  // + the past-events year helper + image-update handler moved out with
  // the centre column; they return with the /projects page (p0020).

  /** Opens the shared create-project intake modal mounted in app-shell
      (same entry point as the top-nav + button). */
  openNewProject() {
    this.createProjectSvc.open();
  }

  // /projects has no list route yet (removed in v1.33); the dedicated
  // page is built in p0020, so until then the wildcard sends it home.
  // The tile is wired to the real path now so it lights up when p0020
  // lands.
  goToProjects()    { this.router.navigate(['/projects']); }
  goToInbox()       { this.router.navigate(['/inbox']); }
  goToMarketplace() { this.router.navigate(['/shop']); }
  // No dedicated /profile route — Settings is the account surface today.
  goToProfile()     { this.router.navigate(['/settings']); }

  /** True when the active persona is a supplier (e.g. Ryan @ Rocket Food) —
      their home launcher shows shop folders instead of agency ones. */
  get isSupplier(): boolean { return this.personaSvc.isSupplier(); }

  /** Open the supplier's own page on a given tab (Shopfront / Store / Inbox). */
  goToSupplierTab(tab: 'front' | 'store' | 'inbox') {
    const id = this.personaSvc.active?.supplierOrgId;
    if (id) this.router.navigate(['/suppliers', id], { queryParams: { tab } });
  }

  getCategoryClass(cat: string): string {
    const map: Record<string, string> = { 'set build': 'setbuild', 'av': 'av', 'audio visual': 'av' };
    return map[(cat || '').toLowerCase()] || 'default';
  }


  ngOnInit() {
    // v1.31: warm the project_status codelist cache so the project
    // card pills + projectStatus() helper resolve label + colour
    // immediately on first render.
    this.codelistSvc.getByName('project_status').subscribe(() => this.cdr.detectChanges());

    this.sub = this.configService.config$.subscribe(cfg => {
      this.projectLabel = cfg.projectLabel || 'Event';
      this.creditLabel  = cfg.creditLabel  || 'Ball';
      // v1.65hG (p0016 Step 2): only the fields the dashboard's own
      // template / pushShellContext read are mirrored locally. The
      // full draft + writeback lives in <app-page-config-drawer>.
      this.pageCfg = {
        homePageLabel: cfg.homePageLabel || 'Projects',
        // p0018 — all section flags default visible (!== false).
        showUpcoming:       cfg.showUpcoming       !== false,
        showStats:          cfg.showStats          !== false,
        showQuickActions:   cfg.showQuickActions   !== false,
        showCredits:        cfg.showCredits        !== false,
        showSavedSuppliers: cfg.showSavedSuppliers !== false,
        showRecentActivity: cfg.showRecentActivity !== false,
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
    // v1.66l — two hero tabs: Home (this page) + Inbox (routes to the
    // canonical /inbox). Home is always the active tab here.
    // v1.65hG (p0016 Step 2): reads from pageCfg now — the local
    // read-only mirror of the bits the dashboard needs. The full
    // strip draft lives in <app-page-config-drawer>.
    // v1.66af — subtitle renders sentence-case like every other hero and
    // uses the configurable Events label (projectLabel) for the noun, so
    // renaming events (e.g. "Activation") flows through automatically.
    const eventWord = (this.projectLabel || 'event').toLowerCase();
    const ctx: any = {
      // p0023 / p0032 — no heroTitle: the AppShell computes it from
      // config.heroTitleMode (org / user / greeting). Hero colour is now
      // global (read from ConfigService by the AppShell), so we just flag
      // that this surface uses the configured title.
      useConfiguredTitle: true,
      heroSub: `What ${eventWord} are we working on today?`,
      pills: [],
      // v1.66m — no hero tab band on the dashboard. Home / Inbox /
      // Projects / Marketplace are top-level objects reached from the
      // top-nav, not sub-tabs of this screen. The dashboard is the Org
      // home; its body is the launcher.
      tabs: [],
    };
    // Upcoming pill — when enabled AND we've got a future project.
    if (this.pageCfg.showUpcoming && this.nextProject) {
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

  // v1.65hG (p0016 Step 2): saveLabels / onThemeChange / selectNavMode
  // / selectHeroAlign / saveToggles / isComponentActive / toggleComponent
  // all moved to <app-page-config-drawer>. The dashboard no longer owns
  // any of the strip's writes.

  loadProjects() {
    this.projectService.getAll().subscribe({
      next: projects => {
        this.projects = projects || [];
        // v1.31: bucket via the single projectStatus() helper so
        // null / draft / active / costing land in Active and the
        // closed family lands in Inactive. Previously a raw filter
        // on status_name silently dropped any project whose status
        // hadn't been set (e.g. modal-created ones).
        this.activeProjects = this.projects.filter(p => {
          const k = this.projectStatus(p).key;
          return ['draft', 'active', 'costing'].includes(k);
        });
        this.completedProjects = this.projects.filter(p => {
          const k = this.projectStatus(p).key;
          return ['completed', 'archived', 'closed', 'cancelled'].includes(k);
        });
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
    // v1.65hG (p0016 Step 2): <app-page-config-drawer> owns the
    // setTemplate(null) cleanup now. The dashboard no longer touches
    // ConfigStripService directly.
    this.sub?.unsubscribe();
  }
}
