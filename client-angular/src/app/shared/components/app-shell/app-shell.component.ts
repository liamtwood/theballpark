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
import { HeroSettingsService } from '../../../core/services/hero-settings.service';
import { ShellContextService, ShellContext, ShellTab } from '../../../core/services/shell-context.service';
import { pagePatternKey } from '../../../core/utils/page-key';
import { PersonaService } from '../../../core/services/persona.service';
import { ConfigStripService } from '../../../core/services/config-strip.service';
// v1.65hJ (p0017): TemplateRef import dropped — lifted strip slot gone.
import {
  CreateProjectModalComponent
} from '../../../features/projects/components/create-project-modal/create-project-modal.component';
import {
  OutreachComposeComponent
} from '../outreach-compose/outreach-compose.component';
import {
  EstimateDrawerComponent
} from '../estimate-drawer/estimate-drawer.component';
import {
  AddCategoryDrawerComponent
} from '../add-category-drawer/add-category-drawer.component';
import {
  EventDrawerComponent
} from '../event-drawer/event-drawer.component';
import {
  CartDrawerComponent
} from '../cart-drawer/cart-drawer.component';
import {
  PageConfigDrawerComponent
} from '../page-config-drawer/page-config-drawer.component';

interface NavItem  { label: string; path: string; }
interface NavGroup { label: string; items: NavItem[]; adminOnly?: boolean; }

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, TitleCasePipe, TagModule, ToastModule, LucideAngularModule, RouterModule, RouterOutlet, CreateProjectModalComponent, OutreachComposeComponent, EstimateDrawerComponent, AddCategoryDrawerComponent, EventDrawerComponent, CartDrawerComponent, PageConfigDrawerComponent],
  providers: [MessageService],
  template: `
    <!-- HERO -->
    <!-- v1.65dh — heroVariant='calm' switches to the dashboard/settings
         treatment: parchment fill, no orbs/grain (even in Bold mode),
         calm underline tabs. -->
    <div class="bp-hero" *ngIf="!hideHero"
         [class.bp-hero--none]="heroIsNone"
         [class.bp-hero--left]="effectiveHeroAlign === 'left'">

      <!-- p0003 — BOLD MODE decoration. Two blurred orbs + feTurbulence
           grain overlay sit behind hero content. Always present in the
           DOM; styles.css hides them outside [data-mode="bold"] so
           light + dark heroes are untouched. Same recipe as
           welcome.component.ts. -->
      <svg class="bp-hero-orbs" viewBox="0 0 800 300"
           preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <filter id="bp-hero-orb-blur" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="55"/>
          </filter>
        </defs>
        <g filter="url(#bp-hero-orb-blur)">
          <circle cx="75" cy="40" r="165" fill="var(--theme-contrast)"/>
          <circle cx="755" cy="290" r="190" fill="var(--theme-contrast)"/>
        </g>
      </svg>
      <div class="bp-hero-grain" aria-hidden="true"></div>

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
      <!-- v1.66am — standardised pills: org / user / location are plain,
           non-interactive chips with one shared look. Account + persona
           actions live on the top-nav avatar, not the pills. -->
      <div *ngIf="orgPill || heroPills.length > 0 || upcomingPillText || projectPill" class="bp-hero-meta">
        <span *ngIf="orgPill" class="bp-hero-tag-span">{{ orgPill }}</span>
        <span *ngFor="let pill of heroPills" class="bp-hero-tag-span">
          <lucide-icon *ngIf="isLocationPill(pill)" name="map-pin" [size]="10" style="flex-shrink:0;"></lucide-icon>
          {{ pill }}
        </span>
        <span *ngIf="upcomingPillText" class="bp-hero-tag-span bp-hero-upcoming">
          <lucide-icon name="calendar" [size]="10" style="flex-shrink:0;"></lucide-icon>
          {{ upcomingPillText }}
        </span>
        <!-- Clickable "shopping for {project}" pill — opens the marketplace
             project picker (the page supplies onClick). -->
        <button *ngIf="projectPill as pp" type="button"
                class="bp-hero-tag-span bp-hero-project-pill" (click)="pp.onClick()">
          <lucide-icon name="folder" [size]="10" style="flex-shrink:0;"></lucide-icon>
          {{ pp.text }}
          <lucide-icon name="chevron-down" [size]="11" style="flex-shrink:0;"></lucide-icon>
        </button>
      </div>

      <!-- TITLE -->
      <h1 class="bp-hero-org-name">{{ heroTitle }}</h1>

      <!-- SUB -->
      <p class="bp-hero-page-label" [class.bp-hero-subtitle]="heroSubIsSentence">{{ heroSub }}</p>

      <!-- v1.65bh — TAB BAND moved BACK inside .bp-hero so it
           shares the hero's parchment (or accent in bold) fill. The
           band itself has no background — it inherits visually from
           its hero parent. Tabs are centred. -->
      <!-- v1.66ah — the tab band always renders in tabs mode (even with no
           tabs) so every hero reserves the same height + shows the
           separator; menu items fill it when present. -->
      <div class="bp-hero-tab-band"
           *ngIf="navMode === 'tabs'">
        <div class="bp-hero-tabs">
          <button *ngFor="let tab of activeTabs"
            class="bp-hero-tab"
            [class.active]="isTabActive(tab)"
            (click)="onTabClick(tab)">
            {{ tab.label }}
            <!-- v1.24: notification badge — only when tab.badge > 0. -->
            <span *ngIf="tab.badge && tab.badge > 0" class="bp-hero-tab-badge">{{ tab.badge }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- v1.65hJ (p0017): the lifted config-strip slot is gone. Pages
         that want a settings surface now mount <app-page-config-drawer>
         (a right-side p-sidebar) directly. The old inline
         <app-config-strip> content-projection wrapper (used by
         catalogue-grid) is unaffected — it still renders at its own
         host position via mountedCount/open$. -->

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

    <!-- v1.30: single shared "+ New project" intake modal. Every
         entry point in the app opens it via CreateProjectService.open(). -->
    <app-create-project-modal></app-create-project-modal>

    <!-- v1.50: single shared competitive-quote outreach drawer. Opened
         from the Brief tab, project marketplace and item detail via
         OutreachService.open(). -->
    <app-outreach-compose></app-outreach-compose>

    <!-- v1.64: single shared Estimate drawer. Opened from project home,
         Overview, Brief col-1 card and Marketplace via
         EstimateDrawerService.open(projectId). -->
    <app-estimate-drawer></app-estimate-drawer>

    <!-- v1.65b: single shared "Add category" drawer. Opened from the
         Plan tab and the project Marketplace via
         AddCategoryService.open(projectId, unusedCategories). -->
    <app-add-category-drawer></app-add-category-drawer>

    <!-- v1.65o: single shared Event drawer (project details + brief).
         Opened from Overview event strip, the project Marketplace
         summary panel, and any future surface via
         EventDrawerService.open(projectId, section?). -->
    <app-event-drawer></app-event-drawer>

    <!-- v1.65ab: single shared "Project Items" cart drawer. Opened from
         the project Marketplace cart icon via
         CartDrawerService.open(projectId). Shows selected + wishlist
         project_items with a description tooltip on hover. -->
    <app-cart-drawer></app-cart-drawer>

    <!-- v1.66at: page-settings drawer mounted globally so the cog +
         page settings are available on EVERY page (was dashboard-only,
         so the cog vanished on Inbox / Projects / etc.). -->
    <app-page-config-drawer></app-page-config-drawer>
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
      /* v1.65ds — z-index: 3 explicitly so the back link still sits
         above the orbs/grain. The .bp-hero direct-child layering
         rule below excludes .bp-hero-back (because that rule forces
         position:relative which clobbers our absolute positioning),
         so the back link needs to lift itself manually. */
      z-index: 3;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: none; border: none;
      cursor: pointer;
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 500;
      /* v1.65bs — back link on the accent-filled hero needs to be
         white for contrast. */
      color: var(--color-surface);
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

    /* v1.66ah — org / user / location pills share ONE look: white fill,
       a hairline border in the theme border colour. */
    :host ::ng-deep .bp-hero-tag.p-tag {
      background: #fff !important;
      color: var(--theme-text) !important;
      border: 1px solid var(--color-border) !important;
      font-size: 11px !important;
      font-weight: 500 !important;
      padding: 3px 12px !important;
      border-radius: 20px !important;
    }

    .bp-hero-tag-span {
      display: inline-flex; align-items: center; gap: 5px;
      background: #fff; color: var(--theme-text);
      border: 1px solid var(--color-border);
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
    /* Marketplace project pill — clickable chip that opens the picker. Accent
       tinted so it reads as the active "shopping for" context. */
    .bp-hero-project-pill {
      cursor: pointer;
      display: inline-flex; align-items: center; gap: 5px;
      border: 1px solid var(--theme-accent) !important;
      color: var(--theme-accent) !important;
      background: var(--theme-soft) !important;
      transition: background-color 100ms ease, border-color 150ms ease;
    }
    .bp-hero-project-pill:hover { background: var(--color-fill) !important; }
    .bp-hero-pill-btn:hover {
      border-color: var(--theme-accent) !important;
      background: var(--color-fill) !important;
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
    .bp-hero-pill-menu-item:hover { background: var(--color-fill); }
    .bp-hero-pill-menu-item--danger { color: var(--color-danger); }
    .bp-hero-pill-menu-item--danger:hover { background: rgba(225, 29, 72, 0.06); }
    .bp-hero-pill-menu-sep {
      height: 0.5px;
      background: var(--color-border);
      margin: 4px 0;
    }

    /* v1.22: hero band gets a hairline separator to mark the
       boundary between header and KPI strip / body.
       v1.65bb — hairline removed. Tabs now carry their own outline so
       a separator above them creates a double-line effect with the
       tab's top border. Hero + tab band share parchment fill, so
       removing the divider lets the tabs read as "stuck into" the
       hero region. */
    .bp-hero {
      position: relative;
    }

    /* p0003 — Bold-mode hero rules live in global styles.css (the
       [data-mode="bold"] attribute is set on document.documentElement,
       which is outside this component's scope). Hero stays
       position:relative here so the global rules' absolute-positioned
       orb / grain elements anchor correctly in light + dark modes too.

       v1.65ds — exclude .bp-hero-back from the layering rule. It needs
       to stay position:absolute (pinned to the left edge); the rule was
       force-overriding it to relative, dropping it into the centred
       flow of the hero. Z-index is set manually on .bp-hero-back so it
       still sits above orbs/grain. */
    .bp-hero-orbs,
    .bp-hero-grain { display: none; }
    .bp-hero > *:not(.bp-hero-orbs):not(.bp-hero-grain):not(.bp-hero-back) {
      position: relative;
      z-index: 3;
    }

    /* v1.24: notification badge on tabs. Red circle, white text,
       positioned inline after the tab label. Used by the project
       Messages tab when ShellTab.badge > 0. */
    .bp-hero-tab-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 16px;
      height: 16px;
      padding: 0 5px;
      margin-left: 6px;
      border-radius: var(--radius-pill);
      background: var(--color-danger);
      color: #fff;
      font-family: var(--font-body);
      font-size: 10px;
      font-weight: 600;
      line-height: 1;
      vertical-align: middle;
    }

    /* v1.65hJ (p0017): .bp-shell-config-strip chrome removed — the
       lifted slot it framed is gone now that the strip migrated into
       a right-side drawer. */

    /* ── SHELL BODY ── */
    .bp-shell-body { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
    .bp-shell-body.bp-shell-sidenav-mode { flex-direction: row; }
    /* v1.65an — paint the scroll viewport with the page ground so the empty
       area below the body doesn't reveal white.
       v1.66dn — was a :has() allow-list (catalogue / inbox / project only),
       which left settings, ballpark-settings, home, etc. on the bare white body
       and out of step with the parchment→off-white sweep. Promoted to a blanket
       default so EVERY page shares the one neutral ground; white cards/panels
       lift off it. --theme-bg is the off-white ground in light mode, the dark
       ground in dark mode. */
    .bp-shell-content { flex: 1; min-height: 0; overflow-y: auto; background: var(--color-page-ground); }

    /* ── SIDE NAV ── */
    .bp-sidenav { width: 200px; flex-shrink: 0; border-right: 0.5px solid var(--color-border); padding: 16px 0; overflow-y: auto; background: var(--color-surface); }
    .bp-sidenav-home { padding: 10px 16px 14px; cursor: pointer; border-bottom: 0.5px solid var(--color-border); margin-bottom: 8px; }
    .bp-sidenav-org { font-family: var(--font-display); font-size: 15px; font-weight: 400; color: var(--color-text-primary); line-height: 1.2; display: block; transition: color 0.15s; }
    .bp-sidenav-home:hover .bp-sidenav-org { color: var(--theme-accent); }
    .bp-sidenav-home.active .bp-sidenav-org { color: var(--theme-accent); }
    .bp-sidenav-group-label { font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-text-muted); padding: 12px 16px 4px; }
    .bp-sidenav-item { display: flex; align-items: center; padding: 7px 16px; font-size: 13px; font-weight: 400; color: var(--color-text-secondary); cursor: pointer; border-left: 2px solid transparent; transition: background 0.15s, color 0.15s, border-color 0.15s; }
    .bp-sidenav-item:hover { background: var(--color-fill); color: var(--color-text-primary); }
    .bp-sidenav-item.active { background: var(--color-fill); color: var(--theme-accent); font-weight: 500; border-left-color: var(--theme-accent); }
  `]
})
export class AppShellComponent implements OnInit, OnDestroy {
  orgName      = '';
  userName     = '';
  userRole     = '';
  orgCity      = '';
  platformName = 'The Ballpark';

