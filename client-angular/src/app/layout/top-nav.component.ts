import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { LucideAngularModule, Sun, Moon, Settings, House, User, Building2, MessageCircle, FileText, Heart, Plus, Store, Package, Inbox, Sparkles } from 'lucide-angular';
import { ConfigService } from '../core/services/config.service';
import { OrgService } from '../core/services/org.service';
import { ShellContextService } from '../core/services/shell-context.service';
import { ConfigStripService } from '../core/services/config-strip.service';
import { TagModule } from 'primeng/tag';
import { AvatarComponent } from '../shared/components/avatar/avatar.component';
import {
  PersonaDropdownComponent
} from '../shared/components/persona-dropdown/persona-dropdown.component';
import { PersonaService } from '../core/services/persona.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, TagModule, AvatarComponent, PersonaDropdownComponent],
  template: `
    <!-- DESKTOP TOP NAV -->
    <nav class="bp-nav">
      <div class="bp-nav-left">
        <a routerLink="/" class="bp-nav-logo">
          <img *ngIf="logoUrl" [src]="logoUrl" alt="Logo" class="bp-nav-logo-img"/>
          <ng-container *ngIf="!logoUrl">
            <span class="bp-logo-text">{{ logoFirst }}</span><span class="bp-logo-accent">{{ logoSecond }}</span>
          </ng-container>
        </a>
        <span class="bp-nav-tagline">{{ tagline }}</span>
      </div>
      <button class="bp-mode-btn bp-mode-btn-mobile" (click)="toggleMode()"
        [title]="modeTitle">
        <lucide-icon [name]="modeIcon" [size]="16"></lucide-icon>
      </button>
      <div class="bp-nav-right">
        <!-- v1.65dz (p0015) — agency + admin persona link set. -->
        <ng-container *ngIf="personaSvc.isAgency() || personaSvc.isAdmin()">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}" class="bp-nav-link">
            <lucide-icon name="house" [size]="14"></lucide-icon> Home
          </a>
          <a *ngIf="isAdmin"
             routerLink="/ballpark-settings" routerLinkActive="active"
             class="bp-nav-link bp-nav-link-admin">
            <lucide-icon name="settings" [size]="14"></lucide-icon> Admin
          </a>
          <!-- v1.65at — Welcome link restored. Opens the public /welcome
               deck in a new tab — testing aid for the marketing surface. -->
          <a href="/welcome" target="_blank" rel="noopener"
             class="bp-nav-link bp-nav-link-welcome"
             title="Open the public Welcome page in a new tab">
            <lucide-icon name="sparkles" [size]="14"></lucide-icon> Welcome
          </a>
        </ng-container>

        <!-- v1.65dz → v1.65e1 (p0015) — supplier persona link set.
             All four tabs route to the SAME /suppliers/:id page with
             different ?tab= query params; supplier-detail reads the
             param on init and renders the matching tab content.
             Tracking active state via queryParamsHandling so the
             nav link reflects the live tab. -->
        <ng-container *ngIf="personaSvc.isSupplier() && supplierPersonaOrgId">
          <a [routerLink]="['/suppliers', supplierPersonaOrgId]"
             [queryParams]="{ tab: 'home' }"
             class="bp-nav-link">
            <lucide-icon name="house" [size]="14"></lucide-icon> Home
          </a>
          <a [routerLink]="['/suppliers', supplierPersonaOrgId]"
             [queryParams]="{ tab: 'front' }"
             class="bp-nav-link">
            <lucide-icon name="store" [size]="14"></lucide-icon> Front
          </a>
          <a [routerLink]="['/suppliers', supplierPersonaOrgId]"
             [queryParams]="{ tab: 'store' }"
             class="bp-nav-link">
            <lucide-icon name="package" [size]="14"></lucide-icon> Store
          </a>
          <a [routerLink]="['/suppliers', supplierPersonaOrgId]"
             [queryParams]="{ tab: 'inbox' }"
             class="bp-nav-link">
            <lucide-icon name="inbox" [size]="14"></lucide-icon> Inbox
          </a>
        </ng-container>
        <p-tag [value]="ballsBalance + ' ' + creditLabel + 's left'" styleClass="bp-balls-tag"></p-tag>
        <button *ngIf="hasConfig && isAdmin" class="bp-mode-btn" (click)="toggleConfigStrip()" title="Page settings">
          <lucide-icon name="settings" [size]="14"></lucide-icon>
        </button>
        <!-- v1.35: Settings cog removed per user request — Settings is
             reachable via the dashboard Quick Actions / Invite Member
             quick action; the cog was redundant in the nav cluster. -->
        <button class="bp-mode-btn" (click)="toggleMode()" [title]="modeTitle">
          <lucide-icon [name]="modeIcon" [size]="14"></lucide-icon>
        </button>
        <!-- v1.65dz (p0015) — avatar opens persona dropdown when
             PersonaService.canSwitch is true (dev / admin). Wrapper is
             position:relative so the dropdown anchors below the avatar. -->
        <div class="bp-nav-avatar-wrap">
          <button type="button"
                  class="bp-nav-avatar-btn"
                  (click)="onAvatarClick($event)"
                  [title]="personaSvc.canSwitch ? 'Switch persona' : ''">
            <app-avatar
              [name]="personaSvc.active.name"
              [size]="32">
            </app-avatar>
          </button>
          <app-persona-dropdown
            *ngIf="personaSvc.canSwitch"
            [(open)]="personaDropdownOpen">
          </app-persona-dropdown>
        </div>
      </div>
    </nav>
    <div class="bp-nav-version">{{ version }}</div>

    <!-- MOBILE BOTTOM NAV -->
    <nav class="bp-bottom-nav">

      <!-- DEFAULT NAV — Home, Suppliers, Favourites, Messages -->
      <ng-container *ngIf="!inProject">
        <a routerLink="/" [routerLinkActiveOptions]="{exact:true}" routerLinkActive="active" class="bp-bottom-tab">
          <lucide-icon name="house" [size]="20"></lucide-icon>
          <span>Home</span>
        </a>
        <a routerLink="/suppliers" routerLinkActive="active" class="bp-bottom-tab">
          <lucide-icon name="building-2" [size]="20"></lucide-icon>
          <span>{{ catalogueLabel }}</span>
        </a>
        <a routerLink="/favourites" routerLinkActive="active" class="bp-bottom-tab">
          <lucide-icon name="heart" [size]="20"></lucide-icon>
          <span>Favourites</span>
        </a>
        <a routerLink="/messages" routerLinkActive="active" class="bp-bottom-tab">
          <lucide-icon name="inbox" [size]="20"></lucide-icon>
          <span>Inbox</span>
        </a>
      </ng-container>

      <!-- PROJECT NAV — Home, Project, Suppliers, Inbox -->
      <ng-container *ngIf="inProject">
        <a routerLink="/" class="bp-bottom-tab">
          <lucide-icon name="house" [size]="20"></lucide-icon>
          <span>Home</span>
        </a>
        <a [routerLink]="['/projects', projectId]" routerLinkActive="active" class="bp-bottom-tab">
          <lucide-icon name="folder" [size]="20"></lucide-icon>
          <span>Project</span>
        </a>
        <a [routerLink]="['/suppliers']" [queryParams]="{projectId: projectId}" routerLinkActive="active" class="bp-bottom-tab">
          <lucide-icon name="building-2" [size]="20"></lucide-icon>
          <span>{{ catalogueLabel }}</span>
        </a>
        <a [routerLink]="projectMessagesPath" [queryParams]="projectMessagesQueryParams" routerLinkActive="active" class="bp-bottom-tab">
          <lucide-icon name="inbox" [size]="20"></lucide-icon>
          <span>Inbox</span>
        </a>
      </ng-container>

      <!-- FLOATING ACTION BUTTON — project pages only -->
      <div *ngIf="inProject" class="bp-fab-wrap">
        <a [routerLink]="projectBuildPath" class="bp-fab" title="Add item or request quote">
          <lucide-icon name="plus" [size]="20"></lucide-icon>
        </a>
      </div>

    </nav>
  `,
  styles: [`
    /* ── DESKTOP TOP NAV ── */
    .bp-nav {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 var(--section-pad); height: var(--nav-height);
      border-bottom: 0.5px solid var(--color-border); background: var(--color-surface);
      flex-shrink: 0; z-index: 100;
    }
    .bp-nav-left  { display: flex; align-items: center; }
    .bp-nav-logo  { display: flex; align-items: baseline; text-decoration: none; gap: 0; }
    .bp-nav-logo-img { height: 28px; width: auto; object-fit: contain; }
    .bp-logo-text {
      font-family: var(--font-display); font-size: var(--text-lg); font-weight: 400;
      color: var(--color-text-primary); letter-spacing: -0.01em;
    }
    .bp-logo-accent {
      font-family: var(--font-display); font-size: var(--text-lg); font-weight: 400;
      color: var(--theme-accent); letter-spacing: -0.01em;
    }
    .bp-nav-tagline {
      font-family: var(--font-body); font-size: 10px; font-weight: 600;
      color: var(--theme-accent); margin-left: 10px;
      text-transform: uppercase; letter-spacing: 0.07em;
    }
    .bp-nav-right { display: flex; align-items: center; gap: 24px; }

    /* v1.65dz (p0015) — avatar wrapper hosts the persona dropdown.
       Position relative so the dropdown's top: 100% anchors here. */
    .bp-nav-avatar-wrap { position: relative; }
    .bp-nav-avatar-btn {
      background: transparent;
      border: none;
      padding: 0;
      cursor: pointer;
      display: flex;
      align-items: center;
    }
    .bp-nav-link {
      font-size: var(--text-base); color: #9CA3AF;
      cursor: pointer; text-decoration: none; transition: color 0.15s;
      display: flex; align-items: center; gap: 5px;
    }
    .bp-nav-link:hover { color: #111111; }
    .bp-nav-link.active { color: var(--theme-accent); font-weight: 600; }
.bp-mode-btn {
      width: 32px; height: 32px; border-radius: 50%;
      border: 0.5px solid var(--color-border); background: transparent;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      color: var(--color-text-secondary);
    }
    /* v1.35: Settings cog — same visual weight as the dark-mode toggle
       icon. No bg, no border, muted colour, themed accent on hover. */
    .bp-nav-icon-link {
      width: 32px; height: 32px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: transparent; border: none;
      color: var(--color-text-muted); cursor: pointer;
      text-decoration: none; transition: color 0.15s;
    }
    .bp-nav-icon-link:hover { color: var(--theme-accent); }
    .bp-nav-version {
      position: fixed; bottom: 8px; right: 12px;
      font-size: 10px; color: var(--color-text-muted); z-index: 50;
    }

    /* ── MOBILE BOTTOM NAV — hidden on desktop ── */
    .bp-bottom-nav {
      display: none;
    }

    .bp-fab-wrap { display: none; }
    .bp-mode-btn-mobile { display: none; }

    /* ── MOBILE BREAKPOINT ── */
    @media (max-width: 768px) {
      .bp-mode-btn-mobile { display: flex; margin-right: 16px; }
      /* Hide desktop nav links, keep logo */
      .bp-nav-right { display: none; }
      .bp-nav-tagline { display: none; }
      .bp-nav-version { display: none; }

      /* Show bottom nav */
      .bp-bottom-nav {
        display: flex;
        position: fixed;
        bottom: 0; left: 0; right: 0;
        height: 60px;
        background: var(--color-surface);
        border-top: 0.5px solid var(--color-border);
        z-index: 200;
        justify-content: space-around;
        align-items: center;
        padding-bottom: env(safe-area-inset-bottom);
      }

      .bp-bottom-tab {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 3px; flex: 1; height: 100%;
        text-decoration: none;
        font-size: 10px; font-weight: 500;
        color: var(--color-text-muted);
        transition: color 0.15s;
        font-family: var(--font-body);
      }
      .bp-bottom-tab:hover  { color: var(--color-text-secondary); }
      .bp-bottom-tab.active { color: var(--theme-accent); }

      .bp-fab-wrap { display: block; position: fixed; bottom: 72px; right: 16px; z-index: 300; }
      .bp-fab { width: 52px; height: 52px; border-radius: 50%; background: var(--theme-accent); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.2); text-decoration: none; transition: transform 0.15s; }
      .bp-fab:active { transform: scale(0.95); }

      :host { display: block; }
    }
  `]
})
export class TopNavComponent implements OnInit, OnDestroy {
  logoFirst    = 'The Ball';
  logoSecond   = 'park';
  logoUrl      = '';
  tagline      = 'Exhibition Costing';
  creditLabel  = 'Ball';
  catalogueLabel = 'Catalogue';
  feedbackLabel  = 'Feedback';
  ballsBalance = 0;
  orgName      = '';
  /** v1.22: avatar in the top-right now shows USER initials, not org.
      Sourced from the same orgSvc.getUsers() call that drives isAdmin —
      first user record is treated as the current user (mirrors the
      AppShell pattern). Falls back to orgName until users load so we
      never render an empty circle. */
  userName     = '';
  isDark       = false;
  /** p0003 — current display mode. Source of truth for modeIcon /
      modeTitle / the three-way toggle. */
  mode: 'light' | 'dark' | 'bold' = 'light';
  isAdmin      = false;
  version      = environment.version;
  inProject    = false;
  projectId    = '';

