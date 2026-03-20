import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule],
  template: `
    <p-dialog
      [header]="title"
      [(visible)]="isVisible"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [style]="{width:'480px'}"
      styleClass="bp-modal"
      (onHide)="close.emit()">

      <p-header>
        <div>
          <div class="font-display text-2xl font-normal text-amber-900">
            {{ title }}
          </div>
          <div class="text-xs text-gray-400 mt-1" *ngIf="subtitle">
            {{ subtitle }}
          </div>
        </div>
      </p-header>

      <ng-content></ng-content>

      <ng-template pTemplate="footer">
        <p-button
          [label]="cancelLabel"
          (onClick)="close.emit()"
          styleClass="p-button-outlined bp-btn-cancel">
        </p-button>
        <p-button
          [label]="saving ? savingLabel : saveLabel"
          (onClick)="confirm.emit()"
          [loading]="saving"
          styleClass="bp-btn-save">
        </p-button>
      </ng-template>
    </p-dialog>
  `,
  styles: []
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

  isVisible = true;

  @HostListener('document:keydown.escape')
  onEscape() { this.close.emit(); }
}
