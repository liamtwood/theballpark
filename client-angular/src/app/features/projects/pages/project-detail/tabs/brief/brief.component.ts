import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';

import { ProjectService } from '../../../../../../core/services/project.service';
import { CategoryService } from '../../../../../../core/services/category.service';
import { Project, ProjectCategory, Category } from '../../../../../../models';
import { LoadingSpinnerComponent } from '../../../../../../shared/components/loading-spinner/loading-spinner.component';
import { MarkdownEditorComponent } from '../../../../../../shared/components/markdown-editor/markdown-editor.component';

type SectionKey = 'details' | 'type' | 'logistics' | 'financials';

@Component({
  selector: 'app-brief',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, LucideAngularModule,
    ButtonModule, InputTextModule, InputNumberModule, DropdownModule,
    CalendarModule, ToastModule,
    LoadingSpinnerComponent, MarkdownEditorComponent
  ],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading && project">
      <div class="bp-brief-body">

        <!-- ── EVENT DETAILS ── -->
        <div class="bp-brief-sec">
          <div class="bp-brief-sec-h">
            <span class="bp-brief-sec-label">EVENT DETAILS</span>
            <div class="bp-brief-sec-actions">
              <button *ngIf="!editing.details" class="bp-icon-btn" (click)="startEdit('details')" title="Edit">
                <lucide-icon name="square-pen" [size]="14"></lucide-icon>
              </button>
              <ng-container *ngIf="editing.details">
                <button class="bp-icon-btn bp-icon-save" (click)="saveSection('details')" [disabled]="saving" title="Save">
                  <i class="pi pi-check"></i>
                </button>
                <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('details')" title="Cancel">
                  <i class="pi pi-times"></i>
                </button>
              </ng-container>
            </div>
          </div>

          <div class="bp-brief-grid4">
            <div class="bp-brief-field">
              <label class="bp-brief-flabel">Ref</label>
              <input pInputText [value]="form.po_ref || '—'" *ngIf="!editing.details"
                class="bp-brief-finput" readonly/>
              <input pInputText [(ngModel)]="form.po_ref" *ngIf="editing.details"
                class="bp-brief-finput bp-brief-edit" placeholder="e.g. TVS-2026-047"/>
            </div>
            <div class="bp-brief-field bp-brief-s2">
              <label class="bp-brief-flabel">Event name</label>
              <input pInputText [value]="form.event_name || '—'" *ngIf="!editing.details"
                class="bp-brief-finput" readonly/>
              <input pInputText [(ngModel)]="form.event_name" *ngIf="editing.details"
                class="bp-brief-finput bp-brief-edit"/>
            </div>
            <div class="bp-brief-field">
              <label class="bp-brief-flabel">Client</label>
              <input pInputText [value]="form.client_name || '—'" *ngIf="!editing.details"
                class="bp-brief-finput" readonly/>
              <input pInputText [(ngModel)]="form.client_name" *ngIf="editing.details"
                class="bp-brief-finput bp-brief-edit"/>
            </div>

            <div class="bp-brief-field bp-brief-s2">
              <label class="bp-brief-flabel">Venue</label>
              <input pInputText [value]="form.venue_name || '—'" *ngIf="!editing.details"
                class="bp-brief-finput" readonly/>
              <input pInputText [(ngModel)]="form.venue_name" *ngIf="editing.details"
                class="bp-brief-finput bp-brief-edit"/>
            </div>
            <div class="bp-brief-field">
              <label class="bp-brief-flabel">City</label>
              <input pInputText [value]="form.venue_city || '—'" *ngIf="!editing.details"
                class="bp-brief-finput" readonly/>
              <input pInputText [(ngModel)]="form.venue_city" *ngIf="editing.details"
                class="bp-brief-finput bp-brief-edit"/>
            </div>
            <div></div>
          </div>
        </div>

        <hr class="bp-brief-divider">

        <!-- ── EVENT TYPE ── -->
        <div class="bp-brief-sec">
          <div class="bp-brief-sec-h">
            <span class="bp-brief-sec-label">EVENT TYPE</span>
            <div class="bp-brief-sec-actions">
              <button *ngIf="!editing.type" class="bp-icon-btn" (click)="startEdit('type')" title="Edit">
                <lucide-icon name="square-pen" [size]="14"></lucide-icon>
              </button>
              <ng-container *ngIf="editing.type">
                <button class="bp-icon-btn bp-icon-save" (click)="saveSection('type')" [disabled]="saving" title="Save">
                  <i class="pi pi-check"></i>
                </button>
                <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('type')" title="Cancel">
                  <i class="pi pi-times"></i>
                </button>
              </ng-container>
            </div>
          </div>

          <div class="bp-brief-grid4">
            <div class="bp-brief-field bp-brief-s2">
              <label class="bp-brief-flabel">Event type</label>
              <input pInputText [value]="(form.event_type | titlecase) || '—'" *ngIf="!editing.type"
                class="bp-brief-finput" readonly/>
              <p-dropdown *ngIf="editing.type"
                [(ngModel)]="form.event_type"
                [options]="eventTypeOptions"
                optionLabel="label" optionValue="value"
                styleClass="w-full bp-brief-dropdown bp-brief-edit"
                placeholder="Select event type">
              </p-dropdown>
            </div>
            <div class="bp-brief-field bp-brief-s2">
              <label class="bp-brief-flabel">Tier</label>
              <input pInputText [value]="(form.tier | titlecase) || '—'" *ngIf="!editing.type"
                class="bp-brief-finput" readonly/>
              <p-dropdown *ngIf="editing.type"
                [(ngModel)]="form.tier"
                [options]="tierOptions"
                optionLabel="label" optionValue="value"
                styleClass="w-full bp-brief-dropdown bp-brief-edit"
                placeholder="Select tier">
              </p-dropdown>
            </div>
          </div>
        </div>

        <hr class="bp-brief-divider">

        <!-- ── LOGISTICS ── -->
        <div class="bp-brief-sec">
          <div class="bp-brief-sec-h">
            <span class="bp-brief-sec-label">LOGISTICS</span>
            <div class="bp-brief-sec-actions">
              <button *ngIf="!editing.logistics" class="bp-icon-btn" (click)="startEdit('logistics')" title="Edit">
                <lucide-icon name="square-pen" [size]="14"></lucide-icon>
              </button>
              <ng-container *ngIf="editing.logistics">
                <button class="bp-icon-btn bp-icon-save" (click)="saveSection('logistics')" [disabled]="saving" title="Save">
                  <i class="pi pi-check"></i>
                </button>
                <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('logistics')" title="Cancel">
                  <i class="pi pi-times"></i>
                </button>
              </ng-container>
            </div>
          </div>

          <div class="bp-brief-grid4">
            <div class="bp-brief-field bp-brief-s2">
              <label class="bp-brief-flabel">Event date</label>
              <input pInputText [value]="formatDate(form.event_date) || '—'" *ngIf="!editing.logistics"
                class="bp-brief-finput" readonly/>
              <p-calendar *ngIf="editing.logistics"
                [(ngModel)]="eventDateModel"
                dateFormat="d M yy"
                [showIcon]="true"
                appendTo="body"
                styleClass="w-full bp-brief-cal bp-brief-edit">
              </p-calendar>
            </div>
            <div class="bp-brief-field">
              <label class="bp-brief-flabel">Duration (days)</label>
              <input pInputText [value]="form.duration_days || '—'" *ngIf="!editing.logistics"
                class="bp-brief-finput" readonly/>
              <p-inputNumber *ngIf="editing.logistics"
                [(ngModel)]="form.duration_days" [min]="1"
                styleClass="w-full bp-brief-num bp-brief-edit">
              </p-inputNumber>
            </div>
            <div class="bp-brief-field">
              <label class="bp-brief-flabel">Guest count</label>
              <input pInputText [value]="form.guest_count || '—'" *ngIf="!editing.logistics"
                class="bp-brief-finput" readonly/>
              <p-inputNumber *ngIf="editing.logistics"
                [(ngModel)]="form.guest_count" [min]="1"
                styleClass="w-full bp-brief-num bp-brief-edit">
              </p-inputNumber>
            </div>
          </div>
        </div>

        <hr class="bp-brief-divider">

        <!-- ── FINANCIALS ── -->
        <div class="bp-brief-sec">
          <div class="bp-brief-sec-h">
            <div>
              <span class="bp-brief-sec-label">FINANCIALS</span>
              <div class="bp-brief-sec-hint">Top-line numbers — full breakdown lives in Estimate</div>
            </div>
            <div class="bp-brief-sec-actions">
              <button *ngIf="!editing.financials" class="bp-icon-btn" (click)="startEdit('financials')" title="Edit">
                <lucide-icon name="square-pen" [size]="14"></lucide-icon>
              </button>
              <ng-container *ngIf="editing.financials">
                <button class="bp-icon-btn bp-icon-save" (click)="saveSection('financials')" [disabled]="saving" title="Save">
                  <i class="pi pi-check"></i>
                </button>
                <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('financials')" title="Cancel">
                  <i class="pi pi-times"></i>
                </button>
              </ng-container>
            </div>
          </div>

          <div class="bp-brief-grid4">
            <div class="bp-brief-field bp-brief-s2">
              <label class="bp-brief-flabel">Budget</label>
              <input pInputText [value]="formatCurrency(form.project_budget) || '—'" *ngIf="!editing.financials"
                class="bp-brief-finput" readonly/>
              <p-inputNumber *ngIf="editing.financials"
                [(ngModel)]="form.project_budget" prefix="£"
                [maxFractionDigits]="0" [min]="0"
                styleClass="w-full bp-brief-num bp-brief-edit">
              </p-inputNumber>
            </div>
            <div class="bp-brief-field">
              <label class="bp-brief-flabel">Margin %</label>
              <input pInputText [value]="(form.default_margin_pct ?? '—') + (form.default_margin_pct ? '%' : '')" *ngIf="!editing.financials"
                class="bp-brief-finput" readonly/>
              <p-inputNumber *ngIf="editing.financials"
                [(ngModel)]="form.default_margin_pct" suffix="%"
                [min]="0" [max]="100"
                styleClass="w-full bp-brief-num bp-brief-edit">
              </p-inputNumber>
            </div>
            <div class="bp-brief-field">
              <label class="bp-brief-flabel">Contingency %</label>
              <input pInputText [value]="(form.default_contingency_pct ?? '—') + (form.default_contingency_pct ? '%' : '')" *ngIf="!editing.financials"
                class="bp-brief-finput" readonly/>
              <p-inputNumber *ngIf="editing.financials"
                [(ngModel)]="form.default_contingency_pct" suffix="%"
                [min]="0" [max]="100"
                styleClass="w-full bp-brief-num bp-brief-edit">
              </p-inputNumber>
            </div>
          </div>
        </div>

        <hr class="bp-brief-divider">

        <!-- ── PROJECT BRIEF ── -->
        <div class="bp-brief-sec">
          <div class="bp-brief-sec-h">
            <span class="bp-brief-sec-label">PROJECT BRIEF</span>
            <button class="bp-brief-parse" (click)="parseBrief()">
              <lucide-icon name="wand-sparkles" [size]="12"></lucide-icon>
              Parse brief
            </button>
          </div>

          <app-markdown-editor
            [value]="form.raw_brief_text || ''"
            (valueChange)="onBriefValueChange($event)"
            placeholder="Paste or write the event brief here..."
            [rows]="6"
            [showLabel]="false">
          </app-markdown-editor>
        </div>

        <hr class="bp-brief-divider">

        <!-- ── IN SCOPE ── -->
        <div class="bp-brief-sec">
          <div class="bp-brief-sec-h">
            <span class="bp-brief-sec-label">IN SCOPE</span>
            <span class="bp-brief-sec-hint">Select the categories needed for this event</span>
          </div>

          <!-- Circle picker -->
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
                  <lucide-icon *ngIf="c.icon_name" [name]="c.icon_name" [size]="22"></lucide-icon>
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

          <div class="bp-brief-count-bar">
            <span><strong>{{ selectedCategoryIds.size }}</strong> categories selected</span>
            <span class="bp-brief-count-hint">Click any line to edit · wand rewrites from project brief</span>
          </div>

          <!-- Per-category briefs -->
          <div class="bp-brief-rows" *ngIf="orderedCategoryRows.length">
            <div *ngFor="let row of orderedCategoryRows; trackBy: trackByCatId" class="bp-brief-row">
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
              </div>
              <div class="bp-brief-row-actions">
                <button class="bp-brief-wand" (click)="rewriteRow(row)" title="Rewrite from project brief">
                  <lucide-icon name="wand-sparkles" [size]="13"></lucide-icon>
                </button>
              </div>
            </div>
          </div>
          <div *ngIf="!orderedCategoryRows.length" class="bp-brief-empty">
            No categories selected yet — pick one above to start scoping.
          </div>
        </div>

        <!-- ── FOOTER ── -->
        <div class="bp-brief-footer">
          <span class="bp-brief-footer-l">{{ selectedCategoryIds.size }} categories selected</span>
          <p-button label="Start building →"
            styleClass="p-button-outlined"
            [disabled]="selectedCategoryIds.size === 0"
            (onClick)="goToBuild()">
          </p-button>
        </div>

      </div>
    </ng-container>

    <p-toast></p-toast>
  `,
  styles: [`
    /* ── PAGE ── */
    .bp-brief-body { max-width: 860px; margin: 0 auto; padding: 28px 40px 100px; }

    /* ── SECTION ── */
    .bp-brief-sec        { margin-bottom: 24px; }
    .bp-brief-sec-h      { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; gap: 12px; }
    .bp-brief-sec-label  { display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--theme-accent); }
    .bp-brief-sec-hint   { font-size: 11.5px; color: var(--color-text-secondary); }
    .bp-brief-sec-actions{ display: flex; align-items: center; gap: 2px; }
    .bp-brief-divider    { height: 1px; background: var(--color-border); margin: 24px 0; border: none; }

    /* ── 4-COL GRID ── */
    .bp-brief-grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .bp-brief-s2    { grid-column: span 2; }
    .bp-brief-field { display: flex; flex-direction: column; gap: 5px; }
    .bp-brief-flabel { font-size: 10.5px; color: var(--color-text-secondary); font-weight: 500; }

    /* ── INPUT (view + edit unified — view is just readonly) ── */
    :host ::ng-deep .bp-brief-finput.p-inputtext {
      font-size: 13px !important;
      padding: 8px 11px !important;
      border: 0.5px solid var(--color-border) !important;
      border-radius: 6px !important;
      background: var(--color-surface) !important;
      color: var(--color-text-primary) !important;
      width: 100% !important;
      box-shadow: none !important;
    }
    :host ::ng-deep .bp-brief-finput.p-inputtext:read-only,
    :host ::ng-deep .bp-brief-finput.p-inputtext[readonly] {
      cursor: default !important;
    }
    :host ::ng-deep .bp-brief-finput.bp-brief-edit.p-inputtext,
    :host ::ng-deep input.bp-brief-edit.p-inputtext,
    :host ::ng-deep .bp-brief-num.bp-brief-edit .p-inputtext,
    :host ::ng-deep .bp-brief-dropdown.bp-brief-edit.p-dropdown,
    :host ::ng-deep .bp-brief-cal.bp-brief-edit .p-inputtext {
      background: var(--theme-bg) !important;
      border-color: var(--theme-accent) !important;
    }
    :host ::ng-deep .bp-brief-num.bp-brief-edit,
    :host ::ng-deep .bp-brief-dropdown.bp-brief-edit,
    :host ::ng-deep .bp-brief-cal.bp-brief-edit .p-calendar {
      width: 100% !important;
    }
    :host ::ng-deep .bp-brief-num.p-inputnumber input.p-inputtext {
      width: 100% !important;
      font-size: 13px !important;
      padding: 8px 11px !important;
      border-radius: 6px !important;
      border: 0.5px solid var(--color-border) !important;
      box-shadow: none !important;
    }
    :host ::ng-deep .bp-brief-dropdown.p-dropdown {
      border: 0.5px solid var(--color-border) !important;
      border-radius: 6px !important;
      font-size: 13px !important;
    }
    :host ::ng-deep .bp-brief-cal.p-calendar input.p-inputtext {
      font-size: 13px !important;
      padding: 8px 11px !important;
      border: 0.5px solid var(--color-border) !important;
      border-radius: 6px !important;
      box-shadow: none !important;
    }

    /* ── PARSE BUTTON (pill, parchment + amber border) ── */
    .bp-brief-parse {
      display: inline-flex; align-items: center; gap: 6px;
      height: 28px; padding: 0 12px;
      border: 0.5px solid var(--theme-accent);
      background: var(--theme-bg);
      color: var(--theme-accent);
      border-radius: 14px;
      font-size: 11.5px; font-weight: 600;
      font-family: var(--font-body);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .bp-brief-parse:hover { background: var(--theme-accent); color: var(--color-surface); }

    /* ── CIRCLE STRIP ── */
    .bp-brief-strip-wrap { display: flex; align-items: center; gap: 8px; }
    .bp-brief-strip {
      display: flex; gap: 18px;
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
      width: 64px; height: 64px;
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
      width: 18px; height: 18px;
      border-radius: 50%;
      background: var(--theme-accent);
      transform: translate(22px, -22px);
      box-shadow: 0 0 0 2px var(--color-surface);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 13l4 4L19 7'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 11px 11px;
    }
    .bp-brief-circle-letter {
      font-family: var(--font-display);
      font-size: 22px; font-weight: 600;
      color: inherit;
    }
    .bp-brief-cn {
      font-size: 11px; font-weight: 500;
      color: var(--color-text-secondary);
      text-align: center; max-width: 88px; line-height: 1.3;
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
      font-family: var(--font-display);
      font-size: 13.5px;
      color: var(--color-text-secondary);
      line-height: 1.55;
      letter-spacing: -0.005em;
      background: transparent;
      border: none; outline: none; resize: none;
      padding: 0; margin: 0;
      font-weight: 400;
    }
    .bp-brief-row-prompt::placeholder {
      color: var(--color-text-muted);
      font-style: italic;
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

    /* ── FOOTER ── */
    .bp-brief-footer {
      display: flex; align-items: center; justify-content: space-between;
      margin-top: 32px; padding-top: 16px;
      border-top: 0.5px solid var(--color-border);
    }
    .bp-brief-footer-l { font-size: 12px; color: var(--color-text-secondary); }

    /* Icon edit buttons inherit the global .bp-icon-btn from styles.css.
       Save = amber accent, cancel = neutral — handled there. */
  `]
})
export class BriefComponent implements OnInit, OnDestroy {
  loading = true;
  saving = false;
  pid = '';

  project: Project | null = null;
  form: Partial<Project> = {};

  catalogueCategories: Category[] = [];
  projectCategories: ProjectCategory[] = [];
  selectedCategoryIds = new Set<string>();

  editing = { details: false, type: false, logistics: false, financials: false };
  private snapshots: Record<SectionKey, Partial<Project>> = {
    details: {}, type: {}, logistics: {}, financials: {}
  };

  // p-calendar binds Date, but the project stores ISO/string. Sync via getter/setter.
  get eventDateModel(): Date | null {
    if (!this.form.event_date) return null;
    const d = new Date(this.form.event_date as any);
    return isNaN(d.getTime()) ? null : d;
  }
  set eventDateModel(value: Date | null) {
    this.form.event_date = value ? value.toISOString() : undefined;
  }

  // Per-row autosave debouncers (categoryId → timeout handle).
  private rowSaveTimers = new Map<string, any>();
  private briefSaveTimer: any = null;

  // Scroll arrow state
  canScrollLeft = false;
  canScrollRight = false;

  eventTypeOptions = [
    { label: 'Gala',           value: 'gala' },
    { label: 'Conference',     value: 'conference' },
    { label: 'Activation',     value: 'activation' },
    { label: 'Exhibition',     value: 'exhibition' },
    { label: 'Summer Party',   value: 'summer_party' },
    { label: 'Awards',         value: 'awards' },
    { label: 'Corporate',      value: 'corporate' },
    { label: 'Private',        value: 'private' },
  ];
  tierOptions = [
    { label: 'Core',      value: 'core' },
    { label: 'Signature', value: 'signature' },
    { label: 'Premium',   value: 'premium' },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projSvc: ProjectService,
    private catSvc: CategoryService,
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
      project:           this.projSvc.getById(this.pid),
      catCategories:     this.catSvc.getAll('catalogue'),
      projectCategories: this.projSvc.getCategories(this.pid),
    }).subscribe({
      next: ({ project, catCategories, projectCategories }) => {
        this.project = project;
        this.syncForm(project);
        // Root-level catalogue categories only (parent_id is null/undefined).
        this.catalogueCategories = (catCategories || [])
          .filter(c => !(c as any).parent_id)
          .sort((a, b) => ((a as any).sort_order || 0) - ((b as any).sort_order || 0));
        this.applyProjectCategories(projectCategories || []);
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
    if (this.briefSaveTimer) clearTimeout(this.briefSaveTimer);
    for (const t of this.rowSaveTimers.values()) clearTimeout(t);
  }

  // ── Project form sync ──
  private syncForm(p: Project) {
    this.form = {
      po_ref:                  p.po_ref,
      event_name:              p.event_name,
      client_name:             p.client_name,
      venue_name:              p.venue_name,
      venue_city:              p.venue_city,
      event_date:              p.event_date,
      event_type:              p.event_type,
      tier:                    p.tier,
      duration_days:           p.duration_days,
      guest_count:             p.guest_count,
      project_budget:          p.project_budget,
      default_margin_pct:      p.default_margin_pct,
      default_contingency_pct: p.default_contingency_pct,
      raw_brief_text:          p.raw_brief_text,
    };
  }

  private applyProjectCategories(rows: ProjectCategory[]) {
    this.projectCategories = rows;
    this.selectedCategoryIds = new Set(rows.map(r => r.category_id));
  }

  // ── Section edit controls ──
  startEdit(section: SectionKey) {
    this.snapshots[section] = { ...this.form };
    this.editing[section] = true;
    this.cdr.markForCheck();
  }

  cancelEdit(section: SectionKey) {
    Object.assign(this.form, this.snapshots[section]);
    this.editing[section] = false;
    this.cdr.markForCheck();
  }

  saveSection(section: SectionKey) {
    this.saving = true;
    this.projSvc.update(this.pid, this.form).subscribe({
      next: p => {
        this.project = p;
        this.syncForm(p);
        this.saving = false;
        this.editing[section] = false;
        this.msg.add({ severity: 'success', summary: 'Saved ✓', life: 1500 });
        this.projSvc.triggerRefresh();
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        this.msg.add({ severity: 'error', summary: 'Failed to save', life: 3000 });
        this.cdr.markForCheck();
      }
    });
  }

  // ── Project brief autosave (markdown editor) ──
  onBriefValueChange(value: string) {
    this.form.raw_brief_text = value;
    if (this.briefSaveTimer) clearTimeout(this.briefSaveTimer);
    this.briefSaveTimer = setTimeout(() => {
      this.briefSaveTimer = null;
      this.projSvc.update(this.pid, { raw_brief_text: value || '' }).subscribe({
        next: () => this.msg.add({ severity: 'success', summary: 'Saved ✓', life: 1200 }),
        error: () => this.msg.add({ severity: 'error', summary: 'Failed to save brief', life: 3000 })
      });
    }, 800);
  }

  parseBrief() {
    // Stub — AI brief parsing lives behind this in a later release.
    // eslint-disable-next-line no-console
    console.log('parse brief');
    this.msg.add({ severity: 'info', summary: 'AI parsing coming soon', life: 2000 });
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
          // Revert on failure
          this.selectedCategoryIds.add(c.id);
          this.cdr.markForCheck();
        }
      });
    } else {
      this.selectedCategoryIds.add(c.id);
      // Optimistic placeholder so the row renders immediately. The
      // server response replaces it with the canonical record.
      const placeholder = this.makeRowFromCategory(c);
      this.projectCategories = [...this.projectCategories, placeholder];
      this.cdr.markForCheck();
      this.projSvc.upsertCategory(this.pid, c.id, {}).subscribe({
        next: row => {
          // Replace the placeholder. Carry category meta forward since
          // the API response from upsert doesn't join categories.
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

  rewriteRow(_row: ProjectCategory) {
    // Stub — AI category brief rewrite lives behind this in a later release.
    this.msg.add({ severity: 'info', summary: 'AI category brief coming soon', life: 2000 });
  }

  // ── Strip scroll controls ──
  scrollStrip(direction: 1 | -1) {
    const el = document.querySelector('.bp-brief-strip') as HTMLElement | null;
    if (!el) return;
    el.scrollBy({ left: direction * 320, behavior: 'smooth' });
    setTimeout(() => this.updateStripArrows(), 250);
  }

  updateStripArrows() {
    const el = document.querySelector('.bp-brief-strip') as HTMLElement | null;
    if (!el) return;
    this.canScrollLeft = el.scrollLeft > 2;
    this.canScrollRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    this.cdr.markForCheck();
  }

  // ── Footer ──
  goToBuild() { this.router.navigate(['/projects', this.pid, 'build']); }

  // ── Display helpers ──
  formatDate(value: any): string {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  formatCurrency(value: any): string {
    if (value === null || value === undefined || value === '') return '';
    const n = Number(value);
    if (isNaN(n)) return '';
    return '£' + n.toLocaleString('en-GB', { maximumFractionDigits: 0 });
  }
}
