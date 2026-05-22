import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SidebarModule } from 'primeng/sidebar';
import { ToastModule } from 'primeng/toast';
import { DropdownModule } from 'primeng/dropdown';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';

import { ProjectService } from '../../../../../../core/services/project.service';
import { CategoryService } from '../../../../../../core/services/category.service';
import { ApiService } from '../../../../../../core/services/api.service';
import { ProjectItemService } from '../../../../../../core/services/project-item.service';
import { ItemService } from '../../../../../../core/services/item.service';
import { CodelistService } from '../../../../../../core/services/codelist.service';
import { OutreachService } from '../../../../../../core/services/outreach.service';
import { ProjectCategory, Category, Item } from '../../../../../../models';
import { LoadingSpinnerComponent } from '../../../../../../shared/components/loading-spinner/loading-spinner.component';
import { ItemDrawerComponent } from '../../../../../../shared/components/item-drawer/item-drawer.component';
import { GbpPipe } from '../../../../../../shared/pipes/gbp.pipe';

/** v1.46 — Brief-tab AI item-matching shapes (POST /taxonomy/match-items). */
interface MatchItem {
  item_id: string; name: string; description?: string; base_price: number | null;
  supplier_id?: string; supplier_name: string; subcategory_name?: string | null;
  score: number; reason: string;
  image_url?: string | null; image_display?: string | null;
}
interface MatchSupplier {
  supplier_id: string; supplier_name: string; description?: string;
  fit_reason: string; item_count: number;
  image_url?: string | null; image_display?: string | null;
}
interface ProposedItem {
  name: string; description: string; supplier_id: string; supplier_name: string;
  estimated_price: number; confidence: number; reason: string;
  /** v1.52f — the proposed item is pre-created as a real (inactive,
      approval-pending) catalogue row, so it carries a stable id.
      May be absent on match results cached before v1.52f. */
  item_id?: string;
  /** v1.52g — hero image. `undefined` = not yet hydrated from the item
      row; `null` = hydrated, no image. A user adds one via the ✎ drawer
      to show the supplier what they are looking for. */
  image_url?: string | null;
  image_display?: string | null;
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
 *        the "Find items" action, and the AI match results
 * Col 3  preview — the clicked result item OR supplier
 *
 * Categories are added through a right-side drawer of unused catalogue
 * categories. Briefs and budgets save on blur. "Find items" calls the
 * v1.46 matcher; select / like on a result add it to the project via
 * /taxonomy/add-match, which recomputes the category's ballpark cost.
 */
@Component({
  selector: 'app-brief',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, ButtonModule, SidebarModule, ToastModule,
    DropdownModule, LucideAngularModule, LoadingSpinnerComponent,
    ItemDrawerComponent, GbpPipe
  ],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading">
      <div class="bp-b2">

        <!-- ── HEADER ── -->
        <h2 class="bp-page-title">Brief</h2>
        <div class="bp-page-divider"></div>
        <div class="bp-b2-head">
          <p-button label="Add category" styleClass="p-button"
                    (onClick)="addDrawerOpen = true"></p-button>
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
                   [class.bp-b2-card--dim]="categoryDimmed(pc)"
                   (click)="selectCategory(pc.category_id)">
                <div class="bp-b2-ic">
                  <lucide-icon [name]="pc.category_icon_name || 'layers'" [size]="14"></lucide-icon>
                </div>
                <div class="bp-b2-card-mid">
                  <div class="bp-b2-card-nrow">
                    <div class="bp-b2-card-name">{{ pc.category_name }}</div>
                    <span class="bp-cat-pill" [ngStyle]="statusPillStyle(pc.status_code)">
                      {{ categoryStatusLabel(pc.status_code) }}
                    </span>
                  </div>
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
                <button class="bp-icon-btn bp-b2-remove" type="button"
                        title="Remove category"
                        (click)="removeCategory(pc, $event)">
                  <lucide-icon name="x" [size]="14"></lucide-icon>
                </button>
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
                    <!-- A2 — per-category workflow status, on the title line -->
                    <p-dropdown class="bp-b2-ws-status"
                                [options]="categoryStatuses"
                                optionLabel="label" optionValue="code"
                                [(ngModel)]="ac.status_code"
                                (onChange)="saveStatus(ac)"
                                placeholder="Draft"
                                appendTo="body"
                                styleClass="bp-b2-statusdd"
                                [style]="{ width: '172px' }"></p-dropdown>
                  </div>

                  <!-- Brief + Notes side by side -->
                  <div class="bp-b2-briefgrid">
                    <div class="bp-b2-bcol">
                      <div class="bp-b2-flabel">Brief</div>
                      <div class="bp-b2-fhelp">Sent to suppliers in the quote request</div>
                      <textarea class="bp-input-edit bp-b2-brief"
                                rows="4"
                                [value]="ac.requirement_brief || ''"
                                placeholder="What you need from this category — keep it specific."
                                (blur)="onBriefBlur(ac, $event)"></textarea>
                    </div>
                    <div class="bp-b2-bcol">
                      <div class="bp-b2-flabel">Notes</div>
                      <div class="bp-b2-fhelp">Your own notes — not included in supplier emails</div>
                      <textarea class="bp-input-edit bp-b2-notes"
                                rows="4"
                                [value]="ac.requirement_detail || ''"
                                placeholder="Private notes for your team."
                                (blur)="onNotesBlur(ac, $event)"></textarea>
                    </div>
                  </div>

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
                    <!-- A2 Step 7 — Client Managed categories aren't
                         actioned by the agency, so hide "Find items". -->
                    <p-button *ngIf="!isClientManaged(ac)"
                              class="bp-b2-find"
                              [styleClass]="activeResult ? 'p-button-outlined' : 'p-button'"
                              [disabled]="findDisabled(ac)"
                              [title]="briefSearched(ac) ? 'Items already found — edit the brief to search again' : ''"
                              (onClick)="findItems(ac)">
                      <lucide-icon [name]="briefSearched(ac) ? 'check' : 'sparkles'" [size]="14"></lucide-icon>
                      <span>{{ findBtnLabel(ac) }}</span>
                    </p-button>
                    <span *ngIf="isClientManaged(ac)" class="bp-b2-cmnote">
                      <lucide-icon name="user" [size]="13"></lucide-icon>
                      Managed by client
                    </span>
                  </div>
                </div>

                <!-- results -->
                <ng-container *ngIf="activeResult as r; else findPrompt">
                  <div class="bp-b2-res">
                    <div class="bp-b2-searchln">
                      <lucide-icon class="bp-b2-spark" name="sparkles" [size]="14"></lucide-icon>
                      Searched <em>{{ r.search_terms.length ? r.search_terms.join(', ') : '—' }}</em>
                      · scanned {{ r.items_scanned }} items / {{ r.suppliers_scanned }} suppliers
                    </div>

                    <!-- v1.53 — two-option layout: side-by-side when BOTH a
                         match/closest item AND a proposed item exist. -->
                    <ng-container *ngIf="(r.matched_items.length || r.closest_item) && r.proposed_item; else singleOption">
                      <div class="bp-b2-optbars">
                        <div class="bp-b2-optbar">Option 1 — Pick existing</div>
                        <div class="bp-b2-optbar">Option 2 — Quote a new item</div>
                      </div>
                      <div class="bp-b2-optgrid">
                        <div class="bp-b2-optcol">
                          <ng-container *ngTemplateOutlet="itemMatches; context: { $implicit: r, ac: ac }"></ng-container>
                        </div>
                        <div class="bp-b2-optcol">
                          <ng-container *ngTemplateOutlet="newItem; context: { $implicit: r, ac: ac }"></ng-container>
                        </div>
                      </div>
                    </ng-container>

                    <!-- single-option fallback — only one side has content -->
                    <ng-template #singleOption>
                      <div *ngIf="r.matched_items.length || r.closest_item">
                        <ng-container *ngTemplateOutlet="itemMatches; context: { $implicit: r, ac: ac }"></ng-container>
                      </div>
                      <div *ngIf="r.proposed_item">
                        <ng-container *ngTemplateOutlet="newItem; context: { $implicit: r, ac: ac }"></ng-container>
                      </div>
                    </ng-template>

                    <!-- hint -->
                    <div class="bp-b2-hint">
                      <label>
                        <lucide-icon name="message-square" [size]="14"></lucide-icon>
                        I would have looked for…
                      </label>
                      <div class="bp-b2-hint-row">
                        <input type="text"
                               [value]="hintDrafts.get(ac.category_id) || ''"
                               placeholder="search terms the AI missed"
                               (input)="onHintInput(ac, $event)"/>
                        <p-button label="Submit" styleClass="p-button"
                                  (onClick)="submitHint(ac)"></p-button>
                      </div>
                    </div>
                  </div>
                </ng-container>

                <ng-template #findPrompt>
                  <div class="bp-b2-prompt">
                    <lucide-icon class="bp-b2-prompt-spark" name="sparkles" [size]="22"></lucide-icon>
                    <div>
                      Click <b>Find items</b> to match this brief against the catalogue —
                      scored items, ranked suppliers, and a proposed item if nothing fits.
                    </div>
                  </div>
                </ng-template>

              </ng-container>
              <ng-template #noCat>
                <div class="bp-b2-prompt">
                  <lucide-icon class="bp-b2-prompt-spark" name="sparkles" [size]="22"></lucide-icon>
                  <div>Select a category on the left to review its brief and find items.</div>
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
                  <div class="bp-b2-d-hero sup"
                       [class.is-logo]="detailSupplier!.image_url && detailSupplier!.image_display === 'contain'"
                       [style.background-image]="detailSupplier!.image_url && detailSupplier!.image_display !== 'contain' ? 'url(' + detailSupplier!.image_url + ')' : null">
                    <img *ngIf="detailSupplier!.image_url && detailSupplier!.image_display === 'contain'"
                         [src]="detailSupplier!.image_url" [alt]="detailSupplier!.supplier_name"
                         class="bp-b2-d-hero-img"/>
                    <span *ngIf="!detailSupplier!.image_url">{{ supplierInitials(detailSupplier!.supplier_name) }}</span>
                  </div>
                  <div class="bp-b2-d-body">
                    <div class="bp-b2-d-eyebrow">Supplier</div>
                    <div class="bp-b2-d-name">{{ detailSupplier!.supplier_name }}</div>
                    <div class="bp-b2-d-sub">{{ activeCategory?.category_name }}</div>
                    <div class="bp-b2-d-stat">
                      <div class="n">{{ detailSupplier!.item_count }}</div>
                      <div class="k">items in this category</div>
                    </div>
                    <div class="bp-b2-d-box" *ngIf="detailSupplier!.fit_reason">
                      <div class="l">
                        <lucide-icon name="sparkles" [size]="14"></lucide-icon> Why this supplier
                      </div>
                      <div class="r">{{ detailSupplier!.fit_reason }}</div>
                    </div>
                    <div class="bp-b2-d-desc" *ngIf="detailSupplier!.description">
                      {{ detailSupplier!.description }}
                    </div>
                    <p-button label="View store" styleClass="p-button-outlined bp-b2-d-store"
                              icon="pi pi-arrow-right" iconPos="right"
                              (onClick)="viewStore(detailSupplier!.supplier_id)"></p-button>
                  </div>
                </ng-container>

                <!-- empty -->
                <div *ngSwitchDefault class="bp-b2-d-empty">
                  <lucide-icon class="big" name="image" [size]="24"></lucide-icon>
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
      <div class="bp-b2-d-hero"
           [class.is-logo]="d.image_url && d.image_display === 'contain'"
           [style.background-image]="d.image_url && d.image_display !== 'contain' ? 'url(' + d.image_url + ')' : null">
        <img *ngIf="d.image_url && d.image_display === 'contain'"
             [src]="d.image_url" [alt]="d.name" class="bp-b2-d-hero-img"/>
        <lucide-icon *ngIf="!d.image_url && d.proposed" name="bot" [size]="40"></lucide-icon>
        <span *ngIf="!d.image_url && !d.proposed">{{ catLetter(d.name) }}</span>
        <!-- v1.52d — action cluster, matching the marketplace detail card -->
        <div class="bp-b2-d-cluster">
          <button class="bp-b2-d-cbtn" type="button" [class.on]="d.added"
                  [title]="d.added ? 'Remove from project' : 'Select for project'"
                  (click)="addFromDetail('selected')">
            <lucide-icon [name]="d.added ? 'check' : 'plus'" [size]="14"></lucide-icon>
          </button>
          <button class="bp-b2-d-cbtn" type="button" title="Add to wishlist"
                  (click)="addFromDetail('liked')">
            <lucide-icon name="heart" [size]="14"></lucide-icon>
          </button>
          <button class="bp-b2-d-cbtn" type="button" title="Request a quote"
                  (click)="requestQuoteFromDetail()">
            <lucide-icon name="mail" [size]="14"></lucide-icon>
          </button>
          <button class="bp-b2-d-cbtn" type="button" title="Edit item"
                  (click)="d.proposed ? editProposed() : openFullItem()">
            <lucide-icon name="square-pen" [size]="14"></lucide-icon>
          </button>
          <button class="bp-b2-d-cbtn" type="button" title="View item"
                  (click)="d.proposed ? viewProposed() : openFullItem()">
            <lucide-icon name="eye" [size]="14"></lucide-icon>
          </button>
        </div>
      </div>
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
          <div class="l">
            <lucide-icon name="sparkles" [size]="14"></lucide-icon> Why this matched
          </div>
          <div class="r">{{ d.reason }}</div>
        </div>
        <div class="bp-b2-d-desc" *ngIf="d.description">{{ d.description }}</div>
      </div>
    </ng-template>

    <!-- Item matches section (Option 1) — matched + closest, one section -->
    <ng-template #itemMatches let-r let-ac="ac">
      <div class="bp-b2-sech">Item matches</div>
      <div class="bp-b2-rec">
        <lucide-icon class="bp-b2-spark" name="sparkles" [size]="14"></lucide-icon>
        {{ itemMatchRec }}
      </div>
      <div *ngFor="let m of r.matched_items"
           class="bp-b2-row"
           [class.active]="isDetailItem(m.item_id)"
           (click)="openItemDetail(m)">
        <div class="bp-b2-thumb"
             [class.bp-b2-thumb--img]="m.image_url"
             [style.background-image]="m.image_url ? 'url(' + m.image_url + ')' : null">
          <span *ngIf="!m.image_url">{{ catLetter(m.name) }}</span>
        </div>
        <div class="bp-b2-row-mid">
          <div class="bp-b2-row-name">{{ m.name }}</div>
          <div class="bp-b2-row-sub">{{ m.supplier_name }}</div>
        </div>
        <span class="bp-b2-row-price">{{ m.base_price != null ? (m.base_price | gbp) : '—' }}</span>
        <span class="bp-b2-score">{{ m.score }}/10</span>
        <div class="bp-b2-qa">
          <button class="bp-icon-btn bp-b2-iact" [class.on]="isItemAdded(m.item_id)"
                  [title]="isItemAdded(m.item_id) ? 'Remove from project' : 'Select for project'"
                  (click)="toggleMatched(ac, m, $event)">
            <lucide-icon name="check" [size]="14"></lucide-icon>
          </button>
          <button class="bp-icon-btn bp-b2-iact like"
                  title="Add to wishlist"
                  (click)="addMatched(ac, m, 'liked', $event)">
            <lucide-icon name="heart" [size]="14"></lucide-icon>
          </button>
          <button class="bp-icon-btn bp-b2-iact"
                  title="Request a quote"
                  (click)="requestQuote(m, false, $event)">
            <lucide-icon name="mail" [size]="14"></lucide-icon>
          </button>
        </div>
      </div>
      <div *ngIf="r.closest_item as ci"
           class="bp-b2-row"
           [class.active]="isDetailItem(ci.item_id)"
           (click)="openItemDetail(ci)">
        <div class="bp-b2-thumb"
             [class.bp-b2-thumb--img]="ci.image_url"
             [style.background-image]="ci.image_url ? 'url(' + ci.image_url + ')' : null">
          <span *ngIf="!ci.image_url">{{ catLetter(ci.name) }}</span>
        </div>
        <div class="bp-b2-row-mid">
          <div class="bp-b2-row-name">{{ ci.name }}</div>
          <div class="bp-b2-row-sub">{{ ci.supplier_name }} · closest fit</div>
        </div>
        <span class="bp-b2-row-price">{{ ci.base_price != null ? (ci.base_price | gbp) : '—' }}</span>
        <span class="bp-b2-score">{{ ci.score }}/10</span>
        <div class="bp-b2-qa">
          <button class="bp-icon-btn bp-b2-iact" [class.on]="isItemAdded(ci.item_id)"
                  [title]="isItemAdded(ci.item_id) ? 'Remove from project' : 'Select for project'"
                  (click)="toggleMatched(ac, ci, $event)">
            <lucide-icon name="check" [size]="14"></lucide-icon>
          </button>
          <button class="bp-icon-btn bp-b2-iact like"
                  title="Add to wishlist"
                  (click)="addMatched(ac, ci, 'liked', $event)">
            <lucide-icon name="heart" [size]="14"></lucide-icon>
          </button>
          <button class="bp-icon-btn bp-b2-iact"
                  title="Request a quote"
                  (click)="requestQuote(ci, false, $event)">
            <lucide-icon name="mail" [size]="14"></lucide-icon>
          </button>
        </div>
      </div>
    </ng-template>

    <!-- New item section (Option 2) — the AI proposal -->
    <ng-template #newItem let-r let-ac="ac">
      <div class="bp-b2-sech">New item</div>
      <div class="bp-b2-rec">
        <lucide-icon class="bp-b2-spark" name="sparkles" [size]="14"></lucide-icon>
        {{ newItemRec }}
      </div>
      <div *ngIf="r.proposed_item as p"
           class="bp-b2-row proposed"
           [class.active]="detail?.kind === 'proposed'"
           (click)="openProposedDetail(p)">
        <div class="bp-b2-thumb"
             [class.bp-b2-thumb--img]="p.image_url"
             [style.background-image]="p.image_url ? 'url(' + p.image_url + ')' : null">
          <lucide-icon *ngIf="!p.image_url" name="bot" [size]="16"></lucide-icon>
        </div>
        <div class="bp-b2-row-mid">
          <div class="bp-b2-row-name">{{ p.name }}</div>
          <div class="bp-b2-row-sub">→ {{ p.supplier_name }}</div>
        </div>
        <span class="bp-b2-row-price">{{ p.estimated_price | gbp }}</span>
        <span class="bp-b2-score">{{ p.confidence }}/10</span>
        <div class="bp-b2-qa">
          <button class="bp-icon-btn bp-b2-iact" [class.on]="proposedAdded(p, ac)"
                  [title]="proposedAdded(p, ac) ? 'Remove from project' : 'Add the proposed item'"
                  (click)="toggleProposed(ac, p, $event)">
            <lucide-icon name="check" [size]="14"></lucide-icon>
          </button>
          <button class="bp-icon-btn bp-b2-iact like"
                  title="Add to wishlist"
                  (click)="addProposed(ac, p, 'liked', $event)">
            <lucide-icon name="heart" [size]="14"></lucide-icon>
          </button>
          <button class="bp-icon-btn bp-b2-iact"
                  title="Request a quote"
                  (click)="requestQuote(p, true, $event)">
            <lucide-icon name="mail" [size]="14"></lucide-icon>
          </button>
        </div>
      </div>
    </ng-template>

    <!-- ── ADD CATEGORY DRAWER ── -->
    <p-sidebar [(visible)]="addDrawerOpen" position="right" [style]="{ width: '380px' }"
               styleClass="bp-b2-drawer" [showCloseIcon]="false">
      <div class="bp-b2-dw-head">
        <div>
          <div class="bp-drawer-label">Scope</div>
          <div class="bp-b2-dw-title">Add a category</div>
        </div>
        <button class="bp-icon-btn" type="button" (click)="addDrawerOpen = false">
          <lucide-icon name="x" [size]="16"></lucide-icon>
        </button>
      </div>
      <div class="bp-b2-dw-body">
        <div class="bp-b2-dw-hint">
          Categories already in the project are hidden. Click one to add it.
        </div>
        <div *ngFor="let c of unusedCategories"
             role="button" tabindex="0" class="bp-b2-dw-cat"
             (click)="addCategory(c)"
             (keydown.enter)="addCategory(c)">
          <div class="bp-b2-ic">
            <lucide-icon [name]="c.icon_name || 'layers'" [size]="14"></lucide-icon>
          </div>
          <span class="bp-b2-dw-cat-name">{{ c.name }}</span>
          <lucide-icon class="bp-b2-dw-plus" name="plus" [size]="16"></lucide-icon>
        </div>
        <div *ngIf="!unusedCategories.length" class="bp-b2-empty">
          Every catalogue category is already in this project.
        </div>
      </div>
    </p-sidebar>

    <!-- v1.52e — edit drawer for an AI-proposed item (after it is
         materialised into a real, approval-pending catalogue row). -->
    <app-item-drawer
      [(visible)]="drawerVisible"
      [mode]="'edit'"
      [item]="drawerItem"
      (saved)="onProposedSaved($event)"
      (cancelled)="drawerVisible = false">
    </app-item-drawer>

    <p-toast></p-toast>
  `,
  styles: [`
    :host { display: block; }
    .bp-b2 { padding: 24px var(--section-pad, 40px) 60px; }

    /* shared uppercase-eyebrow recipe — FIX 7 */
    .bp-b2-colhdr, .bp-b2-flabel, .bp-b2-sech, .bp-b2-optbar {
      font-size: var(--text-xs); font-weight: 600; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--color-text-muted); }

