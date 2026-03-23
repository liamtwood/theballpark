import { Component, OnInit, OnDestroy, HostBinding, ChangeDetectorRef } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { RouterModule, RouterOutlet, Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { TagModule } from 'primeng/tag';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { OrgService } from '../../../core/services/org.service';
import { ConfigService } from '../../../core/services/config.service';
import { ShellContextService, ShellContext } from '../../../core/services/shell-context.service';

interface ShellTab { label: string; path: string; }
interface NavItem  { label: string; path: string; }
interface NavGroup { label: string; items: NavItem[]; adminOnly?: boolean; }

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, TitleCasePipe, TagModule, RouterModule, RouterOutlet],
  template: `
    <!-- HERO -->
    <div class="bp-hero">

      <!-- PILLS — context-driven -->
      <div *ngIf="heroPills.length > 0" class="bp-hero-meta">
        <p-tag *ngFor="let pill of heroPills" [value]="pill" styleClass="bp-hero-tag"></p-tag>
      </div>

      <!-- TITLE — project name or org name -->
      <h1 class="bp-hero-org-name">{{ heroTitle }}</h1>

      <!-- SUB — "Org name · status" on project pages, page label elsewhere -->
      <p class="bp-hero-page-label">{{ heroSub }}</p>

      <!-- TABS — context tabs (project) or route tabs (settings etc.) -->
      <div class="bp-hero-tabs" *ngIf="navMode === 'tabs' && activeTabs.length > 0">
        <button *ngFor="let tab of activeTabs"
          class="bp-hero-tab" [class.active]="isActive(tab.path)"
          (click)="navigate(tab.path)">
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- BODY -->
    <div class="bp-shell-body" [class.bp-shell-sidenav-mode]="navMode === 'sidenav'">

      <!-- SIDE NAV -->
      <nav class="bp-sidenav" *ngIf="navMode === 'sidenav'">
        <div class="bp-sidenav-home" [class.active]="isActive('/')" (click)="navigate('/')">
          <span class="bp-sidenav-org">{{ orgName }}</span>
        </div>
        <ng-container *ngFor="let group of navGroups">
          <ng-container *ngIf="!group.adminOnly || isAdmin">
            <div class="bp-sidenav-group-label">{{ group.label }}</div>
            <div *ngFor="let item of group.items"
              class="bp-sidenav-item" [class.active]="isActive(item.path)"
              (click)="navigate(item.path)">
              {{ item.label }}
            </div>
          </ng-container>
        </ng-container>
      </nav>

      <!-- CONTENT -->
      <div class="bp-shell-content">
        <router-outlet></router-outlet>
      </div>

    </div>
  `,
  styles: [`
    :host             { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
    .bp-hero          { flex-shrink: 0; }

    /* ── HERO META (pills) ── */
    .bp-hero-meta { display: flex; justify-content: var(--hero-align-flex, center); gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
    :host ::ng-deep .bp-hero-tag.p-tag {
      background: var(--theme-bg) !important;
      color: var(--theme-text) !important;
      border: 0.5px solid var(--theme-border) !important;
      font-size: 11px !important;
      font-weight: 500 !important;
      padding: 3px 12px !important;
      border-radius: 20px !important;
    }

    /* ── HERO STATS BAR ── */
    .bp-hero-stats      { display: flex; justify-content: var(--hero-align-flex, center); gap: 0; margin-bottom: 12px; }
    .bp-hero-stat       { display: flex; flex-direction: column; align-items: center; padding: 8px 24px; border-right: 0.5px solid var(--theme-border); }
    .bp-hero-stat:last-child { border-right: none; }
    .bp-hero-stat-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--theme-text); margin-bottom: 2px; }
    .bp-hero-stat-value { font-size: 26px; font-weight: 700; color: var(--color-text-primary); line-height: 1.1; }
    .bp-hero-stat-sub   { font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }

    /* ── SHELL BODY ── */
    .bp-shell-body { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
    .bp-shell-body.bp-shell-sidenav-mode { flex-direction: row; }
    .bp-shell-content { flex: 1; min-height: 0; overflow-y: auto; }

    /* ── SIDE NAV ── */
    .bp-sidenav { width: 200px; flex-shrink: 0; border-right: 0.5px solid var(--color-border); padding: 16px 0; overflow-y: auto; background: var(--color-surface); }
    .bp-sidenav-home { padding: 10px 16px 14px; cursor: pointer; border-bottom: 0.5px solid var(--color-border); margin-bottom: 8px; }
    .bp-sidenav-org { font-family: var(--font-display); font-size: 15px; font-weight: 400; color: var(--color-text-primary); line-height: 1.2; display: block; transition: color 0.15s; }
    .bp-sidenav-home:hover .bp-sidenav-org { color: var(--theme-accent); }
    .bp-sidenav-home.active .bp-sidenav-org { color: var(--theme-accent); }
    .bp-sidenav-group-label { font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-text-muted); padding: 12px 16px 4px; }
    .bp-sidenav-item { display: flex; align-items: center; padding: 7px 16px; font-size: 13px; font-weight: 400; color: var(--color-text-secondary); cursor: pointer; border-left: 2px solid transparent; transition: background 0.15s, color 0.15s, border-color 0.15s; }
    .bp-sidenav-item:hover { background: var(--theme-bg); color: var(--color-text-primary); }
    .bp-sidenav-item.active { background: var(--theme-bg); color: var(--theme-accent); font-weight: 500; border-left-color: var(--theme-accent); }
  `]
})
export class AppShellComponent implements OnInit, OnDestroy {
  // Org defaults
  orgName      = '';
  userName     = '';
  userRole     = '';
  orgCity      = '';
  platformName = 'The Ballpark';

