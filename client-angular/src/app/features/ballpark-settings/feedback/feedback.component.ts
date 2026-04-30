import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
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
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

type ViewMode = 'grid' | 'list' | 'table';
type OptionalField = 'due_date' | 'tags' | 'linked';

const STATUS_CYCLE = ['open', 'in_progress', 'done', 'wont_fix'] as const;

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [
    CommonModule, FormsModule, LucideAngularModule,
    LoadingSpinnerComponent, CatalogueGridComponent, FeedbackDialogComponent,
    SidebarModule, InputTextModule, ButtonModule, DropdownModule,
    ChipsModule, CheckboxModule, ConfirmDialogModule, ToastModule,
    TableModule, CalendarModule, SelectButtonModule, TieredMenuModule,
    OverlayPanelModule, StatusBadgeComponent, MarkdownEditorComponent,
    AvatarComponent
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
        <!-- Icon-only Grid/List/Table — same size + active styling as the
             existing .bp-view-btn used inside catalogue-grid. -->
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

      <!-- SINGLE catalogue-grid wraps all 3 view modes so the filter sidebar
           and right detail panel stay in place across grid/list/table. The
           table is projected via [catalogue-main]; the right preview is
           projected via [catalogue-detail]. -->
      <app-catalogue-grid
        [entities]="filteredEntities"
        [categories]="filterCategories"
        [layout]="catalogueLayout()"
        [showLayoutToggle]="false"
        [useCustomDetail]="true"
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

        <!-- TABLE — only rendered when layout='table' -->
        <div catalogue-main *ngIf="viewMode === 'table'" class="bp-fb-table-wrap">
          <p-table [value]="tableRows" styleClass="bp-table" sortMode="multiple"
            [multiSortMeta]="defaultTableSort" [scrollable]="true" scrollHeight="flex">
            <ng-template pTemplate="header">
              <tr>
                <th pSortableColumn="type" style="width:120px">Type <p-sortIcon field="type"></p-sortIcon></th>
                <th pSortableColumn="area_name" style="width:140px">Area <p-sortIcon field="area_name"></p-sortIcon></th>
                <th style="width:200px">Pages</th>
                <th pSortableColumn="title">Title <p-sortIcon field="title"></p-sortIcon></th>
                <th pSortableColumn="owner" style="width:90px">Owner <p-sortIcon field="owner"></p-sortIcon></th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-row>
              <tr class="bp-fb-row"
                [class.bp-fb-row-active]="previewEntry?.id === row.id"
                (click)="onTableRowClick(row)">
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
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr><td colspan="5" class="bp-empty-state"><span class="bp-muted-text">No feedback entries match your filters.</span></td></tr>
            </ng-template>
          </p-table>
        </div>

        <!-- CUSTOM RIGHT DETAIL PANEL — feedback preview (rendered notes
             + priority pill). Always projected; populated by row/card click. -->
        <div catalogue-detail class="bp-fb-detail">
          <ng-container *ngIf="previewEntry; else emptyDetail">
            <div class="bp-fb-detail-eyebrow">{{ (inferType(previewEntry) || 'feedback') | uppercase }}</div>
            <div class="bp-fb-detail-title">{{ previewEntry.title }}</div>
            <div class="bp-fb-detail-meta" *ngIf="previewEntry.area_name">
              <lucide-icon *ngIf="previewEntry.area_icon_name" [name]="previewEntry.area_icon_name" [size]="12"></lucide-icon>
              {{ previewEntry.area_name }}
            </div>

            <div class="bp-md-preview bp-fb-detail-notes" [innerHTML]="previewHtml"></div>

            <div class="bp-fb-detail-pills">
              <span *ngIf="previewEntry.priority"
                class="bp-priority-pill"
                [class.bp-priority-pill--muted]="(previewEntry.status || 'open') === 'done'">
                P{{ previewEntry.priority }}
              </span>
              <app-status-badge [status]="previewEntry.status || 'open'"
                [statusName]="previewEntry.status || 'open'"></app-status-badge>
              <span class="bp-fb-version-pill" *ngIf="previewEntry.target_version && previewEntry.status !== 'done'">
                Target: {{ previewEntry.target_version }}
              </span>
              <span class="bp-fb-version-pill" *ngIf="previewEntry.version && previewEntry.status === 'done'">
                Fixed: {{ previewEntry.version }}
              </span>
            </div>

            <button class="bp-btn-save bp-fb-detail-edit" (click)="onEntitySelectedById(previewEntry.id)">
              <lucide-icon name="square-pen" [size]="13"></lucide-icon> Edit
            </button>
          </ng-container>
          <ng-template #emptyDetail>
            <div class="bp-detail-empty">
              <p>Select an entry to preview</p>
            </div>
          </ng-template>
        </div>
      </app-catalogue-grid>

      <div *ngIf="!filteredEntities.length && !loading && viewMode !== 'table'" class="bp-empty-state">
        <p class="bp-muted-text">No feedback entries match your filters.</p>
      </div>
    </ng-container>

    <!-- DETAIL DRAWER (520px) -->
    <p-sidebar [(visible)]="showDrawer" position="right"
      styleClass="bp-drawer bp-fb-drawer" [style]="{width:'520px'}"
      [showCloseIcon]="false"
      (onHide)="closeDrawer()">

      <ng-template pTemplate="header">
        <div class="bp-fb-drawer-head" *ngIf="selectedEntry">
          <!-- Top line: type eyebrow + inline-editable title + close -->
          <div class="bp-fb-drawer-toprow">
            <div class="bp-fb-drawer-titles">
              <span class="bp-fb-drawer-eyebrow">{{ typeEyebrow() }}</span>
              <input *ngIf="titleEditing"
                #titleInput
                pInputText
                class="bp-fb-drawer-title-input"
                [(ngModel)]="editTitle"
                (blur)="finishTitleEdit()"
                (keydown.enter)="finishTitleEdit()"
                (keydown.escape)="cancelTitleEdit()"/>
              <div *ngIf="!titleEditing"
                class="bp-fb-drawer-title"
                title="Click to edit"
                (click)="startTitleEdit()">
                {{ editTitle || 'Untitled' }}
              </div>
            </div>
            <button class="bp-icon-btn" (click)="closeDrawer()" title="Close">
              <i class="pi pi-times"></i>
            </button>
          </div>

          <!-- Pill row -->
          <div class="bp-fb-pill-row">
            <!-- Type pill (dropdown) -->
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

            <!-- Status pill — click to cycle through statuses -->
            <button type="button" class="bp-fb-status-pill"
              [attr.data-status]="editStatus"
              (click)="cycleStatus()">
              {{ statusLabel(editStatus) }}
            </button>

            <!-- Owner cycle pill -->
            <button type="button" class="bp-fb-owner-pill" (click)="cycleOwner()">
              <span class="bp-fb-owner-avatar">{{ ownerInitials() }}</span>
              <span>{{ editOwner || 'Owner' }}</span>
            </button>

            <!-- Priority pill — click to cycle P1→P2→…→P5→P1 -->
            <button type="button" class="bp-fb-priority-pill-btn"
              (click)="cyclePriority()">
              {{ editPriority ? 'P' + editPriority : 'P—' }}
            </button>

            <!-- Add attribute -->
            <button type="button" class="bp-fb-pill-more"
              (click)="attrMenu.toggle($event)" title="Add attribute">
              <i class="pi pi-ellipsis-h"></i>
            </button>
            <p-tieredMenu #attrMenu [model]="addAttrMenuItems" [popup]="true" appendTo="body"></p-tieredMenu>

            <span class="bp-fb-pill-spacer"></span>

            <!-- Target version pill — click to edit inline -->
            <input *ngIf="versionEditing"
              #versionInput
              pInputText
              class="bp-fb-version-input"
              [(ngModel)]="editTargetVersion"
              (blur)="finishVersionEdit()"
              (keydown.enter)="finishVersionEdit()"
              (keydown.escape)="cancelVersionEdit()"
              placeholder="v2.0"/>
            <button *ngIf="!versionEditing && editTargetVersion"
              type="button"
              class="bp-fb-target-pill"
              (click)="startVersionEdit()"
              title="Click to edit">
              {{ editStatus === 'done' ? 'Fixed: ' : 'Target: ' }}{{ editTargetVersion }}
            </button>
            <button *ngIf="!versionEditing && !editTargetVersion"
              type="button"
              class="bp-fb-pill-more"
              (click)="startVersionEdit()"
              title="Set target version">
              <i class="pi pi-ellipsis-h"></i>
            </button>
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

        <!-- NOTES — preview-first, click to edit, blur back to preview -->
        <div class="bp-fb-notes-cell">
          <label class="bp-fb-cell-label">NOTES</label>
          <ng-container *ngIf="!notesEditing">
            <div class="bp-md-preview bp-fb-notes-preview"
                 [innerHTML]="editNotesPreviewHtml"
                 (click)="startNotesEdit()"
                 title="Click to edit"
                 [class.bp-fb-notes-empty]="!editNotes">
              <ng-container *ngIf="!editNotes">
                <span class="bp-fb-notes-placeholder">Click to add notes…</span>
              </ng-container>
            </div>
          </ng-container>
          <div class="bp-fb-notes-editor-wrap"
               *ngIf="notesEditing"
               (focusout)="onNotesBlur($event)">
            <app-markdown-editor
              [value]="editNotes"
              (valueChange)="onNotesChange($event)"
              [rows]="10"
              [showLabel]="false"
              placeholder="Add notes, specs, requirements...">
            </app-markdown-editor>
          </div>
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

    /* View select — icon-only Grid/List/Table. Mirrors .bp-view-btn from
       catalogue-grid (30×30, parchment-active). */
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

    /* Table view — projected into catalogue-grid main slot */
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
    :host ::ng-deep .bp-table .p-datatable-tbody > tr.bp-fb-row-active { background: var(--theme-bg); }
    :host ::ng-deep .bp-table .p-datatable-tbody > tr > td {
      padding: 10px 12px; font-size: 13px; color: var(--color-text-primary);
      border-bottom: 0.5px solid var(--color-border); vertical-align: middle;
    }
    .bp-fb-cell-title { font-weight: 500; }

    /* Type pill — small amber chip */
    .bp-fb-type-pill {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 8px; border-radius: 10px;
      background: var(--theme-bg); color: var(--theme-accent);
      font-size: 11px; font-weight: 500; text-transform: capitalize;
    }
    /* Area pill in table */
    .bp-fb-area-pill {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 8px; border-radius: 10px;
      background: var(--theme-bg); color: var(--theme-accent);
      font-size: 11px; font-weight: 500;
    }
    .bp-fb-page-cell { font-size: 12px; color: var(--color-text-secondary); }

    /* Priority pill (open issues amber, done muted) */
    .bp-priority-pill {
      display: inline-flex; padding: 2px 8px; border-radius: 10px;
      font-size: 10px; font-weight: 600; letter-spacing: 0.03em;
      background: var(--theme-bg); color: var(--theme-accent);
    }
    .bp-priority-pill--muted {
      background: var(--color-surface); color: var(--color-text-muted);
    }
    .bp-muted-text { color: var(--color-text-muted); font-size: 12px; }

    /* Version pill */
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
       Right detail panel (projected into catalogue-grid)
       ───────────────────────────────────────────────────────────────── */
    .bp-fb-detail { padding: 20px 18px; height: 100%; overflow-y: auto; }
    .bp-fb-detail-eyebrow {
      font-size: 10px; font-weight: 600; letter-spacing: 0.06em;
      color: var(--theme-accent); text-transform: uppercase;
    }
    .bp-fb-detail-title {
      font-family: var(--font-display); font-size: 18px; font-weight: 400;
      color: var(--color-text-primary); margin-top: 4px; line-height: 1.25;
    }
    .bp-fb-detail-meta {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11px; color: var(--color-text-muted); margin-top: 6px;
    }
    .bp-fb-detail-notes { margin-top: 12px; max-height: calc(100vh - 360px); }
    .bp-fb-detail-pills {
      display: flex; flex-wrap: wrap; gap: 6px;
      margin-top: 14px;
    }
    .bp-fb-detail-edit {
      display: inline-flex; align-items: center; gap: 4px;
      margin-top: 16px;
    }
    .bp-detail-empty {
      padding: 40px 16px; text-align: center; color: var(--color-text-muted);
    }

    /* ─────────────────────────────────────────────────────────────────
       DRAWER (520px wide) — parchment header with pill row + body grid
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
      font-family: var(--font-display); font-size: 18px; font-weight: 400;
      line-height: 1.25; color: var(--color-text-primary);
      margin-top: 2px; cursor: text;
      padding: 2px 4px; border-radius: 4px;
    }
    .bp-fb-drawer-title:hover { background: rgba(0,0,0,0.02); }
    :host ::ng-deep .bp-fb-drawer-title-input {
      font-family: var(--font-display); font-size: 18px; font-weight: 400;
      width: 100%; margin-top: 2px;
      background: var(--theme-bg);
      border: 1px solid var(--theme-accent);
      padding: 4px 8px; line-height: 1.25;
    }

    /* Pill row */
    .bp-fb-pill-row {
      display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
    }
    .bp-fb-pill-spacer { flex: 1; }

    /* p-dropdown rendered as a pill — shared base, normalised to 11px */
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
    .bp-fb-pill-content { display: inline-flex; align-items: center; gap: 4px; }
    .bp-fb-pill-option { display: inline-flex; align-items: center; gap: 6px; }

    /* Status pill — click to cycle; colour follows status. */
    .bp-fb-status-pill {
      height: 24px; padding: 0 10px; border-radius: 999px;
      font-size: 11px; font-weight: 500; cursor: pointer;
      border: 0.5px solid transparent; font-family: var(--font-body);
      display: inline-flex; align-items: center;
    }
    .bp-fb-status-pill[data-status="open"] {
      background: var(--color-quoted-bg); color: var(--color-quoted-text);
      border-color: var(--color-quoted-border);
    }
    .bp-fb-status-pill[data-status="in_progress"] {
      background: var(--color-waiting-bg); color: var(--color-waiting-text);
      border-color: var(--color-waiting-border);
    }
    .bp-fb-status-pill[data-status="done"] {
      background: var(--color-booked-bg); color: var(--color-booked-text);
      border-color: var(--color-booked-border);
    }
    .bp-fb-status-pill[data-status="wont_fix"] {
      background: var(--color-surface); color: var(--color-text-muted);
      border-color: var(--color-border);
    }

    /* Owner cycle pill — 11px to match siblings */
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

    /* Priority cycle pill — 11px */
    .bp-fb-priority-pill-btn {
      height: 24px; padding: 0 12px; border-radius: 999px;
      background: var(--theme-bg); color: var(--theme-accent);
      border: 0.5px solid var(--theme-accent);
      font-size: 11px; font-weight: 600; cursor: pointer;
      font-family: var(--font-body);
      display: inline-flex; align-items: center;
    }

    /* Target version pill — click to edit inline */
    .bp-fb-target-pill {
      height: 24px; padding: 0 10px; border-radius: 999px;
      background: var(--theme-bg); color: var(--theme-accent);
      border: 0.5px solid var(--theme-accent);
      display: inline-flex; align-items: center;
      font-size: 11px; font-weight: 500; cursor: pointer;
      font-family: var(--font-body);
    }
    :host ::ng-deep .bp-fb-version-input {
      width: 110px; height: 24px; font-size: 11px; padding: 0 8px;
      border-radius: 999px;
      background: var(--theme-bg); color: var(--theme-accent);
      border: 0.5px solid var(--theme-accent);
      font-family: var(--font-body);
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

    /* Notes — fills all remaining space; preview-first */
    .bp-fb-notes-cell {
      flex: 1 1 auto; min-height: 0;
      padding: 14px 16px;
      display: flex; flex-direction: column;
      border-bottom: 0.5px solid var(--color-border);
    }
    .bp-fb-notes-preview {
      flex: 1; overflow-y: auto; cursor: text;
      padding: 10px 12px; background: var(--color-surface);
      border: 0.5px solid var(--color-border); border-radius: 6px;
      min-height: 220px;
    }
    .bp-fb-notes-empty { display: flex; align-items: center; justify-content: center; }
    .bp-fb-notes-placeholder { color: var(--color-text-muted); font-size: 12px; }
    .bp-fb-notes-editor-wrap { flex: 1; display: flex; flex-direction: column; min-height: 0; }
    :host ::ng-deep .bp-fb-notes-editor-wrap app-markdown-editor {
      flex: 1; display: flex; flex-direction: column; height: 100%;
    }
    :host ::ng-deep .bp-fb-notes-editor-wrap app-markdown-editor textarea { flex: 1; }

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

  // 3-way SelectButton: Grid / List / Table — icon-only.
  viewMode: ViewMode = 'grid';
  viewModeOptions = [
    { label: 'Grid',  value: 'grid' as ViewMode,  icon: 'layout-grid' },
    { label: 'List',  value: 'list' as ViewMode,  icon: 'list' },
    { label: 'Table', value: 'table' as ViewMode, icon: 'table' }
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

  // Detail drawer state
  showDrawer = false;
  showActionDialog = false;
  selectedEntry: FeedbackEntry | null = null;

  // Right detail panel preview (separate from drawer's edit state).
  previewEntry: FeedbackEntry | null = null;
  previewHtml: SafeHtml = '';

  // Drawer edit state
  editTitle = '';
  editNotes = '';
  editNotesPreviewHtml: SafeHtml = '';
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

  // Inline-edit toggles
  titleEditing = false;
  versionEditing = false;
  notesEditing = false;

  priorityEditOptions = [
    { label: 'P1', value: 1 },
    { label: 'P2', value: 2 },
    { label: 'P3', value: 3 },
    { label: 'P4', value: 4 },
    { label: 'P5', value: 5 }
  ];

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

  areaDropdownOptions: { label: string; value: string; icon: string }[] = [];

  get addAttrMenuItems() {
    return [
      { label: 'Due date',      icon: 'pi pi-calendar', disabled: this.shownFields.has('due_date'), command: () => this.addField('due_date') },
      { label: 'Tags',          icon: 'pi pi-tag',      disabled: this.shownFields.has('tags'),     command: () => this.addField('tags') },
      { label: 'Linked folder', icon: 'pi pi-link',     disabled: this.shownFields.has('linked'),   command: () => this.addField('linked') }
    ];
  }

  constructor(
    private feedbackSvc: FeedbackService,
    private confirmSvc: ConfirmationService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {}

  catalogueLayout(): 'list' | 'card' | 'table' {
    if (this.viewMode === 'grid')  return 'card';
    if (this.viewMode === 'list')  return 'list';
    return 'table';
  }

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
        // Refresh preview if the entry was deleted/updated.
        if (this.previewEntry) {
          const refreshed = topLevel.find(e => e.id === this.previewEntry!.id);
          this.previewEntry = refreshed || null;
          this.refreshPreviewHtml();
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
      const type = this.inferType(r);
      const typeOpt = this.typeEditOptions.find(t => t.value === type);
      const firstPage = (r.pages && r.pages[0]) || r.page_url || '';
      return {
        id: r.id,
        title: r.title,
        type,
        typeLabel: typeOpt?.label || (type ? type.charAt(0).toUpperCase() + type.slice(1) : '—'),
        typeIcon: typeOpt?.icon || this.getTypeIcon(r),
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
        _raw: r
      };
    });
    this.selectedIds.clear();
    this.cdr.detectChanges();
  }

  onTableRowClick(row: any) {
    // Preview in the right panel AND open the drawer for editing.
    const entity = this.allEntities.find(e => e.id === row.id);
    if (!entity) return;
    this.setPreview(entity._raw as FeedbackEntry);
    this.onEntitySelected(entity);
  }

  onEntitySelectedById(id: string) {
    const entity = this.allEntities.find(e => e.id === id);
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

  // Single click in catalogue-grid (any layout) — populate the right panel.
  // Folders still route to their dedicated page.
  onEntityPreview(entity: CatalogueEntity) {
    const raw = entity._raw as FeedbackEntry | undefined;
    if (raw?.object_type === 'folder') {
      window.open('/folder/' + raw.id, '_blank');
      return;
    }
    if (raw) this.setPreview(raw);
  }

  private setPreview(raw: FeedbackEntry) {
    this.previewEntry = raw;
    this.refreshPreviewHtml();
    this.cdr.detectChanges();
  }

  private refreshPreviewHtml() {
    if (!this.previewEntry?.notes) {
      this.previewHtml = '';
      return;
    }
    const html = marked.parse(this.previewEntry.notes, { async: false }) as string;
    this.previewHtml = this.sanitizer.bypassSecurityTrustHtml(html);
  }

  // "View" action (button in built-in catalogue detail) → drawer.
  onEntitySelected(entity: CatalogueEntity) {
    this.selectedEntry = entity._raw || this.entries.find(e => e.id === entity.id) || null;
    if (this.selectedEntry) {
      if (this.selectedEntry.event_date) {
        window.open('/folder/' + this.selectedEntry.id, '_blank');
        return;
      }
      const e = this.selectedEntry;
      this.editTitle = e.title;
      this.editNotes = e.notes || '';
      this.refreshNotesPreviewHtml();
      this.editOwner = e.owner || '';
      this.editStatus = e.status || 'open';
      this.editType = this.inferType(e);
      this.editTags = e.tags || [];
      this.editPriority = e.priority ?? null;
      this.editTargetVersion = e.target_version || null;
      this.editAreaCategoryId = e.area_category_id || null;
      this.editPages = (e.pages && e.pages.length)
        ? [...e.pages]
        : (e.page_url ? [e.page_url] : []);
      this.editDueDate = e.due_date ? new Date(e.due_date) : null;
      this.newPageInput = '';
      this.shownFields = new Set<OptionalField>();
      if (e.due_date)        this.shownFields.add('due_date');
      if (e.tags?.length)    this.shownFields.add('tags');
      this.titleEditing = false;
      this.versionEditing = false;
      this.notesEditing = false;
      this.isDirty = false;
      this.showDrawer = true;
      this.cdr.detectChanges();
    }
  }

  markDirty() { this.isDirty = true; }

  // ── Inline title edit ───────────────────────────────────────────────────
  startTitleEdit() {
    this.titleEditing = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('.bp-fb-drawer-title-input');
      el?.focus();
      el?.select();
    });
  }
  finishTitleEdit() {
    if (!this.editTitle?.trim()) {
      this.editTitle = this.selectedEntry?.title || '';
    }
    this.titleEditing = false;
    this.markDirty();
  }
  cancelTitleEdit() {
    this.editTitle = this.selectedEntry?.title || '';
    this.titleEditing = false;
  }

  // ── Inline version edit ─────────────────────────────────────────────────
  startVersionEdit() {
    this.versionEditing = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('.bp-fb-version-input');
      el?.focus();
      el?.select();
    });
  }
  finishVersionEdit() {
    this.editTargetVersion = this.editTargetVersion?.trim() || null;
    this.versionEditing = false;
    this.markDirty();
  }
  cancelVersionEdit() {
    this.editTargetVersion = this.selectedEntry?.target_version || null;
    this.versionEditing = false;
  }

  // ── Notes preview/edit toggle ───────────────────────────────────────────
  startNotesEdit() {
    this.notesEditing = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      const el = document.querySelector<HTMLTextAreaElement>('.bp-fb-notes-editor-wrap textarea');
      el?.focus();
    });
  }
  onNotesChange(v: string) {
    this.editNotes = v;
    this.refreshNotesPreviewHtml();
    this.markDirty();
  }
  // focusout fires before the next focusin lands; we wait a tick so clicking
  // a toolbar button inside the editor doesn't bounce us back to preview.
  onNotesBlur(ev: FocusEvent) {
    const next = ev.relatedTarget as HTMLElement | null;
    const wrap = (ev.currentTarget as HTMLElement);
    if (next && wrap.contains(next)) return;
    setTimeout(() => {
      const active = document.activeElement;
      if (active && wrap.contains(active)) return;
      this.notesEditing = false;
      this.cdr.detectChanges();
    }, 50);
  }
  private refreshNotesPreviewHtml() {
    if (!this.editNotes) {
      this.editNotesPreviewHtml = '';
      return;
    }
    const html = marked.parse(this.editNotes, { async: false }) as string;
    this.editNotesPreviewHtml = this.sanitizer.bypassSecurityTrustHtml(html);
  }

  // ── Pill cycling ────────────────────────────────────────────────────────
  cycleStatus() {
    const i = STATUS_CYCLE.indexOf(this.editStatus as any);
    this.editStatus = STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length];
    this.markDirty();
  }
  statusLabel(s: string): string {
    return this.statusEditOptions.find(o => o.value === s)?.label || s;
  }
  cyclePriority() {
    const cur = this.editPriority ?? 0;
    this.editPriority = cur >= 5 || cur < 1 ? 1 : cur + 1;
    this.markDirty();
  }
  cycleOwner() {
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

  typeEyebrow(): string {
    const opt = this.typeEditOptions.find(t => t.value === this.editType);
    return (opt?.label || this.editType || 'feedback').toUpperCase();
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
    this.titleEditing = false;
    this.versionEditing = false;
    this.notesEditing = false;
    this.shownFields.clear();
    this.cdr.detectChanges();
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
