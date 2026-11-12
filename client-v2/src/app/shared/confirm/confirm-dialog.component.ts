import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ConfirmService } from './confirm.service';
import { ModalComponent } from '../modal/modal.component';

/** pV2-STORE-01 — the single app-wide confirmation modal (DIALOGS.md
 *  `bp-modal--confirm`). Mounted once in the shell; driven by ConfirmService.
 *  closable=false (explicit choice only); ESC/backdrop = Cancel (rule 5). */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, LucideAngularModule],
  template: `
    <app-modal
      [open]="svc.open()"
      (close)="svc.cancel()"
      variantClass="bp-modal--confirm"
      width="420px"
      [closable]="false"
    >
      <div modalHeader>
        @if (svc.options(); as o) {
          <div class="bp-modal__icon"><lucide-icon [name]="o.icon ?? 'trash-2'" [size]="20" /></div>
          <h2 class="bp-card-title">{{ o.title }}</h2>
          @if (o.message) {
            <p class="bp-body mt-2 text-secondary">{{ o.message }}</p>
          }
        }
      </div>

      <button modalFooter type="button" class="bp-btn--secondary" (click)="svc.cancel()">{{ svc.options()?.cancelLabel ?? 'Cancel' }}</button>
      <button
        modalFooter
        type="button"
        [class]="svc.options()?.danger === false ? 'bp-btn--primary' : 'bp-btn-danger'"
        (click)="svc.confirm()"
      >
        {{ svc.options()?.confirmLabel ?? 'Confirm' }}
      </button>
    </app-modal>
  `,
})
export class ConfirmDialogComponent {
  protected readonly svc = inject(ConfirmService);
}
