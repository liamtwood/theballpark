import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';

import { ProjectService } from '../../../../../../core/services/project.service';
import { ProjectCategoryService } from '../../../../../../core/services/project-category.service';
import { ProjectItemService } from '../../../../../../core/services/project-item.service';
import { CategoryService } from '../../../../../../core/services/category.service';
import { CodelistService } from '../../../../../../core/services/codelist.service';
import { OrgService } from '../../../../../../core/services/org.service';
import {
  Project, ProjectCategory, ProjectItem, Item, Category
} from '../../../../../../models';
import { LoadingSpinnerComponent } from '../../../../../../shared/components/loading-spinner/loading-spinner.component';
import { StatusBadgeComponent } from '../../../../../../shared/components/status-badge/status-badge.component';
import { GbpPipe } from '../../../../../../shared/pipes/gbp.pipe';
import {
  ItemDrawerComponent, ItemDrawerMode
} from '../../../../../../shared/components/item-drawer/item-drawer.component';

/**
 * Project Build tab — v1.18 unified Build/Estimate view.
 *
 * Two-column layout:
 *   - LEFT: compressed category cards. Each card collapses to a single
 *     row (icon · name · counts · brief dot · cost · status · chevron).
 *     Click to expand and reveal two sub-tabs: Items and Brief.
 *   - RIGHT: sticky estimate summary panel — subtotal, delivery (12%),
 *     contingency, your cost, margin, client total, budget indicator.
 *
 * Replaces the older "Build" tab (legacy vendor selection — preserved
 * at /supplier but no longer in the tab bar) AND the separate Estimate
 * tab (also dropped from the tab bar; route preserved for safety).
 *
 * The catalogue-grid Marketplace browse lives in marketplace.component.ts
 * at /marketplace.
 */

/** In-memory shape per expanded card — augments the joined
    ProjectCategory row with drawer/edit state. */
interface BuildCategoryRow extends ProjectCategory {
  /** Cached client-side: sum of selected items' base_price for this
      category. Updated on every cart refresh. */
  selectedCost: number;
  selectedCount: number;
  likedCount: number;
  /** Local drafts edited in the Brief tab — flushed to the server on
      blur via upsertBrief / updateDetail / updateBudget. */
  briefDraft: string;
  detailDraft: string;
  budgetDraft: number | null;
}

type CardTab = 'items' | 'brief';

