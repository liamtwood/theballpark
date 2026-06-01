import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarModule } from 'primeng/sidebar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';
import { Subscription } from 'rxjs';

import { AddCategoryService, AddCategoryRequest } from '../../../core/services/add-category.service';
import { ProjectService } from '../../../core/services/project.service';
import { Category } from '../../../models';

/**
 * v1.65b — single shared "Add category" drawer. Opened from the Plan
 * tab and the project Marketplace via AddCategoryService.open().
 * Callers supply the list of unused categories; the drawer posts the
 * upsert and emits `added$` on success.
 */
@Component({
  selector: 'app-add-category-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, SidebarModule, ToastModule, LucideAngularModule],
  providers: [MessageService],
  template: `
    <p-sidebar [(visible)]="visible"
               (visibleChange)="onVisibleChange($event)"
               position="right"
               [style]="{ width: '380px' }"
               styleClass="bp-addcat-drawer"
               [showCloseIcon]="false">
      <div class="bp-addcat-head">
        <div>
          <div class="bp-drawer-label">Scope</div>
          <div class="bp-addcat-title">Add a category</div>
        </div>
        <button type="button" class="bp-icon-btn" (click)="close()">
          <lucide-icon name="x" [size]="16"></lucide-icon>
        </button>
      </div>
      <div class="bp-addcat-body">
        <div class="bp-addcat-hint">
          Categories already in this project are hidden. Click one to add it.
        </div>
        <div *ngFor="let c of req?.unused"
             role="button" tabindex="0" class="bp-addcat-cat"
             (click)="add(c)"
             (keydown.enter)="add(c)">
          <div class="bp-addcat-ic">
            <lucide-icon [name]="c.icon_name || 'layers'" [size]="14"></lucide-icon>
          </div>
          <span class="bp-addcat-name">{{ c.name }}</span>
          <lucide-icon class="bp-addcat-plus" name="plus" [size]="16"></lucide-icon>
        </div>
        <div *ngIf="!req?.unused?.length" class="bp-addcat-empty">
          Every catalogue category is already in this project.
        </div>
      </div>
    </p-sidebar>
    <p-toast></p-toast>
  `,
  styles: [`
    :host ::ng-deep .bp-addcat-drawer .p-sidebar-content { padding: 0; }
    .bp-addcat-head { display: flex; align-items: flex-start; justify-content: space-between;
      padding: 16px 18px; border-bottom: 0.5px solid var(--color-border); }
    .bp-addcat-title { font-family: var(--font-display); font-size: var(--text-xl);
      color: var(--color-text-primary); margin-top: 2px; }
    .bp-addcat-body { padding: 14px 18px; }
    .bp-addcat-hint { font-size: var(--text-sm); color: var(--color-text-muted);
      line-height: 1.5; margin-bottom: 12px; }
    .bp-addcat-cat { display: flex; align-items: center; gap: 10px; width: 100%;
      background: var(--color-surface); border: 0.5px solid var(--color-border);
      border-radius: var(--radius-button); padding: 12px 14px; margin-bottom: 6px;
      cursor: pointer; font-family: var(--font-body); transition: all 0.12s; }
    .bp-addcat-cat:hover { border-color: var(--theme-border); }
    .bp-addcat-ic { width: 26px; height: 26px; border-radius: 50%;
      background: var(--theme-bg); color: var(--theme-accent);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .bp-addcat-name { flex: 1; text-align: left; font-size: var(--text-base);
      font-weight: 600; color: var(--color-text-primary); }
    .bp-addcat-plus { color: var(--theme-accent); display: inline-flex; }
    .bp-addcat-empty { font-size: var(--text-sm); color: var(--color-text-muted);
      text-align: center; padding: 20px 8px; }
  `]
})
export class AddCategoryDrawerComponent implements OnInit, OnDestroy {
  visible = false;
  req: AddCategoryRequest | null = null;

  private sub?: Subscription;

  constructor(
    private svc: AddCategoryService,
    private projectSvc: ProjectService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sub = this.svc.request$.subscribe(req => {
      this.req = req;
      this.visible = !!req;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  add(c: Category): void {
    if (!this.req) return;
    const projectId = this.req.projectId;
    this.projectSvc.upsertCategory(projectId, c.id, {}).subscribe({
      next: () => {
        this.svc.markAdded(projectId, c);
        this.msg.add({ severity: 'success', summary: c.name + ' added', life: 2000 });
        this.svc.close();
      },
      error: () => this.msg.add({
        severity: 'error', summary: 'Failed to add category', life: 3000
      })
    });
  }

  onVisibleChange(open: boolean): void { if (!open) this.close(); }
  close(): void { this.svc.close(); }
}
