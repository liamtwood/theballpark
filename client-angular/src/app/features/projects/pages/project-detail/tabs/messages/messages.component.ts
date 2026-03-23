import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ActivatedRoute } from '@angular/router';
import { MessageService as MsgSvc } from '../../../../../../core/services/message.service';
import { Message } from '../../../../../../models';
import { LoadingSpinnerComponent } from '../../../../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, InputTextModule, ToastModule,
    LoadingSpinnerComponent
  ],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading">
      <div class="bp-messages-body">
        <div class="bp-messages-card">

          <!-- Message list -->
          <div class="bp-messages-list">
            <p *ngIf="msgs.length === 0" class="bp-muted-text" style="text-align:center;padding:40px 0;">
              No messages yet. Send the first brief to a supplier.
            </p>

            <ng-container *ngFor="let m of msgs">
              <div class="bp-msg-date" *ngIf="shouldShowDate(m)">{{ m.created_at | date:'d MMMM yyyy' }}</div>
              <div class="bp-msg-row" [class.bp-msg-outbound]="m.direction === 'outbound'">
                <div class="bp-msg-bubble" [class.bp-msg-bubble-out]="m.direction === 'outbound'">
                  <div class="bp-msg-meta">
                    <span class="bp-msg-sender">{{ m.sender_name || (m.direction === 'outbound' ? 'You' : 'Supplier') }}</span>
                    <span class="bp-msg-time">{{ m.created_at | date:'HH:mm' }}</span>
                  </div>
                  <p class="bp-msg-body">{{ m.body }}</p>
                </div>
              </div>
            </ng-container>
          </div>

          <!-- Compose -->
          <div class="bp-compose">
            <input pInputText [(ngModel)]="newMsg" placeholder="Type a message..."
              class="bp-compose-input bp-input-edit"
              (keyup.enter)="send()"/>
            <p-button icon="pi pi-send" styleClass="bp-btn-save"
              [disabled]="!newMsg.trim() || sending"
              [loading]="sending"
              (onClick)="send()">
            </p-button>
          </div>

        </div>
      </div>
    </ng-container>

    <p-toast></p-toast>
  `,
  styles: [`
    .bp-messages-body   { padding: var(--section-pad); max-width: 760px; margin: 0 auto; }
    .bp-messages-card   { border: 0.5px solid var(--color-border); border-radius: 12px; overflow: hidden; background: #fff; }
    .bp-messages-list   { padding: 24px; min-height: 300px; max-height: 520px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }

    /* Date separator */
    .bp-msg-date { font-size: 11px; color: var(--color-text-muted); text-align: center; margin: 12px 0 4px; text-transform: uppercase; letter-spacing: 0.06em; }

    /* Message row */
    .bp-msg-row          { display: flex; justify-content: flex-start; }
    .bp-msg-outbound     { justify-content: flex-end; }
    .bp-msg-bubble       { max-width: 70%; background: var(--color-surface); border: 0.5px solid var(--color-border); border-radius: 12px 12px 12px 2px; padding: 10px 14px; }
    .bp-msg-bubble-out   { background: var(--theme-bg); border-color: var(--theme-border); border-radius: 12px 12px 2px 12px; }

    /* Meta + body */
    .bp-msg-meta   { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .bp-msg-sender { font-size: 11px; font-weight: 600; color: var(--color-text-primary); }
    .bp-msg-time   { font-size: 10px; color: var(--color-text-muted); }
    .bp-msg-body   { font-size: 13px; color: var(--color-text-primary); line-height: 1.5; white-space: pre-wrap; margin: 0; }

    /* Compose */
    .bp-compose       { display: flex; gap: 8px; padding: 16px 24px; border-top: 0.5px solid var(--color-border); background: #fff; }
    .bp-compose-input { flex: 1; }

    .bp-muted-text { font-size: var(--text-sm); color: var(--color-text-muted); }
  `]
})
export class MessagesComponent implements OnInit {
  msgs: Message[] = [];
  loading = true;
  sending = false;
  newMsg = '';
  pid = '';
  private lastDate = '';

  constructor(
    private route: ActivatedRoute,
    private msgSvc: MsgSvc,
    private toast: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.pid = this.route.parent?.snapshot.paramMap.get('id') || '';
    this.load();
  }

  load() {
    this.msgSvc.getByProject(this.pid).subscribe({
      next: msgs => { this.msgs = msgs; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  shouldShowDate(m: Message): boolean {
    const d = m.created_at ? new Date(m.created_at).toDateString() : '';
    if (d !== this.lastDate) { this.lastDate = d; return true; }
    return false;
  }

  send() {
    if (!this.newMsg?.trim()) return;
    this.sending = true;
    this.msgSvc.create({
      project_id: this.pid,
      body: this.newMsg,
      direction: 'outbound',
      subject: 'Message'
    }).subscribe({
      next: () => {
        this.newMsg = '';
        this.sending = false;
        this.load();
      },
      error: () => {
        this.sending = false;
        this.toast.add({ severity: 'error', summary: 'Failed to send' });
      }
    });
  }
}
