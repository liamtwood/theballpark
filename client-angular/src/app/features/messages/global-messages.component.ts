import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ShellContextService } from '../../core/services/shell-context.service';
import { MessagesInboxComponent } from '../../shared/components/messages-inbox/messages-inbox.component';

@Component({
  selector: 'app-global-messages',
  standalone: true,
  imports: [CommonModule, MessagesInboxComponent],
  template: `
    <app-messages-inbox
      [showProjectSelector]="true"
      [boundProjectId]="preselectedProjectId">
    </app-messages-inbox>
  `
})
export class GlobalMessagesComponent implements OnInit, OnDestroy {
  preselectedProjectId = '';

  constructor(
    private route: ActivatedRoute,
    private shellCtx: ShellContextService
  ) {}

  ngOnInit() {
    this.shellCtx.set({ heroTitle: 'Messages', heroSub: '', pills: [], tabs: [] });
    // Pre-select project if navigated from project bottom nav
    this.preselectedProjectId = this.route.snapshot.queryParams['projectId'] || '';
  }

  ngOnDestroy() { this.shellCtx.reset(); }
}
