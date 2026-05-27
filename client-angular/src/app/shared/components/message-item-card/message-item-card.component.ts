import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { GbpPipe } from '../../pipes/gbp.pipe';

/**
 * v1.65cv (p0008 §4.4) — standalone state-aware item card.
 *
 * Renders one message_item row across three surfaces (inbox summary
 * header, conversation chat stream, public /brief). Props:
 *
 *   item     — { id, name, description, price_ref, price_current,
 *                unit, status, next_action_by, ... }
 *   viewer   — 'agent' | 'supplier' — drives the action set
 *   compact  — when true, hides the actions (used in the summary
 *              header which is nav-only)
 *
 * Emits a single `action` event with shape:
 *   { action: 'accept' | 'decline' | 'adjust' | 'quote' | 'pay' | 'holding',
 *     reason_code?, note?, name?, description?, price?, unit? }
 *
 * Parent wires the event to the agent or public reply endpoint.
 */

export type MessageItemViewer = 'agent' | 'supplier';

export interface MessageItem {
  id: string;
  name: string;
  description?: string | null;
  price_ref?: number | null;
  price_current?: number | null;
  unit?: string | null;
  status: string;
  next_action_by?: string | null;
  decline_reason?: string | null;
  decline_note?: string | null;
}

export interface MessageItemAction {
  action: 'accept' | 'decline' | 'adjust' | 'quote' | 'pay' | 'holding';
  reason_code?: string;
  note?: string;
  name?: string;
  description?: string;
  price?: number;
  unit?: string;
}

