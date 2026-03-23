import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { LucideAngularModule, Sun, Moon, Settings, House, User, Building2, FolderOpen, MessageCircle, FileText, Heart, Plus } from 'lucide-angular';
import { ConfigService } from '../core/services/config.service';
import { OrgService } from '../core/services/org.service';
import { ShellContextService } from '../core/services/shell-context.service';
import { TagModule } from 'primeng/tag';
import { AvatarComponent } from '../shared/components/avatar/avatar.component';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, TagModule, AvatarComponent],
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
      <div class="bp-nav-right">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}" class="bp-nav-link">
          <lucide-icon name="house" [size]="14"></lucide-icon> Home
        </a>
        <a routerLink="/settings" routerLinkActive="active" class="bp-nav-link">
          <lucide-icon name="settings" [size]="14"></lucide-icon> Settings
        </a>
        <a routerLink="/ballpark-settings" routerLinkActive="active" class="bp-nav-link bp-nav-link-admin">
          <lucide-icon name="settings" [size]="14"></lucide-icon> Ballpark
        </a>
        <p-tag [value]="ballsBalance + ' ' + creditLabel + 's left'" styleClass="bp-balls-tag"></p-tag>
        <button class="bp-mode-btn" (click)="toggleMode()" [title]="isDark ? 'Switch to light mode' : 'Switch to dark mode'">
          <lucide-icon [name]="isDark ? 'moon' : 'sun'" [size]="14"></lucide-icon>
        </button>
        <app-avatar [name]="orgName" [size]="32"></app-avatar>
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
          <span>Suppliers</span>
        </a>
        <a routerLink="/favourites" routerLinkActive="active" class="bp-bottom-tab">
          <lucide-icon name="heart" [size]="20"></lucide-icon>
          <span>Favourites</span>
        </a>
        <a routerLink="/messages" routerLinkActive="active" class="bp-bottom-tab">
          <lucide-icon name="message-circle" [size]="20"></lucide-icon>
          <span>Messages</span>
        </a>
      </ng-container>

      <!-- PROJECT NAV — Home, Suppliers, Favourites, Messages -->
      <ng-container *ngIf="inProject">
        <a routerLink="/" class="bp-bottom-tab">
          <lucide-icon name="house" [size]="20"></lucide-icon>
          <span>Home</span>
        </a>
        <a [routerLink]="['/suppliers']" [queryParams]="{projectId: projectId}" routerLinkActive="active" class="bp-bottom-tab">
          <lucide-icon name="building-2" [size]="20"></lucide-icon>
          <span>Suppliers</span>
        </a>
        <a routerLink="/favourites" routerLinkActive="active" class="bp-bottom-tab">
          <lucide-icon name="heart" [size]="20"></lucide-icon>
          <span>Favourites</span>
        </a>
        <a [routerLink]="projectMessagesPath" routerLinkActive="active" class="bp-bottom-tab">
          <lucide-icon name="message-circle" [size]="20"></lucide-icon>
          <span>Messages</span>
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
    .bp-nav-version {
      position: fixed; bottom: 8px; right: 12px;
      font-size: 10px; color: var(--color-text-muted); z-index: 50;
    }

    /* ── MOBILE BOTTOM NAV — hidden on desktop ── */
    .bp-bottom-nav {
      display: none;
    }

    .bp-fab-wrap { display: none; }

    /* ── MOBILE BREAKPOINT ── */
    @media (max-width: 768px) {
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
  ballsBalance = 0;
  orgName      = '';
  isDark       = false;
  version      = environment.version;
  inProject    = false;
  projectId    = '';

  get projectBuildPath()    { return `/projects/${this.projectId}/build`; }
  get projectBriefPath()    { return `/projects/${this.projectId}/brief`; }
  get projectMessagesPath() { return `/projects/${this.projectId}/messages`; }

  private sub?: Subscription;
  private routerSub?: Subscription;
  private ctxSub?: Subscription;

  constructor(
    private configService: ConfigService,
    private orgService: OrgService,
    private shellCtx: ShellContextService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

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
      this.cdr.detectChanges();
    });

    this.orgService.getCurrentOrg().subscribe(org => {
      if (org) {
        this.orgName      = org.name;
        this.ballsBalance = org.balls_balance || 0;
        this.cdr.detectChanges();
      }
    });

    // Track project context for bottom nav switching
    this.ctxSub = this.shellCtx.context$.subscribe(ctx => {
      this.inProject = !!ctx?.heroTitle && this.router.url.includes('/projects/');
      this.cdr.detectChanges();
    });

    this.routerSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      const match = e.url.match(/\/projects\/([^\/]+)/);
      if (match) {
        this.projectId = match[1];
        this.inProject = true;
      } else {
        this.inProject = false;
        this.projectId = '';
      }
      this.cdr.detectChanges();
    });

    // Check current route on init
    const match = this.router.url.match(/\/projects\/([^\/]+)/);
    if (match) { this.projectId = match[1]; this.inProject = true; }

    this.isDark = document.documentElement.getAttribute('data-mode') === 'dark';
  }

  toggleMode() {
    this.isDark = !this.isDark;
    document.documentElement.setAttribute('data-mode', this.isDark ? 'dark' : 'light');
    localStorage.setItem('bp-mode', this.isDark ? 'dark' : 'light');
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.routerSub?.unsubscribe();
    this.ctxSub?.unsubscribe();
  }
}