    /* header */
    .bp-b2-head { display: flex; align-items: flex-end; justify-content: flex-end; }

    /* progress */
    .bp-b2-progress { margin: 14px 0 18px; }
    .bp-b2-pbar { height: 5px; background: var(--color-border);
      border-radius: var(--radius-input); overflow: hidden; }
    .bp-b2-pfill { height: 100%; background: var(--theme-accent); transition: width 0.3s; }
    .bp-b2-plbl { display: flex; justify-content: space-between; font-size: var(--text-sm);
      color: var(--color-text-muted); margin-top: 6px; }
    .bp-b2-plbl b { color: var(--color-text-secondary); font-weight: 600; }

    /* 3-col */
    .bp-b2-panes { display: grid; grid-template-columns: 300px minmax(0,1fr) 340px;
      gap: 14px; align-items: start; }
    .bp-b2-colhdr { padding: 0 4px 6px; }

    /* col 1 */
    .bp-b2-catlist { display: flex; flex-direction: column; gap: 5px; }
    .bp-b2-card { display: flex; align-items: center; gap: 9px; background: var(--color-surface);
      border: 0.5px solid var(--color-border); border-left: 3px solid transparent;
      border-radius: var(--radius-button); padding: 12px 14px; cursor: pointer; transition: all 0.12s; }
    .bp-b2-card:hover { border-color: var(--theme-border); }
    .bp-b2-card:hover .bp-b2-remove { opacity: 1; }
    .bp-b2-card.active { border-left: 3px solid var(--theme-accent);
      box-shadow: var(--shadow-sm); }
    .bp-b2-ic { width: 26px; height: 26px; border-radius: 50%; background: var(--theme-bg);
      color: var(--theme-accent); display: flex; align-items: center; justify-content: center;
      font-family: var(--font-display); font-size: var(--text-sm); font-weight: 600; flex-shrink: 0; }
    .bp-b2-card.active .bp-b2-ic { background: var(--theme-accent); color: var(--color-surface); }
    .bp-b2-card-mid { flex: 1; min-width: 0; }
    .bp-b2-card-name { font-size: var(--text-sm); font-weight: 600; line-height: 1.25;
      color: var(--color-text-primary); }
    .bp-b2-card-bud { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 1px; }
    .bp-b2-count { min-width: 19px; height: 19px; border-radius: var(--radius-button);
      background: var(--theme-accent);
      color: var(--color-surface); font-size: var(--text-xs); font-weight: 700;
      display: flex; align-items: center;
      justify-content: center; padding: 0 5px; flex-shrink: 0; }
    .bp-b2-remove { flex-shrink: 0; opacity: 0; transition: opacity 0.12s, color 0.12s; }
    .bp-b2-remove:hover { color: var(--color-danger); background: none; }

