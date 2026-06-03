/**
 * Agent dashboard — placeholder.
 *
 * Initial scaffold: renders inside the app-shell hero (title pushed
 * via ShellContextService) with no content of its own yet. Future
 * work will fill this in with agent-specific surfaces.
 */
import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShellContextService } from '../../core/services/shell-context.service';

@Component({
  selector: 'app-agent-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `<!-- empty body — the app-shell hero handles the header -->`,
})
export class AgentDashboardComponent implements OnInit {

  constructor(private shellCtx: ShellContextService) {}

  ngOnInit() {
    // Push a hero title so the header reads as "Agent" rather than
    // inheriting the previous page's title. Each navigation invokes
    // shellCtx.set() with its own context (or app-shell resets via
    // route data on navigation end), so a teardown isn't required.
    this.shellCtx.set({
      heroTitle: 'Agent',
      heroSub: '',
      pills: [],
      tabs: [],
      showStats: false,
    });
  }
}