@Component({
  selector: 'app-message-item-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, LucideAngularModule, GbpPipe],
  template: `
    <div class="bp-mi-card"
         [class.bp-mi-card--compact]="compact"
         [class.bp-mi-card--overdue]="isOverdue()">
      <div class="bp-mi-card-body">
        <div class="bp-mi-card-head">
          <div class="bp-mi-card-name">{{ item?.name }}</div>
          <span class="bp-mi-card-status" [ngClass]="'bp-badge-' + semanticClass()">
            {{ statusLabel() }}
          </span>
        </div>
        <div class="bp-mi-card-desc" *ngIf="item?.description">
          {{ item?.description }}
        </div>
        <div class="bp-mi-card-price">
          <ng-container *ngIf="priceChanged(); else priceCurrent">
            <span class="bp-mi-card-price-was">{{ item?.price_ref | gbp }}</span>
            <lucide-icon name="arrow-right" [size]="11"></lucide-icon>
            <span class="bp-mi-card-price-now">{{ item?.price_current | gbp }}</span>
          </ng-container>
          <ng-template #priceCurrent>
            <span class="bp-mi-card-price-now">
              {{ (item?.price_current ?? item?.price_ref ?? 0) | gbp }}
            </span>
          </ng-template>
          <span *ngIf="item?.unit" class="bp-mi-card-unit">/ {{ item?.unit }}</span>
        </div>
        <div *ngIf="item?.next_action_by" class="bp-mi-card-clock"
             [class.bp-mi-card-clock--overdue]="isOverdue()">
          <lucide-icon name="clock" [size]="11"></lucide-icon>
          {{ formatClock(item?.next_action_by) }}
        </div>
      </div>

      <!-- Action slot — hidden in compact mode (summary header is nav). -->
      <div *ngIf="!compact && actionSet().length" class="bp-mi-card-actions">
        <button *ngFor="let a of actionSet()"
                type="button"
                class="bp-mi-btn"
                [class.bp-mi-btn--primary]="a.kind === 'accept' || a.kind === 'pay'"
                [class.bp-mi-btn--danger]="a.kind === 'decline'"
                [disabled]="a.disabled"
                [title]="a.title || ''"
                (click)="onAction(a.kind, $event)">
          {{ a.label }}
        </button>
      </div>

      <!-- Decline reason popover -->
      <div *ngIf="declineOpen" class="bp-mi-decline">
        <label class="bp-mi-decline-label">Reason</label>
        <select [(ngModel)]="declineReason" class="bp-mi-decline-select">
          <option value="" disabled>Choose…</option>
          <option *ngFor="let r of declineReasons" [value]="r.code">{{ r.label }}</option>
        </select>
        <textarea *ngIf="declineReason === 'other'"
                  class="bp-mi-decline-note"
                  [(ngModel)]="declineNote"
                  placeholder="Tell us what's up (required for 'Other')"></textarea>
        <div class="bp-mi-decline-actions">
          <button type="button" class="bp-mi-btn" (click)="cancelDecline()">Cancel</button>
          <button type="button" class="bp-mi-btn bp-mi-btn--danger"
                  [disabled]="!declineReason || (declineReason === 'other' && !declineNote?.trim())"
                  (click)="confirmDecline()">Decline</button>
        </div>
      </div>

      <!-- Adjust form -->
      <div *ngIf="adjustOpen" class="bp-mi-adjust">
        <input class="bp-mi-adjust-input" [(ngModel)]="adjustDraft.name"        placeholder="Name"/>
        <input class="bp-mi-adjust-input" [(ngModel)]="adjustDraft.description" placeholder="Description"/>
        <div class="bp-mi-adjust-row">
          <input class="bp-mi-adjust-input" type="number" min="0" step="1"
                 [(ngModel)]="adjustDraft.price" placeholder="Price"/>
          <input class="bp-mi-adjust-input" [(ngModel)]="adjustDraft.unit"
                 placeholder="Unit (optional)"/>
        </div>
        <div class="bp-mi-adjust-actions">
          <button type="button" class="bp-mi-btn" (click)="cancelAdjust()">Cancel</button>
          <button type="button" class="bp-mi-btn bp-mi-btn--primary"
                  (click)="confirmAdjust()">Save adjustment</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .bp-mi-card {
      border: var(--border-hairline);
      border-radius: var(--radius-button);
      background: var(--color-surface);
      padding: 10px 12px;
      display: flex; flex-direction: column; gap: 8px;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .bp-mi-card-body { display: flex; flex-direction: column; gap: 4px; }
    .bp-mi-card-head {
      display: flex; align-items: center; justify-content: space-between;
      gap: 8px;
    }
    .bp-mi-card-name { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
    .bp-mi-card-status {
      font-size: 9px; font-weight: 600; padding: 1px 7px;
      border-radius: var(--radius-pill);
      letter-spacing: 0.02em;
      white-space: nowrap;
    }
    .bp-mi-card-desc {
      font-size: 12px; color: var(--color-text-muted);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .bp-mi-card-price {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 12px;
      color: var(--color-text-primary);
    }
    .bp-mi-card-price-was {
      color: var(--color-text-muted);
      text-decoration: line-through;
    }
    .bp-mi-card-price-now { font-weight: 600; }
    .bp-mi-card-unit { font-size: 11px; color: var(--color-text-muted); }
    .bp-mi-card-clock {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11px; color: var(--color-text-muted);
    }
    .bp-mi-card-clock--overdue { color: var(--color-danger); }
    .bp-mi-card-clock--overdue lucide-icon { color: var(--color-danger); }

    /* Action button cluster — calm outlines with --radius-pill. */
    .bp-mi-card-actions {
      display: flex; flex-wrap: wrap; gap: 6px;
      padding-top: 4px; border-top: var(--border-hairline);
    }
    .bp-mi-btn {
      font-family: var(--font-body);
      font-size: 11px; font-weight: 500;
      padding: 4px 12px;
      border-radius: var(--radius-pill);
      border: 0.5px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: background 0.12s, color 0.12s, border-color 0.12s;
    }
    .bp-mi-btn:hover { border-color: var(--color-text-secondary); color: var(--color-text-primary); }
    .bp-mi-btn:disabled { opacity: 0.5; cursor: default; }
    .bp-mi-btn--primary {
      color: var(--theme-accent);
      border-color: var(--theme-accent);
    }
    .bp-mi-btn--primary:hover {
      background: var(--theme-accent);
      color: var(--color-surface);
    }
    .bp-mi-btn--danger { color: var(--color-danger); border-color: var(--color-danger); }
    .bp-mi-btn--danger:hover { background: var(--color-danger); color: var(--color-surface); }

    .bp-mi-card--overdue { border-left: 2px solid var(--color-danger); }
    .bp-mi-card--compact .bp-mi-card-actions { display: none; }

    /* Decline + Adjust popovers */
    .bp-mi-decline, .bp-mi-adjust {
      display: flex; flex-direction: column; gap: 6px;
      padding-top: 6px; border-top: var(--border-hairline);
    }
    .bp-mi-decline-label { font-size: 10px; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
    .bp-mi-decline-select, .bp-mi-adjust-input, .bp-mi-decline-note {
      font-family: var(--font-body);
      font-size: 12px;
      padding: 6px 8px;
      border: var(--border-hairline);
      border-radius: var(--radius-button);
      background: var(--color-surface);
    }
    .bp-mi-decline-note { min-height: 56px; resize: vertical; }
    .bp-mi-adjust-row { display: flex; gap: 6px; }
    .bp-mi-adjust-row .bp-mi-adjust-input { flex: 1; }
    .bp-mi-decline-actions, .bp-mi-adjust-actions {
      display: flex; justify-content: flex-end; gap: 6px;
    }
  `]
})
export class MessageItemCardComponent {
  @Input() item: MessageItem | null = null;
  @Input() viewer: MessageItemViewer = 'agent';
  @Input() compact = false;

  /** Decline-reason codelist (filtered + injected by the parent). */
  @Input() declineReasons: Array<{ code: string; label: string }> = [];

  @Output() action = new EventEmitter<MessageItemAction>();

  // Inline edit state
  declineOpen = false;
  declineReason = '';
  declineNote = '';

  adjustOpen = false;
  adjustDraft: { name: string; description: string; price: number | null; unit: string } = {
    name: '', description: '', price: null, unit: ''
  };

  constructor(private cdr: ChangeDetectorRef) {}

  // ── Display helpers ───────────────────────────────────────────────

