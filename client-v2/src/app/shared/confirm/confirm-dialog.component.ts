import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { LucideAngularModule } from 'lucide-angular';
import { ConfirmService } from './confirm.service';

/** pV2-STORE-01 — the single app-wide confirmation modal (DIALOGS.md
 *  `bp-modal--confirm`). Mounted once in the shell; driven by ConfirmService.
 *  closable=false (explicit choice only); ESC/backdrop = Cancel (rule 5). */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule, LucideAngularModule],
  template: `
    <p-dialog
      [visible]="svc.open()"
      (visibleChange)="onVisibleChange($event)"
      styleClass="bp-modal bp-modal--confirm"
      [closable]="false"
      [closeOnEscape]="true"
      [dismissableMask]="true"
      [modal]="true"
      [style]="{ width: '420px' }"
    >
      @if (svc.options(); as o) {
        <ng-template pTemplate="header">
          <div>
            <div class="bp-modal__icon"><lucide-icon [name]="o.icon ?? 'trash-2'" [size]="20" /></div>
            <h2 class="bp-card-title">{{ o.title }}</h2>
            @if (o.message) {
              <p class="bp-body mt-2 text-secondary">{{ o.message }}</p>
            }
          </div>
        </ng-template>
        <ng-template pTemplate="footer">
          <button type="button" class="bp-btn-outline" (click)="svc.cancel()">{{ o.cancelLabel ?? 'Cancel' }}</button>
          <button
            type="button"
            [class]="o.danger === false ? 'bp-btn-grad' : 'bp-btn-danger'"
            (click)="svc.confirm()"
          >
            {{ o.confirmLabel ?? 'Confirm' }}
          </button>
        </ng-template>
      }
    </p-dialog>
  `,
})
export class ConfirmDialogComponent {
  protected readonly svc = inject(ConfirmService);

  /** PrimeNG closing (ESC/backdrop) → Cancel. Confirm already settled, so the
   *  service's settle-guard makes this a no-op in that path. */
  protected onVisibleChange(visible: boolean): void {
    if (!visible) this.svc.cancel();
  }
}
