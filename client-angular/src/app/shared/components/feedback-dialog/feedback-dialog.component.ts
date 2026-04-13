import { Component, EventEmitter, Input, Output, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CategoryService } from '../../../core/services/category.service';
import { FeedbackService } from '../../../core/services/feedback.service';
import { Category } from '../../../models';

interface CategoryOption {
  id: string;
  name: string;
  tagline?: string;
  emoji: string;
}

@Component({
  selector: 'app-feedback-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    DialogModule, InputTextModule, InputTextareaModule, ButtonModule, ToastModule
  ],
  providers: [MessageService],
  template: `
    <p-dialog [(visible)]="visible" [modal]="true" [closable]="true"
      [style]="{width:'520px'}" styleClass="bp-modal"
      header="Log feedback"
      (onHide)="onClose()">

      <!-- STEP 1: Category -->
      <div *ngIf="step === 1" class="bp-fb-step">
        <p class="bp-fb-prompt">What type of feedback?</p>
        <div class="bp-fb-cat-grid">
          <button *ngFor="let cat of categoryOptions"
            class="bp-fb-cat-btn"
            [class.active]="selectedCategory?.id === cat.id"
            (click)="selectCategory(cat)">
            <span class="bp-fb-cat-emoji">{{ cat.emoji }}</span>
            <span class="bp-fb-cat-name">{{ cat.name }}</span>
            <span class="bp-fb-cat-tagline">{{ cat.tagline }}</span>
          </button>
        </div>
      </div>

      <!-- STEP 2: Sub-category -->
      <div *ngIf="step === 2" class="bp-fb-step">
        <p class="bp-fb-prompt">{{ selectedCategory?.name }} — pick a type</p>
        <div class="bp-fb-sub-row">
          <button *ngFor="let sub of subcategories"
            class="bp-fb-sub-pill"
            [class.active]="selectedSubcategory?.id === sub.id"
            (click)="selectSubcategory(sub)">
            {{ sub.name }}
          </button>
        </div>
      </div>

      <!-- STEP 3: Detail -->
      <div *ngIf="step === 3" class="bp-fb-step">
        <div class="bp-fb-context">
          <span class="bp-fb-context-cat">{{ selectedCategory?.emoji }} {{ selectedCategory?.name }}</span>
          <span class="bp-fb-context-sep" *ngIf="selectedSubcategory"> &rsaquo; </span>
          <span class="bp-fb-context-sub" *ngIf="selectedSubcategory">{{ selectedSubcategory.name }}</span>
        </div>
        <div class="mb-4">
          <label class="bp-field-label">Title *</label>
          <input pInputText [(ngModel)]="title" class="w-full bp-input-edit" [placeholder]="titlePlaceholder"/>
        </div>
        <div>
          <label class="bp-field-label">Notes</label>
          <textarea pInputTextarea [(ngModel)]="notes" class="w-full bp-input-edit" [rows]="3"
            style="resize:none;" placeholder="Any extra detail..."></textarea>
        </div>
      </div>

      <ng-template pTemplate="footer">
        <div class="bp-fb-footer">
          <button class="bp-btn-cancel" (click)="onClose()">Cancel</button>
          <button *ngIf="step === 3" class="bp-btn-save"
            [disabled]="!title?.trim()" (click)="submit()">
            Submit
          </button>
        </div>
      </ng-template>
    </p-dialog>
    <p-toast></p-toast>
  `,
  styles: [`
    .bp-fb-step { padding: 8px 0; }
    .bp-fb-prompt {
      font-size: 14px; font-weight: 500; color: var(--color-text-primary);
      margin-bottom: 16px;
    }

    /* Category 2x2 grid */
    .bp-fb-cat-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
    }
    .bp-fb-cat-btn {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 20px 12px; border-radius: 10px; cursor: pointer;
      border: 1px solid var(--color-border); background: var(--color-surface);
      transition: all 0.15s;
    }
    .bp-fb-cat-btn:hover { border-color: var(--theme-accent); }
    .bp-fb-cat-btn.active {
      border-color: var(--theme-accent); background: var(--theme-bg);
    }
    .bp-fb-cat-emoji { font-size: 28px; line-height: 1; }
    .bp-fb-cat-name {
      font-size: 14px; font-weight: 600; color: var(--color-text-primary);
    }
    .bp-fb-cat-tagline {
      font-size: 11px; color: var(--color-text-muted); text-align: center;
    }

    /* Sub-category pills */
    .bp-fb-sub-row { display: flex; flex-wrap: wrap; gap: 8px; }
    .bp-fb-sub-pill {
      padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 500;
      border: 1px solid var(--color-border); background: var(--color-surface);
      color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s;
      font-family: var(--font-body);
    }
    .bp-fb-sub-pill:hover { border-color: var(--theme-accent); color: var(--theme-accent); }
    .bp-fb-sub-pill.active {
      border-color: var(--theme-accent); background: var(--theme-accent);
      color: var(--color-surface);
    }

    /* Context breadcrumb */
    .bp-fb-context {
      font-size: 12px; color: var(--color-text-muted); margin-bottom: 16px;
      display: flex; align-items: center; gap: 4px;
    }
    .bp-fb-context-cat { font-weight: 500; }
    .bp-fb-context-sub { font-weight: 500; color: var(--theme-accent); }

    /* Footer */
    .bp-fb-footer { display: flex; justify-content: flex-end; gap: 8px; }
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
  `]
})
export class FeedbackDialogComponent implements OnInit {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() submitted = new EventEmitter<void>();

