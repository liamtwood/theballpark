import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { GbpPipe } from '../../pipes/gbp.pipe';

/**
 * v1.65cx (p0011 §1 + §2) — state-aware item card, marketplace row shape.
 *
 * Visually identical to the marketplace's list-row item card (.bp-list-row*
 * in catalogue-grid.component.ts) — image left / name + eyebrow / price +
 * unit right — with three deltas:
 *
 *   1. Action slot replaces the +/♥/✉ icon cluster (state-driven buttons).
 *   2. Status pill replaces or supplements the eyebrow.
 *   3. Price shows `was → now` when adjusted (strikethrough on original).
 *
 * Three contexts:
 *   - inbox summary header — compact=true, action slot hidden, status pill shown
 *   - inbox conversation stream — compact=false, actions shown, viewer='agent'
 *   - public /brief/:token       — compact=false, actions shown, viewer='supplier'
 *
 * Action table (symmetric, supersedes p0008 §4.4):
 *   universal: Think · Decline · Adjust  (any non-terminal state)
 *   Accept:    turn-based (only when the OTHER party made the last move)
 *   Pay:       agent-only, on accepted → booked
 *
 *   Think === Holding with a friendlier label. Clicking Think opens the
 *   clock popover; picking a date both flips status to holding AND sets
 *   next_action_by.
 *
 * Class names: we use a `.bp-mi-list-row*` set (a copy of the marketplace
 * .bp-list-row* shape so the inbox card chrome stays a single source of
 * truth here — see TODO(p0011-§1-extract) at the bottom of styles for the
 * future extraction into a shared SCSS partial).
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
  /** v1.65cx — `think` joined `accept|decline|adjust|quote|pay|holding`.
      Server maps `think` → toStatus='holding' (with next_action_by). */
  action: 'accept' | 'decline' | 'adjust' | 'quote' | 'pay' | 'think' | 'holding';
  reason_code?: string;
  note?: string;
  name?: string;
  description?: string;
  price?: number;
  unit?: string;
  next_action_by?: string;
}