@Component({
  selector: 'app-build',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, RouterModule,
    ButtonModule, InputTextModule, InputTextareaModule, InputNumberModule,
    ToastModule, LucideAngularModule,
    LoadingSpinnerComponent, StatusBadgeComponent,
    GbpPipe, ItemDrawerComponent
  ],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading">

      <!-- ═══════════════ EMPTY STATE ═══════════════
           No project_categories — direct the user to the Brief tab
           where they scope categories in. -->
      <div *ngIf="!categoryRows.length" class="bp-build-empty">
        <div class="bp-build-empty-icon">
          <lucide-icon name="file-text" [size]="40"></lucide-icon>
        </div>
        <h3 class="bp-build-empty-title">No categories scoped yet</h3>
        <p class="bp-build-empty-body">
          Head to the Brief tab to select categories and write your requirements.
        </p>
        <p-button label="Go to Brief →"
                  styleClass="p-button-outlined"
                  [routerLink]="['..', 'brief']">
        </p-button>
      </div>

      <!-- ═══════════════ MAIN LAYOUT ═══════════════ -->
      <div *ngIf="categoryRows.length" class="bp-build-page">

        <!-- ── HEADER ── -->
        <div class="bp-build-head">
          <div class="bp-build-head-title">Build</div>
          <div class="bp-build-head-sub">
            {{ categoryRows.length }} categor{{ categoryRows.length === 1 ? 'y' : 'ies' }}
            · {{ totalSelectedCount() }} item{{ totalSelectedCount() === 1 ? '' : 's' }} selected
          </div>
        </div>

        <div class="bp-build-grid">

          <!-- ═══════════════ LEFT: COMPRESSED CARDS ═══════════════ -->
          <div class="bp-build-cards">
            <div *ngFor="let row of categoryRows; trackBy: trackByRowId"
                 class="bp-build-card"
                 [class.expanded]="expandedCategoryId === row.id">

              <!-- ── Compressed row (always visible) ──────────────────
                   Single line: icon · name · counts · brief dot · cost
                   · status · chevron. Click anywhere to toggle expand. -->
              <button type="button"
                      class="bp-build-card-head"
                      (click)="toggleCategory(row)">
                <span class="bp-build-card-icon">
                  <lucide-icon *ngIf="row.category_icon_name"
                               [name]="row.category_icon_name"
                               [size]="18"></lucide-icon>
                  <span *ngIf="!row.category_icon_name" class="bp-build-card-initial">
                    {{ rowInitial(row) }}
                  </span>
                </span>

                <div class="bp-build-card-body">
                  <div class="bp-build-card-name">{{ rowName(row) }}</div>
                  <div class="bp-build-card-meta">
                    <ng-container *ngIf="row.selectedCount || row.likedCount; else noItems">
                      <!-- v1.18b: icon-based counts (✓ N  ♡ N) replace the
                           wordier "N selected · N liked" pattern — more
                           scannable per QC. -->
                      <span *ngIf="row.selectedCount" class="bp-build-count">
                        <lucide-icon name="check" [size]="11"></lucide-icon>
                        {{ row.selectedCount }}
                      </span>
                      <span *ngIf="row.likedCount" class="bp-build-count bp-build-count--liked">
                        <lucide-icon name="heart" [size]="11"></lucide-icon>
                        {{ row.likedCount }}
                      </span>
                    </ng-container>
                    <ng-template #noItems>
                      <span class="bp-build-card-empty-text">No items yet</span>
                    </ng-template>
                    <span class="bp-build-brief-dot"
                          [class.filled]="hasBrief(row)"
                          [title]="hasBrief(row) ? 'Brief written' : 'No brief yet'">
                    </span>
                  </div>
                </div>

                <div class="bp-build-card-cost">
                  {{ row.selectedCost ? (row.selectedCost | gbp) : '—' }}
                </div>

                <div class="bp-build-card-status">
                  <app-status-badge [statusName]="row.status_name || 'draft'"></app-status-badge>
                </div>

                <lucide-icon name="chevron-right"
                             [size]="16"
                             class="bp-build-card-chev"
                             [class.open]="expandedCategoryId === row.id">
                </lucide-icon>
              </button>

              <!-- ── Expanded body (one row at a time) ────────────── -->
              <div *ngIf="expandedCategoryId === row.id" class="bp-build-card-exp">

                <!-- Tab bar: Items / Brief (underline style). -->
                <div class="bp-build-card-tabs">
                  <button type="button"
                          class="bp-build-card-tab"
                          [class.active]="activeCardTab === 'items'"
                          (click)="activeCardTab = 'items'">
                    Items
                    <span *ngIf="row.selectedCount + row.likedCount as n"
                          class="bp-build-card-tab-count">{{ n }}</span>
                  </button>
                  <button type="button"
                          class="bp-build-card-tab"
                          [class.active]="activeCardTab === 'brief'"
                          (click)="activeCardTab = 'brief'">
                    Brief
                  </button>
                </div>

                <!-- ═══ ITEMS TAB ═══ -->
                <ng-container *ngIf="activeCardTab === 'items'">

                  <!-- Selected items -->
                  <div *ngIf="selectedItemsFor(row).length" class="bp-build-items-sec">
                    <div *ngFor="let pi of selectedItemsFor(row); trackBy: trackByItemId"
                         class="bp-build-item-row">
                      <app-status-badge *ngIf="pi.tier" [statusName]="tierLabel(pi.tier)"></app-status-badge>
                      <div class="bp-build-item-name">{{ pi.name }}</div>
                      <div class="bp-build-item-price">
                        <ng-container *ngIf="pi.base_price">
                          <span class="bp-build-item-unit-line" *ngIf="pi.unit && unitLabel(pi.unit)">
                            1 × {{ pi.base_price | gbp }}
                          </span>
                          <span class="bp-build-item-total">{{ pi.base_price | gbp }}</span>
                        </ng-container>
                      </div>
                      <div class="bp-build-item-actions">
                        <button type="button" class="bp-build-item-act"
                                title="View item"
                                (click)="onViewItem(pi)">
                          <lucide-icon name="eye" [size]="13"></lucide-icon>
                        </button>
                        <button type="button" class="bp-build-item-act"
                                title="Move to liked"
                                (click)="onMoveToLiked(pi)">
                          <lucide-icon name="heart" [size]="13"></lucide-icon>
                        </button>
                        <button type="button" class="bp-build-item-act bp-build-item-act--danger"
                                title="Remove from project"
                                (click)="onRemoveItem(pi)">
                          <lucide-icon name="x" [size]="13"></lucide-icon>
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Liked items (lighter visual treatment). -->
                  <div *ngIf="likedItemsFor(row).length" class="bp-build-items-sec bp-build-items-sec--liked">
                    <div class="bp-build-items-sec-label">Liked</div>
                    <div *ngFor="let pi of likedItemsFor(row); trackBy: trackByItemId"
                         class="bp-build-item-row bp-build-item-row--liked">
                      <lucide-icon name="heart" [size]="12" class="bp-build-item-heart"></lucide-icon>
                      <div class="bp-build-item-name">{{ pi.name }}</div>
                      <div class="bp-build-item-price">
                        <span *ngIf="pi.base_price" class="bp-build-item-total">{{ pi.base_price | gbp }}</span>
                      </div>
                      <div class="bp-build-item-actions">
                        <button type="button" class="bp-build-item-act"
                                title="Move up to selected"
                                (click)="onMoveToSelected(pi)">
                          <lucide-icon name="arrow-up" [size]="13"></lucide-icon>
                        </button>
                        <button type="button" class="bp-build-item-act bp-build-item-act--danger"
                                title="Remove from project"
                                (click)="onRemoveItem(pi)">
                          <lucide-icon name="x" [size]="13"></lucide-icon>
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Empty + Browse marketplace CTA. -->
                  <div *ngIf="!selectedItemsFor(row).length && !likedItemsFor(row).length"
                       class="bp-build-items-empty">
                    No items selected — browse the marketplace to add.
                  </div>

                  <button type="button" class="bp-build-browse-link"
                          (click)="onBrowseMarketplace(row)">
                    <lucide-icon name="plus" [size]="13"></lucide-icon>
                    Browse marketplace
                  </button>
                </ng-container>

                <!-- ═══ BRIEF TAB ═══ -->
                <ng-container *ngIf="activeCardTab === 'brief'">

                  <div class="bp-build-brief-field">
                    <label class="bp-build-brief-label">One-line requirement</label>
                    <input pInputText
                           [(ngModel)]="row.briefDraft"
                           (blur)="onBriefBlur(row)"
                           class="w-full bp-input-edit"
                           [placeholder]="'What you need from ' + (row.category_name || 'this category').toLowerCase() + ' suppliers — keep it short.'"/>
                  </div>

                  <div class="bp-build-brief-field">
                    <label class="bp-build-brief-label">Additional details</label>
                    <textarea pInputTextarea
                              [(ngModel)]="row.detailDraft"
                              (blur)="onDetailBlur(row)"
                              [rows]="4"
                              class="w-full bp-input-edit"
                              placeholder="Anything else suppliers should know — context, constraints, references.">
                    </textarea>
                  </div>

                  <div class="bp-build-brief-row">
                    <div class="bp-build-brief-field">
                      <label class="bp-build-brief-label">Budget</label>
                      <div class="bp-money-input">
                        <span class="bp-money-prefix">£</span>
                        <input pInputText
                               type="number"
                               min="0"
                               [(ngModel)]="row.budgetDraft"
                               (blur)="onBudgetBlur(row)"
                               class="w-full bp-input-edit bp-input-money"
                               placeholder="0"/>
                      </div>
                    </div>
                    <div class="bp-build-brief-field">
                      <label class="bp-build-brief-label">Ballpark cost</label>
                      <div class="bp-build-brief-cost-display">
                        {{ row.selectedCost ? (row.selectedCost | gbp) : '—' }}
                        <span class="bp-build-brief-cost-hint">from selected items</span>
                      </div>
                    </div>
                  </div>

                  <p-button *ngIf="hasBrief(row)"
                            label="Send brief to suppliers"
                            styleClass="bp-build-send-btn"
                            (onClick)="onSendBrief(row)">
                  </p-button>

                </ng-container>

              </div>
            </div>
          </div>

          <!-- ═══════════════ RIGHT: ESTIMATE SUMMARY ═══════════════ -->
          <aside class="bp-build-estimate">
            <div class="bp-build-est-title">Estimate</div>

            <!-- Category cost rows. Mirrors the compressed card's
                 icon-then-name pattern; falls back to an initial letter
                 when the category has no icon_name (matches Brief tab). -->
            <div class="bp-build-est-cats">
              <div *ngFor="let row of categoryRows; trackBy: trackByRowId"
                   class="bp-build-est-cat">
                <span class="bp-build-est-cat-icn">
                  <lucide-icon *ngIf="row.category_icon_name"
                               [name]="row.category_icon_name"
                               [size]="13"></lucide-icon>
                  <span *ngIf="!row.category_icon_name">{{ rowInitial(row) }}</span>
                </span>
                <span class="bp-build-est-cat-name" [title]="rowName(row)">
                  {{ rowName(row) }}
                </span>
                <span class="bp-build-est-cat-cost"
                      [class.muted]="!row.selectedCost">
                  {{ row.selectedCost ? (row.selectedCost | gbp) : '—' }}
                </span>
              </div>
            </div>

            <!-- Subtotal + adjustments -->
            <div class="bp-build-est-totals">
              <div class="bp-build-est-row">
                <span>Subtotal</span>
                <span>{{ subtotal | gbp }}</span>
              </div>
              <div class="bp-build-est-row">
                <span>Delivery &amp; setup (12%)</span>
                <span>{{ delivery | gbp }}</span>
              </div>
              <div class="bp-build-est-row">
                <span>Contingency ({{ contingencyPct }}%)</span>
                <span>{{ contingency | gbp }}</span>
              </div>
            </div>

            <!-- Your cost (big) -->
            <div class="bp-build-est-yours">
              <span class="bp-build-est-yours-lbl">Your cost</span>
              <span class="bp-build-est-yours-val">{{ yourCost | gbp }}</span>
            </div>

            <div class="bp-build-est-margin">
              <span>At {{ marginPct }}% margin</span>
              <span class="bp-build-est-client-total">
                {{ clientTotal | gbp }} client total
              </span>
            </div>

            <!-- Budget indicator (only when a budget is set) -->
            <div *ngIf="budget > 0" class="bp-build-budget"
                 [class.over]="clientTotal > budget">
              <div class="bp-build-budget-h">
                <lucide-icon [name]="clientTotal <= budget ? 'check-square' : 'alert-triangle'"
                             [size]="13"></lucide-icon>
                <span class="bp-build-budget-state">
                  {{ clientTotal <= budget ? 'Within budget' : 'Over budget' }}
                </span>
                <span class="bp-build-budget-diff">
                  {{ clientTotal <= budget ? '-' : '+' }}{{ absBudgetDiff | gbp }}
                </span>
              </div>
              <div class="bp-build-budget-bar">
                <div class="bp-build-budget-bar-fill" [style.width.%]="barPct"></div>
              </div>
              <div class="bp-build-budget-foot">
                <span>Client {{ clientTotal | gbp }}</span>
                <span>Budget {{ budget | gbp }}</span>
              </div>
              <div class="bp-build-budget-msg">
                {{ budgetMessage }}
              </div>
            </div>

            <!-- AI insight placeholder — real data wires in a later prompt. -->
            <div class="bp-build-insight">
              <div class="bp-build-insight-label">AI INSIGHT</div>
              <p class="bp-build-insight-body">
                Similar events average {{ insightAverage | gbp }}. Your estimate is within
                normal range for this spec.
              </p>
            </div>

            <p-button label="Messages →"
                      styleClass="bp-build-messages-btn w-full"
                      [routerLink]="['..', 'messages']">
            </p-button>
          </aside>

        </div>
      </div>
    </ng-container>

    <!-- Shared item drawer — view mode triggered from the items list. -->
    <app-item-drawer
      [(visible)]="showItemDrawer"
      [mode]="drawerMode"
      [item]="drawerItem"
      (cancelled)="drawerItem = null">
    </app-item-drawer>

    <p-toast></p-toast>
  `,
  styles: [`
    :host { display: block; }

    /* ── EMPTY STATE ─────────────────────────────────────────────── */
    .bp-build-empty {
      text-align: center;
      padding: 80px 24px;
      max-width: 480px;
      margin: 0 auto;
    }
    .bp-build-empty-icon {
      display: inline-flex;
      width: 64px; height: 64px;
      border-radius: 50%;
      background: var(--theme-bg);
      align-items: center; justify-content: center;
      color: var(--theme-accent);
      margin-bottom: 18px;
    }
    .bp-build-empty-title {
      font-family: var(--font-display);
      font-size: 22px; font-weight: 400;
      color: var(--color-text-primary);
      margin-bottom: 8px;
    }
    .bp-build-empty-body {
      font-size: 14px;
      color: var(--color-text-muted);
      margin-bottom: 20px;
      line-height: 1.55;
    }

    /* ── PAGE + HEADER ───────────────────────────────────────────── */
    .bp-build-page {
      max-width: 1180px;
      margin: 0 auto;
      padding: 24px 28px 60px;
    }
    .bp-build-head {
      text-align: center;
      margin-bottom: 24px;
    }
    .bp-build-head-title {
      font-family: var(--font-display);
      font-size: 22px; font-weight: 400;
      color: var(--color-text-primary);
    }
    .bp-build-head-sub {
      font-size: 12px;
      color: var(--color-text-muted);
      margin-top: 2px;
    }

    /* ── TWO-COLUMN GRID ─────────────────────────────────────────── */
    /* v1.18b: right column bumped 280→320 so category names breathe.
       The estimate panel itself sets the same explicit width below. */
    .bp-build-grid {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 24px;
      align-items: start;
    }
    @media (max-width: 880px) {
      .bp-build-grid { grid-template-columns: 1fr; }
    }

    /* ── COMPRESSED CARD ─────────────────────────────────────────── */
    .bp-build-cards { display: flex; flex-direction: column; gap: 8px; }
    .bp-build-card {
      border: 0.5px solid var(--color-border);
      border-left: 3px solid var(--theme-accent);
      border-radius: 10px;
      background: var(--color-surface);
      overflow: hidden;
      transition: border-color 0.15s;
    }
    .bp-build-card:hover { border-color: var(--theme-accent); }
    .bp-build-card.expanded { border-color: var(--theme-accent); }

    /* Compressed row — single line, click target. */
    .bp-build-card-head {
      display: grid;
      grid-template-columns: 40px 1fr auto auto 18px;
      align-items: center;
      gap: 14px;
      padding: 12px 14px;
      width: 100%;
      background: none;
      border: none;
      text-align: left;
      cursor: pointer;
      font-family: var(--font-body);
    }
    .bp-build-card-head:hover { background: var(--theme-bg); }
    .bp-build-card-icon {
      width: 36px; height: 36px;
      border-radius: 50%;
      background: var(--theme-bg);
      display: flex; align-items: center; justify-content: center;
      color: var(--theme-accent);
      flex-shrink: 0;
    }
    .bp-build-card-initial {
      font-family: var(--font-display);
      font-size: 16px; font-weight: 600;
      color: var(--theme-accent);
    }
    .bp-build-card-body { min-width: 0; }
    .bp-build-card-name {
      font-size: 14px; font-weight: 500;
      color: var(--color-text-primary);
      line-height: 1.3;
    }
    .bp-build-card-meta {
      font-size: 11px;
      color: var(--color-text-muted);
      margin-top: 2px;
      display: flex; align-items: center; gap: 10px;
    }
    /* v1.18b: icon-and-number count chips replace the "N selected · N liked"
       text counts — more scannable. ✓ = selected (theme accent),
       ♡ = liked (red). */
    .bp-build-count {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 11px;
      font-weight: 600;
      color: var(--theme-accent);
      font-variant-numeric: tabular-nums;
    }
    .bp-build-count--liked { color: var(--color-danger); }
    .bp-build-card-empty-text { font-style: italic; }
    .bp-build-brief-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      border: 1px solid var(--color-text-muted);
      background: transparent;
      flex-shrink: 0;
      display: inline-block;
    }
    .bp-build-brief-dot.filled {
      background: var(--theme-accent);
      border-color: var(--theme-accent);
    }
    .bp-build-card-cost {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-primary);
      font-variant-numeric: tabular-nums;
    }
    .bp-build-card-status { display: flex; align-items: center; }
    .bp-build-card-chev {
      color: var(--color-text-muted);
      transition: transform 0.18s;
    }
    .bp-build-card-chev.open { transform: rotate(90deg); }

    /* Expanded body. */
    .bp-build-card-exp {
      border-top: 0.5px solid var(--color-border);
      padding: 16px 18px 18px;
      background: var(--color-surface);
    }

    /* Card tab bar — same underline pattern as drawer tabs. */
    .bp-build-card-tabs {
      display: flex; gap: 0;
      border-bottom: 0.5px solid var(--color-border);
      margin-bottom: 14px;
    }
    .bp-build-card-tab {
      padding: 8px 14px;
      font-size: 12px; font-weight: 500;
      color: var(--color-text-muted);
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      font-family: var(--font-body);
      margin-bottom: -0.5px;
      transition: color 0.15s, border-color 0.15s;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .bp-build-card-tab:hover { color: var(--color-text-primary); }
    .bp-build-card-tab.active {
      color: var(--theme-accent);
      border-bottom-color: var(--theme-accent);
    }
    .bp-build-card-tab-count {
      display: inline-flex; align-items: center;
      min-width: 18px;
      padding: 1px 6px;
      font-size: 10px; font-weight: 600;
      color: var(--color-text-muted);
      background: var(--theme-bg);
      border-radius: 10px;
    }
    .bp-build-card-tab.active .bp-build-card-tab-count {
      color: var(--theme-accent);
    }

    /* ── ITEMS TAB ───────────────────────────────────────────────── */
    .bp-build-items-sec { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    .bp-build-items-sec--liked { opacity: 0.92; }
    .bp-build-items-sec-label {
      font-size: 10px; font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin: 6px 0 2px;
    }
    .bp-build-item-row {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border: 0.5px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
    }
    .bp-build-item-row--liked {
      border-style: dashed;
      background: transparent;
    }
    .bp-build-item-heart {
      color: #E11D48;
      flex-shrink: 0;
    }
    .bp-build-item-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--color-text-primary);
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bp-build-item-price {
      display: flex; flex-direction: column; align-items: flex-end;
      font-size: 11px;
      color: var(--color-text-muted);
      font-variant-numeric: tabular-nums;
    }
    .bp-build-item-unit-line { font-size: 10px; }
    .bp-build-item-total {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-primary);
    }
    .bp-build-item-actions { display: flex; gap: 4px; }
    .bp-build-item-act {
      width: 22px; height: 22px;
      border-radius: 50%;
      border: 0.5px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-muted);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: color 0.15s, border-color 0.15s;
    }
    .bp-build-item-act:hover {
      color: var(--theme-accent);
      border-color: var(--theme-accent);
    }
    .bp-build-item-act--danger:hover {
      color: var(--color-danger);
      border-color: var(--color-danger);
    }

    .bp-build-items-empty {
      font-size: 12px;
      color: var(--color-text-muted);
      font-style: italic;
      padding: 10px 0 14px;
    }

    .bp-build-browse-link {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 6px 0;
      font-size: 12px;
      font-weight: 500;
      color: var(--theme-accent);
      background: none;
      border: none;
      cursor: pointer;
      font-family: var(--font-body);
    }
    .bp-build-browse-link:hover { opacity: 0.75; }

    /* ── BRIEF TAB ───────────────────────────────────────────────── */
    .bp-build-brief-field { margin-bottom: 12px; }
    .bp-build-brief-label {
      display: block;
      font-size: 11px;
      font-weight: 500;
      color: var(--color-text-secondary);
      margin-bottom: 4px;
      font-family: var(--font-body);
    }
    .bp-build-brief-row {
      display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
    }
    .bp-build-brief-cost-display {
      padding: 8px 10px;
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-primary);
      background: var(--theme-bg);
      border: 0.5px solid var(--theme-border);
      border-radius: 8px;
      min-height: 38px;
      display: flex; align-items: center; gap: 6px;
    }
    .bp-build-brief-cost-hint {
      font-size: 10px;
      font-weight: 400;
      color: var(--color-text-muted);
      letter-spacing: 0.02em;
    }

    /* Money input — copied from item-drawer pattern. */
    .bp-money-input { position: relative; display: flex; align-items: center; }
    .bp-money-prefix {
      position: absolute;
      left: 10px;
      font-size: 13px;
      color: var(--color-text-muted);
      pointer-events: none;
    }
    .bp-input-money { padding-left: 22px !important; }

    :host ::ng-deep .bp-build-send-btn.p-button {
      background: var(--color-text-primary) !important;
      border-color: var(--color-text-primary) !important;
      color: var(--color-surface) !important;
      font-weight: 600 !important;
      margin-top: 8px;
    }
    :host ::ng-deep .bp-build-send-btn.p-button:hover {
      filter: brightness(1.15);
    }

    /* ── ESTIMATE SUMMARY PANEL ──────────────────────────────────── */
    /* v1.18b: width matched to grid column (320px). Padding adjusted
       so category names get more room before truncating. */
    .bp-build-estimate {
      position: sticky;
      top: 20px;
      width: 320px;
      padding: 16px 18px;
      border: 0.5px solid var(--color-border);
      border-radius: 10px;
      background: var(--color-surface);
      font-family: var(--font-body);
    }
    .bp-build-est-title {
      font-family: var(--font-display);
      font-size: 16px; font-weight: 400;
      color: var(--color-text-primary);
      margin-bottom: 12px;
    }
    .bp-build-est-cats { display: flex; flex-direction: column; gap: 2px; margin-bottom: 10px; }
    .bp-build-est-cat {
      display: grid;
      grid-template-columns: 18px 1fr auto;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      font-size: 12px;
      color: var(--color-text-primary);
      border-bottom: 0.5px solid var(--color-border);
    }
    .bp-build-est-cat:last-child { border-bottom: none; }
    /* v1.18b: icon-or-initial container — keeps the column aligned
       whether a category has icon_name or only an initial fallback. */
    .bp-build-est-cat-icn {
      width: 18px; height: 18px;
      display: inline-flex;
      align-items: center; justify-content: center;
      color: var(--theme-accent);
      font-family: var(--font-display);
      font-size: 13px; font-weight: 600;
      flex-shrink: 0;
    }
    .bp-build-est-cat-name {
      min-width: 0; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
    }
    .bp-build-est-cat-cost { font-weight: 500; font-variant-numeric: tabular-nums; }
    .bp-build-est-cat-cost.muted { color: var(--color-text-muted); }

    .bp-build-est-totals {
      padding: 10px 0;
      border-top: 0.5px solid var(--color-border);
      border-bottom: 0.5px solid var(--color-border);
    }
    .bp-build-est-row {
      display: flex; justify-content: space-between;
      padding: 3px 0;
      font-size: 12px;
      color: var(--color-text-muted);
      font-variant-numeric: tabular-nums;
    }
    .bp-build-est-yours {
      display: flex; align-items: baseline; justify-content: space-between;
      padding: 14px 0 2px;
    }
    .bp-build-est-yours-lbl {
      font-family: var(--font-display);
      font-size: 16px;
      color: var(--color-text-primary);
    }
    .bp-build-est-yours-val {
      font-family: var(--font-display);
      font-size: 22px; font-weight: 700;
      color: var(--color-text-primary);
      font-variant-numeric: tabular-nums;
    }
    .bp-build-est-margin {
      display: flex; justify-content: space-between;
      padding: 6px 0 14px;
      font-size: 11px;
      color: var(--color-text-muted);
    }
    .bp-build-est-client-total {
      font-weight: 600;
      color: var(--color-text-secondary);
    }

    /* Budget card — neutral CSS-variable theming so under/over read
       semantically without hardcoded greens/reds (the existing
       estimate.component.ts used hardcoded hex; v1.18 follows
       WORKING_STANDARDS and pulls from CSS variables). */
    .bp-build-budget {
      border: 0.5px solid var(--theme-border);
      background: var(--theme-bg);
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 14px;
    }
    .bp-build-budget.over {
      border-color: var(--color-danger);
      background: rgba(225, 29, 72, 0.06);
    }
    .bp-build-budget-h {
      display: flex; align-items: center; gap: 6px;
      margin-bottom: 6px;
    }
    .bp-build-budget-h lucide-icon { color: var(--theme-accent); }
    .bp-build-budget.over .bp-build-budget-h lucide-icon { color: var(--color-danger); }
    .bp-build-budget-state {
      flex: 1;
      font-size: 12px; font-weight: 600;
      color: var(--theme-accent);
    }
    .bp-build-budget.over .bp-build-budget-state { color: var(--color-danger); }
    .bp-build-budget-diff {
      font-size: 12px; font-weight: 600;
      color: var(--theme-accent);
      font-variant-numeric: tabular-nums;
    }
    .bp-build-budget.over .bp-build-budget-diff { color: var(--color-danger); }
    .bp-build-budget-bar {
      height: 5px;
      border-radius: 20px;
      background: rgba(0, 0, 0, 0.08);
      overflow: hidden;
      margin-bottom: 5px;
    }
    .bp-build-budget-bar-fill {
      height: 100%;
      background: var(--theme-accent);
      border-radius: 20px;
      max-width: 100%;
      transition: width 0.3s;
    }
    .bp-build-budget.over .bp-build-budget-bar-fill { background: var(--color-danger); }
    .bp-build-budget-foot {
      display: flex; justify-content: space-between;
      font-size: 10px;
      color: var(--color-text-muted);
      margin-bottom: 4px;
    }
    .bp-build-budget-msg {
      font-size: 10px;
      color: var(--color-text-secondary);
      line-height: 1.45;
    }

    .bp-build-insight {
      background: var(--theme-bg);
      border: 0.5px solid var(--theme-border);
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 14px;
    }
    .bp-build-insight-label {
      font-size: 10px; font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--theme-accent);
      margin-bottom: 4px;
    }
    .bp-build-insight-body {
      font-size: 11px;
      color: var(--color-text-secondary);
      line-height: 1.5;
      margin: 0;
    }

    :host ::ng-deep .bp-build-messages-btn.p-button {
      background: var(--color-text-primary) !important;
      border-color: var(--color-text-primary) !important;
      color: var(--color-surface) !important;
      font-weight: 600 !important;
    }
    :host ::ng-deep .bp-build-messages-btn.p-button:hover {
      filter: brightness(1.15);
    }
  `]
})
export class BuildComponent implements OnInit {
  loading = true;
  categoryRows: BuildCategoryRow[] = [];
  projectItems: ProjectItem[] = [];

  /** id of the project_category whose card is currently expanded. */
  expandedCategoryId: string | null = null;
  /** Active sub-tab on the expanded card. */
  activeCardTab: CardTab = 'items';

  // Project meta
  private project: Project | null = null;
  projectId = '';
  budget = 0;
  contingencyPct = 10;
  marginPct = 20;

  // Estimate totals — recomputed whenever items or category rows change.
  subtotal = 0;
  delivery = 0;
  contingency = 0;
  yourCost = 0;
  clientTotal = 0;
  budgetDiff = 0;
  absBudgetDiff = 0;
  barPct = 0;
  budgetMessage = '';
  /** Placeholder for AI insight average — within ±15% of clientTotal so
      the message reads sensibly. Real insight data wires later. */
  insightAverage = 0;

  // Categories index — used to walk parent chain when grouping items.
  private allCategories: Category[] = [];

  // Drawer state (view-only from the items list).
  showItemDrawer = false;
  drawerMode: ItemDrawerMode = 'view';
  drawerItem: Item | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectSvc: ProjectService,
    private projectCategorySvc: ProjectCategoryService,
    private projectItemSvc: ProjectItemService,
    private categorySvc: CategoryService,
    private codelistSvc: CodelistService,
    private orgSvc: OrgService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Walk parents until we find the project id (lives on /projects/:id).
    let r: ActivatedRoute | null = this.route;
    let pid = '';
    while (r && !pid) {
      pid = r.snapshot.paramMap.get('id') || '';
      r = r.parent;
    }
    this.projectId = pid;
    if (!pid) { this.loading = false; return; }

    forkJoin({
      project:        this.projectSvc.getById(pid),
      // Use ProjectService.getCategories — it hits /projects/:pid/categories
      // which calls the joined ProjectCategoryService.getByProject() on the
      // server, returning category_name, category_icon_name, etc. The
      // shorter projectCategorySvc.getByProject() goes via /project-categories?
      // project_id=X which calls the un-joined getAll() and leaves the
      // category fields undefined — that was the v1.18a "? icon" bug.
      projectCats:    this.projectSvc.getCategories(pid),
      cart:           this.projectItemSvc.getByProject(pid),
      allCategories:  this.categorySvc.getAll('catalogue'),
      org:            this.orgSvc.getCurrentOrg()
    }).subscribe({
      next: ({ project, projectCats, cart, allCategories, org }) => {
        this.project = project || null;
        this.allCategories = allCategories || [];
        this.budget         = Number(project?.project_budget) || 0;
        this.contingencyPct = project?.default_contingency_pct
                            ?? org?.default_contingency_pct
                            ?? 10;
        this.marginPct      = project?.default_margin_pct
                            ?? org?.default_margin_pct
                            ?? 20;

        // Filter actives + build the local row state.
        const actives = (projectCats || []).filter(c => c.is_active);
        this.categoryRows = actives.map(pc => this.toRow(pc));
        this.projectItems = cart || [];

        this.recomputeAll();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  // ── Row state ────────────────────────────────────────────────────────

  private toRow(pc: ProjectCategory): BuildCategoryRow {
    return {
      ...pc,
      selectedCost: 0,
      selectedCount: 0,
      likedCount: 0,
      briefDraft: pc.requirement_brief || '',
      detailDraft: pc.requirement_detail || '',
      budgetDraft: pc.ballpark_budget != null ? Number(pc.ballpark_budget) : null
    };
  }

  trackByRowId = (_: number, r: BuildCategoryRow) => r.id;
  trackByItemId = (_: number, pi: ProjectItem) => pi.id;

  // ── Item bucketing ───────────────────────────────────────────────────

  /** Items in this category that the project has selected.
      Match order: explicit project_category_id first, then by item's
      category_id (direct or via parent chain). */
  selectedItemsFor(row: BuildCategoryRow): ProjectItem[] {
    return this.projectItems.filter(pi =>
      pi.selection_type === 'selected' && this.belongsToCategory(pi, row)
    );
  }

  likedItemsFor(row: BuildCategoryRow): ProjectItem[] {
    return this.projectItems.filter(pi =>
      pi.selection_type === 'liked' && this.belongsToCategory(pi, row)
    );
  }

  private belongsToCategory(pi: ProjectItem, row: BuildCategoryRow): boolean {
    // Direct link.
    if (pi.project_category_id && pi.project_category_id === row.id) return true;
    // Fallback: match by item's category id (or its ancestor) to the
    // project_category's category_id. Covers older rows added pre-v1.18
    // that lack project_category_id.
    if (pi.project_category_id) return false; // honour explicit link
    return this.categoryMatches(pi.item_category_id, row.category_id);
  }

  private categoryMatches(itemCatId?: string | null, pcCategoryId?: string): boolean {
    if (!itemCatId || !pcCategoryId) return false;
    if (itemCatId === pcCategoryId) return true;
    // Walk up the parent chain.
    let current = this.allCategories.find(c => c.id === itemCatId);
    let guard = 6;
    while (current && current.parent_id && guard-- > 0) {
      if (current.parent_id === pcCategoryId) return true;
      current = this.allCategories.find(c => c.id === current!.parent_id);
    }
    return false;
  }

  // ── Totals ───────────────────────────────────────────────────────────

  totalSelectedCount(): number {
    return this.categoryRows.reduce((s, r) => s + r.selectedCount, 0);
  }

  hasBrief(row: BuildCategoryRow): boolean {
    return !!(row.requirement_brief && row.requirement_brief.trim().length);
  }

  /** Refresh per-row costs/counts and the right-column totals. Called
      whenever projectItems / categoryRows change. */
  private recomputeAll() {
    for (const row of this.categoryRows) {
      const selected = this.selectedItemsFor(row);
      const liked = this.likedItemsFor(row);
      row.selectedCount = selected.length;
      row.likedCount = liked.length;
      row.selectedCost = selected.reduce((s, pi) => s + (Number(pi.base_price) || 0), 0);
    }
    this.subtotal    = this.categoryRows.reduce((s, r) => s + r.selectedCost, 0);
    this.delivery    = this.subtotal * 0.12;
    this.contingency = this.subtotal * (this.contingencyPct / 100);
    this.yourCost    = this.subtotal + this.delivery + this.contingency;
    this.clientTotal = this.yourCost * (1 + this.marginPct / 100);
    this.budgetDiff  = this.budget > 0 ? this.clientTotal - this.budget : 0;
    this.absBudgetDiff = Math.abs(this.budgetDiff);
    this.barPct      = this.budget > 0 ? Math.min((this.clientTotal / this.budget) * 100, 100) : 0;
    this.budgetMessage = this.budget > 0
      ? (this.budgetDiff <= 0
          ? `${Math.round(this.barPct === 100 ? 0 : 100 - this.barPct)}% under — headroom to add more`
          : `${Math.round((this.budgetDiff / this.budget) * 100)}% over — review items to reduce`)
      : '';
    // Pseudo-average for the AI insight card — sits within ±10% of
    // clientTotal so the placeholder reads coherent. Replace with real
    // service call later.
    this.insightAverage = Math.round((this.clientTotal * 0.92) / 100) * 100;
  }

  // ── Card interactions ────────────────────────────────────────────────

  toggleCategory(row: BuildCategoryRow) {
    if (this.expandedCategoryId === row.id) {
      this.expandedCategoryId = null;
    } else {
      this.expandedCategoryId = row.id;
      // Default tab: Items if any items exist on this row, else Brief.
      this.activeCardTab = (row.selectedCount + row.likedCount > 0)
        ? 'items'
        : (this.hasBrief(row) ? 'brief' : 'items');
    }
    this.cdr.detectChanges();
  }

  // ── Items tab actions ────────────────────────────────────────────────

  onViewItem(pi: ProjectItem) {
    // Build a minimal Item shape from the joined fields. The drawer's
    // view mode only reads — no save needed — so the partial shape is
    // sufficient.
    this.drawerItem = {
      id: pi.item_id,
      name: pi.name || '',
      base_price: Number(pi.base_price) || 0,
      unit: pi.unit,
      time_unit: pi.time_unit,
      image_url: pi.image_url || null,
      tier: pi.tier as any,
      category_id: pi.item_category_id || '',
      category_name: pi.category_name,
      org_id: '',
      is_active: true
    } as Item;
    this.drawerMode = 'view';
    this.showItemDrawer = true;
    this.cdr.detectChanges();
  }

  onMoveToLiked(pi: ProjectItem) {
    this.projectItemSvc.add(this.projectId, pi.item_id, 'liked', pi.project_category_id ?? undefined).subscribe({
      next: () => this.refreshCart(),
      error: () => this.msg.add({ severity: 'error', summary: 'Save failed', life: 3000 })
    });
  }

  onMoveToSelected(pi: ProjectItem) {
    this.projectItemSvc.add(this.projectId, pi.item_id, 'selected', pi.project_category_id ?? undefined).subscribe({
      next: () => this.refreshCart(),
      error: () => this.msg.add({ severity: 'error', summary: 'Save failed', life: 3000 })
    });
  }

  onRemoveItem(pi: ProjectItem) {
    this.projectItemSvc.remove(this.projectId, pi.item_id).subscribe({
      next: () => this.refreshCart(),
      error: () => this.msg.add({ severity: 'error', summary: 'Remove failed', life: 3000 })
    });
  }

  /** Browse marketplace → navigate to the Marketplace tab. Passing the
      category_id as a query param so a future enhancement can pre-filter
      the catalogue-grid; the grid doesn't react to it yet. */
  onBrowseMarketplace(row: BuildCategoryRow) {
    this.router.navigate(['..', 'marketplace'], {
      relativeTo: this.route,
      queryParams: { category_id: row.category_id }
    });
  }

  private refreshCart() {
    this.projectItemSvc.getByProject(this.projectId).subscribe(rows => {
      this.projectItems = rows || [];
      this.recomputeAll();
      this.cdr.detectChanges();
    });
  }

  // ── Brief tab actions (save on blur) ─────────────────────────────────

  onBriefBlur(row: BuildCategoryRow) {
    const next = (row.briefDraft || '').trim();
    if (next === (row.requirement_brief || '')) return;
    // Save via update(id, …) — touches just the named columns and triggers
    // recalcTotals() on the project (cheap; harmless when nothing changed).
    this.projectCategorySvc.update(row.id, { requirement_brief: next }).subscribe({
      next: updated => {
        row.requirement_brief = updated?.requirement_brief ?? next;
        this.msg.add({ severity: 'success', summary: 'Brief saved', life: 1500 });
        this.cdr.detectChanges();
      },
      error: () => this.msg.add({ severity: 'error', summary: 'Save failed', life: 3000 })
    });
  }

  onDetailBlur(row: BuildCategoryRow) {
    const next = row.detailDraft || '';
    if (next === (row.requirement_detail || '')) return;
    this.projectCategorySvc.update(row.id, { requirement_detail: next }).subscribe({
      next: updated => {
        row.requirement_detail = updated?.requirement_detail ?? next;
        this.cdr.detectChanges();
      },
      error: () => this.msg.add({ severity: 'error', summary: 'Save failed', life: 3000 })
    });
  }

  onBudgetBlur(row: BuildCategoryRow) {
    const next = row.budgetDraft != null ? Number(row.budgetDraft) : null;
    const current = row.ballpark_budget != null ? Number(row.ballpark_budget) : null;
    if (next === current) return;
    this.projectCategorySvc.update(row.id, { ballpark_budget: next }).subscribe({
      next: updated => {
        row.ballpark_budget = updated?.ballpark_budget ?? next ?? 0;
        this.cdr.detectChanges();
      },
      error: () => this.msg.add({ severity: 'error', summary: 'Save failed', life: 3000 })
    });
  }

  onSendBrief(_row: BuildCategoryRow) {
    // Outreach flow not wired yet — placeholder toast per the v1.18 prompt.
    this.msg.add({
      severity: 'info',
      summary: 'Coming soon',
      detail: 'Supplier outreach flow not yet built.',
      life: 3500
    });
  }

  // ── Display helpers ──────────────────────────────────────────────────

  /** Best-available display name for a project_category row. Prefers the
      joined categories.name (v1.18b: now reliably populated via the
      /projects/:pid/categories endpoint), then the project_categories.name
      column, then a generic fallback. Guarantees the user never sees a
      bare "—" for a card title. */
  rowName(row: BuildCategoryRow): string {
    return (row.category_name?.trim() || row.name?.trim() || 'Uncategorised');
  }

  /** Single-letter initial for the estimate-panel icon column when a
      category has no icon_name. Matches Brief tab's pattern. */
  rowInitial(row: BuildCategoryRow): string {
    return (this.rowName(row).charAt(0) || '?').toUpperCase();
  }

  unitLabel(code: string | null | undefined): string {
    return code ? this.codelistSvc.getDisplay(code) : '';
  }

  /** Map item.tier (basic/mid/premium) to the user-facing label that
      app-status-badge keys its colour off. */
  tierLabel(tier: string | null | undefined): string {
    switch (tier) {
      case 'basic':   return 'Core';
      case 'mid':     return 'Signature';
      case 'premium': return 'Premium';
      default:        return tier || '';
    }
  }
}