  step = 1;
  allCategories: Category[] = [];
  categoryOptions: CategoryOption[] = [];
  subcategories: Category[] = [];
  selectedCategory: CategoryOption | null = null;
  selectedSubcategory: Category | null = null;
  title = '';
  notes = '';
  titlePlaceholder = '';

  private emojiMap: Record<string, string> = {
    'Bug': '\uD83D\uDC1B',
    'Enhancement': '\uD83D\uDCA1',
    'Question': '\u2753',
    'Prompt': '\uD83D\uDCDD'
  };

  private placeholderMap: Record<string, string> = {
    'Bug': "What's broken?",
    'Enhancement': 'What would you like?',
    'Question': 'What do you want to know?',
    'Prompt': 'Describe the requirement'
  };

  constructor(
    private catSvc: CategoryService,
    private feedbackSvc: FeedbackService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.catSvc.getAll('feedback').subscribe({
      next: (cats) => {
        this.allCategories = cats || [];
        this.categoryOptions = this.allCategories
          .filter(c => !c.parent_id)
          .map(c => ({
            id: c.id,
            name: c.name,
            tagline: c.tagline,
            emoji: this.emojiMap[c.name] || '\uD83D\uDCCC'
          }));
        this.cdr.detectChanges();
      }
    });
  }

  selectCategory(cat: CategoryOption) {
    this.selectedCategory = cat;
    this.selectedSubcategory = null;
    this.titlePlaceholder = this.placeholderMap[cat.name] || 'Describe your feedback';
    this.subcategories = this.allCategories.filter(c => c.parent_id === cat.id);
    this.step = this.subcategories.length ? 2 : 3;
    this.cdr.detectChanges();
  }

  selectSubcategory(sub: Category) {
    this.selectedSubcategory = sub;
    this.step = 3;
    this.cdr.detectChanges();
  }

  submit() {
    if (!this.title?.trim()) return;
    this.feedbackSvc.create({
      category_id: this.selectedCategory?.id,
      subcategory_id: this.selectedSubcategory?.id,
      title: this.title.trim(),
      notes: this.notes?.trim() || undefined,
      page_url: window.location.pathname
    }).subscribe({
      next: () => {
        this.msg.add({ severity: 'success', summary: 'Logged \u2713' });
        this.submitted.emit();
        this.reset();
        this.visible = false;
        this.visibleChange.emit(false);
        this.cdr.detectChanges();
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Failed to log feedback' });
      }
    });
  }

  onClose() {
    this.reset();
    this.visible = false;
    this.visibleChange.emit(false);
  }

  private reset() {
    this.step = 1;
    this.selectedCategory = null;
    this.selectedSubcategory = null;
    this.title = '';
    this.notes = '';
  }
}
