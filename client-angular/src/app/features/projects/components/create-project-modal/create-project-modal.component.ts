import {
  Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  LucideAngularModule, Paperclip, X, WandSparkles, Check, HelpCircle, Sparkles
} from 'lucide-angular';

import { ProjectService } from '../../../../core/services/project.service';
import { CategoryService } from '../../../../core/services/category.service';
import { OrgService } from '../../../../core/services/org.service';
import { AiService } from '../../../../core/services/ai.service';
import {
  CreateProjectService
} from '../../../../core/services/create-project.service';
import {
  BriefParserService, EXAMPLE_BRIEFS, ParsedBrief as RuleParsedBrief
} from '../../../../core/services/brief-parser.service';
import {
  Category, ParsedBrief, ParsedBriefCategory
} from '../../../../models';

/**
 * "New project" intake modal — v1.39.
 *
 * Three states:
 *   1. INPUT   — upload a file or paste a brief; ref chip auto-shown
 *   2. LOADING — AI is reading; animated progress steps
 *   3. RESULTS — hero card + category list + questions; review & remove
 *
 * AI is the PRIMARY parser (AiService.parseBrief — Haiku 4.5, upgraded
 * in v1.38). The rule-based parser (BriefParserService) is kept as a
 * LAST-RESORT fallback when the AI call fails so the user can still
 * land on a half-populated project rather than a blank one.
 *
 * The auto-ref ("{org.ref_prefix}-{counter:03}", e.g. WA-014) is
 * previewed via GET /projects/next-ref?org_id=... and stamped for real
 * when create() runs server-side, so a cancelled modal doesn't burn
 * a number.
 *
 * The modal is mounted once at the app-shell level; every "+ New
 * project" call site uses CreateProjectService.open() to surface this
 * single instance.
 */
type ModalState = 'input' | 'loading' | 'results';

interface PendingCategory {
  ai: ParsedBriefCategory;
  /** Resolved catalogue Category, or null if no match. */
  db: Category | null;
  /** UI flag — user clicked ✕ to remove. */
  removed: boolean;
}

