import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy, ChangeDetectorRef, OnChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  LucideAngularModule, Heart, Clock, ArrowRight, Plus, SquarePen, Mail
} from 'lucide-angular';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { CodelistService } from '../../../core/services/codelist.service';
import { GbpPipe } from '../../pipes/gbp.pipe';
import { ProjectItemRowComponent } from '../project-item-row/project-item-row.component';
import { ProjectItem } from '../../../models';

export type CategoryContextMode = 'project' | 'marketplace' | 'supplier';
type PanelTab = 'items' | 'wishlist' | 'brief';

/**
 * Category context panel — the right-rail surface in catalogue-grid
 * that takes over when a specific category is active.
 *
 * v1.21 design unification: shares <app-category-card-header> and
 * <app-project-item-row> with the Build/Estimate tab's expanded card.
 * Brief lives on its own tab (alongside Items and Wishlist) so the
 * panel and the Build card use the exact same three-tab structure.
 *
 * Layout (project mode):
 *   ┌─────────────────────┐ pinned
 *   │ header              │
 *   │ subtotal block      │
 *   │ Items / Wishlist /  │
 *   │   Brief tab bar     │
 *   ├─────────────────────┤ scrolls
 *   │ tab content         │
 *   ├─────────────────────┤ pinned
 *   │ footer: total + CTA │
 *   └─────────────────────┘
 */
