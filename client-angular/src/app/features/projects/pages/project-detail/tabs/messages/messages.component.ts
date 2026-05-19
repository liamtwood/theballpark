import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MessagesInboxComponent } from '../../../../../../shared/components/messages-inbox/messages-inbox.component';

/**
 * Project Messages tab — thin wrapper around the shared messages inbox.
 *
 * v1.26: the tab bar / hero are owned entirely by the parent
 * ProjectDetailComponent (via ShellContextService). This tab no longer
 * overrides shell context — that override was wiping `tabs: []` and
 * hiding the project tab bar on /messages. boundProjectId still flows
 * through so the inbox auto-selects this project and hides its global
 * project selector dropdown.
 */
@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, MessagesInboxComponent],
  template: `
    <h2 class="bp-page-title">Messages</h2>
    <app-messages-inbox [boundProjectId]="pid"></app-messages-inbox>
  `
})
export class MessagesComponent implements OnInit {
  pid = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    const match = this.router.url.match(/\/projects\/([^\/]+)/);
    this.pid = match?.[1] || this.route.parent?.snapshot.paramMap.get('id') || '';
  }
}
