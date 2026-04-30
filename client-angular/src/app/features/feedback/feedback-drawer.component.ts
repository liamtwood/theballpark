import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

import { SidebarModule } from 'primeng/sidebar';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { ChipsModule } from 'primeng/chips';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

import {
  FeedbackService, FeedbackEntry, FeedbackCategory, TestCase, TEAM_MEMBERS
} from '../../core/services/feedback.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { MarkdownEditorComponent } from '../../shared/components/markdown-editor/markdown-editor.component';

type TabId = 'notes' | 'test' | 'attributes';

const TYPE_CYCLE = ['prompt', 'bug', 'enhancement', 'question', 'note'] as const;
const ISSUE_STATUS_CYCLE = ['open', 'in_progress', 'done', 'wont_fix'] as const;
const TEST_CASE_STATUS_CYCLE = ['todo', 'pass', 'fail', 'skip'] as const;

@Component({
  selector: 'app-feedback-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ConfirmationService, MessageService],
  imports: [
    CommonModule, FormsModule, LucideAngularModule,
    SidebarModule, DropdownModule, InputTextModule, ChipsModule,
    ButtonModule, ToastModule, ConfirmDialogModule,
    AvatarComponent, MarkdownEditorComponent
  ],
  template: `
    <p-sidebar
      [(visible)]="visible"
      (visibleChange)="onVisibleChange($event)"
      position="right"
      styleClass="bp-drawer bp-fbd"
      [style]="{width:'480px'}"
      [showCloseIcon]="false"
      (onHide)="onHide()">

      <ng-template pTemplate="header">
        <ng-container *ngIf="entry">
          <div class="bp-fbd-head">
            <!-- Row 1: type pill + close -->
            <div class="bp-fbd-row1">
              <button *ngIf="!isTestCase()" type="button"
                class="bp-fbd-type-pill"
                (click)="cycleType()" title="Click to change type">
                {{ typeLabel(editType) }}
              </button>
              <span *ngIf="isTestCase()" class="bp-fbd-type-pill bp-fbd-type-pill--ro">
                Test Case
              </span>
              <span class="bp-fbd-spacer"></span>
              <button type="button" class="bp-fbd-close" (click)="close()" title="Close">✕</button>
            </div>

            <!-- Row 2: contenteditable title -->
            <div #titleEl
              class="bp-fbd-title"
              contenteditable="true"
              spellcheck="false"
              (blur)="commitTitle()"
              (keydown.enter)="$event.preventDefault(); titleEl.blur()">{{ editTitle }}</div>

            <!-- Row 3: status, owner, priority + version -->
            <div class="bp-fbd-pills">
              <button type="button" class="bp-fbd-status-pill"
                [attr.data-status]="editStatus" (click)="cycleStatus()">
                {{ statusLabel(editStatus) }}
              </button>
              <button type="button" class="bp-fbd-owner-pill" (click)="cycleOwner()">
                <span class="bp-fbd-owner-init">{{ ownerInitials() }}</span>
                <span>{{ editOwner || 'Owner' }}</span>
              </button>
              <button type="button" class="bp-fbd-priority-pill"
                *ngIf="!isTestCase()" (click)="cyclePriority()">
                {{ editPriority ? 'P' + editPriority : 'P—' }}
              </button>

              <span class="bp-fbd-spacer"></span>

              <ng-container *ngIf="!versionEditing">
                <button type="button" class="bp-fbd-version-pill" (click)="startVersionEdit()">
                  {{ versionPillText() }}
                </button>
              </ng-container>
              <ng-container *ngIf="versionEditing">
                <input #versionInput
                  pInputText
                  class="bp-fbd-version-input"
                  [(ngModel)]="versionDraft"
                  (blur)="commitVersion()"
                  (keydown.enter)="commitVersion()"
                  (keydown.escape)="cancelVersionEdit()"
                  list="bp-fbd-versions"
                  placeholder="v2.0"/>
                <datalist id="bp-fbd-versions">
                  <option *ngFor="let v of versions" [value]="v"></option>
                </datalist>
              </ng-container>
            </div>
          </div>

          <!-- Tab strip -->
          <div class="bp-fbd-tabs">
            <button type="button" class="bp-fbd-tab"
              [class.bp-fbd-tab--active]="activeTab === 'notes'"
              (click)="activeTab = 'notes'">Notes</button>
            <button type="button" class="bp-fbd-tab"
              *ngIf="showTestTab()"
              [class.bp-fbd-tab--active]="activeTab === 'test'"
              (click)="activeTab = 'test'">
              Test
              <span *ngIf="testCases.length" class="bp-fbd-tab-count">{{ testCases.length }}</span>
            </button>
            <button type="button" class="bp-fbd-tab"
              [class.bp-fbd-tab--active]="activeTab === 'attributes'"
              (click)="activeTab = 'attributes'">Attributes</button>
          </div>
        </ng-container>
      </ng-template>

      <!-- BODY -->
      <div class="bp-fbd-body" *ngIf="entry">
          <!-- ── Notes ── -->
          <ng-container *ngIf="activeTab === 'notes'">
            <ng-container *ngIf="!notesEditing">
              <div class="bp-md-preview bp-fbd-notes-preview"
                [innerHTML]="notesHtml"
                (click)="startNotesEdit()" title="Click to edit">
                <span *ngIf="!editNotes" class="bp-fbd-notes-placeholder">
                  Click to add notes…
                </span>
              </div>
            </ng-container>
            <div *ngIf="notesEditing" class="bp-fbd-notes-editor"
              (focusout)="onNotesFocusOut($event)">
              <app-markdown-editor
                [value]="editNotes"
                (valueChange)="onNotesChange($event)"
                [rows]="10"
                [showLabel]="false"
                placeholder="Add notes, specs, requirements...">
              </app-markdown-editor>
              <div class="bp-fbd-notes-done">
                <button type="button" class="bp-fbd-done-btn" (click)="finishNotesEdit()">
                  Done
                </button>
              </div>
            </div>
            <div class="bp-fbd-meta">
              Logged by {{ entry.submitted_by || 'Unknown' }} ·
              {{ formatDate(entry.created_at) }}
            </div>
          </ng-container>

          <!-- ── Test ── -->
          <ng-container *ngIf="activeTab === 'test' && showTestTab()">
            <div *ngIf="!testCases.length" class="bp-fbd-tc-empty">
              No test cases yet
            </div>
            <div *ngFor="let tc of testCases" class="bp-fbd-tc-row">
              <span class="bp-fbd-tc-status" [attr.data-status]="tc.status">
                <lucide-icon [name]="tcIcon(tc.status)" [size]="12"></lucide-icon>
              </span>
              <app-avatar *ngIf="tc.owner" [name]="tc.owner" [size]="20"></app-avatar>
              <div class="bp-fbd-tc-body">
                <div class="bp-fbd-tc-meta">
                  <span class="bp-fbd-tc-date">{{ formatTcDate(tc.created_at) }}</span>
                </div>
                <div class="bp-fbd-tc-notes">{{ tc.notes }}</div>
              </div>
            </div>

            <div class="bp-fbd-tc-divider"></div>
            <label class="bp-fbd-section-label">ADD TEST CASE</label>
            <textarea class="bp-fbd-tc-textarea"
              [(ngModel)]="addTcNotes" rows="3"
              placeholder="What did you test and what happened?"></textarea>
            <div class="bp-fbd-tc-controls">
              <div class="bp-fbd-tc-owners">
                <button *ngFor="let m of team" type="button"
                  class="bp-fbd-tc-owner"
                  [class.bp-fbd-tc-owner--active]="addTcOwner === m.initials"
                  (click)="addTcOwner = m.initials">{{ m.initials }}</button>
              </div>
              <div class="bp-fbd-tc-results">
                <button type="button"
                  class="bp-fbd-tc-result bp-fbd-tc-result--todo"
                  [class.bp-fbd-tc-result--active]="addTcResult === 'todo'"
                  (click)="addTcResult = 'todo'">
                  <lucide-icon name="circle" [size]="11"></lucide-icon> To Do
                </button>
                <button type="button"
                  class="bp-fbd-tc-result bp-fbd-tc-result--pass"
                  [class.bp-fbd-tc-result--active]="addTcResult === 'pass'"
                  (click)="addTcResult = 'pass'">
                  <lucide-icon name="check" [size]="11"></lucide-icon> Pass
                </button>
                <button type="button"
                  class="bp-fbd-tc-result bp-fbd-tc-result--fail"
                  [class.bp-fbd-tc-result--active]="addTcResult === 'fail'"
                  (click)="addTcResult = 'fail'">
                  <lucide-icon name="x" [size]="11"></lucide-icon> Fail
                </button>
                <button type="button"
                  class="bp-fbd-tc-result bp-fbd-tc-result--skip"
                  [class.bp-fbd-tc-result--active]="addTcResult === 'skip'"
                  (click)="addTcResult = 'skip'">
                  <lucide-icon name="minus" [size]="11"></lucide-icon> Skip
                </button>
                <button type="button" class="bp-fbd-tc-add-btn bp-btn-save"
                  [disabled]="!addTcNotes.trim() || !addTcResult"
                  (click)="submitTestCase()">Add</button>
              </div>
            </div>
          </ng-container>

          <!-- ── Attributes ── -->
          <ng-container *ngIf="activeTab === 'attributes'">
            <h4 class="bp-fbd-group">Classification</h4>
            <div class="bp-fbd-attr">
              <label class="bp-fbd-attr-label">Type</label>
              <p-dropdown [(ngModel)]="editType" [options]="typeOptions"
                optionLabel="label" optionValue="value"
                (onChange)="markDirty()" styleClass="bp-fbd-dd"></p-dropdown>
            </div>
            <div class="bp-fbd-attr">
              <label class="bp-fbd-attr-label">Area</label>
              <p-dropdown [(ngModel)]="editAreaCategoryId" [options]="areaOptions"
                optionLabel="label" optionValue="value" [showClear]="true"
                (onChange)="markDirty()" styleClass="bp-fbd-dd"></p-dropdown>
            </div>
            <div class="bp-fbd-attr">
              <label class="bp-fbd-attr-label">Environment</label>
              <p-dropdown [(ngModel)]="editEnvironment" [options]="envOptions"
                optionLabel="label" optionValue="value"
                (onChange)="markDirty()" styleClass="bp-fbd-dd"></p-dropdown>
            </div>

            <h4 class="bp-fbd-group">Planning</h4>
            <div class="bp-fbd-attr">
              <label class="bp-fbd-attr-label">Status</label>
              <p-dropdown [(ngModel)]="editStatus" [options]="statusOptionsForType()"
                optionLabel="label" optionValue="value"
                (onChange)="markDirty()" styleClass="bp-fbd-dd"></p-dropdown>
            </div>
            <div class="bp-fbd-attr" *ngIf="!isTestCase()">
              <label class="bp-fbd-attr-label">Priority</label>
              <p-dropdown [(ngModel)]="editPriority" [options]="priorityOptions"
                optionLabel="label" optionValue="value" [showClear]="true"
                (onChange)="markDirty()" styleClass="bp-fbd-dd"></p-dropdown>
            </div>
            <div class="bp-fbd-attr">
              <label class="bp-fbd-attr-label">Owner</label>
              <p-dropdown [(ngModel)]="editOwner" [options]="ownerOptions"
                optionLabel="label" optionValue="value" [showClear]="true"
                (onChange)="markDirty()" styleClass="bp-fbd-dd"></p-dropdown>
            </div>
            <div class="bp-fbd-attr">
              <label class="bp-fbd-attr-label">Due date</label>
              <input pInputText [(ngModel)]="editDueDate"
                placeholder="dd MMM yyyy"
                (input)="markDirty()" class="bp-fbd-input"/>
            </div>

            <h4 class="bp-fbd-group">Version</h4>
            <div class="bp-fbd-attr">
              <label class="bp-fbd-attr-label">Target version</label>
              <input list="bp-fbd-versions-attr" pInputText
                [(ngModel)]="editTargetVersion"
                placeholder="e.g. v2.0"
                (input)="markDirty()" class="bp-fbd-input"/>
            </div>
            <ng-container *ngIf="editStatus === 'done'">
              <div class="bp-fbd-attr">
                <label class="bp-fbd-attr-label">Shipped version</label>
                <input list="bp-fbd-versions-attr" pInputText
                  [(ngModel)]="editVersion" placeholder="—"
                  (input)="markDirty()" class="bp-fbd-input"/>
              </div>
              <div class="bp-fbd-attr">
                <label class="bp-fbd-attr-label">Shipped date</label>
                <input pInputText [(ngModel)]="editShippedDate"
                  placeholder="dd MMM yyyy"
                  (input)="markDirty()" class="bp-fbd-input"/>
              </div>
            </ng-container>
            <datalist id="bp-fbd-versions-attr">
              <option *ngFor="let v of versions" [value]="v"></option>
            </datalist>

            <h4 class="bp-fbd-group">Context</h4>
            <div class="bp-fbd-attr bp-fbd-attr--block">
              <label class="bp-fbd-attr-label">Pages</label>
              <div class="bp-fbd-pages">
                <div *ngFor="let p of editPages; let i = index" class="bp-fbd-page-row">
                  <span class="bp-fbd-page-url" [title]="p">{{ p }}</span>
                  <button type="button" class="bp-fbd-page-x" (click)="removePage(i)">
                    <i class="pi pi-times"></i>
                  </button>
                </div>
                <input pInputText [(ngModel)]="newPageInput"
                  placeholder="add page url..."
                  (keydown.enter)="addPage()"
                  class="bp-fbd-input"/>
              </div>
            </div>
            <div class="bp-fbd-attr bp-fbd-attr--block">
              <label class="bp-fbd-attr-label">Tags</label>
              <p-chips [(ngModel)]="editTags" placeholder="add tag..."
                [addOnBlur]="true"
                (ngModelChange)="markDirty()"
                styleClass="bp-fbd-chips"></p-chips>
            </div>

            <h4 class="bp-fbd-group">Meta</h4>
            <div class="bp-fbd-attr">
              <label class="bp-fbd-attr-label">Logged by</label>
              <span class="bp-fbd-readonly">{{ entry.submitted_by || '—' }}</span>
            </div>
            <div class="bp-fbd-attr">
              <label class="bp-fbd-attr-label">Submitted</label>
              <span class="bp-fbd-readonly">{{ formatDate(entry.created_at) }}</span>
            </div>
          </ng-container>
        </div>

      <ng-template pTemplate="footer">
        <div class="bp-fbd-footer" *ngIf="entry">
          <p-button label="Delete" styleClass="p-button-text bp-fbd-delete"
            (onClick)="confirmDelete()"></p-button>
          <span class="bp-fbd-spacer"></span>
          <p-button label="Cancel" styleClass="p-button-outlined"
            (onClick)="close()"></p-button>
          <p-button label="Save" styleClass="bp-btn-save"
            [disabled]="!isDirty"
            (onClick)="save()"></p-button>
        </div>
      </ng-template>
    </p-sidebar>

    <p-confirmDialog></p-confirmDialog>
    <p-toast></p-toast>
  `,
  styles: [`
    /* ── Sidebar shell ── */
    :host ::ng-deep .bp-fbd .p-sidebar-header {
      padding: 0 !important;
      background: var(--theme-bg);
      border-bottom: 0.5px solid var(--theme-border, var(--color-border));
    }
    :host ::ng-deep .bp-fbd .p-sidebar-content {
      display: flex; flex-direction: column;
      padding: 0 !important; height: 100%; min-height: 0;
    }

    /* ── Header (parchment) ── */
    .bp-fbd-head {
      padding: 14px 18px 12px;
      background: var(--theme-bg);
      width: 100%;
    }
    .bp-fbd-row1 {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 8px;
    }
    .bp-fbd-spacer { flex: 1; }
    .bp-fbd-type-pill {
      height: 22px; padding: 0 10px; border-radius: 999px;
      background: var(--theme-bg);
      color: var(--theme-accent);
      border: 0.5px solid var(--theme-accent);
      font-size: 11px; font-weight: 600;
      font-family: var(--font-body); cursor: pointer;
      display: inline-flex; align-items: center;
    }
    .bp-fbd-type-pill--ro { cursor: default; }
    .bp-fbd-close {
      width: 26px; height: 26px; border-radius: 4px;
      background: transparent; border: none; cursor: pointer;
      color: var(--color-text-muted);
      font-size: 14px;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .bp-fbd-close:hover {
      background: var(--theme-bg);
      color: var(--theme-accent);
    }

    .bp-fbd-title {
      font-family: var(--font-display);
      font-size: 16px; font-weight: 400; line-height: 1.3;
      color: var(--color-text-primary);
      padding: 4px 2px;
      border-bottom: 0.5px solid transparent;
      margin-bottom: 10px;
      outline: none;
    }
    .bp-fbd-title:focus {
      border-bottom-color: var(--theme-border, var(--color-border));
    }

    .bp-fbd-pills {
      display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
    }
    .bp-fbd-status-pill,
    .bp-fbd-owner-pill,
    .bp-fbd-priority-pill,
    .bp-fbd-version-pill {
      height: 22px; padding: 0 10px; border-radius: 999px;
      font-size: 11px; font-weight: 500; cursor: pointer;
      font-family: var(--font-body);
      display: inline-flex; align-items: center; gap: 5px;
      border: 0.5px solid transparent;
    }
    .bp-fbd-status-pill[data-status="open"] {
      background: var(--color-quoted-bg); color: var(--color-quoted-text);
      border-color: var(--color-quoted-border);
    }
    .bp-fbd-status-pill[data-status="in_progress"] {
      background: var(--color-waiting-bg); color: var(--color-waiting-text);
      border-color: var(--color-waiting-border);
    }
    .bp-fbd-status-pill[data-status="done"] {
      background: var(--color-booked-bg); color: var(--color-booked-text);
      border-color: var(--color-booked-border);
    }
    .bp-fbd-status-pill[data-status="wont_fix"] {
      background: var(--color-surface); color: var(--color-text-muted);
      border-color: var(--color-border);
    }
    .bp-fbd-status-pill[data-status="pass"] {
      background: var(--color-booked-bg); color: var(--color-booked-text);
      border-color: var(--color-booked-border);
    }
    .bp-fbd-status-pill[data-status="fail"] {
      background: var(--color-danger-bg); color: var(--color-danger-text);
      border-color: var(--color-danger-border, var(--color-danger-text));
    }
    .bp-fbd-status-pill[data-status="skip"] {
      background: var(--color-surface); color: var(--color-text-muted);
      border-color: var(--color-border);
    }
    .bp-fbd-status-pill[data-status="todo"] {
      background: var(--theme-bg); color: var(--theme-accent);
      border-color: var(--theme-accent);
    }

    .bp-fbd-owner-pill {
      background: var(--theme-bg); color: var(--theme-accent);
      border-color: var(--theme-accent);
      padding-left: 2px;
    }
    .bp-fbd-owner-init {
      width: 18px; height: 18px; border-radius: 50%;
      background: var(--theme-accent); color: #fff;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 9px; font-weight: 700; letter-spacing: 0.02em;
    }
    .bp-fbd-priority-pill {
      background: var(--theme-bg); color: var(--theme-accent);
      border-color: var(--theme-accent); font-weight: 600;
    }
    .bp-fbd-version-pill {
      background: var(--theme-bg); color: var(--theme-accent);
      border-color: var(--theme-accent);
    }
    :host ::ng-deep .bp-fbd-version-input {
      width: 130px; height: 22px; padding: 0 8px;
      border-radius: 999px; font-size: 11px;
      background: var(--theme-bg); color: var(--theme-accent);
      border: 0.5px solid var(--theme-accent);
      font-family: var(--font-body);
    }

    /* ── Tabs ── */
    .bp-fbd-tabs {
      display: flex; padding: 0 18px;
      background: var(--color-surface);
      border-bottom: 0.5px solid var(--color-border);
      width: 100%;
    }
    .bp-fbd-tab {
      padding: 9px 14px;
      background: none; border: none;
      font-family: var(--font-body); font-size: 12px;
      font-weight: 500;
      color: var(--color-text-muted);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -0.5px;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .bp-fbd-tab:hover { color: var(--color-text-primary); }
    .bp-fbd-tab--active {
      color: var(--theme-accent);
      border-bottom-color: var(--theme-accent);
    }
    .bp-fbd-tab-count {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px;
      background: var(--theme-bg); color: var(--theme-accent);
      font-size: 10px; font-weight: 700;
    }

    /* ── Body ── */
    .bp-fbd-body {
      flex: 1 1 auto; min-height: 0; overflow-y: auto;
      padding: 14px 18px;
    }

    /* ── Notes ── */
    .bp-fbd-notes-preview {
      cursor: text; min-height: 220px;
      padding: 6px 0;
      color: var(--color-text-primary);
    }
    .bp-fbd-notes-placeholder {
      color: var(--color-text-muted); font-size: 12px; font-style: italic;
    }
    .bp-fbd-notes-editor {
      display: flex; flex-direction: column; gap: 6px;
    }
    :host ::ng-deep .bp-fbd-notes-editor app-markdown-editor textarea {
      font-family: var(--font-sans) !important;
    }
    .bp-fbd-notes-done {
      display: flex; justify-content: flex-end;
    }
    .bp-fbd-done-btn {
      padding: 4px 12px; border-radius: 6px; font-size: 11px;
      background: var(--theme-accent); color: #fff;
      border: 1px solid var(--theme-accent); cursor: pointer;
      font-family: var(--font-body);
    }
    .bp-fbd-meta {
      margin-top: 14px; font-size: 11px;
      color: var(--color-text-secondary);
    }

    /* ── Test ── */
    .bp-fbd-tc-empty {
      font-size: 12px; font-style: italic;
      color: var(--color-text-muted);
      padding: 8px 0;
    }
    .bp-fbd-tc-row {
      display: flex; gap: 8px; align-items: flex-start;
      padding: 8px 0;
      border-bottom: 0.5px solid var(--color-border);
    }
    .bp-fbd-tc-status {
      width: 18px; height: 18px; border-radius: 999px;
      display: inline-flex; align-items: center; justify-content: center;
      flex-shrink: 0; margin-top: 1px;
    }
    .bp-fbd-tc-status[data-status="pass"] {
      background: var(--color-booked-bg); color: var(--color-booked-text);
      border: 0.5px solid var(--color-booked-border);
    }
    .bp-fbd-tc-status[data-status="fail"] {
      background: var(--color-danger-bg); color: var(--color-danger-text);
      border: 0.5px solid var(--color-danger-border, var(--color-danger-text));
    }
    .bp-fbd-tc-status[data-status="skip"] {
      background: var(--color-surface); color: var(--color-text-muted);
      border: 0.5px solid var(--color-border);
    }
    .bp-fbd-tc-status[data-status="todo"] {
      background: var(--theme-bg); color: var(--theme-accent);
      border: 0.5px solid var(--theme-accent);
    }
    .bp-fbd-tc-body { flex: 1; min-width: 0; }
    .bp-fbd-tc-meta {
      display: flex; justify-content: flex-end; align-items: center;
    }
    .bp-fbd-tc-date {
      font-size: 11px; color: var(--color-text-muted);
    }
    .bp-fbd-tc-notes {
      font-size: 12px; line-height: 1.5;
      color: var(--color-text-primary);
      margin-top: 2px; white-space: pre-wrap;
    }
    .bp-fbd-tc-divider {
      border-top: 0.5px solid var(--color-border);
      margin: 12px 0 10px;
    }
    .bp-fbd-section-label {
      display: block; font-size: 10px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.06em;
      color: var(--color-text-muted); margin-bottom: 6px;
    }
    .bp-fbd-tc-textarea {
      width: 100%;
      font-family: var(--font-sans);
      font-size: 12px; padding: 8px;
      border: 0.5px solid var(--color-border);
      border-radius: var(--border-radius-md, 6px);
      background: var(--color-background-secondary, var(--color-surface));
      color: var(--color-text-primary);
      resize: vertical;
      margin-bottom: 8px;
    }
    .bp-fbd-tc-textarea:focus {
      outline: none; border-color: var(--theme-accent);
    }
    .bp-fbd-tc-controls {
      display: flex; justify-content: space-between; align-items: center;
      gap: 8px; flex-wrap: wrap;
    }
    .bp-fbd-tc-owners { display: flex; gap: 4px; }
    .bp-fbd-tc-owner {
      width: 22px; height: 22px; border-radius: 50%;
      border: 0.5px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-secondary);
      cursor: pointer; font-family: var(--font-body);
      font-size: 9px; font-weight: 700;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .bp-fbd-tc-owner--active {
      background: var(--theme-bg); color: var(--theme-accent);
      border: 1.5px solid var(--theme-accent);
    }
    .bp-fbd-tc-results {
      display: flex; gap: 4px; align-items: center; flex-wrap: wrap;
    }
    .bp-fbd-tc-result {
      display: inline-flex; align-items: center; gap: 3px;
      height: 22px; padding: 0 8px; border-radius: 999px;
      border: 0.5px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-muted);
      font-size: 10px; font-weight: 600; cursor: pointer;
      font-family: var(--font-body);
    }
    .bp-fbd-tc-result--pass.bp-fbd-tc-result--active {
      background: var(--color-booked-bg); color: var(--color-booked-text);
      border: 1.5px solid var(--color-booked-border);
    }
    .bp-fbd-tc-result--fail.bp-fbd-tc-result--active {
      background: var(--color-danger-bg); color: var(--color-danger-text);
      border: 1.5px solid var(--color-danger-border, var(--color-danger-text));
    }
    .bp-fbd-tc-result--skip.bp-fbd-tc-result--active {
      background: var(--color-background-secondary, var(--color-surface));
      color: var(--color-text-muted);
      border: 1.5px solid var(--color-border);
    }
    .bp-fbd-tc-result--todo.bp-fbd-tc-result--active {
      background: var(--theme-bg); color: var(--theme-accent);
      border: 1.5px solid var(--theme-accent);
    }
    .bp-fbd-tc-add-btn {
      padding: 4px 14px; font-size: 11px; height: 24px;
      margin-left: 4px;
      display: inline-flex; align-items: center; justify-content: center;
      line-height: 1;
    }

    /* ── Attributes ── */
    .bp-fbd-group {
      margin: 0 0 8px; padding-top: 14px;
      font-size: 10px; font-weight: 600;
      color: var(--theme-accent);
      text-transform: uppercase; letter-spacing: 0.06em;
    }
    .bp-fbd-group:first-child { padding-top: 0; }
    .bp-fbd-attr {
      display: grid; grid-template-columns: 110px 1fr;
      gap: 10px; align-items: center; padding: 4px 0;
    }
    .bp-fbd-attr--block {
      grid-template-columns: 110px 1fr;
      align-items: flex-start;
    }
    .bp-fbd-attr-label {
      font-size: 11px; color: var(--color-text-secondary);
      font-family: var(--font-body);
    }
    .bp-fbd-readonly {
      font-size: 12px; color: var(--color-text-primary);
      font-family: var(--font-body);
    }
    :host ::ng-deep .bp-fbd-dd .p-dropdown {
      width: 100%; height: 28px;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
    }
    :host ::ng-deep .bp-fbd-dd .p-dropdown .p-dropdown-label {
      font-size: 12px; padding: 0 8px;
      display: inline-flex; align-items: center;
    }
    :host ::ng-deep .bp-fbd-input {
      width: 100%; height: 28px; padding: 0 8px;
      font-size: 12px;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      border-radius: 4px;
      font-family: var(--font-body);
    }
    .bp-fbd-pages {
      display: flex; flex-direction: column; gap: 4px;
    }
    .bp-fbd-page-row {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; padding: 2px 0;
    }
    .bp-fbd-page-url {
      flex: 1; color: var(--color-text-primary);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .bp-fbd-page-x {
      width: 18px; height: 18px;
      border: none; background: none;
      color: var(--color-text-muted); cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
    }
    :host ::ng-deep .bp-fbd-chips .p-chips,
    :host ::ng-deep .bp-fbd-chips .p-inputtext {
      width: 100%; min-height: 28px;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      font-size: 12px;
    }

    /* ── Footer ── */
    :host ::ng-deep .bp-fbd .p-sidebar-footer {
      padding: 12px 18px;
      background: var(--color-surface);
      border-top: 0.5px solid var(--color-border);
    }
    .bp-fbd-footer {
      display: flex; align-items: center; gap: 8px; width: 100%;
    }
    :host ::ng-deep .bp-fbd-delete .p-button {
      color: var(--color-danger-text) !important;
    }
  `]
})
export class FeedbackDrawerComponent implements OnChanges {
  @Input() entry: FeedbackEntry | null = null;
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<FeedbackEntry>();
  @Output() deleted = new EventEmitter<string>();

