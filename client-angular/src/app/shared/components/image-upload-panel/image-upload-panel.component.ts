import { Component, Input, Output, EventEmitter, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { CheckboxModule } from 'primeng/checkbox';
import { firstValueFrom } from 'rxjs';
import { ImageProcessingService } from '../../services/image-processing.service';
import { StorageService } from '../../services/storage.service';
import { ApiService } from '../../../core/services/api.service';
import { ModalComponent } from '../modal/modal.component';

@Component({
  selector: 'app-image-upload-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, CheckboxModule, ModalComponent],
  template: `
    <app-modal
      title="Edit images"
      [subtitle]="subtitle"
      saveLabel="Save images"
      [saving]="processing"
      [savingLabel]="statusText"
      (close)="cancel()"
      (confirm)="save()">

      <!-- TAB BAR -->
      <div class="iup-tabs">
        <button class="iup-tab" [class.active]="activeTab === 'upload'" (click)="activeTab = 'upload'">Upload</button>
        <button class="iup-tab" [class.active]="activeTab === 'search'" (click)="activeTab = 'search'">Search</button>
        <button class="iup-tab" [class.active]="activeTab === 'icon'" (click)="activeTab = 'icon'">Icon</button>
      </div>

      <!-- ═══ UPLOAD TAB ═══ -->
      <ng-container *ngIf="activeTab === 'upload'">

      <!-- Cover / hero image -->
      <div class="iup-section">
        <div class="iup-label">
          {{ type === 'supplier' ? 'Portfolio / hero image' : 'Project / venue image' }}
        </div>

        <div *ngIf="!coverPreview"
             class="iup-drop"
             (click)="coverInput.click()"
             (dragover)="$event.preventDefault()"
             (drop)="onDrop($event, 'cover')">
          <lucide-icon name="image" [size]="20" class="iup-drop-icon"></lucide-icon>
          <span class="iup-drop-text">Click to upload or drag & drop</span>
          <span class="iup-drop-hint">
            {{ type === 'supplier' ? 'JPG, PNG — show your best work' : 'JPG, PNG — recommended 1200×800px' }}
          </span>
          <input #coverInput type="file" accept="image/*"
                 (change)="onFileSelect($event, 'cover')"
                 style="display:none"/>
        </div>

        <div *ngIf="coverPreview" class="iup-preview">
          <img [src]="coverPreview" class="iup-thumb"/>
          <span class="iup-filename">{{ coverFile ? coverFile.name : 'current image' }}</span>
          <button class="iup-remove" (click)="clearFile('cover')" title="Remove image">
            <lucide-icon name="x" [size]="12"></lucide-icon>
          </button>
        </div>

        <button *ngIf="coverPreview && !coverFile"
                class="iup-replace"
                (click)="coverInput2.click()">
          Click to replace current image
          <input #coverInput2 type="file" accept="image/*"
                 (change)="onFileSelect($event, 'cover')"
                 style="display:none"/>
        </button>

        <div class="flex items-center gap-2 mt-3" *ngIf="coverFile">
          <p-checkbox [(ngModel)]="coverRemoveBg" [binary]="true" label="Remove background"></p-checkbox>
          <span class="text-xs" style="color:var(--theme-accent)">  (auto-detects light & dark)</span>
        </div>

        <div class="iup-display-toggle" *ngIf="coverPreview && (type === 'supplier' || type === 'item')">
          <div class="iup-label" style="margin-top:12px">Display as</div>
          <div class="iup-toggle-row">
            <button class="iup-toggle-opt" [class.active]="imageDisplay === 'cover'" (click)="imageDisplay = 'cover'">
              Cover photo
            </button>
            <button class="iup-toggle-opt" [class.active]="imageDisplay === 'contain'" (click)="imageDisplay = 'contain'">
              Logo
            </button>
          </div>
        </div>
      </div>

      <!-- Card background colour (shown for both project and supplier when no image) -->
      <div class="iup-section">
        <div class="iup-label">Card background colour</div>
        <div class="iup-hint-text">Used when no image is uploaded</div>
        <div class="iup-swatches">
          <div *ngFor="let c of cardColors"
               class="iup-swatch"
               [class.selected]="selectedColor === c.value"
               [style.background]="c.gradient"
               (click)="selectedColor = c.value"
               [title]="c.label">
            <span *ngIf="selectedColor === c.value" class="iup-swatch-check">✓</span>
          </div>
        </div>
      </div>

      <!-- Logo (project + supplier) -->
      <div class="iup-section" *ngIf="type === 'project' || type === 'supplier'">
        <div class="iup-label">{{ type === 'supplier' ? 'Company logo' : 'Client logo' }}</div>

        <div *ngIf="!logoPreview"
             class="iup-drop"
             (click)="logoInput.click()"
             (dragover)="$event.preventDefault()"
             (drop)="onDrop($event, 'logo')">
          <lucide-icon name="image" [size]="20" class="iup-drop-icon"></lucide-icon>
          <span class="iup-drop-text">Click to upload or drag & drop</span>
          <span class="iup-drop-hint">PNG with transparency recommended</span>
          <input #logoInput type="file" accept="image/*"
                 (change)="onFileSelect($event, 'logo')"
                 style="display:none"/>
        </div>

        <div *ngIf="logoPreview" class="iup-preview">
          <img [src]="logoPreview" class="iup-thumb"/>
          <span class="iup-filename">{{ logoFile ? logoFile.name : 'current logo' }}</span>
          <button class="iup-remove" (click)="clearFile('logo')" title="Remove logo">
            <lucide-icon name="x" [size]="12"></lucide-icon>
          </button>
        </div>

        <button *ngIf="logoPreview && !logoFile"
                class="iup-replace"
                (click)="logoInput2.click()">
          Click to replace current logo
          <input #logoInput2 type="file" accept="image/*"
                 (change)="onFileSelect($event, 'logo')"
                 style="display:none"/>
        </button>

        <div class="flex items-center gap-2 mt-3" *ngIf="logoFile">
          <p-checkbox [(ngModel)]="logoRemoveBg" [binary]="true" label="Remove background"></p-checkbox>
          <span class="text-xs" style="color:var(--theme-accent)">  (auto-detects light & dark)</span>
        </div>
      </div>

      </ng-container>

      <!-- ═══ SEARCH TAB ═══ -->
      <ng-container *ngIf="activeTab === 'search'">

      <!-- Unsplash search -->
      <div class="iup-section">
        <div class="iup-label">Search images</div>
        <div class="iup-search-bar">
          <input class="iup-search-input" [(ngModel)]="unsplashQuery"
            (keydown.enter)="searchUnsplash()" placeholder="Search photos..."/>
          <button class="iup-search-btn" (click)="searchUnsplash()" [disabled]="unsplashSearching">
            <lucide-icon [name]="unsplashSearching ? 'loader-circle' : 'search'" [size]="14"
              [class.iup-spinner]="unsplashSearching"></lucide-icon>
          </button>
        </div>
        <div class="iup-unsplash-grid" *ngIf="unsplashResults.length">
          <div *ngFor="let img of unsplashResults" class="iup-unsplash-thumb"
            [class.selected]="selectedUnsplashUrl === img.url"
            (click)="selectUnsplash(img)">
            <img [src]="img.thumb" [alt]="img.description" loading="lazy"/>
          </div>
        </div>
        <div class="iup-unsplash-credit" *ngIf="unsplashResults.length">
          Photos by <a href="https://unsplash.com" target="_blank" rel="noopener">Unsplash</a>
        </div>
      </div>

      </ng-container>

      <!-- ═══ ICON TAB ═══ -->
      <ng-container *ngIf="activeTab === 'icon'">

      <!-- Icon picker -->
      <div class="iup-section">
        <div class="iup-label">Lucide icon</div>
        <div class="iup-hint-text">Select an icon to display when no image is set</div>
        <div class="iup-icon-grid">
          <button *ngFor="let ic of iconOptions" class="iup-icon-btn"
            [class.selected]="selectedIconName === ic"
            (click)="selectedIconName = ic">
            <lucide-icon [name]="ic" [size]="20"></lucide-icon>
            <span class="iup-icon-label">{{ ic }}</span>
          </button>
        </div>
        <div class="iup-label" style="margin-top:14px">Icon background</div>
        <div class="iup-swatches">
          <div *ngFor="let c of iconColors"
               class="iup-swatch"
               [class.selected]="selectedIconColor === c"
               [style.background]="c"
               (click)="selectedIconColor = c">
            <span *ngIf="selectedIconColor === c" class="iup-swatch-check">✓</span>
          </div>
        </div>
      </div>

      </ng-container>

      <!-- Status / error -->
      <div *ngIf="processing" class="iup-status">
        <lucide-icon name="loader-circle" [size]="14" class="iup-spinner"></lucide-icon>
        {{ statusText }}
      </div>
      <div *ngIf="errorText" class="iup-error">{{ errorText }}</div>

    </app-modal>
  `,
  styles: [`
    .iup-tabs {
      display: flex; gap: 0; border-bottom: 1px solid var(--color-border, #D9CFC2);
      margin-bottom: 16px;
    }
    .iup-tab {
      padding: 8px 16px; font-size: 13px; font-weight: 500;
      border: none; background: transparent; cursor: pointer;
      color: var(--color-text-muted, #6B7280); font-family: inherit;
      border-bottom: 2px solid transparent; transition: all 0.15s;
    }
    .iup-tab:hover { color: var(--color-text-primary, #374151); }
    .iup-tab.active {
      color: var(--theme-accent, #D97706);
      border-bottom-color: var(--theme-accent, #D97706);
    }
    .iup-section { margin-bottom: 20px; }
    .iup-section:last-of-type { margin-bottom: 0; }
    .iup-label {
      font-size: 11px; font-weight: 600; color: #374151;
      text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px;
    }
    .iup-hint-text {
      font-size: 11px; color: #9CA3AF; margin-bottom: 10px; margin-top: -4px;
    }
    .iup-drop {
      border: 1.5px dashed #D9CFC2; border-radius: 10px; padding: 20px;
      text-align: center; cursor: pointer; background: #FAFAF8;
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      transition: all 0.15s;
    }
    .iup-drop:hover { border-color: var(--theme-accent, #D97706); background: #FFFBEB; }
    .iup-drop-icon { color: #9CA3AF; margin-bottom: 4px; }
    .iup-drop-text { font-size: 13px; color: #6B7280; }
    .iup-drop-hint { font-size: 11px; color: #9CA3AF; }
    .iup-preview {
      display: flex; align-items: center; gap: 10px; padding: 10px;
      background: #F9FAFB; border-radius: 8px; border: 0.5px solid #E5E7EB;
    }
    .iup-thumb { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
    .iup-filename { flex: 1; font-size: 12px; color: #374151; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .iup-remove { background: none; border: none; cursor: pointer; color: #9CA3AF; padding: 4px; display: flex; align-items: center; flex-shrink: 0; }
    .iup-remove:hover { color: #DC2626; }
    .iup-replace {
      display: block; width: 100%; padding: 8px; margin-top: 8px;
      font-size: 12px; color: var(--theme-accent, #D97706); background: none;
      border: 0.5px dashed var(--theme-accent, #D97706); border-radius: 8px;
      cursor: pointer; font-family: inherit; text-align: center; transition: background 0.15s;
    }
    .iup-replace:hover { background: #FFFBEB; }
    .iup-swatches { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
    .iup-swatch {
      width: 36px; height: 36px; border-radius: 8px; cursor: pointer;
      border: 2px solid transparent; position: relative;
      transition: transform 0.15s, border-color 0.15s;
    }
    .iup-swatch:hover { transform: scale(1.1); }
    .iup-swatch.selected { border-color: #111827; }
    .iup-swatch-check {
      position: absolute; inset: 0; display: flex;
      align-items: center; justify-content: center;
      font-size: 14px; color: #fff; font-weight: 700;
    }
    .iup-color-preview {
      height: 48px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
    }
    .iup-color-preview-text { font-size: 11px; color: rgba(255,255,255,0.5); }
    .iup-status { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--theme-accent, #D97706); margin-top: 12px; }
    .iup-spinner { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .iup-error { font-size: 12px; color: #DC2626; margin-top: 10px; }
    .iup-icon-grid {
      display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px;
      max-height: 220px; overflow-y: auto; margin-bottom: 8px;
    }
    .iup-icon-btn {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      padding: 8px 4px; border-radius: 8px; cursor: pointer;
      border: 1.5px solid transparent; background: var(--color-surface, #FAFAF8);
      color: var(--color-text-muted, #6B7280); transition: all 0.15s;
      font-family: inherit;
    }
    .iup-icon-btn:hover { border-color: var(--color-border, #D9CFC2); }
    .iup-icon-btn.selected { border-color: var(--theme-accent, #D97706); background: var(--theme-bg, #FEF3C7); color: var(--theme-accent, #D97706); }
    .iup-icon-label { font-size: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
    .iup-search-bar { display: flex; gap: 6px; margin-bottom: 10px; }
    .iup-search-input {
      flex: 1; padding: 7px 10px; font-size: 13px; border: 1px solid var(--color-border, #D9CFC2);
      border-radius: 6px; outline: none; background: var(--color-surface, #FAFAF8);
      color: var(--color-text-primary, #374151); font-family: inherit;
    }
    .iup-search-input:focus { border-color: var(--theme-accent, #D97706); }
    .iup-search-btn {
      width: 34px; height: 34px; border-radius: 6px; border: 1px solid var(--color-border, #D9CFC2);
      background: var(--color-surface, #FAFAF8); cursor: pointer; display: flex;
      align-items: center; justify-content: center; color: var(--color-text-muted, #6B7280);
      transition: all 0.15s;
    }
    .iup-search-btn:hover:not(:disabled) { border-color: var(--theme-accent, #D97706); color: var(--theme-accent, #D97706); }
    .iup-unsplash-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 6px;
    }
    .iup-unsplash-thumb {
      aspect-ratio: 16/10; border-radius: 6px; overflow: hidden; cursor: pointer;
      border: 2px solid transparent; transition: border-color 0.15s;
    }
    .iup-unsplash-thumb:hover { border-color: var(--color-border, #D9CFC2); }
    .iup-unsplash-thumb.selected { border-color: var(--theme-accent, #D97706); }
    .iup-unsplash-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .iup-unsplash-credit { font-size: 10px; color: var(--color-text-muted, #9CA3AF); }
    .iup-unsplash-credit a { color: var(--theme-accent, #D97706); text-decoration: none; }
    .iup-toggle-row { display: flex; gap: 0; border: 0.5px solid #D9CFC2; border-radius: 8px; overflow: hidden; }
    .iup-toggle-opt { flex: 1; padding: 6px 12px; font-size: 12px; font-weight: 500; font-family: inherit; border: none; background: #FAFAF8; color: #6B7280; cursor: pointer; transition: all 0.15s; }
    .iup-toggle-opt.active { background: var(--theme-bg, #F5F0E8); color: var(--theme-accent, #D97706); font-weight: 600; }
  `]
})
export class ImageUploadPanelComponent implements OnInit {
  @Input() entityId = '';
  @Input() projectId = '';
  @Input() type: 'project' | 'supplier' | 'category' | 'logo' | 'item' = 'project';
  @Input() subtitle = '';
  @Input() existingCoverUrl = '';
  @Input() existingLogoUrl = '';
  @Input() existingCardColor = '';
  @Input() existingImageDisplay: 'cover' | 'contain' = 'cover';

  @Input() existingIconName = '';
  @Input() existingIconColor = '';
  @Input() searchTerm = '';

  @Output() imagesUpdated = new EventEmitter<{
    coverUrl: string;
    logoUrl: string;
    cardColor?: string;
    imageDisplay?: 'cover' | 'contain';
    iconName?: string;
    iconColor?: string;
  }>();
  @Output() closed = new EventEmitter<void>();

  coverFile: File | null = null;
  logoFile: File | null = null;
  coverPreview: string | null = null;
  logoPreview: string | null = null;
  coverRemoveBg = false;
  logoRemoveBg = true;
  processing = false;
  statusText = '';
  errorText = '';
  coverRemoved = false;
  logoRemoved = false;
  selectedColor = 'navy';
  imageDisplay: 'cover' | 'contain' = 'cover';
  selectedIconName = '';
  selectedIconColor = 'var(--theme-bg)';
  activeTab: 'upload' | 'search' | 'icon' = 'upload';
  unsplashQuery = '';
  unsplashResults: { url: string; thumb: string; description: string; photographer: string }[] = [];
  unsplashSearching = false;
  selectedUnsplashUrl = '';

  iconOptions = [
    'utensils', 'music', 'mic', 'tv', 'building-2', 'flower-2',
    'zap', 'truck', 'users', 'star', 'heart', 'camera', 'coffee',
    'shopping-bag', 'map-pin', 'award', 'briefcase', 'globe',
    'sparkles', 'wine', 'palette', 'layers'
  ];
  iconColors = [
    'var(--theme-bg)', 'var(--color-surface)',
    '#FEF3C7', '#DBEAFE', '#D1FAE5', '#FDE2E2', '#EDE9FE', '#FEE2E2'
  ];

  cardColors = [
    { value: 'navy',  label: 'Navy',   gradient: 'linear-gradient(160deg,#1a1a2e,#16213e)' },
    { value: 'slate', label: 'Slate',  gradient: 'linear-gradient(160deg,#2a2a2a,#1a1a1a)' },
    { value: 'wine',  label: 'Wine',   gradient: 'linear-gradient(160deg,#4a1a2e,#2e0d1a)' },
    { value: 'sky',   label: 'Sky',    gradient: 'linear-gradient(160deg,#a8d8ea,#6bb7d4)' },
    { value: 'peach', label: 'Peach',  gradient: 'linear-gradient(160deg,#f5c6aa,#e8a87c)' },
    { value: 'mint',  label: 'Mint',   gradient: 'linear-gradient(160deg,#a8e6cf,#6bc4a6)' },
    { value: 'forest',label: 'Forest', gradient: 'linear-gradient(160deg,#1a2e1a,#0d2b1a)' },
    { value: 'rust',  label: 'Rust',   gradient: 'linear-gradient(160deg,#2e1a1a,#1a0d0d)' },
  ];

  constructor(
    private imageService: ImageProcessingService,
    private storageService: StorageService,
    private api: ApiService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    if (!this.entityId && this.projectId) this.entityId = this.projectId;
    if (this.existingCoverUrl) this.coverPreview = this.existingCoverUrl;
    if (this.existingLogoUrl) this.logoPreview = this.existingLogoUrl;
    if (this.existingCardColor) this.selectedColor = this.existingCardColor;
    if (this.existingImageDisplay) this.imageDisplay = this.existingImageDisplay;
    if (this.existingIconName) this.selectedIconName = this.existingIconName;
    if (this.existingIconColor) this.selectedIconColor = this.existingIconColor;
    if (this.searchTerm) {
      this.unsplashQuery = this.searchTerm;
      this.searchUnsplash();
    }
  }

  searchUnsplash() {
    if (!this.unsplashQuery?.trim()) return;
    this.unsplashSearching = true;
    this.cdr.detectChanges();
    this.api.get<any[]>(`/unsplash/search?query=${encodeURIComponent(this.unsplashQuery)}`).subscribe({
      next: (results) => {
        this.unsplashResults = results || [];
        this.unsplashSearching = false;
        this.cdr.detectChanges();
      },
      error: () => { this.unsplashSearching = false; this.cdr.detectChanges(); }
    });
  }

  selectUnsplash(img: { url: string; thumb: string }) {
    this.selectedUnsplashUrl = img.url;
    this.coverPreview = img.url;
    this.coverFile = null; // Clear any uploaded file — using URL directly
    this.cdr.detectChanges();
  }

  getSelectedGradient(): string {
    return this.cardColors.find(c => c.value === this.selectedColor)?.gradient
      || this.cardColors[0].gradient;
  }

  onFileSelect(event: Event, type: 'cover' | 'logo') {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.setFile(input.files[0], type);
    if (type === 'cover') this.coverRemoved = false;
    else this.logoRemoved = false;
  }

  onDrop(event: DragEvent, type: 'cover' | 'logo') {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file?.type.startsWith('image/')) {
      this.setFile(file, type);
      if (type === 'cover') this.coverRemoved = false;
      else this.logoRemoved = false;
    }
  }

  clearFile(type: 'cover' | 'logo') {
    if (type === 'cover') {
      this.coverFile = null;
      this.coverPreview = null;
      this.coverRemoved = true;
    } else {
      this.logoFile = null;
      this.logoPreview = null;
      this.logoRemoved = true;
    }
    this.cdr.detectChanges();
  }

  cancel() { this.closed.emit(); }

  async save() {
    if (!this.entityId) return;
    this.processing = true;
    this.errorText = '';
    this.cdr.detectChanges();

    try {
      const bucket = (this.type === 'supplier' || this.type === 'item')
        ? this.storageService.suppliersBucket
        : this.storageService.projectsBucket;

      const basePath = this.type === 'supplier'
        ? `suppliers/${this.entityId}`
        : this.type === 'item'
        ? `items/${this.entityId}`
        : this.type === 'category'
        ? `categories/${this.entityId}`
        : this.type === 'logo'
        ? `logos/${this.entityId}`
        : `projects/${this.entityId}`;

      const apiEndpoint = this.type === 'supplier'
        ? `/suppliers/${this.entityId}/images`
        : this.type === 'item'
        ? `/items/${this.entityId}/images`
        : (this.type === 'category' || this.type === 'logo')
        ? null
        : `/projects/${this.entityId}/images`;

      let coverUrl = this.coverRemoved ? '' : this.existingCoverUrl;
      let logoUrl = this.logoRemoved ? '' : this.existingLogoUrl;

      if (this.selectedUnsplashUrl) {
        coverUrl = this.selectedUnsplashUrl;
      } else if (this.coverFile) {
        this.statusText = this.coverRemoveBg ? 'Removing background...' : 'Uploading image...';
        this.cdr.detectChanges();
        const blob = this.coverRemoveBg
          ? await this.imageService.processImage(this.coverFile, { removeBg: true, autoCrop: true, padding: 10 })
          : this.coverFile;
        this.statusText = 'Uploading...';
        this.cdr.detectChanges();
        coverUrl = await this.storageService.uploadImage(bucket, `${basePath}/cover`, blob);
      }

      if (this.logoFile && (this.type === 'project' || this.type === 'supplier')) {
        this.statusText = this.logoRemoveBg ? 'Removing logo background...' : 'Uploading logo...';
        this.cdr.detectChanges();
        const blob = this.logoRemoveBg
          ? await this.imageService.processImage(this.logoFile, { removeBg: true, autoCrop: true, padding: 4 })
          : this.logoFile;
        this.statusText = 'Uploading logo...';
        this.cdr.detectChanges();
        logoUrl = await this.storageService.uploadImage(bucket, `${basePath}/logo`, blob);
      }

      const patch: any = {};
      if (coverUrl !== this.existingCoverUrl) patch.cover_image_url = coverUrl;
      if (logoUrl !== this.existingLogoUrl) {
        patch[this.type === 'supplier' ? 'logo_url' : 'client_logo_url'] = logoUrl;
      }
      if (this.type === 'project' && this.selectedColor !== this.existingCardColor) {
        patch.card_color = this.selectedColor;
      }
      if ((this.type === 'supplier' || this.type === 'item') && this.imageDisplay !== this.existingImageDisplay) {
        patch.image_display = this.imageDisplay;
      }

      if (Object.keys(patch).length && apiEndpoint) {
        await firstValueFrom(this.api.patch(apiEndpoint, patch));
      }

      // Icon patch for categories
      if (this.type === 'category' && (this.selectedIconName || coverUrl !== this.existingCoverUrl)) {
        const catPatch: any = {};
        if (coverUrl !== this.existingCoverUrl) catPatch.cover_image_url = coverUrl;
        if (this.selectedIconName) catPatch.icon_name = this.selectedIconName;
        if (this.selectedIconColor) catPatch.icon_color = this.selectedIconColor;
        if (Object.keys(catPatch).length) {
          await firstValueFrom(this.api.patch(`/categories/${this.entityId}`, catPatch));
        }
      }

      this.imagesUpdated.emit({
        coverUrl,
        logoUrl,
        cardColor: this.type === 'project' ? this.selectedColor : undefined,
        imageDisplay: (this.type === 'supplier' || this.type === 'item') ? this.imageDisplay : undefined,
        iconName: this.selectedIconName || undefined,
        iconColor: this.selectedIconColor || undefined
      });
      this.closed.emit();

    } catch (err) {
      console.error('Image upload failed:', err);
      this.errorText = 'Upload failed — please try again';
    } finally {
      this.processing = false;
      this.cdr.detectChanges();
    }
  }

  private setFile(file: File, type: 'cover' | 'logo') {
    const url = URL.createObjectURL(file);
    if (type === 'cover') { this.coverFile = file; this.coverPreview = url; }
    else { this.logoFile = file; this.logoPreview = url; }
    this.cdr.detectChanges();
  }
}
