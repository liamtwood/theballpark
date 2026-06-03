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
import { Subject, takeUntil } from 'rxjs';
import { ShellContextService } from '../../core/services/shell-context.service';
import { PersonaService } from '../../core/services/persona.service';
import { CreateProjectService } from '../../core/services/create-project.service';
import { ConfigService } from '../../core/services/config.service';
import { PageConfigDrawerComponent } from '../../shared/components/page-config-drawer/page-config-drawer.component';
import { ActionTileComponent } from '../../shared/components/action-tile/action-tile.component';

@Component({
  selector: 'app-agent-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, PageConfigDrawerComponent, ActionTileComponent],
  template: `
    <!-- v1.65hJ (p0017) — shared page-settings drawer. Mounting this
         component registers with ConfigStripService for the lifetime
         of the page so the top-nav cog appears; the drawer itself is
         a right-side p-sidebar, not a horizontal strip. -->
    <app-page-config-drawer></app-page-config-drawer>

    <div class="bp-agent-page">
      <div class="bp-agent-cards">
        <!-- v1.65hP (p0019 §1) — the agent card shape is now the shared
             <app-action-tile>. Title binds to ConfigService.projectLabel
             ("New Event" / "New Project") via the projectLabel mirror.
             p0019 §3 expands this to the full 5-tile launcher set. -->
        <app-action-tile
          icon="folder"
          title="New {{ projectLabel }}"
          [subtitle]="'Start a new ' + projectLabel.toLowerCase() + ' from scratch'"
          ariaLabel="Start a new project"
          (action)="openNewProject()">
        </app-action-tile>
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
    /* v1.65hP (p0019 §1) — the card chrome (.bp-agent-card*) moved to
       <app-action-tile>. Only the page + grid layout live here now. */
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