    /* col 2 */
    .bp-b2-panel { background: var(--color-surface); border: 0.5px solid var(--color-border);
      border-radius: var(--radius-card); overflow: hidden; min-height: 540px; }
    .bp-b2-ws { padding: 15px 17px 14px; border-bottom: 0.5px solid var(--color-border); }
    .bp-b2-ws-top { display: flex; align-items: center; gap: 9px; margin-bottom: 12px; }
    .bp-b2-ws-ic { width: 30px; height: 30px; border-radius: 50%; background: var(--theme-accent);
      color: var(--color-surface); display: flex; align-items: center; justify-content: center;
      font-family: var(--font-display); font-size: var(--text-base); font-weight: 600;
      flex-shrink: 0; }
    .bp-b2-ws-name { flex: 1; min-width: 0; font-family: var(--font-display);
      font-size: var(--text-lg); color: var(--color-text-primary);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bp-b2-ws-status { flex-shrink: 0; }

    /* Brief + Notes side by side */
    .bp-b2-briefgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .bp-b2-bcol { display: flex; flex-direction: column; }
    .bp-b2-bcol .bp-b2-brief, .bp-b2-bcol .bp-b2-notes { flex: 1; }
    .bp-b2-flabel { margin-bottom: 5px; }
    .bp-b2-brief { width: 100%; font-family: var(--font-body); font-size: var(--text-base);
      line-height: 1.6; color: var(--color-text-primary);
      border-radius: var(--radius-button); padding: 10px 12px;
      resize: vertical; outline: none; }
    .bp-b2-ws-row { display: flex; align-items: flex-end; gap: 14px; margin-top: 11px; }
    .bp-b2-money { display: flex; align-items: center; gap: 3px; background: var(--color-surface);
      border: 0.5px solid var(--color-border); border-radius: var(--radius-input);
      padding: 5px 9px; width: 118px; }
    .bp-b2-money span { color: var(--color-text-muted); font-size: var(--text-sm); }
    .bp-b2-money input { border: none; outline: none; font-family: var(--font-body);
      font-size: var(--text-sm); width: 100%; background: transparent; color: var(--color-text-primary); }
    .bp-b2-est { font-size: var(--text-base); font-weight: 600; padding: 5px 0;
      color: var(--color-text-primary); }
    .bp-b2-est small { color: var(--color-text-muted); font-weight: 500; }
    .bp-b2-find { margin-left: auto; }
    .bp-b2-find lucide-icon { display: inline-flex; }
    .bp-b2-cmnote { margin-left: auto; display: inline-flex; align-items: center;
      gap: 5px; font-size: var(--text-sm); color: var(--color-text-muted); }

    /* A1 — private Notes field (distinct from the supplier-facing Brief) */
    .bp-b2-fhelp { font-size: var(--text-xs); color: var(--color-text-muted);
      text-transform: none; letter-spacing: 0; margin: -2px 0 5px; }
    .bp-b2-notes { width: 100%; font-family: var(--font-body); font-size: var(--text-base);
      line-height: 1.55; color: var(--color-text-primary);
      border-radius: var(--radius-button); padding: 9px 12px;
      resize: vertical; outline: none; }
    textarea.bp-b2-notes.bp-input-edit {
      background: var(--color-surface) !important;
      border-color: var(--color-border) !important; }

    /* A2 — category status dropdown + pill */
    :host ::ng-deep .bp-b2-statusdd .p-dropdown-label {
      font-size: var(--text-sm); padding: 6px 10px; font-family: var(--font-body); }
    .bp-cat-pill { display: inline-flex; align-items: center; flex-shrink: 0;
      font-size: var(--text-xs); font-weight: 700; padding: 3px 9px;
      border-radius: var(--radius-pill); white-space: nowrap; line-height: 1.3; }
    .bp-b2-card-nrow { display: flex; align-items: center; gap: 6px; }
    .bp-b2-card-nrow .bp-b2-card-name { flex: 1; min-width: 0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bp-b2-card--dim { opacity: 0.6; }
    .bp-b2-card--dim:hover { opacity: 0.85; }

    .bp-b2-res { padding: 13px 17px 18px; display: flex; flex-direction: column; gap: 14px; }
    .bp-b2-prompt { display: flex; flex-direction: column; align-items: center;
      text-align: center; padding: 60px 32px; color: var(--color-text-muted);
      font-size: var(--text-sm); line-height: 1.6; gap: 8px; }
    .bp-b2-prompt-spark { color: var(--theme-accent); }
    .bp-b2-searchln { display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
      font-size: var(--text-xs); color: var(--color-text-muted); line-height: 1.5; }
    .bp-b2-searchln em { font-style: normal; font-weight: 600; color: var(--color-text-secondary); }
    .bp-b2-spark { color: var(--theme-accent); display: inline-flex; vertical-align: middle; }
    .bp-b2-sech { margin-bottom: 7px; }

    /* two-option layout — FIX / TWO-OPTION LAYOUT */
    .bp-b2-optbars { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .bp-b2-optbar { background: var(--theme-bg); color: var(--color-text-primary);
      padding: 9px 14px; border-radius: var(--radius-button) var(--radius-button) 0 0; }
    .bp-b2-optgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
      margin-top: -6px; }
    .bp-b2-optcol { border-top: 0.5px solid var(--color-border); padding-top: 12px; }

    .bp-b2-row { display: flex; align-items: center; gap: 9px; background: var(--color-surface);
      border: 0.5px solid var(--color-border); border-radius: var(--radius-button);
      padding: 12px 14px; margin-bottom: 6px; cursor: pointer; transition: all 0.12s; }
    .bp-b2-row:hover { border-color: var(--theme-border); }
    .bp-b2-row.active { border-left: 3px solid var(--theme-accent); box-shadow: var(--shadow-sm); }
    .bp-b2-row.proposed { border-style: dashed; border-color: var(--theme-accent);
      background: var(--theme-bg); }
    .bp-b2-thumb { width: 34px; height: 34px; border-radius: var(--radius-input); flex-shrink: 0;
      background: var(--theme-bg);
      display: flex; align-items: center; justify-content: center; color: var(--theme-accent);
      font-family: var(--font-display); font-size: var(--text-base); font-weight: 600; overflow: hidden; }
    .bp-b2-thumb--img { background-size: cover; background-position: center; }
    .bp-b2-rec { display: flex; align-items: flex-start; gap: 4px;
      font-size: var(--text-sm); color: var(--color-text-secondary); line-height: 1.55;
      margin: -2px 0 10px; }
    .bp-b2-row-mid { flex: 1; min-width: 0; }
    .bp-b2-row-name { font-size: var(--text-sm); font-weight: 600; line-height: 1.25;
      color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bp-b2-row-sub { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 1px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bp-b2-row-price { font-size: var(--text-sm); font-weight: 600; flex-shrink: 0;
      color: var(--color-text-primary); }
    .bp-b2-score { font-size: var(--text-xs); font-weight: 700; color: var(--theme-accent);
      background: var(--theme-bg); border-radius: var(--radius-pill); padding: 1px 6px; flex-shrink: 0; }
    .bp-b2-qa { display: flex; gap: 4px; flex-shrink: 0; }
    /* v1.54 — added items get a solid accent fill so "in the project"
       reads at a glance; clicking again removes the item. */
    .bp-b2-iact.on { background: var(--theme-accent); color: var(--color-surface); }
    .bp-b2-iact.on:hover { background: var(--theme-accent); filter: brightness(0.92); }
    .bp-b2-iact.like:hover { color: var(--color-danger); background: var(--theme-bg); }

    .bp-b2-hint { border-top: 0.5px solid var(--color-border); padding-top: 11px; }
    .bp-b2-hint label { display: flex; align-items: center; gap: 4px;
      font-size: var(--text-xs); color: var(--color-text-secondary); margin-bottom: 5px; }
    .bp-b2-hint-row { display: flex; gap: 6px; }
    .bp-b2-hint-row input { flex: 1; min-width: 0; font-family: var(--font-body);
      font-size: var(--text-sm);
      padding: 6px 8px; border: 0.5px solid var(--color-border);
      border-radius: var(--radius-input); outline: none; }
    .bp-b2-hint-row input:focus { border-color: var(--theme-accent); }

    /* col 3 */
    .bp-b2-detail { background: var(--color-surface); border: 0.5px solid var(--color-border);
      border-radius: var(--radius-card); overflow: hidden; position: sticky; top: 16px; }
    .bp-b2-d-empty { display: flex; flex-direction: column; align-items: center;
      justify-content: center; text-align: center; padding: 110px 30px; gap: 7px; }
    .bp-b2-d-empty .big { color: var(--color-text-muted); }
    .bp-b2-d-empty .t { font-family: var(--font-display); font-size: var(--text-lg);
      color: var(--color-text-primary); }
    .bp-b2-d-empty .s { font-size: var(--text-sm); color: var(--color-text-muted);
      max-width: 210px; line-height: 1.5; }
    .bp-b2-d-hero { height: 144px; display: flex; align-items: center; justify-content: center;
      color: var(--color-surface); font-family: var(--font-display);
      font-size: var(--text-2xl); font-weight: 600; position: relative;
      background: linear-gradient(150deg, var(--theme-accent), rgba(0,0,0,0.55));
      background-size: cover; background-position: center; }
    .bp-b2-d-hero.sup { letter-spacing: 0.04em; }
    .bp-b2-d-hero.is-logo { background: var(--theme-bg); }
    .bp-b2-d-hero-img { max-width: 76%; max-height: 76%; object-fit: contain; }
    .bp-b2-d-body { padding: 14px 16px; }
    .bp-b2-d-eyebrow { font-size: var(--text-xs); font-weight: 600; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--theme-accent); margin-bottom: 4px; }
    .bp-b2-d-name { font-family: var(--font-display); font-size: var(--text-xl); line-height: 1.25;
      color: var(--color-text-primary); }
    .bp-b2-d-sub { font-size: var(--text-sm); color: var(--color-text-secondary); margin-top: 3px; }
    .bp-b2-d-pricerow { display: flex; align-items: center; gap: 10px; margin: 11px 0;
      padding: 10px 0; border-top: 0.5px solid var(--color-border);
      border-bottom: 0.5px solid var(--color-border); }
    .bp-b2-d-price { font-family: var(--font-display); font-size: var(--text-2xl);
      color: var(--color-text-primary); }
    .bp-b2-d-score { font-size: var(--text-xs); font-weight: 700; color: var(--theme-accent);
      background: var(--theme-bg); border-radius: var(--radius-pill); padding: 2px 9px; }
    .bp-b2-d-stat { display: flex; gap: 6px; align-items: baseline; margin: 11px 0; }
    .bp-b2-d-stat .n { font-family: var(--font-display); font-size: var(--text-2xl);
      color: var(--color-text-primary); }
    .bp-b2-d-stat .k { font-size: var(--text-sm); color: var(--color-text-muted); }
    .bp-b2-d-box { background: var(--theme-bg); border: 0.5px solid var(--theme-border);
      border-radius: var(--radius-button); padding: 9px 11px; margin-bottom: 11px; }
    .bp-b2-d-box .l { display: flex; align-items: center; gap: 4px;
      font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.07em;
      text-transform: uppercase; color: var(--theme-accent); margin-bottom: 3px; }
    .bp-b2-d-box .r { font-size: var(--text-sm); color: var(--color-text-secondary); line-height: 1.5; }
    .bp-b2-d-desc { font-size: var(--text-sm); color: var(--color-text-secondary);
      line-height: 1.6; margin-bottom: 13px; }
    /* v1.52d — preview action cluster, mirrors the marketplace detail card */
    .bp-b2-d-cluster { display: flex; gap: 6px; position: absolute;
      top: 10px; right: 10px; z-index: 2; }
    .bp-b2-d-cbtn { width: 32px; height: 32px; border-radius: 50%;
      border: 0.5px solid var(--color-border); background: var(--color-surface);
      color: var(--color-text-secondary); display: flex; align-items: center;
      justify-content: center; cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s; }
    .bp-b2-d-cbtn:hover,
    .bp-b2-d-cbtn.on { background: var(--theme-accent);
      border-color: var(--theme-accent); color: var(--color-surface); }
    .bp-b2-d-store { width: 100%; }

    .bp-b2-empty { font-size: var(--text-sm); color: var(--color-text-muted); font-style: italic;
      text-align: center; padding: 22px 14px; border: 0.5px dashed var(--color-border);
      border-radius: var(--radius-button); }

    /* add-category drawer */
    .bp-b2-dw-head { display: flex; align-items: flex-start; justify-content: space-between;
      padding: 16px 18px; border-bottom: 0.5px solid var(--color-border); }
    .bp-b2-dw-title { font-family: var(--font-display); font-size: var(--text-xl);
      color: var(--color-text-primary); margin-top: 2px; }
    .bp-b2-dw-body { padding: 14px 18px; }
    .bp-b2-dw-hint { font-size: var(--text-sm); color: var(--color-text-muted); line-height: 1.5;
      margin-bottom: 12px; }
    .bp-b2-dw-cat { display: flex; align-items: center; gap: 10px; width: 100%;
      background: var(--color-surface); border: 0.5px solid var(--color-border);
      border-radius: var(--radius-button); padding: 12px 14px; margin-bottom: 6px; cursor: pointer;
      font-family: var(--font-body); transition: all 0.12s; }
    .bp-b2-dw-cat:hover { border-color: var(--theme-border); }
    .bp-b2-dw-cat-name { flex: 1; text-align: left; font-size: var(--text-base); font-weight: 600;
      color: var(--color-text-primary); }
    .bp-b2-dw-plus { color: var(--theme-accent); display: inline-flex; }

    @media (max-width: 1000px) {
      .bp-b2-panes { grid-template-columns: 1fr; }
      .bp-b2-detail { position: static; }
      .bp-b2-optbars, .bp-b2-optgrid { grid-template-columns: 1fr; }
      .bp-b2-optgrid { margin-top: 0; }
      .bp-b2-briefgrid { grid-template-columns: 1fr; }
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

  /** v1.53 — category_status codelist rows (drives the status dropdown
      + pill). Each row: { code, label, meta: { color } }. */
  categoryStatuses: any[] = [];

  detail: DetailView = null;
  addDrawerOpen = false;

  /** v1.52e — item drawer for editing a materialised proposed item. */
  drawerVisible = false;
  drawerItem: Item | null = null;
  /** v1.52g — the proposed item the drawer is currently editing, so a
      save can be reflected straight back onto its preview card. */
  private proposedBeingEdited: ProposedItem | null = null;

  private briefTimers = new Map<string, any>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projSvc: ProjectService,
    private catSvc: CategoryService,
    private api: ApiService,
    private projItemSvc: ProjectItemService,
    private itemSvc: ItemService,
    private codelistSvc: CodelistService,
    private outreach: OutreachService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.pid = this.route.parent?.snapshot.paramMap.get('id') || '';
    if (!this.pid) { this.loading = false; this.cdr.markForCheck(); return; }

    // v1.53 — load the category_status codelist (cached by the service)
    // for the status dropdown + pill colours.
    this.codelistSvc.getByName('category_status').subscribe({
      next: rows => { this.categoryStatuses = rows || []; this.cdr.markForCheck(); },
      error: () => {}
    });

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
  /** v1.52 — AI-voiced recommendation copy framing each results section. */
  get itemMatchRec(): string {
    const r = this.activeResult;
    if (!r) return '';
    return r.matched_items.length
      ? 'Found these in the catalogue — strong matches for your brief. Pick one and request an updated quote from the supplier.'
      : 'The closest I found in the catalogue — not an exact fit. Request a quote on it, or send the new item below.';
  }
  get newItemRec(): string {
    const r = this.activeResult;
    if (!r) return '';
    return (r.matched_items.length || r.closest_item)
      ? 'Prefer something bespoke? Here’s a new item to send out for a quote.'
      : 'I didn’t find anything close enough in the catalogue — here’s a new item to send out for a quote.';
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
        next: () => this.msg.add({ severity: 'success', summary: 'Saved', life: 1000 }),
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
      next: () => this.msg.add({ severity: 'success', summary: 'Saved', life: 1000 }),
      error: () => this.msg.add({ severity: 'error', summary: 'Failed to save budget', life: 3000 })
    });
  }

  // ── A1 Notes / A2 Status ──────────────────────────────────────────────

  /** A1 — private notes save on blur (project_categories.requirement_detail).
      Unlike the Brief, this never reaches a supplier. */
  onNotesBlur(pc: ProjectCategory, ev: Event): void {
    const value = (ev.target as HTMLTextAreaElement).value;
    if (value === (pc.requirement_detail || '')) return;
    pc.requirement_detail = value;
    this.projSvc.upsertCategory(this.pid, pc.category_id, { requirement_detail: value }).subscribe({
      next: () => this.msg.add({ severity: 'success', summary: 'Saved', life: 1000 }),
      error: () => this.msg.add({ severity: 'error', summary: 'Failed to save notes', life: 3000 })
    });
  }

  /** A2 — category workflow status save on change. */
  saveStatus(pc: ProjectCategory): void {
    const code = pc.status_code || 'draft';
    this.projSvc.upsertCategory(this.pid, pc.category_id, { status_code: code }).subscribe({
      next: () => this.msg.add({
        severity: 'success', summary: 'Status — ' + this.categoryStatusLabel(code), life: 1400
      }),
      error: () => this.msg.add({ severity: 'error', summary: 'Failed to save status', life: 3000 })
    });
    this.cdr.markForCheck();
  }

  /** A2 — codelist label for a category_status code. */
  categoryStatusLabel(code?: string): string {
    const c = code || 'draft';
    return this.categoryStatuses.find(s => s.code === c)?.label
      || (c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' '));
  }

  /** A2 — pill colour, read from the codelist meta.color field. Empty
      until the codelist loads (a few ms); the pill renders uncoloured. */
  statusColor(code?: string): string {
    const c = code || 'draft';
    return this.categoryStatuses.find(s => s.code === c)?.meta?.color || '';
  }

  /** A2 — inline pill style: a solid fill in the codelist colour with
      surface-coloured text. Empty object until the codelist loads. */
  statusPillStyle(code?: string): { [k: string]: string } {
    const col = this.statusColor(code);
    return col ? { color: 'var(--color-surface)', background: col } : {};
  }

  /** A2 Step 7 — Client Managed categories aren't actioned by the agency
      (the "Find items" action is hidden). */
  isClientManaged(pc: ProjectCategory): boolean {
    return pc.status_code === 'client_managed';
  }

  /** A2 Step 7 — Client Managed + N/A categories are dimmed in the list. */
  categoryDimmed(pc: ProjectCategory): boolean {
    return pc.status_code === 'client_managed' || pc.status_code === 'na';
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
        description: it.description, added: this.isItemAdded(it.item_id),
        image_url: it.image_url || null, image_display: it.image_display || null
      };
    }
    if (this.detail.kind === 'proposed') {
      const p = this.detail.item;
      return {
        proposed: true, name: p.name, supplier_name: p.supplier_name,
        price: p.estimated_price, score: p.confidence, reason: p.reason,
        description: p.description,
        added: !!this.activeCategory && this.proposedAdded(p, this.activeCategory),
        image_url: p.image_url ?? null, image_display: p.image_display ?? null
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
  openSupplierDetail(s: MatchSupplier): void { this.detail = { kind: 'supplier', supplier: s }; }

  openProposedDetail(p: ProposedItem): void {
    this.detail = { kind: 'proposed', item: p };
    this.hydrateProposed(p);
  }

  /** v1.52h — refresh a proposed item's hero image (+ name / price /
      description) from its real catalogue row, the source of truth.
      Runs every time the detail card opens so an image added on the
      item detail page — or anywhere outside this tab — is picked up.
      Self-heals match results cached before v1.52f (no item_id) by
      materialising once to acquire a stable id. */
  private hydrateProposed(p: ProposedItem): void {
    const apply = (row: any) => {
      if (!row) return;
      p.item_id       = row.id || p.item_id;
      p.image_url     = row.image_url ?? null;
      p.image_display = row.image_display ?? null;
      if (row.name) p.name = row.name;
      if (row.base_price != null) p.estimated_price = row.base_price;
      if (row.description != null) p.description = row.description;
      this.cdr.markForCheck();
    };
    if (p.item_id) {
      this.itemSvc.getById(p.item_id).subscribe({ next: apply, error: () => {} });
    } else {
      // Legacy match result — materialise once to obtain item_id;
      // every later open then uses getById.
      this.materializeProposed(p, apply);
    }
  }

  viewStore(supplierId: string): void {
    if (supplierId) this.router.navigate(['/suppliers', supplierId]);
  }

  /** Select / like inside the col-3 detail panel. v1.54 — the select
      action toggles project membership (add ⇄ remove). */
  addFromDetail(stype: 'selected' | 'liked'): void {
    if (!this.detail || !this.activeCategory) return;
    const ac = this.activeCategory;
    if (this.detail.kind === 'item') {
      if (stype === 'selected') this.toggleMatched(ac, this.detail.item);
      else this.addMatched(ac, this.detail.item, stype);
    } else if (this.detail.kind === 'proposed') {
      if (stype === 'selected') this.toggleProposed(ac, this.detail.item);
      else this.addProposed(ac, this.detail.item, stype);
    }
  }

  /** v1.52d — Request a quote from the col-3 preview's action cluster. */
  requestQuoteFromDetail(): void {
    if (!this.detail) return;
    if (this.detail.kind === 'item')          this.requestQuote(this.detail.item, false);
    else if (this.detail.kind === 'proposed') this.requestQuote(this.detail.item, true);
  }

  /** v1.52d — open the full catalogue item page (matched items only). */
  openFullItem(): void {
    if (this.detail?.kind === 'item' && this.detail.item.item_id) {
      this.router.navigate(['/items', this.detail.item.item_id],
        { queryParams: { context: 'project', projectId: this.pid } });
    }
  }

  private goToItem(id: string): void {
    this.router.navigate(['/items', id],
      { queryParams: { context: 'project', projectId: this.pid } });
  }

  /** v1.52e — fallback for match results cached before v1.52f, where the
      proposed item was not pre-created. Promotes it to an inactive,
      approval-pending `items` row, then runs `cb` with the saved row. */
  private materializeProposed(p: ProposedItem, cb: (row: any) => void): void {
    const ac = this.activeCategory;
    if (!ac) return;
    this.api.post<any>('/taxonomy/materialize-proposed', {
      supplier_id:     p.supplier_id,
      category_id:     ac.category_id,
      name:            p.name,
      description:     p.description,
      estimated_price: p.estimated_price
    }).subscribe({
      next: cb,
      error: () => this.msg.add({
        severity: 'error', summary: 'Could not open the proposed item', life: 3500
      })
    });
  }

  /** v1.52e — ✎ on a proposed item: open the item drawer in edit mode,
      exactly as the marketplace edit action does. v1.52f — the proposed
      item is pre-created, so load its current row by id (preserving any
      saved edits); only materialise for pre-v1.52f cached results. */
  editProposed(): void {
    if (this.detail?.kind !== 'proposed') return;
    const p = this.detail.item;
    this.proposedBeingEdited = p;
    if (p.item_id) {
      this.itemSvc.getById(p.item_id).subscribe({
        next: item => {
          this.drawerItem = item;
          this.drawerVisible = true;
          this.cdr.markForCheck();
        },
        error: () => this.msg.add({
          severity: 'error', summary: 'Could not open item for editing', life: 3500
        })
      });
      return;
    }
    this.materializeProposed(p, row => {
      this.drawerItem = row as Item;
      this.drawerVisible = true;
      this.cdr.markForCheck();
    });
  }

  /** v1.52e — 👁 on a proposed item: open the full item detail page.
      v1.52f — navigate straight to the pre-created row; only materialise
      for pre-v1.52f cached results. */
  viewProposed(): void {
    if (this.detail?.kind !== 'proposed') return;
    const p = this.detail.item;
    if (p.item_id) { this.goToItem(p.item_id); return; }
    this.materializeProposed(p, row => this.goToItem(row.id));
  }

  /** v1.52e — item drawer saved a materialised proposed item. v1.52g —
      reflect the saved hero image (+ name / price / description) straight
      back onto the proposed item's preview card. */
  onProposedSaved(item: Item): void {
    this.drawerVisible = false;
    const p = this.proposedBeingEdited;
    if (p) {
      p.image_url     = item.image_url ?? null;
      p.image_display = item.image_display ?? null;
      if (item.name) p.name = item.name;
      if (item.base_price != null) p.estimated_price = item.base_price;
      if (item.description != null) p.description = item.description;
      this.proposedBeingEdited = null;
    }
    this.msg.add({ severity: 'success', summary: 'Item saved', life: 2500 });
    this.cdr.markForCheck();
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

  /** v1.54 — the select button toggles project membership. */
  toggleMatched(pc: ProjectCategory, m: MatchItem, ev?: Event): void {
    if (ev) ev.stopPropagation();
    if (this.isItemAdded(m.item_id)) this.removeMatched(pc, m.item_id, m.name);
    else this.addMatched(pc, m, 'selected');
  }

  /** v1.54 — un-add an item; recomputes the category's est. cost. */
  removeMatched(pc: ProjectCategory, itemId: string, name: string): void {
    this.api.post<{ ballpark_cost: number }>('/taxonomy/remove-match', {
      project_id: this.pid, category_id: pc.category_id, item_id: itemId
    }).subscribe({
      next: res => this.afterAdd(pc, res, 'Removed from project', name),
      error: () => this.msg.add({ severity: 'error', summary: 'Could not remove item', life: 3500 })
    });
  }

  /** v1.54 — is the proposed item's catalogue row already in the project? */
  proposedAdded(p: ProposedItem, pc: ProjectCategory): boolean {
    return (!!p.item_id && this.isItemAdded(p.item_id)) || this.addedProposed.has(pc.category_id);
  }

  /** v1.54 — the proposed-item select button toggles project membership. */
  toggleProposed(pc: ProjectCategory, p: ProposedItem, ev?: Event): void {
    if (ev) ev.stopPropagation();
    if (this.proposedAdded(p, pc)) {
      this.addedProposed.delete(pc.category_id);
      if (p.item_id) this.removeMatched(pc, p.item_id, p.name);
      else this.cdr.markForCheck();
    } else {
      this.addProposed(pc, p, 'selected');
    }
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
        // v1.54 — capture the materialised row id so the select button
        // can later toggle it back off.
        if (res?.project_item?.item_id) p.item_id = res.project_item.item_id;
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

  // ── v1.50 — competitive quote outreach ────────────────────────────────

  /** Open the shared outreach drawer for a matched or proposed item.
      The AI's ranked suppliers ride along to pre-select + sort the list. */
  requestQuote(m: MatchItem | ProposedItem, isNew: boolean, ev?: Event): void {
    if (ev) ev.stopPropagation();
    const ac = this.activeCategory;
    if (!ac) return;
    const r = this.activeResult;
    const item = isNew
      ? {
          name:        (m as ProposedItem).name,
          description: (m as ProposedItem).description,
          price:       (m as ProposedItem).estimated_price,
          isNew:       true
        }
      : {
          item_id:     (m as MatchItem).item_id,
          name:        (m as MatchItem).name,
          description: (m as MatchItem).description,
          price:       (m as MatchItem).base_price,
          isNew:       false
        };
    this.outreach.open({
      item,
      categoryId:        ac.category_id,
      categoryName:      ac.category_name,
      projectId:         this.pid,
      projectCategoryId: this.pcId(ac),
      suppliers: r ? r.suppliers_ranked.map(s => ({
        supplier_id: s.supplier_id, supplier_name: s.supplier_name
      })) : []
    });
    // v1.52a — emailing a supplier about a catalogue match implies
    // selecting that item for the project.
    if (!isNew) this.addMatched(ac, m as MatchItem, 'selected');
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