@Component({
  selector: 'app-category-context-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    InputTextareaModule, InputTextModule, ButtonModule, DropdownModule, ToastModule,
    LucideAngularModule, GbpPipe,
    ProjectItemRowComponent
  ],
  providers: [MessageService],
  template: `
    <div class="bp-ctx-panel">

      <!-- ── Pinned top: header + subtotal + tab bar ─────────────── -->
      <div class="bp-ctx-top">
        <!-- v1.25: simplified header — icon circle + serif name only.
             Count chip / cost / status pill removed (cost lives in
             the subtotal block; counts are surfaced on the tab
             chips). Matches approved mockup. -->
        <div class="bp-ctx-head">
          <lucide-icon *ngIf="category?.icon_name"
                       [name]="category.icon_name"
                       [size]="13"
                       class="bp-ctx-head-icon"></lucide-icon>
          <span *ngIf="!category?.icon_name" class="bp-ctx-head-letter">
            {{ (category?.name || '?').charAt(0) }}
          </span>
          <div class="bp-ctx-head-name">{{ category?.name || '—' }}</div>
          <!-- v1.65x — cart icon + count of selected items for this
               category. v1.65ac — click opens the shared Project Items
               drawer (CartDrawerService) via the parent. Badge counts
               all project_items for this category (selected + liked)
               so it matches the All-view cart badge convention. -->
          <button type="button"
                  class="bp-ctx-cart" *ngIf="context === 'project'"
                  [attr.title]="cartCount + ' item' + (cartCount === 1 ? '' : 's') + ' in cart'"
                  (click)="openCart.emit()">
            <lucide-icon name="shopping-cart" [size]="18"></lucide-icon>
            <span class="bp-ctx-cart-badge"
                  *ngIf="cartCount">{{ cartCount }}</span>
          </button>
        </div>

        <!-- v1.65aa — Budget / Estimate / Status rendered with the same
             form-field treatment used in the Event drawer (.bp-field-label
             + .bp-field-readonly / .bp-input-edit). Three-column grid;
             view mode is a readonly input, click to swap to the
             edit-mode input or dropdown — no shape change. -->
        <div class="bp-ctx-fields" *ngIf="context === 'project'">
          <div class="bp-evd-field">
            <label class="bp-field-label">Budget</label>
            <input pInputText *ngIf="!editingBudget"
                   readonly
                   class="w-full bp-field-readonly bp-ctx-field-clickable"
                   [value]="(budgetPrice || 0) | gbp"
                   (click)="startEditBudget()"
                   title="Click to edit"/>
            <input pInputText *ngIf="editingBudget"
                   type="number" min="0" step="100"
                   class="w-full bp-input-edit"
                   [(ngModel)]="budgetDraft"
                   (blur)="commitBudget()"
                   (keyup.enter)="commitBudget()"
                   (keyup.escape)="cancelBudget()"/>
          </div>

          <div class="bp-evd-field">
            <label class="bp-field-label">Estimate</label>
            <input pInputText *ngIf="!editingEstimate"
                   readonly
                   class="w-full bp-field-readonly bp-ctx-field-clickable"
                   [value]="(estimatePrice || 0) | gbp"
                   (click)="startEditEstimate()"
                   title="Click to edit"/>
            <input pInputText *ngIf="editingEstimate"
                   type="number" min="0" step="100"
                   class="w-full bp-input-edit"
                   [(ngModel)]="estimateDraft"
                   (blur)="commitEstimate()"
                   (keyup.enter)="commitEstimate()"
                   (keyup.escape)="cancelEstimate()"/>
          </div>

          <div class="bp-evd-field" *ngIf="categoryStatuses.length">
            <label class="bp-field-label">Status</label>
            <input pInputText *ngIf="!editingStatus"
                   readonly
                   class="w-full bp-field-readonly bp-ctx-field-clickable"
                   [value]="statusLabel()"
                   (click)="startEditStatus()"
                   title="Click to change status"/>
            <p-dropdown *ngIf="editingStatus"
                        [options]="categoryStatuses"
                        [ngModel]="statusCode"
                        (onChange)="commitStatus($event.value)"
                        (onHide)="editingStatus = false"
                        optionLabel="label" optionValue="code"
                        appendTo="body"
                        styleClass="w-full bp-evd-dropdown"
                        panelStyleClass="bp-dd-panel"
                        [autoDisplayFirst]="false"
                        placeholder="—"></p-dropdown>
          </div>
        </div>

        <!-- v1.49 — marketplace / supplier stat block, mirrors the
             project subtotal slot. -->
        <div class="bp-ctx-subtotal" *ngIf="context !== 'project'">
          <div class="bp-ctx-sub-row">
            <span class="bp-ctx-sub-amount">{{ cardItemCount }}</span>
            <span class="bp-ctx-sub-label">item{{ cardItemCount === 1 ? '' : 's' }}</span>
          </div>
          <div class="bp-ctx-sub-line" *ngIf="cardSupplierCount">
            from {{ cardSupplierCount }} supplier{{ cardSupplierCount === 1 ? '' : 's' }}
          </div>
        </div>

        <!-- v1.65f — tabs removed. Items/Wishlist counts surfaced as
             count pills in the badge row above. The panel shows only
             the brief in project mode now. -->
      </div>

      <!-- ── Scrolling middle: brief (project mode) + marketplace
           card sections (other modes) ──────────────────────────────── -->
      <div class="bp-ctx-body">

        <!-- v1.65w — Brief is click-to-edit. View mode shows formatted
             text; click → textarea, blur/Enter saves, Escape cancels. -->
        <ng-container *ngIf="context === 'project'">
          <div class="bp-ctx-brief-section">
            <div class="bp-drawer-label">Brief</div>
            <textarea *ngIf="editingBrief"
                      #briefInput
                      class="bp-ctx-brief-input"
                      [(ngModel)]="briefDraft"
                      (blur)="commitBrief()"
                      (keyup.escape)="cancelBrief()"
                      rows="5"
                      placeholder="What does this category need? Anything specific to share with suppliers."></textarea>
            <ng-container *ngIf="!editingBrief">
              <div class="bp-ctx-brief-text bp-ctx-brief-editable"
                   *ngIf="briefText; else emptyBriefEditable"
                   (click)="startEditBrief()"
                   title="Click to edit brief">
                {{ briefText }}
              </div>
              <ng-template #emptyBriefEditable>
                <div class="bp-ctx-brief-empty bp-ctx-brief-editable"
                     (click)="startEditBrief()"
                     title="Click to add a brief">
                  No brief yet — click to add one.
                </div>
              </ng-template>
            </ng-container>
          </div>
        </ng-container>

        <!-- v1.49 — marketplace / supplier category card: About,
             Suppliers, Favourites. -->
        <ng-container *ngIf="context !== 'project'">

          <div class="bp-ctx-cardsec" *ngIf="category?.description">
            <div class="bp-ctx-cardsec-h">About</div>
            <div class="bp-ctx-cardabout">{{ category.description }}</div>
          </div>

          <div class="bp-ctx-cardsec" *ngIf="cardSupplierCount">
            <div class="bp-ctx-cardsec-h">Suppliers · {{ cardSupplierCount }}</div>
            <button type="button" class="bp-ctx-sup"
                    *ngFor="let s of categorySuppliers"
                    (click)="openSupplier(s.supplier_id)">
              <span class="bp-ctx-sup-ic">{{ (s.supplier_name || '?').charAt(0) }}</span>
              <span class="bp-ctx-sup-mid">
                <span class="bp-ctx-sup-name">{{ s.supplier_name }}</span>
                <span class="bp-ctx-sup-sub" *ngIf="s.city">{{ s.city }}</span>
              </span>
              <span class="bp-ctx-sup-count">{{ s.item_count }} item{{ s.item_count === 1 ? '' : 's' }}</span>
              <span class="bp-ctx-sup-chev">›</span>
            </button>
          </div>

          <div class="bp-ctx-cardsec">
            <div class="bp-ctx-cardsec-h">Favourites · {{ selectedItems.length }}</div>
            <ng-container *ngIf="selectedItems.length; else emptyFav">
              <app-project-item-row *ngFor="let item of selectedItems; trackBy: trackByItemKey"
                [item]="item"
                mode="selected"
                [compact]="true"
                (clicked)="itemClicked.emit($event)"
                (removed)="itemRemoved.emit($event)">
              </app-project-item-row>
            </ng-container>
            <ng-template #emptyFav>
              <div class="bp-ctx-empty">Heart an item to save it here.</div>
            </ng-template>
          </div>

        </ng-container>

      </div>

      <!-- ── Pinned footer (v1.25): Contact supplier CTA. Only
           shown when there's at least one selected item — empty
           and wishlist-only states hide the footer entirely. -->
      <div class="bp-ctx-footer" *ngIf="context === 'project'">
        <!-- v1.65af — restore the "Open estimate →" link that previously
             lived here. Opens the shared Estimate drawer. -->
        <button type="button"
                class="bp-ctx-foot-link"
                (click)="openEstimate.emit()">
          Open estimate
          <lucide-icon name="arrow-right" [size]="12"></lucide-icon>
        </button>
        <button type="button"
                class="bp-ctx-contact"
                *ngIf="selectedItems.length > 0"
                (click)="onContactSupplier($event)">
          <lucide-icon name="mail" [size]="14"></lucide-icon>
          Contact supplier →
        </button>
      </div>

    </div>
    <p-toast></p-toast>
  `,
  styles: [`
    /* v1.24m: font-family pinned on :host so the panel reads in
       Libre Franklin regardless of what the catalogue-grid parent
       column inherits. Inner Playfair elements (.bp-ctx-sub-amount,
       prices in app-project-item-row, name in app-category-card-header)
       opt into --font-display explicitly. */
    :host {
      display: block;
      height: 100%;
      font-family: var(--font-body);
      color: var(--color-text-primary);
    }

    /* v1.65ag — adopt v1.22 panel chrome: white surface, hairline
       border, --radius-card, --shadow-xs. Same as the Filter / Results
       / All-view zones so the right column reads as a contained panel. */
    .bp-ctx-panel {
      height: 100%;
      display: flex;
      flex-direction: column;
      font-family: var(--font-body);
      background: var(--color-surface);
      border: var(--border-hairline);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-xs);
      overflow: hidden;
    }

    /* ── Pinned top ── */
    .bp-ctx-top { flex-shrink: 0; }

    /* v1.25: simplified header — 36px themed icon circle + Playfair
       category name. Hairline separator handled by the subtotal
       block below (border-top there) so the row sits clean. */
    /* v1.65ag — saturated theme-accent header replaced by a calm
       eyebrow strip matching the Project Summary panel: surface bg,
       --theme-text label, hairline divider below.
       v1.65am (p0002 #3) — fixed 44px height to align dividers across
       the row. */
    .bp-ctx-head {
      display: flex;
      align-items: center;
      gap: 7px;
      height: 44px;
      padding: 0 14px;
      background: var(--color-surface);
      border-bottom: var(--border-hairline);
      flex-shrink: 0;
    }
    /* v1.65am (p0002 #4) — circle stripped from the per-category
       panel-head icon: plain inline Lucide icon next to the category
       name. Letter variant retained for categories with no icon — it
       sits inline at small font size. */
    .bp-ctx-head-icon {
      color: var(--theme-accent);
      flex-shrink: 0;
      display: inline-flex;
    }
    .bp-ctx-head-letter {
      font-family: var(--font-display);
      font-size: 13px;
      font-weight: 500;
      color: var(--theme-accent);
    }
    .bp-ctx-head-name {
      flex: 1;
      font-family: var(--font-body);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--theme-text);
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }
    /* v1.65f — status pill on the pink header */
    .bp-ctx-head-status {
      display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
      background: rgba(255,255,255,0.18); color: #fff;
      font-size: var(--text-xs); font-weight: 600;
      padding: 3px 9px; border-radius: var(--radius-pill);
    }
    .bp-ctx-head-status-dot {
      width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
      background: #fff;
    }

    /* v1.65aa — Budget / Estimate / Status row uses the Event drawer's
       form-field treatment (bp-field-label above bp-field-readonly).
       3-column grid keeps Status on the right naturally. Readonly view
       gets a click hint so the user knows it's editable. */
    .bp-ctx-fields {
      display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;
      padding: 12px 16px; border-bottom: 0.5px solid var(--color-border);
    }
    /* Click affordance on the readonly view-mode inputs. The global
       bp-field-readonly rule sets cursor: default — override here to
       make these specific instances feel actionable. */
    :host ::ng-deep .bp-ctx-field-clickable.p-inputtext {
      cursor: pointer !important;
    }
    :host ::ng-deep .bp-ctx-field-clickable.p-inputtext:hover {
      border-color: var(--theme-accent) !important;
      background: var(--theme-bg) !important;
    }

    /* v1.65x — cart icon + count badge on the pink header. Replaces
       nothing visually (the status pill moved to the badge row in
       v1.65w; the cart slots into that spot). White icon over the pink
       header; the count sits as a small yellow chip on the cart's
       top-right corner, Amazon / Best Buy style. */
    .bp-ctx-cart {
      position: relative;
      display: inline-flex; align-items: center;
      flex-shrink: 0;
      /* v1.65ag — calm header → icon takes --theme-accent on white. */
      color: var(--theme-accent);
      padding: 2px;
      /* v1.65ac — promoted from <span> to <button>; reset chrome. */
      background: none;
      border: none;
      cursor: pointer;
      transition: opacity 0.12s;
    }
    .bp-ctx-cart:hover { opacity: 0.78; }
    .bp-ctx-cart lucide-icon { display: inline-flex; }
    .bp-ctx-cart-badge {
      position: absolute;
      top: -4px; right: -8px;
      min-width: 16px; height: 16px;
      padding: 0 4px;
      border-radius: var(--radius-pill);
      background: var(--theme-accent);
      color: var(--color-surface);
      font-family: var(--font-body);
      font-size: 10px; font-weight: 700;
      line-height: 16px;
      text-align: center;
      box-shadow: 0 0 0 1.5px var(--color-surface);
      font-variant-numeric: tabular-nums;
    }

    /* v1.65w — brief click-to-edit. View text gets a soft hover hint; the
       editor is a borderless textarea so it doesn't compete with the
       surrounding panel chrome. */
    .bp-ctx-brief-editable {
      cursor: pointer;
      border-radius: 4px;
      padding: 2px 4px; margin: -2px -4px;
      transition: background 0.15s;
    }
    .bp-ctx-brief-editable:hover { background: var(--theme-bg); }
    .bp-ctx-brief-input {
      width: 100%; min-height: 96px;
      padding: 8px 10px;
      border: 0.5px solid var(--theme-accent);
      border-radius: 6px;
      outline: none;
      font-family: var(--font-body); font-size: var(--text-base);
      line-height: 1.55; color: var(--color-text-primary);
      background: var(--color-surface);
      resize: vertical;
    }

    /* v1.65f — brief section: plain text, no border */
    .bp-ctx-brief-section { padding: 14px 16px; }
    .bp-ctx-brief-section .bp-drawer-label { margin-bottom: 6px; }
    .bp-ctx-brief-text {
      font-family: var(--font-body); font-size: var(--text-base);
      line-height: 1.55; color: var(--color-text-primary);
      white-space: pre-wrap;
    }
    .bp-ctx-brief-empty {
      font-size: var(--text-sm); color: var(--color-text-muted);
      line-height: 1.55; font-style: italic;
    }

    /* Subtotal block — v1.25 layout: amount row, then each meta
       line (wishlist impact / longest lead) on its own row, left-
       aligned with the heart / clock glyph leading. */
    .bp-ctx-subtotal {
      padding: 12px 16px;
      border-bottom: 0.5px solid var(--color-border);
    }
    .bp-ctx-sub-row {
      display: flex;
      align-items: baseline;
      gap: 6px;
      margin-bottom: 6px;
    }
    .bp-ctx-sub-amount {
      font-family: var(--font-display);
      font-size: 24px;
      font-weight: 400;
      color: var(--color-text-primary);
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }
    .bp-ctx-sub-label {
      font-size: 12px;
      color: var(--color-text-muted);
    }
    .bp-ctx-sub-line {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      color: var(--color-text-muted);
      margin-bottom: 2px;
    }

    /* Tab bar — underline style, accent active. */
    .bp-ctx-tabs {
      display: flex;
      gap: 0;
      padding: 0 16px;
      border-bottom: 0.5px solid var(--color-border);
    }
    .bp-ctx-tab {
      padding: 8px 12px;
      font-size: 12.5px;
      font-weight: 500;
      color: var(--color-text-muted);
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      font-family: var(--font-body);
      margin-bottom: -0.5px;
      transition: color 0.15s, border-color 0.15s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .bp-ctx-tab:hover { color: var(--color-text-primary); }
    .bp-ctx-tab.active {
      color: var(--theme-accent);
      border-bottom-color: var(--theme-accent);
    }
    .bp-ctx-tab-count {
      display: inline-flex;
      align-items: center;
      min-width: 18px;
      justify-content: center;
      padding: 1px 6px;
      font-size: 10px;
      font-weight: 600;
      color: var(--color-text-muted);
      background: var(--theme-bg);
      border-radius: 10px;
    }
    .bp-ctx-tab.active .bp-ctx-tab-count { color: var(--theme-accent); }

    /* ── Scrolling middle ── */
    .bp-ctx-body {
      flex: 1;
      overflow-y: auto;
      padding: 6px 16px 12px;
      min-height: 0;
    }
    .bp-ctx-empty {
      font-size: 12px;
      color: var(--color-text-muted);
      font-style: italic;
      padding: 16px 0;
      text-align: center;
    }
    .bp-ctx-desc {
      font-size: 12.5px;
      line-height: 1.55;
      color: var(--color-text-secondary);
      padding: 10px 12px;
      margin-bottom: 10px;
      background: var(--theme-bg);
      border: 0.5px solid var(--theme-border);
      border-radius: 8px;
    }

    /* v1.25: legacy Items-tab footer + Browse marketplace CTA
       removed. The Add-more affordance / longest-lead recap lived
       there and are no longer surfaced (browsing happens via the
       catalogue grid; longest lead is in the subtotal block). */

    /* Wishlist hint */
    .bp-ctx-wish-hint {
      font-size: 10.5px;
      font-style: italic;
      color: var(--color-text-muted);
      padding: 8px 0 6px;
      text-align: right;
    }

    /* Brief tab fields */
    .bp-ctx-brief-field { margin-bottom: 10px; }
    .bp-ctx-brief-label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--theme-text);
      margin-bottom: 6px;
    }
    .bp-ctx-brief-empty {
      font-size: 11px;
      color: var(--color-text-muted);
      font-style: italic;
      margin-top: -4px;
    }

    /* ── Pinned footer (v1.25): full-width Contact supplier CTA.
         Hidden when the panel has no selected items so empty /
         wishlist-only states show no footer at all. */
    .bp-ctx-footer {
      flex-shrink: 0;
      padding: 12px 16px;
      border-top: 0.5px solid var(--color-border);
      background: var(--color-surface);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    /* v1.65af — restored "Open estimate →" link. Aligns right, accent
       colour, subtle hover. */
    .bp-ctx-foot-link {
      align-self: flex-end;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: none;
      padding: 4px 0;
      cursor: pointer;
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 500;
      color: var(--theme-accent);
      transition: opacity 0.12s;
    }
    .bp-ctx-foot-link:hover { opacity: 0.75; }
    .bp-ctx-contact {
      width: 100%;
      padding: 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 500;
      color: var(--color-surface);
      background: var(--theme-accent);
      border: none;
      border-radius: var(--radius-button);
      cursor: pointer;
      transition: opacity 0.15s, filter 0.15s;
    }
    .bp-ctx-contact:hover { filter: brightness(1.05); }
    .bp-ctx-contact:active { transform: scale(0.99); }

    /* ── v1.49 — marketplace / supplier category-card sections ── */
    .bp-ctx-cardsec {
      padding: 12px 0;
      border-bottom: 0.5px solid var(--color-border);
    }
    .bp-ctx-cardsec:last-child { border-bottom: none; }
    .bp-ctx-cardsec-h {
      font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--color-text-secondary);
      margin-bottom: 8px;
    }
    .bp-ctx-cardabout {
      font-size: 12.5px; line-height: 1.6; color: var(--color-text-secondary);
    }
    .bp-ctx-sup {
      display: flex; align-items: center; gap: 10px; width: 100%;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      border-radius: 8px; padding: 8px 10px;
      cursor: pointer; font-family: var(--font-body);
      transition: border-color 0.12s, background 0.12s;
    }
    .bp-ctx-sup + .bp-ctx-sup { margin-top: 6px; }
    .bp-ctx-sup:hover { border-color: var(--theme-accent); background: var(--theme-bg); }
    .bp-ctx-sup-ic {
      width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
      background: var(--theme-bg); color: var(--theme-accent);
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-display); font-size: 12px; font-weight: 600;
    }
    .bp-ctx-sup-mid { flex: 1; min-width: 0; text-align: left; }
    .bp-ctx-sup-name {
      display: block; font-size: 12.5px; font-weight: 600;
      color: var(--color-text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .bp-ctx-sup-sub { display: block; font-size: 10px; color: var(--color-text-muted); }
    .bp-ctx-sup-count {
      font-size: 10px; font-weight: 600; flex-shrink: 0;
      color: var(--theme-accent); background: var(--theme-bg);
      border-radius: 10px; padding: 2px 7px;
    }
    .bp-ctx-sup-chev { color: var(--color-text-muted); font-size: 13px; flex-shrink: 0; }
  `]
})
export class CategoryContextPanelComponent implements OnChanges {
  @Input() category: any = null;
  @Input() briefText: string | null = null;
  @Input() briefDetail: string | null = null;
  @Input() budgetPrice: number | null = null;
  @Input() selectedItems: ProjectItem[] = [];
  @Input() likedItems: ProjectItem[] = [];
  @Input() context: CategoryContextMode = 'marketplace';
  /** Sum of selected items' base_price for this category. The parent
      computes this — keeps the panel a pure view. */
  @Input() categoryTotal = 0;
  /** v1.65f — category status code (from project_categories.status_code).
      Rendered as a pill in the pink header when in project mode. */
  @Input() statusCode: string | null = null;
  /** v1.65w — manual estimate (project_categories.ballpark_cost). Replaces
      the computed subtotalAmount in the Estimate badge; click-to-edit. */
  @Input() estimatePrice: number | null = null;
  /** Sum of selected items' base_price across ALL the project's
      categories (not just this one). Shown in the pinned footer. */
  @Input() projectTotal = 0;