  // Route-driven
  pageLabel = '';
  routeTabs: ShellTab[] = [];
  isBallparkRoute = false;

  // Context override (set by project detail)
  ctx: ShellContext | null = null;

  // Computed — uses context if present, falls back to org defaults
  get hasContext(): boolean   { return !!this.ctx?.heroTitle; }
  get heroTitle(): string     { return this.ctx?.heroTitle || (this.isBallparkRoute ? this.platformName : this.orgName); }
  get heroSub(): string       { return this.ctx?.heroSub   || this.pageLabel; }
  get heroPills(): string[]   {
    if (this.ctx?.pills?.length) return this.ctx.pills;
    const pills: string[] = [];
    if (this.showUserName && this.userName) pills.push(`${this.userName} · ${this.userRole}`);
    if (this.showLocation && this.orgCity)  pills.push(this.orgCity);
    return pills;
  }
  get activeTabs(): ShellTab[] { return this.ctx?.tabs?.length ? this.ctx.tabs : this.routeTabs; }

  // Config flags
  heroAlign    = 'center';
  navMode: 'tabs' | 'sidenav' = 'tabs';
  showUserName = true;
  showLocation = true;
  showUpcoming = true;
  showStats    = true;
  creditLabel  = 'Ball';
  ballsBalance      = 0;
  isAdmin = true; // stub until v1.3 auth

  navGroups: NavGroup[] = [
    {
      label: 'Settings',
      items: [
        { label: 'Organisation', path: '/settings/organisation' },
        { label: 'Team',         path: '/settings/team' },
        { label: 'Subscription', path: '/settings/subscription' }
      ]
    },
    {
      label: 'Ballpark',
      adminOnly: true,
      items: [
        { label: 'Categories', path: '/ballpark-settings/categories' },
        { label: 'Marketplace', path: '/ballpark-settings/marketplace' }
      ]
    }
  ];

  @HostBinding('style.--hero-align')
  get heroAlignVar() {
    const val = this.navMode === 'sidenav' ? 'left' : this.heroAlign;
    document.documentElement.style.setProperty('--hero-align', val);
    return val;
  }

