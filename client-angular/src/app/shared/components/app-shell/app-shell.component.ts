import { Component, OnInit, OnDestroy, HostBinding, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { RouterModule, RouterOutlet, Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule, MapPin, Calendar } from 'lucide-angular';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { OrgService } from '../../../core/services/org.service';
import { ConfigService } from '../../../core/services/config.service';
import { ShellContextService, ShellContext, ShellTab } from '../../../core/services/shell-context.service';
import { ConfigStripService } from '../../../core/services/config-strip.service';
import { TemplateRef } from '@angular/core';

interface NavItem  { label: string; path: string; }
interface NavGroup { label: string; items: NavItem[]; adminOnly?: boolean; }

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, TitleCasePipe, TagModule, ToastModule, LucideAngularModule, RouterModule, RouterOutlet],
  providers: [MessageService],
  template: `
    <!-- HERO -->
    <div class="bp-hero" *ngIf="!hideHero">

      <!-- Optional left-aligned back link, vertically centred in the hero.
           Pages opt-in via shellCtx.set({ back: { label, onBack } }).
           Wrapped in an *ngIf="as" pattern because this.ctx is nullable
           on routes that don't use the hero. -->
      <ng-container *ngIf="ctx?.back as back">
        <button type="button" class="bp-hero-back" (click)="back.onBack()">
          <lucide-icon name="chevron-left" [size]="14"></lucide-icon>
          <span>{{ back.label }}</span>
        </button>
      </ng-container>

      <!-- PILLS — v1.22 interactive.
           User pill: click opens a small dropdown (Profile / Switch
           Org / Sign out — Profile routes, the others are stubs).
           Location pill: click → /settings.
           Upcoming pill (v1.23): renders when ctx.upcomingPill is set
           AND ConfigService.showUpcoming is true — see ngOnInit. -->
      <div *ngIf="heroPills.length > 0 || upcomingPillText" class="bp-hero-meta">
        <ng-container *ngFor="let pill of heroPills">
          <!-- Location pill -->
          <button *ngIf="isLocationPill(pill)"
                  type="button"
                  class="bp-hero-tag-span bp-hero-pill-btn"
                  (click)="onLocationPillClick()">
            <lucide-icon name="map-pin" [size]="10" style="flex-shrink:0;"></lucide-icon>
            {{ pill }}
          </button>
          <!-- User pill — wrapped in a relative div so the dropdown
               anchors below it without affecting layout. -->
          <div *ngIf="!isLocationPill(pill)" class="bp-hero-pill-wrap">
            <p-tag [value]="pill"
                   styleClass="bp-hero-tag bp-hero-pill-btn"
                   (click)="onUserPillClick($event)"></p-tag>
            <div *ngIf="userMenuOpen"
                 class="bp-hero-pill-menu"
                 (click)="$event.stopPropagation()">
              <button type="button" class="bp-hero-pill-menu-item"
                      (click)="onUserMenuAction('profile')">Profile</button>
              <button type="button" class="bp-hero-pill-menu-item"
                      (click)="onUserMenuAction('switch-org')">Switch Org</button>
              <div class="bp-hero-pill-menu-sep"></div>
              <button type="button"
                      class="bp-hero-pill-menu-item bp-hero-pill-menu-item--danger"
                      (click)="onUserMenuAction('signout')">Sign out</button>
            </div>
          </div>
        </ng-container>

        <!-- Upcoming-event pill (v1.23). Dashboard pushes the text via
             shellCtx.upcomingPill when ConfigService.showUpcoming is on
             AND a future project exists. Calendar icon + plain text. -->
        <span *ngIf="upcomingPillText" class="bp-hero-tag-span bp-hero-upcoming">
          <lucide-icon name="calendar" [size]="10" style="flex-shrink:0;"></lucide-icon>
          {{ upcomingPillText }}
        </span>
      </div>

      <!-- TITLE -->
      <h1 class="bp-hero-org-name">{{ heroTitle }}</h1>

      <!-- SUB -->
      <p class="bp-hero-page-label">{{ heroSub }}</p>

      <!-- TABS -->
      <div class="bp-hero-tabs" *ngIf="navMode === 'tabs' && activeTabs.length > 0">
        <button *ngFor="let tab of activeTabs"
          class="bp-hero-tab"
          [class.active]="isTabActive(tab)"
          (click)="onTabClick(tab)">
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- v1.23f: lifted config-strip slot. When a page pushes a
         TemplateRef via ConfigStripService.setTemplate() (e.g. the
         dashboard's Home settings strip), the strip renders here —
         between hero and body — so it spans full width even when
         navMode='sidenav'. The cog in the top-nav still toggles
         open/closed via ConfigStripService.toggle(). Pages that use
         the inline <app-config-strip> wrapper instead don't push a
         template, so this slot stays hidden. -->
    <div *ngIf="stripTpl && stripOpen" class="bp-shell-config-strip">
      <ng-container *ngTemplateOutlet="stripTpl"></ng-container>
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

    <p-toast></p-toast>
  `,
  styles: [`
    :host             { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
    .bp-hero          { flex-shrink: 0; position: relative; }

    /* Optional back link on the hero's left edge. Vertically centred
       against the hero's full height; offset is var(--section-pad) so it
       aligns with the page's left content gutter. */
    .bp-hero-back {
      position: absolute;
      left: var(--section-pad, 28px);
      top: 50%;
      transform: translateY(-50%);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: none; border: none;
      cursor: pointer;
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 500;
      color: var(--theme-accent);
      padding: 4px 0;
      white-space: nowrap;
    }
    .bp-hero-back:hover { opacity: 0.75; }
    @media (max-width: 600px) {
      /* Hide the back label on narrow screens — keep the chevron only. */
      .bp-hero-back span { display: none; }
    }

    /* ── HERO META (pills) ── */
    .bp-hero-meta { display: flex; justify-content: var(--hero-align-flex, center); gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }

    :host ::ng-deep .bp-hero-tag.p-tag {
      background: #fff !important;
      color: var(--theme-text) !important;
      border: 1.5px solid var(--theme-accent) !important;
      font-size: 11px !important;
      font-weight: 500 !important;
      padding: 3px 12px !important;
      border-radius: 20px !important;
    }

    .bp-hero-tag-span {
      display: inline-flex; align-items: center; gap: 5px;
      background: #fff; color: var(--theme-text);
      border: 1.5px solid var(--theme-accent);
      font-size: 11px; font-weight: 500;
      padding: 3px 12px; border-radius: 20px;
    }

    /* v1.22: interactive pill treatment — applied via the
       .bp-hero-pill-btn modifier on both pill types so the user
       and location pills feel obviously clickable. */
    .bp-hero-pill-btn {
      cursor: pointer;
      font-family: var(--font-body);
      transition: border-color 150ms ease, background-color 100ms ease;
    }
    .bp-hero-pill-btn:hover {
      border-color: var(--theme-accent) !important;
      background: var(--theme-bg) !important;
    }
    :host ::ng-deep .bp-hero-tag.bp-hero-pill-btn .p-tag {
      cursor: pointer;
    }

    /* User pill dropdown — Level 3 elevation, anchored below the
       pill via the relative wrap. */
    .bp-hero-pill-wrap { position: relative; display: inline-block; }
    .bp-hero-pill-menu {
      position: absolute;
      top: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      min-width: 150px;
      background: var(--color-surface);
      border: var(--border-hairline);
      border-radius: var(--radius-button);
      box-shadow: var(--shadow-md);
      padding: 4px 0;
      z-index: 100;
    }
    .bp-hero-pill-menu-item {
      display: block;
      width: 100%;
      padding: 8px 14px;
      font-size: 12.5px;
      font-weight: 500;
      text-align: left;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-text-primary);
      font-family: var(--font-body);
      transition: background 0.1s;
    }
    .bp-hero-pill-menu-item:hover { background: var(--theme-bg); }
    .bp-hero-pill-menu-item--danger { color: var(--color-danger); }
    .bp-hero-pill-menu-item--danger:hover { background: rgba(225, 29, 72, 0.06); }
    .bp-hero-pill-menu-sep {
      height: 0.5px;
      background: var(--color-border);
      margin: 4px 0;
    }

    /* v1.22: hero band gets a hairline separator to mark the
       boundary between header and KPI strip / body. */
    .bp-hero { border-bottom: var(--border-hairline); }

    /* v1.23f: lifted config-strip slot. Pages provide the inner
       controls via TemplateRef + ConfigStripService.setTemplate.
       Chrome (background, padding, hairline) lives here so the
       strip always renders the same regardless of which page
       lit it up. flex-shrink:0 keeps the row from collapsing. */
    .bp-shell-config-strip {
      flex-shrink: 0;
      display: flex; align-items: center; gap: 18px;
      padding: 10px 28px;
      background: var(--color-surface);
      border-bottom: 0.5px solid var(--color-border);
      flex-wrap: wrap;
      font-family: var(--font-body);
      font-size: 12px;
      color: var(--color-text-secondary);
    }

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
  orgName      = '';
  userName     = '';
  userRole     = '';
  orgCity      = '';
  platformName = 'The Ballpark';

  pageLabel    = '';
  hideHero     = false;
  routeTabs: ShellTab[] = [];
  isBallparkRoute = false;

  ctx: ShellContext | null = null;

  get hasContext(): boolean   { return !!this.ctx?.heroTitle; }
  get heroTitle(): string     { return this.ctx?.heroTitle || (this.isBallparkRoute ? this.platformName : this.orgName); }
  get heroSub(): string       { return this.ctx?.heroSub   || this.pageLabel; }
  get heroPills(): string[]   {
    if (this.ctx?.pills?.length) return this.ctx.pills;
    const pills: string[] = [];
    // v1.23c: title-case the role so "admin" renders as "Admin" in
    // the pill. The DB column stores it lowercase ('owner' / 'admin'
    // / 'member') — only the display is capitalised.
    if (this.showUserName && this.userName) {
      const role = this.userRole
        ? this.userRole.charAt(0).toUpperCase() + this.userRole.slice(1)
        : '';
      pills.push(role ? `${this.userName} · ${role}` : this.userName);
    }
    if (this.showLocation && this.orgCity)  pills.push(this.orgCity);
    return pills;
  }
  get activeTabs(): ShellTab[] { return this.ctx?.tabs?.length ? this.ctx.tabs : this.routeTabs; }

  isLocationPill(pill: string): boolean {
    if (pill === this.orgCity) return true;
    if (this.ctx?.pills && this.ctx.pills.length >= 2 && pill === this.ctx.pills[1]) return true;
    return false;
  }

  /** v1.23: text for the optional upcoming-event pill. Empty when
      ConfigService.showUpcoming is false or the dashboard hasn't
      pushed an upcomingPill payload. Empty string hides the span. */
  get upcomingPillText(): string {
    if (!this.showUpcoming) return '';
    return this.ctx?.upcomingPill?.text || '';
  }

  // Tab click — use onTabClick callback if present, otherwise navigate by path
  onTabClick(tab: ShellTab) {
    if (this.ctx?.onTabClick) {
      this.ctx.onTabClick(tab);
    } else {
      this.navigate(tab.path);
    }
  }

  // Tab active state — use activeTabPath if set (callback mode), otherwise route matching
  isTabActive(tab: ShellTab): boolean {
    if (this.ctx?.activeTabPath !== undefined) {
      return tab.path === this.ctx.activeTabPath;
    }
    return this.isActive(tab.path);
  }

  heroAlign    = 'center';
  navMode: 'tabs' | 'sidenav' = 'tabs';
  showUserName = true;
  showLocation = true;
  showUpcoming = true;
  showStats    = true;
  creditLabel  = 'Ball';
  ballsBalance = 0;
  isAdmin      = false;

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
        { label: 'Categories',   path: '/ballpark-settings/categories' },
        { label: 'Marketplace',  path: '/ballpark-settings/marketplace' },
        { label: 'Orgs',         path: '/ballpark-settings/orgs' },
        { label: 'Early Access', path: '/ballpark-settings/early-access' }
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

  /** v1.22: open/close state for the user-pill dropdown. */
  userMenuOpen = false;

  /** v1.23f: lifted config-strip slot. Both fields are mirrored from
      ConfigStripService observables so we can drive the *ngIf without
      async-piping a TemplateRef (which Angular's template type-check
      doesn't unwrap cleanly). */
  stripTpl: TemplateRef<any> | null = null;
  stripOpen = false;

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private orgSvc: OrgService,
    private configService: ConfigService,
    private shellCtx: ShellContextService,
    private configStripSvc: ConfigStripService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  // ── v1.22 header pill interactions ────────────────────────────────

  onUserPillClick(event: MouseEvent) {
    event.stopPropagation();
    this.userMenuOpen = !this.userMenuOpen;
    this.cdr.detectChanges();
  }

  onLocationPillClick() {
    this.router.navigate(['/settings']);
  }

  onUserMenuAction(action: 'profile' | 'switch-org' | 'signout') {
    this.userMenuOpen = false;
    if (action === 'profile') {
      // Profile page doesn't exist yet — route to Settings as a stub
      // so the click does something useful rather than nothing.
      this.router.navigate(['/settings']);
    } else if (action === 'switch-org') {
      this.msg.add({
        severity: 'info',
        summary: 'Coming soon',
        detail: 'Multi-org switching not implemented yet.',
        life: 2500
      });
    } else if (action === 'signout') {
      this.msg.add({
        severity: 'info',
        summary: 'Auth not implemented',
        detail: 'Google SSO + sign-out land with the v2.0 milestone.',
        life: 2500
      });
    }
    this.cdr.detectChanges();
  }

  /** Close the user-pill dropdown on any outside click. Pill clicks
      stopPropagation, so toggling from the pill itself doesn't
      immediately close. */
  @HostListener('document:click')
  onDocumentClick() {
    if (this.userMenuOpen) {
      this.userMenuOpen = false;
      this.cdr.detectChanges();
    }
  }

  ngOnInit() {
    this.orgSvc.getCurrentOrg().subscribe(org => {
      if (org) {
        this.orgName      = org.name;
        this.orgCity      = (org as any).city || '';
        this.ballsBalance = org.balls_balance || 0;
        this.cdr.detectChanges();
      }
    });

    this.orgSvc.getUsers().subscribe((users: any[]) => {
      if (users?.length) {
        this.isAdmin  = users[0].role === 'admin';
        this.userName = users[0].name || '';
        this.userRole = users[0].role || '';
        this.cdr.detectChanges();
      }
    });

    this.syncFromConfig(this.configService.current as any);
    this.configService.config$.pipe(takeUntil(this.destroy$)).subscribe((config: any) => {
      this.syncFromConfig(config);
      this.cdr.detectChanges();
    });

    this.shellCtx.context$.pipe(takeUntil(this.destroy$)).subscribe(ctx => {
      this.ctx = ctx.heroTitle ? ctx : null;
      this.cdr.detectChanges();
    });

    // v1.23f: track the lifted config-strip slot. Pages that pushed
    // a TemplateRef render their strip here (above bp-shell-body);
    // pages still on the inline <app-config-strip> pattern leave
    // stripTpl null and this slot stays hidden.
    this.configStripSvc.template$.pipe(takeUntil(this.destroy$)).subscribe(tpl => {
      this.stripTpl = tpl;
      this.cdr.detectChanges();
    });
    this.configStripSvc.open$.pipe(takeUntil(this.destroy$)).subscribe(open => {
      this.stripOpen = open;
      this.cdr.detectChanges();
    });

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
  }

  static readonly FONT_PAIRINGS: Record<string, { display: string; body: string; label: string }> = {
    'playfair-franklin': { display: "'Playfair Display', serif",  body: "'Libre Franklin', sans-serif", label: 'Playfair Display + Libre Franklin' },
    'playfair-dm':       { display: "'Playfair Display', serif",  body: "'DM Sans', sans-serif",        label: 'Playfair Display + DM Sans' },
    'inter':             { display: "'Inter', sans-serif",        body: "'Inter', sans-serif",           label: 'Inter + Inter' },
    'fraunces-nunito':   { display: "'Fraunces', serif",          body: "'Nunito', sans-serif",          label: 'Fraunces + Nunito' },
  };

  private updateFromRoute() {
    this.isBallparkRoute = this.router.url.startsWith('/ballpark-settings');
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
        this.hideHero   = !!data['hideHero'];
      }
    }
  }

  navigate(path: string) { this.router.navigateByUrl(path); }

  isActive(path: string) {
    if (path === '/') return this.router.url === '/';
    return this.router.url.startsWith(path);
  }
}