@Component({
  selector: 'app-message-item-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, LucideAngularModule, GbpPipe],
  template: `
    <!-- v1.65de (p0013 §4) — GRID variant: image-on-top with the
         status pill overlaid bottom-left, name + price below, action
         cluster in the slot where the supplier eyebrow would sit on
         the catalogue grid card. Used in the conversation stream so
         the inline items echo the marketplace gallery shape. -->
    <div *ngIf="layout === 'grid'"
         class="bp-mi-grid"
         [class.bp-mi-grid--overdue]="isOverdue()"
         [class.bp-mi-row--pulsing]="pulsing">
      <div class="bp-mi-grid-img" [class.bp-mi-grid-img--placeholder]="!imageUrl">
        <img *ngIf="imageUrl" [src]="imageUrl" [alt]="item?.name"/>
        <span *ngIf="!imageUrl" class="bp-mi-grid-img-letter">{{ initialOf(item?.name) }}</span>
        <span class="bp-mi-grid-pill" [ngClass]="'bp-badge-' + semanticClass()">
          {{ statusLabel() }}
        </span>
      </div>
      <div class="bp-mi-grid-body">
        <div class="bp-mi-grid-name">{{ item?.name }}</div>
        <div class="bp-mi-grid-price" *ngIf="hasPrice()">
          <span *ngIf="priceChanged()" class="bp-mi-price-was">{{ item?.price_ref | gbp }}</span>
          <span class="bp-mi-price-now">{{ currentPrice() | gbp }}</span>
          <span *ngIf="item?.unit" class="bp-mi-grid-unit">/ {{ item?.unit }}</span>
        </div>
        <div *ngIf="item?.next_action_by" class="bp-mi-clock"
             [class.bp-mi-clock--overdue]="isOverdue()" title="Next action by">
          <lucide-icon name="clock" [size]="11"></lucide-icon>
          {{ formatClock(item?.next_action_by) }}
        </div>
        <!-- Action cluster sits where the supplier eyebrow would be
             on the catalogue card. Collapses cleanly when empty. -->
        <div *ngIf="actionSet().length && !anyPopoverOpen()" class="bp-mi-actions bp-mi-grid-actions">
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
      </div>
    </div>

    <div *ngIf="layout !== 'grid'"
         class="bp-mi-row"
         [class.bp-mi-row--compact]="compact"
         [class.bp-mi-row--overdue]="isOverdue()"
         [class.bp-mi-row--pulsing]="pulsing"
         (click)="onRowClick($event)">
      <!-- Image / icon block — themed-tint square, 44px (matches
           .bp-list-img in the catalogue). -->
      <div class="bp-mi-img" [class.bp-mi-img--img]="!!imageUrl">
        <img *ngIf="imageUrl" [src]="imageUrl" [alt]="item?.name"/>
        <span *ngIf="!imageUrl" class="bp-mi-img-initial">{{ initialOf(item?.name) }}</span>
      </div>

      <!-- Body: name + inline status pill, eyebrow underneath. -->
      <div class="bp-mi-body">
        <div class="bp-mi-name">
          <span class="bp-mi-name-text">{{ item?.name }}</span>
          <span class="bp-mi-pill" [ngClass]="'bp-badge-' + semanticClass()">
            {{ statusLabel() }}
          </span>
        </div>
        <div class="bp-mi-eyebrow" *ngIf="eyebrowText()">
          {{ eyebrowText() }}
        </div>
        <div *ngIf="item?.next_action_by" class="bp-mi-clock"
             [class.bp-mi-clock--overdue]="isOverdue()"
             title="Next action by">
          <lucide-icon name="clock" [size]="11"></lucide-icon>
          {{ formatClock(item?.next_action_by) }}
        </div>
      </div>

      <!-- Right: price + unit. was→now when adjusted. -->
      <div class="bp-mi-right" *ngIf="hasPrice()">
        <div class="bp-mi-price">
          <span *ngIf="priceChanged()" class="bp-mi-price-was">{{ item?.price_ref | gbp }}</span>
          <span class="bp-mi-price-now">{{ currentPrice() | gbp }}</span>
        </div>
        <div *ngIf="item?.unit" class="bp-mi-unit">{{ item?.unit }}</div>
      </div>

      <!-- Trailing action slot — hidden in compact mode. -->
      <div *ngIf="!compact && actionSet().length && !anyPopoverOpen()" class="bp-mi-actions">
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

      <!-- Pulse target — class only; no separate node. -->
    </div>

    <!-- Popovers render OUTSIDE the row so they don't get squeezed. -->
    <div *ngIf="declineOpen" class="bp-mi-popover">
      <label class="bp-mi-popover-label">Decline — reason</label>
      <select [(ngModel)]="declineReason" class="bp-mi-popover-select">
        <option value="" disabled>Choose…</option>
        <option *ngFor="let r of declineReasons" [value]="r.code">{{ r.label }}</option>
      </select>
      <textarea *ngIf="declineReason === 'other'"
                class="bp-mi-popover-note"
                [(ngModel)]="declineNote"
                placeholder="Tell us what's up (required for 'Other')"></textarea>
      <div class="bp-mi-popover-actions">
        <button type="button" class="bp-mi-btn" (click)="cancelDecline()">Cancel</button>
        <button type="button" class="bp-mi-btn bp-mi-btn--danger"
                [disabled]="!declineReason || (declineReason === 'other' && !declineNote?.trim())"
                (click)="confirmDecline()">Decline</button>
      </div>
    </div>

    <div *ngIf="adjustOpen" class="bp-mi-popover">
      <label class="bp-mi-popover-label">Adjust</label>
      <input class="bp-mi-popover-input" [(ngModel)]="adjustDraft.name"        placeholder="Name"/>
      <input class="bp-mi-popover-input" [(ngModel)]="adjustDraft.description" placeholder="Description"/>
      <div class="bp-mi-popover-row">
        <input class="bp-mi-popover-input" type="number" min="0" step="1"
               [(ngModel)]="adjustDraft.price" placeholder="Price"/>
        <input class="bp-mi-popover-input" [(ngModel)]="adjustDraft.unit"
               placeholder="Unit (optional)"/>
      </div>
      <div class="bp-mi-popover-actions">
        <button type="button" class="bp-mi-btn" (click)="cancelAdjust()">Cancel</button>
        <button type="button" class="bp-mi-btn bp-mi-btn--primary"
                (click)="confirmAdjust()">Save adjustment</button>
      </div>
    </div>

    <!-- v1.65cx (p0011 §2) — Think popover. Calendar + a row of quick
         offsets. Picking any one fires the think action with that
         next_action_by ISO. -->
    <div *ngIf="thinkOpen" class="bp-mi-popover">
      <label class="bp-mi-popover-label">Think — back by</label>
      <div class="bp-mi-think-quick">
        <button type="button" class="bp-mi-btn" (click)="thinkPick(offsetHours(1))">In 1 hour</button>
        <button type="button" class="bp-mi-btn" (click)="thinkPick(offsetTomorrow9())">Tomorrow 9am</button>
        <button type="button" class="bp-mi-btn" (click)="thinkPick(offsetFriday())">Friday</button>
        <button type="button" class="bp-mi-btn" (click)="thinkPick(offsetWeek())">Next week</button>
      </div>
      <input type="datetime-local" class="bp-mi-popover-input"
             [(ngModel)]="thinkDraft"/>
      <div class="bp-mi-popover-actions">
        <button type="button" class="bp-mi-btn" (click)="cancelThink()">Cancel</button>
        <button type="button" class="bp-mi-btn bp-mi-btn--primary"
                [disabled]="!thinkDraft"
                (click)="confirmThink()">Set</button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    /* v1.65cx (p0011 §1) — row card cloned from the marketplace's
       .bp-list-row shape. TODO(p0011-§1-extract): move into a shared
       SCSS partial so catalogue-grid + this component point at one
       source. */
    .bp-mi-row {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 12px;
      border: var(--border-hairline);
      border-radius: var(--radius-button);
      background: var(--color-surface);
      cursor: default;
      transition: border-color 0.12s, box-shadow 0.12s, background 0.12s;
    }
    .bp-mi-row:hover { box-shadow: var(--shadow-xs); }
    .bp-mi-row--overdue { border-left: 2px solid var(--color-danger); }
    .bp-mi-row--pulsing { animation: bp-mi-pulse 1.2s ease-out 1; }
    @keyframes bp-mi-pulse {
      0%   { box-shadow: 0 0 0 0 var(--theme-accent); }
      40%  { box-shadow: 0 0 0 4px var(--theme-soft); }
      100% { box-shadow: var(--shadow-xs); }
    }

    /* Image — themed-tint rounded square + initials fallback. Matches
       .bp-list-img dimensions / radius. */
    .bp-mi-img {
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
    .bp-mi-img--img { background: var(--color-surface); border: var(--border-hairline); }
    .bp-mi-img img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .bp-mi-img-initial { line-height: 1; }

    /* Body — name (with inline pill), eyebrow underneath. */
    .bp-mi-body { flex: 1; min-width: 0; }
    .bp-mi-name {
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
      font-size: 14px; font-weight: 500;
      color: var(--color-text-primary);
      line-height: 1.3;
    }
    .bp-mi-name-text {
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      min-width: 0;
    }
    .bp-mi-pill {
      font-size: 9px; font-weight: 600;
      padding: 1px 7px;
      border-radius: var(--radius-pill);
      letter-spacing: 0.02em;
      white-space: nowrap;
    }
    .bp-mi-eyebrow {
      font-size: 11px;
      color: var(--color-text-muted);
      margin-top: 2px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .bp-mi-clock {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11px;
      color: var(--color-text-muted);
      margin-top: 2px;
    }
    .bp-mi-clock--overdue { color: var(--color-danger); }
    .bp-mi-clock--overdue lucide-icon { color: var(--color-danger); }

    /* Right column — price + unit. */
    .bp-mi-right { text-align: right; flex-shrink: 0; min-width: 80px; }
    .bp-mi-price {
      font-size: 13px; font-weight: 600;
      color: var(--color-text-primary);
      display: inline-flex; align-items: baseline; gap: 6px;
    }
    .bp-mi-price-was {
      color: var(--color-text-muted);
      text-decoration: line-through;
      font-weight: 500;
    }
    .bp-mi-price-now { color: var(--color-text-primary); }
    .bp-mi-unit { font-size: 10px; color: var(--color-text-muted); margin-top: 2px; }

    /* Action cluster — calm outlined pills. */
    .bp-mi-actions {
      display: inline-flex; gap: 6px; flex-shrink: 0;
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
      white-space: nowrap;
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

    /* Compact mode (summary header) — hide trailing actions. */
    .bp-mi-row--compact { cursor: pointer; }
    .bp-mi-row--compact .bp-mi-actions { display: none; }

    /* v1.65de (p0013 §4) — GRID variant. Mirrors the catalogue grid
       card (image on top + body underneath), with the +/♥/✉ cluster
       replaced by the state-aware action slot in the eyebrow position. */
    .bp-mi-grid {
      background: var(--color-surface);
      border: var(--border-hairline);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-xs);
      overflow: hidden;
      display: flex; flex-direction: column;
      transition: box-shadow 150ms ease, border-color 150ms ease;
    }
    .bp-mi-grid:hover { box-shadow: var(--shadow-sm); border-color: var(--theme-accent); }
    .bp-mi-grid--overdue { border-left: 2px solid var(--color-danger); }
    .bp-mi-grid-img {
      width: 100%; height: 140px;
      position: relative;
      background: var(--color-fill);
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
    }
    .bp-mi-grid-img img {
      width: 100%; height: 100%;
      object-fit: cover; display: block;
    }
    .bp-mi-grid-img--placeholder { background: var(--theme-soft); }
    .bp-mi-grid-img-letter {
      font-family: var(--font-display);
      font-size: 36px; font-weight: 600;
      color: var(--theme-accent);
    }
    .bp-mi-grid-pill {
      position: absolute;
      left: 8px; bottom: 8px;
      font-size: 10px; font-weight: 600;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      letter-spacing: 0.02em;
      box-shadow: var(--shadow-xs);
    }
    .bp-mi-grid-body { padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; }
    .bp-mi-grid-name {
      font-size: 13px; font-weight: 600;
      color: var(--color-text-primary);
      line-height: 1.3;
      overflow: hidden; text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }
    .bp-mi-grid-price {
      font-size: 14px; font-weight: 700;
      color: var(--color-text-primary);
      display: inline-flex; align-items: baseline; gap: 6px;
    }
    .bp-mi-grid-unit { font-size: 11px; font-weight: 400; color: var(--color-text-muted); }
    .bp-mi-grid-actions {
      display: flex; flex-wrap: wrap; gap: 6px;
      padding-top: 4px;
      /* No top border — the eyebrow slot the action cluster replaces
         doesn't need a divider. */
    }

    /* Popovers — appear immediately under the row. */
    .bp-mi-popover {
      margin-top: 6px;
      display: flex; flex-direction: column; gap: 6px;
      padding: 10px 12px;
      border: var(--border-hairline);
      border-radius: var(--radius-button);
      background: var(--color-surface);
      box-shadow: var(--shadow-sm);
    }
    .bp-mi-popover-label {
      font-size: 10px; font-weight: 600;
      color: var(--color-text-muted);
      text-transform: uppercase; letter-spacing: 0.06em;
    }
    .bp-mi-popover-select, .bp-mi-popover-input, .bp-mi-popover-note {
      font-family: var(--font-body);
      font-size: 12px;
      padding: 6px 8px;
      border: var(--border-hairline);
      border-radius: var(--radius-button);
      background: var(--color-surface);
    }
    .bp-mi-popover-note { min-height: 56px; resize: vertical; }
    .bp-mi-popover-row { display: flex; gap: 6px; }
    .bp-mi-popover-row .bp-mi-popover-input { flex: 1; }
    .bp-mi-popover-actions {
      display: flex; justify-content: flex-end; gap: 6px;
    }
    .bp-mi-think-quick { display: flex; flex-wrap: wrap; gap: 6px; }
  `]
})
export class MessageItemCardComponent {
  @Input() item: MessageItem | null = null;
  @Input() viewer: MessageItemViewer = 'agent';
  @Input() compact = false;
  /** v1.65de (p0013 §4) — row vs grid. Stream uses 'grid'; summary
      header + /brief items use 'row'. */
  @Input() layout: 'row' | 'grid' = 'row';
  /** Optional image override — when set, takes precedence over the
      initials fallback. Catalogue items would route their image_url
      through here; for now most rows have no asset. */
  @Input() imageUrl: string | null = null;
  /** Optional eyebrow override — when set, replaces the default
      "{description} / {Brief sent / Holding / …}" eyebrow. */
  @Input() eyebrowOverride: string | null = null;

