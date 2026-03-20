import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Backdrop -->
    <div class="bp-modal-backdrop" (click)="onBackdropClick()">
      <!-- Modal -->
      <div class="bp-modal" (click)="$event.stopPropagation()">
        
        <!-- Header -->
        <div class="bp-modal-header">
          <div>
            <div class="bp-modal-title">{{ title }}</div>
            <div class="bp-modal-sub" *ngIf="subtitle">{{ subtitle }}</div>
          </div>
          <button class="bp-modal-close" (click)="close.emit()">✕</button>
        </div>

        <!-- Body -->
        <div class="bp-modal-body">
          <ng-content></ng-content>
        </div>

        <!-- Footer -->
        <div class="bp-modal-footer">
          <button class="bp-modal-btn" (click)="close.emit()">
            {{ cancelLabel }}
          </button>
          <button class="bp-modal-btn bp-modal-btn-primary" 
                  [disabled]="saving"
                  (click)="confirm.emit()">
            {{ saving ? savingLabel : saveLabel }}
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .bp-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }
    .bp-modal {
      background: #fff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
      width: 480px;
      max-width: 100%;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
    }
    .bp-modal-header {
      background: var(--theme-bg, #F5F0E8);
      padding: 24px 28px 20px;
      border-bottom: 0.5px solid var(--theme-border, #E5DDD0);
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .bp-modal-title {
      font-family: var(--font-display, 'Playfair Display', serif);
      font-size: 22px;
      font-weight: 400;
      color: #1C1208;
      margin-bottom: 4px;
    }
    .bp-modal-sub {
      font-size: 12px;
      color: #8C7B6B;
    }
    .bp-modal-close {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(0,0,0,0.06);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      color: #8C7B6B;
      flex-shrink: 0;
      margin-left: 12px;
      transition: background 0.15s;
    }
    .bp-modal-close:hover {
      background: rgba(0,0,0,0.12);
      color: #1C1208;
    }
    .bp-modal-body {
      padding: 24px 28px;
      overflow-y: auto;
      flex: 1;
    }
    .bp-modal-footer {
      padding: 16px 28px 24px;
      border-top: 0.5px solid #F0F0F0;
      background: #fff;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      flex-shrink: 0;
    }
    .bp-modal-btn {
      padding: 9px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      background: var(--theme-bg, #F5F0E8);
      color: #92400E;
      border: 0.5px solid var(--theme-bg, #F5F0E8);
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s, color 0.15s;
    }
    .bp-modal-btn:hover {
      background: var(--theme-accent, #D97706);
      color: #fff;
    }
    .bp-modal-btn-primary {
      font-weight: 600;
      padding: 9px 24px;
    }
    .bp-modal-btn-primary:disabled {
      opacity: 0.6;
      cursor: default;
    }
    .bp-modal-btn-primary:disabled:hover {
      background: var(--theme-bg, #F5F0E8);
      color: #92400E;
    }
  `]
})
export class ModalComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() cancelLabel = 'Cancel';
  @Input() saveLabel = 'Save';
  @Input() savingLabel = 'Saving...';
  @Input() saving = false;

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscape() { this.close.emit(); }

  onBackdropClick() { this.close.emit(); }
}