  @ViewChild('titleEl') titleEl?: ElementRef<HTMLDivElement>;
  @ViewChild('versionInput') versionInput?: ElementRef<HTMLInputElement>;

  team = TEAM_MEMBERS;
  versions: string[] = [];
  areaOptions: { label: string; value: string }[] = [];

  // ── Edit state ──
  editTitle = '';
  editType = 'bug';
  editStatus = 'open';
  editOwner: string | null = null;
  editPriority: number | null = null;
  editTargetVersion: string | null = null;
  editVersion: string | null = null;
  editShippedDate: string | null = null;
  editDueDate: string | null = null;
  editAreaCategoryId: string | null = null;
  editEnvironment = 'preview';
  editTags: string[] = [];
  editPages: string[] = [];
  editNotes = '';
  newPageInput = '';

  // ── UI state ──
  activeTab: TabId = 'notes';
  notesEditing = false;
  versionEditing = false;
  versionDraft = '';
  notesHtml: SafeHtml = '';
  isDirty = false;

  // Test cases
  testCases: TestCase[] = [];
  addTcNotes = '';
  addTcOwner = 'LW';
  addTcResult: 'todo' | 'pass' | 'fail' | 'skip' | null = null;

  typeOptions = [
    { label: 'Prompt',      value: 'prompt' },
    { label: 'Bug',         value: 'bug' },
    { label: 'Enhancement', value: 'enhancement' },
    { label: 'Question',    value: 'question' },
    { label: 'Note',        value: 'note' }
  ];
  envOptions = [
    { label: 'Dev',     value: 'dev' },
    { label: 'Preview', value: 'preview' },
    { label: 'Master',  value: 'master' }
  ];
  priorityOptions = [
    { label: 'P1', value: 1 }, { label: 'P2', value: 2 },
    { label: 'P3', value: 3 }, { label: 'P4', value: 4 },
    { label: 'P5', value: 5 }
  ];
  ownerOptions = TEAM_MEMBERS.map(m => ({ label: `${m.initials} – ${m.name}`, value: m.initials }));