  /** Decline-reason codelist (filtered + injected by the parent). */
  @Input() declineReasons: Array<{ code: string; label: string }> = [];

  @Output() action = new EventEmitter<MessageItemAction>();
  /** v1.65cx (p0011) — compact rows emit (rowClick) so the summary
      header can scroll-and-pulse the stream copy of this item. */
  @Output() rowClick = new EventEmitter<MessageItem>();

  // Inline edit state
  declineOpen = false;
  declineReason = '';
  declineNote = '';

  adjustOpen = false;
  adjustDraft: { name: string; description: string; price: number | null; unit: string } = {
    name: '', description: '', price: null, unit: ''
  };

  thinkOpen = false;
  thinkDraft = '';

  /** Animation flag set externally by parent (via @ViewChildren) to
      pulse the row when navigated-to from the summary header. */
  pulsing = false;

  constructor(private cdr: ChangeDetectorRef) {}

  // ── Display helpers ───────────────────────────────────────────────

  isOverdue(): boolean {
    const ts = this.item?.next_action_by;
    if (!ts) return false;
    const t = Date.parse(ts);
    return Number.isFinite(t) && t < Date.now();
  }

  hasPrice(): boolean {
    return !!(this.item?.price_current || this.item?.price_ref);
  }

  currentPrice(): number {
    return +(this.item?.price_current ?? this.item?.price_ref ?? 0) || 0;
  }

