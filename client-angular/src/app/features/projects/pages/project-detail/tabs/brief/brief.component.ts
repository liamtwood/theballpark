import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef,
  ElementRef, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';

import { ProjectService } from '../../../../../../core/services/project.service';
import { CategoryService } from '../../../../../../core/services/category.service';
import { ProjectCategory, Category } from '../../../../../../models';
import { LoadingSpinnerComponent } from '../../../../../../shared/components/loading-spinner/loading-spinner.component';

/**
 * Project Brief tab — In Scope picker.
 *
 * Owns the (project, category) scope picker that used to live on the
 * old combined Brief tab. Splits cleanly: Event tab handles project
 * facts + raw_brief_text markdown; this tab handles which categories
 * are in scope and what brief each one should send to suppliers.
 *
 * Persistence is shared with the legacy build tab via
 * ProjectService.upsertCategory / removeCategory. Hard delete on
 * toggle off (consistent with the original brief tab); the Build tab
 * uses the soft-delete /scope endpoint instead.
 */
@Component({
  selector: 'app-brief',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, LucideAngularModule,
    ButtonModule, ToastModule,
    LoadingSpinnerComponent
  ],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading">
      <div class="bp-brief-body">

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
    .bp-brief-body { max-width: 860px; margin: 0 auto; padding: 28px 40px 100px; }

    .bp-brief-sec        { margin-bottom: 24px; }
    .bp-brief-sec-h      { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; gap: 12px; }
    .bp-brief-sec-label  { display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--theme-accent); }
    .bp-brief-sec-hint   { font-size: 11.5px; color: var(--color-text-secondary); }

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
      font-family: var(--font-sans);
      font-size: 13.5px;
      color: var(--color-text-primary);
      line-height: 1.55;
      background: transparent;
      border: none; outline: none; resize: none;
      padding: 0; margin: 0;
      font-weight: 400;
    }
    .bp-brief-row-prompt::placeholder {
      color: var(--color-text-secondary);
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
  `]
})
export class BriefComponent implements OnInit, OnDestroy {
  loading = true;
  pid = '';

  catalogueCategories: Category[] = [];
  projectCategories: ProjectCategory[] = [];
  selectedCategoryIds = new Set<string>();

  // Per-row autosave debouncers (categoryId → timeout handle).
  private rowSaveTimers = new Map<string, any>();

  // Scroll arrow state
  canScrollLeft = false;
  canScrollRight = false;

  @ViewChild('strip') stripRef?: ElementRef<HTMLElement>;

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
      catCategories:     this.catSvc.getAll('catalogue'),
      projectCategories: this.projSvc.getCategories(this.pid),
    }).subscribe({
      next: ({ catCategories, projectCategories }) => {
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
    for (const t of this.rowSaveTimers.values()) clearTimeout(t);
  }

  private applyProjectCategories(rows: ProjectCategory[]) {
    this.projectCategories = rows;
    this.selectedCategoryIds = new Set(rows.map(r => r.category_id));
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
          this.selectedCategoryIds.add(c.id);
          this.cdr.markForCheck();
        }
      });
    } else {
      this.selectedCategoryIds.add(c.id);
      const placeholder = this.makeRowFromCategory(c);
      this.projectCategories = [...this.projectCategories, placeholder];
      this.cdr.markForCheck();
      this.projSvc.upsertCategory(this.pid, c.id, {}).subscribe({
        next: row => {
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
    const el = this.stripRef?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: direction * 320, behavior: 'smooth' });
    setTimeout(() => this.updateStripArrows(), 250);
  }

  updateStripArrows() {
    const el = this.stripRef?.nativeElement;
    if (!el) return;
    this.canScrollLeft = el.scrollLeft > 2;
    this.canScrollRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    this.cdr.markForCheck();
  }

  // ── Footer ──
  goToBuild() { this.router.navigate(['/projects', this.pid, 'build']); }
}
