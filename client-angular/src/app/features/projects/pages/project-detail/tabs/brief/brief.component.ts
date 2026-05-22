import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SidebarModule } from 'primeng/sidebar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';

import { ProjectService } from '../../../../../../core/services/project.service';
import { CategoryService } from '../../../../../../core/services/category.service';
import { ApiService } from '../../../../../../core/services/api.service';
import { ProjectItemService } from '../../../../../../core/services/project-item.service';
import { ProjectCategory, Category } from '../../../../../../models';
import { LoadingSpinnerComponent } from '../../../../../../shared/components/loading-spinner/loading-spinner.component';
import { GbpPipe } from '../../../../../../shared/pipes/gbp.pipe';

/** v1.46 — Brief-tab AI item-matching shapes (POST /taxonomy/match-items). */
interface MatchItem {
  item_id: string; name: string; description?: string; base_price: number | null;
  supplier_id?: string; supplier_name: string; subcategory_name?: string | null;
  score: number; reason: string;
}
interface MatchSupplier {
  supplier_id: string; supplier_name: string; description?: string;
  fit_reason: string; item_count: number;
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
  /** v1.49e — the brief text this search ran against (drives whether
      "Find again" should re-enable) + when it ran. */
  searched_brief?: string; searched_at?: string;
}
type DetailView =
  | { kind: 'item'; item: MatchItem; tier: string }
  | { kind: 'proposed'; item: ProposedItem }
  | { kind: 'supplier'; supplier: MatchSupplier }
  | null;

/**
 * Project Brief tab — v1.47 three-column workspace.
 *
 * Col 1  category list (the project's scoped categories)
 * Col 2  focus panel — the selected category's editable brief + budget,
 *        the "✦ Find items" action, and the AI match results
 * Col 3  preview — the clicked result item OR supplier
 *
 * Categories are added through a right-side drawer of unused catalogue
 * categories. Briefs and budgets save on blur. "✦ Find items" calls the
 * v1.46 matcher; ✓ / ♡ on a result add it to the project via
 * /taxonomy/add-match, which recomputes the category's ballpark cost.
 */