  pageLabel    = '';
  /** v1.66s — optional route-data hero overrides. A route may set
      `data: { heroTitle, heroSub }` to drive the shell hero from a fixed
      page title/subtitle (e.g. the Profile/settings surface) instead of
      the orgName + pageLabel fallback. Empty = use the existing fallback
      chain. Always re-read per navigation so they don't leak between
      routes. */
  routeHeroTitle = '';
  routeHeroSub   = '';
  pageKey        = '';   // v1.66av — route path, key for per-page hero overrides
  hideHero     = false;
  /* v1.66ag — heroVariant (calm/none) removed. There is ONE hero object;
     the global ConfigService.heroColor decides accent vs stripped. Add a
     variant explicitly here only if a future surface truly needs one. */
  routeTabs: ShellTab[] = [];
  isBallparkRoute = false;

  ctx: ShellContext | null = null;

  get hasContext(): boolean   { return !!this.ctx?.heroTitle; }
  /** p0023 / p0032 — surfaces that opt in via ctx.useConfiguredTitle (the
      dashboard) drive the title from ConfigService.heroTitleMode;
      everywhere else it's the page-pushed heroTitle or the org / platform
      fallback. */
  get heroTitle(): string {
    return this.resolveTitle(this.effectiveTitleMode);
  }
  /** v1.66av — a per-page override (page settings) wins; else the
      dashboard's configured mode (useConfiguredTitle); else 'purpose'
      (the page's own name). */
  get effectiveTitleMode(): 'org' | 'user' | 'greeting' | 'purpose' {
    const override = this.configService.getPageSetting(this.pageKey).heroTitleMode;
    if (override) return override;
    if (this.ctx?.useConfiguredTitle) return this.heroTitleMode;
    return 'purpose';
  }
  private resolveTitle(mode: 'org' | 'user' | 'greeting' | 'purpose'): string {
    // Delegates the org / user / greeting / purpose logic to the shared
    // HeroSettingsService (One Definition — the launcher pages resolve titles
    // the same way). The shell supplies its own ctx-derived values:
    //   · org     = the org this PAGE represents (ctx.orgName wins when viewing
    //               another org, e.g. a supplier detail)
    //   · purpose = the page's own name (ctx / route heroTitle)
    return this.heroSettings.resolveTitle(mode, {
      orgName: this.ctx?.orgName || this.orgName || this.platformName,
      userName: this.personaSvc.active?.name || this.orgName,
      purpose: this.substituteLabels(this.ctx?.heroTitle || this.routeHeroTitle || (this.isBallparkRoute ? this.platformName : this.orgName)),
    });
  }
  /** p0032 — Hero color is now a GLOBAL ConfigService setting applied to
      every hero: 'none' = stripped parchment, 'theme' = accent fill. A
      route may still force the stripped treatment via heroVariant='none'
      (e.g. auth pages); the global 'none' no longer fights it. */
  get heroIsNone(): boolean {
    return this.heroColor === 'none';
  }
  /** v1.66ag — org/owner pill content. The org name moved out of the
      hero title into a pill; shown when ConfigService.showOrg is on. */
  get orgPill(): string | null {
    // v1.66aj — the org pill follows the ACTIVE account (persona), like
    // the user + location pills. Was showing the globally-loaded agency
    // org (getCurrentOrg) regardless of who's viewing, so a supplier
    // persona (Ryan / Rocket Food) wrongly read "Woodland Agency".
    // A page viewing another org (supplier detail) sets ctx.orgName, which
    // wins over the active persona's org so the pill names the VIEWED org.
    const name = this.ctx?.orgName || this.personaSvc.active?.orgName || this.orgName;
    return this.showOrg && name ? name : null;
  }
  get heroSub(): string {
    const override = this.configService.getPageSetting(this.pageKey).heroSub;
    return this.substituteLabels(override || this.ctx?.heroSub || this.routeHeroSub || this.pageLabel);
  }
  /** v1.66ag — route/ctx subtitles may use {event} / {events} tokens so a
      page subtitle tracks the configurable Events label (projectLabel). */
  private substituteLabels(s: string): string {
    if (!s) return s;
    const ev  = this.configService.projectLabel || 'Event';   // e.g. "Event"
    const evL = ev.toLowerCase();
    return s
      .replace(/\{Events\}/g, ev + 's')   // title case, plural  → "Events"
      .replace(/\{Event\}/g, ev)          // title case, singular
      .replace(/\{events\}/g, evL + 's')  // lower case, plural  → "events"
      .replace(/\{event\}/g, evL);
  }
  /** v1.66ad — a page-pushed / route subtitle is a real sentence (render
      sentence-case); a bare pageLabel is the legacy uppercase eyebrow. */
  get heroSubIsSentence(): boolean { return !!(this.ctx?.heroSub || this.routeHeroSub); }
  get heroPills(): string[]   {
    if (this.ctx?.pills?.length) return this.ctx.pills;
    const pills: string[] = [];
    // v1.65e2 (p0015) — prefer the active persona's name + role over
    // the legacy users[0] lookup. Persona is the source of truth for
    // who is "viewing" — in dev/admin sessions it swaps via the
    // switcher dropdown; in production it reflects the real user.
    // The legacy userName / userRole pathway stays as a fallback for
    // any code path that runs before PersonaService initialises.
    if (this.showUserName) {
      const p = this.personaSvc.active;
      if (p) {
        pills.push(p.role ? `${p.name} · ${p.role}` : p.name);
      } else if (this.userName) {
        const role = this.userRole
          ? this.userRole.charAt(0).toUpperCase() + this.userRole.slice(1)
          : '';
        pills.push(role ? `${this.userName} · ${role}` : this.userName);
      }
    }
    // v1.65e2 — location pill prefers persona.location (lets each
    // persona carry its own city; Beth admin has no city, so the
    // pill simply hides for her). Falls back to orgCity for legacy.
    if (this.showLocation) {
      const personaLoc = this.personaSvc.active?.location;
      const loc = personaLoc || this.orgCity;
      if (loc) pills.push(loc);
    }
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

  /** Clickable marketplace "shopping for {project}" pill, or null. */
  get projectPill(): { text: string; onClick: () => void } | null {
    return this.ctx?.projectPill || null;
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
  /** p0023 — hero title source, synced from ConfigService. Read by the
      heroTitle getter on home / agent surfaces. */
  heroTitleMode: 'org' | 'user' | 'greeting' | 'purpose' = 'greeting';
  /** p0032 — global hero strip treatment, synced from ConfigService.
      Drives heroIsNone for every hero in the app. */
  heroColor: 'theme' | 'none' = 'none';
  showUserName = true;
  showLocation = true;
  showOrg      = true;   // v1.66ag — org/owner pill toggle (global)
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

  /** v1.66ay — alignment is per-page: a page override (page settings)
      wins over the global heroAlign. Drives the title, subtitle, pills
      and the tab band. */
  get effectiveHeroAlign(): 'left' | 'center' {
    // A page may push a transient align override (e.g. the marketplace forces
    // 'left' when categories are in the left rail) — it wins over the saved
    // per-page setting + the global default.
    return (this.ctx?.heroAlign as 'left' | 'center')
      || this.configService.getPageSetting(this.pageKey).heroAlign
      || (this.heroAlign as 'left' | 'center');
  }

  @HostBinding('style.--hero-align')
  get heroAlignVar() {
    const val = this.navMode === 'sidenav' ? 'left' : this.effectiveHeroAlign;
    document.documentElement.style.setProperty('--hero-align', val);
    // v1.66bg — mirror align as an attribute so page bodies (outside the
    // hero) can anchor their content to the separator's left edge too.
    document.documentElement.setAttribute('data-hero-align', val);
    return val;
  }

  @HostBinding('style.--hero-sep-width')
  get heroSepWidthVar() {
    const val = `${this.configService.separatorWidth ?? 100}%`;
    document.documentElement.style.setProperty('--hero-sep-width', val);
    return val;
  }

  /** Extra left inset for the left-aligned hero content (pushed by a page,
      e.g. the marketplace's Left categories mode). Default 0px. */
  @HostBinding('style.--hero-extra-left')
  get heroExtraLeftVar() {
    return this.ctx?.heroExtraLeft || '0px';
  }

  @HostBinding('style.--hero-align-flex')
  get heroAlignFlex() {
    const val = (this.navMode === 'sidenav' || this.effectiveHeroAlign === 'left') ? 'flex-start' : 'center';
    document.documentElement.style.setProperty('--hero-align-flex', val);
    return val;
  }

  private destroy$ = new Subject<void>();

  /** v1.22: open/close state for the user-pill dropdown. */
  userMenuOpen = false;

  // v1.65hJ (p0017): stripTpl + stripOpen fields removed — the
  // lifted-slot pattern they served is gone now that the strip
  // migrated to a right-side drawer. ConfigStripService still drives
  // the cog visibility via hasConfig$ / open$.

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private orgSvc: OrgService,
    private configService: ConfigService,
    private shellCtx: ShellContextService,
    private configStripSvc: ConfigStripService,
    private msg: MessageService,
    public  personaSvc: PersonaService,
    private heroSettings: HeroSettingsService,
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
      // v1.35a: keep ctx alive when only `back` is set so pages that just
      // need a Back button (e.g. /settings via data.back) don't have to
      // also push a heroTitle. Title/sub still fall back to route data.
      // p0032 — keep ctx alive when the surface opts into the configured
      // title (the dashboard pushes useConfiguredTitle without a heroTitle).
      this.ctx = (ctx.heroTitle || ctx.orgName || ctx.heroAlign || ctx.back || ctx.useConfiguredTitle || ctx.tabs?.length || ctx.onTabClick) ? ctx : null;
      this.cdr.detectChanges();
    });

