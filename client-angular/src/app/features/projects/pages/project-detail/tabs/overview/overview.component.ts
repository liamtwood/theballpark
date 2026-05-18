import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LucideAngularModule } from 'lucide-angular';

import { ProjectService } from '../../../../../../core/services/project.service';
import { ProjectItemService } from '../../../../../../core/services/project-item.service';
import { MessageService } from '../../../../../../core/services/message.service';
import { ClientService } from '../../../../../../core/services/client.service';
import {
  Project, ProjectCategory, ProjectItem, Message, Client
} from '../../../../../../models';
import { LoadingSpinnerComponent } from '../../../../../../shared/components/loading-spinner/loading-spinner.component';
import { EventDatePipe } from '../../../../../../shared/pipes/event-date.pipe';
import { CompactCurrencyPipe } from '../../../../../../shared/pipes/compact-currency.pipe';
import { GbpPipe } from '../../../../../../shared/pipes/gbp.pipe';

/**
 * v1.24 — Project Overview tab.
 *
 * Default landing tab on /projects/:id. Shows the health of the
 * project at a glance: a full-width event strip (date, venue, guests,
 * client lead) + four "inbox" cards (Brief, Marketplace, Estimate,
 * Messages) each with KPI counters and an action prompt.
 *
 * Every card is clickable — clicking anywhere on the card navigates
 * to the relevant tab. The "Open →" link is a visual affordance only.
 *
 * Data is aggregated from the existing services (no new endpoints):
 *   - ProjectService.getById / .getCategories
 *   - ProjectItemService.getByProject
 *   - MessageService.getByProject
 *   - ClientService.getById (only when project.client_id is set)
 *
 * If any source fails or is missing, the relevant card renders an
 * empty / zero state — the Overview never blocks on partial data.
 */

interface BriefSummary {
  total:    number;
  written:  number;
  toWrite:  number;
  missing:  string[];          // category names (up to 3 shown + overflow)
  updated:  string | null;     // most recent project_categories.updated_at
}

interface MarketplaceSummary {
  selected:  number;
  wishlist:  number;
  suppliers: number;
  emptyCats: string[];         // category names with zero items
  /** v1.24d: per-category breakdown for the icon circles. itemCount
      drives the greyed-out treatment on categories without items —
      same affordance as the marketplace's --unscoped circle style. */
  cats: Array<{
    id: string;
    name: string;
    iconName: string | null;
    iconColor: string | null;
    coverUrl: string | null;
    itemCount: number;
  }>;
}

interface EstimateSummary {
  estimated:  number;
  pending:    number;
  marginPct:  number | null;
  yourCost:   number;
  clientTotal:number;
  budget:     number | null;
  pctOfBudget:number | null;   // 0..2 ish, where 1.0 = exactly on budget
  overBudget: boolean;
  diff:       number;          // |client_total - budget|
}

interface MessagesSummary {
  contacted: number;
  replied:   number;
  quotes:    number;
  awaiting:  number;
  recent:    Array<{ supplier: string; preview: string; time: string }>;
}

