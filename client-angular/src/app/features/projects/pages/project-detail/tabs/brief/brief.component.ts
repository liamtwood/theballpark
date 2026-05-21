import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef,
  ElementRef, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';

import { ProjectService } from '../../../../../../core/services/project.service';
import { CategoryService } from '../../../../../../core/services/category.service';
import { AiService } from '../../../../../../core/services/ai.service';
import { ApiService } from '../../../../../../core/services/api.service';
import { ProjectCategory, Category, ParsedBrief, ParsedBriefCategory } from '../../../../../../models';
import { LoadingSpinnerComponent } from '../../../../../../shared/components/loading-spinner/loading-spinner.component';
import { GbpPipe } from '../../../../../../shared/pipes/gbp.pipe';

/** v1.46 — Brief-tab AI item-matching shapes (POST /taxonomy/match-items). */
interface MatchItem {
  item_id: string; name: string; base_price: number | null;
  supplier_name: string; score: number; reason: string;
}
interface MatchSupplier {
  supplier_id: string; supplier_name: string; fit_reason: string; item_count: number;
}
interface ProposedItem {
  name: string; description: string; supplier_id: string; supplier_name: string;
  estimated_price: number; confidence: number; reason: string;
}
interface MatchResult {
  category_id: string; category_name: string;
  search_terms: string[]; items_scanned: number; suppliers_scanned: number;
  matched_items: MatchItem[]; closest_item: MatchItem | null;
  suppliers_ranked: MatchSupplier[]; proposed_item: ProposedItem | null;
}

/**
 * Project Brief tab — In Scope picker.
 *
 * Owns the (project, category) scope picker that used to live on the
 * old combined Brief tab. Splits cleanly: Event tab handles project
 * facts + raw_brief_text markdown; this tab handles which categories
 * are in scope and what brief each one should send to suppliers.
 *
 * Persistence is shared with the legacy build tab via
 * ProjectService.upsertCategory / removeCategory. Hard delete on
 * toggle off (consistent with the original brief tab); the Build tab
 * uses the soft-delete /scope endpoint instead.
 */