  isOverdue(): boolean {
    const ts = this.item?.next_action_by;
    if (!ts) return false;
    const t = Date.parse(ts);
    return Number.isFinite(t) && t < Date.now();
  }

  priceChanged(): boolean {
    const r = +(this.item?.price_ref     ?? 0) || 0;
    const c = +(this.item?.price_current ?? 0) || 0;
    return r > 0 && c > 0 && r !== c;
  }

  statusLabel(): string {
    const map: Record<string, string> = {
      brief_sent: 'Brief sent',
      holding: 'Holding',
      quoted: 'Quoted',
      adjusted_by_supplier: 'Adjusted',
      adjusted_by_agent: 'Adjusted',
      accepted: 'Accepted',
      booked: 'Booked',
      declined_by_supplier: 'Declined',
      declined_by_agent: 'Cancelled',
    };
    return map[this.item?.status || ''] || this.item?.status || '';
  }

  semanticClass(): string {
    const map: Record<string, string> = {
      brief_sent: 'waiting',
      holding: 'waiting',
      quoted: 'quoted',
      adjusted_by_supplier: 'quoted',
      adjusted_by_agent: 'waiting',
      accepted: 'action',
      booked: 'booked',
      declined_by_supplier: 'danger',
      declined_by_agent: 'danger',
    };
    return map[this.item?.status || ''] || 'default';
  }

  formatClock(ts: string | null | undefined): string {
    if (!ts) return '';
    const d = new Date(ts);
    if (!Number.isFinite(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
           ' · ' +
           d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  // ── Action-set table (p0008 §4.4) ─────────────────────────────────

  actionSet(): Array<{ kind: MessageItemAction['action']; label: string; disabled?: boolean; title?: string }> {
    const s = this.item?.status || '';
    const v = this.viewer;
    if (this.declineOpen || this.adjustOpen) return [];
    // Terminal — no actions.
    if (['booked', 'declined_by_supplier', 'declined_by_agent'].includes(s)) return [];

    if (v === 'agent') {
      if (s === 'quoted' || s === 'adjusted_by_supplier') {
        return [
          { kind: 'accept',  label: 'Accept' },
          { kind: 'decline', label: 'Decline' },
          { kind: 'adjust',  label: 'Adjust' },
        ];
      }
      if (s === 'accepted') {
        return [
          { kind: 'pay',     label: 'Pay' },
          { kind: 'decline', label: 'Decline' },
          { kind: 'adjust',  label: 'Adjust' },
        ];
      }
      // brief_sent / holding / adjusted_by_agent — waiting on supplier.
      return [];
    }
    // viewer === 'supplier'
    if (s === 'brief_sent' || s === 'adjusted_by_agent') {
      return [
        { kind: 'accept',  label: 'Accept' },
        { kind: 'decline', label: 'Decline' },
        { kind: 'adjust',  label: 'Adjust' },
      ];
    }
    if (s === 'holding') {
      return [
        { kind: 'quote',   label: 'Quote' },
        { kind: 'decline', label: 'Decline' },
        { kind: 'adjust',  label: 'Adjust' },
      ];
    }
    if (s === 'accepted') {
      return [
        { kind: 'pay',     label: 'Pay', disabled: true, title: 'Awaiting payment from agent' },
        { kind: 'decline', label: 'Decline' },
        { kind: 'adjust',  label: 'Adjust' },
      ];
    }
    return [];
  }

  // ── Event handlers ────────────────────────────────────────────────

  onAction(kind: MessageItemAction['action'], ev?: MouseEvent): void {
    if (ev) ev.stopPropagation();
    if (kind === 'decline') { this.openDecline(); return; }
    if (kind === 'adjust')  { this.openAdjust();  return; }
    this.action.emit({ action: kind });
  }

  openDecline(): void {
    this.declineReason = '';
    this.declineNote = '';
    this.declineOpen = true;
    this.cdr.markForCheck();
  }
  cancelDecline(): void { this.declineOpen = false; this.cdr.markForCheck(); }
  confirmDecline(): void {
    if (!this.declineReason) return;
    if (this.declineReason === 'other' && !this.declineNote?.trim()) return;
    this.action.emit({
      action: 'decline',
      reason_code: this.declineReason,
      note: this.declineNote?.trim() || undefined,
    });
    this.declineOpen = false;
    this.cdr.markForCheck();
  }

  openAdjust(): void {
    this.adjustDraft = {
      name: this.item?.name || '',
      description: this.item?.description || '',
      price: this.item?.price_current ?? this.item?.price_ref ?? null,
      unit: this.item?.unit || '',
    };
    this.adjustOpen = true;
    this.cdr.markForCheck();
  }
  cancelAdjust(): void { this.adjustOpen = false; this.cdr.markForCheck(); }
  confirmAdjust(): void {
    const { name, description, price, unit } = this.adjustDraft;
    this.action.emit({
      action: 'adjust',
      name: name?.trim() || undefined,
      description: description?.trim() || undefined,
      price: price != null && !isNaN(+price) ? Number(price) : undefined,
      unit: unit?.trim() || undefined,
    });
    this.adjustOpen = false;
    this.cdr.markForCheck();
  }
}
