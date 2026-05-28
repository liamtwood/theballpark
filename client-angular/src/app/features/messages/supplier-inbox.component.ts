/**
 * v1.65dz (p0015) — Supplier persona inbox route.
 *
 * Mirrors GlobalMessagesComponent's thin-wrapper shape, but mounts
 * MessagesInboxComponent with viewer='supplier' so the shared
 * component renders the supplier-side variant of every divergent
 * slot (From label, lane side, action sets, compose chip seed).
 *
 * Route: /inbox  (registered in app.routes.ts)
 *
 * Hero is set from the active supplier persona (PersonaService) so the
 * page header carries the right brand. Phase 3 will swap in the real
 * supplier identity once auth lands.
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShellContextService } from '../../core/services/shell-context.service';
import { PersonaService } from '../../core/services/persona.service';
import { MessagesInboxComponent } from '../../shared/components/messages-inbox/messages-inbox.component';

@Component({
  selector: 'app-supplier-inbox',
  standalone: true,
  imports: [CommonModule, MessagesInboxComponent],
  template: `
    <app-messages-inbox viewer="supplier"></app-messages-inbox>
  `
})
export class SupplierInboxComponent implements OnInit, OnDestroy {
  constructor(
    private personaSvc: PersonaService,
    private shellCtx: ShellContextService
  ) {}

  ngOnInit() {
    const p = this.personaSvc.active;
    this.shellCtx.set({
      heroTitle: p.name,
      heroSub:   'INBOX',
      pills:     [],
      tabs:      []
    });
  }

  ngOnDestroy() {
    this.shellCtx.reset();
  }
}
