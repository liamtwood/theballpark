/**
 * v1.66l (p0015 close-out) — canonical /inbox page.
 *
 * One route, one component, both viewers: the shared
 * MessagesInboxComponent renders the agency- or supplier-side variant
 * based on the active persona (kind). Replaces the two thin wrappers
 * GlobalMessagesComponent (/messages, agency) and SupplierInboxComponent
 * (/inbox, supplier) — /messages now redirects here.
 *
 * Object naming locked: Org / Projects / Inbox / Marketplace — the
 * route matches the object, hence /inbox is canonical (not /messages).
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { OrgService } from '../../core/services/org.service';
import { ProjectService } from '../../core/services/project.service';
import { ShellContextService } from '../../core/services/shell-context.service';
import { PersonaService } from '../../core/services/persona.service';
import { MessagesInboxComponent } from '../../shared/components/messages-inbox/messages-inbox.component';

@Component({
  selector: 'app-inbox',
  standalone: true,
  imports: [CommonModule, MessagesInboxComponent],
  template: `
    <app-messages-inbox
      [viewer]="viewer"
      [showProjectSelector]="viewer === 'agency'"
      [boundProjectId]="preselectedProjectId">
    </app-messages-inbox>
  `
})
export class InboxComponent implements OnInit, OnDestroy {
  viewer: 'agency' | 'supplier' = 'agency';
  preselectedProjectId = '';

  constructor(
    private route: ActivatedRoute,
    private orgSvc: OrgService,
    private projectSvc: ProjectService,
    private shellCtx: ShellContextService,
    private personaSvc: PersonaService,
  ) {}

  ngOnInit() {
    // Hero Back → Home is wired via route data `back: '/home'` (app-shell
    // reads it in updateFromRoute; setting shellCtx here would be reset on
    // NavigationEnd).

    // Viewer follows the active persona — supplier persona sees the
    // supplier-side variant of every divergent slot; everyone else
    // (agency / admin) sees the agency variant.
    const persona = this.personaSvc.active;
    this.viewer = persona?.kind === 'supplier' ? 'supplier' : 'agency';

    if (this.viewer === 'supplier') return;

    // Agency: optional ?projectId binds the inbox to one project (used
    // when navigating from a project surface). v1.66ag — the hero
    // (title "Inbox" + subtitle) now comes from route data, so we no
    // longer fetch the org/project just to set a title.
    this.preselectedProjectId = this.route.snapshot.queryParams['projectId'] || '';
  }

  ngOnDestroy() { this.shellCtx.reset(); }
}