  // v1.18b: Build tab renamed to Estimate. Getter name kept for now to
  // avoid touching every top-nav consumer; URL points at /estimate.
  get projectBuildPath()    { return `/projects/${this.projectId}/estimate`; }
  // v1.65cg (p0005) — projectBriefPath getter removed; Plan tab
  // deleted and /brief now redirects to /marketplace. No consumer
  // referenced this getter.
  get projectMessagesPath() { return `/projects/${this.projectId}/messages`; }
  get projectMessagesQueryParams(): any { return {}; }

  hasConfig    = false;

  private sub?: Subscription;
  private routerSub?: Subscription;
  private ctxSub?: Subscription;
  private cfgStripSub?: Subscription;
  private personaSub?: Subscription;

  /** v1.65dz (p0015) — persona dropdown open state, toggled by the
      avatar button. Closed by default; the dropdown itself self-
      closes on outside click. */
  personaDropdownOpen = false;

  constructor(
    private configService: ConfigService,
    private orgService: OrgService,
    private shellCtx: ShellContextService,
    private configStrip: ConfigStripService,
    public  personaSvc: PersonaService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  /** v1.65dz — clicking the avatar toggles the persona dropdown when
      the user is allowed to switch personas. Stops propagation so
      the dropdown's outside-click handler doesn't immediately close
      it. No-op for real production users (single persona). */
  onAvatarClick(ev: MouseEvent) {
    if (!this.personaSvc.canSwitch) return;
    ev.stopPropagation();
    this.personaDropdownOpen = !this.personaDropdownOpen;
  }

  /** v1.65dz (p0015) — supplier persona's org id, used to build the
      Front + Store nav links to /suppliers/:id. Returns empty when
      not in supplier persona OR when no supplierOrgId is set on the
      active persona record (defensive — keeps the link from
      rendering /suppliers/undefined). */
  get supplierPersonaOrgId(): string {
    const p = this.personaSvc.active;
    return p.kind === 'supplier' ? (p.supplierOrgId || '') : '';
  }

  toggleConfigStrip() { this.configStrip.toggle(); }

  ngOnInit() {
    this.sub = this.configService.config$.subscribe(cfg => {
      if (cfg.logoUrl)      this.logoUrl      = cfg.logoUrl;
      if (cfg.platformName) {
        const parts = cfg.platformName.split(' ');
        this.logoFirst  = parts.slice(0, -1).join(' ') + ' ';
        this.logoSecond = parts[parts.length - 1];
      }
      if (cfg.tagline)     this.tagline     = cfg.tagline;
      if (cfg.creditLabel) this.creditLabel = cfg.creditLabel;
      if (cfg.catalogueLabel) this.catalogueLabel = cfg.catalogueLabel;
      if (cfg.feedbackLabel)  this.feedbackLabel  = cfg.feedbackLabel;
      this.cdr.detectChanges();
    });

    this.orgService.getCurrentOrg().subscribe(org => {
      if (org) {
        this.orgName      = org.name;
        this.ballsBalance = org.balls_balance || 0;
        // v1.23g: fall back to the org's DB logo_url when the local
        // ConfigService doesn't have one (e.g. fresh browser, or a
        // teammate who hasn't visited Marketplace settings). Don't
        // overwrite a ConfigService value that was already set —
        // that wins because it's the latest user action.
        if (!this.logoUrl && (org as any).logo_url) {
          this.logoUrl = (org as any).logo_url;
          this.cdr.detectChanges();
        } else {
          this.cdr.detectChanges();
        }
      }
    });

    // Mirror app-shell's pattern: first user record is treated as the
    // current user, so admin role gates the cog the same way it gates
    // admin-only nav groups.
    this.orgService.getUsers().subscribe((users: any[]) => {
      if (users?.length) {
        this.isAdmin = users[0].role === 'admin' || users[0].is_platform_admin === true;
        this.userName = users[0].name || '';
        this.cdr.detectChanges();
      }
    });

    // Track project context for bottom nav switching
    this.ctxSub = this.shellCtx.context$.subscribe(ctx => {
      this.inProject = !!ctx?.heroTitle && (this.router.url.includes('/projects/') || this.router.url.includes('projectId='));
      this.cdr.detectChanges();
    });

    this.routerSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      const projectMatch = e.url.match(/\/projects\/([^\/]+)/);
      const qpMatch = e.url.match(/[?&]projectId=([^&]+)/);
      if (projectMatch) {
        this.projectId = projectMatch[1];
        this.inProject = true;
      } else if (qpMatch) {
        this.projectId = qpMatch[1];
        this.inProject = true;
      } else {
        this.inProject = false;
        this.projectId = '';
      }
      this.cdr.detectChanges();
    });