@Component({
  selector: 'app-create-project-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, LucideAngularModule,
    DialogModule, ButtonModule, InputTextModule, InputTextareaModule, ToastModule
  ],
  providers: [MessageService],
  template: `
    <p-dialog [(visible)]="visible"
              (visibleChange)="onVisibleChange($event)"
              [modal]="true" [draggable]="false" [resizable]="false"
              [closable]="false"
              [style]="{width:'600px'}"
              styleClass="bp-cp-dialog">

      <ng-template pTemplate="header">
        <div class="bp-cp-head">
          <div>
            <div class="bp-cp-title">New project</div>
            <div class="bp-cp-sub">{{ subtitle }}</div>
          </div>
          <button type="button" class="bp-icon-btn" (click)="close()" title="Close">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </ng-template>

      <!-- ═══════════════════════════════════════════════════ INPUT ═══ -->
      <ng-container *ngIf="state === 'input'">
        <div class="bp-cp-body">

          <div class="bp-cp-ref" *ngIf="nextRef">
            <span>Ref</span>
            <span class="bp-cp-ref-code">{{ nextRef }}</span>
            <span class="bp-cp-ref-auto">auto-generated</span>
          </div>

          <!-- File upload zone. Stays compact once a file is selected
               so the textarea below is always available for paste /
               edit, even after upload. -->
          <label class="bp-cp-upload"
                 [class.has-file]="uploadedFile"
                 [class.extracting]="extracting"
                 (dragover)="$event.preventDefault()"
                 (drop)="onDrop($event)">
            <input #fileInput type="file" hidden
                   accept=".pdf,.docx,.eml,.txt,.png,.jpg,.jpeg"
                   (change)="onFilePicked($event)"/>
            <ng-container *ngIf="!uploadedFile">
              <lucide-icon name="paperclip" [size]="22"></lucide-icon>
              <div class="bp-cp-upload-text">
                <div class="bp-cp-upload-title">Upload brief</div>
                <div class="bp-cp-upload-sub">Drag &amp; drop or click to browse</div>
              </div>
              <div class="bp-cp-upload-formats">
                <span class="bp-cp-upload-fmt">PDF</span>
                <span class="bp-cp-upload-fmt">Word</span>
                <span class="bp-cp-upload-fmt">Email</span>
                <span class="bp-cp-upload-fmt">Text</span>
              </div>
            </ng-container>
            <ng-container *ngIf="uploadedFile">
              <lucide-icon name="paperclip" [size]="14"></lucide-icon>
              <span class="bp-cp-upload-name">{{ uploadedFile.name }}</span>
              <span *ngIf="extracting"   class="bp-cp-upload-status">extracting…</span>
              <span *ngIf="!extracting && extractedChars > 0"
                    class="bp-cp-upload-status bp-cp-upload-status-ok">
                ✓ {{ extractedChars | number }} chars
              </span>
              <button type="button" class="bp-cp-upload-x"
                      (click)="$event.preventDefault(); $event.stopPropagation(); removeFile()">
                <i class="pi pi-times"></i>
              </button>
            </ng-container>
          </label>

          <div class="bp-cp-or">
            <span class="bp-cp-or-line"></span>
            <span class="bp-cp-or-text">{{ uploadedFile ? 'review or edit text' : 'or paste text' }}</span>
            <span class="bp-cp-or-line"></span>
          </div>

          <textarea pInputTextarea
                    [(ngModel)]="form.brief"
                    [rows]="5"
                    placeholder="Paste a client email, brief, WhatsApp message, or rough notes..."
                    class="w-full bp-input-edit bp-cp-brief"></textarea>

          <div class="bp-cp-examples">
            <span class="bp-cp-examples-label">Try:</span>
            <button *ngFor="let ex of examples"
                    type="button"
                    class="bp-cp-example-pill"
                    (click)="loadExample(ex.key)">
              {{ ex.label }}
            </button>
          </div>

          <div *ngIf="errorMsg" class="bp-cp-error">{{ errorMsg }}</div>
        </div>
      </ng-container>

      <!-- ═══════════════════════════════════════════════════ LOADING ═ -->
      <ng-container *ngIf="state === 'loading'">
        <div class="bp-cp-loading">
          <div class="bp-cp-spinner"></div>
          <div class="bp-cp-loading-title">
            <lucide-icon name="sparkles" [size]="14"></lucide-icon>
            AI is reading your brief…
          </div>
          <div class="bp-cp-loading-sub">
            Identifying categories, writing supplier briefs, flagging questions
          </div>
          <div class="bp-cp-loading-steps">
            <div class="bp-cp-step" [class.done]="loadStep >= 1">
              <lucide-icon *ngIf="loadStep >= 1" name="check" [size]="12"></lucide-icon>
              <span *ngIf="loadStep < 1">⏳</span>
              {{ loadStep >= 1 ? 'Details extracted' : 'Extracting details' }}
            </div>
            <div class="bp-cp-step" [class.done]="loadStep >= 2" *ngIf="loadStep >= 1">
              <lucide-icon *ngIf="loadStep >= 2" name="check" [size]="12"></lucide-icon>
              <span *ngIf="loadStep < 2">⏳</span>
              {{ loadStep >= 2
                  ? (aiCategoryCount + ' categories identified')
                  : 'Writing category briefs' }}
            </div>
            <div class="bp-cp-step" [class.done]="loadStep >= 3" *ngIf="loadStep >= 2">
              <lucide-icon *ngIf="loadStep >= 3" name="check" [size]="12"></lucide-icon>
              <span *ngIf="loadStep < 3">⏳</span>
              {{ loadStep >= 3
                  ? (aiQuestionCount + ' questions flagged')
                  : 'Flagging questions' }}
            </div>
            <div class="bp-cp-step" *ngIf="loadStep >= 3 && !aiSettled">
              ⏳ Still working…
            </div>
          </div>
        </div>
      </ng-container>

      <!-- ═══════════════════════════════════════════════════ RESULTS ═ -->
      <ng-container *ngIf="state === 'results' && aiResult">
        <div class="bp-cp-body">

          <div class="bp-cp-hero">
            <div class="bp-cp-hero-row">
              <div class="bp-cp-hero-main">
                <div class="bp-cp-hero-name">{{ aiResult.projectName || 'Untitled project' }}</div>
                <div class="bp-cp-hero-meta">
                  <span class="bp-cp-chip" *ngIf="aiResult.client">👤 {{ aiResult.client }}</span>
                  <span class="bp-cp-chip" *ngIf="aiResult.dates">📅 {{ aiResult.dates }}</span>
                  <span class="bp-cp-chip" *ngIf="aiResult.location">📍 {{ aiResult.location }}</span>
                  <span class="bp-cp-chip" *ngIf="aiResult.budget">💰 {{ aiResult.budget }}</span>
                  <span class="bp-cp-chip" *ngIf="aiResult.budgetSignal && aiResult.budgetSignal !== 'Unknown'">
                    🎯 {{ aiResult.budgetSignal }}
                  </span>
                </div>
              </div>
              <span class="bp-cp-hero-ref">{{ nextRef || '—' }}</span>
            </div>
          </div>

          <div class="bp-cp-summary" *ngIf="aiResult.summary">
            “{{ aiResult.summary }}”
          </div>

          <div class="bp-cp-section">{{ activeCategoryCount }} categories identified</div>
          <div class="bp-cp-cats">
            <div *ngFor="let p of pendingCategories; let i = index"
                 class="bp-cp-cat" [class.removed]="p.removed">
              <div class="bp-cp-cat-icon">
                <lucide-icon *ngIf="p.db?.icon_name"
                             [name]="p.db?.icon_name || 'circle'"
                             [size]="14"></lucide-icon>
                <span *ngIf="!p.db?.icon_name">{{ (p.ai.categoryLabel || '?').charAt(0) }}</span>
              </div>
              <div class="bp-cp-cat-body">
                <div class="bp-cp-cat-name">
                  {{ p.db?.name || p.ai.categoryLabel }}
                  <span *ngIf="p.ai.implied" class="bp-cp-cat-implied">Implied</span>
                  <span *ngIf="!p.db" class="bp-cp-cat-unmatched" title="Catalogue category not found — will be skipped on Create.">
                    No match
                  </span>
                </div>
                <div class="bp-cp-cat-brief">{{ p.ai.oneLiner }}</div>
              </div>
              <div class="bp-cp-cat-est" *ngIf="p.ai.budgetEstimate">{{ p.ai.budgetEstimate }}</div>
              <button type="button" class="bp-cp-cat-x"
                      (click)="toggleRemove(i)"
                      [title]="p.removed ? 'Undo remove' : 'Remove category'">
                <i class="pi" [class.pi-times]="!p.removed" [class.pi-undo]="p.removed"></i>
              </button>
            </div>
          </div>

          <ng-container *ngIf="aiResult.topQuestions?.length">
            <div class="bp-cp-section">{{ aiResult.topQuestions?.length }} questions to resolve</div>
            <div class="bp-cp-questions">
              <div class="bp-cp-question" *ngFor="let q of aiResult.topQuestions">
                <lucide-icon name="help-circle" [size]="12"></lucide-icon>
                {{ q }}
              </div>
            </div>
          </ng-container>

          <div *ngIf="errorMsg" class="bp-cp-error">{{ errorMsg }}</div>
        </div>
      </ng-container>

      <!-- ════════════════════════════════════════════════════ FOOTER ═
           Single footer template. PrimeNG only registers one
           pTemplate="footer" per p-dialog instance — splitting it
           across state-branches above made the INPUT footer get
           pinned and the RESULTS "Create project" button never
           rendered. State-switched buttons inside one template fixes
           that. -->
      <ng-template pTemplate="footer">
        <!-- INPUT footer: Cancel + Parse with AI -->
        <ng-container *ngIf="state === 'input'">
          <p-button label="Cancel" styleClass="bp-btn-cancel"
                    (onClick)="close()"></p-button>
          <p-button styleClass="bp-btn-save"
                    [disabled]="!canParse"
                    (onClick)="parseWithAi()">
            <ng-template pTemplate="content">
              <lucide-icon name="sparkles" [size]="13" style="margin-right:6px"></lucide-icon>
              Parse with AI →
            </ng-template>
          </p-button>
        </ng-container>

        <!-- RESULTS footer: ← Edit brief · Cancel · Create project → -->
        <ng-container *ngIf="state === 'results'">
          <button type="button" class="bp-cp-back" (click)="backToInput()">
            ← Edit brief
          </button>
          <div class="bp-cp-footer-r">
            <p-button label="Cancel" styleClass="bp-btn-cancel"
                      [disabled]="creating"
                      (onClick)="close()"></p-button>
            <p-button styleClass="bp-btn-save"
                      [disabled]="creating"
                      (onClick)="createProject()">
              <ng-template pTemplate="content">
                <i *ngIf="creating" class="pi pi-spin pi-spinner" style="margin-right:6px"></i>
                {{ creating ? 'Creating…' : 'Create project →' }}
              </ng-template>
            </p-button>
          </div>
        </ng-container>

        <!-- LOADING has no footer (the spinner body owns the space). -->
      </ng-template>
    </p-dialog>

    <p-toast></p-toast>
  `,
  styles: [`
    :host { font-family: var(--font-body); }

    /* p-dialog chrome — parchment header / hairline border, matches the
       Settings + drawer rhythm. */
    :host ::ng-deep .bp-cp-dialog .p-dialog-header {
      background: var(--theme-bg);
      border-bottom: 0.5px solid var(--color-border);
      padding: 16px 20px;
    }
    :host ::ng-deep .bp-cp-dialog .p-dialog-content {
      padding: 16px 20px 8px;
    }
    :host ::ng-deep .bp-cp-dialog .p-dialog-footer {
      background: var(--theme-bg);
      border-top: 0.5px solid var(--color-border);
      padding: 12px 20px;
      display: flex; justify-content: flex-end; gap: 10px;
    }

    .bp-cp-head {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 12px; width: 100%;
    }
    .bp-cp-title {
      font-family: var(--font-display);
      font-size: 22px; font-weight: 400;
      color: var(--color-text-primary);
    }
    .bp-cp-sub {
      font-size: 12px; color: var(--color-text-muted);
      margin-top: 2px;
    }

    .bp-cp-body { display: flex; flex-direction: column; gap: 14px; }

    /* ── Ref chip (INPUT state) ──────────────────────────────────────── */
    .bp-cp-ref {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 12px;
      background: var(--theme-bg);
      border: 0.5px solid var(--color-border);
      border-radius: 6px;
      font-size: 12px;
      color: var(--color-text-muted);
      align-self: flex-start;
    }
    .bp-cp-ref-code {
      font-weight: 600;
      color: var(--color-text-primary);
      letter-spacing: 0.02em;
    }
    .bp-cp-ref-auto {
      font-size: 10px;
      color: var(--color-text-muted);
    }

    /* ── Upload zone ─────────────────────────────────────────────────── */
    .bp-cp-upload {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      padding: 20px;
      border: 2px dashed var(--color-border);
      border-radius: 10px;
      background: var(--color-surface);
      color: var(--color-text-muted);
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
      text-align: center;
    }
    .bp-cp-upload:hover {
      border-color: var(--theme-accent);
      color: var(--theme-accent);
    }
    .bp-cp-upload.has-file {
      padding: 10px 14px;
      flex-direction: row;
      justify-content: flex-start;
    }
    .bp-cp-upload-text { display: flex; flex-direction: column; gap: 1px; }
    .bp-cp-upload-title { font-size: 14px; font-weight: 500; color: var(--color-text-primary); }
    .bp-cp-upload-sub   { font-size: 11px; color: var(--color-text-muted); }
    .bp-cp-upload-formats { display: flex; gap: 6px; margin-top: 4px; }
    .bp-cp-upload-fmt {
      font-size: 9px;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--theme-bg);
      color: var(--color-text-muted);
    }
    .bp-cp-upload-name {
      flex: 1; font-size: 12.5px; color: var(--color-text-primary);
      text-align: left;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bp-cp-upload-status {
      font-size: 11px;
      color: var(--color-text-muted);
      font-style: italic;
      flex-shrink: 0;
    }
    .bp-cp-upload-status-ok {
      color: var(--theme-accent);
      font-style: normal;
      font-weight: 500;
    }
    .bp-cp-upload.extracting {
      border-color: var(--theme-accent);
      color: var(--theme-accent);
    }
    .bp-cp-upload-x {
      width: 22px; height: 22px;
      border-radius: 50%;
      border: 0.5px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-muted);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 10px;
    }
    .bp-cp-upload-x:hover {
      color: var(--color-danger);
      border-color: var(--color-danger);
    }

    /* "or paste text" divider */
    .bp-cp-or {
      display: flex; align-items: center; gap: 10px;
      font-size: 11px;
      color: var(--color-text-muted);
    }
    .bp-cp-or-line { flex: 1; height: 0.5px; background: var(--color-border); }

    .bp-cp-brief {
      resize: vertical; min-height: 100px;
      line-height: 1.6;
    }

    /* Example pills */
    .bp-cp-examples {
      display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
      font-size: 11px;
      color: var(--color-text-muted);
    }
    .bp-cp-examples-label { color: var(--color-text-muted); }
    .bp-cp-example-pill {
      display: inline-flex; align-items: center;
      height: 24px; padding: 0 10px;
      border: 0.5px solid var(--color-border);
      border-radius: 12px;
      background: var(--color-surface);
      color: var(--color-text-secondary);
      font-size: 11px; font-weight: 500;
      font-family: var(--font-body);
      cursor: pointer;
      transition: all 0.15s;
    }
    .bp-cp-example-pill:hover {
      border-color: var(--theme-accent);
      color: var(--theme-accent);
      background: var(--theme-bg);
    }

    .bp-cp-error {
      font-size: 12px;
      color: var(--color-danger);
      padding: 8px 10px;
      background: rgba(225, 29, 72, 0.06);
      border-radius: 6px;
    }

    /* ── LOADING state ───────────────────────────────────────────────── */
    .bp-cp-loading {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 40px 24px;
      text-align: center;
      gap: 12px;
    }
    .bp-cp-spinner {
      width: 32px; height: 32px;
      border: 3px solid var(--theme-bg);
      border-top-color: var(--theme-accent);
      border-radius: 50%;
      animation: bp-cp-spin 0.7s linear infinite;
    }
    @keyframes bp-cp-spin { to { transform: rotate(360deg); } }
    .bp-cp-loading-title {
      display: flex; align-items: center; gap: 6px;
      font-size: 14px;
      color: var(--color-text-primary);
    }
    .bp-cp-loading-sub {
      font-size: 11.5px;
      color: var(--color-text-muted);
      max-width: 360px;
    }
    .bp-cp-loading-steps {
      display: flex; flex-direction: column; gap: 6px;
      margin-top: 8px;
      font-size: 11px;
      color: var(--color-text-secondary);
    }
    .bp-cp-step {
      display: flex; align-items: center; gap: 6px;
      transition: color 0.2s;
    }
    .bp-cp-step.done {
      color: var(--theme-accent);
    }

    /* ── RESULTS state ───────────────────────────────────────────────── */
    .bp-cp-hero {
      padding: 14px 16px;
      background: var(--theme-bg);
      border-radius: 10px;
      border: 0.5px solid var(--color-border);
    }
    .bp-cp-hero-row {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 12px;
    }
    .bp-cp-hero-main { flex: 1; min-width: 0; }
    .bp-cp-hero-name {
      font-family: var(--font-display);
      font-size: 20px; font-weight: 500;
      margin-bottom: 6px;
      color: var(--color-text-primary);
    }
    .bp-cp-hero-meta { display: flex; flex-wrap: wrap; gap: 6px; }
    .bp-cp-chip {
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 999px;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      color: var(--color-text-secondary);
    }
    .bp-cp-hero-ref {
      font-size: 11px;
      color: var(--color-text-secondary);
      padding: 3px 10px;
      background: var(--color-surface);
      border-radius: 6px;
      border: 0.5px solid var(--color-border);
      font-weight: 600;
      letter-spacing: 0.02em;
      flex-shrink: 0;
    }

    .bp-cp-summary {
      font-size: 12px;
      color: var(--color-text-muted);
      line-height: 1.6;
      font-style: italic;
    }

    .bp-cp-section {
      font-size: 10px; font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--theme-accent);
      padding-bottom: 6px;
      border-bottom: 0.5px solid var(--color-border);
    }

    .bp-cp-cats {
      display: flex; flex-direction: column; gap: 6px;
      max-height: 240px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .bp-cp-cat {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 8px 10px;
      border: 0.5px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
      transition: background 0.15s, opacity 0.15s;
    }
    .bp-cp-cat:hover { background: var(--theme-bg); }
    .bp-cp-cat.removed { opacity: 0.4; }
    .bp-cp-cat-icon {
      width: 28px; height: 28px;
      border-radius: 6px;
      background: var(--theme-bg);
      color: var(--theme-accent);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      font-size: 12px; font-weight: 600;
    }
    .bp-cp-cat-body { flex: 1; min-width: 0; }
    .bp-cp-cat-name {
      font-size: 12px; font-weight: 600;
      margin-bottom: 2px;
      color: var(--color-text-primary);
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    }
    .bp-cp-cat-implied {
      font-size: 9px; font-weight: 600;
      padding: 1px 6px;
      border-radius: 999px;
      background: var(--theme-empty);
      color: var(--theme-text);
    }
    .bp-cp-cat-unmatched {
      font-size: 9px; font-weight: 600;
      padding: 1px 6px;
      border-radius: 999px;
      background: rgba(225, 29, 72, 0.08);
      color: var(--color-danger);
    }
    .bp-cp-cat-brief {
      font-size: 10.5px;
      color: var(--color-text-muted);
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .bp-cp-cat-est {
      font-family: var(--font-display);
      font-size: 13px;
      color: var(--color-text-primary);
      flex-shrink: 0;
      margin-left: 8px;
      white-space: nowrap;
    }
    .bp-cp-cat-x {
      background: none; border: none;
      color: var(--color-text-muted);
      cursor: pointer;
      font-size: 13px;
      flex-shrink: 0;
      padding: 0 2px;
    }
    .bp-cp-cat-x:hover { color: var(--color-danger); }

    .bp-cp-questions { display: flex; flex-direction: column; gap: 4px; }
    .bp-cp-question {
      display: flex; align-items: flex-start; gap: 6px;
      padding: 5px 0;
      font-size: 11px;
      color: var(--color-text-secondary);
      line-height: 1.5;
    }
    .bp-cp-question lucide-icon {
      color: var(--theme-accent);
      flex-shrink: 0;
      margin-top: 2px;
    }

    .bp-cp-back {
      background: none; border: none;
      font-family: var(--font-body);
      font-size: 12px;
      color: var(--color-text-muted);
      cursor: pointer;
      padding: 0;
    }
    .bp-cp-back:hover { color: var(--theme-accent); }
    .bp-cp-footer-r { display: flex; gap: 8px; margin-left: auto; }

    :host ::ng-deep .bp-cp-dialog .p-dialog-footer { align-items: center; }
  `]
})
export class CreateProjectModalComponent implements OnInit {
  visible = false;
  state: ModalState = 'input';

