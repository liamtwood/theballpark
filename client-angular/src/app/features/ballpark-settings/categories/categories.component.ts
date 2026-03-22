import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputSwitchModule } from 'primeng/inputswitch';
import { SidebarModule } from 'primeng/sidebar';
import { ChipsModule } from 'primeng/chips';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';
import { CategoryService } from '../../../core/services/category.service';
import { Category } from '../../../models';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ImageUploadPanelComponent } from '../../../shared/components/image-upload-panel/image-upload-panel.component';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    LucideAngularModule,
    ButtonModule, InputTextModule, InputTextareaModule, InputSwitchModule,
    SidebarModule, ChipsModule, ToastModule,
    LoadingSpinnerComponent, ImageUploadPanelComponent
  ],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading">
      <div class="bp-team-title-bar">
        <h2 class="bp-page-title">Categories</h2>
      </div>

      <div class="bp-content-pad">

        <!-- ENABLED -->
        <div class="bp-section-header">
          <span class="bp-section-title">ENABLED</span>
          <p-button label="Add category" icon="pi pi-plus" styleClass="p-button-outlined" (onClick)="addCategory()"></p-button>
        </div>

        <div class="bp-cat-grid" *ngIf="enabledCategories().length > 0">
          <div *ngFor="let c of enabledCategories()" class="bp-cat-card" (click)="openCategory(c)">
            <div class="bp-cat-img"
              [style.background-image]="c.cover_image_url ? 'url(' + c.cover_image_url + ')' : null"
              [style.background-color]="!c.cover_image_url ? (c.card_color || 'var(--theme-bg)') : null">
              <span class="bp-cat-status-badge enabled">✓</span>
            </div>
            <div class="bp-cat-body">
              <span class="bp-cat-name">{{ c.name }}</span>
            </div>
          </div>
        </div>
        <p *ngIf="enabledCategories().length === 0" class="bp-muted-text mb-6">No enabled categories.</p>

        <!-- DISABLED -->
        <div class="bp-section-header mt-6" *ngIf="disabledCategories().length > 0">
          <span class="bp-section-title">DISABLED</span>
        </div>
        <div class="bp-cat-grid" *ngIf="disabledCategories().length > 0">
          <div *ngFor="let c of disabledCategories()" class="bp-cat-card bp-cat-disabled" (click)="openCategory(c)">
            <div class="bp-cat-img"
              [style.background-image]="c.cover_image_url ? 'url(' + c.cover_image_url + ')' : null"
              [style.background-color]="!c.cover_image_url ? (c.card_color || 'var(--theme-bg)') : null">
              <span class="bp-cat-status-badge disabled">✕</span>
            </div>
            <div class="bp-cat-body">
              <span class="bp-cat-name">{{ c.name }}</span>
            </div>
          </div>
        </div>

      </div>
    </ng-container>

    <!-- CATEGORY DRAWER -->
    <p-sidebar [(visible)]="showCatDrawer" position="right"
      styleClass="bp-drawer" [style]="{width:'480px'}"
      (onHide)="closeCatDrawer()">

      <ng-template pTemplate="header">
        <div class="bp-drawer-header-row">
          <div class="bp-drawer-header">
            <span class="bp-drawer-label">CATEGORIES</span>
            <div class="bp-drawer-title">{{ catForm.name || 'New category' }}</div>
          </div>
          <button class="bp-icon-btn" (click)="closeCatDrawer()" title="Close">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </ng-template>

      <div class="bp-drawer-body" style="background:var(--color-surface);">
        <div class="bp-section-header mb-4">
          <span class="bp-section-title">CATEGORY</span>
          <div class="flex items-center gap-1">
            <ng-container *ngIf="!editingCat">
              <button class="bp-icon-btn" (click)="startEditCat()" title="Edit">
                <lucide-icon name="square-pen" [size]="14"></lucide-icon>
              </button>
            </ng-container>
            <ng-container *ngIf="editingCat">
              <button class="bp-icon-btn bp-icon-save" (click)="submitCat()" [disabled]="!catForm.name?.trim()" title="Save">
                <i class="pi pi-check"></i>
              </button>
              <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEditCat()" title="Cancel">
                <i class="pi pi-times"></i>
              </button>
            </ng-container>
          </div>
        </div>

        <!-- VIEW MODE -->
        <ng-container *ngIf="!editingCat">
          <div class="mb-4">
            <label class="bp-field-label">Name</label>
            <input pInputText [value]="catForm.name" class="w-full bp-field-readonly" readonly/>
          </div>
          <div class="mb-4">
            <label class="bp-field-label">Description</label>
            <textarea pInputTextarea [value]="catForm.description || '—'" class="w-full bp-field-readonly" readonly [rows]="3" style="resize:none;"></textarea>
          </div>
          <div class="mb-4">
            <label class="bp-field-label">Status</label>
            <input pInputText [value]="catForm.enabled ? 'Enabled' : 'Disabled'" class="w-full bp-field-readonly" readonly/>
          </div>
          <div>
            <label class="bp-field-label">Tags</label>
            <input pInputText [value]="catForm.tags?.join(', ') || '—'" class="w-full bp-field-readonly" readonly/>
          </div>
        </ng-container>

        <!-- EDIT MODE -->
        <ng-container *ngIf="editingCat">
          <div class="mb-4">
            <label class="bp-field-label">Name</label>
            <input pInputText [(ngModel)]="catForm.name" class="w-full bp-input-edit"/>
          </div>
          <div class="mb-4">
            <label class="bp-field-label">Description</label>
            <textarea pInputTextarea [(ngModel)]="catForm.description" class="w-full bp-input-edit" [rows]="3" style="resize:none;" placeholder="Describe this category..."></textarea>
          </div>
          <div class="mb-4">
            <label class="bp-field-label">Status</label>
            <div class="flex items-center gap-3 mt-1">
              <p-inputSwitch [(ngModel)]="catForm.enabled"></p-inputSwitch>
              <span style="font-size:var(--text-sm);color:var(--color-text-secondary);">
                {{ catForm.enabled ? 'Enabled' : 'Disabled' }}
              </span>
            </div>
          </div>
          <div>
            <label class="bp-field-label">Tags <span style="font-size:10px;color:var(--color-text-muted);font-weight:400;">— type and press Enter to add</span></label>
            <p-chips [(ngModel)]="catForm.tags" styleClass="w-full bp-input-edit" [allowDuplicate]="false" [addOnBlur]="true" placeholder="e.g. build, structure..."></p-chips>
          </div>
        </ng-container>

        <div *ngIf="showCatImagePanel" class="mt-4">
          <app-image-upload-panel
            [entityId]="catForm.id || 'new'"
            type="category"
            [existingCoverUrl]="catForm.cover_image_url || ''"
            [existingCardColor]="catForm.card_color || ''"
            (imagesUpdated)="onCatImageUpdated($event)"
            (closed)="showCatImagePanel = false">
          </app-image-upload-panel>
        </div>
      </div>

      <ng-template pTemplate="footer">
        <div class="bp-drawer-ops-footer">
          <div>
            <p-button *ngIf="catForm.id" label="Delete category" icon="pi pi-trash"
              styleClass="p-button-danger" (onClick)="deleteCategory()">
            </p-button>
          </div>
          <div>
            <p-button label="Add image" icon="pi pi-image"
              styleClass="p-button-outlined" (onClick)="showCatImagePanel = !showCatImagePanel">
            </p-button>
          </div>
        </div>
      </ng-template>

    </p-sidebar>

    <p-toast></p-toast>
  `,
  styles: [`
    /* ── CATEGORY GRID ── */
    .bp-cat-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      max-width: 760px;
      margin: 0 auto 24px;
    }
    @media (max-width: 700px) { .bp-cat-grid { grid-template-columns: repeat(2, 1fr); } }
    .bp-cat-card         { border: 0.5px solid var(--color-border); border-radius: 10px; overflow: hidden; cursor: pointer; transition: border-color 0.15s; }
    .bp-cat-card:hover   { border-color: var(--theme-accent); }
    .bp-cat-disabled     { opacity: 0.45; }
    .bp-cat-img          { width: 100%; aspect-ratio: 4 / 3; background-size: cover; background-position: center; background-color: var(--theme-bg); position: relative; }
    .bp-cat-body         { padding: 10px 14px; }
    .bp-cat-name         { font-size: 13px; font-weight: 500; color: var(--color-text-primary); }
    .bp-cat-status-badge { position: absolute; top: 8px; right: 8px; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; }
    .bp-cat-status-badge.enabled  { background: #DCFCE7; color: #166534; border: 0.5px solid #86EFAC; }
    .bp-cat-status-badge.disabled { background: #F3F4F6; color: #9CA3AF; border: 0.5px solid #D1D5DB; }
  `]
})
export class CategoriesComponent implements OnInit {
  categories: Category[] = [];
  loading = true;

  showCatDrawer    = false;
  editingCat       = false;
  showCatImagePanel = false;
  catForm: any     = { id: '', name: '', description: '', tags: [], cover_image_url: '', card_color: '', enabled: true };
  private catSnapshot: any = null;

  constructor(
    private catSvc: CategoryService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.catSvc.getAll().subscribe({
      next: (cats) => {
        this.categories = (cats || []).map((c: any) => ({ ...c, enabled: c.enabled !== false }));
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  enabledCategories()  { return this.categories.filter((c: any) => c.enabled !== false); }
  disabledCategories() { return this.categories.filter((c: any) => c.enabled === false); }

  openCategory(c: any) {
    this.catForm = { ...c, tags: c.tags ? [...c.tags] : [] };
    this.editingCat = false;
    this.showCatImagePanel = false;
    this.showCatDrawer = true;
    this.cdr.detectChanges();
  }

  addCategory() {
    this.catForm = { id: '', name: '', description: '', tags: [], cover_image_url: '', card_color: '', enabled: true };
    this.editingCat = true;
    this.showCatImagePanel = false;
    this.showCatDrawer = true;
    this.cdr.detectChanges();
  }

  startEditCat() { this.catSnapshot = { ...this.catForm, tags: [...(this.catForm.tags || [])] }; this.editingCat = true; this.cdr.detectChanges(); }

  cancelEditCat() {
    if (this.catSnapshot) this.catForm = { ...this.catSnapshot, tags: [...(this.catSnapshot.tags || [])] };
    this.editingCat = false;
    this.cdr.detectChanges();
  }

  submitCat() {
    if (!this.catForm.name?.trim()) return;
    const payload = {
      name: this.catForm.name, description: this.catForm.description,
      cover_image_url: this.catForm.cover_image_url, card_color: this.catForm.card_color,
      tags: this.catForm.tags, enabled: this.catForm.enabled
    };
    const obs = !this.catForm.id ? this.catSvc.create(payload) : this.catSvc.patch(this.catForm.id, payload);
    obs.subscribe({
      next: (saved: any) => {
        const idx = this.categories.findIndex((c: any) => c.id === saved.id);
        if (idx > -1) { this.categories[idx] = { ...saved, enabled: saved.enabled !== false }; }
        else { this.categories = [...this.categories, { ...saved, enabled: saved.enabled !== false }]; }
        this.categories = [...this.categories];
        this.editingCat = false;
        this.msg.add({ severity: 'success', summary: 'Category saved' });
        this.cdr.detectChanges();
      },
      error: () => { this.msg.add({ severity: 'error', summary: 'Failed to save category' }); }
    });
  }

  closeCatDrawer() { this.showCatDrawer = false; this.editingCat = false; this.showCatImagePanel = false; this.cdr.detectChanges(); }

  deleteCategory() {
    if (!this.catForm.id) return;
    this.categories = this.categories.filter((c: any) => c.id !== this.catForm.id);
    this.closeCatDrawer();
    this.msg.add({ severity: 'success', summary: 'Category deleted' });
    this.cdr.detectChanges();
  }

  onCatImageUpdated(urls: { coverUrl: string; cardColor?: string }) {
    if (urls.coverUrl !== undefined) this.catForm.cover_image_url = urls.coverUrl;
    if (urls.cardColor !== undefined) this.catForm.card_color = urls.cardColor;
    const idx = this.categories.findIndex((c: any) => c.id === this.catForm.id);
    if (idx > -1) { this.categories[idx] = { ...this.categories[idx], ...this.catForm }; this.categories = [...this.categories]; }
    if (this.catForm.id) {
      const patch: any = {};
      if (urls.coverUrl !== undefined) patch.cover_image_url = urls.coverUrl;
      if (urls.cardColor !== undefined) patch.card_color = urls.cardColor;
      this.catSvc.patch(this.catForm.id, patch).subscribe();
    }
    this.cdr.detectChanges();
  }
}