    // v1.65e2 (p0015) — re-render the hero pills whenever the active
    // persona flips. heroPills getter reads PersonaService.active, so
    // the change detection cycle picks up the new name/role/location
    // without any direct binding.
    this.personaSvc.active$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.cdr.detectChanges();
    });

    // v1.65hJ (p0017): template$/open$ subscriptions removed — the
    // drawer owns its own visibility binding now.

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
    this.showOrg      = config?.showOrg      !== false;
    this.showUpcoming = config?.showUpcoming !== false;
    this.showStats    = config?.showStats    !== false;
    this.creditLabel  = config?.creditLabel  || 'Ball';
    this.platformName = config?.platformName || 'The Ballpark';
    this.heroTitleMode = config?.heroTitleMode || 'greeting';
    this.heroColor     = config?.heroColor     === 'theme' ? 'theme' : 'none';

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
    // v1.68k — one system font app-wide: display === body, the system-UI sans
    // stack (Tailwind font-sans default). No web-font load needed.
    'system':            { display: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', body: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', label: 'System Sans' },
  };

  private updateFromRoute() {
    this.isBallparkRoute = this.router.url.startsWith('/ballpark-settings');
    // Per-page key from the route PATTERN (e.g. /suppliers/:id) so param
    // routes share one settings entry instead of one per concrete id.
    this.pageKey = pagePatternKey(this.router);
    if (!this.router.url.includes('/projects/')) {
      this.shellCtx.reset();
    }
    let route = this.activatedRoute;
    let routeBack: string | null = null;
    while (route.firstChild) {
      route = route.firstChild;
      const data = route.snapshot.data;
      if (data['pageLabel'] !== undefined) {
        this.pageLabel  = data['pageLabel'];
        this.routeTabs  = data['tabs'] || [];
        this.hideHero   = !!data['hideHero'];
        // v1.66s — optional fixed hero title/subtitle from route data.
        // Re-read every navigation (default '') so they don't leak.
        this.routeHeroTitle = data['heroTitle'] || '';
        this.routeHeroSub   = data['heroSub']   || '';
      }
      // v1.35a: any level in the active route tree may set
      // `data: { back: '/somewhere' }` to opt into the standard hero
      // back button. Deepest wins so child tabs can override parents.
      if (typeof data['back'] === 'string') routeBack = data['back'];
    }
    if (routeBack) {
      const target = routeBack;
      this.shellCtx.set({ back: { label: 'Back', onBack: () => this.router.navigateByUrl(target) } });
    }
  }

  navigate(path: string) { this.router.navigateByUrl(path); }

  isActive(path: string) {
    if (path === '/') return this.router.url === '/';
    return this.router.url.startsWith(path);
  }
}