  // INPUT
  form = { brief: '' };
  uploadedFile: File | null = null;
  /** True while POST /ai/extract-text is in flight. */
  extracting = false;
  /** char count from the most recent successful extract — used to
      show "✓ N chars" next to the file name. */
  extractedChars = 0;
  examples = EXAMPLE_BRIEFS;
  nextRef: string | null = null;
  errorMsg = '';

  // LOADING
  loadStep = 0;             // 0/1/2/3 — visible step
  aiSettled = false;        // true once the AI call has returned
  aiCategoryCount = 0;
  aiQuestionCount = 0;

  // RESULTS
  aiResult: ParsedBrief | null = null;
  pendingCategories: PendingCategory[] = [];
  creating = false;

  private categories: Category[] = [];
  private orgId = '';
  /** v1.39d — cached on modal open so create() can apply the org's
      saved margin/contingency/VAT defaults to the new project (and
      fall back to UK norms if any are missing). */
  private org: any = null;

  // AI categoryId → DB catalogue category name. The Brief tab and
  // Event drawer keep the same map so all three "Parse brief" entry
  // points upsert against the same rows.
  //   v1.39f: added `venues→Venue` (Venue IS in the catalogue here)
  //   v1.39f: `photography→Photography` row was missing in the DB —
  //           seeded via migrate-schemas (idempotent insert).
  private static readonly AI_TO_DB: Record<string, string> = {
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

  constructor(
    private router: Router,
    private cpSvc: CreateProjectService,
    private parser: BriefParserService,
    private aiSvc: AiService,
    private projSvc: ProjectService,
    private catSvc: CategoryService,
    private orgSvc: OrgService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.cpSvc.visible$.subscribe(v => {
      this.visible = v;
      if (v) {
        this.reset();
        // Lazy-load the next ref + catalogue every time the modal opens
        // so the counter / catalogue stay fresh between project creates.
        if (this.orgId) this.loadNextRef();
        this.loadCatalogue();
      }
      this.cdr.markForCheck();
    });
    this.orgSvc.getCurrentOrg().subscribe(org => {
      if (org) {
        this.orgId = org.id;
        this.org = org;
        if (this.visible) this.loadNextRef();
      }
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────
  onVisibleChange(v: boolean) { this.cpSvc.setVisible(v); }
  close() {
    if (this.creating) return;
    this.cpSvc.close();
  }
  reset() {
    this.state = 'input';
    this.form = { brief: '' };
    this.uploadedFile = null;
    this.extracting = false;
    this.extractedChars = 0;
    this.errorMsg = '';
    this.loadStep = 0;
    this.aiSettled = false;
    this.aiCategoryCount = 0;
    this.aiQuestionCount = 0;
    this.aiResult = null;
    this.pendingCategories = [];
    this.creating = false;
  }

  private loadNextRef() {
    this.projSvc.previewNextRef(this.orgId).subscribe({
      next: r => { this.nextRef = r?.ref || null; this.cdr.markForCheck(); },
      error: () => { /* non-fatal — chip just hides */ }
    });
  }
  private loadCatalogue() {
    this.catSvc.getAll('catalogue').subscribe(rows => {
      this.categories = (rows || []).filter(c => !(c as any).parent_id);
      this.cdr.markForCheck();
    });
  }

  get subtitle(): string {
    if (this.state === 'input')   return 'Upload a brief or paste text — AI will do the rest';
    if (this.state === 'loading') return this.nextRef || '';
    return 'Review AI results — remove categories before creating';
  }

  get canParse(): boolean {
    // Only the textarea text drives the AI call — files are extracted
    // to text on upload so by the time the user clicks Parse, anything
    // that needs to be sent is in form.brief.
    return !this.extracting && !!this.form.brief.trim();
  }

  // ── INPUT actions ─────────────────────────────────────────────────────
  loadExample(key: string) {
    const ex = this.examples.find(e => e.key === key);
    if (!ex) return;
    this.form.brief = ex.text;
    this.uploadedFile = null;
    this.cdr.markForCheck();
  }

  onFilePicked(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) this.handleFile(f);
    // Allow re-selecting the same file (Chrome won't refire change otherwise).
    (input as HTMLInputElement).value = '';
  }
  onDrop(ev: DragEvent) {
    ev.preventDefault();
    const f = ev.dataTransfer?.files?.[0];
    if (f) this.handleFile(f);
  }
  removeFile() {
    this.uploadedFile = null;
    this.extracting = false;
    this.extractedChars = 0;
    this.cdr.markForCheck();
  }

  /** v1.39a — send the file to /ai/extract-text and populate the
      textarea with the result. The textarea remains user-editable so
      they can clean up the extracted text before parsing. */
  private handleFile(f: File) {
    this.uploadedFile = f;
    this.extracting = true;
    this.extractedChars = 0;
    this.errorMsg = '';
    this.cdr.markForCheck();

    this.aiSvc.extractText(f).subscribe({
      next: out => {
        this.extracting = false;
        this.form.brief = out.text || '';
        this.extractedChars = (out.text || '').length;
        this.msg.add({
          severity: 'success',
          summary: `✓ Extracted ${this.extractedChars.toLocaleString()} characters from ${f.name}`,
          detail: 'Review the text below, then Parse with AI.',
          life: 3500
        });
        this.cdr.markForCheck();
      },
      error: err => {
        this.extracting = false;
        const detail =
          err?.error?.error ||
          'Could not extract text from this file — paste the brief text below.';
        // Keep the file pinned (so the user sees what they uploaded)
        // but surface a clear actionable message.
        this.msg.add({
          severity: 'warn',
          summary: 'File needs paste',
          detail,
          life: 4500
        });
        this.cdr.markForCheck();
      }
    });
  }

  // ── LOADING / AI call ─────────────────────────────────────────────────
  parseWithAi() {
    if (!this.canParse) return;
    this.state = 'loading';
    this.loadStep = 0;
    this.aiSettled = false;
    this.aiCategoryCount = 0;
    this.aiQuestionCount = 0;
    this.errorMsg = '';
    this.cdr.markForCheck();

    // Animate the progress steps on timers — cosmetic, the real API
    // call is a single request that returns when it returns.
    setTimeout(() => { this.loadStep = Math.max(this.loadStep, 1); this.cdr.markForCheck(); },  800);
    setTimeout(() => { this.loadStep = Math.max(this.loadStep, 2); this.cdr.markForCheck(); }, 1600);
    setTimeout(() => { this.loadStep = Math.max(this.loadStep, 3); this.cdr.markForCheck(); }, 2200);

    const text = this.form.brief.trim();
    if (!text) {
      // Should be unreachable thanks to `canParse`, but keep a clear
      // last-line message in case the button state got out of sync.
      this.aiFailed('Paste or upload some brief text before parsing.');
      return;
    }

    const start = Date.now();
    this.aiSvc.parseBrief(text).subscribe({
      next: (res: ParsedBrief) => {
        this.aiCategoryCount = (res?.categories || []).length;
        this.aiQuestionCount = (res?.topQuestions || []).length;
        // Wait at least 2.4s before flipping to results so the animation
        // doesn't snap. If the API was slow, show immediately.
        const elapsed = Date.now() - start;
        const wait = Math.max(0, 2400 - elapsed);
        setTimeout(() => this.showResults(res), wait);
      },
      error: err => this.aiFailed(
        err?.error?.error || 'AI parser unreachable. You can still create the project manually.'
      )
    });
  }

  private aiFailed(detail: string) {
    this.aiSettled = true;
    // Last-resort fallback: run the rule-based parser so the user
    // still gets something. The note in the UI explains the downgrade.
    const text = this.form.brief.trim();
    let rule: RuleParsedBrief = { categories: [] };
    if (text) {
      try { rule = this.parser.parseBrief(text); } catch { /* swallow */ }
    }
    const fallbackResult: ParsedBrief = {
      projectName: rule.eventName || '',
      client:      rule.client    || '',
      eventType:   rule.eventType,
      location:    rule.venue,
      city:        rule.city,
      dates:       rule.eventDate,
      durationDays: rule.durationDays,
      guestCount:  rule.guestCount,
      budget:      rule.budget ? '£' + rule.budget.toLocaleString('en-GB') : 'Unknown',
      budgetSignal: (rule.budgetSignal || 'Unknown') as any,
      summary:     'AI unavailable — using basic parsing. Results may be limited.',
      categories:  (rule.categories || []).map(c => ({
        categoryId:    this.dbNameToAiId(c.categoryName),
        categoryLabel: c.categoryName,
        oneLiner:      c.requirementBrief,
        budgetEstimate: c.budgetEstimate ? '£' + c.budgetEstimate.toLocaleString('en-GB') : null,
        implied:       c.implied
      })),
      topQuestions: []
    };
    this.aiCategoryCount = fallbackResult.categories?.length || 0;
    this.aiQuestionCount = 0;
    this.errorMsg = detail;
    this.showResults(fallbackResult);
  }

  private dbNameToAiId(dbName: string): string {
    // Reverse-map for the fallback path so categories slot back into
    // the same resolver. Returns the AI categoryId or '' if unmapped.
    for (const [aiId, name] of Object.entries(CreateProjectModalComponent.AI_TO_DB)) {
      if (name === dbName) return aiId;
    }
    return '';
  }

  private showResults(res: ParsedBrief) {
    this.aiSettled = true;
    this.aiResult = res;
    this.pendingCategories = (res.categories || []).map(ai => {
      const dbName = CreateProjectModalComponent.AI_TO_DB[ai.categoryId];
      let db: Category | null = (dbName
        ? this.categories.find(c => c.name === dbName)
        : null) ?? null;
      if (!db && ai.categoryLabel) {
        const lc = ai.categoryLabel.toLowerCase();
        db = this.categories.find(c => lc.includes(c.name.toLowerCase())) || null;
      }
      return { ai, db, removed: false };
    });
    this.state = 'results';
    this.cdr.markForCheck();
  }

  // ── RESULTS actions ───────────────────────────────────────────────────
  get activeCategoryCount(): number {
    return this.pendingCategories.filter(p => !p.removed).length;
  }
  toggleRemove(i: number) {
    const p = this.pendingCategories[i];
    if (!p) return;
    p.removed = !p.removed;
    this.cdr.markForCheck();
  }
  backToInput() {
    this.state = 'input';
    this.errorMsg = '';
    this.cdr.markForCheck();
  }

  createProject() {
    if (this.creating || !this.aiResult) return;
    this.creating = true;
    this.errorMsg = '';
    this.cdr.markForCheck();

    const r = this.aiResult;
    const parsedBudget = this.parseBudgetString(r.budget);
    const tier = (r.budgetSignal && r.budgetSignal !== 'Unknown')
      ? String(r.budgetSignal).toLowerCase()
      : null;

    // v1.39d — financial defaults. Use the org's saved defaults if
    // present; otherwise fall back to sensible UK numbers
    // (20% margin / 5% contingency / 20% VAT). These end up on the
    // project so the Estimate tab can apply them per-row without
    // touching the org table again.
    const orgMargin      = Number(this.org?.default_margin_pct);
    const orgContingency = Number(this.org?.default_contingency_pct);
    const orgVat         = Number(this.org?.default_vat_pct);

    const payload: any = {
      org_id:         this.orgId || null,
      // v1.39d — pass the previewed ref so the project ends up with
      // exactly what the modal chip showed. Backend still atomically
      // advances orgs.ref_counter so subsequent previews stay correct.
      ref:            this.nextRef || undefined,
      name:           r.projectName || 'Untitled project',
      event_name:     r.projectName,
      client_name:    r.client,
      venue_name:     r.location,
      venue_city:     r.city,
      event_date:     r.dates,
      duration_days:  r.durationDays ?? null,
      guest_count:    r.guestCount ?? null,
      project_budget: parsedBudget,
      event_type:     r.eventType,
      tier,
      // v1.39d — financial defaults (was previously omitted)
      default_margin_pct:      Number.isFinite(orgMargin)      && orgMargin      > 0 ? orgMargin      : 20,
      default_contingency_pct: Number.isFinite(orgContingency) && orgContingency > 0 ? orgContingency : 5,
      default_vat_pct:         Number.isFinite(orgVat)         && orgVat         > 0 ? orgVat         : 20,
      raw_brief_text: this.form.brief.trim(),
      // v1.39f — persist the full AI response so we can audit later
      // (compare what the AI returned to what ended up on the
      // project + categories). projects.parsed_brief_json is JSONB.
      parsed_brief_json: r,
      currency:       'GBP'
    };

    // v1.39d diagnostic — log the AI response + the outbound payload
    // so we can quickly see why a field on the project page is blank.
    // Open the browser console to see these.
    // eslint-disable-next-line no-console
    console.log('[createProject] AI response →', r);
    // eslint-disable-next-line no-console
    console.log('[createProject] outbound payload →', payload);

    this.projSvc.create(payload).subscribe({
      next: project => {
        // eslint-disable-next-line no-console
        console.log('[createProject] saved project →', project);
        this.createCategories(project);
      },
      error: err => {
        // eslint-disable-next-line no-console
        console.error('[createProject] failed →', err);
        this.creating = false;
        this.errorMsg = 'Could not create the project. Try again.';
        this.cdr.markForCheck();
      }
    });
  }

  private createCategories(project: any) {
    const active = this.pendingCategories.filter(p => !p.removed && p.db);
    if (!active.length) {
      this.finish(project, 0);
      return;
    }
    // v1.39d — log every category's outbound payload so missing
    // requirement_briefs are easy to diagnose.
    const upserts = active.map(p => {
      const body = {
        requirement_brief: p.ai.oneLiner,
        // v1.39d — was midOfBand, now LOW end of the range so the
        // Estimate tab starts conservative. AI's budgetEstimate is
        // a band like "£15k–£20k"; pick £15k.
        ballpark_budget:   this.lowOfBand(p.ai.budgetEstimate)
      };
      // eslint-disable-next-line no-console
      console.log('[createCategories] upsert →', p.db!.name, body);
      return this.projSvc.upsertCategory(project.id, p.db!.id, body)
        .pipe(catchError(err => {
          // eslint-disable-next-line no-console
          console.error('[createCategories] upsert failed →', p.db!.name, err);
          return of(null);
        }));
    });
    forkJoin(upserts).subscribe({
      next: () => this.finish(project, active.length),
      error: () => this.finish(project, 0)
    });
  }

  private finish(project: any, n: number) {
    this.creating = false;
    this.projSvc.triggerRefresh();
    this.cpSvc.close();
    this.router.navigate(['/projects', project.id], { queryParams: { tab: 'brief' } });
    this.msg.add({
      severity: 'success',
      summary: n > 0
        ? `✦ Project ${project.ref || ''} created — ${n} categories from AI`
        : `✦ Project ${project.ref || ''} created`,
      life: 3500
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  /** "£40,000" / "£20,000–£22,000" / "£200k" / "£40,000 (1-day)" →
      number (midpoint for ranges, leftmost amount otherwise). Returns
      null on Unknown / unparseable. Defensive against parentheticals
      like "(1-day)" that previously made the range regex misfire. */
  private parseBudgetString(s?: string): number | null {
    if (!s) return null;
    // Strip parentheticals first so "(1-day)" can't be misread as a
    // range. Also drop the £/€/$ symbols and convert en/em dashes to
    // hyphens so the regexes below stay simple.
    const norm = s
      .replace(/\(.*?\)/g, ' ')
      .replace(/[£$€,]/g, '')
      .replace(/–|—/g, '-')
      .trim();
    if (!norm || /unknown|tbc|n\/a/i.test(norm)) return null;
    // Range: two amounts separated by " - " (with optional k/m suffixes).
    const range = norm.match(/(\d+(?:\.\d+)?)\s*([kKmM])?\s*-\s*(\d+(?:\.\d+)?)\s*([kKmM])?/);
    if (range) {
      const a = this.toNumber(range[1], range[2]);
      const b = this.toNumber(range[3], range[4]);
      // Only treat as a range if both sides are budget-plausible. A
      // mis-parsed "40 - 1" (from "40,000 (1-day)" residue) would
      // otherwise collapse to 20.5 — guard with a sanity floor.
      if (a >= 100 && b >= 100) return Math.round((a + b) / 2);
    }
    // Single figure: take the first plausible amount.
    const single = norm.match(/(\d+(?:\.\d+)?)\s*([kKmM])?/);
    if (single) {
      const n = this.toNumber(single[1], single[2]);
      if (n >= 100) return Math.round(n);
    }
    return null;
  }
  private toNumber(n: string, suffix?: string): number {
    const base = parseFloat(n);
    if (suffix?.toLowerCase() === 'k') return base * 1000;
    if (suffix?.toLowerCase() === 'm') return base * 1_000_000;
    return base;
  }
  private midOfBand(s?: string | null): number | null {
    if (!s) return null;
    return this.parseBudgetString(s);
  }
  /** v1.39d — LOW end of a budget band (e.g. "£15k–£20k" → 15000).
      Used for the per-category ballpark_budget so the Estimate tab
      starts conservative. Falls back to parseBudgetString if the
      value is a single figure rather than a range. */
  private lowOfBand(s?: string | null): number | null {
    if (!s) return null;
    const norm = s.replace(/[£,]/g, '').replace(/–|—/g, '-');
    if (/unknown|tbc/i.test(norm)) return null;
    const range = norm.match(/(\d+(?:\.\d+)?)\s*([kKmM])?\s*-\s*(\d+(?:\.\d+)?)\s*([kKmM])?/);
    if (range) return Math.round(this.toNumber(range[1], range[2]));
    return this.parseBudgetString(s);
  }
}
