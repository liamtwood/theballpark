import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { OrgService } from '../../core/services/org.service';
import { ProjectService } from '../../core/services/project.service';
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
    private orgSvc: OrgService,
    private projectSvc: ProjectService,
    private shellCtx: ShellContextService
  ) {}

  ngOnInit() {
    // Pre-select project if navigated from project bottom nav
    this.preselectedProjectId = this.route.snapshot.queryParams['projectId'] || '';

    this.orgSvc.getCurrentOrg().subscribe(org => {
      if (this.preselectedProjectId) {
        this.projectSvc.getById(this.preselectedProjectId).subscribe(p => {
          this.shellCtx.set({ heroTitle: p?.event_name || p?.name || 'Messages', heroSub: 'Messages', pills: [], tabs: [] });
        });
      } else {
        this.shellCtx.set({ heroTitle: org?.name || 'Messages', heroSub: 'Messages', pills: [], tabs: [] });
      }
    });
  }

  ngOnDestroy() { this.shellCtx.reset(); }
}
