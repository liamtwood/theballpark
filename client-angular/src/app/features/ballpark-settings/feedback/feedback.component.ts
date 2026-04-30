import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { FeedbackService, FeedbackEntry, FeedbackCategory, TEAM_MEMBERS } from '../../../core/services/feedback.service';
import { CatalogueEntity, CategoryInfo } from '../../../models';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { CatalogueGridComponent } from '../../../shared/components/catalogue-grid/catalogue-grid.component';
import { FeedbackDialogComponent } from '../../../shared/components/feedback-dialog/feedback-dialog.component';
import { SidebarModule } from 'primeng/sidebar';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { ChipsModule } from 'primeng/chips';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService, SortMeta } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { CalendarModule } from 'primeng/calendar';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TieredMenuModule } from 'primeng/tieredmenu';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { MarkdownEditorComponent } from '../../../shared/components/markdown-editor/markdown-editor.component';

type ViewMode = 'grid' | 'list' | 'table';
type OptionalField = 'due_date' | 'tags' | 'linked';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [
    CommonModule, FormsModule, LucideAngularModule,
    LoadingSpinnerComponent, CatalogueGridComponent, FeedbackDialogComponent,
    SidebarModule, InputTextModule, ButtonModule, DropdownModule,
    ChipsModule, CheckboxModule, ConfirmDialogModule, ToastModule,
    TableModule, CalendarModule, SelectButtonModule, TieredMenuModule,
    OverlayPanelModule, StatusBadgeComponent, MarkdownEditorComponent
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading">
      <!-- AREA CIRCLES -->
      <div class="bp-fb-areas-wrap" *ngIf="areaCircles.length > 1">
        <div class="bp-fb-areas">
          <button *ngFor="let a of areaCircles"
            class="bp-fb-area-btn"
            [class.active]="selectedArea === a.id"
            (click)="setArea(a.id)">
            <div class="bp-fb-area-circle">
              <lucide-icon [name]="a.icon" [size]="22"></lucide-icon>
            </div>
            <span class="bp-fb-area-label">{{ a.label }}</span>
          </button>
        </div>
      </div>

      <!-- FILTER BAR -->
      <div class="bp-fb-filters">
        <p-dropdown [(ngModel)]="filterType" [options]="typeOptions" optionLabel="label" optionValue="value"
          (onChange)="applyFilters()" styleClass="bp-fb-filter" placeholder="Type"></p-dropdown>
        <p-dropdown [(ngModel)]="filterPage" [options]="pageOptions" optionLabel="label" optionValue="value"
          (onChange)="applyFilters()" styleClass="bp-fb-filter" placeholder="Page"></p-dropdown>
        <p-dropdown [(ngModel)]="filterOwner" [options]="ownerOptions" optionLabel="label" optionValue="value"
          (onChange)="applyFilters()" styleClass="bp-fb-filter" placeholder="Owner"></p-dropdown>
        <p-dropdown [(ngModel)]="filterStatus" [options]="statusOptions" optionLabel="label" optionValue="value"
          (onChange)="applyFilters()" styleClass="bp-fb-filter" placeholder="Status"></p-dropdown>
        <span class="bp-fb-filter-count">{{ filteredEntities.length }} of {{ allEntities.length }}</span>
        <p-selectButton
          [options]="viewModeOptions"
          [(ngModel)]="viewMode"
          optionLabel="label"
          optionValue="value"
          styleClass="bp-fb-view-select">
          <ng-template let-item pTemplate>
            <lucide-icon [name]="item.icon" [size]="14"></lucide-icon>
            <span class="ml-1">{{ item.label }}</span>
          </ng-template>
        </p-selectButton>
      </div>

      <!-- BULK ACTION BAR -->
      <div class="bp-fb-bulk-bar" *ngIf="selectedIds.size > 0">
        <span class="bp-fb-bulk-count">{{ selectedIds.size }} selected</span>
        <button class="bp-fb-bulk-btn" (click)="bulkMarkDone()">
          <lucide-icon name="check" [size]="12"></lucide-icon> Mark done
        </button>
        <p-dropdown [(ngModel)]="bulkAssignOwner" [options]="ownerAssignOptions" optionLabel="label" optionValue="value"
          (onChange)="bulkAssign()" styleClass="bp-fb-filter" placeholder="Assign to..."></p-dropdown>
        <button class="bp-fb-bulk-btn bp-fb-bulk-btn--danger" (click)="bulkDelete()">
          <lucide-icon name="x" [size]="12"></lucide-icon> Delete
        </button>
      </div>

      <app-catalogue-grid *ngIf="viewMode !== 'table'"
        [entities]="filteredEntities"
        [categories]="filterCategories"
        [layout]="viewMode === 'grid' ? 'card' : 'list'"
        [showLayoutToggle]="false"
        entityType="feedback"
        entityLabel="entry"
        sectionTitle="FEEDBACK"
        actionLabel="View"
        [favouriteIds]="emptySet"
        [showEdit]="false"
        [showFavourite]="false"
        [totalCount]="filteredEntities.length"
        (entitySelected)="onEntityPreview($event)"
        (actionClicked)="onEntitySelected($event)">
      </app-catalogue-grid>

      <!-- TABLE VIEW -->
      <div *ngIf="viewMode === 'table'" class="bp-fb-table-wrap">
        <p-table [value]="tableRows" styleClass="bp-table" sortMode="multiple"
          [multiSortMeta]="defaultTableSort" [scrollable]="true" scrollHeight="flex">
          <ng-template pTemplate="header">
            <tr>
              <th pSortableColumn="title">Title <p-sortIcon field="title"></p-sortIcon></th>
              <th>Area</th>
              <th pSortableColumn="prioritySortKey" style="width:90px">Priority <p-sortIcon field="prioritySortKey"></p-sortIcon></th>
              <th pSortableColumn="statusRank" style="width:120px">Status <p-sortIcon field="statusRank"></p-sortIcon></th>
              <th pSortableColumn="versionSortKey" style="width:160px">Version <p-sortIcon field="versionSortKey"></p-sortIcon></th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-row>
            <tr class="bp-fb-row" (click)="onTableRowClick(row)">
              <td class="bp-fb-cell-title" [title]="row.title">
                {{ row.title.length > 40 ? (row.title | slice:0:40) + '…' : row.title }}
              </td>
              <td>
                <span class="bp-fb-area-pill" *ngIf="row.area_name">
                  <lucide-icon *ngIf="row.area_icon_name" [name]="row.area_icon_name" [size]="14"></lucide-icon>
                  {{ row.area_name }}
                </span>
                <span class="bp-muted-text" *ngIf="!row.area_name">—</span>
              </td>
              <td>
                <span *ngIf="row.priority && row.status !== 'done'"
                  class="bp-priority-pill">
                  P{{ row.priority }}
                </span>
                <span class="bp-muted-text" *ngIf="!row.priority || row.status === 'done'">—</span>
              </td>
              <td>
                <app-status-badge [status]="row.status || 'open'" [statusName]="row.status || 'open'"></app-status-badge>
              </td>
              <td>
                <ng-container *ngIf="row.status === 'done'; else openVersion">
                  <span class="bp-fb-shipped-date" *ngIf="row.shipped_date">{{ formatShipDate(row.shipped_date) }}</span>
                  <span class="bp-fb-version-pill" *ngIf="row.version">{{ row.version }}</span>
                </ng-container>
                <ng-template #openVersion>
                  <span class="bp-fb-version-pill" *ngIf="row.target_version">{{ row.target_version }}</span>
                  <span class="bp-muted-text" *ngIf="!row.target_version">—</span>
                </ng-template>
              </td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr><td colspan="5" class="bp-empty-state"><span class="bp-muted-text">No feedback entries match your filters.</span></td></tr>
          </ng-template>
        </p-table>
      </div>

      <div *ngIf="!filteredEntities.length && !loading && viewMode !== 'table'" class="bp-empty-state">
        <p class="bp-muted-text">No feedback entries match your filters.</p>
      </div>
    </ng-container>

    <!-- DETAIL DRAWER (400px) -->
    <p-sidebar [(visible)]="showDrawer" position="right"
      styleClass="bp-drawer bp-fb-drawer" [style]="{width:'400px'}"
      [showCloseIcon]="false"
      (onHide)="closeDrawer()">

      <ng-template pTemplate="header">
        <div class="bp-fb-drawer-head" *ngIf="selectedEntry">
          <!-- Top line: label + title + close -->
          <div class="bp-fb-drawer-toprow">
            <div class="bp-fb-drawer-titles">
              <span class="bp-fb-drawer-eyebrow">FEEDBACK</span>
              <div class="bp-fb-drawer-title">{{ editTitle || selectedEntry.title || 'Entry' }}</div>
            </div>
            <button class="bp-icon-btn" (click)="closeDrawer()" title="Close">
              <i class="pi pi-times"></i>
            </button>
          </div>

          <!-- Pill row -->
          <div class="bp-fb-pill-row">
            <!-- Type pill -->
            <p-dropdown [(ngModel)]="editType"
              [options]="typeEditOptions"
              optionLabel="label" optionValue="value"
              styleClass="bp-fb-pill bp-fb-pill-amber"
              (onChange)="markDirty()">
              <ng-template pTemplate="selectedItem" let-item>
                <span class="bp-fb-pill-content">
                  <lucide-icon *ngIf="item?.icon" [name]="item.icon" [size]="11"></lucide-icon>
                  {{ item?.label || 'Type' }}
                </span>
              </ng-template>
              <ng-template pTemplate="item" let-item>
                <span class="bp-fb-pill-option">
                  <lucide-icon *ngIf="item.icon" [name]="item.icon" [size]="12"></lucide-icon>
                  {{ item.label }}
                </span>
              </ng-template>
            </p-dropdown>

            <!-- Status pill -->
            <p-dropdown [(ngModel)]="editStatus"
              [options]="statusEditOptions"
              optionLabel="label" optionValue="value"
              styleClass="bp-fb-pill bp-fb-pill-blue"
              (onChange)="markDirty()">
              <ng-template pTemplate="selectedItem" let-item>
                <span class="bp-fb-pill-content">{{ item?.label || 'Status' }}</span>
              </ng-template>
            </p-dropdown>

            <!-- Owner cycle pill -->
            <button type="button" class="bp-fb-owner-pill" (click)="cycleOwner()">
              <span class="bp-fb-owner-avatar">{{ ownerInitials() }}</span>
              <span>{{ editOwner || 'Owner' }}</span>
            </button>

            <!-- Priority pill -->
            <p-dropdown [(ngModel)]="editPriority"
              [options]="priorityEditOptions"
              optionLabel="label" optionValue="value"
              [showClear]="true"
              styleClass="bp-fb-pill bp-fb-pill-amber"
              placeholder="P—"
              (onChange)="markDirty()">
              <ng-template pTemplate="selectedItem" let-item>
                <span class="bp-fb-pill-content">{{ item ? item.label : 'P—' }}</span>
              </ng-template>
            </p-dropdown>

            <!-- Add attribute -->
            <button type="button" class="bp-fb-pill-more"
              (click)="attrMenu.toggle($event)" title="Add attribute">
              <i class="pi pi-ellipsis-h"></i>
            </button>
            <p-tieredMenu #attrMenu [model]="addAttrMenuItems" [popup]="true" appendTo="body"></p-tieredMenu>

            <span class="bp-fb-pill-spacer"></span>

            <!-- Target version pill -->
            <span class="bp-fb-target-pill" *ngIf="editTargetVersion">
              {{ editStatus === 'done' ? 'Fixed: ' : 'Target: ' }}{{ editTargetVersion }}
            </span>
            <button type="button" class="bp-fb-pill-more"
              (click)="versionMenu.toggle($event)" title="Set target version">
              <i class="pi pi-ellipsis-h"></i>
            </button>
            <p-tieredMenu #versionMenu [model]="versionMenuItems" [popup]="true" appendTo="body"></p-tieredMenu>
          </div>
        </div>
      </ng-template>

      <!-- BODY -->
      <div class="bp-fb-drawer-body" *ngIf="selectedEntry">
        <!-- AREA + PAGES ROW -->
        <div class="bp-fb-area-pages-row">
          <div class="bp-fb-area-cell">
            <label class="bp-fb-cell-label">AREA</label>
            <p-dropdown [(ngModel)]="editAreaCategoryId"
              [options]="areaDropdownOptions"
              optionLabel="label" optionValue="value"
              [showClear]="true"
              styleClass="w-full bp-fb-area-dd"
              placeholder="—"
              (onChange)="markDirty()">
              <ng-template pTemplate="selectedItem" let-item>
                <span class="bp-fb-area-selected" *ngIf="item">
                  <lucide-icon *ngIf="item.icon" [name]="item.icon" [size]="13"></lucide-icon>
                  {{ item.label }}
                </span>
              </ng-template>
              <ng-template pTemplate="item" let-item>
                <span class="bp-fb-area-option">
                  <lucide-icon *ngIf="item.icon" [name]="item.icon" [size]="13"></lucide-icon>
                  {{ item.label }}
                </span>
              </ng-template>
            </p-dropdown>
          </div>
          <div class="bp-fb-pages-cell">
            <label class="bp-fb-cell-label">PAGES</label>
            <div *ngFor="let p of editPages; let i = index" class="bp-fb-page-row">
              <span class="bp-fb-page-url" [title]="p">{{ p }}</span>
              <button type="button" class="bp-fb-page-x" (click)="removePage(i)">
                <i class="pi pi-times"></i>
              </button>
            </div>
            <input pInputText [(ngModel)]="newPageInput"
              class="w-full bp-fb-page-input"
              placeholder="add page..."
              (keydown.enter)="addPage()"/>
          </div>
        </div>

        <!-- NOTES -->
        <div class="bp-fb-notes-cell">
          <label class="bp-fb-cell-label">NOTES</label>
          <app-markdown-editor
            [value]="editNotes"
            (valueChange)="editNotes = $event; markDirty()"
            [rows]="10"
            [showLabel]="false"
            placeholder="Add notes, specs, requirements...">
          </app-markdown-editor>
        </div>

        <!-- OPTIONAL: Due date -->
        <div *ngIf="shownFields.has('due_date')" class="bp-fb-opt-cell">
          <label class="bp-fb-cell-label">DUE DATE</label>
          <p-calendar [(ngModel)]="editDueDate" [showIcon]="true" dateFormat="dd M yy"
            styleClass="w-full" inputStyleClass="w-full bp-input-edit"
            (onSelect)="markDirty()" (onClearClick)="markDirty()" [showClear]="true">
          </p-calendar>
        </div>

        <!-- OPTIONAL: Tags -->
        <div *ngIf="shownFields.has('tags')" class="bp-fb-opt-cell">
          <label class="bp-fb-cell-label">TAGS</label>
          <p-chips [(ngModel)]="editTags" styleClass="w-full bp-input-edit" [addOnBlur]="true"
            placeholder="Add tag..." (ngModelChange)="markDirty()"></p-chips>
        </div>

        <!-- OPTIONAL: Linked folders -->
        <div *ngIf="shownFields.has('linked')" class="bp-fb-opt-cell">
          <label class="bp-fb-cell-label">LINKED TO</label>
          <div class="bp-muted-text" style="font-size:12px;">No folders linked yet.</div>
        </div>

        <!-- META -->
        <div class="bp-fb-meta">
          Logged by {{ selectedEntry.submitted_by || 'Unknown' }} ·
          {{ formatDate(selectedEntry.created_at) }}
        </div>
      </div>

      <ng-template pTemplate="footer">
        <div class="bp-drawer-footer bp-fb-drawer-footer">
          <button class="bp-fb-btn-delete" (click)="confirmDelete()">Delete</button>
          <span style="flex:1"></span>
          <button class="bp-btn-cancel" (click)="closeDrawer()">Cancel</button>
          <button class="bp-btn-save" [disabled]="!isDirty" (click)="saveDetail()">Save</button>
        </div>
      </ng-template>
    </p-sidebar>

    <!-- Add action dialog -->
    <app-feedback-dialog
      [(visible)]="showActionDialog"
      initialFlow="issue"
      [parentId]="selectedEntry?.id || ''"
      [parentTitle]="selectedEntry?.title || ''"
      (submitted)="loadEntries()">
    </app-feedback-dialog>

    <p-confirmDialog></p-confirmDialog>
    <p-toast></p-toast>
  `,
  styles: [`
    .bp-empty-state { text-align: center; padding: 48px 24px; }

    /* Area circles */
    .bp-fb-areas-wrap { padding: 16px 28px 4px; border-bottom: 0.5px solid var(--color-border); }
    .bp-fb-areas { display: flex; gap: 18px; justify-content: center; padding: 4px 4px 12px; flex-wrap: wrap; }
    .bp-fb-area-btn { display: flex; flex-direction: column; align-items: center; gap: 5px; background: none; border: none; cursor: pointer; padding: 0; }
    .bp-fb-area-circle {
      width: 56px; height: 56px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      border: 2.5px solid transparent; transition: border-color 0.15s;
      color: var(--theme-accent); background: var(--theme-bg);
      box-shadow: 0 0 0 0.5px var(--color-border);
    }
    .bp-fb-area-btn.active .bp-fb-area-circle {
      border-color: var(--theme-accent);
      box-shadow: 0 0 0 2px var(--theme-accent);
    }
    .bp-fb-area-label {
      font-size: 11px; font-weight: 500; color: var(--color-text-secondary);
      font-family: var(--font-body); text-transform: capitalize;
    }
    .bp-fb-area-btn.active .bp-fb-area-label { color: var(--theme-accent); font-weight: 600; }

    /* Filter bar */
    .bp-fb-filters {
      display: flex; align-items: center; gap: 10px; padding: 12px 28px;
      border-bottom: 0.5px solid var(--color-border); flex-wrap: wrap;
    }
    :host ::ng-deep .bp-fb-filter { min-width: 130px; }
    :host ::ng-deep .bp-fb-filter .p-dropdown { font-size: 12px !important; }
    .bp-fb-filter-count { font-size: 12px; color: var(--color-text-muted); margin-left: auto; }

    /* View select (Grid / List / Table) — uses p-selectButton */
    :host ::ng-deep .bp-fb-view-select .p-button {
      padding: 6px 10px; font-size: 12px;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      color: var(--color-text-muted);
      display: inline-flex; align-items: center; gap: 4px;
    }
    :host ::ng-deep .bp-fb-view-select .p-button.p-highlight {
      background: var(--theme-bg);
      border-color: var(--theme-accent);
      color: var(--theme-accent);
    }

    /* Table view */
    .bp-fb-table-wrap { padding: 12px 24px; }
    :host ::ng-deep .bp-table .p-datatable-thead > tr > th {
      background: var(--color-surface); color: var(--color-text-muted);
      font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
      border-bottom: 0.5px solid var(--color-border); padding: 10px 12px;
    }
    :host ::ng-deep .bp-table .p-datatable-tbody > tr {
      cursor: pointer; transition: background 0.1s;
    }
    :host ::ng-deep .bp-table .p-datatable-tbody > tr:hover { background: var(--theme-bg); }
    :host ::ng-deep .bp-table .p-datatable-tbody > tr > td {
      padding: 10px 12px; font-size: 13px; color: var(--color-text-primary);
      border-bottom: 0.5px solid var(--color-border); vertical-align: middle;
    }
    .bp-fb-cell-title { font-weight: 500; }

    /* Area pill in table */
    .bp-fb-area-pill {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 8px; border-radius: 10px;
      background: var(--theme-bg); color: var(--theme-accent);
      font-size: 11px; font-weight: 500;
    }

    /* Priority pill (open issues only) — P1-P5 amber */
    .bp-priority-pill {
      display: inline-flex; padding: 2px 8px; border-radius: 10px;
      font-size: 10px; font-weight: 600; letter-spacing: 0.03em;
      background: var(--theme-bg); color: var(--theme-accent);
    }
    .bp-muted-text { color: var(--color-text-muted); font-size: 12px; }

    /* Version cell — combines shipped_date + version pill */
    .bp-fb-shipped-date { font-size: 11px; color: var(--color-text-muted); margin-right: 6px; }
    .bp-fb-version-pill {
      display: inline-flex; padding: 1px 7px; border-radius: 10px;
      background: var(--theme-bg); color: var(--theme-accent);
      font-size: 10px; font-weight: 600; letter-spacing: 0.02em;
    }

    /* Bulk action bar */
    .bp-fb-bulk-bar {
      display: flex; align-items: center; gap: 10px; padding: 8px 28px;
      background: var(--theme-bg); border-bottom: 0.5px solid var(--color-border);
    }
    .bp-fb-bulk-count { font-size: 12px; font-weight: 600; color: var(--color-text-primary); }
    .bp-fb-bulk-btn {
      display: flex; align-items: center; gap: 4px;
      padding: 5px 12px; font-size: 12px; font-weight: 500;
      border: 1px solid var(--color-border); background: var(--color-surface);
      color: var(--color-text-secondary); border-radius: 6px; cursor: pointer;
      font-family: var(--font-body); transition: all 0.15s;
    }
    .bp-fb-bulk-btn:hover { border-color: var(--theme-accent); color: var(--theme-accent); }
    .bp-fb-bulk-btn--danger:hover { border-color: var(--color-action-text); color: var(--color-action-text); }

    /* ─────────────────────────────────────────────────────────────────
       DRAWER (400px wide) — parchment header with pill row + body grid
       ───────────────────────────────────────────────────────────────── */

    :host ::ng-deep .bp-fb-drawer .p-sidebar-content {
      display: flex; flex-direction: column; padding: 0; height: 100%;
    }
    :host ::ng-deep .bp-fb-drawer .p-sidebar-header {
      background: var(--theme-bg); padding: 16px 20px 12px;
      border-bottom: 0.5px solid var(--color-border);
    }

    .bp-fb-drawer-head { width: 100%; }
    .bp-fb-drawer-toprow { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 12px; }
    .bp-fb-drawer-titles { flex: 1; min-width: 0; }
    .bp-fb-drawer-eyebrow {
      display: block; font-size: 10px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.06em;
      color: var(--theme-accent);
    }
    .bp-fb-drawer-title {
      font-family: var(--font-display); font-size: 16px; font-weight: 400;
      line-height: 1.25; color: var(--color-text-primary);
      margin-top: 2px;
      overflow: hidden; text-overflow: ellipsis; display: -webkit-box;
      -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }

    /* Pill row */
    .bp-fb-pill-row {
      display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
    }
    .bp-fb-pill-spacer { flex: 1; }

    /* p-dropdown rendered as a pill — shared base */
    :host ::ng-deep .bp-fb-pill .p-dropdown {
      border-radius: 999px; min-width: 0; height: 24px;
      border: 0.5px solid transparent;
      display: inline-flex; align-items: center;
    }
    :host ::ng-deep .bp-fb-pill .p-dropdown .p-dropdown-label {
      padding: 0 8px; font-size: 11px; font-weight: 500;
      display: inline-flex; align-items: center;
    }
    :host ::ng-deep .bp-fb-pill .p-dropdown .p-dropdown-trigger { width: 20px; }
    :host ::ng-deep .bp-fb-pill-amber .p-dropdown {
      background: var(--theme-bg); color: var(--theme-accent);
      border-color: var(--theme-accent);
    }
    :host ::ng-deep .bp-fb-pill-amber .p-dropdown .p-dropdown-label,
    :host ::ng-deep .bp-fb-pill-amber .p-dropdown .p-dropdown-trigger {
      color: var(--theme-accent);
    }
    :host ::ng-deep .bp-fb-pill-blue .p-dropdown {
      background: var(--color-quoted-bg); color: var(--color-quoted-text);
      border-color: var(--color-quoted-border);
    }
    :host ::ng-deep .bp-fb-pill-blue .p-dropdown .p-dropdown-label,
    :host ::ng-deep .bp-fb-pill-blue .p-dropdown .p-dropdown-trigger {
      color: var(--color-quoted-text);
    }
    .bp-fb-pill-content { display: inline-flex; align-items: center; gap: 4px; }
    .bp-fb-pill-option { display: inline-flex; align-items: center; gap: 6px; }

    /* Owner cycle pill */
    .bp-fb-owner-pill {
      height: 24px; padding: 0 10px 0 2px; border-radius: 999px;
      background: var(--theme-bg); color: var(--theme-accent);
      border: 0.5px solid var(--theme-accent);
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 500; cursor: pointer;
      font-family: var(--font-body);
    }
    .bp-fb-owner-avatar {
      width: 22px; height: 22px; border-radius: 50%;
      background: var(--theme-accent); color: #fff;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 9px; font-weight: 700; letter-spacing: 0.02em;
    }

    /* Target version pill (parchment, read-only display) */
    .bp-fb-target-pill {
      height: 24px; padding: 0 10px; border-radius: 999px;
      background: var(--theme-bg); color: var(--theme-accent);
      border: 0.5px solid var(--theme-accent);
      display: inline-flex; align-items: center;
      font-size: 11px; font-weight: 500;
    }

    /* "..." overflow trigger */
    .bp-fb-pill-more {
      width: 24px; height: 24px; border-radius: 50%;
      border: 0.5px solid var(--color-border); background: var(--color-surface);
      color: var(--color-text-muted); cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 11px;
    }
    .bp-fb-pill-more:hover { border-color: var(--theme-accent); color: var(--theme-accent); }

    /* Drawer body */
    :host ::ng-deep .bp-fb-drawer .p-sidebar-content > div.bp-fb-drawer-body {
      flex: 1 1 auto; min-height: 0;
    }
    .bp-fb-drawer-body {
      display: flex; flex-direction: column;
      padding: 0; height: 100%;
    }

    /* Area + Pages row — divided by 0.5px border */
    .bp-fb-area-pages-row {
      display: grid; grid-template-columns: 1fr 1fr;
      border-bottom: 0.5px solid var(--color-border);
    }
    .bp-fb-area-cell, .bp-fb-pages-cell { padding: 14px 16px; }
    .bp-fb-area-cell { border-right: 0.5px solid var(--color-border); }
    .bp-fb-cell-label {
      display: block; font-size: 10px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.06em;
      color: var(--color-text-muted); margin-bottom: 6px;
    }
    .bp-fb-area-selected, .bp-fb-area-option {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 12px;
    }
    :host ::ng-deep .bp-fb-area-dd .p-dropdown {
      width: 100%; height: 28px;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
    }

    /* Pages list */
    .bp-fb-page-row {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; padding: 3px 0;
    }
    .bp-fb-page-url {
      flex: 1; color: var(--color-text-primary);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .bp-fb-page-x {
      width: 18px; height: 18px; border: none; background: none;
      color: var(--color-text-muted); cursor: pointer; padding: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 10px;
    }
    .bp-fb-page-x:hover { color: var(--color-action-text); }
    :host ::ng-deep .bp-fb-page-input {
      font-size: 12px; padding: 4px 8px; height: 26px;
      border: 0.5px solid var(--color-border);
      background: var(--color-surface);
    }

    /* Notes — fills all remaining space */
    .bp-fb-notes-cell {
      flex: 1 1 auto; min-height: 0;
      padding: 14px 16px;
      display: flex; flex-direction: column;
      border-bottom: 0.5px solid var(--color-border);
    }
    :host ::ng-deep .bp-fb-notes-cell app-markdown-editor {
      flex: 1; display: flex; flex-direction: column; height: 100%;
    }
    :host ::ng-deep .bp-fb-notes-cell app-markdown-editor textarea { flex: 1; }

    /* Optional fields */
    .bp-fb-opt-cell { padding: 14px 16px; border-bottom: 0.5px solid var(--color-border); }

    /* Meta */
    .bp-fb-meta {
      padding: 12px 16px; font-size: 11px; color: var(--color-text-secondary);
    }

    /* Footer */
    .bp-fb-drawer-footer { display: flex; align-items: center; gap: 8px; padding: 0; }
    .bp-fb-btn-delete {
      padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 500;
      border: none; background: transparent;
      color: var(--color-action-text); cursor: pointer; font-family: var(--font-body);
    }
    .bp-fb-btn-delete:hover { text-decoration: underline; }
    .bp-btn-cancel {
      padding: 8px 20px; border-radius: 6px; font-size: 13px; font-weight: 500;
      border: 1px solid var(--color-border); background: transparent;
      color: var(--color-text-secondary); cursor: pointer; font-family: var(--font-body);
    }
    .bp-btn-save {
      padding: 8px 20px; border-radius: 6px; font-size: 13px; font-weight: 500;
      border: 1px solid var(--theme-accent); background: var(--theme-accent);
      color: #fff; cursor: pointer; font-family: var(--font-body);
    }
    .bp-btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
    .bp-icon-btn {
      width: 28px; height: 28px; border: none; background: none;
      color: var(--color-text-muted); cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .bp-icon-btn:hover { color: var(--theme-accent); background: var(--theme-bg); border-radius: 4px; }
  `]
})
export class FeedbackComponent implements OnInit {
  loading = true;
  allEntities: CatalogueEntity[] = [];
  filteredEntities: CatalogueEntity[] = [];
  entries: FeedbackEntry[] = [];
  emptySet = new Set<string>();
  team = TEAM_MEMBERS;
  selectedIds = new Set<string>();

  filterCategories: CategoryInfo[] = [
    { id: 'folder', name: 'Folders', icon: 'folder-open' }
  ];

  // Filter state
  filterType = '';
  filterPage = '';
  filterOwner = '';
  filterStatus = '';
  selectedArea: string = 'all';
  areaCircles: { id: string; label: string; icon: string }[] = [
    { id: 'all', label: 'All', icon: 'layers' }
  ];

  // 3-way SelectButton: Grid / List / Table
  viewMode: ViewMode = 'grid';
  viewModeOptions = [
    { label: 'Grid',  value: 'grid' as ViewMode,  icon: 'layers' },
    { label: 'List',  value: 'list' as ViewMode,  icon: 'list' },
    { label: 'Table', value: 'table' as ViewMode, icon: 'table' }
  ];

  tableRows: any[] = [];

  // Default sort: priority ASC (1 first), then status open → done.
  defaultTableSort: SortMeta[] = [
    { field: 'prioritySortKey', order: 1 },
    { field: 'statusRank',      order: 1 }
  ];

  private readonly statusRanks: Record<string, number> = {
    open: 0, in_progress: 1, done: 2, wont_fix: 3
  };

  areaCategories: FeedbackCategory[] = [];
  typeOptions = [{ label: 'All types', value: '' }];
  pageOptions = [{ label: 'All pages', value: '' }];
  ownerOptions = [{ label: 'All owners', value: '' }, ...TEAM_MEMBERS.map(m => ({ label: m.name, value: m.name }))];
  statusOptions = [
    { label: 'All statuses', value: '' },
    { label: 'Open', value: 'open' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Done', value: 'done' },
    { label: "Won't Fix", value: 'wont_fix' }
  ];
  ownerAssignOptions = TEAM_MEMBERS.map(m => ({ label: m.name, value: m.name }));
  bulkAssignOwner = '';

  // Detail drawer state
  showDrawer = false;
  showActionDialog = false;
  selectedEntry: FeedbackEntry | null = null;
  editTitle = '';
  editNotes = '';
  editOwner = '';
  editStatus = 'open';
  editType = 'bug';
  editTags: string[] = [];
  editPriority: number | null = null;
  editTargetVersion: string | null = null;
  editAreaCategoryId: string | null = null;
  editPages: string[] = [];
  editDueDate: Date | null = null;
  newPageInput = '';
  shownFields = new Set<OptionalField>();
  isDirty = false;

  // Header dropdown options
  priorityEditOptions = [
    { label: 'P1', value: 1 },
    { label: 'P2', value: 2 },
    { label: 'P3', value: 3 },
    { label: 'P4', value: 4 },
    { label: 'P5', value: 5 }
  ];

  // Combined Type options — issue types + folder types in one dropdown.
  typeEditOptions = [
    { label: 'Bug',         value: 'bug',         icon: 'bug',           kind: 'issue' as const },
    { label: 'Enhancement', value: 'enhancement', icon: 'lightbulb',     kind: 'issue' as const },
    { label: 'Question',    value: 'question',    icon: 'circle-help',   kind: 'issue' as const },
    { label: 'Prompt',      value: 'prompt',      icon: 'clipboard-pen', kind: 'issue' as const },
    { label: 'Minutes',     value: 'minutes',     icon: 'calendar',      kind: 'folder' as const },
    { label: 'Sprint',      value: 'sprint',      icon: 'zap',           kind: 'folder' as const },
    { label: 'Test Run',    value: 'test_run',    icon: 'flask-conical', kind: 'folder' as const }
  ];

  statusEditOptions = [
    { label: 'Open',        value: 'open' },
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Done',        value: 'done' },
    { label: "Won't Fix",   value: 'wont_fix' }
  ];

  // Area dropdown — populated from shared.feedback_categories (namespace='area')
  areaDropdownOptions: { label: string; value: string; icon: string }[] = [];

  // "Add attribute" menu — disables already-shown rows so a field can't be
  // added twice.
  get addAttrMenuItems() {
    return [
      { label: 'Due date',      icon: 'pi pi-calendar',    disabled: this.shownFields.has('due_date'), command: () => this.addField('due_date') },
      { label: 'Tags',          icon: 'pi pi-tag',         disabled: this.shownFields.has('tags'),     command: () => this.addField('tags') },
      { label: 'Linked folder', icon: 'pi pi-link',        disabled: this.shownFields.has('linked'),   command: () => this.addField('linked') }
    ];
  }

  // Version menu
  get versionMenuItems() {
    return [
      { label: 'v2.0', command: () => this.setTargetVersion('v2.0') },
      { label: 'v2.1', command: () => this.setTargetVersion('v2.1') },
      { label: 'v3.0', command: () => this.setTargetVersion('v3.0') },
      { separator: true },
      { label: 'Clear version', command: () => this.setTargetVersion(null) }
    ];
  }

  constructor(
    private feedbackSvc: FeedbackService,
    private confirmSvc: ConfirmationService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.feedbackSvc.getFeedbackCategories().subscribe({
      next: (cats) => {
        const all = cats || [];
        const issueCats = all
          .filter(c => c.namespace === 'issue' || c.object_type === 'issue')
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(c => ({
            id: c.name.toLowerCase().replace(/\s+/g, '_'),
            name: c.name + 's',
            icon: c.icon_name
          }));
        this.filterCategories = [
          { id: 'folder', name: 'Folders', icon: 'folder-open' },
          ...issueCats,
          { id: 'note', name: 'Notes', icon: 'file-text' }
        ];
        this.areaCategories = all.filter(c => c.namespace === 'area');
        this.areaDropdownOptions = [...this.areaCategories]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(a => ({ label: a.name, value: a.id, icon: a.icon_name || 'circle' }));
        this.loadEntries();
      },
      error: () => { this.loadEntries(); }
    });
  }

  loadEntries() {
    this.feedbackSvc.getAll().subscribe({
      next: (entries) => {
        this.entries = entries || [];
        const topLevel = this.entries.filter(e => !e.parent_id);

        this.allEntities = topLevel.map(e => ({
          id: e.id,
          name: e.title,
          description: e.notes,
          subtitle: this.buildSubtitle(e),
          badge: e.version || undefined,
          category_id: this.inferType(e),
          categoryLabel: this.inferType(e),
          icon: this.getTypeIcon(e),
          specs: [
            ...(e.area ? [{ label: 'Area', value: e.area }] : []),
            ...(e.version ? [{ label: 'Version', value: e.version }] : []),
            ...(e.shipped_date ? [{ label: 'Shipped', value: this.formatDate(e.shipped_date) }] : []),
            ...(e.status ? [{ label: 'Status', value: e.status }] : []),
            ...(e.owner ? [{ label: 'Owner', value: e.owner }] : []),
            ...(e.page_url ? [{ label: 'Page', value: e.page_url }] : []),
          ],
          _raw: e
        }));

        const referenced = new Set<string>();
        topLevel.forEach(e => {
          if (e.area_category_id) referenced.add(e.area_category_id);
          else if (e.area) referenced.add(e.area.toLowerCase());
        });
        const sortedAreas = [...this.areaCategories].sort((a, b) => a.sort_order - b.sort_order);
        const dbCircles = sortedAreas
          .filter(a => referenced.has(a.id) || referenced.has(a.name.toLowerCase()))
          .map(a => ({ id: a.id, label: a.name, icon: a.icon_name || 'circle' }));
        this.areaCircles = [
          { id: 'all', label: 'All', icon: 'layers' },
          ...dbCircles
        ];

        const pages = [...new Set(topLevel.map(e => e.page_url).filter(Boolean) as string[])].sort();
        this.pageOptions = [{ label: 'All pages', value: '' }, ...pages.map(p => ({ label: p, value: p }))];
        const types = [...new Set(topLevel.map(e => this.inferType(e)))];
        this.typeOptions = [{ label: 'All types', value: '' }, ...types.map(t => ({ label: t.charAt(0).toUpperCase() + t.slice(1), value: t }))];

        this.filterCategories = this.filterCategories.map(c => ({
          ...c,
          count: topLevel.filter(e => this.inferType(e) === c.id).length
        }));

        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  buildSubtitle(e: FeedbackEntry): string {
    const parts: string[] = [];
    if (e.status === 'done' && e.shipped_date) parts.push(`Shipped ${this.formatDate(e.shipped_date)}`);
    else if (e.status && e.status !== 'open') parts.push(e.status.replace('_', ' '));
    if (e.area) parts.push(e.area);
    if (e.owner) parts.push(e.owner);
    if (e.page_url) parts.push(e.page_url);
    return parts.join(' · ');
  }

  setArea(id: string) {
    this.selectedArea = id;
    this.applyFilters();
  }

  applyFilters() {
    this.filteredEntities = this.allEntities.filter(e => {
      const raw: FeedbackEntry = e._raw;
      if (this.selectedArea !== 'all') {
        const matchesId = raw.area_category_id === this.selectedArea;
        const matchesLegacyName = (raw.area || '').toLowerCase() === this.selectedArea.toLowerCase();
        if (!matchesId && !matchesLegacyName) return false;
      }
      if (this.filterType && this.inferType(raw) !== this.filterType) return false;
      if (this.filterPage && raw.page_url !== this.filterPage) return false;
      if (this.filterOwner && raw.owner !== this.filterOwner) return false;
      if (this.filterStatus && (raw.status || 'open') !== this.filterStatus) return false;
      return true;
    });
    this.tableRows = this.filteredEntities.map(e => {
      const r: FeedbackEntry = e._raw;
      const status = r.status || 'open';
      const priority = r.priority ?? null;
      // Done rows fall to the bottom of the version sort; open rows order by
      // target_version string (lex sort handles flat v2.0 < v2.1 < v3.0).
      const versionSortKey = status === 'done'
        ? (r.shipped_date || '0000-00-00')
        : (r.target_version || 'zzz');
      return {
        id: r.id,
        title: r.title,
        area_name: r.area_name,
        area_icon_name: r.area_icon_name,
        priority,
        status,
        // 99 sentinel pushes priority-less rows to the end of an ASC sort.
        prioritySortKey: priority ?? 99,
        statusRank: this.statusRanks[status] ?? 99,
        version: r.version,
        shipped_date: r.shipped_date,
        target_version: r.target_version,
        versionSortKey,
        _raw: r
      };
    });
    this.selectedIds.clear();
    this.cdr.detectChanges();
  }

  onTableRowClick(row: any) {
    const entity = this.allEntities.find(e => e.id === row.id);
    if (entity) this.onEntitySelected(entity);
  }

  formatShipDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
  }

  inferType(e: FeedbackEntry): string {
    if (e.object_type === 'folder') return 'folder';
    if (e.object_type === 'note') return 'note';
    if (e.type) return e.type;
    if (e.event_date) return 'folder';
    return 'bug';
  }

  onEntityPreview(entity: CatalogueEntity) {
    const entry = entity._raw as FeedbackEntry;
    if (entry?.object_type === 'folder') {
      window.open('/folder/' + entry.id, '_blank');
    }
  }

  onEntitySelected(entity: CatalogueEntity) {
    this.selectedEntry = entity._raw || this.entries.find(e => e.id === entity.id) || null;
    if (this.selectedEntry) {
      // Folder rows route to the dedicated meeting page.
      if (this.selectedEntry.event_date) {
        window.open('/folder/' + this.selectedEntry.id, '_blank');
        return;
      }
      const e = this.selectedEntry;
      this.editTitle = e.title;
      this.editNotes = e.notes || '';
      this.editOwner = e.owner || '';
      this.editStatus = e.status || 'open';
      this.editType = this.inferType(e);
      this.editTags = e.tags || [];
      this.editPriority = e.priority ?? null;
      this.editTargetVersion = e.target_version || null;
      this.editAreaCategoryId = e.area_category_id || null;
      // Seed pages: prefer pages[]; fall back to single page_url so legacy
      // rows show their captured URL.
      this.editPages = (e.pages && e.pages.length)
        ? [...e.pages]
        : (e.page_url ? [e.page_url] : []);
      this.editDueDate = e.due_date ? new Date(e.due_date) : null;
      this.newPageInput = '';
      // Pre-show optional fields if the row already has data for them.
      this.shownFields = new Set<OptionalField>();
      if (e.due_date)        this.shownFields.add('due_date');
      if (e.tags?.length)    this.shownFields.add('tags');
      this.isDirty = false;
      this.showDrawer = true;
      this.cdr.detectChanges();
    }
  }

  markDirty() { this.isDirty = true; }

  cycleOwner() {
    // Cycles LW → BP → MG → JC → unassigned → LW…
    const order = [...TEAM_MEMBERS.map(m => m.name), ''];
    const idx = order.indexOf(this.editOwner || '');
    this.editOwner = order[(idx + 1) % order.length];
    this.markDirty();
  }

  ownerInitials(): string {
    if (!this.editOwner) return '—';
    const m = this.team.find(t => t.name === this.editOwner);
    return m?.initials || this.editOwner.substring(0, 2).toUpperCase();
  }

  setTargetVersion(v: string | null) {
    this.editTargetVersion = v;
    this.markDirty();
  }

  addField(f: OptionalField) {
    this.shownFields.add(f);
    this.cdr.detectChanges();
  }

  addPage() {
    const v = this.newPageInput.trim();
    if (!v) return;
    if (!this.editPages.includes(v)) {
      this.editPages = [...this.editPages, v];
      this.markDirty();
    }
    this.newPageInput = '';
  }

  removePage(i: number) {
    this.editPages = this.editPages.filter((_, idx) => idx !== i);
    this.markDirty();
  }

  saveDetail() {
    if (!this.selectedEntry) return;
    const folderTypeValue = this.typeEditOptions.find(t => t.value === this.editType);
    const objectType = folderTypeValue?.kind === 'folder' ? 'folder' : 'issue';
    this.feedbackSvc.patch(this.selectedEntry.id, {
      title: this.editTitle,
      notes: this.editNotes || null,
      owner: this.editOwner || null,
      status: this.editStatus,
      type: this.editType,
      object_type: objectType,
      area_category_id: this.editAreaCategoryId,
      priority: this.editPriority,
      target_version: this.editTargetVersion,
      pages: this.editPages,
      tags: this.editTags,
      due_date: this.editDueDate ? this.toIsoDate(this.editDueDate) : null
    } as any).subscribe({
      next: () => {
        this.isDirty = false;
        this.msg.add({ severity: 'success', summary: 'Saved ✓' });
        this.loadEntries();
        this.cdr.detectChanges();
      }
    });
  }

  private toIsoDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  confirmDelete() {
    if (!this.selectedEntry) return;
    this.confirmSvc.confirm({
      message: 'Delete this feedback entry?',
      accept: () => {
        this.feedbackSvc.remove(this.selectedEntry!.id).subscribe(() => {
          this.closeDrawer();
          this.loadEntries();
          this.msg.add({ severity: 'success', summary: 'Deleted' });
        });
      }
    });
  }

  // Bulk actions
  bulkMarkDone() {
    const ids = [...this.selectedIds];
    let done = 0;
    for (const id of ids) {
      this.feedbackSvc.patch(id, { status: 'done' } as any).subscribe(() => {
        done++;
        if (done === ids.length) { this.selectedIds.clear(); this.loadEntries(); this.msg.add({ severity: 'success', summary: `${ids.length} marked done` }); }
      });
    }
  }

  bulkAssign() {
    if (!this.bulkAssignOwner) return;
    const ids = [...this.selectedIds];
    let done = 0;
    for (const id of ids) {
      this.feedbackSvc.patch(id, { owner: this.bulkAssignOwner } as any).subscribe(() => {
        done++;
        if (done === ids.length) { this.selectedIds.clear(); this.bulkAssignOwner = ''; this.loadEntries(); this.msg.add({ severity: 'success', summary: `${ids.length} assigned` }); }
      });
    }
  }

  bulkDelete() {
    this.confirmSvc.confirm({
      message: `Delete ${this.selectedIds.size} entries?`,
      accept: () => {
        const ids = [...this.selectedIds];
        let done = 0;
        for (const id of ids) {
          this.feedbackSvc.remove(id).subscribe(() => {
            done++;
            if (done === ids.length) { this.selectedIds.clear(); this.loadEntries(); this.msg.add({ severity: 'success', summary: `${ids.length} deleted` }); }
          });
        }
      }
    });
  }

  closeDrawer() {
    this.showDrawer = false;
    this.selectedEntry = null;
    this.isDirty = false;
    this.shownFields.clear();
    this.cdr.detectChanges();
  }

  getInitials(name: string): string {
    const member = this.team.find(m => m.name === name);
    return member?.initials || name.substring(0, 2).toUpperCase();
  }

  getTypeIcon(entry: FeedbackEntry): string {
    const type = this.inferType(entry);
    switch (type) {
      case 'folder': return 'folder-open';
      case 'bug': return 'bug';
      case 'enhancement': return 'lightbulb';
      case 'question': return 'circle-help';
      case 'prompt': return 'clipboard-pen';
      case 'note': return 'file-text';
      default: return 'check-square';
    }
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
