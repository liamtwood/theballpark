import { Component, OnInit, OnDestroy, HostBinding, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { OrgService } from '../../../core/services/org.service';
import { ConfigService } from '../../../core/services/config.service';

interface ShellTab { label: string; path: string; }
interface NavItem  { label: string; path: string; }
interface NavGroup { label: string; items: NavItem[]; adminOnly?: boolean; }

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  template: `
    <!-- HERO — always shown, tabs conditional on navMode -->
    <div class="bp-hero">
      <h1 class="bp-hero-org-name">{{ orgName }}</h1>
      <p class="bp-hero-page-label">{{ pageLabel }}</p>
      <div class="bp-hero-tabs" *ngIf="navMode === 'tabs' && tabs.length > 0">
        <button *ngFor="let tab of tabs"
          class="bp-hero-tab" [class.active]="isActive(tab.path)"
          (click)="navigate(tab.path)">
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- BODY — splits into sidenav + content when navMode === 'sidenav' -->
    <div class="bp-shell-body" [class.bp-shell-sidenav-mode]="navMode === 'sidenav'">

      <!-- SIDE NAV -->
      <nav class="bp-sidenav" *ngIf="navMode === 'sidenav'">

        <!-- Home -->
        <div class="bp-sidenav-home"
          [class.active]="isActive('/')"
          (click)="navigate('/')">
          <span class="bp-sidenav-org">{{ orgName }}</span>
        </div>

        <!-- Groups -->
        <ng-container *ngFor="let group of navGroups">
          <ng-container *ngIf="!group.adminOnly || isAdmin">
            <div class="bp-sidenav-group-label">{{ group.label }}</div>
            <div *ngFor="let item of group.items"
              class="bp-sidenav-item"
              [class.active]="isActive(item.path)"
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
    /* ── HOST ── */
    :host { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
    .bp-hero { flex-shrink: 0; }

    /* ── SHELL BODY ── */
    .bp-shell-body { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
    .bp-shell-body.bp-shell-sidenav-mode { flex-direction: row; }

    /* ── CONTENT AREA ── */
    .bp-shell-content { flex: 1; min-height: 0; overflow-y: auto; }

    /* ── SIDE NAV ── */
    .bp-sidenav {
      width: 200px;
      flex-shrink: 0;
      border-right: 0.5px solid var(--color-border);
      padding: 16px 0;
      overflow-y: auto;
      background: var(--color-surface);
    }

    /* Home / org name link */
    .bp-sidenav-home {
      padding: 10px 16px 14px;
      cursor: pointer;
      border-bottom: 0.5px solid var(--color-border);
      margin-bottom: 8px;
    }
    .bp-sidenav-org {
      font-family: var(--font-display);
      font-size: 15px;
      font-weight: 400;
      color: var(--color-text-primary);
      line-height: 1.2;
      display: block;
      transition: color 0.15s;
    }
    .bp-sidenav-home:hover .bp-sidenav-org { color: var(--theme-accent); }
    .bp-sidenav-home.active .bp-sidenav-org { color: var(--theme-accent); }

    /* Group label */
    .bp-sidenav-group-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      padding: 12px 16px 4px;
    }

    /* Nav item */
    .bp-sidenav-item {
      display: flex;
      align-items: center;
      padding: 7px 16px;
      font-size: 13px;
      font-weight: 400;
      color: var(--color-text-secondary);
      cursor: pointer;
      border-left: 2px solid transparent;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .bp-sidenav-item:hover {
      background: var(--theme-bg);
      color: var(--color-text-primary);
    }
    .bp-sidenav-item.active {
      background: var(--theme-bg);
      color: var(--theme-accent);
      font-weight: 500;
      border-left-color: var(--theme-accent);
    }
  `]
})
export class AppShellComponent implements OnInit, OnDestroy {
  orgName   = '';
  pageLabel = '';
  tabs: ShellTab[] = [];
  heroAlign = 'center';
  navMode: 'tabs' | 'sidenav' = 'tabs';
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
    return this.navMode === 'sidenav' ? 'left' : this.heroAlign;
  }

  @HostBinding('style.--hero-align-flex')
  get heroAlignFlex() {
    return (this.navMode === 'sidenav' || this.heroAlign === 'left') ? 'flex-start' : 'center';
  }

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private orgSvc: OrgService,
    private configService: ConfigService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Load org name and role
    this.orgSvc.getCurrentOrg().subscribe(org => {
      if (org) { this.orgName = org.name; this.cdr.detectChanges(); }
    });
    // TODO: v1.3 auth — replace stub with: this.orgSvc.getCurrentUser().subscribe(...)
    // this.isAdmin is stubbed to true above

    // Load config and subscribe to live changes
    this.syncFromConfig(this.configService.current as any);
    this.configService.config$.pipe(
      takeUntil(this.destroy$)
    ).subscribe((config: any) => {
      this.syncFromConfig(config);
      this.cdr.detectChanges();
    });

    // Update page label + tabs on navigation
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
    this.heroAlign = config?.heroAlign || 'center';
    this.navMode   = config?.navMode   || 'tabs';
  }

  private updateFromRoute() {
    let route = this.activatedRoute;
    while (route.firstChild) {
      route = route.firstChild;
      const data = route.snapshot.data;
      if (data['pageLabel'] !== undefined) {
        this.pageLabel = data['pageLabel'];
        this.tabs      = data['tabs'] || [];
      }
    }
  }

  navigate(path: string) { this.router.navigateByUrl(path); }
  isActive(path: string) {
    if (path === '/') return this.router.url === '/';
    return this.router.url.startsWith(path);
  }
}
