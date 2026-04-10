import { Component, Input, Output, EventEmitter, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectButtonModule } from 'primeng/selectbutton';
import { firstValueFrom } from 'rxjs';
import { ImageProcessingService } from '../../services/image-processing.service';
import { StorageService } from '../../services/storage.service';
import { ApiService } from '../../../core/services/api.service';
import { ModalComponent } from '../modal/modal.component';

@Component({
  selector: 'app-image-upload-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, CheckboxModule, SelectButtonModule, ModalComponent],
  template: `
    <app-modal
      title="Edit images"
      [subtitle]="subtitle"
      saveLabel="Save images"
      [saving]="processing"
      [savingLabel]="statusText"
      (close)="cancel()"
      (confirm)="save()">

      <!-- Single image upload -->
      <div class="iup-section">
        <div class="iup-label">Image</div>

        <div *ngIf="!imagePreview"
             class="iup-drop"
             (click)="fileInput.click()"
             (dragover)="$event.preventDefault()"
             (drop)="onDrop($event)">
          <lucide-icon name="image" [size]="20" class="iup-drop-icon"></lucide-icon>
          <span class="iup-drop-text">Click to upload or drag & drop</span>
          <span class="iup-drop-hint">JPG, PNG — recommended 1200×800px</span>
          <input #fileInput type="file" accept="image/*"
                 (change)="onFileSelect($event)"
                 style="display:none"/>
        </div>

        <div *ngIf="imagePreview" class="iup-preview">
          <img [src]="imagePreview" class="iup-thumb"/>
          <span class="iup-filename">{{ imageFile ? imageFile.name : 'current image' }}</span>
          <button class="iup-remove" (click)="clearFile()" title="Remove image">
            <lucide-icon name="x" [size]="12"></lucide-icon>
          </button>
        </div>

        <button *ngIf="imagePreview && !imageFile"
                class="iup-replace"
                (click)="replaceInput.click()">
          Click to replace current image
          <input #replaceInput type="file" accept="image/*"
                 (change)="onFileSelect($event)"
                 style="display:none"/>
        </button>

        <div class="flex items-center gap-2 mt-3" *ngIf="imageFile">
          <p-checkbox [(ngModel)]="removeBg" [binary]="true" label="Remove background"></p-checkbox>
          <span class="text-xs" style="color:var(--theme-accent)">  (auto-detects light & dark)</span>
        </div>
      </div>

      <!-- Display as toggle -->
      <div class="iup-section" *ngIf="imagePreview">
        <div class="iup-label">Display as</div>
        <p-selectButton [options]="displayOptions" [(ngModel)]="imageDisplay"
                        optionLabel="label" optionValue="value"
                        styleClass="iup-display-toggle"></p-selectButton>
      </div>

      <!-- Card background colour -->
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
    .iup-status { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--theme-accent, #D97706); margin-top: 12px; }
    .iup-spinner { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .iup-error { font-size: 12px; color: #DC2626; margin-top: 10px; }
    :host ::ng-deep .iup-display-toggle .p-button {
      font-size: 12px; font-weight: 500; padding: 6px 16px; font-family: inherit;
    }
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

  @Output() imagesUpdated = new EventEmitter<{
    coverUrl: string;
    logoUrl: string;
    cardColor?: string;
    imageDisplay?: 'cover' | 'contain';
  }>();
  @Output() closed = new EventEmitter<void>();

  imageFile: File | null = null;
  imagePreview: string | null = null;
  removeBg = false;
  processing = false;
  statusText = '';
  errorText = '';
  imageRemoved = false;
  selectedColor = 'navy';
  imageDisplay: 'cover' | 'contain' = 'cover';

  displayOptions = [
    { label: 'Cover photo', value: 'cover' },
    { label: 'Logo', value: 'contain' },
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
    if (this.existingCoverUrl) this.imagePreview = this.existingCoverUrl;
    else if (this.existingLogoUrl) this.imagePreview = this.existingLogoUrl;
    if (this.existingCardColor) this.selectedColor = this.existingCardColor;
    if (this.existingImageDisplay) this.imageDisplay = this.existingImageDisplay;
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.imageFile = input.files[0];
    this.imagePreview = URL.createObjectURL(this.imageFile);
    this.imageRemoved = false;
    this.cdr.detectChanges();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file?.type.startsWith('image/')) {
      this.imageFile = file;
      this.imagePreview = URL.createObjectURL(file);
      this.imageRemoved = false;
      this.cdr.detectChanges();
    }
  }

  clearFile() {
    this.imageFile = null;
    this.imagePreview = null;
    this.imageRemoved = true;
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

      const existingUrl = this.existingCoverUrl || this.existingLogoUrl;
      let imageUrl = this.imageRemoved ? '' : existingUrl;

      if (this.imageFile) {
        this.statusText = this.removeBg ? 'Removing background...' : 'Uploading image...';
        this.cdr.detectChanges();
        const blob = this.removeBg
          ? await this.imageService.processImage(this.imageFile, { removeBg: true, autoCrop: true, padding: 10 })
          : this.imageFile;
        this.statusText = 'Uploading...';
        this.cdr.detectChanges();
        imageUrl = await this.storageService.uploadImage(bucket, `${basePath}/cover`, blob);
      }

      const patch: any = {};
      if (imageUrl !== existingUrl) {
        patch.cover_image_url = imageUrl;
      }
      if (this.selectedColor !== this.existingCardColor) {
        patch.card_color = this.selectedColor;
      }
      if (this.imageDisplay !== this.existingImageDisplay) {
        patch.image_display = this.imageDisplay;
      }

      if (Object.keys(patch).length && apiEndpoint) {
        await firstValueFrom(this.api.patch(apiEndpoint, patch));
      }

      this.imagesUpdated.emit({
        coverUrl: imageUrl,
        logoUrl: '',
        cardColor: this.selectedColor,
        imageDisplay: this.imageDisplay
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
}