@Component({
  selector: 'app-project-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, LucideAngularModule, LoadingSpinnerComponent,
    EventDatePipe, CompactCurrencyPipe, GbpPipe
  ],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading && project">
      <div class="bp-overview">

        <!-- ── EVENT STRIP ─────────────────────────────────────── -->
        <div class="bp-event-strip" (click)="goTo('event')">
          <div class="bp-event-cols">
            <div class="bp-event-col">
              <span class="bp-event-eyebrow">DATE</span>
              <span class="bp-event-value bp-event-value--num">{{ datePrimary || '—' }}</span>
              <span class="bp-event-sub">{{ dateRelative }}</span>
            </div>
            <div class="bp-event-col">
              <span class="bp-event-eyebrow">VENUE</span>
              <span class="bp-event-value">{{ project.venue_name || '—' }}</span>
              <span class="bp-event-sub">{{ project.venue_city || '' }}</span>
            </div>
            <div class="bp-event-col">
              <span class="bp-event-eyebrow">GUESTS</span>
              <span class="bp-event-value bp-event-value--num">{{ guestCount || '—' }}</span>
              <span class="bp-event-sub">{{ guestSub }}</span>
            </div>
            <div class="bp-event-col">
              <span class="bp-event-eyebrow">CLIENT LEAD</span>
              <span class="bp-event-value">{{ clientLeadName || '—' }}</span>
              <span class="bp-event-sub">{{ project.client_name || '' }}</span>
            </div>
          </div>
          <div class="bp-event-actions">
            <span *ngIf="runSheetPending" class="bp-event-badge">Run sheet pending</span>
            <a class="bp-event-link" (click)="goTo('event'); $event.stopPropagation()">
              Open event →
            </a>
          </div>
        </div>

        <!-- ── 2×2 CARD GRID ───────────────────────────────────── -->
        <div class="bp-overview-grid">

          <!-- BRIEF CARD -->
          <div class="bp-ov-card" (click)="goTo('brief')">
            <div class="bp-ov-head">
              <span class="bp-ov-label">BRIEF</span>
              <span class="bp-ov-status" *ngIf="brief.total > 0">{{ briefPct }}%</span>
            </div>
            <div class="bp-ov-content">
              <div class="bp-ov-kpis">
                <div class="bp-ov-kpi">
                  <span class="bp-ov-kpi-circle">{{ brief.total }}</span>
                  <span class="bp-ov-kpi-lab">CATEGORIES</span>
                </div>
                <div class="bp-ov-kpi">
                  <span class="bp-ov-kpi-circle">{{ brief.written }}</span>
                  <span class="bp-ov-kpi-lab">WRITTEN</span>
                </div>
                <div class="bp-ov-kpi">
                  <span class="bp-ov-kpi-circle bp-ov-kpi-circle--accent">{{ brief.toWrite }}</span>
                  <span class="bp-ov-kpi-lab">TO WRITE</span>
                </div>
              </div>
              <div class="bp-ov-body">
                <p class="bp-ov-prompt" *ngIf="brief.total === 0">
                  Start by selecting categories in the Brief tab
                </p>
                <p class="bp-ov-prompt" *ngIf="brief.total > 0 && brief.toWrite > 0">
                  {{ brief.toWrite }} {{ brief.toWrite === 1 ? 'brief' : 'briefs' }} to write
                </p>
                <p class="bp-ov-prompt bp-ov-prompt--done"
                   *ngIf="brief.total > 0 && brief.toWrite === 0">
                  All categories briefed
                  <lucide-icon name="check" [size]="14"></lucide-icon>
                </p>
                <div class="bp-ov-pills" *ngIf="brief.missing.length">
                  <span *ngFor="let name of brief.missing.slice(0, 3)"
                        class="bp-ov-pill">{{ name }}</span>
                  <span *ngIf="brief.missing.length > 3"
                        class="bp-ov-pill bp-ov-pill--more">+{{ brief.missing.length - 3 }}</span>
                </div>
              </div>
              <div class="bp-ov-foot">
                <span>{{ briefFooter }}</span>
                <span class="bp-ov-open">Open →</span>
              </div>
            </div>
          </div>

          <!-- MARKETPLACE CARD -->
          <div class="bp-ov-card" (click)="goTo('marketplace')">
            <div class="bp-ov-head">
              <span class="bp-ov-label">MARKETPLACE</span>
              <span class="bp-ov-status" *ngIf="market.cats.length > 0">{{ marketPct }}%</span>
            </div>
            <div class="bp-ov-content">
              <!-- KPI trio restored — same shape as Brief / Estimate /
                   Messages cards so the 4-card visual rhythm holds. -->
              <div class="bp-ov-kpis">
                <div class="bp-ov-kpi">
                  <span class="bp-ov-kpi-circle">{{ market.selected }}</span>
                  <span class="bp-ov-kpi-lab">SELECTED</span>
                </div>
                <div class="bp-ov-kpi">
                  <span class="bp-ov-kpi-circle">{{ market.wishlist }}</span>
                  <span class="bp-ov-kpi-lab">WISHLIST</span>
                </div>
                <div class="bp-ov-kpi">
                  <span class="bp-ov-kpi-circle">{{ market.suppliers }}</span>
                  <span class="bp-ov-kpi-lab">SUPPLIERS</span>
                </div>
              </div>

              <div class="bp-ov-body">
                <p class="bp-ov-prompt" *ngIf="market.cats.length === 0 && market.selected === 0">
                  Add items from the Marketplace after writing your brief
                </p>
                <p class="bp-ov-prompt"
                   *ngIf="market.cats.length > 0 && market.emptyCats.length > 0">
                  {{ market.emptyCats.length }}
                  {{ market.emptyCats.length === 1 ? 'category' : 'categories' }} empty
                </p>
                <p class="bp-ov-prompt bp-ov-prompt--done"
                   *ngIf="market.cats.length > 0 && market.emptyCats.length === 0 && market.selected > 0">
                  All categories have items
                  <lucide-icon name="check" [size]="14"></lucide-icon>
                </p>

                <!-- v1.24f: empty categories rendered as the
                     marketplace's bp-cat-circle treatment. Shows 3
                     at a time with left/right arrow buttons that
                     cycle through the list (wraps around the end).
                     Arrows only appear when there are more than 3
                     to scroll through. -->
                <div class="bp-ov-cats-scroller" *ngIf="emptyCatRows.length">
                  <button *ngIf="emptyCatRows.length > 3"
                          type="button"
                          class="bp-ov-cats-arrow"
                          (click)="scrollEmptyLeft($event)"
                          title="Previous">
                    <lucide-icon name="chevron-left" [size]="14"></lucide-icon>
                  </button>
                  <div class="bp-ov-cats">
                    <div *ngFor="let cat of visibleEmptyCats"
                         class="bp-ov-cat bp-ov-cat--empty"
                         [title]="cat.name + ' — no items'">
                      <div class="bp-ov-cat-circle">
                        <img *ngIf="cat.coverUrl"
                             [src]="cat.coverUrl"
                             [alt]="cat.name"
                             class="bp-ov-cat-img"/>
                        <lucide-icon *ngIf="!cat.coverUrl && cat.iconName"
                                     [name]="cat.iconName"
                                     [size]="18"></lucide-icon>
                        <span *ngIf="!cat.coverUrl && !cat.iconName"
                              class="bp-ov-cat-initial">{{ cat.name.charAt(0) }}</span>
                      </div>
                      <span class="bp-ov-cat-name">{{ cat.name }}</span>
                    </div>
                  </div>
                  <button *ngIf="emptyCatRows.length > 3"
                          type="button"
                          class="bp-ov-cats-arrow"
                          (click)="scrollEmptyRight($event)"
                          title="Next">
                    <lucide-icon name="chevron-right" [size]="14"></lucide-icon>
                  </button>
                </div>

                <p class="bp-ov-sub" *ngIf="market.wishlist > 0">
                  {{ market.wishlist }} awaiting client approval
                </p>
              </div>
              <div class="bp-ov-foot">
                <span>{{ marketFooter }}</span>
                <span class="bp-ov-open">Open →</span>
              </div>
            </div>
          </div>

          <!-- ESTIMATE CARD -->
          <div class="bp-ov-card" (click)="goTo('estimate')">
            <div class="bp-ov-head">
              <span class="bp-ov-label">ESTIMATE</span>
              <span class="bp-ov-status" *ngIf="estimateStatus">{{ estimateStatus }}</span>
            </div>
            <div class="bp-ov-content">
              <div class="bp-ov-kpis">
                <div class="bp-ov-kpi">
                  <span class="bp-ov-kpi-circle">{{ est.estimated }}</span>
                  <span class="bp-ov-kpi-lab">ESTIMATED</span>
                </div>
                <div class="bp-ov-kpi">
                  <span class="bp-ov-kpi-circle bp-ov-kpi-circle--accent">{{ est.pending }}</span>
                  <span class="bp-ov-kpi-lab">PENDING</span>
                </div>
                <div class="bp-ov-kpi">
                  <span class="bp-ov-kpi-circle">{{ est.marginPct != null ? est.marginPct : '—' }}</span>
                  <span class="bp-ov-kpi-lab">MARGIN (%)</span>
                </div>
              </div>
              <div class="bp-ov-body">
                <div class="bp-ov-money">
                  <span class="bp-ov-money-num">{{ est.yourCost | gbp }}</span>
                  <span class="bp-ov-money-lab">your cost</span>
                </div>
                <p class="bp-ov-sub" *ngIf="est.clientTotal > 0">
                  {{ est.clientTotal | gbp }} client total
                </p>
                <div class="bp-ov-budget" *ngIf="est.budget && est.budget > 0">
                  <div class="bp-ov-budget-bar">
                    <div class="bp-ov-budget-fill"
                         [class.bp-ov-budget-fill--over]="est.overBudget"
                         [style.width.%]="budgetBarWidth"></div>
                  </div>
                  <div class="bp-ov-budget-row">
                    <span class="bp-ov-budget-state"
                          [class.bp-ov-budget-state--over]="est.overBudget">
                      <lucide-icon [name]="est.overBudget ? 'alert-triangle' : 'check'" [size]="12"></lucide-icon>
                      {{ budgetPctLabel }} {{ est.overBudget ? 'over' : 'under' }} budget
                    </span>
                    <span class="bp-ov-budget-diff">
                      {{ est.diff | compactCurrency }} {{ est.overBudget ? 'to trim' : 'headroom' }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="bp-ov-foot">
                <span>Budget {{ est.budget && est.budget > 0 ? (est.budget | compactCurrency) : '—' }}</span>
                <span class="bp-ov-open">Open →</span>
              </div>
            </div>
          </div>

          <!-- MESSAGES CARD -->
          <div class="bp-ov-card" (click)="goTo('messages')">
            <div class="bp-ov-head">
              <span class="bp-ov-label">MESSAGES</span>
              <span *ngIf="messages.awaiting > 0"
                    class="bp-ov-notif">{{ messages.awaiting }}</span>
            </div>
            <div class="bp-ov-content">
              <div class="bp-ov-kpis">
                <div class="bp-ov-kpi">
                  <span class="bp-ov-kpi-circle">{{ messages.contacted }}</span>
                  <span class="bp-ov-kpi-lab">CONTACTED</span>
                </div>
                <div class="bp-ov-kpi">
                  <span class="bp-ov-kpi-circle">{{ messages.replied }}</span>
                  <span class="bp-ov-kpi-lab">REPLIED</span>
                </div>
                <div class="bp-ov-kpi">
                  <span class="bp-ov-kpi-circle bp-ov-kpi-circle--accent">{{ messages.quotes }}</span>
                  <span class="bp-ov-kpi-lab">QUOTES</span>
                </div>
              </div>
              <div class="bp-ov-body">
                <p class="bp-ov-prompt" *ngIf="messages.awaiting > 0">
                  {{ messages.awaiting }} awaiting your reply
                </p>
                <p class="bp-ov-prompt"
                   *ngIf="messages.contacted === 0 && messages.awaiting === 0">
                  No suppliers contacted yet
                </p>
                <p class="bp-ov-prompt"
                   *ngIf="messages.contacted > 0 && messages.awaiting === 0 && messages.quotes === 0">
                  No messages pending
                </p>
                <div class="bp-ov-list" *ngIf="messages.recent.length">
                  <div *ngFor="let row of messages.recent" class="bp-ov-list-row">
                    <span class="bp-ov-list-dot"></span>
                    <span class="bp-ov-list-name">{{ row.supplier }}</span>
                    <span class="bp-ov-list-preview">— {{ row.preview }}</span>
                    <span class="bp-ov-list-time">{{ row.time }}</span>
                  </div>
                </div>
                <p class="bp-ov-sub" *ngIf="messages.quotes > 0">
                  {{ messages.quotes }} {{ messages.quotes === 1 ? 'quote' : 'quotes' }} awaiting review
                </p>
              </div>
              <div class="bp-ov-foot">
                <span>{{ messagesFooter }}</span>
                <span class="bp-ov-open">Open →</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </ng-container>
  `,
  styles: [`
    :host { display: block; }

    .bp-overview {
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px 28px 40px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    /* ── EVENT STRIP ─────────────────────────────────────────── */
    .bp-event-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 16px 20px;
      background: var(--color-surface);
      border: var(--border-hairline);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-xs);
      cursor: pointer;
      transition: box-shadow 150ms ease, transform 150ms ease;
    }
    .bp-event-strip:hover {
      box-shadow: var(--shadow-sm);
      transform: translateY(-1px);
    }
    .bp-event-cols {
      display: grid;
      grid-template-columns: repeat(4, minmax(120px, 1fr));
      gap: 24px;
      flex: 1;
    }
    .bp-event-col {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .bp-event-eyebrow {
      font-family: var(--font-body);
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--theme-accent);
    }
    .bp-event-value {
      font-family: var(--font-body);
      font-size: 14px;
      font-weight: 500;
      color: var(--color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bp-event-value--num {
      font-family: var(--font-display);
      font-weight: 400;
      font-size: 18px;
      line-height: 1.1;
    }
    .bp-event-sub {
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 400;
      color: var(--color-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bp-event-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
    .bp-event-badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: var(--radius-pill);
      background: var(--color-waiting-bg);
      color: var(--color-waiting-text);
      border: 0.5px solid var(--color-waiting-border);
      font-size: 10px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .bp-event-link {
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 500;
      color: var(--theme-accent);
      cursor: pointer;
      white-space: nowrap;
    }
    .bp-event-link:hover { opacity: 0.75; }

    /* ── 2×2 GRID ───────────────────────────────────────────── */
    .bp-overview-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    @media (max-width: 760px) {
      .bp-overview-grid { grid-template-columns: 1fr; }
      .bp-event-cols    { grid-template-columns: 1fr 1fr; }
    }

    /* ── CARD CHROME ────────────────────────────────────────── */
    /* v1.24b: card no longer carries top padding — the dark header
       bar bleeds edge-to-edge. Inner .bp-ov-content owns the
       16px/18px content padding. overflow:hidden clips the dark
       header against the card's rounded corners. */
    .bp-ov-card {
      display: flex;
      flex-direction: column;
      background: var(--color-surface);
      border: var(--border-hairline);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-xs);
      cursor: pointer;
      overflow: hidden;
      transition: box-shadow 150ms ease, transform 150ms ease;
    }
    .bp-ov-card:hover {
      box-shadow: var(--shadow-sm);
      transform: translateY(-1px);
    }

    /* ── THEMED HEADER BAR ───────────────────────────────────── */
    /* v1.24c: banner uses --theme-accent + white text + Libre
       Franklin 500, identical to the "+ New Events" button on the
       dashboard so the whole product reads as one CTA / brand voice.
       Status pill / notif chip float to the right via absolute
       positioning so the centred title stays optically balanced. */
    .bp-ov-head {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px 16px;
      background: var(--theme-accent);
      color: var(--color-surface);
    }
    .bp-ov-label {
      font-family: var(--font-body);
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--color-surface);
    }
    .bp-ov-status {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      font-family: var(--font-body);
      font-size: 10px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 3px 10px;
      border-radius: var(--radius-pill);
      background: var(--color-surface);
      color: var(--theme-accent);
    }
    .bp-ov-notif {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 6px;
      border-radius: var(--radius-pill);
      background: var(--color-danger);
      color: #fff;
      font-size: 10px;
      font-weight: 600;
    }

    /* ── CONTENT WRAPPER ─────────────────────────────────────── */
    /* Holds everything below the dark header. Owns the card's
       internal padding now that .bp-ov-card itself is unpadded. */
    .bp-ov-content {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px 18px;
    }

    /* ── KPI ROW (centred + circled) ─────────────────────────── */
    /* v1.24c: numbers ride in 52px circles. Action circles (toWrite
       / pending / quotes) take the --theme-accent fill (matches the
       header bar + the "+ New Events" CTA) so they read as
       brand-linked call-outs; neutral circles take --theme-text
       (the darker foreground of the active preset) so they recede.
       Number font stays Playfair Display — that's Ballpark's
       numeric headline staple (dashboard KPIs, project totals). */
    .bp-ov-kpis {
      display: flex;
      justify-content: space-around;
      align-items: flex-start;
      gap: 12px;
      padding: 4px 0;
    }
    .bp-ov-kpi {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      min-width: 60px;
    }
    .bp-ov-kpi-circle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      /* v1.24h: neutral fill mirrors the hero banner's --theme-bg
         parchment so the Overview cards visually rhyme with the
         hero band above them. Dark --theme-text glyph keeps
         contrast through every preset. */
      background: var(--theme-bg);
      color: var(--theme-text);
      box-shadow: 0 0 0 0.5px var(--theme-border);
      font-family: var(--font-display);
      font-size: 22px;
      font-weight: 500;
      /* Optical centring: Playfair's lining figures sit a touch
         low in their bounding box. Tighten line-height to 1 and
         neutralise the descender slot so flexbox centres the visual
         glyph, not the metric box. */
      line-height: 1;
      text-align: center;
      padding-top: 1px;          /* lifts the numeral 1px so it sits dead-centre */
    }
    .bp-ov-kpi-circle--accent {
      background: var(--theme-accent);
      color: var(--color-surface);
    }
    .bp-ov-kpi-lab {
      font-family: var(--font-body);
      font-size: 9px;
      font-weight: 500;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      text-align: center;
    }

    /* ── MARKETPLACE CATEGORY CIRCLES (v1.24d) ───────────────── */
    /* Mirrors the marketplace tab's .bp-cat-circle strip — same
       icon-in-circle treatment, scaled down so a project's
       categories fit comfortably across the Overview card. Empty
       categories grey out (echoes the marketplace's --unscoped
       affordance) so the user can scan for gaps at a glance. */
    .bp-ov-cats {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 12px 16px;
      padding: 4px 0 2px;
    }
    .bp-ov-cat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      min-width: 48px;
      max-width: 72px;
    }
    .bp-ov-cat-circle {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--theme-bg);
      color: var(--theme-accent);
      box-shadow: 0 0 0 0.5px var(--color-border);
      overflow: hidden;
    }
    .bp-ov-cat-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .bp-ov-cat-initial {
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 400;
      color: var(--theme-accent);
    }
    /* Tiny count badge anchored bottom-right — shows how many items
       this category has selected. Hidden when zero (the greyed
       circle is enough signal). */
    .bp-ov-cat-count {
      position: absolute;
      bottom: -2px;
      right: -2px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: var(--radius-pill);
      background: var(--theme-accent);
      color: var(--color-surface);
      font-family: var(--font-body);
      font-size: 9px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      box-shadow: 0 0 0 1.5px var(--color-surface);
    }
    .bp-ov-cat-name {
      font-family: var(--font-body);
      font-size: 10px;
      font-weight: 500;
      color: var(--color-text-secondary);
      text-align: center;
      line-height: 1.2;
      max-width: 72px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* Empty-category state: greyed circle + muted label. Matches
       the marketplace's .bp-cat-circle-btn--unscoped treatment. */
    .bp-ov-cat--empty .bp-ov-cat-circle {
      filter: grayscale(0.85);
      opacity: 0.45;
    }
    .bp-ov-cat--empty .bp-ov-cat-name {
      color: var(--color-text-muted);
    }

    /* v1.24f: scroller wrap + arrow buttons. Mirrors the
       marketplace's .bp-circles-arrow style (32px in the original,
       28px here so the controls scale to the card). Stays centred
       and aligns vertically to the middle of the circle row, not
       the labels below it. */
    .bp-ov-cats-scroller {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      gap: 8px;
    }
    .bp-ov-cats-arrow {
      width: 28px;
      height: 28px;
      flex-shrink: 0;
      margin-top: 8px;     /* vertical-centre against the 44px circle */
      border-radius: 50%;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      color: var(--theme-accent);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.15s, background 0.15s;
    }
    .bp-ov-cats-arrow:hover {
      border-color: var(--theme-accent);
      background: var(--theme-bg);
    }

    /* Thin summary line below the category circles — replaces the
       trio of stat circles for this card only. */
    .bp-ov-stats {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      font-family: var(--font-body);
      font-size: 11px;
      color: var(--color-text-secondary);
      margin: 0;
    }
    .bp-ov-stats strong {
      font-weight: 600;
      color: var(--color-text-primary);
    }
    .bp-ov-stats-sep {
      color: var(--color-text-muted);
    }

    /* ── BODY (prompts, pills, list) ────────────────────────── */
    .bp-ov-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 64px;
    }
    .bp-ov-prompt {
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 500;
      color: var(--color-text-primary);
      margin: 0;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .bp-ov-prompt--done {
      color: var(--color-success-dark);
    }
    .bp-ov-sub {
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 400;
      color: var(--color-text-secondary);
      margin: 0;
    }
    .bp-ov-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
    .bp-ov-pill {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      font-family: var(--font-body);
      font-size: 10px;
      font-weight: 500;
      border-radius: var(--radius-pill);
      background: var(--theme-soft);
      border: var(--border-hairline);
      color: var(--color-text-primary);
    }
    .bp-ov-pill--more {
      color: var(--color-text-muted);
      background: transparent;
    }

    /* ── MONEY (Estimate card) ──────────────────────────────── */
    .bp-ov-money {
      display: inline-flex;
      align-items: baseline;
      gap: 6px;
    }
    .bp-ov-money-num {
      font-family: var(--font-display);
      font-size: 28px;
      font-weight: 400;
      color: var(--color-text-primary);
      line-height: 1;
    }
    .bp-ov-money-lab {
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 400;
      color: var(--color-text-muted);
    }

    /* ── BUDGET BAR (Estimate card) ─────────────────────────── */
    .bp-ov-budget { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
    .bp-ov-budget-bar {
      height: 6px;
      border-radius: var(--radius-pill);
      background: var(--theme-soft);
      overflow: hidden;
    }
    .bp-ov-budget-fill {
      height: 100%;
      background: var(--color-success);
      transition: width 200ms ease, background 200ms ease;
    }
    .bp-ov-budget-fill--over { background: var(--color-danger); }
    .bp-ov-budget-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      font-family: var(--font-body);
    }
    .bp-ov-budget-state {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 500;
      color: var(--color-success-dark);
    }
    .bp-ov-budget-state--over { color: var(--color-danger); }
    .bp-ov-budget-diff { color: var(--color-text-secondary); }

    /* ── MESSAGES LIST (Messages card) ──────────────────────── */
    .bp-ov-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .bp-ov-list-row {
      display: grid;
      grid-template-columns: auto auto 1fr auto;
      align-items: center;
      gap: 6px;
      font-family: var(--font-body);
      font-size: 11px;
      color: var(--color-text-primary);
    }
    .bp-ov-list-dot {
      width: 6px;
      height: 6px;
      border-radius: var(--radius-pill);
      background: var(--theme-accent);
      flex-shrink: 0;
    }
    .bp-ov-list-name { font-weight: 500; }
    .bp-ov-list-preview {
      color: var(--color-text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bp-ov-list-time {
      color: var(--color-text-muted);
      font-size: 10px;
      white-space: nowrap;
    }

    /* ── FOOT ───────────────────────────────────────────────── */
    .bp-ov-foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding-top: 8px;
      border-top: var(--border-hairline);
      font-family: var(--font-body);
      font-size: 11px;
      color: var(--color-text-muted);
    }
    .bp-ov-open {
      color: var(--theme-accent);
      font-weight: 500;
    }
  `]
})
export class OverviewComponent implements OnInit {
  loading = true;
  pid = '';

  project: Project | null = null;
  categories: ProjectCategory[] = [];
  items: ProjectItem[] = [];
  msgs: Message[] = [];
  client: Client | null = null;

  // Derived summaries — populated by recompute() once data lands.
  brief: BriefSummary = { total: 0, written: 0, toWrite: 0, missing: [], updated: null };
  market: MarketplaceSummary = { selected: 0, wishlist: 0, suppliers: 0, emptyCats: [], cats: [] };
  est: EstimateSummary = {
    estimated: 0, pending: 0, marginPct: null,
    yourCost: 0, clientTotal: 0, budget: null,
    pctOfBudget: null, overBudget: false, diff: 0
  };
  messages: MessagesSummary = {
    contacted: 0, replied: 0, quotes: 0, awaiting: 0, recent: []
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projSvc: ProjectService,
    private projItemSvc: ProjectItemService,
    private msgSvc: MessageService,
    private clientSvc: ClientService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // The Overview is mounted under /projects/:id — read the id from
    // the URL directly because ActivatedRoute.parent isn't always
    // resolvable on the first render with lazy children.
    const match = this.router.url.match(/\/projects\/([^\/]+)/);
    this.pid = match?.[1] || this.route.parent?.snapshot.paramMap.get('id') || '';

    if (!this.pid) { this.loading = false; this.cdr.markForCheck(); return; }

    forkJoin({
      project:    this.projSvc.getById(this.pid).pipe(catchError(() => of(null))),
      categories: this.projSvc.getCategories(this.pid).pipe(catchError(() => of([] as ProjectCategory[]))),
      items:      this.projItemSvc.getByProject(this.pid).pipe(catchError(() => of([] as ProjectItem[]))),
      messages:   this.msgSvc.getByProject(this.pid).pipe(catchError(() => of([] as Message[]))),
    }).subscribe(({ project, categories, items, messages }) => {
      this.project    = project;
      this.categories = categories || [];
      this.items      = items || [];
      this.msgs       = messages || [];

      // Client lookup is optional — only fire when there's a client_id
      // on the project. catchError keeps the Overview rendering even
      // if the /clients/:id endpoint 404s.
      if (project?.client_id) {
        this.clientSvc.getById(project.client_id).pipe(catchError(() => of(null))).subscribe(c => {
          this.client = c;
          this.loading = false;
          this.cdr.markForCheck();
        });
      } else {
        this.loading = false;
      }

      this.recompute();
      this.cdr.markForCheck();
    });
  }

  // ── NAVIGATION ───────────────────────────────────────────────

  goTo(tab: 'event' | 'brief' | 'marketplace' | 'estimate' | 'messages') {
    this.router.navigate([`/projects/${this.pid}/${tab}`]);
  }

  // ── DERIVATIONS ──────────────────────────────────────────────

  /** Aggregate the loaded data into the four card summaries. Called
      once on init after forkJoin resolves; no need to recompute on
      every change-detection cycle. */
  private recompute() {
    this.recomputeBrief();
    this.recomputeMarket();
    this.recomputeEstimate();
    this.recomputeMessages();
  }

  private recomputeBrief() {
    const cats = this.categories;
    const total = cats.length;
    const written = cats.filter(c => !!(c.requirement_brief && c.requirement_brief.trim().length > 0)).length;
    const toWrite = Math.max(0, total - written);
    const missing = cats
      .filter(c => !c.requirement_brief || c.requirement_brief.trim().length === 0)
      .map(c => c.category_name || c.name || 'Untitled');
    this.brief = {
      total, written, toWrite, missing,
      updated: this.mostRecent(cats.map(c => (c as any).updated_at).filter(Boolean) as string[]),
    };
  }

  private recomputeMarket() {
    const items = this.items;
    const selected  = items.filter(i => i.selection_type === 'selected').length;
    const wishlist  = items.filter(i => i.selection_type === 'liked').length;
    // Items themselves don't carry supplier_org_id in the project_items
    // join — use supplier_name as a fallback for distinct-counting.
    const supplierSet = new Set<string>();
    for (const i of items) {
      const key = (i as any).supplier_org_id || i.supplier_name;
      if (key) supplierSet.add(String(key));
    }
    const suppliers = supplierSet.size;

    // Categories with zero selected items. Use category_id matching
    // because project_items.project_category_id may be null on older
    // rows (see item-category fallback in ProjectItemService).
    const itemsByCat = new Map<string, number>();
    for (const i of items) {
      const cid = i.project_category_id || (i as any).item_category_id;
      if (!cid) continue;
      itemsByCat.set(cid, (itemsByCat.get(cid) || 0) + 1);
    }
    const emptyCats = this.categories
      .filter(c => (itemsByCat.get(c.category_id) || 0) === 0)
      .map(c => c.category_name || c.name || 'Untitled');

    // v1.24d: per-category icon row data. category_icon_name +
    // _color are joined onto project_categories by the server so we
    // don't need a separate categories lookup. Falls back to first
    // letter via .bp-ov-cat-initial in the template.
    const cats = this.categories.map(c => ({
      id:        c.category_id,
      name:      c.category_name || c.name || 'Untitled',
      iconName:  c.category_icon_name || null,
      iconColor: c.category_icon_color || null,
      coverUrl:  c.category_cover_image_url || null,
      itemCount: itemsByCat.get(c.category_id) || 0,
    }));

    this.market = { selected, wishlist, suppliers, emptyCats, cats };
  }

  private recomputeEstimate() {
    const cats = this.categories;
    // "Estimated" = categories with a non-zero base/client cost.
    // "Pending"   = the remainder. Avoids guessing at status enums
    // that vary across orgs.
    const estimated = cats.filter(c => (c.base_cost || 0) > 0 || (c.client_cost || 0) > 0).length;
    const pending = Math.max(0, cats.length - estimated);

    const yourCost    = this.sum(cats.map(c => +c.base_cost || 0));
    const clientTotal = this.sum(cats.map(c => +c.client_cost || 0));

    // Prefer the project-level rollup when present (server-side
    // calculation) — fall back to per-category sums otherwise.
    const projYourCost    = +((this.project as any)?.total_base_cost   || 0);
    const projClientTotal = +((this.project as any)?.total_client_cost || 0);

    const finalYourCost    = projYourCost    > 0 ? projYourCost    : yourCost;
    const finalClientTotal = projClientTotal > 0 ? projClientTotal : clientTotal;

    const marginPct = this.project?.default_margin_pct != null
      ? Math.round(+this.project.default_margin_pct)
      : null;

    const budget = (this.project?.project_budget && +this.project.project_budget > 0)
      ? +this.project.project_budget
      : null;
    const pctOfBudget = budget ? (finalClientTotal / budget) : null;
    const overBudget  = !!(budget && finalClientTotal > budget);
    const diff = budget ? Math.abs(finalClientTotal - budget) : 0;

    this.est = {
      estimated, pending, marginPct,
      yourCost: finalYourCost,
      clientTotal: finalClientTotal,
      budget, pctOfBudget, overBudget, diff,
    };
  }

  private recomputeMessages() {
    const msgs = this.msgs;
    const inbound  = msgs.filter(m => m.direction === 'inbound');
    const outbound = msgs.filter(m => m.direction === 'outbound');

    // Distinct supplier sets — fall back to sender_name when org id
    // isn't carried on the row.
    const contactedSet = new Set<string>();
    for (const m of outbound) {
      const key = m.supplier_org_id || m.sender_name;
      if (key) contactedSet.add(String(key));
    }
    const repliedSet = new Set<string>();
    for (const m of inbound) {
      const key = m.supplier_org_id || m.sender_name;
      if (key) repliedSet.add(String(key));
    }
    const quotes = msgs.filter(m => !!m.estimate_item_id).length;

    // Awaiting reply = inbound messages whose msg_status isn't 'read'.
    // The messages schema isn't fully unread-tracked yet (see prompt
    // note), so treat any inbound message with no read status as
    // unread for v1.
    const awaiting = inbound.filter(m => !m.msg_status || m.msg_status === 'unread').length;

    // Group inbound by supplier and take the most recent message per
    // supplier; show up to 3.
    const bySupplier = new Map<string, Message>();
    const sorted = [...inbound].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    for (const m of sorted) {
      const key = m.supplier_org_id || m.sender_name || m.id;
      if (!bySupplier.has(String(key))) bySupplier.set(String(key), m);
      if (bySupplier.size >= 3) break;
    }
    const recent = Array.from(bySupplier.values()).map(m => ({
      supplier: m.sender_name || 'Supplier',
      preview:  (m.body || '').slice(0, 40) + ((m.body || '').length > 40 ? '…' : ''),
      time:     this.relativeTime(m.created_at),
    }));

    this.messages = {
      contacted: contactedSet.size,
      replied:   repliedSet.size,
      quotes, awaiting, recent,
    };
  }

  // ── DERIVED GETTERS (template only) ──────────────────────────

  get datePrimary(): string {
    if (!this.project?.event_date) return '';
    const formatted = new EventDatePipe().transform(this.project.event_date);
    // EventDatePipe returns "02-Jun-2026 · in 20 days" — split off the
    // relative tail for the sub line.
    return formatted.includes(' · ') ? formatted.substring(0, formatted.indexOf(' · ')) : formatted;
  }
  get dateRelative(): string {
    if (!this.project?.event_date) return '';
    const formatted = new EventDatePipe().transform(this.project.event_date);
    return formatted.includes(' · ') ? formatted.substring(formatted.indexOf(' · ') + 3) : '';
  }
  get guestCount(): string {
    const n = this.project?.guest_count;
    return n ? new Intl.NumberFormat('en-GB').format(n) : '';
  }
  get guestSub(): string {
    // Quiet sub-line — leaves room for "80% confirmed" later when the
    // schema carries an attendance breakdown.
    return this.project?.guest_count ? 'guests expected' : '';
  }
  get clientLeadName(): string {
    return this.client?.contact_name || '';
  }

  /** Run-sheet badge: amber pill when the event is within 30 days
      AND there are still categories with no requirement_brief. */
  get runSheetPending(): boolean {
    if (!this.project?.event_date) return false;
    const d = new Date(this.project.event_date);
    if (isNaN(d.getTime())) return false;
    const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
    return days >= 0 && days <= 30 && this.brief.toWrite > 0;
  }

  get briefFooter(): string {
    if (!this.brief.updated) return 'No briefs written yet';
    return `Updated ${this.relativeTime(this.brief.updated)}`;
  }

  /** v1.24g: completion % shown as a header pill — same slot as
      the Estimate card's status pill. Brief = written / total,
      Marketplace = categoriesWithItems / total. */
  get briefPct(): number {
    if (this.brief.total === 0) return 0;
    return Math.round((this.brief.written / this.brief.total) * 100);
  }
  get marketPct(): number {
    const total = this.market.cats.length;
    if (total === 0) return 0;
    const filled = total - this.emptyCatRows.length;
    return Math.round((filled / total) * 100);
  }
  get marketFooter(): string {
    if (this.market.selected === 0) return 'No items selected yet';
    return `${this.market.selected} ${this.market.selected === 1 ? 'item' : 'items'} unspent`;
  }

  /** v1.24e: empty-category rows for the Marketplace card. Filters
      market.cats down to the zero-item ones — the template renders
      these as greyed icon circles in place of the old text pills. */
  get emptyCatRows() {
    return this.market.cats.filter(c => c.itemCount === 0);
  }

  /** v1.24f: rolling window of 3 empty-category circles. Wraps
      around the end of the list so scrolling feels circular —
      matches "circle through them" expectation. When the list is
      already ≤3 items we just return it as-is (arrows hidden). */
  emptyCatScroll = 0;
  get visibleEmptyCats() {
    const list = this.emptyCatRows;
    if (list.length <= 3) return list;
    const out = [];
    for (let i = 0; i < 3; i++) {
      out.push(list[(this.emptyCatScroll + i) % list.length]);
    }
    return out;
  }

  scrollEmptyLeft(event: MouseEvent) {
    // stopPropagation keeps the click from also firing the card's
    // (click)="goTo('marketplace')" navigation handler.
    event.stopPropagation();
    const len = this.emptyCatRows.length;
    if (len <= 3) return;
    this.emptyCatScroll = (this.emptyCatScroll - 1 + len) % len;
    this.cdr.markForCheck();
  }

  scrollEmptyRight(event: MouseEvent) {
    event.stopPropagation();
    const len = this.emptyCatRows.length;
    if (len <= 3) return;
    this.emptyCatScroll = (this.emptyCatScroll + 1) % len;
    this.cdr.markForCheck();
  }
  get messagesFooter(): string {
    if (this.messages.awaiting > 0) {
      return `${this.messages.awaiting} awaiting your reply`;
    }
    if (this.messages.contacted === 0) return 'No messages yet';
    return 'All caught up';
  }

  get budgetBarWidth(): number {
    if (!this.est.pctOfBudget) return 0;
    // Cap at 100% visually — the "over" colour communicates the
    // overshoot without needing a >100% bar.
    return Math.min(100, this.est.pctOfBudget * 100);
  }
  get budgetPctLabel(): string {
    if (this.est.pctOfBudget == null) return '0%';
    const pct = Math.round(Math.abs(1 - this.est.pctOfBudget) * 100);
    return `${pct}%`;
  }

  /** Simple project-level status pill (Draft / Active / Closed) —
      mirrors dashboard.projectStatus(). */
  get estimateStatus(): string {
    const s = (this.project?.status_name || '').toLowerCase();
    if (s === 'active' || s === 'costing') return 'Active';
    if (['closed', 'completed', 'cancelled'].includes(s)) return 'Closed';
    return 'Draft';
  }

  // ── UTILITIES ────────────────────────────────────────────────

  private sum(nums: number[]): number {
    return nums.reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);
  }

  private mostRecent(dates: string[]): string | null {
    if (!dates.length) return null;
    return dates.reduce((acc, d) => (d > acc ? d : acc), dates[0]);
  }

  /** Lightweight relative-time formatter for footers ("2h ago",
      "3d ago"). Falls back to the bare date for anything older
      than ~30 days. */
  private relativeTime(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const mins = Math.round(diffMs / 60_000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    const days = Math.round(hrs / 24);
    if (days < 7)  return `${days}d ago`;
    if (days < 30) return `${Math.round(days / 7)}w ago`;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }
}
