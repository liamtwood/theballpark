import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ShellContextService } from '../../../../../../core/services/shell-context.service';
import { ProjectService } from '../../../../../../core/services/project.service';
import { MessagesInboxComponent } from '../../../../../../shared/components/messages-inbox/messages-inbox.component';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, MessagesInboxComponent],
  template: `
    <app-messages-inbox [boundProjectId]="pid"></app-messages-inbox>
  `
})
export class MessagesComponent implements OnInit, OnDestroy {
  pid = '';
  private previousCtx: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private shellCtx: ShellContextService,
    private projectSvc: ProjectService
  ) {}

  ngOnInit() {
    // Extract project ID from URL — most reliable approach
    const match = this.router.url.match(/\/projects\/([^\/]+)/);
    this.pid = match?.[1] || this.route.parent?.snapshot.paramMap.get('id') || '';

    // Save parent context so we can restore on destroy
    this.previousCtx = { ...this.shellCtx.current };

    if (this.pid) {
      this.projectSvc.getById(this.pid).subscribe(p => {
        this.shellCtx.set({
          ...this.previousCtx,
          heroTitle: p?.event_name || p?.name || 'Messages',
          heroSub: 'Messages',
        });
      });
    }
  }

  ngOnDestroy() {
    if (this.previousCtx) {
      this.shellCtx.set(this.previousCtx);
    }
  }
}
