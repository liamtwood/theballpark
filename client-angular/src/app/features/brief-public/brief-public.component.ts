import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import {
  MessageItemService, BriefResponse, MessageItemRow
} from '../../core/services/message-item.service';
import { CodelistService } from '../../core/services/codelist.service';
import {
  MessageItemCardComponent, MessageItem
} from '../../shared/components/message-item-card/message-item-card.component';
import { GbpPipe } from '../../shared/pipes/gbp.pipe';

/**
 * v1.65cv (p0008 §5) — Public supplier brief surface.
 *
 * No auth, no shell chrome — the token in the URL is the credential.
 * Route is registered in app.routes.ts; the shell knows not to wrap
 * /brief/:token in the agency nav.
 *
 * Layout:
 *   • Light header strip: agency logo + name + ref code + clock chip
 *   • Conversation panel: items (state-aware action cards) + chat
 *     stream + compose strip (text + send; clock + attachments + chip
 *     row marked TODO(p0008-§4.3-polish) for the follow-up commit).
 *   • Footer: "Powered by Ballpark".
 */

@Component({
  selector: 'app-brief-public',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, LucideAngularModule,
    MessageItemCardComponent, GbpPipe,
  ],
  template: `
    <div class="bp-brief-shell">
      <ng-container *ngIf="!loading && data">
        <!-- v1.65cx (p0011 §3) — same supplier-row-card pattern as the
             inbox header, but rendered with the agency's identity. -->
        <header class="bp-brief-head">
          <div class="bp-thread-supplier-card">
            <div class="bp-thread-supplier-logo"
                 [class.bp-thread-supplier-logo--img]="!!data.thread?.agency_logo_url">
              <img *ngIf="data.thread?.agency_logo_url" [src]="data.thread?.agency_logo_url" [alt]="data.thread?.agency_name"/>
              <span *ngIf="!data.thread?.agency_logo_url">{{ initialsFor(data.thread?.agency_name) }}</span>
            </div>
            <div class="bp-thread-supplier-body">
              <div class="bp-thread-supplier-name">{{ data.thread?.agency_name }}</div>
              <div class="bp-thread-supplier-eyebrow">
                <span *ngIf="data.message?.ref_code" class="bp-brief-ref">{{ data.message?.ref_code }}</span>
                Brief from {{ data.thread?.agency_name }} · {{ data.thread?.category_name || 'Brief' }}
              </div>
            </div>
            <span *ngIf="data.thread?.status"
                  class="bp-msg-tbadge bp-thread-supplier-pill"
                  [ngClass]="'bp-badge-' + (data.thread?.status || 'default')">
              {{ data.thread?.status }}
            </span>
            <span *ngIf="data.message?.next_action_by"
                  class="bp-thread-clock-chip"
                  [class.bp-thread-clock-chip--overdue]="isOverdue(data.message?.next_action_by)"
                  [title]="formatClock(data.message?.next_action_by)">
              <lucide-icon name="clock" [size]="12"></lucide-icon>
              {{ shortClock(data.message?.next_action_by) }}
            </span>
          </div>
        </header>

        <main class="bp-brief-main">
          <!-- ── Items (action surface) ── -->
          <section *ngIf="data.items?.length" class="bp-brief-items">
            <div class="bp-brief-section-head">
              <lucide-icon name="package" [size]="13"></lucide-icon>
              <span>{{ data.items.length }} item{{ data.items.length === 1 ? '' : 's' }} in this brief</span>
            </div>
            <app-message-item-card *ngFor="let it of data.items"
              [item]="toMessageItem(it)"
              [viewer]="'supplier'"
              [declineReasons]="declineReasonsFor(it)"
              (action)="onItemAction(it, $event)">
            </app-message-item-card>
          </section>

          <!-- ── Chat stream ── -->
          <section class="bp-brief-stream">
            <div class="bp-brief-section-head">
              <lucide-icon name="message-square" [size]="13"></lucide-icon>
              <span>Conversation</span>
            </div>
            <div class="bp-brief-bubbles">
              <div *ngFor="let m of data.messages"
                   class="bp-brief-bubble"
                   [class.bp-brief-bubble--out]="m.direction === 'inbound'"
                   [class.bp-brief-bubble--in]="m.direction === 'outbound'">
                <div class="bp-brief-bubble-body">{{ m.body || '(no message)' }}</div>
                <div class="bp-brief-bubble-time">
                  {{ formatClock(m.created_at) }}
                </div>
              </div>
              <div *ngIf="!data.messages?.length" class="bp-brief-bubble-empty">
                No messages yet.
              </div>
            </div>
          </section>

          <!-- ── Compose ──
               Minimal v1: text input + send. Quick-reply chips and
               clock popover marked TODO(p0008-§4.3-polish). -->
          <section class="bp-brief-compose">
            <textarea class="bp-brief-input"
                      [(ngModel)]="replyText"
                      placeholder="Type a reply…"
                      rows="2"></textarea>
            <button type="button"
                    class="bp-brief-send"
                    [disabled]="!replyText?.trim() || sending"
                    (click)="sendReply()">
              <lucide-icon name="send" [size]="14"></lucide-icon>
              {{ sending ? 'Sending…' : 'Send' }}
            </button>
          </section>
        </main>
      </ng-container>

      <div *ngIf="loading" class="bp-brief-empty">
        <lucide-icon name="loader-2" [size]="28"></lucide-icon>
        <p>Loading brief…</p>
      </div>

      <div *ngIf="!loading && error" class="bp-brief-empty">
        <lucide-icon name="alert-triangle" [size]="32"></lucide-icon>
        <p>This brief link isn't valid or has expired.</p>
      </div>

      <footer class="bp-brief-footer">
        Powered by Ballpark
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: var(--color-page-ground); }
    .bp-brief-shell {
      max-width: 800px; margin: 0 auto;
      padding: 24px 16px 48px;
      display: flex; flex-direction: column; gap: 16px;
      font-family: var(--font-body);
      color: var(--color-text-primary);
    }
    /* v1.65cx (p0011 §3) — same supplier-row-card chrome as the
       inbox conversation header. TODO(p0011-§3-extract): single
       SCSS partial when the catalogue's row card is factored out. */
    .bp-brief-head {
      padding: 6px;
      background: var(--color-surface);
      border-radius: var(--radius-card);
      border: var(--border-hairline);
      box-shadow: var(--shadow-xs);
    }
    .bp-thread-supplier-card {
      flex: 1; min-width: 0;
      display: flex; align-items: center; gap: 12px;
      padding: 6px 10px;
    }
    .bp-thread-supplier-logo {
      width: 44px; height: 44px;
      border-radius: var(--radius-button);
      background: var(--theme-soft);
      color: var(--theme-text);
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-display);
      font-size: 18px; font-weight: 500;
      flex-shrink: 0;
      overflow: hidden;
    }
    .bp-thread-supplier-logo--img { background: var(--color-surface); border: var(--border-hairline); }
    .bp-thread-supplier-logo img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .bp-thread-supplier-body { flex: 1; min-width: 0; }
    .bp-thread-supplier-name {
      font-size: 14px; font-weight: 500;
      color: var(--color-text-primary);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .bp-thread-supplier-eyebrow {
      font-size: 11px;
      color: var(--color-text-muted);
      margin-top: 2px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .bp-brief-ref {
      font-family: var(--font-body);
      font-size: 10px;
      color: var(--theme-accent);
      background: var(--theme-soft);
      padding: 1px 7px;
      border-radius: var(--radius-pill);
      margin-right: 6px;
      vertical-align: middle;
    }
    .bp-msg-tbadge {
      font-size: 9px; font-weight: 600;
      padding: 1px 7px;
      border-radius: var(--radius-pill);
      letter-spacing: 0.02em;
      white-space: nowrap;
    }
    .bp-thread-supplier-pill { flex-shrink: 0; }
    .bp-thread-clock-chip {
      display: inline-flex; align-items: center; gap: 4px;
      flex-shrink: 0;
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      background: var(--theme-soft);
      color: var(--color-text-secondary);
      font-size: 11px; font-weight: 500;
    }
    .bp-thread-clock-chip lucide-icon { color: var(--theme-accent); }
    .bp-thread-clock-chip--overdue {
      background: var(--color-action-bg);
      color: var(--color-action-text);
    }
    .bp-thread-clock-chip--overdue lucide-icon { color: var(--color-action-text); }
    /* Semantic status badges so .bp-msg-tbadge renders correctly. */
    .bp-badge-action  { background: var(--color-action-bg);  color: var(--color-action-text); }
    .bp-badge-waiting { background: var(--color-waiting-bg); color: var(--color-waiting-text); }
    .bp-badge-quoted  { background: var(--color-quoted-bg);  color: var(--color-quoted-text); }
    .bp-badge-booked  { background: var(--color-booked-bg);  color: var(--color-booked-text); }
    .bp-badge-default { background: var(--color-fill);         color: var(--theme-accent); }

    .bp-brief-main {
      display: flex; flex-direction: column; gap: 16px;
    }
    .bp-brief-items, .bp-brief-stream, .bp-brief-compose {
      background: var(--color-surface);
      border: var(--border-hairline);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-xs);
      padding: 14px 16px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .bp-brief-section-head {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 600;
      color: var(--theme-accent);
      letter-spacing: 0.08em; text-transform: uppercase;
    }
    .bp-brief-section-head lucide-icon { color: var(--theme-accent); }

    .bp-brief-bubbles { display: flex; flex-direction: column; gap: 8px; }
    .bp-brief-bubble {
      max-width: 75%;
      padding: 8px 12px;
      border-radius: var(--radius-card);
      font-size: 13px;
      line-height: 1.45;
    }
    .bp-brief-bubble--out {
      align-self: flex-end;
      background: var(--theme-soft);
      color: var(--theme-text);
      border-bottom-right-radius: 4px;
    }
    .bp-brief-bubble--in {
      align-self: flex-start;
      background: var(--color-surface);
      border: var(--border-hairline);
      color: var(--color-text-primary);
      border-bottom-left-radius: 4px;
    }
    .bp-brief-bubble-time {
      font-size: 10px;
      color: var(--color-text-muted);
      margin-top: 4px;
      text-align: right;
    }
    .bp-brief-bubble-empty {
      text-align: center;
      font-size: 12px;
      color: var(--color-text-muted);
      padding: 14px;
    }

    .bp-brief-compose { flex-direction: row; align-items: flex-end; }
    .bp-brief-input {
      flex: 1;
      font-family: var(--font-body);
      font-size: 13px;
      padding: 8px 12px;
      border: var(--border-hairline);
      border-radius: var(--radius-button);
      background: var(--color-surface);
      resize: vertical;
      min-height: 40px;
    }
    .bp-brief-send {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 10px 14px;
      background: var(--theme-accent);
      color: var(--color-surface);
      border: none;
      border-radius: var(--radius-button);
      font-family: var(--font-body);
      font-size: 13px; font-weight: 500;
      cursor: pointer;
    }
    .bp-brief-send:disabled { opacity: 0.55; cursor: default; }

    .bp-brief-empty {
      text-align: center;
      padding: 80px 24px;
      color: var(--color-text-muted);
      display: flex; flex-direction: column; align-items: center; gap: 10px;
    }
    .bp-brief-footer {
      text-align: center;
      font-size: 11px;
      color: var(--color-text-muted);
      margin-top: 12px;
    }
  `]
})
export class BriefPublicComponent implements OnInit {
  loading = true;
  error = false;
  data: BriefResponse | null = null;
  declineReasonsPre:  Array<{ code: string; label: string }> = [];
  declineReasonsPost: Array<{ code: string; label: string }> = [];
  replyText = '';
  sending = false;
  private token = '';

