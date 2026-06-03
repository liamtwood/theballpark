/**
 * Agent dashboard — placeholder.
 *
 * Renders inside the app-shell hero (heroVariant='none' via route
 * data, see app.routes.ts) with a personalised welcome title pulled
 * from the active persona. Body is empty pending future content.
 */
import { Component, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { Subject, takeUntil } from 'rxjs';
import { ShellContextService } from '../../core/services/shell-context.service';
import { PersonaService } from '../../core/services/persona.service';

@Component({
  selector: 'app-agent-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="bp-agent-page">
      <div class="bp-agent-cards">
        <!-- v1.65h3 — first scaffolded card. Rectangle with rounded
             corners + drop shadow; icon in a small rounded square at
             the top-left; title + subtitle stacked beside it. Will
             clone this layout for the rest of the agent surfaces. -->
        <div class="bp-agent-card">
          <div class="bp-agent-card-icon">
            <lucide-icon name="folder" [size]="20"></lucide-icon>
          </div>
          <div class="bp-agent-card-body">
            <h3 class="bp-agent-card-title">Folder</h3>
            <p class="bp-agent-card-sub">A description of this folder</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bp-agent-page {
      padding: 24px var(--section-pad, 28px) 48px;
    }
    .bp-agent-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
      max-width: 1100px;
    }

    /* v1.65h4 — aligned with WORKING_STANDARDS conventions:
        · --color-surface fill + var(--border-hairline) + --radius-card
        · --shadow-md drop kept as the agent-page deviation per the
          client's call ("we may change the standard"). The canonical
          two-tier rule uses --shadow-xs; this page is the one place
          the heavier drop is intentional.
        · title: Playfair Display, --color-text-primary
        · subtitle: Libre Franklin (--font-body) explicit
        · icon bg: --theme-soft token instead of inline color-mix */
    .bp-agent-card {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 18px;
      background: var(--color-surface);
      border: var(--border-hairline);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-md);
    }

    .bp-agent-card-icon {
      flex-shrink: 0;
      width: 40px; height: 40px;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 8px;
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
  `]
})
export class AgentDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(
    private shellCtx: ShellContextService,
    private personaSvc: PersonaService,
  ) {}

  ngOnInit() {
    // v1.65h2 — title pulls the active persona's first name. Also
    // re-renders when the persona switches (dev/admin sessions can
    // swap via the avatar dropdown) so the welcome stays current.
    this.applyHero();
    this.personaSvc.active$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.applyHero());
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