@Component({
  selector: 'app-brief',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, LucideAngularModule,
    ButtonModule, ToastModule,
    LoadingSpinnerComponent, GbpPipe
  ],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading">
      <div class="bp-brief-body">

        <h2 class="bp-page-title">
          Brief
          <span *ngIf="project?.ref" class="bp-brief-ref-chip">{{ project.ref }}</span>
        </h2>
        <div class="bp-page-divider"></div>

        <!-- v1.39i — Questions panel moved to the Overview tab so it
             sits above the event strip (single source of truth for
             AI-flagged blockers). Removed from here. -->

        <div class="bp-brief-sec">
          <!-- Header constrained for line-length readability -->
          <div class="bp-brief-inner">
            <div class="bp-brief-sec-h">
              <span class="bp-brief-sec-label">IN SCOPE</span>
              <div class="bp-brief-sec-actions">
                <span class="bp-brief-sec-hint">Select the categories needed for this event</span>
                <button class="bp-brief-parse-btn"
                        type="button"
                        [disabled]="aiParsing"
                        (click)="parseFromBrief()">
                  <lucide-icon name="wand-sparkles" [size]="12"></lucide-icon>
                  {{ aiParsing ? 'Parsing…' : 'Parse brief' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Circle picker — full viewport width, matches marketplace -->
          <div class="bp-brief-strip-wrap">
            <button class="bp-brief-arrow"
              (click)="scrollStrip(-1)"
              [disabled]="!canScrollLeft">
              <lucide-icon name="chevron-left" [size]="14"></lucide-icon>
            </button>
            <div class="bp-brief-strip" #strip (scroll)="updateStripArrows()">
              <button *ngFor="let c of catalogueCategories"
                class="bp-brief-ci"
                [class.on]="isSelected(c.id)"
                (click)="toggleCategory(c)">
                <span class="bp-brief-circle">
                  <lucide-icon *ngIf="c.icon_name" [name]="c.icon_name" [size]="34"></lucide-icon>
                  <span *ngIf="!c.icon_name" class="bp-brief-circle-letter">{{ (c.name || '?').charAt(0) }}</span>
                </span>
                <span class="bp-brief-cn">{{ c.name }}</span>
              </button>
            </div>
            <button class="bp-brief-arrow"
              (click)="scrollStrip(1)"
              [disabled]="!canScrollRight">
              <lucide-icon name="chevron-right" [size]="14"></lucide-icon>
            </button>
          </div>

          <!-- Below-strip content constrained -->
          <div class="bp-brief-inner">
            <div class="bp-brief-count-bar">
              <span><strong>{{ selectedCategoryIds.size }}</strong> categories selected</span>
              <span class="bp-brief-count-hint">Click any line to edit · wand rewrites from project brief</span>
            </div>

            <!-- Per-category briefs -->
            <div class="bp-brief-rows" *ngIf="orderedCategoryRows.length">
              <div *ngFor="let row of orderedCategoryRows; trackBy: trackByCatId" class="bp-brief-row-wrap">
                <div class="bp-brief-row">
                <span class="bp-brief-row-icn">
                  <lucide-icon *ngIf="row.category_icon_name"
                    [name]="row.category_icon_name" [size]="14"></lucide-icon>
                  <span *ngIf="!row.category_icon_name">{{ (row.category_name || '?').charAt(0) }}</span>
                </span>
                <div class="bp-brief-row-body">
                  <div class="bp-brief-row-title">
                    {{ row.category_name }}
                    <span class="bp-brief-row-pen">Brief</span>
                  </div>
                  <textarea
                    class="bp-brief-row-prompt"
                    rows="2"
                    [value]="row.requirement_brief || ''"
                    [placeholder]="'What you need from ' + (row.category_name || 'this category').toLowerCase() + ' suppliers — keep it short, 2–3 lines.'"
                    (blur)="onRowBriefBlur(row, $event)"></textarea>

                  <label class="bp-brief-sublabel">Additional details</label>
                  <textarea
                    class="bp-brief-row-detail"
                    rows="2"
                    [value]="row.requirement_detail || ''"
                    placeholder="Specs, constraints, brand requirements..."
                    (blur)="onRowDetailBlur(row, $event)"></textarea>

                  <div class="bp-brief-row-money">
                    <div class="bp-brief-money-col">
                      <label class="bp-brief-sublabel">Budget</label>
                      <div class="bp-money-input">
                        <span class="bp-money-prefix">£</span>
                        <input class="bp-brief-money-input"
                               type="number"
                               min="0"
                               [value]="row.ballpark_budget ?? ''"
                               placeholder="0"
                               (blur)="onRowBudgetBlur(row, $event)"/>
                      </div>
                    </div>
                    <div class="bp-brief-money-col">
                      <label class="bp-brief-sublabel">Ballpark cost</label>
                      <div class="bp-brief-cost-display">
                        {{ row.ballpark_cost && row.ballpark_cost > 0 ? (row.ballpark_cost | gbp) : '—' }}
                      </div>
                    </div>
                  </div>

                  <!-- v1.46 — Find items + match summary -->
                  <div class="bp-brief-find">
                    <button class="bp-brief-find-btn"
                            type="button"
                            [disabled]="matchLoading.has(row.category_id)"
                            (click)="findItems(row)">
                      <lucide-icon name="wand-sparkles" [size]="11"></lucide-icon>
                      {{ findBtnLabel(row) }}
                    </button>
                    <ng-container *ngIf="matchResults.get(row.category_id)">
                      <span class="bp-brief-find-summary">{{ matchSummary(row.category_id) }}</span>
                      <span class="bp-brief-conf" *ngIf="cardConfidence(row.category_id) as cf">
                        <span class="bp-brief-conf-bar">
                          <span class="bp-brief-conf-fill" [style.width.%]="cf * 10"></span>
                        </span>
                        {{ cf }}/10
                      </span>
                    </ng-container>
                  </div>
                </div>
                <div class="bp-brief-row-actions">
                  <button class="bp-brief-wand" (click)="rewriteRow(row)" title="Rewrite from project brief">
                    <lucide-icon name="wand-sparkles" [size]="13"></lucide-icon>
                  </button>
                </div>
                </div><!-- /bp-brief-row -->

                <!-- v1.46 — AI match results panel -->
                <div class="bp-brief-match" *ngIf="matchResults.get(row.category_id) as mr">

                  <div class="bp-bm-search">
                    <span class="bp-bm-spark">✦</span>
                    <span>
                      Searched <em>{{ mr.search_terms.length ? mr.search_terms.join(', ') : '—' }}</em>
                      · scanned {{ mr.items_scanned }} item{{ mr.items_scanned === 1 ? '' : 's' }}
                      across {{ mr.suppliers_scanned }} supplier{{ mr.suppliers_scanned === 1 ? '' : 's' }}
                    </span>
                  </div>

                  <!-- MATCHED -->
                  <div class="bp-bm-sec">
                    <div class="bp-bm-sec-h">Matched <span class="bp-bm-dim">7+</span></div>
                    <div *ngFor="let m of mr.matched_items" class="bp-bm-item">
                      <div class="bp-bm-item-top">
                        <span class="bp-bm-item-name">{{ m.name }}</span>
                        <span class="bp-bm-item-price">{{ m.base_price != null ? (m.base_price | gbp) : '—' }}</span>
                        <span class="bp-bm-score">{{ m.score }}/10</span>
                      </div>
                      <div class="bp-bm-reason">{{ m.reason }}</div>
                      <button class="bp-bm-add" type="button"
                              [disabled]="isAdded(m.item_id)"
                              (click)="addMatchedItem(row, m)">
                        {{ isAdded(m.item_id) ? '✓ Added' : '+ Add to project' }}
                      </button>
                    </div>
                    <div *ngIf="!mr.matched_items.length" class="bp-bm-empty">(no exact matches)</div>
                  </div>

                  <!-- CLOSEST -->
                  <div class="bp-bm-sec" *ngIf="mr.closest_item as ci">
                    <div class="bp-bm-sec-h">Closest <span class="bp-bm-dim">4–6</span></div>
                    <div class="bp-bm-item">
                      <div class="bp-bm-item-top">
                        <span class="bp-bm-item-name">{{ ci.name }}</span>
                        <span class="bp-bm-item-price">{{ ci.base_price != null ? (ci.base_price | gbp) : '—' }}</span>
                        <span class="bp-bm-score">{{ ci.score }}/10</span>
                      </div>
                      <div class="bp-bm-reason">{{ ci.reason }}</div>
                      <button class="bp-bm-add" type="button"
                              [disabled]="isAdded(ci.item_id)"
                              (click)="addMatchedItem(row, ci)">
                        {{ isAdded(ci.item_id) ? '✓ Added' : '+ Add to project' }}
                      </button>
                    </div>
                  </div>

                  <!-- SUPPLIERS -->
                  <div class="bp-bm-sec" *ngIf="mr.suppliers_ranked.length">
                    <div class="bp-bm-sec-h">Suppliers</div>
                    <div *ngFor="let s of mr.suppliers_ranked; let i = index" class="bp-bm-sup">
                      <div class="bp-bm-sup-top">
                        <span class="bp-bm-sup-name">
                          <span *ngIf="i === 0" class="bp-bm-star">★</span>{{ s.supplier_name }}
                        </span>
                        <span class="bp-bm-sup-count">{{ s.item_count }} items</span>
                      </div>
                      <div class="bp-bm-sup-reason" *ngIf="s.fit_reason">{{ s.fit_reason }}</div>
                    </div>
                  </div>

                  <!-- PROPOSED -->
                  <div class="bp-bm-proposed" *ngIf="mr.proposed_item as p">
                    <div class="bp-bm-proposed-h">🤖 Proposed item</div>
                    <div class="bp-bm-proposed-name">{{ p.name }}</div>
                    <div class="bp-bm-proposed-sup">→ {{ p.supplier_name }}</div>
                    <div class="bp-bm-proposed-meta">
                      <span class="bp-bm-proposed-price">Est. {{ p.estimated_price | gbp }}</span>
                      <span class="bp-bm-conf">
                        Confidence
                        <span class="bp-bm-conf-bar">
                          <span class="bp-bm-conf-fill" [style.width.%]="p.confidence * 10"></span>
                        </span>
                        {{ p.confidence }}/10
                      </span>
                    </div>
                    <div class="bp-bm-reason">{{ p.reason }}</div>
                    <div class="bp-bm-proposed-actions">
                      <button class="bp-bm-add" type="button"
                              [disabled]="isProposedAdded(row.category_id)"
                              (click)="addProposedItem(row, p)">
                        {{ isProposedAdded(row.category_id) ? '✓ Added' : '+ Add to project' }}
                      </button>
                      <button class="bp-bm-remove" type="button"
                              [disabled]="isProposedAdded(row.category_id)"
                              (click)="dismissProposed(row.category_id)">Remove</button>
                    </div>
                  </div>

                  <!-- HINT -->
                  <div class="bp-bm-hint">
                    <label class="bp-bm-hint-label">💬 I would have looked for…</label>
                    <div class="bp-bm-hint-row">
                      <input class="bp-bm-hint-input"
                             type="text"
                             [value]="hintDrafts.get(row.category_id) || ''"
                             (input)="onHintInput(row, $event)"
                             placeholder="search terms the AI missed"/>
                      <button class="bp-bm-hint-btn" type="button" (click)="submitHint(row)">Submit</button>
                    </div>
                  </div>

                </div>
              </div>
            </div>
            <div *ngIf="!orderedCategoryRows.length" class="bp-brief-empty">
              No categories selected yet — pick one above to start scoping.
            </div>
          </div>
        </div>

        <!-- ── FOOTER ── (constrained) -->
        <div class="bp-brief-inner">
          <div class="bp-brief-footer">
            <span class="bp-brief-footer-l">{{ selectedCategoryIds.size }} categories selected</span>
            <p-button label="Start building →"
              styleClass="p-button-outlined"
              [disabled]="selectedCategoryIds.size === 0"
              (onClick)="goToBuild()">
            </p-button>
          </div>
        </div>

      </div>
    </ng-container>

    <p-toast></p-toast>
  `,
  styles: [`
    /* Body is full-bleed; constrained sections wrap themselves in
       .bp-brief-inner so the strip can match marketplace's full
       viewport width while readable text stays at 860px. */
    .bp-brief-body { padding: 28px 0 100px; }
    .bp-brief-inner { max-width: 860px; margin: 0 auto; padding: 0 40px; }

    .bp-brief-sec        { margin-bottom: 24px; }
    .bp-brief-sec-h      { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; gap: 12px; }
    .bp-brief-sec-label  { display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--theme-accent); }
    .bp-brief-sec-hint   { font-size: 11.5px; color: var(--color-text-secondary); }
    .bp-brief-sec-actions { display: flex; align-items: center; gap: 12px; }

    /* v1.39h — ref chip next to the page title. */
    .bp-brief-ref-chip {
      display: inline-block;
      margin-left: 12px;
      padding: 3px 10px;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      border-radius: 999px;
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.04em;
      color: var(--color-text-secondary);
      vertical-align: middle;
    }
    .bp-brief-parse-btn {
      display: inline-flex; align-items: center; gap: 6px;
      font-family: var(--font-body); font-size: 11.5px; font-weight: 600;
      padding: 6px 12px; border-radius: 6px;
      background: var(--theme-bg);
      color: var(--theme-accent);
      border: 0.5px solid var(--theme-accent);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .bp-brief-parse-btn:hover:not(:disabled) { background: var(--theme-accent); color: #fff; }
    .bp-brief-parse-btn:disabled { opacity: 0.5; cursor: default; }

    /* ── CIRCLE STRIP ── matches marketplace padding/sizing */
    .bp-brief-strip-wrap {
      display: flex; align-items: center; gap: 8px;
      padding: 4px 28px 0;
    }
    .bp-brief-strip {
      display: flex; gap: 20px;
      overflow-x: auto;
      padding: 6px 4px 14px;
      flex: 1; min-width: 0;
      scrollbar-width: none;
      scroll-behavior: smooth;
    }
    .bp-brief-strip::-webkit-scrollbar { display: none; }
    .bp-brief-arrow {
      width: 32px; height: 32px; flex-shrink: 0;
      border-radius: 50%;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      color: var(--color-text-secondary);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: border-color 0.15s, color 0.15s;
    }
    .bp-brief-arrow:hover:not(:disabled) {
      border-color: var(--theme-accent);
      color: var(--theme-accent);
    }
    .bp-brief-arrow:disabled { opacity: 0.3; cursor: default; }

    .bp-brief-ci {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      cursor: pointer; flex-shrink: 0;
      background: none; border: none; padding: 0;
      font-family: var(--font-body);
    }
    .bp-brief-circle {
      width: 96px; height: 96px;
      border-radius: 50%;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      display: flex; align-items: center; justify-content: center;
      color: var(--color-text-secondary);
      transition: border-color 0.15s, box-shadow 0.18s, transform 0.18s,
                  background 0.15s, color 0.15s, opacity 0.15s;
      position: relative;
      opacity: 0.55;
    }
    .bp-brief-ci:hover .bp-brief-circle {
      opacity: 1;
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
      transform: translateY(-1px);
    }
    .bp-brief-ci.on .bp-brief-circle {
      opacity: 1;
      background: var(--theme-bg);
      border-color: var(--theme-accent);
      color: var(--theme-accent);
    }
    .bp-brief-ci.on .bp-brief-circle::after {
      content: '';
      position: absolute;
      width: 20px; height: 20px;
      border-radius: 50%;
      background: var(--theme-accent);
      transform: translate(34px, -34px);
      box-shadow: 0 0 0 2px var(--color-surface);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 13l4 4L19 7'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 12px 12px;
    }
    .bp-brief-circle-letter {
      font-family: var(--font-display);
      font-size: 30px; font-weight: 600;
      color: inherit;
    }
    .bp-brief-cn {
      font-size: 11px; font-weight: 500;
      color: var(--color-text-secondary);
      text-align: center; max-width: 96px; line-height: 1.3;
    }
    .bp-brief-ci.on .bp-brief-cn { color: var(--theme-accent); font-weight: 600; }

    /* ── COUNT BAR ── */
    .bp-brief-count-bar {
      display: flex; align-items: center; justify-content: space-between;
      margin: 8px 0 16px;
      font-size: 12px; color: var(--color-text-secondary);
    }
    .bp-brief-count-bar strong { color: var(--color-text-primary); font-weight: 600; }
    .bp-brief-count-hint { color: var(--color-text-muted); }

    /* ── CATEGORY BRIEF ROWS (Variant B) ── */
    .bp-brief-rows { display: flex; flex-direction: column; gap: 11px; }
    .bp-brief-row {
      display: flex; gap: 12px; align-items: flex-start;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      border-left: 3px solid var(--theme-accent);
      border-radius: 8px;
      padding: 12px 14px 12px 13px;
      transition: box-shadow 0.18s;
    }
    .bp-brief-row:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
    .bp-brief-row-icn {
      width: 28px; height: 28px;
      border-radius: 50%;
      background: var(--theme-bg);
      color: var(--theme-accent);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; margin-top: 1px;
      font-size: 12px; font-weight: 600;
    }
    .bp-brief-row-body { flex: 1; min-width: 0; }
    .bp-brief-row-title {
      font-size: 12px; font-weight: 600;
      color: var(--color-text-primary);
      margin-bottom: 3px;
      display: flex; align-items: center; gap: 8px;
    }
    .bp-brief-row-pen {
      font-size: 9.5px; font-weight: 600;
      color: var(--color-text-muted);
      text-transform: uppercase; letter-spacing: 0.08em;
    }
    .bp-brief-row-prompt {
      width: 100%;
      font-family: var(--font-sans);
      font-size: 13.5px;
      color: var(--color-text-primary);
      line-height: 1.55;
      background: transparent;
      border: none; outline: none; resize: none;
      padding: 0; margin: 0;
      font-weight: 400;
    }
    .bp-brief-row-prompt::placeholder {
      color: var(--color-text-secondary);
      font-style: italic;
    }

    /* ── ADDITIONAL DETAILS + BUDGET ── */
    .bp-brief-sublabel {
      display: block;
      font-size: 10px; font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin: 10px 0 4px;
    }
    .bp-brief-row-detail {
      width: 100%;
      font-family: var(--font-body);
      font-size: 12.5px;
      color: var(--color-text-primary);
      line-height: 1.5;
      background: transparent;
      border: 0.5px solid var(--color-border);
      border-radius: 6px;
      outline: none; resize: vertical;
      padding: 6px 8px; margin: 0;
    }
    .bp-brief-row-detail:focus { border-color: var(--theme-accent); }
    .bp-brief-row-detail::placeholder {
      color: var(--color-text-muted);
      font-style: italic;
    }
    .bp-brief-row-money {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 4px;
    }
    .bp-brief-money-col { display: flex; flex-direction: column; }
    .bp-money-input { position: relative; display: flex; align-items: center; }
    .bp-money-prefix {
      position: absolute; left: 8px;
      font-size: 12.5px;
      color: var(--color-text-muted);
      pointer-events: none;
    }
    .bp-brief-money-input {
      width: 100%;
      padding: 6px 8px 6px 20px;
      font-family: var(--font-body);
      font-size: 12.5px;
      color: var(--color-text-primary);
      background: transparent;
      border: 0.5px solid var(--color-border);
      border-radius: 6px;
      outline: none;
    }
    .bp-brief-money-input:focus { border-color: var(--theme-accent); }
    .bp-brief-cost-display {
      padding: 6px 8px;
      font-size: 12.5px; font-weight: 600;
      color: var(--color-text-primary);
      background: var(--theme-bg);
      border: 0.5px solid var(--theme-border);
      border-radius: 6px;
      min-height: 30px;
      display: flex; align-items: center;
    }
    .bp-brief-row-actions { display: flex; align-items: flex-start; gap: 4px; flex-shrink: 0; }
    .bp-brief-wand {
      width: 26px; height: 26px;
      border-radius: 6px;
      border: 0.5px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-secondary);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: color 0.15s, border-color 0.15s, background 0.15s;
    }
    .bp-brief-wand:hover {
      color: var(--theme-accent);
      border-color: var(--theme-accent);
      background: var(--theme-bg);
    }

    .bp-brief-empty {
      font-size: 12.5px; color: var(--color-text-muted);
      font-style: italic; text-align: center;
      padding: 24px;
      border: 0.5px dashed var(--color-border);
      border-radius: 8px;
    }

    /* ── v1.46 — FIND ITEMS + AI MATCH PANEL ─────────────────────────── */
    .bp-brief-row-wrap { display: flex; flex-direction: column; }

    .bp-brief-find {
      display: flex; align-items: center; flex-wrap: wrap; gap: 10px;
      margin-top: 12px; padding-top: 10px;
      border-top: 0.5px solid var(--color-border);
    }
    .bp-brief-find-btn {
      display: inline-flex; align-items: center; gap: 5px;
      font-family: var(--font-body); font-size: 11.5px; font-weight: 600;
      padding: 5px 11px; border-radius: 6px;
      background: var(--theme-bg); color: var(--theme-accent);
      border: 0.5px solid var(--theme-accent);
      cursor: pointer; transition: background 0.15s, color 0.15s;
    }
    .bp-brief-find-btn:hover:not(:disabled) { background: var(--theme-accent); color: #fff; }
    .bp-brief-find-btn:disabled { opacity: 0.55; cursor: default; }
    .bp-brief-find-summary { font-size: 11.5px; color: var(--color-text-secondary); font-weight: 500; }
    .bp-brief-conf {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 11px; color: var(--color-text-muted);
    }
    .bp-brief-conf-bar, .bp-bm-conf-bar {
      width: 56px; height: 6px; border-radius: 3px;
      background: var(--color-border); overflow: hidden;
    }
    .bp-brief-conf-fill, .bp-bm-conf-fill {
      display: block; height: 100%;
      background: var(--theme-accent);
    }

    /* Results panel — sits directly under the row. */
    .bp-brief-match {
      margin: -2px 0 0 0;
      background: var(--theme-bg);
      border: 0.5px solid var(--theme-border);
      border-top: none;
      border-radius: 0 0 8px 8px;
      padding: 12px 14px 14px;
      display: flex; flex-direction: column; gap: 14px;
    }
    .bp-bm-search {
      display: flex; gap: 6px; align-items: baseline;
      font-size: 11px; color: var(--color-text-muted); line-height: 1.5;
    }
    .bp-bm-search em { color: var(--color-text-secondary); font-style: normal; font-weight: 600; }
    .bp-bm-spark { color: var(--theme-accent); }

    .bp-bm-sec { display: flex; flex-direction: column; gap: 7px; }
    .bp-bm-sec-h {
      font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--color-text-secondary);
    }
    .bp-bm-dim { color: var(--color-text-muted); font-weight: 600; }
    .bp-bm-empty { font-size: 11.5px; color: var(--color-text-muted); font-style: italic; }

    /* Matched / closest item card */
    .bp-bm-item {
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      border-radius: 7px; padding: 9px 11px;
    }
    .bp-bm-item-top {
      display: flex; align-items: baseline; gap: 8px;
    }
    .bp-bm-item-name {
      flex: 1; min-width: 0;
      font-size: 12.5px; font-weight: 600; color: var(--color-text-primary);
    }
    .bp-bm-item-price { font-size: 12px; font-weight: 600; color: var(--color-text-primary); }
    .bp-bm-score {
      font-size: 10px; font-weight: 700;
      color: var(--theme-accent);
      background: var(--theme-bg);
      border: 0.5px solid var(--theme-border);
      border-radius: 10px; padding: 1px 7px;
    }
    .bp-bm-reason {
      font-size: 11.5px; color: var(--color-text-secondary);
      line-height: 1.5; margin: 4px 0 7px;
    }
    .bp-bm-add {
      font-family: var(--font-body); font-size: 11px; font-weight: 600;
      padding: 4px 10px; border-radius: 5px;
      background: var(--theme-accent); color: #fff;
      border: none; cursor: pointer; transition: filter 0.15s;
    }
    .bp-bm-add:hover:not(:disabled) { filter: brightness(1.07); }
    .bp-bm-add:disabled {
      background: var(--theme-bg); color: var(--theme-accent);
      border: 0.5px solid var(--theme-border); cursor: default;
    }

    /* Suppliers */
    .bp-bm-sup {
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      border-radius: 7px; padding: 8px 11px;
    }
    .bp-bm-sup + .bp-bm-sup { margin-top: 5px; }
    .bp-bm-sup-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
    .bp-bm-sup-name { font-size: 12px; font-weight: 600; color: var(--color-text-primary); }
    .bp-bm-star { color: var(--theme-accent); margin-right: 4px; }
    .bp-bm-sup-count { font-size: 10.5px; color: var(--color-text-muted); }
    .bp-bm-sup-reason { font-size: 11px; color: var(--color-text-secondary); margin-top: 2px; }

    /* Proposed item — dashed border */
    .bp-bm-proposed {
      background: var(--color-surface);
      border: 1px dashed var(--theme-accent);
      border-radius: 8px; padding: 11px 13px;
    }
    .bp-bm-proposed-h {
      font-size: 10px; font-weight: 700; letter-spacing: 0.07em;
      text-transform: uppercase; color: var(--theme-accent);
      margin-bottom: 5px;
    }
    .bp-bm-proposed-name {
      font-size: 13px; font-weight: 600; color: var(--color-text-primary);
    }
    .bp-bm-proposed-sup { font-size: 11.5px; color: var(--color-text-secondary); margin-top: 1px; }
    .bp-bm-proposed-meta {
      display: flex; align-items: center; flex-wrap: wrap; gap: 14px;
      margin: 7px 0;
    }
    .bp-bm-proposed-price { font-size: 12.5px; font-weight: 700; color: var(--color-text-primary); }
    .bp-bm-conf {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 11px; color: var(--color-text-muted);
    }
    .bp-bm-proposed-actions { display: flex; gap: 8px; margin-top: 4px; }
    .bp-bm-remove {
      font-family: var(--font-body); font-size: 11px; font-weight: 500;
      padding: 4px 10px; border-radius: 5px;
      background: none; color: var(--color-text-muted);
      border: 0.5px solid var(--color-border); cursor: pointer;
    }
    .bp-bm-remove:hover:not(:disabled) { color: var(--color-danger); border-color: var(--color-danger); }
    .bp-bm-remove:disabled { opacity: 0.4; cursor: default; }

    /* Hint */
    .bp-bm-hint {
      border-top: 0.5px solid var(--theme-border);
      padding-top: 10px;
    }
    .bp-bm-hint-label {
      display: block; font-size: 11px; color: var(--color-text-secondary);
      margin-bottom: 5px;
    }
    .bp-bm-hint-row { display: flex; gap: 6px; }
    .bp-bm-hint-input {
      flex: 1; min-width: 0;
      font-family: var(--font-body); font-size: 11.5px;
      color: var(--color-text-primary);
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      border-radius: 6px; padding: 6px 9px; outline: none;
    }
    .bp-bm-hint-input:focus { border-color: var(--theme-accent); }
    .bp-bm-hint-btn {
      font-family: var(--font-body); font-size: 11px; font-weight: 600;
      padding: 5px 12px; border-radius: 6px;
      background: var(--color-surface); color: var(--theme-accent);
      border: 0.5px solid var(--theme-accent); cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .bp-bm-hint-btn:hover { background: var(--theme-accent); color: #fff; }

    /* ── FOOTER ── */
    .bp-brief-footer {
      display: flex; align-items: center; justify-content: space-between;
      margin-top: 32px; padding-top: 16px;
      border-top: 0.5px solid var(--color-border);
    }
    .bp-brief-footer-l { font-size: 12px; color: var(--color-text-secondary); }
  `]
})
export class BriefComponent implements OnInit, OnDestroy {
  loading = true;
  pid = '';

  catalogueCategories: Category[] = [];
  projectCategories: ProjectCategory[] = [];
  selectedCategoryIds = new Set<string>();

  // Per-row autosave debouncers (categoryId → timeout handle).
  private rowSaveTimers = new Map<string, any>();

  // Scroll arrow state
  canScrollLeft = false;
  canScrollRight = false;

  // AI parse-brief flow state.
  aiParsing = false;

  // ── v1.46 — Brief-tab AI item matching (keyed by category_id) ────────
  matchResults = new Map<string, MatchResult>();
  matchLoading = new Set<string>();
  hintDrafts = new Map<string, string>();
  /** item ids added to the project via a matched/closest card. */
  addedItemIds = new Set<string>();
  /** category ids whose proposed item has been added. */
  addedProposed = new Set<string>();

  // v1.39h — full project (cached on init) for the page-header ref
  // chip. The questions panel that used to live here moved to the
  // Overview tab in v1.39i (single source of truth above the event
  // strip), so we no longer need the AI-questions state here.
  project: any = null;

  @ViewChild('strip') stripRef?: ElementRef<HTMLElement>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projSvc: ProjectService,
    private catSvc: CategoryService,
    private aiSvc: AiService,
    private api: ApiService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.pid = this.route.parent?.snapshot.paramMap.get('id') || '';
    if (!this.pid) {
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    forkJoin({
      catCategories:     this.catSvc.getAll('catalogue'),
      projectCategories: this.projSvc.getCategories(this.pid),
      // v1.39h — fetch the project too so the header can render
      // the ref chip and the questions panel can pull
      // parsed_brief_json.topQuestions.
      project:           this.projSvc.getById(this.pid)
    }).subscribe({
      next: ({ catCategories, projectCategories, project }) => {
        this.catalogueCategories = (catCategories || [])
          .filter(c => !(c as any).parent_id)
          .sort((a, b) => ((a as any).sort_order || 0) - ((b as any).sort_order || 0));
        this.applyProjectCategories(projectCategories || []);
        this.project = project || null;
        this.loading = false;
        this.cdr.markForCheck();
        setTimeout(() => this.updateStripArrows(), 0);
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy() {
    for (const t of this.rowSaveTimers.values()) clearTimeout(t);
  }

  private applyProjectCategories(rows: ProjectCategory[]) {
    this.projectCategories = rows;
    this.selectedCategoryIds = new Set(rows.map(r => r.category_id));
  }

  // ── Circle picker ──
  isSelected(catId: string): boolean { return this.selectedCategoryIds.has(catId); }

  toggleCategory(c: Category) {
    if (this.selectedCategoryIds.has(c.id)) {
      this.selectedCategoryIds.delete(c.id);
      this.projectCategories = this.projectCategories.filter(r => r.category_id !== c.id);
      this.cdr.markForCheck();
      this.projSvc.removeCategory(this.pid, c.id).subscribe({
        next: () => this.projSvc.triggerRefresh(),
        error: () => {
          this.msg.add({ severity: 'error', summary: 'Failed to remove category', life: 3000 });
          this.selectedCategoryIds.add(c.id);
          this.cdr.markForCheck();
        }
      });
    } else {
      this.selectedCategoryIds.add(c.id);
      const placeholder = this.makeRowFromCategory(c);
      this.projectCategories = [...this.projectCategories, placeholder];
      this.cdr.markForCheck();
      this.projSvc.upsertCategory(this.pid, c.id, {}).subscribe({
        next: row => {
          const enriched: ProjectCategory = {
            ...placeholder, ...row,
            category_name:            placeholder.category_name,
            category_icon_name:       placeholder.category_icon_name,
            category_icon_color:      placeholder.category_icon_color,
            category_cover_image_url: placeholder.category_cover_image_url,
            category_sort_order:      placeholder.category_sort_order,
          };
          this.projectCategories = this.projectCategories
            .filter(r => r.category_id !== c.id)
            .concat([enriched]);
          this.projSvc.triggerRefresh();
          this.cdr.markForCheck();
        },
        error: () => {
          this.msg.add({ severity: 'error', summary: 'Failed to add category', life: 3000 });
          this.selectedCategoryIds.delete(c.id);
          this.projectCategories = this.projectCategories.filter(r => r.category_id !== c.id);
          this.cdr.markForCheck();
        }
      });
    }
  }

  private makeRowFromCategory(c: Category): ProjectCategory {
    return {
      id: 'pending-' + c.id,
      project_id: this.pid,
      category_id: c.id,
      requirement_brief: '',
      ballpark_budget: undefined,
      ballpark_cost: 0,
      base_cost: 0,
      contingency_pct: 0, contingency_amount: 0,
      subtotal: 0,
      margin_pct: 0, margin_amount: 0,
      net_cost: 0,
      vat_pct: 0, vat_amount: 0,
      client_cost: 0,
      sort_order: (c as any).sort_order || 0,
      is_active: true,
      category_name:            c.name,
      category_icon_name:       (c as any).icon_name,
      category_icon_color:      (c as any).icon_color,
      category_cover_image_url: (c as any).cover_image_url,
      category_sort_order:      (c as any).sort_order,
    };
  }

  get orderedCategoryRows(): ProjectCategory[] {
    return [...this.projectCategories].sort(
      (a, b) => (a.category_sort_order || 0) - (b.category_sort_order || 0)
    );
  }

  trackByCatId = (_: number, row: ProjectCategory) => row.category_id;

  onRowBriefBlur(row: ProjectCategory, ev: Event) {
    const value = (ev.target as HTMLTextAreaElement).value.trim();
    if (value === (row.requirement_brief || '').trim()) return;
    row.requirement_brief = value;

    const prev = this.rowSaveTimers.get(row.category_id);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => {
      this.rowSaveTimers.delete(row.category_id);
      this.projSvc.upsertCategory(this.pid, row.category_id, { requirement_brief: value }).subscribe({
        next: () => this.msg.add({ severity: 'success', summary: 'Saved ✓', life: 1200 }),
        error: () => this.msg.add({ severity: 'error', summary: 'Failed to save category brief', life: 3000 })
      });
    }, 800);
    this.rowSaveTimers.set(row.category_id, t);
  }

  onRowDetailBlur(row: ProjectCategory, ev: Event) {
    const value = (ev.target as HTMLTextAreaElement).value;
    if (value === (row.requirement_detail || '')) return;
    row.requirement_detail = value;
    this.projSvc.upsertCategory(this.pid, row.category_id, { requirement_detail: value }).subscribe({
      next: () => this.msg.add({ severity: 'success', summary: 'Saved ✓', life: 1200 }),
      error: () => this.msg.add({ severity: 'error', summary: 'Failed to save details', life: 3000 })
    });
  }

  onRowBudgetBlur(row: ProjectCategory, ev: Event) {
    const raw = (ev.target as HTMLInputElement).value.trim();
    const next: number | null = raw === '' ? null : Number(raw);
    const current = row.ballpark_budget != null ? Number(row.ballpark_budget) : null;
    if (next === current) return;
    row.ballpark_budget = next ?? undefined;
    this.projSvc.upsertCategory(this.pid, row.category_id, { ballpark_budget: next }).subscribe({
      next: () => this.msg.add({ severity: 'success', summary: 'Saved ✓', life: 1200 }),
      error: () => this.msg.add({ severity: 'error', summary: 'Failed to save budget', life: 3000 })
    });
  }

  rewriteRow(_row: ProjectCategory) {
    // Stub — AI category brief rewrite lives behind this in a later release.
    this.msg.add({ severity: 'info', summary: 'AI category brief coming soon', life: 2000 });
  }

  // ── v1.46 — "✦ Find items" AI matching ───────────────────────────────

  /** Real project_category id, or null for a not-yet-persisted row. */
  private pcId(row: ProjectCategory): string | null {
    return row.id && !String(row.id).startsWith('pending-') ? row.id : null;
  }

  findBtnLabel(row: ProjectCategory): string {
    if (this.matchLoading.has(row.category_id)) return 'Searching…';
    return this.matchResults.has(row.category_id) ? 'Find again' : 'Find items';
  }

  /** "1 proposed · 1 close · 3 exact" summary line. */
  matchSummary(catId: string): string {
    const r = this.matchResults.get(catId);
    if (!r) return '';
    const proposed = r.proposed_item ? 1 : 0;
    const close = r.closest_item ? 1 : 0;
    return `${proposed} proposed · ${close} close · ${r.matched_items.length} exact`;
  }

  /** Average AI confidence across matched + proposed — drives the card bar. */
  cardConfidence(catId: string): number {
    const r = this.matchResults.get(catId);
    if (!r) return 0;
    const scores = r.matched_items.map(m => m.score);
    if (r.proposed_item) scores.push(r.proposed_item.confidence);
    if (!scores.length) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  isAdded(itemId: string): boolean { return this.addedItemIds.has(itemId); }
  isProposedAdded(catId: string): boolean { return this.addedProposed.has(catId); }

  /** Run the AI matcher for one category against its (current) brief. */
  findItems(row: ProjectCategory): void {
    const brief = (row.requirement_brief || '').trim();
    if (!brief) {
      this.msg.add({
        severity: 'warn', summary: 'Add a brief first',
        detail: 'Write what you need from this category, then Find items.', life: 3000
      });
      return;
    }
    const catId = row.category_id;
    this.matchLoading.add(catId);
    this.cdr.markForCheck();
    this.api.post<MatchResult>('/taxonomy/match-items', {
      brief, categoryId: catId,
      budgetEstimate: row.ballpark_budget != null ? Number(row.ballpark_budget) : undefined
    }).subscribe({
      next: r => {
        this.matchLoading.delete(catId);
        this.matchResults.set(catId, r);
        this.cdr.markForCheck();
      },
      error: err => {
        this.matchLoading.delete(catId);
        this.msg.add({
          severity: 'error', summary: 'Find items failed',
          detail: err?.error?.error || 'AI matcher unreachable — try again shortly.', life: 4000
        });
        this.cdr.markForCheck();
      }
    });
  }

  /** Add a scored catalogue item (matched or closest) to the project. */
  addMatchedItem(row: ProjectCategory, m: MatchItem): void {
    if (this.addedItemIds.has(m.item_id)) return;
    this.api.post<{ ballpark_cost: number }>('/taxonomy/add-match', {
      project_id: this.pid, project_category_id: this.pcId(row), category_id: row.category_id,
      kind: 'matched', item_id: m.item_id, ai_confidence: m.score, ai_match_reason: m.reason
    }).subscribe({
      next: res => {
        this.addedItemIds.add(m.item_id);
        if (res && res.ballpark_cost != null) row.ballpark_cost = res.ballpark_cost;
        this.projSvc.triggerRefresh();
        this.msg.add({ severity: 'success', summary: 'Added to project', detail: m.name, life: 2500 });
        this.cdr.markForCheck();
      },
      error: () => this.msg.add({ severity: 'error', summary: 'Could not add item', life: 3500 })
    });
  }

  /** Add the AI's proposed item — the backend creates the catalogue item
      under the proposed supplier, then links it to the project. */
  addProposedItem(row: ProjectCategory, p: ProposedItem): void {
    if (this.addedProposed.has(row.category_id)) return;
    this.api.post<{ ballpark_cost: number }>('/taxonomy/add-match', {
      project_id: this.pid, project_category_id: this.pcId(row), category_id: row.category_id,
      kind: 'proposed', ai_confidence: p.confidence, ai_match_reason: p.reason,
      proposed: {
        name: p.name, description: p.description,
        supplier_id: p.supplier_id, estimated_price: p.estimated_price
      }
    }).subscribe({
      next: res => {
        this.addedProposed.add(row.category_id);
        if (res && res.ballpark_cost != null) row.ballpark_cost = res.ballpark_cost;
        this.projSvc.triggerRefresh();
        this.msg.add({ severity: 'success', summary: 'Proposed item added', detail: p.name, life: 2500 });
        this.cdr.markForCheck();
      },
      error: () => this.msg.add({ severity: 'error', summary: 'Could not add proposed item', life: 3500 })
    });
  }

  /** Remove the proposed item from the panel (local only). */
  dismissProposed(catId: string): void {
    const r = this.matchResults.get(catId);
    if (r) { r.proposed_item = null; this.cdr.markForCheck(); }
  }

  onHintInput(row: ProjectCategory, ev: Event): void {
    this.hintDrafts.set(row.category_id, (ev.target as HTMLInputElement).value);
  }

  /** Save a training hint — what the user would have searched for. */
  submitHint(row: ProjectCategory): void {
    const hint = (this.hintDrafts.get(row.category_id) || '').trim();
    if (!hint) return;
    const r = this.matchResults.get(row.category_id);
    this.api.post('/taxonomy/search-hint', {
      projectId: this.pid, categoryId: row.category_id,
      searchTerms: r ? r.search_terms : [], userHint: hint
    }).subscribe({
      next: () => {
        this.hintDrafts.set(row.category_id, '');
        this.msg.add({ severity: 'success', summary: 'Thanks — hint saved for training', life: 2500 });
        this.cdr.markForCheck();
      },
      error: () => this.msg.add({ severity: 'error', summary: 'Could not save hint', life: 3000 })
    });
  }

  /** v1.34 — "✦ Parse brief" — runs the upgraded Haiku parser against
      the project's raw_brief_text, then upserts each returned category
      onto project_categories with its supplier-ready oneLiner as the
      requirement_brief. */
  parseFromBrief() {
    if (this.aiParsing) return;
    this.aiParsing = true;
    this.cdr.markForCheck();

    this.projSvc.getById(this.pid).subscribe({
      next: project => {
        const brief = (project as any)?.raw_brief_text || '';
        if (!brief.trim()) {
          this.aiParsing = false;
          this.msg.add({ severity: 'warn', summary: 'No project brief yet — add one on the Event tab first.', life: 3000 });
          this.cdr.markForCheck();
          return;
        }
        this.aiSvc.parseBrief(brief).subscribe({
          next: (parsed: ParsedBrief) => this.applyAiCategories(parsed),
          error: err => {
            this.aiParsing = false;
            this.msg.add({
              severity: 'error',
              summary: 'Brief parse failed',
              detail: err?.error?.error || 'AI parser unreachable — try again shortly.',
              life: 4000
            });
            this.cdr.markForCheck();
          }
        });
      },
      error: () => {
        this.aiParsing = false;
        this.msg.add({ severity: 'error', summary: 'Could not load project brief', life: 3000 });
        this.cdr.markForCheck();
      }
    });
  }

  /** AI categoryId → DB category name mapping (catalogue namespace).
      Names must match the seed in `seed.js` / preview-equivalent.
      v1.39f: `venues→Venue` reinstated (it IS in the catalogue);
      `photography` row was seeded via migrate-schemas in v1.39f. */
  private static readonly AI_CATEGORY_TO_DB: Record<string, string> = {
    'set-build':     'Stand Structure',
    'print':         'Graphics & Signage',
    'av':            'AV & Technology',
    'floral':        'Florals',
    'venues':        'Venue',
    'catering':      'Catering & Hospitality',
    'photography':   'Photography',
    'staffing':      'Staffing',
    'h-and-s':       'Health & Safety',
    'furniture':     'Furniture & Fixtures',
    'logistics':     'Logistics & Transport',
    'entertainment': 'Entertainment',
    'lighting':      'Lighting'
  };

  private applyAiCategories(parsed: ParsedBrief) {
    const cats: ParsedBriefCategory[] = parsed?.categories || [];
    if (!cats.length) {
      this.aiParsing = false;
      this.msg.add({ severity: 'info', summary: '✦ Brief parsed — no categories identified', life: 2500 });
      this.cdr.markForCheck();
      return;
    }

    // Resolve each AI category to a DB Category (by id-map, else by label fuzzy).
    const resolved: Array<{ ai: ParsedBriefCategory; db: Category }> = [];
    for (const ai of cats) {
      const dbName = BriefComponent.AI_CATEGORY_TO_DB[ai.categoryId];
      let db: Category | undefined;
      if (dbName) {
        db = this.catalogueCategories.find(c => c.name === dbName);
      }
      if (!db && ai.categoryLabel) {
        const lc = ai.categoryLabel.toLowerCase();
        db = this.catalogueCategories.find(c => lc.includes(c.name.toLowerCase()));
      }
      if (db) resolved.push({ ai, db });
    }

    if (!resolved.length) {
      this.aiParsing = false;
      this.msg.add({ severity: 'info', summary: '✦ Brief parsed — no matching catalogue categories', life: 3000 });
      this.cdr.markForCheck();
      return;
    }

    // Upsert each — sequential to keep server load predictable.
    const upserts = resolved.map(({ ai, db }) =>
      this.projSvc.upsertCategory(this.pid, db.id, { requirement_brief: ai.oneLiner })
    );
    forkJoin(upserts).subscribe({
      next: rows => {
        // Refresh the tab's local state from the server response.
        this.projSvc.getCategories(this.pid).subscribe({
          next: fresh => {
            this.applyProjectCategories(fresh || []);
            this.aiParsing = false;
            this.projSvc.triggerRefresh();
            this.msg.add({
              severity: 'success',
              summary: `✦ Brief parsed — ${resolved.length} categories identified`,
              life: 3000
            });
            this.cdr.markForCheck();
          },
          error: () => {
            this.aiParsing = false;
            this.cdr.markForCheck();
          }
        });
      },
      error: () => {
        this.aiParsing = false;
        this.msg.add({ severity: 'error', summary: 'Failed to save AI categories', life: 3000 });
        this.cdr.markForCheck();
      }
    });
  }

  // ── Strip scroll controls ──
  scrollStrip(direction: 1 | -1) {
    const el = this.stripRef?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: direction * 320, behavior: 'smooth' });
    setTimeout(() => this.updateStripArrows(), 250);
  }

  updateStripArrows() {
    const el = this.stripRef?.nativeElement;
    if (!el) return;
    this.canScrollLeft = el.scrollLeft > 2;
    this.canScrollRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    this.cdr.markForCheck();
  }

  // ── Footer ──
  // v1.18b: Build tab renamed to Estimate. /build redirects but we
  // route directly to the canonical slug.
  goToBuild() { this.router.navigate(['/projects', this.pid, 'estimate']); }
}