  @Output() itemClicked = new EventEmitter<any>();
  @Output() itemRemoved = new EventEmitter<any>();
  @Output() itemMoved = new EventEmitter<{ item: any; toType: 'selected' | 'liked' }>();
  @Output() browseClicked = new EventEmitter<void>();
  @Output() briefUpdated = new EventEmitter<string>();
  /** v1.65w — inline-edit emits for the new editable badges. */
  @Output() budgetUpdated = new EventEmitter<number | null>();
  @Output() estimateUpdated = new EventEmitter<number | null>();
  @Output() statusUpdated = new EventEmitter<string>();
  @Output() openEstimate = new EventEmitter<void>();
  /** v1.65ac — header cart icon → opens shared Project Items drawer. */
  @Output() openCart = new EventEmitter<void>();

  /** v1.65ac — full cart count (selected + liked) for the header badge,
      mirroring the All-view convention. selectedItems + likedItems are
      already filtered to this category by the parent. */
  get cartCount(): number {
    return (this.selectedItems?.length || 0) + (this.likedItems?.length || 0);
  }

  /** v1.65w — local edit flags. Click a badge / brief → flip true,
      input renders, blur/Enter commits, Escape cancels. */
  editingBudget = false;
  budgetDraft: number | null = null;
  editingEstimate = false;
  estimateDraft: number | null = null;
  editingStatus = false;
  editingBrief = false;

