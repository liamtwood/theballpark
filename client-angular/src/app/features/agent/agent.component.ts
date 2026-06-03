/**
 * Agent dashboard — placeholder.
 *
 * Renders inside the app-shell hero (heroVariant='none' via route
 * data, see app.routes.ts) with a personalised welcome title pulled
 * from the active persona. Body is empty pending future content.
 */
import { Component, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { ShellContextService } from '../../core/services/shell-context.service';
import { PersonaService } from '../../core/services/persona.service';

@Component({
  selector: 'app-agent-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `<!-- empty body — the app-shell hero handles the header -->`,
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
