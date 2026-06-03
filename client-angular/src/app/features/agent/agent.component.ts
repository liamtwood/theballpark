/**
 * Agent dashboard — placeholder.
 *
 * Renders inside the app-shell hero (heroVariant='none' via route
 * data, see app.routes.ts) with a personalised welcome title pulled
 * from the active persona. Body is empty pending future content.
 */
import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, ViewChild, TemplateRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { LucideAngularModule } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { ShellContextService } from '../../core/services/shell-context.service';
import { PersonaService } from '../../core/services/persona.service';
import { CreateProjectService } from '../../core/services/create-project.service';
import { ConfigStripService } from '../../core/services/config-strip.service';
import { ConfigService } from '../../core/services/config.service';

@Component({
  selector: 'app-agent-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, LucideAngularModule, InputTextModule],
  template: `
    <!-- v1.65hC  — config-strip template registered with
         ConfigStripService so the cog renders on agent.
         v1.65hD — mirrors the dashboard's strip exactly (per client
         request: "same as home exactly"). Both pages bind to the
         shared ConfigService singleton, so changes on either page
         propagate to the other and to the rest of the app. -->
    <ng-template #agentConfigStrip>
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

        <!-- Theme dot swatches -->
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

        <!-- Components — multi-toggle pills -->
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

        <!-- Align — left vs centre -->
        <span class="bp-cfg-lab">ALIGN</span>
        <div class="bp-cfg-seg">
          <button *ngFor="let opt of alignOptions"
                  type="button"
                  class="bp-cfg-seg-btn"
                  [class.p-highlight]="settingsDraft.heroAlign === opt.value"
                  (click)="selectHeroAlign(opt.value)">
            {{ opt.label }}
          </button>
        </div>
        <span class="bp-cfg-divider"></span>

        <!-- Nav — tabs vs menu -->
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
    </ng-template>

    <div class="bp-agent-page">
      <div class="bp-agent-cards">
        <!-- v1.65h3  — first scaffolded card. Rectangle with rounded
             corners + drop shadow; icon in a small rounded square at
             the top-left; title + subtitle stacked beside it. Will
             clone this layout for the rest of the agent surfaces.
             v1.65h5 — wired to CreateProjectService.open() so clicking
             the card opens the shared "+ New project" intake modal
             that's already mounted in the app-shell. -->
        <button type="button"
                class="bp-agent-card"
                (click)="openNewProject()"
                aria-label="Start a new project">
          <div class="bp-agent-card-icon">
            <lucide-icon name="folder" [size]="20"></lucide-icon>
          </div>
          <div class="bp-agent-card-body">
            <h3 class="bp-agent-card-title">New Project</h3>
            <p class="bp-agent-card-sub">Start a new event from scratch</p>
          </div>
        </button>
      </div>
    </div>
  `,
  styles: [`
    /* v1.65hA — page background uses the theme's light parchment
       (--theme-bg) so the page picks up whichever theme preset is
       active (amber / etc.). min-height covers the visible content
       area so the colour fills below short content. */
    .bp-agent-page {
      padding: 24px var(--section-pad, 28px) 48px;
      background: var(--theme-bg);
      min-height: 100%;
    }
    /* v1.65h7 — cards capped at 280px wide and the grid centres
       horizontally on the page. As more cards land they'll wrap into
       further centred columns; with a single card the result is one
       narrow card in the middle of the page.
       v1.65h9 — card width bumped 280 -> 350 (~25%). */
    .bp-agent-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 350px));
      gap: 16px;
      justify-content: center;
      margin: 0 auto;
      max-width: 1100px;
    }

    /* v1.65h4  — aligned with WORKING_STANDARDS conventions:
        · --color-surface fill + var(--border-hairline) + --radius-card
        · --shadow-md drop kept as the agent-page deviation per the
          client's call ("we may change the standard"). The canonical
          two-tier rule uses --shadow-xs; this page is the one place
          the heavier drop is intentional.
        · title: Playfair Display, --color-text-primary
        · subtitle: Libre Franklin (--font-body) explicit
        · icon bg: --theme-soft token instead of inline color-mix
       v1.65h5 — card is now a <button> so it's keyboard-focusable +
       fires on Enter/Space. text-align: left so the title/sub still
       read left-aligned despite the default button center-align;
       width: 100% so the button fills its grid cell. */
    /* v1.65h6  — icon stacked ABOVE the title (flex-direction:
       column) and min-height doubled to ~160px per client review.
       v1.65h9 — min-height + padding bumped ~25%; border-radius
       overridden from --radius-card (12) to 20px for a softer,
       more rounded card silhouette. */
    .bp-agent-card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 14px;
      padding: 26px;
      min-height: 200px;
      width: 100%;
      text-align: left;
      font: inherit;
      cursor: pointer;
      background: var(--color-surface);
      border: var(--border-hairline);
      border-radius: 20px;
      box-shadow: var(--shadow-md);
      transition: box-shadow 0.18s, transform 0.18s;
    }
    .bp-agent-card:hover {
      box-shadow: var(--shadow-lg);
      transform: translateY(-1px);
    }
    .bp-agent-card:active {
      transform: translateY(0);
    }
    .bp-agent-card:focus-visible {
      outline: 2px solid var(--theme-accent);
      outline-offset: 2px;
    }

    /* v1.65h9 — icon container softened too: corners 8 -> 14px to
       echo the card's larger 20px corners. */
    .bp-agent-card-icon {
      flex-shrink: 0;
      width: 40px; height: 40px;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 14px;
      background: var(--theme-soft);
      color: var(--theme-accent);
    }

    .bp-agent-card-body {
      min-width: 0;
      flex: 1;
    }
    .bp-agent-card-title {
      margin: 0 0 4px 0;
      font-family: var(--font-display);   /* Playfair Display */
      font-size: 18px;
      font-weight: 400;
      color: var(--color-text-primary);
      line-height: 1.2;
    }
    .bp-agent-card-sub {
      margin: 0;
      font-family: var(--font-body);      /* Libre Franklin */
      font-size: 13px;
      color: var(--color-text-secondary);
      line-height: 1.4;
    }

    /* v1.65hD — strip placeholder styles removed; the .bp-cfg-row /
       .bp-cfg-lab / .bp-cfg-seg / .bp-cfg-swatch-btn classes come
       from global styles.css and are shared with the dashboard
       strip, so the agent strip renders identically. */
  `]
})
export class AgentDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();

  /** v1.65hC — template handed to ConfigStripService so the top-nav
      cog enables on this page. AppShell renders this in its lifted
      slot when the user toggles the cog open. */
  @ViewChild('agentConfigStrip') configStripTpl?: TemplateRef<any>;

  /** v1.65hD — duplicated from dashboard.component.ts so the strip
      mirrors home exactly. State syncs both directions with
      ConfigService (singleton), so toggling on either page is
      reflected on the other and across the whole app. */
  settingsDraft = {
    homePageLabel: 'Projects',
    creditLabel: 'Ball',
    projectLabel: 'Event',
    themeName: 'amber',
    heroAlign: 'center' as 'left' | 'center',
    navMode: 'tabs' as 'tabs' | 'sidenav',
    showUserName: true,
    showLocation: true,
    showUpcoming: false,
    showStats: true,
  };

  readonly themeOptions = [
    { value: 'amber',   label: 'Amber',   color: '#D97706' },
    { value: 'emerald', label: 'Emerald', color: '#00B84A' },
    { value: 'pink',    label: 'Pink',    color: '#FF0066' },
    { value: 'ocean',   label: 'Ocean',   color: '#2563EB' },
    { value: 'slate',   label: 'Slate',   color: '#64748B' },
  ];

  readonly componentOptions: Array<{ value: string; label: string; disabled?: boolean }> = [
    { value: 'user',     label: 'User' },
    { value: 'location', label: 'Location' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'stats',    label: 'Stats' },
  ];

  readonly alignOptions: Array<{ value: 'left' | 'center'; label: string }> = [
    { value: 'left',   label: 'Left' },
    { value: 'center', label: 'Centre' },
  ];

  readonly navOptions: Array<{ value: 'tabs' | 'sidenav'; label: string }> = [
    { value: 'tabs',    label: 'Tabs' },
    { value: 'sidenav', label: 'Menu' },
  ];

  constructor(
    private shellCtx: ShellContextService,
    private personaSvc: PersonaService,
    private createProjectSvc: CreateProjectService,
    private configStrip: ConfigStripService,
    private configService: ConfigService,
    private cdr: ChangeDetectorRef,
  ) {}

  /** v1.65h5 — opens the shared "+ New project" intake modal that's
      mounted in app-shell (see app-create-project-modal). Same entry
      point as the +button in top-nav. */
  openNewProject() {
    this.createProjectSvc.open();
  }

  ngAfterViewInit() {
    // Register the template AFTER the view inits so @ViewChild is
    // bound. ConfigStripService.setTemplate() also flips hasConfig$
    // true, which is what the top-nav cog watches.
    if (this.configStripTpl) {
      this.configStrip.setTemplate(this.configStripTpl);
    }
  }

  ngOnInit() {
    // v1.65h2  — title pulls the active persona's first name. Also
    // re-renders when the persona switches (dev/admin sessions can
    // swap via the avatar dropdown) so the welcome stays current.
    // v1.65h8 — defer the initial applyHero() via setTimeout(0) so
    // it lands AFTER app-shell's NavigationEnd handler calls
    // shellCtx.reset(). Without this, the reset clobbers our
    // heroTitle and the hero falls back to the org name.
    setTimeout(() => this.applyHero(), 0);
    this.personaSvc.active$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.applyHero());

    // v1.65hD — sync the settings-strip draft with ConfigService. Pages
    // share the singleton so toggling on agent updates dashboard and
    // vice-versa.
    this.configService.config$
      .pipe(takeUntil(this.destroy$))
      .subscribe(cfg => {
        this.settingsDraft = {
          homePageLabel: cfg.homePageLabel || 'Projects',
          creditLabel:   cfg.creditLabel   || 'Ball',
          projectLabel:  cfg.projectLabel  || 'Event',
          themeName:     cfg.themeName     || 'amber',
          heroAlign:     (cfg.heroAlign === 'left' ? 'left' : 'center'),
          navMode:       (cfg.navMode === 'sidenav' ? 'sidenav' : 'tabs'),
          showUserName:  cfg.showUserName  !== false,
          showLocation:  cfg.showLocation  !== false,
          showUpcoming:  cfg.showUpcoming  === true,
          showStats:     cfg.showStats     !== false,
        };
        this.cdr.detectChanges();
      });
  }

  // ── Settings-strip handlers ────────────────────────────────────
  // Duplicated from dashboard.component.ts. Each writes to
  // ConfigService which re-emits config$; the subscription above
  // syncs settingsDraft back so the strip reflects the new value.

  saveLabels() {
    this.configService.update({
      homePageLabel: this.settingsDraft.homePageLabel || 'Projects',
      creditLabel:   this.settingsDraft.creditLabel   || 'Ball',
      projectLabel:  this.settingsDraft.projectLabel  || 'Event',
    });
  }
  onThemeChange(theme: string) {
    this.settingsDraft.themeName = theme;
    this.configService.update({ themeName: theme });
  }
  selectNavMode(mode: 'tabs' | 'sidenav') {
    this.settingsDraft.navMode = mode;
    this.configService.update({ navMode: mode });
  }
  selectHeroAlign(align: 'left' | 'center') {
    this.settingsDraft.heroAlign = align;
    this.configService.update({ heroAlign: align });
  }
  saveToggles() {
    this.configService.update({
      showUserName: this.settingsDraft.showUserName,
      showLocation: this.settingsDraft.showLocation,
      showUpcoming: this.settingsDraft.showUpcoming,
      showStats:    this.settingsDraft.showStats,
    });
  }
  isComponentActive(key: string): boolean {
    switch (key) {
      case 'user':     return this.settingsDraft.showUserName;
      case 'location': return this.settingsDraft.showLocation;
      case 'upcoming': return this.settingsDraft.showUpcoming;
      case 'stats':    return this.settingsDraft.showStats;
      default:         return false;
    }
  }
  toggleComponent(key: string) {
    switch (key) {
      case 'user':     this.settingsDraft.showUserName = !this.settingsDraft.showUserName; break;
      case 'location': this.settingsDraft.showLocation = !this.settingsDraft.showLocation; break;
      case 'upcoming': this.settingsDraft.showUpcoming = !this.settingsDraft.showUpcoming; break;
      case 'stats':    this.settingsDraft.showStats    = !this.settingsDraft.showStats;    break;
      default: return;
    }
    this.saveToggles();
  }

  ngOnDestroy() {
    // Clear the config-strip template so the cog disappears when the
    // user navigates off /agent. AppShell's lifted slot reads from
    // ConfigStripService.template$ so this fully unmounts.
    this.configStrip.setTemplate(null);
    this.destroy$.next();
    this.destroy$.complete();
  }

  private applyHero() {
    const fullName = this.personaSvc.active?.name?.trim() || '';
    const firstName = fullName.split(/\s+/)[0] || 'there';
    this.shellCtx.set({
      heroTitle: `Welcome back, ${firstName}`,
      heroSub: 'What event are we working on today?',
      pills: [],
      tabs: [],
      showStats: false,
    });
  }
}