  constructor(
    private route: ActivatedRoute,
    private svc: MessageItemService,
    private codelistSvc: CodelistService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    if (!this.token) {
      this.loading = false;
      this.error = true;
      this.cdr.markForCheck();
      return;
    }
    this.fetch();
    // Warm reason codelists.
    this.codelistSvc.getByName('decline_reason_pre_agreement').subscribe(rows => {
      // Supplier sees the pre-agreement reasons except agent-only ones.
      this.declineReasonsPre = (rows || [])
        .filter((r: any) => (r.meta?.who ?? 'both') !== 'agent')
        .map((r: any) => ({ code: r.code, label: r.label }));
      this.cdr.markForCheck();
    });
    this.codelistSvc.getByName('decline_reason_post_agreement').subscribe(rows => {
      this.declineReasonsPost = (rows || [])
        .filter((r: any) => (r.meta?.who ?? 'both') !== 'agent')
        .map((r: any) => ({ code: r.code, label: r.label }));
      this.cdr.markForCheck();
    });
  }

  private fetch(): void {
    this.svc.publicGet(this.token).subscribe({
      next: data => {
        this.data = data;
        this.loading = false;
        this.error = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.error = true;
        this.cdr.markForCheck();
      }
    });
  }

  declineReasonsFor(item: MessageItemRow): Array<{ code: string; label: string }> {
    return item?.status === 'accepted' || item?.status === 'booked'
      ? this.declineReasonsPost
      : this.declineReasonsPre;
  }

