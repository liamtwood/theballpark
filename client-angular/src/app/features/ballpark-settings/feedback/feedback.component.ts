import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  FeedbackService, FeedbackEntry, FeedbackCategory, TEAM_MEMBERS
} from '../../../core/services/feedback.service';
import { CatalogueEntity, CategoryInfo } from '../../../models';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import {
  CatalogueGridComponent, CircleSize, DetailSize
} from '../../../shared/components/catalogue-grid/catalogue-grid.component';
import { FeedbackDialogComponent } from '../../../shared/components/feedback-dialog/feedback-dialog.component';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService, SortMeta } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { SelectButtonModule } from 'primeng/selectbutton';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { FeedbackDrawerComponent } from '../../feedback/feedback-drawer.component';

type ViewMode = 'grid' | 'list' | 'table';
type ThemeSwatch = '' | 'emerald' | 'pink' | 'ocean' | 'slate';
type DetailMode = 'inline' | 'drawer';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [
    CommonModule, FormsModule, LucideAngularModule,
    LoadingSpinnerComponent, CatalogueGridComponent, FeedbackDialogComponent,
    InputTextModule, DropdownModule, ButtonModule, ConfirmDialogModule, ToastModule,
    TableModule, SelectButtonModule,
    StatusBadgeComponent, AvatarComponent,
    FeedbackDrawerComponent
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading">
      <!-- catalogue-grid wraps grid/list/table. No detail panel — single
           click opens the drawer directly. Hero, config strip, and the
           area-circles/filter/bulk row are all projected through. -->
      <app-catalogue-grid
        [entities]="filteredEntities"
        [categories]="filterCategories"
        [showCategoryCircles]="false"
        sidebarCategoryLabel="Type"
        [layout]="catalogueLayout()"
        [showLayoutToggle]="false"
        [useCustomDetail]="false"
        entityType="feedback"
        entityLabel="entry"
        sectionTitle="FEEDBACK"
        actionLabel="Open"
        [pageLabel]="'BALLPARK SETTINGS'"
        [pageTitle]="'Feedback'"
        [pageSubtitle]="feedbackSubtitle"
        [circleSize]="circleSize"
        [detailSize]="detailSize"
        [breadcrumbRoot]="'AREA'"
        [breadcrumbAll]="'All Areas'"
        [breadcrumbActive]="selectedAreaLabel"
        [favouriteIds]="emptySet"
        [showEdit]="false"
        [showFavourite]="false"
        [totalCount]="filteredEntities.length"
        (entitySelected)="openDrawerFromEntity($event)"
        (actionClicked)="openDrawerFromEntity($event)"
        (categoryChanged)="onTypeFilterChanged($event)"
        (breadcrumbBackClicked)="setArea('all')">

        <!-- Per-page config strip controls (toggled by cog in top-nav) -->
        <div config-content class="bp-cfg-row">
          <span class="bp-cfg-lab">Theme</span>
          <p-selectButton
            [options]="themeOptions"
            [(ngModel)]="theme"
            (onChange)="onThemeChange()"
            optionLabel="label"
            optionValue="value"
            styleClass="bp-cfg-swatches">
            <ng-template let-opt pTemplate>
              <span class="bp-cfg-swatch" [style.background]="opt.color"></span>
            </ng-template>
          </p-selectButton>

          <span class="bp-cfg-divider"></span>
          <span class="bp-cfg-lab">Circle</span>
          <p-selectButton
            [options]="sizeOptions"
            [(ngModel)]="circleSize"
            (onChange)="persistConfig()"
            optionLabel="label"
            optionValue="value"
            styleClass="bp-cfg-seg"></p-selectButton>

          <span class="bp-cfg-divider"></span>
          <span class="bp-cfg-lab">View</span>
          <p-selectButton
            [options]="cfgViewOptions"
            [(ngModel)]="viewMode"
            (onChange)="persistConfig()"
            optionLabel="label"
            optionValue="value"
            styleClass="bp-cfg-seg"></p-selectButton>

          <span class="bp-cfg-divider"></span>
          <span class="bp-cfg-lab">Detail</span>
          <p-selectButton
            [options]="sizeOptions"
            [(ngModel)]="detailSize"
            (onChange)="persistConfig()"
            optionLabel="label"
            optionValue="value"
            styleClass="bp-cfg-seg"></p-selectButton>

          <span class="bp-cfg-divider"></span>
          <span class="bp-cfg-lab">Mode</span>
          <p-selectButton
            [options]="detailModeOptions"
            [(ngModel)]="detailMode"
            (onChange)="persistConfig()"
            optionLabel="label"
            optionValue="value"
            styleClass="bp-cfg-seg"></p-selectButton>
        </div>

        <!-- AREA CIRCLES + FILTER BAR + BULK BAR — projected so they sit
             between the hero and the 3-col body. -->
        <div catalogue-before-body>
          <div class="bp-fb-areas-wrap" *ngIf="areaCircles.length > 1" [attr.data-circle-size]="circleSize">
            <div class="bp-fb-areas">
              <button *ngFor="let a of areaCircles"
                class="bp-fb-area-btn"
                [class.active]="selectedArea === a.id"
                (click)="setArea(a.id)">
                <div class="bp-fb-area-circle"
                  [style.background-color]="a.iconColor || null">
                  <lucide-icon [name]="a.icon" [size]="areaIconSize"></lucide-icon>
                </div>
                <span class="bp-fb-area-label">{{ a.label }}</span>
              </button>
            </div>
          </div>

          <div class="bp-fb-filters">
            <p-dropdown [(ngModel)]="filterType" [options]="typeOptions" optionLabel="label" optionValue="value"
              (onChange)="applyFilters()" styleClass="bp-fb-filter" placeholder="All types"></p-dropdown>
            <p-dropdown [(ngModel)]="filterPage" [options]="pageOptions" optionLabel="label" optionValue="value"
              (onChange)="applyFilters()" styleClass="bp-fb-filter" placeholder="All pages"></p-dropdown>
            <p-dropdown [(ngModel)]="filterOwner" [options]="ownerOptions" optionLabel="label" optionValue="value"
              (onChange)="applyFilters()" styleClass="bp-fb-filter" placeholder="All owners"></p-dropdown>
            <p-dropdown [(ngModel)]="filterStatus" [options]="statusOptions" optionLabel="label" optionValue="value"
              (onChange)="applyFilters()" styleClass="bp-fb-filter" placeholder="All statuses"></p-dropdown>
          </div>

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
        </div>

        <!-- Section header right-side controls: Add + view toggle. -->
        <div catalogue-toggles class="bp-fb-header-actions">
          <p-button label="+ Add" styleClass="p-button-outlined bp-fb-add-btn"
            (onClick)="openAddDialog()"></p-button>
          <p-selectButton
            [options]="viewModeOptions"
            [(ngModel)]="viewMode"
            optionLabel="label"
            optionValue="value"
            styleClass="bp-fb-view-select">
            <ng-template let-item pTemplate>
              <lucide-icon [name]="item.icon" [size]="14"></lucide-icon>
            </ng-template>
          </p-selectButton>
        </div>

        <!-- TABLE — only rendered when layout='table' -->
        <div catalogue-main *ngIf="viewMode === 'table'" class="bp-fb-table-wrap">
          <p-table [value]="tableRows" styleClass="bp-table" sortMode="multiple"
            [multiSortMeta]="defaultTableSort" [scrollable]="true" scrollHeight="flex">
            <ng-template pTemplate="header">
              <tr>
                <th style="width:88px">ID</th>
                <th pSortableColumn="type" style="width:120px">Type <p-sortIcon field="type"></p-sortIcon></th>
                <th pSortableColumn="area_name" style="width:140px">Area <p-sortIcon field="area_name"></p-sortIcon></th>
                <th style="width:200px">Pages</th>
                <th pSortableColumn="title">Title <p-sortIcon field="title"></p-sortIcon></th>
                <th pSortableColumn="owner" style="width:90px">Owner <p-sortIcon field="owner"></p-sortIcon></th>
                <th pSortableColumn="statusRank" style="width:120px">Status <p-sortIcon field="statusRank"></p-sortIcon></th>
                <th pSortableColumn="versionSortKey" style="width:140px">Version <p-sortIcon field="versionSortKey"></p-sortIcon></th>
                <th pSortableColumn="test_count" style="width:90px">Tests <p-sortIcon field="test_count"></p-sortIcon></th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-row>
              <tr class="bp-fb-row" (click)="openDrawerById(row.id)">
                <td>
                  <span class="bp-fb-id-pill">{{ row.displayId }}</span>
                </td>
                <td>
                  <span class="bp-fb-type-pill">
                    <lucide-icon *ngIf="row.typeIcon" [name]="row.typeIcon" [size]="11"></lucide-icon>
                    {{ row.typeLabel }}
                  </span>
                </td>
                <td>
                  <span class="bp-fb-area-pill" *ngIf="row.area_name">
                    <lucide-icon *ngIf="row.area_icon_name" [name]="row.area_icon_name" [size]="14"></lucide-icon>
                    {{ row.area_name }}
                  </span>
                  <span class="bp-muted-text" *ngIf="!row.area_name">—</span>
                </td>
                <td>
                  <span *ngIf="row.firstPage" [title]="row.firstPage" class="bp-fb-page-cell">
                    {{ row.firstPage.length > 30 ? (row.firstPage | slice:0:30) + '…' : row.firstPage }}
                  </span>
                  <span class="bp-muted-text" *ngIf="!row.firstPage">—</span>
                </td>
                <td class="bp-fb-cell-title" [title]="row.title">
                  {{ row.title.length > 60 ? (row.title | slice:0:60) + '…' : row.title }}
                </td>
                <td>
                  <app-avatar *ngIf="row.owner" [name]="row.owner" [size]="28"></app-avatar>
                  <span class="bp-muted-text" *ngIf="!row.owner">—</span>
                </td>
                <td>
                  <app-status-badge [status]="row.status || 'open'"
                    [statusName]="row.status || 'open'"></app-status-badge>
                </td>
                <td>
                  <ng-container *ngIf="row.status === 'done'; else openVersion">
                    <span class="bp-fb-shipped-date" *ngIf="row.shipped_date">{{ formatShipDate(row.shipped_date) }}</span>
                    <span class="bp-fb-version-pill" *ngIf="row.version">{{ row.version }}</span>
                    <span class="bp-muted-text" *ngIf="!row.version && !row.shipped_date">—</span>
                  </ng-container>
                  <ng-template #openVersion>
                    <span class="bp-fb-version-pill" *ngIf="row.target_version">{{ row.target_version }}</span>
                    <span class="bp-muted-text" *ngIf="!row.target_version">—</span>
                  </ng-template>
                </td>
                <td>
                  <!-- Open todos drive an action; otherwise the feature is
                       considered tested if any test cases exist. -->
                  <span *ngIf="row.test_todo_count > 0" class="bp-fb-tests-pill bp-fb-tests-pill--todo"
                    title="Open test cases to do">
                    {{ row.test_todo_count }} to do
                  </span>
                  <span *ngIf="!row.test_todo_count && row.test_count > 0"
                    class="bp-fb-tests-pill bp-fb-tests-pill--done"
                    title="All test cases have been run">
                    ✓ Tested
                  </span>
                  <span *ngIf="!row.test_count" class="bp-muted-text"
                    title="No test cases yet">—</span>
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr><td colspan="9" class="bp-empty-state"><span class="bp-muted-text">No feedback entries match your filters.</span></td></tr>
            </ng-template>
          </p-table>
        </div>
      </app-catalogue-grid>

      <div *ngIf="!filteredEntities.length && !loading && viewMode !== 'table'" class="bp-empty-state">
        <p class="bp-muted-text">No feedback entries match your filters.</p>
      </div>
    </ng-container>

    <!-- NEW: feedback drawer (single-click target for grid/list/table) -->
    <app-feedback-drawer
      [(visible)]="drawerVisible"
      [entry]="selectedEntry"
      (saved)="onDrawerSaved($event)"
      (deleted)="onDrawerDeleted($event)">
    </app-feedback-drawer>

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

    /* Area circles — size driven by [data-circle-size] from the config strip. */
    .bp-fb-areas-wrap {
      padding: 16px 28px 4px; border-bottom: 0.5px solid var(--color-border);
      --bp-fb-area-w: 72px;
    }
    .bp-fb-areas-wrap[data-circle-size="sm"] { --bp-fb-area-w: 56px; }
    .bp-fb-areas-wrap[data-circle-size="md"] { --bp-fb-area-w: 72px; }
    .bp-fb-areas-wrap[data-circle-size="lg"] { --bp-fb-area-w: 96px; }
    .bp-fb-areas { display: flex; gap: 18px; justify-content: center; padding: 4px 4px 12px; flex-wrap: wrap; }
    .bp-fb-area-btn { display: flex; flex-direction: column; align-items: center; gap: 5px; background: none; border: none; cursor: pointer; padding: 0; }
    .bp-fb-area-circle {
      width: var(--bp-fb-area-w, 72px); height: var(--bp-fb-area-w, 72px);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      border: 2.5px solid transparent;
      transition: width 0.18s, height 0.18s, border-color 0.15s;
      color: var(--theme-accent); background: var(--theme-bg);
      box-shadow: 0 0 0 0.5px var(--color-border);
    }
    /* When icon_color is set on the area, an inline style fills the
       circle with that hue (it's the "icon background" in the area
       form). The lucide stroke keeps the theme-accent default so the
       icon stays legible on top of the fill. */
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

    /* Section-header actions: Add button + view toggle */
    .bp-fb-header-actions {
      display: inline-flex; align-items: center; gap: 8px;
      margin-left: auto;
    }
    :host ::ng-deep .bp-fb-add-btn .p-button {
      height: 30px; padding: 0 12px;
      font-size: 12px; font-weight: 500;
      font-family: var(--font-body);
    }
    :host ::ng-deep .bp-fb-view-select .p-button {
      width: 30px; height: 30px; padding: 0;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      color: var(--color-text-muted);
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 6px;
    }
    :host ::ng-deep .bp-fb-view-select .p-button + .p-button { margin-left: 4px; }
    :host ::ng-deep .bp-fb-view-select .p-button.p-highlight {
      background: var(--theme-bg);
      border-color: var(--theme-border);
      color: var(--theme-accent);
    }
    :host ::ng-deep .bp-fb-view-select .p-button:focus { box-shadow: none; }

    /* Table */
    .bp-fb-table-wrap { padding: 12px 8px; }
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

    .bp-fb-type-pill {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 8px; border-radius: 10px;
      background: var(--theme-bg); color: var(--theme-accent);
      font-size: 11px; font-weight: 500; text-transform: capitalize;
    }
    .bp-fb-area-pill {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 8px; border-radius: 10px;
      background: var(--theme-bg); color: var(--theme-accent);
      font-size: 11px; font-weight: 500;
    }
    .bp-fb-page-cell { font-size: 12px; color: var(--color-text-secondary); }
    .bp-muted-text { color: var(--color-text-muted); font-size: 12px; }
    .bp-fb-version-pill {
      display: inline-flex; padding: 1px 7px; border-radius: 10px;
      background: var(--theme-bg); color: var(--theme-accent);
      font-size: 10px; font-weight: 600; letter-spacing: 0.02em;
    }
    .bp-fb-tests-pill {
      display: inline-flex; align-items: center;
      padding: 2px 8px; border-radius: 20px;
      font-size: 11px; font-weight: 500;
    }
    .bp-fb-tests-pill--todo {
      background: var(--theme-bg);
      color: var(--theme-accent);
      border: 0.5px solid var(--theme-border, var(--color-border));
    }
    .bp-fb-tests-pill--done {
      background: var(--color-booked-bg);
      color: var(--color-booked-text);
      border: 0.5px solid var(--color-booked-border);
      font-weight: 600;
      gap: 3px;
    }
    .bp-fb-id-pill {
      display: inline-flex; align-items: center;
      padding: 1px 5px; border-radius: 4px;
      font-family: var(--font-mono, ui-monospace, monospace);
      font-size: 10px;
      color: var(--color-text-secondary);
      background: var(--color-background-secondary, var(--color-surface));
      border: 0.5px solid var(--color-border-tertiary, var(--color-border));
    }
    .bp-fb-shipped-date {
      font-size: 11px; color: var(--color-text-muted); margin-right: 6px;
    }

    /* Config strip layout — labels + segmented controls in a row. */
    .bp-cfg-row { display: contents; }
    .bp-cfg-lab {
      font-size: 10px; font-weight: 600; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--color-text-muted);
    }
    .bp-cfg-divider {
      width: 1px; height: 22px; background: var(--color-border);
    }
    .bp-cfg-swatch {
      display: inline-block; width: 18px; height: 18px; border-radius: 50%;
    }
    :host ::ng-deep .bp-cfg-seg .p-button {
      padding: 4px 12px; font-size: 12px;
      background: var(--color-surface); color: var(--color-text-muted);
      border: 0.5px solid var(--color-border);
      font-family: var(--font-body);
    }
    :host ::ng-deep .bp-cfg-seg .p-button.p-highlight {
      background: var(--theme-accent); color: var(--color-surface);
      border-color: var(--theme-accent); font-weight: 600;
    }
    :host ::ng-deep .bp-cfg-seg .p-button:focus { box-shadow: none; }
    :host ::ng-deep .bp-cfg-swatches .p-button {
      padding: 4px 6px;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
    }
    :host ::ng-deep .bp-cfg-swatches .p-button.p-highlight {
      background: var(--color-surface);
      box-shadow: 0 0 0 2px var(--color-text-primary);
      border-color: var(--color-surface);
    }
    :host ::ng-deep .bp-cfg-swatches .p-button:focus { box-shadow: 0 0 0 2px var(--color-text-primary); }

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
    { id: 'bug',         name: 'Bug',         icon: 'bug' },
    { id: 'enhancement', name: 'Enhancement', icon: 'lightbulb' },
    { id: 'question',    name: 'Question',    icon: 'circle-help' },
    { id: 'prompt',      name: 'Prompt',      icon: 'clipboard-pen' },
    { id: 'note',        name: 'Note',        icon: 'file-text' },
    { id: 'test_case',   name: 'Test Case',   icon: 'check-square' },
    { id: 'folder',      name: 'Folder',      icon: 'folder-open' }
  ];

  filterType = '';
  // Type filter coming from the catalogue-grid sidebar — drives the table
  // view too (catalogue-grid only filters its own cards/list).
  sidebarTypeFilter = 'all';
  filterPage = '';
  filterOwner = '';
  filterStatus = '';
  selectedArea: string = 'all';
  areaCircles: { id: string; label: string; icon: string; iconColor?: string }[] = [
    { id: 'all', label: 'All', icon: 'layers' }
  ];

  viewMode: ViewMode = 'table';
  viewModeOptions = [
    { label: 'Grid',  value: 'grid' as ViewMode,  icon: 'layout-grid' },
    { label: 'List',  value: 'list' as ViewMode,  icon: 'list' },
    { label: 'Table', value: 'table' as ViewMode, icon: 'table' }
  ];

  // ── Hero copy + config strip state (persisted to localStorage) ──
  get feedbackSubtitle(): string {
    const n = this.entries.length;
    const areas = Math.max(0, this.areaCircles.length - 1);
    return `${n} entries across ${areas} areas · roadmap, bugs, prompts & tests`;
  }

  /** Display label for the currently-selected area; '' when on "All". */
  get selectedAreaLabel(): string {
    if (!this.selectedArea || this.selectedArea === 'all') return '';
    const a = this.areaCircles.find(c => c.id === this.selectedArea);
    return a?.label || '';
  }

  /** Lucide icon size for area circles — scales with circleSize. */
  get areaIconSize(): number {
    if (this.circleSize === 'sm') return 20;
    if (this.circleSize === 'md') return 26;
    return 34;
  }

  private readonly LS = {
    theme:      'ballpark:feedback:theme',
    circleSize: 'ballpark:feedback:circleSize',
    detailSize: 'ballpark:feedback:detailSize',
    viewMode:   'ballpark:feedback:viewMode',
    detailMode: 'ballpark:feedback:detailMode'
  };
  theme: ThemeSwatch = '';
  circleSize: CircleSize = 'md';
  detailSize: DetailSize = 'md';
  // Drawer is the only fully-supported detail mode for feedback today.
  // The toggle persists user choice for when inline detail lands.
  detailMode: DetailMode = 'drawer';

  themeOptions = [
    { label: 'Amber',   value: '' as ThemeSwatch,        color: 'var(--theme-accent)' },
    { label: 'Emerald', value: 'emerald' as ThemeSwatch, color: '#00B84A' },
    { label: 'Pink',    value: 'pink' as ThemeSwatch,    color: '#FF0066' },
    { label: 'Ocean',   value: 'ocean' as ThemeSwatch,   color: '#2563EB' },
    { label: 'Slate',   value: 'slate' as ThemeSwatch,   color: '#64748B' }
  ];
  sizeOptions = [
    { label: 'S', value: 'sm' as CircleSize },
    { label: 'M', value: 'md' as CircleSize },
    { label: 'L', value: 'lg' as CircleSize }
  ];
  cfgViewOptions = [
    { label: 'Card',  value: 'grid' as ViewMode },
    { label: 'List',  value: 'list' as ViewMode },
    { label: 'Table', value: 'table' as ViewMode }
  ];
  detailModeOptions = [
    { label: 'Inline',  value: 'inline' as DetailMode },
    { label: 'Drawer',  value: 'drawer' as DetailMode }
  ];

  tableRows: any[] = [];

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

  // Drawer state
  drawerVisible = false;
  showActionDialog = false;
  selectedEntry: FeedbackEntry | null = null;

  typeLabelMap: Record<string, string> = {
    bug: 'Bug', enhancement: 'Enhancement', question: 'Question',
    prompt: 'Prompt', note: 'Note', minutes: 'Minutes',
    sprint: 'Sprint', test_run: 'Test Run', test_case: 'Test Case'
  };
  typeIconMap: Record<string, string> = {
    bug: 'bug', enhancement: 'lightbulb', question: 'circle-help',
    prompt: 'clipboard-pen', note: 'file-text', minutes: 'calendar',
    sprint: 'zap', test_run: 'flask-conical', test_case: 'check-square',
    folder: 'folder-open'
  };
  idPrefixMap: Record<string, string> = {
    bug: 'BUG', enhancement: 'ENH', prompt: 'PRM', question: 'QST',
    test_case: 'TST', note: 'NTE', folder: 'FLD'
  };

  getDisplayId(entry: FeedbackEntry): string {
    const t = this.inferType(entry);
    const prefix = this.idPrefixMap[t] || 'FBK';
    return prefix + '-' + (entry.id || '').substring(0, 4).toUpperCase();
  }

  constructor(
    private feedbackSvc: FeedbackService,
    private confirmSvc: ConfirmationService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  catalogueLayout(): 'list' | 'card' | 'table' {
    if (this.viewMode === 'grid')  return 'card';
    if (this.viewMode === 'list')  return 'list';
    return 'table';
  }

  ngOnInit() {
    this.loadConfig();
    this.feedbackSvc.getFeedbackCategories('area').subscribe({
      next: (cats) => {
        this.areaCategories = (cats || []).filter(c => c.namespace === 'area');
        this.loadEntries();
      },
      error: () => { this.loadEntries(); }
    });
  }

  // ── Config strip persistence ──────────────────────────────────────────
  loadConfig() {
    this.theme      = (localStorage.getItem(this.LS.theme) || '') as ThemeSwatch;
    this.circleSize = (localStorage.getItem(this.LS.circleSize) || 'md') as CircleSize;
    this.detailSize = (localStorage.getItem(this.LS.detailSize) || 'md') as DetailSize;
    this.viewMode   = (localStorage.getItem(this.LS.viewMode)   || 'table') as ViewMode;
    this.detailMode = (localStorage.getItem(this.LS.detailMode) || 'drawer') as DetailMode;
    this.applyTheme();
  }
  persistConfig() {
    localStorage.setItem(this.LS.theme,      this.theme);
    localStorage.setItem(this.LS.circleSize, this.circleSize);
    localStorage.setItem(this.LS.detailSize, this.detailSize);
    localStorage.setItem(this.LS.viewMode,   this.viewMode);
    localStorage.setItem(this.LS.detailMode, this.detailMode);
  }
  onThemeChange() {
    this.applyTheme();
    this.persistConfig();
  }
  private applyTheme() {
    if (this.theme) document.documentElement.setAttribute('data-theme', this.theme);
    else document.documentElement.removeAttribute('data-theme');
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
          badge: this.getDisplayId(e),
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
          .map(a => ({
            id: a.id,
            label: a.name,
            icon: a.icon_name || 'circle',
            iconColor: a.icon_color || ''
          }));
        this.areaCircles = [
          { id: 'all', label: 'All', icon: 'layers' },
          ...dbCircles
        ];

        const pages = [...new Set(topLevel.map(e => e.page_url).filter(Boolean) as string[])].sort();
        this.pageOptions = [{ label: 'All pages', value: '' }, ...pages.map(p => ({ label: p, value: p }))];
        const types = [...new Set(topLevel.map(e => this.inferType(e)))];
        this.typeOptions = [
          { label: 'All types', value: '' },
          ...types.map(t => ({ label: this.typeLabelMap[t] || (t.charAt(0).toUpperCase() + t.slice(1)), value: t }))
        ];

        this.filterCategories = this.filterCategories.map(c => ({
          ...c,
          count: topLevel.filter(e => this.inferType(e) === c.id).length
        }));

        this.applyFilters();
        this.loading = false;

        // Refresh selectedEntry if drawer is open and entry is in the list.
        if (this.selectedEntry) {
          const refreshed = topLevel.find(e => e.id === this.selectedEntry!.id);
          if (refreshed) this.selectedEntry = refreshed;
        }
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

  onTypeFilterChanged(catId: string) {
    this.sidebarTypeFilter = catId || 'all';
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
      if (this.sidebarTypeFilter !== 'all' && this.inferType(raw) !== this.sidebarTypeFilter) return false;
      if (this.filterPage && raw.page_url !== this.filterPage) return false;
      if (this.filterOwner && raw.owner !== this.filterOwner) return false;
      if (this.filterStatus && (raw.status || 'open') !== this.filterStatus) return false;
      return true;
    });
    this.tableRows = this.filteredEntities.map(e => {
      const r: FeedbackEntry = e._raw;
      const status = r.status || 'open';
      const priority = r.priority ?? null;
      const type = this.inferType(r);
      const firstPage = (r.pages && r.pages[0]) || r.page_url || '';
      const versionSortKey = status === 'done'
        ? (r.shipped_date || '0000-00-00')
        : (r.target_version || 'zzz');
      return {
        id: r.id,
        displayId: this.getDisplayId(r),
        title: r.title,
        type,
        typeLabel: this.typeLabelMap[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : '—'),
        typeIcon: this.typeIconMap[type] || this.getTypeIcon(r),
        area_name: r.area_name,
        area_icon_name: r.area_icon_name,
        firstPage,
        owner: r.owner || '',
        priority,
        status,
        prioritySortKey: priority ?? 99,
        statusRank: this.statusRanks[status] ?? 99,
        version: r.version,
        shipped_date: r.shipped_date,
        target_version: r.target_version,
        versionSortKey,
        test_count: r.test_count || 0,
        test_todo_count: r.test_todo_count || 0,
        _raw: r
      };
    });
    this.selectedIds.clear();
    this.cdr.detectChanges();
  }

  // ── Drawer wiring ──
  openDrawerFromEntity(entity: CatalogueEntity) {
    const raw = entity._raw as FeedbackEntry | undefined;
    if (!raw) return;
    if (raw.object_type === 'folder') {
      window.open('/folder/' + raw.id, '_blank');
      return;
    }
    this.selectedEntry = raw;
    this.drawerVisible = true;
    this.cdr.detectChanges();
  }

  openDrawerById(id: string) {
    const entity = this.allEntities.find(e => e.id === id);
    if (entity) this.openDrawerFromEntity(entity);
  }

  onDrawerSaved(updated: FeedbackEntry) {
    this.selectedEntry = updated;
    this.loadEntries();
  }

  openAddDialog() {
    // Same dialog the floating capture button uses; clearing selectedEntry
    // first so it doesn't auto-attach as a parent.
    this.selectedEntry = null;
    this.showActionDialog = true;
  }

  onDrawerDeleted(_id: string) {
    this.drawerVisible = false;
    this.selectedEntry = null;
    this.loadEntries();
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

  bulkMarkDone() {
    const ids = [...this.selectedIds];
    let done = 0;
    for (const id of ids) {
      this.feedbackSvc.patch(id, { status: 'done' } as any).subscribe(() => {
        done++;
        if (done === ids.length) {
          this.selectedIds.clear();
          this.loadEntries();
          this.msg.add({ severity: 'success', summary: `${ids.length} marked done` });
        }
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
        if (done === ids.length) {
          this.selectedIds.clear();
          this.bulkAssignOwner = '';
          this.loadEntries();
          this.msg.add({ severity: 'success', summary: `${ids.length} assigned` });
        }
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
            if (done === ids.length) {
              this.selectedIds.clear();
              this.loadEntries();
              this.msg.add({ severity: 'success', summary: `${ids.length} deleted` });
            }
          });
        }
      }
    });
  }

  getTypeIcon(entry: FeedbackEntry): string {
    return this.typeIconMap[this.inferType(entry)] || 'check-square';
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