  @HostBinding('style.--hero-align-flex')
  get heroAlignFlex() {
    const val = (this.navMode === 'sidenav' || this.heroAlign === 'left') ? 'flex-start' : 'center';
    document.documentElement.style.setProperty('--hero-align-flex', val);
    return val;
  }

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private orgSvc: OrgService,
    private configService: ConfigService,
    private shellCtx: ShellContextService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Load org data
    this.orgSvc.getCurrentOrg().subscribe(org => {
      if (org) {
        this.orgName      = org.name;
        this.orgCity      = (org as any).city || '';
        this.ballsBalance = org.balls_balance || 0;
        this.cdr.detectChanges();
      }
    });

    // TODO: v1.3 auth — replace with getCurrentUser()
    this.orgSvc.getUsers().subscribe((users: any[]) => {
      if (users?.length) {
        this.userName = users[0].name || '';
        this.userRole = users[0].role || '';
        this.cdr.detectChanges();
      }
    });

    // Config
    this.syncFromConfig(this.configService.current as any);
    this.configService.config$.pipe(takeUntil(this.destroy$)).subscribe((config: any) => {
      this.syncFromConfig(config);
      this.cdr.detectChanges();
    });

    // Shell context — project detail writes here
    this.shellCtx.context$.pipe(takeUntil(this.destroy$)).subscribe(ctx => {
      this.ctx = ctx.heroTitle ? ctx : null;
      this.cdr.detectChanges();
    });

    // Route changes
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.updateFromRoute();
      this.cdr.detectChanges();
    });

    this.updateFromRoute();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private syncFromConfig(config: any) {
    this.heroAlign    = config?.heroAlign    || 'center';
    this.navMode      = config?.navMode      || 'tabs';
    this.showUserName = config?.showUserName !== false;
    this.showLocation = config?.showLocation !== false;
    this.showUpcoming = config?.showUpcoming !== false;
    this.showStats    = config?.showStats    !== false;
    this.creditLabel  = config?.creditLabel  || 'Ball';
    this.platformName = config?.platformName || 'The Ballpark';

    const pairing = config?.fontPairing || 'playfair-franklin';
    const fonts = AppShellComponent.FONT_PAIRINGS[pairing] || AppShellComponent.FONT_PAIRINGS['playfair-franklin'];
    document.documentElement.style.setProperty('--font-display', fonts.display);
    document.documentElement.style.setProperty('--font-body', fonts.body);
    document.documentElement.style.setProperty('--hero-align', this.heroAlignVar);
    document.documentElement.style.setProperty('--hero-align-flex', this.heroAlignFlex);
  }

  static readonly FONT_PAIRINGS: Record<string, { display: string; body: string; label: string }> = {
    'playfair-franklin': { display: "'Playfair Display', serif",  body: "'Libre Franklin', sans-serif", label: 'Playfair Display + Libre Franklin' },
    'playfair-dm':       { display: "'Playfair Display', serif",  body: "'DM Sans', sans-serif",        label: 'Playfair Display + DM Sans' },
    'inter':             { display: "'Inter', sans-serif",        body: "'Inter', sans-serif",           label: 'Inter + Inter' },
    'fraunces-nunito':   { display: "'Fraunces', serif",          body: "'Nunito', sans-serif",          label: 'Fraunces + Nunito' },
  };

  private updateFromRoute() {
    this.isBallparkRoute = this.router.url.startsWith('/ballpark-settings');
    // Reset context when navigating away from projects
    if (!this.router.url.includes('/projects/')) {
      this.shellCtx.reset();
    }
    let route = this.activatedRoute;
    while (route.firstChild) {
      route = route.firstChild;
      const data = route.snapshot.data;
      if (data['pageLabel'] !== undefined) {
        this.pageLabel  = data['pageLabel'];
        this.routeTabs  = data['tabs'] || [];
      }
    }
  }

  navigate(path: string) { this.router.navigateByUrl(path); }
  isActive(path: string) {
    if (path === '/') return this.router.url === '/';
    return this.router.url.startsWith(path);
  }
}