@Component({
  selector: 'app-brief',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ButtonModule, SidebarModule, ToastModule,
    LucideAngularModule, LoadingSpinnerComponent, GbpPipe
  ],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading">
      <div class="bp-b2">

        <!-- ── HEADER ── -->
        <div class="bp-b2-head">
          <div>
            <h2 class="bp-b2-title">Brief</h2>
            <div class="bp-b2-sub">Pick a category, review its brief, find items — click an item or supplier to preview it.</div>
          </div>
          <button class="bp-b2-addcat" type="button" (click)="addDrawerOpen = true">
            + Add category
          </button>
        </div>

        <!-- ── PROGRESS ── -->
        <div class="bp-b2-progress">
          <div class="bp-b2-pbar">
            <div class="bp-b2-pfill" [style.width.%]="sourcedPct"></div>
          </div>
          <div class="bp-b2-plbl">
            <span><b>{{ categoriesWithItems }}</b> of {{ projectCategories.length }} categories sourced</span>
            <span><b>{{ totalItemCount }}</b> items · <b>{{ projectTotal | gbp }}</b> estimated</span>
          </div>
        </div>

        <!-- ── 3-COLUMN BODY ── -->
        <div class="bp-b2-panes">

          <!-- COL 1 — categories -->
          <div>
            <div class="bp-b2-colhdr">Categories</div>
            <div class="bp-b2-catlist">
              <div *ngFor="let pc of projectCategories"
                   class="bp-b2-card"
                   [class.active]="pc.category_id === activeCategoryId"
                   (click)="selectCategory(pc.category_id)">
                <div class="bp-b2-ic">
                  <lucide-icon [name]="pc.category_icon_name || 'layers'" [size]="14"></lucide-icon>
                </div>
                <div class="bp-b2-card-mid">
                  <div class="bp-b2-card-name">{{ pc.category_name }}</div>
                  <div class="bp-b2-card-bud">
                    {{ pc.ballpark_budget ? (pc.ballpark_budget | gbp) : 'No budget' }}
                    <ng-container *ngIf="pc.ballpark_cost && pc.ballpark_cost > 0">
                      · est. {{ pc.ballpark_cost | gbp }}
                    </ng-container>
                  </div>
                </div>
                <div class="bp-b2-count" *ngIf="catItemCount(pc.category_id) as n"
                     [title]="n + ' item' + (n === 1 ? '' : 's') + ' · ' + (pc.ballpark_cost | gbp) + ' total'">
                  {{ n }}
                </div>
                <button class="bp-b2-remove" type="button"
                        title="Remove category"
                        (click)="removeCategory(pc, $event)">×</button>
              </div>
              <div *ngIf="!projectCategories.length" class="bp-b2-empty">
                No categories yet — use <b>+ Add category</b> to scope this project.
              </div>
            </div>
          </div>

          <!-- COL 2 — brief + matches -->
          <div>
            <div class="bp-b2-colhdr">Brief &amp; matches</div>
            <div class="bp-b2-panel">
              <ng-container *ngIf="activeCategory as ac; else noCat">

                <!-- workspace -->
                <div class="bp-b2-ws">
                  <div class="bp-b2-ws-top">
                    <div class="bp-b2-ws-ic">
                      <lucide-icon [name]="ac.category_icon_name || 'layers'" [size]="16"></lucide-icon>
                    </div>
                    <div class="bp-b2-ws-name">{{ ac.category_name }}</div>
                  </div>
                  <div class="bp-b2-flabel">Brief — what suppliers quote against</div>
                  <textarea class="bp-b2-brief"
                            rows="3"
                            [value]="ac.requirement_brief || ''"
                            placeholder="What you need from this category — keep it specific."
                            (blur)="onBriefBlur(ac, $event)"></textarea>
                  <div class="bp-b2-ws-row">
                    <div>
                      <div class="bp-b2-flabel">Budget</div>
                      <div class="bp-b2-money">
                        <span>£</span>
                        <input type="text" inputmode="numeric"
                               [value]="budgetDisplay(ac)"
                               placeholder="0"
                               (focus)="onBudgetFocus(ac, $event)"
                               (blur)="onBudgetBlur(ac, $event)"/>
                      </div>
                    </div>
                    <div>
                      <div class="bp-b2-flabel">Est. cost</div>
                      <div class="bp-b2-est">
                        <ng-container *ngIf="ac.ballpark_cost && ac.ballpark_cost > 0; else noEst">
                          {{ ac.ballpark_cost | gbp }}
                          <small>· {{ catItemCount(ac.category_id) }} selected</small>
                        </ng-container>
                        <ng-template #noEst><small>— not found yet</small></ng-template>
                      </div>
                    </div>
                    <button class="bp-b2-find"
                            type="button"
                            [class.ghost]="!!activeResult"
                            [disabled]="findDisabled(ac)"
                            [title]="briefSearched(ac) ? 'Items already found — edit the brief to search again' : ''"
                            (click)="findItems(ac)">
                      {{ briefSearched(ac) ? '✓' : '✦' }} {{ findBtnLabel(ac) }}
                    </button>
                  </div>
                </div>

                <!-- results -->
                <ng-container *ngIf="activeResult as r; else findPrompt">
                  <div class="bp-b2-res">
                    <div class="bp-b2-searchln">
                      <span class="bp-b2-spark">✦</span>
                      Searched <em>{{ r.search_terms.length ? r.search_terms.join(', ') : '—' }}</em>
                      · scanned {{ r.items_scanned }} items / {{ r.suppliers_scanned }} suppliers
                    </div>

                    <!-- matched -->
                    <div>
                      <div class="bp-b2-sech">Matched <span class="bp-b2-dim">7+</span></div>
                      <ng-container *ngIf="r.matched_items.length; else noMatched">
                        <div *ngFor="let m of r.matched_items"
                             class="bp-b2-row"
                             [class.active]="isDetailItem(m.item_id)"
                             (click)="openItemDetail(m)">
                          <div class="bp-b2-thumb">{{ catLetter(m.name) }}</div>
                          <div class="bp-b2-row-mid">
                            <div class="bp-b2-row-name">{{ m.name }}</div>
                            <div class="bp-b2-row-sub">{{ m.supplier_name }}</div>
                          </div>
                          <span class="bp-b2-row-price">{{ m.base_price != null ? (m.base_price | gbp) : '—' }}</span>
                          <span class="bp-b2-score">{{ m.score }}/10</span>
                          <div class="bp-b2-qa">
                            <button class="bp-b2-iact" [class.on]="isItemAdded(m.item_id)"
                                    title="Select for project"
                                    (click)="addMatched(ac, m, 'selected', $event)">✓</button>
                            <button class="bp-b2-iact like"
                                    title="Add to wishlist"
                                    (click)="addMatched(ac, m, 'liked', $event)">♡</button>
                          </div>
                        </div>
                      </ng-container>
                      <ng-template #noMatched>
                        <div class="bp-b2-emptyln">No exact matches — see the proposal below.</div>
                      </ng-template>
                    </div>

                    <!-- closest -->
                    <div *ngIf="r.closest_item as ci">
                      <div class="bp-b2-sech">Closest <span class="bp-b2-dim">4–6</span></div>
                      <div class="bp-b2-row"
                           [class.active]="isDetailItem(ci.item_id)"
                           (click)="openItemDetail(ci)">
                        <div class="bp-b2-thumb">{{ catLetter(ci.name) }}</div>
                        <div class="bp-b2-row-mid">
                          <div class="bp-b2-row-name">{{ ci.name }}</div>
                          <div class="bp-b2-row-sub">{{ ci.supplier_name }}</div>
                        </div>
                        <span class="bp-b2-row-price">{{ ci.base_price != null ? (ci.base_price | gbp) : '—' }}</span>
                        <span class="bp-b2-score">{{ ci.score }}/10</span>
                        <div class="bp-b2-qa">
                          <button class="bp-b2-iact" [class.on]="isItemAdded(ci.item_id)"
                                  title="Select for project"
                                  (click)="addMatched(ac, ci, 'selected', $event)">✓</button>
                          <button class="bp-b2-iact like"
                                  title="Add to wishlist"
                                  (click)="addMatched(ac, ci, 'liked', $event)">♡</button>
                        </div>
                      </div>
                    </div>

                    <!-- suppliers -->
                    <div *ngIf="r.suppliers_ranked.length">
                      <div class="bp-b2-sech">Suppliers <span class="bp-b2-dim">— click to preview</span></div>
                      <div *ngFor="let s of r.suppliers_ranked; let i = index"
                           class="bp-b2-row"
                           [class.active]="isDetailSupplier(s.supplier_id)"
                           (click)="openSupplierDetail(s)">
                        <div class="bp-b2-thumb">{{ catLetter(s.supplier_name) }}</div>
                        <div class="bp-b2-row-mid">
                          <div class="bp-b2-row-name">
                            <span *ngIf="i === 0" class="bp-b2-star">★</span>{{ s.supplier_name }}
                          </div>
                          <div class="bp-b2-row-sub">{{ s.fit_reason }}</div>
                        </div>
                        <span class="bp-b2-score">{{ s.item_count }} items</span>
                        <span class="bp-b2-chev">›</span>
                      </div>
                    </div>

                    <!-- proposed -->
                    <div *ngIf="r.proposed_item as p">
                      <div class="bp-b2-sech">Proposed</div>
                      <div class="bp-b2-row proposed"
                           [class.active]="detail?.kind === 'proposed'"
                           (click)="openProposedDetail(p)">
                        <div class="bp-b2-thumb">🤖</div>
                        <div class="bp-b2-row-mid">
                          <div class="bp-b2-row-name">{{ p.name }}</div>
                          <div class="bp-b2-row-sub">→ {{ p.supplier_name }}</div>
                        </div>
                        <span class="bp-b2-row-price">{{ p.estimated_price | gbp }}</span>
                        <span class="bp-b2-score">{{ p.confidence }}/10</span>
                        <div class="bp-b2-qa">
                          <button class="bp-b2-iact" [class.on]="addedProposed.has(ac.category_id)"
                                  title="Add the proposed item"
                                  (click)="addProposed(ac, p, 'selected', $event)">✓</button>
                          <button class="bp-b2-iact like"
                                  title="Add to wishlist"
                                  (click)="addProposed(ac, p, 'liked', $event)">♡</button>
                        </div>
                      </div>
                    </div>

                    <!-- hint -->
                    <div class="bp-b2-hint">
                      <label>💬 I would have looked for…</label>
                      <div class="bp-b2-hint-row">
                        <input type="text"
                               [value]="hintDrafts.get(ac.category_id) || ''"
                               placeholder="search terms the AI missed"
                               (input)="onHintInput(ac, $event)"/>
                        <button type="button" (click)="submitHint(ac)">Submit</button>
                      </div>
                    </div>
                  </div>
                </ng-container>

                <ng-template #findPrompt>
                  <div class="bp-b2-prompt">
                    <div class="bp-b2-prompt-spark">✦</div>
                    Click <b>✦ Find items</b> to match this brief against the catalogue —
                    scored items, ranked suppliers, and a proposed item if nothing fits.
                  </div>
                </ng-template>

              </ng-container>
              <ng-template #noCat>
                <div class="bp-b2-prompt">
                  <div class="bp-b2-prompt-spark">✦</div>
                  Select a category on the left to review its brief and find items.
                </div>
              </ng-template>
            </div>
          </div>

          <!-- COL 3 — preview -->
          <div>
            <div class="bp-b2-colhdr">Preview</div>
            <div class="bp-b2-detail">

              <ng-container [ngSwitch]="detail?.kind">

                <!-- item / proposed -->
                <ng-container *ngSwitchCase="'item'">
                  <ng-container *ngTemplateOutlet="itemDetail; context: { $implicit: detailItem }"></ng-container>
                </ng-container>
                <ng-container *ngSwitchCase="'proposed'">
                  <ng-container *ngTemplateOutlet="itemDetail; context: { $implicit: detailItem }"></ng-container>
                </ng-container>

                <!-- supplier -->
                <ng-container *ngSwitchCase="'supplier'">
                  <div class="bp-b2-d-hero sup">{{ supplierInitials(detailSupplier!.supplier_name) }}</div>
                  <div class="bp-b2-d-body">
                    <div class="bp-b2-d-eyebrow">Supplier</div>
                    <div class="bp-b2-d-name">{{ detailSupplier!.supplier_name }}</div>
                    <div class="bp-b2-d-sub">{{ activeCategory?.category_name }}</div>
                    <div class="bp-b2-d-stat">
                      <div class="n">{{ detailSupplier!.item_count }}</div>
                      <div class="k">items in this category</div>
                    </div>
                    <div class="bp-b2-d-box" *ngIf="detailSupplier!.fit_reason">
                      <div class="l">✦ Why this supplier</div>
                      <div class="r">{{ detailSupplier!.fit_reason }}</div>
                    </div>
                    <div class="bp-b2-d-desc" *ngIf="detailSupplier!.description">
                      {{ detailSupplier!.description }}
                    </div>
                    <button class="bp-b2-d-store" type="button"
                            (click)="viewStore(detailSupplier!.supplier_id)">
                      View store →
                    </button>
                  </div>
                </ng-container>

                <!-- empty -->
                <div *ngSwitchDefault class="bp-b2-d-empty">
                  <div class="big">◳</div>
                  <div class="t">Nothing selected</div>
                  <div class="s">Click an item or a supplier in the results to preview it here.</div>
                </div>

              </ng-container>

            </div>
          </div>

        </div>
      </div>
    </ng-container>

    <!-- shared item / proposed-item detail body -->
    <ng-template #itemDetail let-d>
      <div class="bp-b2-d-hero">{{ d.proposed ? '🤖' : catLetter(d.name) }}</div>
      <div class="bp-b2-d-body">
        <div class="bp-b2-d-eyebrow">
          {{ activeCategory?.category_name }} · {{ d.proposed ? 'Proposed item' : 'Catalogue item' }}
        </div>
        <div class="bp-b2-d-name">{{ d.name }}</div>
        <div class="bp-b2-d-sub">{{ d.supplier_name }}</div>
        <div class="bp-b2-d-pricerow">
          <span class="bp-b2-d-price">{{ d.price | gbp }}</span>
          <span class="bp-b2-d-score">{{ d.proposed ? 'Confidence ' : '' }}{{ d.score }}/10</span>
        </div>
        <div class="bp-b2-d-box" *ngIf="d.reason">
          <div class="l">✦ Why this matched</div>
          <div class="r">{{ d.reason }}</div>
        </div>
        <div class="bp-b2-d-desc" *ngIf="d.description">{{ d.description }}</div>
        <div class="bp-b2-d-actions">
          <button class="bp-b2-d-sel" [class.on]="d.added" type="button"
                  (click)="addFromDetail('selected')">
            {{ d.added ? '✓ Selected' : '✓ Select for project' }}
          </button>
          <button class="bp-b2-d-like" type="button" (click)="addFromDetail('liked')">♡</button>
        </div>
      </div>
    </ng-template>

    <!-- ── ADD CATEGORY DRAWER ── -->
    <p-sidebar [(visible)]="addDrawerOpen" position="right" [style]="{ width: '380px' }"
               styleClass="bp-b2-drawer" [showCloseIcon]="false">
      <div class="bp-b2-dw-head">
        <div>
          <div class="bp-b2-dw-label">SCOPE</div>
          <div class="bp-b2-dw-title">Add a category</div>
        </div>
        <button class="bp-b2-dw-x" type="button" (click)="addDrawerOpen = false">×</button>
      </div>
      <div class="bp-b2-dw-body">
        <div class="bp-b2-dw-hint">
          Categories already in the project are hidden. Click one to add it.
        </div>
        <button *ngFor="let c of unusedCategories"
                type="button" class="bp-b2-dw-cat"
                (click)="addCategory(c)">
          <div class="bp-b2-ic">
            <lucide-icon [name]="c.icon_name || 'layers'" [size]="14"></lucide-icon>
          </div>
          <span class="bp-b2-dw-cat-name">{{ c.name }}</span>
          <span class="bp-b2-dw-plus">+</span>
        </button>
        <div *ngIf="!unusedCategories.length" class="bp-b2-empty">
          Every catalogue category is already in this project.
        </div>
      </div>
    </p-sidebar>

    <p-toast></p-toast>
  `,
  styles: [`
    :host { display: block; }
    .bp-b2 { padding: 24px var(--section-pad, 40px) 60px; }

    /* header */
    .bp-b2-head { display: flex; align-items: flex-end; justify-content: space-between; }
    .bp-b2-title { font-family: var(--font-display); font-size: 30px; font-weight: 400;
      letter-spacing: -0.01em; color: var(--color-text-primary); margin: 0; }
    .bp-b2-sub { font-size: 12.5px; color: var(--color-text-secondary); margin-top: 3px; }
    .bp-b2-addcat { display: inline-flex; align-items: center; gap: 6px;
      font-family: var(--font-body); font-size: 12px; font-weight: 600;
      color: var(--theme-accent); background: var(--color-surface);
      border: 0.5px solid var(--theme-border); padding: 7px 13px;
      border-radius: 7px; cursor: pointer; transition: background 0.15s; }
    .bp-b2-addcat:hover { background: var(--theme-bg); }

    /* progress */
    .bp-b2-progress { margin: 14px 0 18px; }
    .bp-b2-pbar { height: 5px; background: var(--color-border); border-radius: 3px; overflow: hidden; }
    .bp-b2-pfill { height: 100%; background: var(--theme-accent); transition: width 0.3s; }
    .bp-b2-plbl { display: flex; justify-content: space-between; font-size: 11px;
      color: var(--color-text-muted); margin-top: 6px; }
    .bp-b2-plbl b { color: var(--color-text-secondary); font-weight: 600; }

    /* 3-col */
    .bp-b2-panes { display: grid; grid-template-columns: 236px minmax(0,1fr) 340px;
      gap: 14px; align-items: start; }
    .bp-b2-colhdr { font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--color-text-muted); padding: 0 4px 6px; }

    /* col 1 */
    .bp-b2-catlist { display: flex; flex-direction: column; gap: 5px; }
    .bp-b2-card { display: flex; align-items: center; gap: 9px; background: var(--color-surface);
      border: 0.5px solid var(--color-border); border-left: 3px solid transparent;
      border-radius: 8px; padding: 9px 11px; cursor: pointer; transition: all 0.12s; }
    .bp-b2-card:hover { border-color: var(--theme-border); }
    .bp-b2-card:hover .bp-b2-remove { opacity: 1; }
    .bp-b2-card.active { border-left-color: var(--theme-accent);
      box-shadow: 0 3px 12px rgba(0,0,0,0.07); }
    .bp-b2-ic { width: 26px; height: 26px; border-radius: 50%; background: var(--theme-bg);
      color: var(--theme-accent); display: flex; align-items: center; justify-content: center;
      font-family: var(--font-display); font-size: 12px; font-weight: 600; flex-shrink: 0; }
    .bp-b2-card.active .bp-b2-ic { background: var(--theme-accent); color: #fff; }
    .bp-b2-card-mid { flex: 1; min-width: 0; }
    .bp-b2-card-name { font-size: 12.5px; font-weight: 600; line-height: 1.25;
      color: var(--color-text-primary); }
    .bp-b2-card-bud { font-size: 10px; color: var(--color-text-muted); margin-top: 1px; }
    .bp-b2-count { min-width: 19px; height: 19px; border-radius: 10px; background: var(--theme-accent);
      color: #fff; font-size: 10.5px; font-weight: 700; display: flex; align-items: center;
      justify-content: center; padding: 0 5px; flex-shrink: 0; }
    .bp-b2-remove { width: 20px; height: 20px; border-radius: 5px; flex-shrink: 0;
      border: none; background: none; color: var(--color-text-muted); cursor: pointer;
      font-size: 15px; line-height: 1; opacity: 0; transition: opacity 0.12s, color 0.12s; }
    .bp-b2-remove:hover { color: var(--color-danger); }

    /* col 2 */
    .bp-b2-panel { background: var(--color-surface); border: 0.5px solid var(--color-border);
      border-radius: 11px; overflow: hidden; min-height: 540px; }
    .bp-b2-ws { padding: 15px 17px 14px; border-bottom: 0.5px solid var(--color-border); }
    .bp-b2-ws-top { display: flex; align-items: center; gap: 9px; margin-bottom: 11px; }
    .bp-b2-ws-ic { width: 30px; height: 30px; border-radius: 50%; background: var(--theme-accent);
      color: #fff; display: flex; align-items: center; justify-content: center;
      font-family: var(--font-display); font-size: 13px; font-weight: 600; }
    .bp-b2-ws-name { font-family: var(--font-display); font-size: 17px; color: var(--color-text-primary); }
    .bp-b2-flabel { font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 5px; }
    .bp-b2-brief { width: 100%; font-family: var(--font-body); font-size: 13px; line-height: 1.6;
      color: var(--color-text-primary); background: var(--theme-bg);
      border: 0.5px solid var(--color-border); border-radius: 8px; padding: 10px 12px;
      resize: vertical; outline: none; }
    .bp-b2-brief:focus { border-color: var(--theme-accent); background: var(--color-surface); }
    .bp-b2-ws-row { display: flex; align-items: flex-end; gap: 14px; margin-top: 11px; }
    .bp-b2-money { display: flex; align-items: center; background: var(--color-surface);
      border: 0.5px solid var(--color-border); border-radius: 6px; padding: 5px 9px; width: 118px; }
    .bp-b2-money span { color: var(--color-text-muted); font-size: 12.5px; }
    .bp-b2-money input { border: none; outline: none; font-family: var(--font-body);
      font-size: 12.5px; width: 100%; background: transparent; color: var(--color-text-primary); }
    .bp-b2-est { font-size: 13px; font-weight: 600; padding: 5px 0; color: var(--color-text-primary); }
    .bp-b2-est small { color: var(--color-text-muted); font-weight: 500; }
    .bp-b2-find { margin-left: auto; display: inline-flex; align-items: center; gap: 6px;
      font-family: var(--font-body); font-size: 12px; font-weight: 600; color: #fff;
      background: var(--theme-accent); border: none; padding: 8px 15px; border-radius: 8px;
      cursor: pointer; transition: filter 0.15s; }
    .bp-b2-find:hover:not(:disabled) { filter: brightness(1.07); }
    .bp-b2-find:disabled { opacity: 0.55; cursor: default; }
    .bp-b2-find.ghost { background: var(--color-surface); color: var(--theme-accent);
      border: 0.5px solid var(--theme-border); }

    .bp-b2-res { padding: 13px 17px 18px; display: flex; flex-direction: column; gap: 14px; }
    .bp-b2-prompt { text-align: center; padding: 60px 32px; color: var(--color-text-muted);
      font-size: 12.5px; line-height: 1.6; }
    .bp-b2-prompt-spark { font-size: 22px; color: var(--theme-accent); margin-bottom: 6px; }
    .bp-b2-searchln { font-size: 10.5px; color: var(--color-text-muted); line-height: 1.5; }
    .bp-b2-searchln em { font-style: normal; font-weight: 600; color: var(--color-text-secondary); }
    .bp-b2-spark { color: var(--theme-accent); }
    .bp-b2-sech { font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--color-text-secondary); margin-bottom: 7px; }
    .bp-b2-dim { color: var(--color-text-muted); }
    .bp-b2-emptyln { font-size: 11px; color: var(--color-text-muted); font-style: italic; }

    .bp-b2-row { display: flex; align-items: center; gap: 9px; border: 0.5px solid var(--color-border);
      border-radius: 8px; padding: 8px 10px; margin-bottom: 6px; cursor: pointer; transition: all 0.12s; }
    .bp-b2-row:hover { border-color: var(--theme-border); }
    .bp-b2-row.active { border-color: var(--theme-accent); background: var(--theme-bg); }
    .bp-b2-row.proposed { border-style: dashed; border-color: var(--theme-accent); background: var(--theme-bg); }
    .bp-b2-thumb { width: 34px; height: 34px; border-radius: 6px; flex-shrink: 0; background: var(--theme-bg);
      display: flex; align-items: center; justify-content: center; color: var(--theme-accent);
      font-family: var(--font-display); font-size: 13px; font-weight: 600; }
    .bp-b2-row-mid { flex: 1; min-width: 0; }
    .bp-b2-row-name { font-size: 12.5px; font-weight: 600; line-height: 1.25;
      color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bp-b2-row-sub { font-size: 10px; color: var(--color-text-muted); margin-top: 1px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bp-b2-row-price { font-size: 12px; font-weight: 600; flex-shrink: 0; color: var(--color-text-primary); }
    .bp-b2-score { font-size: 9.5px; font-weight: 700; color: var(--theme-accent);
      background: var(--theme-bg); border-radius: 10px; padding: 1px 6px; flex-shrink: 0; }
    .bp-b2-star { color: var(--theme-accent); margin-right: 4px; }
    .bp-b2-chev { color: var(--color-text-muted); font-size: 13px; flex-shrink: 0; }
    .bp-b2-qa { display: flex; gap: 4px; flex-shrink: 0; }
    .bp-b2-iact { width: 26px; height: 26px; border-radius: 6px; border: 0.5px solid var(--color-border);
      background: var(--color-surface); cursor: pointer; display: flex; align-items: center;
      justify-content: center; font-size: 12px; color: var(--color-text-muted); transition: all 0.12s; }
    .bp-b2-iact:hover { border-color: var(--theme-accent); color: var(--theme-accent); }
    .bp-b2-iact.on { background: var(--theme-accent); border-color: var(--theme-accent); color: #fff; }
    .bp-b2-iact.like:hover { border-color: #E11D48; color: #E11D48; }

    .bp-b2-hint { border-top: 0.5px solid var(--color-border); padding-top: 11px; }
    .bp-b2-hint label { font-size: 10.5px; color: var(--color-text-secondary);
      display: block; margin-bottom: 5px; }
    .bp-b2-hint-row { display: flex; gap: 6px; }
    .bp-b2-hint-row input { flex: 1; min-width: 0; font-family: var(--font-body); font-size: 11px;
      padding: 6px 8px; border: 0.5px solid var(--color-border); border-radius: 6px; outline: none; }
    .bp-b2-hint-row input:focus { border-color: var(--theme-accent); }
    .bp-b2-hint-row button { font-family: var(--font-body); font-size: 10.5px; font-weight: 600;
      padding: 6px 11px; border-radius: 6px; background: var(--color-surface);
      color: var(--theme-accent); border: 0.5px solid var(--theme-border); cursor: pointer; }

    /* col 3 */
    .bp-b2-detail { background: var(--color-surface); border: 0.5px solid var(--color-border);
      border-radius: 11px; overflow: hidden; position: sticky; top: 16px; }
    .bp-b2-d-empty { display: flex; flex-direction: column; align-items: center;
      justify-content: center; text-align: center; padding: 110px 30px; gap: 7px; }
    .bp-b2-d-empty .big { font-size: 24px; color: var(--color-text-muted); }
    .bp-b2-d-empty .t { font-family: var(--font-display); font-size: 15px; color: var(--color-text-primary); }
    .bp-b2-d-empty .s { font-size: 11.5px; color: var(--color-text-muted); max-width: 210px; line-height: 1.5; }
    .bp-b2-d-hero { height: 144px; display: flex; align-items: center; justify-content: center;
      color: #fff; font-family: var(--font-display); font-size: 40px; font-weight: 600;
      background: linear-gradient(150deg, var(--theme-accent), rgba(0,0,0,0.55)); }
    .bp-b2-d-hero.sup { font-size: 28px; letter-spacing: 0.04em; }
    .bp-b2-d-body { padding: 14px 16px; }
    .bp-b2-d-eyebrow { font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--theme-accent); margin-bottom: 4px; }
    .bp-b2-d-name { font-family: var(--font-display); font-size: 18px; line-height: 1.25;
      color: var(--color-text-primary); }
    .bp-b2-d-sub { font-size: 11.5px; color: var(--color-text-secondary); margin-top: 3px; }
    .bp-b2-d-pricerow { display: flex; align-items: center; gap: 10px; margin: 11px 0;
      padding: 10px 0; border-top: 0.5px solid var(--color-border);
      border-bottom: 0.5px solid var(--color-border); }
    .bp-b2-d-price { font-family: var(--font-display); font-size: 22px; color: var(--color-text-primary); }
    .bp-b2-d-score { font-size: 10px; font-weight: 700; color: var(--theme-accent);
      background: var(--theme-bg); border-radius: 10px; padding: 2px 9px; }
    .bp-b2-d-stat { display: flex; gap: 6px; align-items: baseline; margin: 11px 0; }
    .bp-b2-d-stat .n { font-family: var(--font-display); font-size: 20px; color: var(--color-text-primary); }
    .bp-b2-d-stat .k { font-size: 11px; color: var(--color-text-muted); }
    .bp-b2-d-box { background: var(--theme-bg); border: 0.5px solid var(--theme-border);
      border-radius: 8px; padding: 9px 11px; margin-bottom: 11px; }
    .bp-b2-d-box .l { font-size: 9px; font-weight: 700; letter-spacing: 0.07em;
      text-transform: uppercase; color: var(--theme-accent); margin-bottom: 3px; }
    .bp-b2-d-box .r { font-size: 11.5px; color: var(--color-text-secondary); line-height: 1.5; }
    .bp-b2-d-desc { font-size: 12px; color: var(--color-text-secondary); line-height: 1.6; margin-bottom: 13px; }
    .bp-b2-d-actions { display: flex; gap: 8px; }
    .bp-b2-d-sel { flex: 1; font-family: var(--font-body); font-size: 12.5px; font-weight: 600;
      color: #fff; background: var(--theme-accent); border: none; padding: 10px;
      border-radius: 8px; cursor: pointer; }
    .bp-b2-d-sel.on { filter: brightness(0.9); }
    .bp-b2-d-like { width: 42px; font-size: 15px; background: var(--color-surface);
      border: 0.5px solid var(--color-border); border-radius: 8px; cursor: pointer;
      color: var(--color-text-muted); }
    .bp-b2-d-like:hover { color: #E11D48; border-color: #E11D48; }
    .bp-b2-d-store { width: 100%; font-family: var(--font-body); font-size: 12.5px; font-weight: 600;
      color: var(--theme-accent); background: var(--color-surface);
      border: 0.5px solid var(--theme-border); padding: 10px; border-radius: 8px; cursor: pointer; }
    .bp-b2-d-store:hover { background: var(--theme-bg); }

    .bp-b2-empty { font-size: 12px; color: var(--color-text-muted); font-style: italic;
      text-align: center; padding: 22px 14px; border: 0.5px dashed var(--color-border);
      border-radius: 8px; }

    /* add-category drawer */
    .bp-b2-dw-head { display: flex; align-items: flex-start; justify-content: space-between;
      padding: 16px 18px; border-bottom: 0.5px solid var(--color-border); }
    .bp-b2-dw-label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
      color: var(--theme-accent); }
    .bp-b2-dw-title { font-family: var(--font-display); font-size: 19px; color: var(--color-text-primary);
      margin-top: 2px; }
    .bp-b2-dw-x { background: none; border: none; font-size: 20px; line-height: 1; cursor: pointer;
      color: var(--color-text-muted); }
    .bp-b2-dw-body { padding: 14px 18px; }
    .bp-b2-dw-hint { font-size: 11.5px; color: var(--color-text-muted); line-height: 1.5;
      margin-bottom: 12px; }
    .bp-b2-dw-cat { display: flex; align-items: center; gap: 10px; width: 100%;
      background: var(--color-surface); border: 0.5px solid var(--color-border);
      border-radius: 8px; padding: 9px 11px; margin-bottom: 6px; cursor: pointer;
      font-family: var(--font-body); transition: all 0.12s; }
    .bp-b2-dw-cat:hover { border-color: var(--theme-accent); background: var(--theme-bg); }
    .bp-b2-dw-cat-name { flex: 1; text-align: left; font-size: 13px; font-weight: 600;
      color: var(--color-text-primary); }
    .bp-b2-dw-plus { font-size: 16px; font-weight: 700; color: var(--theme-accent); }

    @media (max-width: 1000px) {
      .bp-b2-panes { grid-template-columns: 1fr; }
      .bp-b2-detail { position: static; }
    }
  `]
})
export class BriefComponent implements OnInit, OnDestroy {
  loading = true;
  pid = '';
  project: any = null;

  catalogueParents: Category[] = [];
  projectCategories: ProjectCategory[] = [];
  projectItems: any[] = [];
  activeCategoryId: string | null = null;

  matchResults = new Map<string, MatchResult>();
  matchLoading = new Set<string>();
  hintDrafts = new Map<string, string>();
  /** category ids whose AI-proposed item has been added. */
  addedProposed = new Set<string>();

  detail: DetailView = null;
  addDrawerOpen = false;

  private briefTimers = new Map<string, any>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projSvc: ProjectService,
    private catSvc: CategoryService,
    private api: ApiService,
    private projItemSvc: ProjectItemService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.pid = this.route.parent?.snapshot.paramMap.get('id') || '';
    if (!this.pid) { this.loading = false; this.cdr.markForCheck(); return; }

    forkJoin({
      cats:    this.catSvc.getAll('catalogue'),
      pcs:     this.projSvc.getCategories(this.pid),
      project: this.projSvc.getById(this.pid),
      items:   this.projItemSvc.getByProject(this.pid)
    }).subscribe({
      next: ({ cats, pcs, project, items }) => {
        this.catalogueParents = (cats || [])
          .filter(c => !(c as any).parent_id)
          .sort((a, b) => ((a as any).sort_order || 0) - ((b as any).sort_order || 0));
        this.projectCategories = (pcs || []) as ProjectCategory[];
        this.project = project || null;
        this.projectItems = items || [];
        // v1.49e — rehydrate previously-saved "Find items" results so
        // they re-display without re-running the AI matcher.
        for (const pc of this.projectCategories) {
          const saved = pc.match_result_json;
          if (saved && saved.category_id) {
            this.matchResults.set(pc.category_id, saved as MatchResult);
          }
        }
        this.activeCategoryId = this.projectCategories.length
          ? this.projectCategories[0].category_id : null;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); }
    });
  }

  ngOnDestroy(): void {
    for (const t of this.briefTimers.values()) clearTimeout(t);
  }

  // ── Derived ───────────────────────────────────────────────────────────

  get activeCategory(): ProjectCategory | null {
    return this.projectCategories.find(p => p.category_id === this.activeCategoryId) || null;
  }
  get activeResult(): MatchResult | null {
    return this.activeCategoryId ? (this.matchResults.get(this.activeCategoryId) || null) : null;
  }
  get unusedCategories(): Category[] {
    const used = new Set(this.projectCategories.map(p => p.category_id));
    return this.catalogueParents.filter(c => !used.has(c.id));
  }
  get categoriesWithItems(): number {
    return this.projectCategories.filter(p => this.catItemCount(p.category_id) > 0).length;
  }
  get totalItemCount(): number { return this.projectItems.length; }
  get sourcedPct(): number {
    const n = this.projectCategories.length;
    return n ? Math.round(this.categoriesWithItems / n * 100) : 0;
  }
  get projectTotal(): number {
    return this.projectCategories.reduce((s, p) => s + (Number(p.ballpark_cost) || 0), 0);
  }

  catItemCount(catId: string): number {
    return this.projectItems.filter(pi => (pi.item_category_id) === catId).length;
  }
  catLetter(name?: string): string { return (name || '?').charAt(0).toUpperCase(); }
  supplierInitials(name?: string): string {
    return (name || '?').split(' ').slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase();
  }

  // ── Category selection / scope ────────────────────────────────────────

  selectCategory(catId: string): void {
    this.activeCategoryId = catId;
    this.detail = null;
  }

  removeCategory(pc: ProjectCategory, ev: Event): void {
    ev.stopPropagation();
    const catId = pc.category_id;
    this.projectCategories = this.projectCategories.filter(p => p.category_id !== catId);
    if (this.activeCategoryId === catId) {
      this.activeCategoryId = this.projectCategories.length
        ? this.projectCategories[0].category_id : null;
      this.detail = null;
    }
    this.cdr.markForCheck();
    this.projSvc.removeCategory(this.pid, catId).subscribe({
      next: () => this.projSvc.triggerRefresh(),
      error: () => this.msg.add({ severity: 'error', summary: 'Failed to remove category', life: 3000 })
    });
  }

  addCategory(c: Category): void {
    if (this.projectCategories.some(p => p.category_id === c.id)) return;
    this.projSvc.upsertCategory(this.pid, c.id, {}).subscribe({
      next: row => {
        const enriched = {
          ...row,
          category_name: c.name,
          category_icon_name: (c as any).icon_name,
          category_sort_order: (c as any).sort_order
        } as ProjectCategory;
        this.projectCategories = [...this.projectCategories, enriched]
          .sort((a, b) => ((a as any).category_sort_order || 0) - ((b as any).category_sort_order || 0));
        this.activeCategoryId = c.id;
        this.detail = null;
        this.projSvc.triggerRefresh();
        this.msg.add({ severity: 'success', summary: c.name + ' added', life: 2000 });
        this.cdr.markForCheck();
      },
      error: () => this.msg.add({ severity: 'error', summary: 'Failed to add category', life: 3000 })
    });
  }

  // ── Brief / budget — save on blur ─────────────────────────────────────

  onBriefBlur(pc: ProjectCategory, ev: Event): void {
    const value = (ev.target as HTMLTextAreaElement).value.trim();
    if (value === (pc.requirement_brief || '').trim()) return;
    pc.requirement_brief = value;
    const prev = this.briefTimers.get(pc.category_id);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => {
      this.briefTimers.delete(pc.category_id);
      this.projSvc.upsertCategory(this.pid, pc.category_id, { requirement_brief: value }).subscribe({
        next: () => this.msg.add({ severity: 'success', summary: 'Saved ✓', life: 1000 }),
        error: () => this.msg.add({ severity: 'error', summary: 'Failed to save brief', life: 3000 })
      });
    }, 700);
    this.briefTimers.set(pc.category_id, t);
  }

  /** v1.49h — budget shown with thousand separators ("12,000") so it
      reads consistently with the gbp-formatted costs. */
  budgetDisplay(pc: ProjectCategory): string {
    return pc.ballpark_budget == null
      ? '' : Number(pc.ballpark_budget).toLocaleString('en-GB');
  }

  /** Drop the separators on focus so the number is easy to edit. */
  onBudgetFocus(pc: ProjectCategory, ev: Event): void {
    (ev.target as HTMLInputElement).value =
      pc.ballpark_budget == null ? '' : String(pc.ballpark_budget);
  }

  onBudgetBlur(pc: ProjectCategory, ev: Event): void {
    const el = ev.target as HTMLInputElement;
    const raw = el.value.replace(/[^0-9.]/g, '');
    let next: number | null = raw === '' ? null : Number(raw);
    if (next != null && !isFinite(next)) next = null;
    const current = pc.ballpark_budget != null ? Number(pc.ballpark_budget) : null;
    pc.ballpark_budget = next ?? undefined;
    el.value = this.budgetDisplay(pc);   // re-render in the canonical format
    if (next === current) return;        // nothing actually changed
    this.projSvc.upsertCategory(this.pid, pc.category_id, { ballpark_budget: next }).subscribe({
      next: () => this.msg.add({ severity: 'success', summary: 'Saved ✓', life: 1000 }),
      error: () => this.msg.add({ severity: 'error', summary: 'Failed to save budget', life: 3000 })
    });
  }

  // ── Find items ────────────────────────────────────────────────────────

  /** v1.49e — true once a brief has been searched and the brief text
      has not changed since. Used to grey out "Find items" so the AI
      isn't re-run needlessly; editing the brief re-enables it. */
  briefSearched(pc: ProjectCategory): boolean {
    const r = this.matchResults.get(pc.category_id);
    if (!r) return false;
    return (pc.requirement_brief || '').trim() === (r.searched_brief || '').trim();
  }

  findDisabled(pc: ProjectCategory): boolean {
    return this.matchLoading.has(pc.category_id) || this.briefSearched(pc);
  }

  findBtnLabel(pc: ProjectCategory): string {
    if (this.matchLoading.has(pc.category_id)) return 'Searching…';
    if (this.briefSearched(pc)) return 'Items found';
    return this.matchResults.has(pc.category_id) ? 'Find again' : 'Find items';
  }

  findItems(pc: ProjectCategory): void {
    const brief = (pc.requirement_brief || '').trim();
    if (!brief) {
      this.msg.add({
        severity: 'warn', summary: 'Add a brief first',
        detail: 'Write what you need from this category, then Find items.', life: 3000
      });
      return;
    }
    const catId = pc.category_id;
    this.matchLoading.add(catId);
    this.cdr.markForCheck();
    this.api.post<MatchResult>('/taxonomy/match-items', {
      brief, categoryId: catId, projectId: this.pid,
      budgetEstimate: pc.ballpark_budget != null ? Number(pc.ballpark_budget) : undefined
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

  // ── Detail panel (col 3) ──────────────────────────────────────────────

  /** Normalised object the shared #itemDetail template renders. */
  get detailItem(): any {
    if (!this.detail) return null;
    if (this.detail.kind === 'item') {
      const it = this.detail.item;
      return {
        proposed: false, name: it.name, supplier_name: it.supplier_name,
        price: it.base_price, score: it.score, reason: it.reason,
        description: it.description, added: this.isItemAdded(it.item_id)
      };
    }
    if (this.detail.kind === 'proposed') {
      const p = this.detail.item;
      return {
        proposed: true, name: p.name, supplier_name: p.supplier_name,
        price: p.estimated_price, score: p.confidence, reason: p.reason,
        description: p.description, added: this.addedProposed.has(this.activeCategoryId || '')
      };
    }
    return null;
  }
  get detailSupplier(): MatchSupplier | null {
    return this.detail && this.detail.kind === 'supplier' ? this.detail.supplier : null;
  }
  isDetailItem(itemId: string): boolean {
    return !!this.detail && this.detail.kind === 'item' && this.detail.item.item_id === itemId;
  }
  isDetailSupplier(supId: string): boolean {
    return !!this.detail && this.detail.kind === 'supplier' && this.detail.supplier.supplier_id === supId;
  }

  openItemDetail(m: MatchItem): void { this.detail = { kind: 'item', item: m, tier: '' }; }
  openProposedDetail(p: ProposedItem): void { this.detail = { kind: 'proposed', item: p }; }
  openSupplierDetail(s: MatchSupplier): void { this.detail = { kind: 'supplier', supplier: s }; }

  viewStore(supplierId: string): void {
    if (supplierId) this.router.navigate(['/suppliers', supplierId]);
  }

  /** ✓ / ♡ inside the col-3 detail panel. */
  addFromDetail(stype: 'selected' | 'liked'): void {
    if (!this.detail || !this.activeCategory) return;
    if (this.detail.kind === 'item') {
      this.addMatched(this.activeCategory, this.detail.item, stype);
    } else if (this.detail.kind === 'proposed') {
      this.addProposed(this.activeCategory, this.detail.item, stype);
    }
  }

  // ── Add to project ────────────────────────────────────────────────────

  isItemAdded(itemId: string): boolean {
    return this.projectItems.some(pi => pi.item_id === itemId);
  }

  private pcId(pc: ProjectCategory): string | null {
    return pc.id && !String(pc.id).startsWith('pending-') ? pc.id : null;
  }

  addMatched(pc: ProjectCategory, m: MatchItem, stype: 'selected' | 'liked', ev?: Event): void {
    if (ev) ev.stopPropagation();
    this.api.post<{ project_item: any; ballpark_cost: number }>('/taxonomy/add-match', {
      project_id: this.pid, project_category_id: this.pcId(pc), category_id: pc.category_id,
      kind: 'matched', item_id: m.item_id, selection_type: stype,
      ai_confidence: m.score, ai_match_reason: m.reason
    }).subscribe({
      next: res => this.afterAdd(pc, res, stype === 'liked' ? 'Added to wishlist' : 'Added to project', m.name),
      error: () => this.msg.add({ severity: 'error', summary: 'Could not add item', life: 3500 })
    });
  }

  addProposed(pc: ProjectCategory, p: ProposedItem, stype: 'selected' | 'liked', ev?: Event): void {
    if (ev) ev.stopPropagation();
    this.api.post<{ project_item: any; ballpark_cost: number }>('/taxonomy/add-match', {
      project_id: this.pid, project_category_id: this.pcId(pc), category_id: pc.category_id,
      kind: 'proposed', selection_type: stype,
      ai_confidence: p.confidence, ai_match_reason: p.reason,
      proposed: {
        name: p.name, description: p.description,
        supplier_id: p.supplier_id, estimated_price: p.estimated_price
      }
    }).subscribe({
      next: res => {
        this.addedProposed.add(pc.category_id);
        this.afterAdd(pc, res, stype === 'liked' ? 'Added to wishlist' : 'Proposed item added', p.name);
      },
      error: () => this.msg.add({ severity: 'error', summary: 'Could not add proposed item', life: 3500 })
    });
  }

  private afterAdd(pc: ProjectCategory, res: { ballpark_cost: number }, summary: string, detail: string): void {
    if (res && res.ballpark_cost != null) pc.ballpark_cost = res.ballpark_cost;
    this.msg.add({ severity: 'success', summary, detail, life: 2500 });
    // Re-fetch project items so the badge counts + estimate stay accurate.
    this.projItemSvc.getByProject(this.pid).subscribe({
      next: items => { this.projectItems = items || []; this.cdr.markForCheck(); },
      error: () => this.cdr.markForCheck()
    });
    this.projSvc.triggerRefresh();
    this.cdr.markForCheck();
  }

  // ── Hint ──────────────────────────────────────────────────────────────

  onHintInput(pc: ProjectCategory, ev: Event): void {
    this.hintDrafts.set(pc.category_id, (ev.target as HTMLInputElement).value);
  }

  submitHint(pc: ProjectCategory): void {
    const hint = (this.hintDrafts.get(pc.category_id) || '').trim();
    if (!hint) return;
    const r = this.matchResults.get(pc.category_id);
    this.api.post('/taxonomy/search-hint', {
      projectId: this.pid, categoryId: pc.category_id,
      searchTerms: r ? r.search_terms : [], userHint: hint
    }).subscribe({
      next: () => {
        this.hintDrafts.set(pc.category_id, '');
        this.msg.add({ severity: 'success', summary: 'Thanks — hint saved for training', life: 2500 });
        this.cdr.markForCheck();
      },
      error: () => this.msg.add({ severity: 'error', summary: 'Could not save hint', life: 3000 })
    });
  }
}