  toMessageItem(r: MessageItemRow): MessageItem {
    return {
      id: r.id,
      name: r.name,
      description: r.description || '',
      price_ref:     r.price_ref ?? (r as any).price ?? null,
      price_current: r.price_current ?? (r as any).price ?? null,
      unit: r.unit || null,
      status: r.status,
      next_action_by: r.next_action_by || null,
    };
  }

  onItemAction(item: MessageItemRow, evt: { action: string; reason_code?: string; note?: string; name?: string; description?: string; price?: number; unit?: string }) {
    this.svc.publicReply(this.token, {
      item_actions: [{
        message_item_id: item.id,
        action: evt.action as any,
        reason_code: evt.reason_code,
        note: evt.note,
        name: evt.name,
        description: evt.description,
        price: evt.price,
        unit: evt.unit,
      }],
    }).subscribe({
      next: () => this.fetch(),
      error: () => { /* Best-effort; surface a toast later. */ }
    });
  }

  sendReply(): void {
    const text = (this.replyText || '').trim();
    if (!text || this.sending) return;
    this.sending = true;
    this.svc.publicReply(this.token, { text }).subscribe({
      next: () => {
        this.replyText = '';
        this.sending = false;
        this.fetch();
      },
      error: () => { this.sending = false; this.cdr.markForCheck(); }
    });
  }

  isOverdue(ts: string | null | undefined): boolean {
    if (!ts) return false;
    const t = Date.parse(ts);
    return Number.isFinite(t) && t < Date.now();
  }

  formatClock(ts: string | null | undefined): string {
    if (!ts) return '';
    const d = new Date(ts);
    if (!Number.isFinite(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
           ' · ' +
           d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  /** v1.65cx (p0011 §3) — short relative format for the header clock
      chip. Same logic as the inbox version. */
  shortClock(ts: string | null | undefined): string {
    if (!ts) return '';
    const d = new Date(ts);
    if (!Number.isFinite(d.getTime())) return '';
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  initialsFor(name?: string | null): string {
    const n = (name || '').trim();
    if (!n) return '?';
    const parts = n.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
}
