import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
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
    private shellCtx: ShellContextService,
    private projectSvc: ProjectService
  ) {}

  ngOnInit() {
    let r = this.route;
    while (r.parent) r = r.parent;
    this.pid = r.snapshot.paramMap.get('id') || this.route.parent?.snapshot.paramMap.get('id') || '';

    // Save parent context so we can restore on destroy
    this.previousCtx = this.shellCtx.current;

    if (this.pid) {
      this.projectSvc.getById(this.pid).subscribe(p => {
        this.shellCtx.set({
          ...this.previousCtx,
          heroTitle: 'Messages',
          heroSub: p?.event_name || p?.name || '',
        });
      });
    }
  }

  ngOnDestroy() {
    // Restore parent project hero when leaving messages tab
    if (this.previousCtx) {
      this.shellCtx.set(this.previousCtx);
    }
  }
}
