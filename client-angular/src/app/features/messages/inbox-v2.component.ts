import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MessagesInboxV2Component } from '../../shared/components/messages-inbox-v2/messages-inbox-v2.component';

/**
 * /inbox-v2 route wrapper (p0037). Thin — mounts the shared v2 shell with the
 * agency viewer; hero defaults come from the route data in app.routes.ts.
 */
@Component({
  selector: 'app-inbox-v2',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MessagesInboxV2Component],
  template: `<app-messages-inbox-v2 viewerRole="agency"/>`
})
export class InboxV2Component {}
