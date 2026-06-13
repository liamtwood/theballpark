import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';
import { PageHeroComponent } from '../../../shell/page-hero/page-hero.component';

/** Dev-only sandbox for the DIALOGS.md primitive family (pV2-DIALOGS-01) —
 *  every archetype on one page so each can be triggered + visually QC'd
 *  without waiting for its real consumer surface (team remove, etc.) to
 *  exist. Sibling of `/style/hero`. */
@Component({
  selector: 'app-dialogs-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, DialogModule, ToastModule, TooltipModule, LucideAngularModule, PageHeroComponent],
  providers: [MessageService],
  host: { class: 'block' },
  template: `
    <app-page-hero title="Dialogs" subtitle="DIALOGS.md primitive family — modal / alert / toast / tooltip" />

    <div class="bp-page-body flex flex-col gap-10">
      <!-- 1 · Toasts (action outcomes) -->
      <section>
        <p class="mb-3 text-sm font-medium uppercase tracking-wide text-muted">1 · Toasts — action outcomes (bottom-right)</p>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="bp-btn-outline" (click)="toast('success', 'Saved.')">Success</button>
          <button type="button" class="bp-btn-outline" (click)="toast('info', 'Copied.')">Info</button>
          <button type="button" class="bp-btn-outline" (click)="toast('warn', 'Couldn’t save — check the highlighted fields.')">Warn</button>
          <button type="button" class="bp-btn-outline" (click)="toast('error', 'Couldn’t save — please try again.', 'GET /api/thing returned 500')">Error (+ detail)</button>
        </div>
      </section>

      <!-- 2 · Inline alerts (persistent context) -->
      <section>
        <p class="mb-3 text-sm font-medium uppercase tracking-wide text-muted">2 · Inline alerts — persistent context</p>
        <div class="flex max-w-xl flex-col gap-3">
          <div class="bp-alert bp-alert--success" role="status">
            <lucide-icon name="circle-check" [size]="16" class="bp-alert__icon" />
            <span class="bp-alert__body"><strong>Saved.</strong> Your changes are live.</span>
          </div>
          <div class="bp-alert bp-alert--info" role="status">
            <lucide-icon name="info" [size]="16" class="bp-alert__icon" />
            <span class="bp-alert__body">Advisory: 1,247 records currently use this — they keep displaying it, but no new records can select it.</span>
          </div>
          <div class="bp-alert bp-alert--warn" role="alert">
            <lucide-icon name="triangle-alert" [size]="16" class="bp-alert__icon" />
            <span class="bp-alert__body"><strong>Heads up.</strong> This list is referenced by code — edit values with care.</span>
          </div>
          <div class="bp-alert bp-alert--danger" role="alert">
            <lucide-icon name="circle-alert" [size]="16" class="bp-alert__icon" />
            <span class="bp-alert__body"><strong>Couldn’t save.</strong> The server returned a 409 — a value with this code already exists.</span>
            <button type="button" class="bp-alert__dismiss" aria-label="Dismiss"><lucide-icon name="x" [size]="14" /></button>
          </div>
        </div>
      </section>

      <!-- 3 · Confirmation + info modals -->
      <section>
        <p class="mb-3 text-sm font-medium uppercase tracking-wide text-muted">3 · Modals — blocking</p>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="bp-btn-outline" (click)="confirmOpen.set(true)">Confirmation (destructive)</button>
          <button type="button" class="bp-btn-outline" (click)="infoOpen.set(true)">Info</button>
        </div>
      </section>

      <!-- 4 · Tooltip -->
      <section>
        <p class="mb-3 text-sm font-medium uppercase tracking-wide text-muted">4 · Tooltip — hover help</p>
        <button type="button" class="bp-btn-outline" pTooltip="Requires admin.cross_org_view" tooltipPosition="top" tooltipStyleClass="bp-tooltip">
          Hover me
        </button>
      </section>
    </div>

    <!-- Confirmation modal (paired with .bp-btn-danger per BUTTONS.md) -->
    <p-dialog [(visible)]="confirmModel" styleClass="bp-modal bp-modal--confirm" [closable]="false" [modal]="true" [style]="{ width: '420px' }">
      <ng-template pTemplate="header">
        <div>
          <div class="bp-modal__icon"><lucide-icon name="trash-2" [size]="20" /></div>
          <h2 class="bp-card-title">Remove Sarah Chen?</h2>
          <p class="bp-body mt-2 text-secondary">This removes her from the organisation. You can re-invite her later.</p>
        </div>
      </ng-template>
      <ng-template pTemplate="footer">
        <button type="button" class="bp-btn-outline" (click)="confirmOpen.set(false)">Cancel</button>
        <button type="button" class="bp-btn-danger" (click)="confirmDone()">Remove</button>
      </ng-template>
    </p-dialog>

    <!-- Info modal -->
    <p-dialog [(visible)]="infoModel" styleClass="bp-modal bp-modal--info" [modal]="true" [style]="{ width: '420px' }" header="Terms updated">
      <p class="bp-body text-secondary">We’ve updated our terms of service. Continued use constitutes acceptance.</p>
      <ng-template pTemplate="footer">
        <button type="button" class="bp-btn-grad" (click)="infoOpen.set(false)">OK</button>
      </ng-template>
    </p-dialog>

    <p-toast position="bottom-right" styleClass="bp-toast" />
  `,
})
export class DialogsDemoComponent {
  private readonly messages = inject(MessageService);

  protected readonly confirmOpen = signal(false);
  protected readonly infoOpen = signal(false);

  // p-dialog needs a two-way model; bridge the signals.
  protected get confirmModel(): boolean { return this.confirmOpen(); }
  protected set confirmModel(v: boolean) { this.confirmOpen.set(v); }
  protected get infoModel(): boolean { return this.infoOpen(); }
  protected set infoModel(v: boolean) { this.infoOpen.set(v); }

  protected toast(severity: 'success' | 'info' | 'warn' | 'error', summary: string, detail?: string): void {
    this.messages.add({ severity, summary, detail, life: severity === 'error' || severity === 'warn' ? 5000 : 3000 });
  }

  protected confirmDone(): void {
    this.confirmOpen.set(false);
    this.toast('success', 'Removed.');
  }
}
