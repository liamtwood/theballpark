import { Component, Input, Output, EventEmitter, ElementRef, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ImageProcessingService } from '../../services/image-processing.service';
import { StorageService } from '../../services/storage.service';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-image-upload-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="iup-panel" (click)="$event.stopPropagation()">
      <!-- Cover image section -->
      <div class="iup-section">
        <div class="iup-section-title">Project / venue image</div>
        <div *ngIf="!coverFile && !coverPreview" class="iup-drop"
             (click)="coverInput.click()"
             (dragover)="$event.preventDefault()"
             (drop)="onDrop($event, 'cover')">
          <lucide-icon name="image" [size]="20"></lucide-icon>
          <span>Click to upload or drag & drop</span>
          <span class="iup-hint">JPG, PNG — recommended 1200x800px</span>
          <input #coverInput type="file" accept="image/*" (change)="onFileSelect($event, 'cover')" style="display:none"/>
        </div>
        <div *ngIf="coverFile || coverPreview" class="iup-preview-row">
          <img [src]="coverPreview" class="iup-thumb"/>
          <span class="iup-filename">{{ coverFile?.name || 'cover image' }}</span>
          <button class="iup-remove" (click)="clearFile('cover')"><lucide-icon name="x" [size]="12"></lucide-icon></button>
        </div>
        <label *ngIf="coverFile" class="iup-check"><input type="checkbox" [(ngModel)]="coverRemoveBg"/> Remove background</label>
      </div>

      <!-- Client logo section -->
      <div class="iup-section">
        <div class="iup-section-title">Client logo</div>
        <div *ngIf="!logoFile && !logoPreview" class="iup-drop"
             (click)="logoInput.click()"
             (dragover)="$event.preventDefault()"
             (drop)="onDrop($event, 'logo')">
          <lucide-icon name="image" [size]="20"></lucide-icon>
          <span>Click to upload or drag & drop</span>
          <span class="iup-hint">PNG with transparency recommended</span>
          <input #logoInput type="file" accept="image/*" (change)="onFileSelect($event, 'logo')" style="display:none"/>
        </div>
        <div *ngIf="logoFile || logoPreview" class="iup-preview-row">
          <img [src]="logoPreview" class="iup-thumb"/>
          <span class="iup-filename">{{ logoFile?.name || 'client logo' }}</span>
          <button class="iup-remove" (click)="clearFile('logo')"><lucide-icon name="x" [size]="12"></lucide-icon></button>
        </div>
        <label *ngIf="logoFile" class="iup-check"><input type="checkbox" [(ngModel)]="logoRemoveBg"/> Remove background</label>
      </div>

      <div *ngIf="processing" class="iup-status">
        <lucide-icon name="loader-circle" [size]="14" class="iup-spinner"></lucide-icon>
        {{ statusText }}
      </div>

      <div class="iup-actions">
        <button class="iup-btn-cancel" (click)="cancel()">Cancel</button>
        <button class="iup-btn-save" [disabled]="processing || (!coverFile && !logoFile)" (click)="save()">
          {{ processing ? 'Saving...' : 'Save images' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .iup-panel {
      position: absolute; left: 0; top: calc(100% + 8px);
      width: 320px; z-index: 100;
      background: var(--color-surface); border: 0.5px solid var(--color-border);
      border-radius: 10px; padding: 16px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    }
    .iup-section { margin-bottom: 14px; }
    .iup-section-title { font-size: var(--text-sm); font-weight: 600; color: var(--color-text-primary); margin-bottom: 8px; }
    .iup-drop {
      border: 1.5px dashed var(--color-border); border-radius: 8px;
      padding: 16px; text-align: center; cursor: pointer;
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      font-size: var(--text-sm); color: var(--color-text-muted);
      transition: border-color 0.15s;
    }
    .iup-drop:hover { border-color: var(--theme-accent); }
    .iup-hint { font-size: 10px; color: var(--color-text-muted); }
    .iup-preview-row {
      display: flex; align-items: center; gap: 8px;
      padding: 8px; background: var(--color-bg); border-radius: 6px;
      border: 0.5px solid var(--color-border);
    }
    .iup-thumb { width: 36px; height: 36px; border-radius: 4px; object-fit: cover; }
    .iup-filename { flex: 1; font-size: var(--text-sm); color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .iup-remove { background: none; border: none; cursor: pointer; color: var(--color-text-muted); padding: 4px; display: flex; }
    .iup-remove:hover { color: var(--color-text-primary); }
    .iup-check { display: flex; align-items: center; gap: 6px; font-size: var(--text-sm); color: var(--color-text-secondary); margin-top: 8px; cursor: pointer; }
    .iup-status {
      display: flex; align-items: center; gap: 6px;
      font-size: var(--text-sm); color: var(--theme-accent); margin-bottom: 10px;
    }
    .iup-spinner { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .iup-actions { display: flex; gap: 8px; justify-content: flex-end; }
    .iup-btn-cancel {
      padding: 6px 14px; border-radius: 6px; font-size: var(--text-sm); font-weight: 500;
      background: none; border: 0.5px solid var(--color-border); color: var(--color-text-secondary);
      cursor: pointer;
    }
    .iup-btn-save {
      padding: 6px 14px; border-radius: 6px; font-size: var(--text-sm); font-weight: 600;
      background: var(--theme-accent); color: #fff; border: none; cursor: pointer;
    }
    .iup-btn-save:disabled { opacity: 0.5; cursor: default; }
  `]
})
export class ImageUploadPanelComponent {
  @Input() projectId = '';
  @Output() imagesUpdated = new EventEmitter<{ coverUrl: string; logoUrl: string }>();
  @Output() closed = new EventEmitter<void>();

  coverFile: File | null = null;
  logoFile: File | null = null;
  coverPreview: string | null = null;
  logoPreview: string | null = null;
  coverRemoveBg = false;
  logoRemoveBg = true;
  processing = false;
  statusText = '';

  constructor(
    private imageService: ImageProcessingService,
    private storageService: StorageService,
    private api: ApiService,
    private elRef: ElementRef,
    private cdr: ChangeDetectorRef,
  ) {}

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent) {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.closed.emit();
    }
  }

  onFileSelect(event: Event, type: 'cover' | 'logo') {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.setFile(input.files[0], type);
  }

  onDrop(event: DragEvent, type: 'cover' | 'logo') {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file?.type.startsWith('image/')) this.setFile(file, type);
  }

  clearFile(type: 'cover' | 'logo') {
    if (type === 'cover') { this.coverFile = null; this.coverPreview = null; }
    else { this.logoFile = null; this.logoPreview = null; }
  }

  cancel() { this.closed.emit(); }

  async save() {
    if (!this.projectId) return;
    this.processing = true;
    this.cdr.detectChanges();

    try {
      let coverUrl = '';
      let logoUrl = '';

      if (this.coverFile) {
        this.statusText = this.coverRemoveBg ? 'Removing background...' : 'Uploading cover...';
        this.cdr.detectChanges();
        const blob = this.coverRemoveBg
          ? await this.imageService.processImage(this.coverFile, { removeBg: true, autoCrop: true, padding: 10 })
          : this.coverFile;
        this.statusText = 'Uploading cover...';
        this.cdr.detectChanges();
        coverUrl = await this.storageService.uploadImage(
          this.storageService.projectsBucket,
          `projects/${this.projectId}/cover`,
          blob
        );
      }

      if (this.logoFile) {
        this.statusText = this.logoRemoveBg ? 'Removing logo background...' : 'Uploading logo...';
        this.cdr.detectChanges();
        const blob = this.logoRemoveBg
          ? await this.imageService.processImage(this.logoFile, { removeBg: true, autoCrop: true, padding: 4 })
          : this.logoFile;
        this.statusText = 'Uploading logo...';
        this.cdr.detectChanges();
        logoUrl = await this.storageService.uploadImage(
          this.storageService.projectsBucket,
          `projects/${this.projectId}/logo`,
          blob
        );
      }

      // Patch project with new URLs
      const patch: any = {};
      if (coverUrl) patch.cover_image_url = coverUrl;
      if (logoUrl) patch.client_logo_url = logoUrl;

      if (Object.keys(patch).length) {
        await this.api.put(`/projects/${this.projectId}`, patch).toPromise();
      }

      this.imagesUpdated.emit({ coverUrl, logoUrl });
      this.closed.emit();
    } catch (err) {
      console.error('Image upload failed:', err);
      this.statusText = 'Upload failed — try again';
    } finally {
      this.processing = false;
      this.cdr.detectChanges();
    }
  }

  private setFile(file: File, type: 'cover' | 'logo') {
    const url = URL.createObjectURL(file);
    if (type === 'cover') { this.coverFile = file; this.coverPreview = url; }
    else { this.logoFile = file; this.logoPreview = url; }
  }
}
