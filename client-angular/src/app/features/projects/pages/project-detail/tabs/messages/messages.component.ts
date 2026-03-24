import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MessagesInboxComponent } from '../../../../../../shared/components/messages-inbox/messages-inbox.component';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, MessagesInboxComponent],
  template: `
    <app-messages-inbox [boundProjectId]="pid"></app-messages-inbox>
  `
})
export class MessagesComponent implements OnInit {
  pid = '';

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    let r = this.route;
    while (r.parent) r = r.parent;
    this.pid = r.snapshot.paramMap.get('id') || this.route.parent?.snapshot.paramMap.get('id') || '';
  }
}
