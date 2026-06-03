/**
 * Agent dashboard — placeholder.
 *
 * Renders inside the app-shell hero (heroVariant='none' via route
 * data, see app.routes.ts) with a personalised welcome title pulled
 * from the active persona. Body shows a "New {event}" card that opens
 * the shared create-project modal; more cards will land here as the
 * agent surface grows.
 *
 * v1.65hG (p0016 Step 2): the page-config strip is no longer
 * duplicated here. Mounting <app-page-config-drawer /> registers the
 * shared strip template + cog with ConfigStripService for the life
 * of the page, then tears it down on ngOnDestroy automatically.
 */
import {
  Component, ChangeDetectionStrategy, OnInit, OnDestroy,
  AfterViewInit, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { ShellContextService } from '../../core/services/shell-context.service';
import { PersonaService } from '../../core/services/persona.service';
import { CreateProjectService } from '../../core/services/create-project.service';
import { ConfigService } from '../../core/services/config.service';
import { PageConfigDrawerComponent } from '../../shared/components/page-config-drawer/page-config-drawer.component';

@Component({
  selector: 'app-agent-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule, PageConfigDrawerComponent],
  template: `
    <!-- v1.65hJ (p0017) — shared page-settings drawer. Mounting this
         component registers with ConfigStripService for the lifetime
         of the page so the top-nav cog appears; the drawer itself is
         a right-side p-sidebar, not a horizontal strip. -->
    <app-page-config-drawer></app-page-config-drawer>

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
            <!-- v1.65hE — title binds to ConfigService.projectLabel
                 ("Event" / "Project" / whatever the strip's EVENTS
                 label is set to), so "New Event" or "New Project".
                 v1.65hG (p0016 Step 2): reads from the local
                 projectLabel mirror (one-way from ConfigService) now
                 that settingsDraft has been removed. -->
            <h3 class="bp-agent-card-title">New {{ projectLabel }}</h3>
            <p class="bp-agent-card-sub">Start a new {{ projectLabel.toLowerCase() }} from scratch</p>
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
       width: 100% so the button fills its grid cell.
       v1.65h6  — icon stacked ABOVE the title (flex-direction:
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
  `],
})
export class AgentDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();

  /** v1.65hG (p0016 Step 2): slim read-only mirror of just the
      ConfigService field this page reads (card title binding). The
      full strip draft + handlers live in <app-page-config-drawer>. */
  projectLabel = 'Event';

  constructor(
    private shellCtx: ShellContextService,
    private personaSvc: PersonaService,
    private createProjectSvc: CreateProjectService,
    private configService: ConfigService,
    private cdr: ChangeDetectorRef,
  ) {}

  /** v1.65h5 — opens the shared "+ New project" intake modal that's
      mounted in app-shell (see app-create-project-modal). Same entry
      point as the + button in top-nav. */
  openNewProject() {
    this.createProjectSvc.open();
  }

  ngAfterViewInit() {
    // v1.65hG (p0016 Step 2): no more ViewChild registration here —
    // <app-page-config-drawer> handles its own template lifecycle.
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

    // v1.65hG (p0016 Step 2): keep a one-way mirror of projectLabel
    // for the card title. Writes happen in <app-page-config-drawer>;
    // we just listen so the card relabels when the user types into
    // the strip's EVENTS field.
    this.configService.config$
      .pipe(takeUntil(this.destroy$))
      .subscribe(cfg => {
        this.projectLabel = cfg.projectLabel || 'Event';
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy() {
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
