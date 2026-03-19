import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ImageProcessingService } from '../../services/image-processing.service';

@Component({
  selector: 'app-image-test',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ip-wrap">
      <h2 class="ip-title">Image Processing Test</h2>

      <div class="ip-controls">
        <label class="ip-file-label">
          Choose Image
          <input type="file" accept="image/*" (change)="onFileChange($event)" style="display:none"/>
        </label>
        <label class="ip-check"><input type="checkbox" [(ngModel)]="removeBg"/> Remove background</label>
        <label class="ip-check"><input type="checkbox" [(ngModel)]="autoCrop"/> Auto crop</label>
        <label class="ip-check">
          Padding
          <input type="number" [(ngModel)]="padding" min="0" max="200" class="ip-num"/>px
        </label>
        <button class="ip-btn" [disabled]="!file || processing" (click)="process()">
          {{ processing ? 'Processing...' : 'Process' }}
        </button>
      </div>

      <div class="ip-grid" *ngIf="originalUrl">
        <div class="ip-panel">
          <div class="ip-label">Original</div>
          <div class="ip-canvas-wrap">
            <img [src]="originalUrl" class="ip-img"/>
          </div>
        </div>
        <div class="ip-panel" *ngIf="resultUrl">
          <div class="ip-label">Processed</div>
          <div class="ip-canvas-wrap ip-checker">
            <img [src]="resultUrl" class="ip-img"/>
          </div>
        </div>
      </div>

      <div *ngIf="resultUrl" class="ip-controls" style="margin-top:16px;">
        <a [href]="resultUrl" download="processed.png" class="ip-btn">Download PNG</a>
      </div>
    </div>
  `,
  styles: [`
    .ip-wrap { padding: var(--section-pad); max-width: 960px; margin: 0 auto; }
    .ip-title { font-family: var(--font-display); font-size: 24px; color: var(--color-text-primary); margin-bottom: 20px; }
    .ip-controls { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
    .ip-file-label {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 16px; border-radius: 6px; cursor: pointer;
      background: var(--theme-bg); color: var(--theme-text);
      border: 0.5px solid var(--theme-border); font-weight: 600; font-size: var(--text-sm);
    }
    .ip-check { display: flex; align-items: center; gap: 6px; font-size: var(--text-sm); color: var(--color-text-secondary); }
    .ip-num { width: 52px; padding: 4px 6px; border: 1px solid var(--color-border); border-radius: 4px; font-size: var(--text-sm); }
    .ip-btn {
      padding: 8px 20px; border-radius: 6px; font-weight: 600; font-size: var(--text-sm);
      background: var(--theme-accent); color: #fff; border: none; cursor: pointer;
      text-decoration: none; display: inline-flex; align-items: center;
    }
    .ip-btn:disabled { opacity: 0.5; cursor: default; }
    .ip-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .ip-panel { text-align: center; }
    .ip-label { font-size: var(--text-sm); font-weight: 600; color: var(--color-text-secondary); margin-bottom: 8px; }
    .ip-canvas-wrap {
      border: 1px solid var(--color-border); border-radius: 8px; padding: 8px;
      background: var(--color-surface); overflow: hidden;
    }
    .ip-checker {
      background-image:
        linear-gradient(45deg, #ddd 25%, transparent 25%),
        linear-gradient(-45deg, #ddd 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #ddd 75%),
        linear-gradient(-45deg, transparent 75%, #ddd 75%);
      background-size: 20px 20px;
      background-position: 0 0, 0 10px, 10px -10px, -10px 0;
    }
    .ip-img { max-width: 100%; height: auto; display: block; }
  `]
})
export class ImageTestComponent {
  file: File | null = null;
  originalUrl: string | null = null;
  resultUrl: string | null = null;
  removeBg = true;
  autoCrop = true;
  padding = 10;
  processing = false;

  constructor(private imageService: ImageProcessingService) {}

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.file = input.files[0];
    this.originalUrl = URL.createObjectURL(this.file);
    this.resultUrl = null;
  }

  async process() {
    if (!this.file) return;
    this.processing = true;
    try {
      const blob = await this.imageService.processImage(this.file, {
        removeBg: this.removeBg,
        autoCrop: this.autoCrop,
        padding: this.padding,
      });
      if (this.resultUrl) URL.revokeObjectURL(this.resultUrl);
      this.resultUrl = URL.createObjectURL(blob);
    } catch (err) {
      console.error('Image processing failed:', err);
    } finally {
      this.processing = false;
    }
  }
}