  constructor(
    private feedbackSvc: FeedbackService,
    private confirmSvc: ConfirmationService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {
    this.feedbackSvc.getVersions().subscribe(v => {
      this.versions = (v || []).filter(Boolean);
      this.cdr.markForCheck();
    });
    this.feedbackSvc.getFeedbackCategories('area').subscribe(cats => {
      this.areaOptions = (cats || [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(c => ({ label: c.name, value: c.id }));
      this.cdr.markForCheck();
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['entry'] || changes['visible']) && this.visible && this.entry) {
      this.hydrate(this.entry);
      this.loadTestCases();
    }
  }

  // ── Hydration ──
  private hydrate(e: FeedbackEntry) {
    this.editTitle = e.title || '';
    this.editType = e.type || (e.object_type === 'note' ? 'note' : 'bug');
    this.editStatus = e.status || 'open';
    this.editOwner = e.owner || null;
    this.editPriority = e.priority ?? null;
    this.editTargetVersion = e.target_version || null;
    this.editVersion = e.version || null;
    this.editShippedDate = e.shipped_date || null;
    this.editDueDate = e.due_date || null;
    this.editAreaCategoryId = e.area_category_id || null;
    this.editEnvironment = e.environment || 'preview';
    this.editTags = [...(e.tags || [])];
    this.editPages = [...(e.pages || (e.page_url ? [e.page_url] : []))];
    this.editNotes = e.notes || '';
    this.refreshNotesHtml();
    this.activeTab = 'notes';
    this.notesEditing = false;
    this.versionEditing = false;
    this.isDirty = false;
    this.addTcNotes = '';
    this.addTcResult = null;
  }

  private loadTestCases() {
    if (!this.entry) return;
    if ((this.entry as any).test_cases) {
      this.testCases = (this.entry as any).test_cases;
      this.cdr.markForCheck();
      return;
    }
    this.feedbackSvc.getTestCases(this.entry.id).subscribe({
      next: tcs => { this.testCases = tcs || []; this.cdr.markForCheck(); },
      error: () => { this.testCases = []; this.cdr.markForCheck(); }
    });
  }

  // ── Visibility ──
  onVisibleChange(v: boolean) {
    this.visible = v;
    this.visibleChange.emit(v);
  }
  onHide() { this.visibleChange.emit(false); }
  close() { this.onVisibleChange(false); }

  // ── Helpers ──
  isTestCase(): boolean { return this.editType === 'test_case'; }
  showTestTab(): boolean {
    return ['bug', 'enhancement', 'prompt', 'question'].includes(this.editType);
  }
  ownerInitials(): string {
    if (!this.editOwner) return '—';
    const m = this.team.find(t => t.initials === this.editOwner || t.name === this.editOwner);
    return m?.initials || this.editOwner.substring(0, 2).toUpperCase();
  }
  typeLabel(t: string): string {
    return this.typeOptions.find(o => o.value === t)?.label
      || (t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Type');
  }
  statusLabel(s: string): string {
    const issueLabels: Record<string, string> = {
      open: 'Open', in_progress: 'In progress', done: 'Done', wont_fix: "Won't fix"
    };
    const tcLabels: Record<string, string> = {
      todo: 'To Do', pass: 'Pass', fail: 'Fail', skip: 'Skip'
    };
    return issueLabels[s] || tcLabels[s] || s;
  }
  statusOptionsForType() {
    return this.isTestCase()
      ? [
          { label: 'To Do', value: 'todo' },
          { label: 'Pass',  value: 'pass' },
          { label: 'Fail',  value: 'fail' },
          { label: 'Skip',  value: 'skip' }
        ]
      : [
          { label: 'Open',        value: 'open' },
          { label: 'In progress', value: 'in_progress' },
          { label: 'Done',        value: 'done' },
          { label: "Won't fix",   value: 'wont_fix' }
        ];
  }
  formatDate(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  formatTcDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }
  tcIcon(s: string) {
    if (s === 'pass') return 'check';
    if (s === 'fail') return 'x';
    if (s === 'todo') return 'circle';
    return 'minus';
  }
  versionPillText(): string {
    if (this.editStatus === 'done') {
      const v = this.editVersion || this.editTargetVersion;
      const d = this.editShippedDate ? this.formatShipped(this.editShippedDate) : '';
      if (v && d) return `${v} · ${d}`;
      if (v) return v;
      return 'Set version';
    }
    return this.editTargetVersion || 'Set version';
  }
  private formatShipped(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  // ── Pill cycling (auto-saves) ──
  cycleType() {
    if (this.isTestCase()) return;
    const i = TYPE_CYCLE.indexOf(this.editType as any);
    this.editType = TYPE_CYCLE[(i + 1) % TYPE_CYCLE.length];
    this.persistField({ type: this.editType });
  }
  cycleStatus() {
    const cycle: readonly string[] = this.isTestCase() ? TEST_CASE_STATUS_CYCLE : ISSUE_STATUS_CYCLE;
    const i = cycle.indexOf(this.editStatus);
    this.editStatus = cycle[(i + 1) % cycle.length];
    this.persistField({ status: this.editStatus });
  }
  cycleOwner() {
    const order = [...this.team.map(t => t.initials), null];
    const i = order.indexOf(this.editOwner);
    this.editOwner = order[(i + 1) % order.length];
    this.persistField({ owner: this.editOwner });
  }
  cyclePriority() {
    const cur = this.editPriority ?? 0;
    this.editPriority = cur >= 5 || cur < 1 ? 1 : cur + 1;
    this.persistField({ priority: this.editPriority });
  }

  // ── Title ──
  commitTitle() {
    const next = (this.titleEl?.nativeElement.textContent || '').trim();
    if (!next || next === (this.entry?.title || '')) {
      // Restore on empty / unchanged
      if (this.titleEl) this.titleEl.nativeElement.textContent = this.entry?.title || '';
      return;
    }
    this.editTitle = next;
    this.persistField({ title: next });
  }

  // ── Version inline editor ──
  startVersionEdit() {
    this.versionDraft = (this.editStatus === 'done'
      ? (this.editVersion || this.editTargetVersion)
      : this.editTargetVersion) || '';
    this.versionEditing = true;
    this.cdr.markForCheck();
    setTimeout(() => this.versionInput?.nativeElement.focus());
  }
  commitVersion() {
    const v = (this.versionDraft || '').trim() || null;
    const patch: any = {};
    if (this.editStatus === 'done') {
      this.editVersion = v;
      patch.version = v;
    } else {
      this.editTargetVersion = v;
      patch.target_version = v;
    }
    this.versionEditing = false;
    this.persistField(patch);
  }
  cancelVersionEdit() {
    this.versionEditing = false;
    this.cdr.markForCheck();
  }

  // ── Notes ──
  startNotesEdit() {
    this.notesEditing = true;
    this.cdr.markForCheck();
  }
  onNotesChange(v: string) {
    this.editNotes = v;
    this.refreshNotesHtml();
    this.markDirty();
  }
  onNotesFocusOut(ev: FocusEvent) {
    const next = ev.relatedTarget as HTMLElement | null;
    const wrap = ev.currentTarget as HTMLElement;
    if (next && wrap.contains(next)) return;
    setTimeout(() => {
      const active = document.activeElement;
      if (active && wrap.contains(active)) return;
      this.finishNotesEdit();
    }, 50);
  }
  finishNotesEdit() {
    if (this.editNotes !== (this.entry?.notes || '')) {
      this.persistField({ notes: this.editNotes });
    }
    this.notesEditing = false;
    this.cdr.markForCheck();
  }
  private refreshNotesHtml() {
    if (!this.editNotes) { this.notesHtml = ''; return; }
    const html = marked.parse(this.editNotes, { async: false }) as string;
    this.notesHtml = this.sanitizer.bypassSecurityTrustHtml(html);
  }

  // ── Pages ──
  addPage() {
    const v = (this.newPageInput || '').trim();
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

  // ── Test cases ──
  submitTestCase() {
    if (!this.entry) return;
    const notes = (this.addTcNotes || '').trim();
    if (!notes || !this.addTcResult) return;
    const owner = this.addTcOwner;
    this.feedbackSvc.create({
      parent_id: this.entry.id,
      type: 'test_case',
      object_type: 'issue',
      title: 'Test Case',
      status: this.addTcResult,
      owner,
      submitted_by: owner,
      notes
    } as any).subscribe({
      next: created => {
        this.testCases = [{
          id: created.id,
          notes: created.notes!,
          status: created.status as any,
          owner: created.owner,
          submitted_by: created.submitted_by,
          created_at: created.created_at
        }, ...this.testCases];
        this.addTcNotes = '';
        this.addTcResult = null;
        this.cdr.markForCheck();
      },
      error: err => {
        const detail = err?.error?.error || err?.message || 'Failed to add test case';
        this.msg.add({ severity: 'error', summary: 'Test case add failed', detail });
      }
    });
  }

  // ── Persistence ──
  markDirty() { this.isDirty = true; this.cdr.markForCheck(); }

  /** Persist a single field immediately (used by header pill / title / version / notes). */
  private persistField(patch: any) {
    if (!this.entry) return;
    this.feedbackSvc.patch(this.entry.id, patch as any).subscribe({
      next: updated => {
        this.entry = { ...this.entry!, ...updated };
        this.saved.emit(this.entry);
        this.cdr.markForCheck();
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Save failed' });
      }
    });
  }

  /** Save all attribute-tab edits (Save button). */
  save() {
    if (!this.entry) return;
    const patch = {
      title:            this.editTitle,
      type:             this.editType,
      status:           this.editStatus,
      owner:            this.editOwner,
      priority:         this.editPriority,
      target_version:   this.editTargetVersion,
      version:          this.editVersion,
      shipped_date:     this.editShippedDate,
      due_date:         this.editDueDate,
      area_category_id: this.editAreaCategoryId,
      environment:      this.editEnvironment,
      tags:             this.editTags,
      pages:            this.editPages,
      notes:            this.editNotes
    };
    this.feedbackSvc.patch(this.entry.id, patch as any).subscribe({
      next: updated => {
        this.entry = { ...this.entry!, ...updated };
        this.isDirty = false;
        this.msg.add({ severity: 'success', summary: 'Saved ✓' });
        this.saved.emit(this.entry);
        this.cdr.markForCheck();
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Save failed' });
      }
    });
  }

  // ── Delete ──
  confirmDelete() {
    if (!this.entry) return;
    const id = this.entry.id;
    this.confirmSvc.confirm({
      message: 'Delete this entry? This cannot be undone.',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => {
        this.feedbackSvc.remove(id).subscribe({
          next: () => {
            this.deleted.emit(id);
            this.msg.add({ severity: 'success', summary: 'Deleted' });
            this.close();
          },
          error: () => this.msg.add({ severity: 'error', summary: 'Delete failed' })
        });
      }
    });
  }
}