    // Check current route on init
    const match = this.router.url.match(/\/projects\/([^\/]+)/);
    const qpMatch = this.router.url.match(/[?&]projectId=([^&]+)/);
    if (match) { this.projectId = match[1]; this.inProject = true; }
    else if (qpMatch) { this.projectId = qpMatch[1]; this.inProject = true; }

    /* p0003 — three-way mode preference (light / dark / bold). */
    const saved = localStorage.getItem('bp-mode') as 'light' | 'dark' | 'bold' | null;
    this.mode = (saved === 'dark' || saved === 'bold') ? saved : 'light';
    this.isDark = this.mode === 'dark';
    this.configService.update({ mode: this.mode });

    this.cfgStripSub = this.configStrip.hasConfig$.subscribe(has => {
      this.hasConfig = has;
      this.cdr.detectChanges();
    });

    /* v1.65dz (p0015) — re-render the avatar + nav whenever the active
       persona flips so the initials reflect the current persona. */
    this.personaSub = this.personaSvc.active$.subscribe(() => {
      this.cdr.detectChanges();
    });
  }

  /* p0003 — three-way cycle: light → dark → bold → light. */
  toggleMode() {
    const order: Array<'light' | 'dark' | 'bold'> = ['light', 'dark', 'bold'];
    const next = order[(order.indexOf(this.mode) + 1) % order.length];
    this.mode = next;
    this.isDark = next === 'dark';
    localStorage.setItem('bp-mode', next);
    this.configService.update({ mode: next });
  }

  get modeIcon(): string {
    if (this.mode === 'dark') return 'moon';
    if (this.mode === 'bold') return 'sparkles';
    return 'sun';
  }
  get modeTitle(): string {
    if (this.mode === 'light') return 'Switch to dark mode';
    if (this.mode === 'dark')  return 'Switch to bold mode';
    return 'Switch to light mode';
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.routerSub?.unsubscribe();
    this.ctxSub?.unsubscribe();
    this.cfgStripSub?.unsubscribe();
    this.personaSub?.unsubscribe();
  }
}