  priceChanged(): boolean {
    const r = +(this.item?.price_ref     ?? 0) || 0;
    const c = +(this.item?.price_current ?? 0) || 0;
    return r > 0 && c > 0 && r !== c;
  }

  initialOf(name?: string | null): string {
    const n = (name || '').trim();
    return n ? n.charAt(0).toUpperCase() : '?';
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

  eyebrowText(): string {
    if (this.eyebrowOverride != null) return this.eyebrowOverride;
    return (this.item?.description || '').trim();
  }

  formatClock(ts: string | null | undefined): string {
    if (!ts) return '';
    const d = new Date(ts);
    if (!Number.isFinite(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
           ' · ' +
           d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  // ── p0011 §2 — Symmetric action table ─────────────────────────────

  actionSet(): Array<{ kind: MessageItemAction['action']; label: string; disabled?: boolean; title?: string }> {
    const s = this.item?.status || '';
    const v = this.viewer;
    // Terminal — no actions.
    if (['booked', 'declined_by_supplier', 'declined_by_agent'].includes(s)) return [];

    // Accept is turn-based: shown only when the OTHER party made the
    // most recent move (i.e. the ball is in YOUR court).
    //   agent accepts:    quoted, adjusted_by_supplier
    //   supplier accepts: brief_sent, holding, adjusted_by_agent
    const canAccept = (v === 'agent'    && (s === 'quoted' || s === 'adjusted_by_supplier')) ||
                      (v === 'supplier' && (s === 'brief_sent' || s === 'holding' || s === 'adjusted_by_agent'));

    // Pay path — agent on accepted goes to booked.
    if (s === 'accepted') {
      if (v === 'agent') {
        return [
          { kind: 'pay',     label: 'Pay' },
          { kind: 'decline', label: 'Decline' },
          { kind: 'adjust',  label: 'Adjust' },
        ];
      }
      // supplier — Pay disabled, Decline + Adjust still available.
      return [
        { kind: 'pay',     label: 'Pay', disabled: true, title: 'Awaiting payment from agent' },
        { kind: 'decline', label: 'Decline' },
        { kind: 'adjust',  label: 'Adjust' },
      ];
    }

    // Standard branch — universal Think · Decline · Adjust, with
    // Accept prepended when the ball is in this viewer's court.
    const out: Array<{ kind: MessageItemAction['action']; label: string }> = [];
    if (canAccept) out.push({ kind: 'accept', label: 'Accept' });
    out.push({ kind: 'think',   label: 'Think'   });
    out.push({ kind: 'decline', label: 'Decline' });
    out.push({ kind: 'adjust',  label: 'Adjust'  });
    return out;
  }

  anyPopoverOpen(): boolean {
    return this.declineOpen || this.adjustOpen || this.thinkOpen;
  }

  // ── Event handlers ────────────────────────────────────────────────

  onRowClick(ev: MouseEvent): void {
    // Only fire rowClick in compact mode (summary header). In the
    // full row, the action buttons own the click target.
    if (this.compact && this.item) {
      this.rowClick.emit(this.item);
    }
  }

  onAction(kind: MessageItemAction['action'], ev?: MouseEvent): void {
    if (ev) ev.stopPropagation();
    if (kind === 'decline') { this.openDecline(); return; }
    if (kind === 'adjust')  { this.openAdjust();  return; }
    if (kind === 'think')   { this.openThink();   return; }
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

  // ── Think (clock) popover ─────────────────────────────────────────

  openThink(): void {
    const d = new Date();
    d.setHours(d.getHours() + 24);
    this.thinkDraft = this.toLocalInputValue(d);
    this.thinkOpen = true;
    this.cdr.markForCheck();
  }
  cancelThink(): void { this.thinkOpen = false; this.cdr.markForCheck(); }
  confirmThink(): void {
    if (!this.thinkDraft) return;
    const iso = new Date(this.thinkDraft).toISOString();
    this.action.emit({ action: 'think', next_action_by: iso });
    this.thinkOpen = false;
    this.cdr.markForCheck();
  }
  thinkPick(iso: string): void {
    this.action.emit({ action: 'think', next_action_by: iso });
    this.thinkOpen = false;
    this.cdr.markForCheck();
  }

  // Quick-offset helpers — all return ISO strings.
  offsetHours(h: number): string {
    const d = new Date(); d.setHours(d.getHours() + h);
    return d.toISOString();
  }
  offsetTomorrow9(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }
  offsetFriday(): string {
    const d = new Date();
    const diff = (5 - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }
  offsetWeek(): string {
    const d = new Date(); d.setDate(d.getDate() + 7);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }

  private toLocalInputValue(d: Date): string {
    // datetime-local needs "YYYY-MM-DDThh:mm" — no Z, no seconds.
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
           `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /** External hook — parent calls this on a @ViewChild ref to flash
      the row after a summary-header click. Falls back to a class
      toggle if Angular animations aren't available. */
  pulse(): void {
    this.pulsing = true;
    this.cdr.markForCheck();
    setTimeout(() => { this.pulsing = false; this.cdr.markForCheck(); }, 1300);
  }
}