  /** Active tab. Items by default; if the user has only wishlist
      items, we still default to Items (clear empty state) — the user
      can flip to Wishlist explicitly.
      v1.65a — default flipped to Brief: when a category is selected on
      the marketplace, the brief is the primary context. */
  activeTab: PanelTab = 'brief';

  /** Local edit state for the inline brief editor. */
  briefDraft = '';

  /** v1.49 — suppliers with items in this category (marketplace /
      supplier card). Loaded from /taxonomy/category-suppliers. */
  categorySuppliers: Array<{
    supplier_id: string; supplier_name: string;
    description?: string; city?: string; item_count: number;
  }> = [];
  private suppliersForCat: string | null = null;

  /** v1.65f — category_status codelist for the header status pill. */
  categoryStatuses: any[] = [];

  constructor(
    private cdr: ChangeDetectorRef,
    private msg: MessageService,
    private api: ApiService,
    private codelistSvc: CodelistService,
    private router: Router,
  ) {
    // Cache-aware — fires immediately if already loaded.
    this.codelistSvc.getByName('category_status').subscribe({
      next: rows => { this.categoryStatuses = rows || []; this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  /** v1.65f — codelist label / colour for the active category status. */
  statusLabel(): string {
    const code = this.statusCode || 'draft';
    return this.categoryStatuses.find(s => s.code === code)?.label
      || (code.charAt(0).toUpperCase() + code.slice(1).replace(/_/g, ' '));
  }
  statusColor(): string {
    const code = this.statusCode || 'draft';
    return this.categoryStatuses.find(s => s.code === code)?.meta?.color || '';
  }

  // ── v1.65w — click-to-edit handlers ──────────────────────────────────
  startEditBudget(): void {
    this.budgetDraft = this.budgetPrice;
    this.editingBudget = true;
  }
  commitBudget(): void {
    if (!this.editingBudget) return;
    const v = this.budgetDraft;
    const next = (v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
    this.editingBudget = false;
    if (next !== this.budgetPrice) this.budgetUpdated.emit(next);
  }
  cancelBudget(): void { this.editingBudget = false; }

  startEditEstimate(): void {
    this.estimateDraft = this.estimatePrice;
    this.editingEstimate = true;
  }
  commitEstimate(): void {
    if (!this.editingEstimate) return;
    const v = this.estimateDraft;
    const next = (v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
    this.editingEstimate = false;
    if (next !== this.estimatePrice) this.estimateUpdated.emit(next);
  }
  cancelEstimate(): void { this.editingEstimate = false; }

  startEditStatus(): void { this.editingStatus = true; }
  commitStatus(code: string): void {
    this.editingStatus = false;
    if (code && code !== this.statusCode) this.statusUpdated.emit(code);
  }

  startEditBrief(): void {
    this.briefDraft = this.briefText || '';
    this.editingBrief = true;
  }
  commitBrief(): void {
    if (!this.editingBrief) return;
    const next = (this.briefDraft || '').trim();
    this.editingBrief = false;
    if (next !== (this.briefText || '').trim()) this.briefUpdated.emit(next);
  }
  cancelBrief(): void {
    this.editingBrief = false;
    this.briefDraft = this.briefText || '';
  }

  ngOnChanges() {
    // Keep the brief draft in sync when the parent passes new text
    // (different category active, server save round-trip, etc.).
    if (this.briefText !== this.briefDraft && document.activeElement?.tagName !== 'INPUT') {
      this.briefDraft = this.briefText || '';
    }
    // v1.49 — marketplace / supplier card: load the category's suppliers
    // when the active category changes.
    const catId = this.category?.id || null;
    if (this.context !== 'project' && catId && catId !== this.suppliersForCat) {
      this.suppliersForCat = catId;
      this.loadCategorySuppliers(catId);
    }
  }

  private loadCategorySuppliers(catId: string): void {
    this.categorySuppliers = [];
    this.api.get<any[]>(`/taxonomy/category-suppliers?category_id=${catId}`).subscribe({
      next: rows => { this.categorySuppliers = rows || []; this.cdr.markForCheck(); },
      error: () => { this.categorySuppliers = []; this.cdr.markForCheck(); }
    });
  }

  /** Total catalogue items in this category — summed from its suppliers. */
  get cardItemCount(): number {
    return this.categorySuppliers.reduce((s, x) => s + (Number(x.item_count) || 0), 0);
  }
  get cardSupplierCount(): number { return this.categorySuppliers.length; }

  /** Open a supplier's store front. */
  openSupplier(id: string): void {
    if (id) this.router.navigate(['/suppliers', id]);
  }

  // ── Computed summaries ───────────────────────────────────────────────

  get subtotalAmount(): number {
    if (!this.selectedItems.length) return 0;
    return this.selectedItems.reduce(
      (s, pi) => s + (Number(pi.base_price) || 0), 0
    );
  }

  get wishlistAmount(): number {
    if (!this.likedItems.length) return 0;
    return this.likedItems.reduce(
      (s, pi) => s + (Number(pi.base_price) || 0), 0
    );
  }

  get longestLeadDays(): number {
    let max = 0;
    for (const pi of this.selectedItems) {
      const d = Number(pi.lead_time_days);
      if (!isNaN(d) && d > max) max = d;
    }
    return max;
  }

  /** Lowercase category name for the "Add more {name}" CTA. */
  get catNameLower(): string {
    return (this.category?.name || 'items').toLowerCase();
  }

  trackByItemKey = (_: number, item: any): string => {
    return item?.id || item?.item_id || '';
  };

  setTab(tab: PanelTab) {
    this.activeTab = tab;
    if (tab === 'brief') {
      this.briefDraft = this.briefText || '';
    }
  }

  saveBriefIfChanged() {
    const next = (this.briefDraft || '').trim();
    const current = (this.briefText || '').trim();
    if (next !== current) {
      this.briefUpdated.emit(next);
    }
  }

  /** v1.25: pinned-footer CTA. Stubbed until the supplier outreach
      flow lands — surfaces a "Coming soon" toast so the affordance
      is honest about its state. event.stopPropagation isn't needed
      (the button is the only interactive element in the footer)
      but kept for symmetry with the rest of the panel. */
  onContactSupplier(event: MouseEvent) {
    event.stopPropagation();
    this.msg.add({
      severity: 'info',
      summary: 'Coming soon',
      detail: 'Supplier outreach flow not yet built',
      life: 2500,
    });
  }
}
