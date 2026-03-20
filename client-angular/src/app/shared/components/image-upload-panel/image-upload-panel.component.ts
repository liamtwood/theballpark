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

      <!-- Client logo (project only) -->
      <div class="iup-section" *ngIf="type === 'project'">
        <div class="iup-label">Client logo</div>

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

      <!-- Status / error -->
      <div *ngIf="processing" class="iup-status">
        <lucide-icon name="loader-circle" [size]="14" class="iup-spinner"></lucide-icon>
        {{ statusText }}
      </div>
      <div *ngIf="errorText" class="iup-error">{{ errorText }}</div>

    </app-modal>
  `,
  styles: [`
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
  `]
})
export class ImageUploadPanelComponent implements OnInit {
  @Input() entityId = '';
  @Input() projectId = '';
  @Input() type: 'project' | 'supplier' = 'project';
  @Input() subtitle = '';
  @Input() existingCoverUrl = '';
  @Input() existingLogoUrl = '';
  @Input() existingCardColor = '';

  @Output() imagesUpdated = new EventEmitter<{
    coverUrl: string;
    logoUrl: string;
    cardColor?: string;
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
      const bucket = this.type === 'supplier'
        ? this.storageService.suppliersBucket
        : this.storageService.projectsBucket;

      const basePath = this.type === 'supplier'
        ? `suppliers/${this.entityId}`
        : `projects/${this.entityId}`;

      const apiEndpoint = this.type === 'supplier'
        ? `/suppliers/${this.entityId}/images`
        : `/projects/${this.entityId}/images`;

      let coverUrl = this.coverRemoved ? '' : this.existingCoverUrl;
      let logoUrl = this.logoRemoved ? '' : this.existingLogoUrl;

      if (this.coverFile) {
        this.statusText = this.coverRemoveBg ? 'Removing background...' : 'Uploading image...';
        this.cdr.detectChanges();
        const blob = this.coverRemoveBg
          ? await this.imageService.processImage(this.coverFile, { removeBg: true, autoCrop: true, padding: 10 })
          : this.coverFile;
        this.statusText = 'Uploading...';
        this.cdr.detectChanges();
        coverUrl = await this.storageService.uploadImage(bucket, `${basePath}/cover`, blob);
      }

      if (this.logoFile && this.type === 'project') {
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
      if (logoUrl !== this.existingLogoUrl) patch.client_logo_url = logoUrl;
      if (this.type === 'project' && this.selectedColor !== this.existingCardColor) {
        patch.card_color = this.selectedColor;
      }

      if (Object.keys(patch).length) {
        await firstValueFrom(this.api.patch(apiEndpoint, patch));
      }

      this.imagesUpdated.emit({ 
        coverUrl, 
        logoUrl, 
        cardColor: this.type === 'project' ? this.selectedColor : undefined 
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
