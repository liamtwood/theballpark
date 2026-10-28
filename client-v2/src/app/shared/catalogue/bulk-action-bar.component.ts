import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { MessageService } from 'primeng/api';
import { ItemSelectionStore } from './item-selection.store';
import { MarketplaceStore } from '../../pages/marketplace/marketplace-store';
import { BulkItemsService, BulkScope, RefreshJob } from '../../core/store/bulk-items.service';
import { ConfirmService } from '../confirm/confirm.service';
import { ReclassifyDialogComponent } from './reclassify-dialog.component';

/** One bulk action the bar can offer. */
interface BulkButton {
  action: 'activate' | 'deactivate' | 'reclassify' | 'submit' | 'delete' | 'refresh-images' | 'approve' | 'reject';
  label: string;
  icon: string;
  /** Soft-fill tone (feedback: Accept/Approve=green, Decline/Delete=red, else neutral). */
  tone: 'ok' | 'danger' | 'neutral';
}

/** pV2-ITEM-BULK-ACTIONS-01 — the SHARED sticky bulk-action bar. Appears whenever the
 *  marketplace selection is non-empty (ItemSelectionStore); shows ONLY the actions the
 *  viewer may perform (owner → their own items; ballpark admin → cross-org moderation).
 *  ONE definition, reused by the global marketplace / Approvals queue AND a supplier's
 *  My Shop (ENGINEERING "extract before duplicate"). Self-contained: it runs the action
 *  (confirming destructive ones), clears the selection, and emits (done) so the host
 *  reloads its grid. */
@Component({
  selector: 'app-bulk-action-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ReclassifyDialogComponent],
  host: { class: 'contents' },
  template: `
    @if (selection.hasSelection() && scope()) {
      <div class="pointer-events-none sticky bottom-4 z-20 mt-4 flex justify-center">
        <div class="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-[var(--radius-pill)] border border-hairline bg-surface px-3 py-2 shadow-lg">
          <span class="bp-body-small whitespace-nowrap px-1 font-medium text-text">
            {{ selection.count() }} selected
          </span>
          <span class="h-5 w-px bg-hairline"></span>

          @if (busy()) {
            <span class="bp-body-small whitespace-nowrap px-2 text-secondary">{{ busyLabel() }}</span>
          } @else {
            @for (b of buttons(); track b.action) {
              <button type="button" class="bp-bulk-btn" [attr.data-tone]="b.tone"
                [title]="b.label" [attr.aria-label]="b.label"
                (click)="onAction(b.action)">
                <lucide-icon [name]="b.icon" [size]="14" />
              </button>
            }
          }

          <span class="h-5 w-px bg-hairline"></span>
          <button type="button" class="bp-bulk-btn" [disabled]="busy()" title="Clear" aria-label="Clear" (click)="selection.clear()">
            <lucide-icon name="x" [size]="14" />
          </button>
        </div>
      </div>

      <app-reclassify-dialog
        [open]="reclassifyOpen()"
        [count]="selection.count()"
        [seedCategoryId]="firstSelectedCategoryId()"
        (close)="reclassifyOpen.set(false)"
        (confirm)="onReclassify($event)"
      />
    }
  `,
  styles: `
    .bp-bulk-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px;
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-pill);
      background: var(--color-surface);
      color: var(--color-text);
      font-family: var(--font-body);
      font-size: var(--text-sm);
      white-space: nowrap;
      cursor: pointer;
    }
    .bp-bulk-btn:hover:not(:disabled) { background: var(--color-fill); }
    .bp-bulk-btn:disabled { opacity: 0.5; cursor: default; }
    .bp-bulk-btn[data-tone='ok'] {
      background: var(--color-success-soft);
      color: var(--color-success);
      border-color: color-mix(in srgb, var(--color-success) 25%, transparent);
    }
    .bp-bulk-btn[data-tone='ok']:hover:not(:disabled) {
      background: color-mix(in srgb, var(--color-success-soft) 82%, var(--color-success));
    }
    .bp-bulk-btn[data-tone='danger'] {
      background: var(--color-danger-soft);
      color: var(--color-danger);
      border-color: color-mix(in srgb, var(--color-danger) 25%, transparent);
    }
    .bp-bulk-btn[data-tone='danger']:hover:not(:disabled) {
      background: color-mix(in srgb, var(--color-danger-soft) 82%, var(--color-danger));
    }
  `,
})
export class BulkActionBarComponent {
  protected readonly selection = inject(ItemSelectionStore);
  private readonly store = inject(MarketplaceStore);
  private readonly bulk = inject(BulkItemsService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(MessageService);

  /** A bulk mutation landed — the host should reload its grid. */
  readonly done = output<void>();

  protected readonly busy = signal(false);
  protected readonly busyLabel = signal('Working…');
  protected readonly reclassifyOpen = signal(false);

  /** The first selected item's home category — seeds the reclassify dialog so it
   *  opens on the item's current classification (Liam 2026-10-28). */
  protected readonly firstSelectedCategoryId = computed<string | null>(() => {
    const first = [...this.selection.ids()][0];
    if (!first) return null;
    return this.store.items().find((i) => i.id === first)?.categoryId ?? null;
  });

  /** owner (own store) vs admin (cross-org moderation). null → no bar (host gates too). */
  protected readonly scope = computed<BulkScope | null>(() => {
    if (this.store.isOwnerStore()) return 'owner';
    if (this.store.isBallparkAdmin()) return 'admin';
    return null;
  });

  private static readonly OWNER: BulkButton[] = [
    { action: 'activate', label: 'Activate', icon: 'eye', tone: 'ok' },
    { action: 'deactivate', label: 'Deactivate', icon: 'eye-off', tone: 'neutral' },
    { action: 'reclassify', label: 'Reclassify', icon: 'list-tree', tone: 'neutral' },
    { action: 'submit', label: 'Submit for review', icon: 'send', tone: 'neutral' },
    { action: 'refresh-images', label: 'Refresh images', icon: 'image', tone: 'neutral' },
    { action: 'delete', label: 'Delete', icon: 'trash-2', tone: 'danger' },
  ];
  private static readonly ADMIN: BulkButton[] = [
    { action: 'approve', label: 'Approve', icon: 'circle-check', tone: 'ok' },
    { action: 'reject', label: 'Reject', icon: 'octagon-x', tone: 'danger' },
    { action: 'refresh-images', label: 'Refresh images', icon: 'image', tone: 'neutral' },
    { action: 'delete', label: 'Delete', icon: 'trash-2', tone: 'danger' },
  ];
  protected readonly buttons = computed<BulkButton[]>(() =>
    this.scope() === 'admin' ? BulkActionBarComponent.ADMIN : BulkActionBarComponent.OWNER);

  private ids(): string[] { return [...this.selection.ids()]; }

  protected async onAction(action: BulkButton['action']): Promise<void> {
    const sc = this.scope();
    if (!sc || this.busy()) return;

    if (action === 'reclassify') { this.reclassifyOpen.set(true); return; }
    if (action === 'refresh-images') { void this.runRefresh(sc); return; }

    if (action === 'delete') {
      const n = this.selection.count();
      const ok = await this.confirm.ask({
        title: `Delete ${n} ${n === 1 ? 'item' : 'items'}?`,
        message: sc === 'admin' ? 'This removes them from the marketplace.' : 'This removes them from your store.',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        danger: true,
        icon: 'trash-2',
      });
      if (!ok) return;
    }

    this.busy.set(true);
    this.busyLabel.set('Working…');
    try {
      const res = await firstValueFrom(this.bulk.run(sc, action, this.ids()));
      const verb = ACTION_VERB[action] ?? 'Updated';
      this.toast.add({
        severity: 'success',
        summary: `${verb} ${res.updated} ${res.updated === 1 ? 'item' : 'items'}`
          + (res.skipped > 0 ? ` · ${res.skipped} skipped` : ''),
        life: 4000,
      });
      this.selection.clear();
      this.done.emit();
    } catch {
      this.toast.add({ severity: 'error', summary: "Couldn't complete the action.", life: 4000 });
    } finally {
      this.busy.set(false);
    }
  }

  protected onReclassify(categoryId: string): void {
    const sc = this.scope();
    this.reclassifyOpen.set(false);
    if (sc !== 'owner' || this.busy()) return;
    this.busy.set(true);
    this.busyLabel.set('Reclassifying…');
    firstValueFrom(this.bulk.run('owner', 'reclassify', this.ids(), { categoryId }))
      .then((res) => {
        this.toast.add({ severity: 'success', summary: `Reclassified ${res.updated} ${res.updated === 1 ? 'item' : 'items'}`, life: 4000 });
        this.selection.clear();
        this.done.emit();
      })
      .catch(() => this.toast.add({ severity: 'error', summary: "Couldn't reclassify.", life: 4000 }))
      .finally(() => this.busy.set(false));
  }

  /** Start the refresh-images job and poll it to completion, reporting progress. */
  private async runRefresh(sc: BulkScope): Promise<void> {
    this.busy.set(true);
    this.busyLabel.set('Refreshing images…');
    try {
      const started = await firstValueFrom(this.bulk.startRefresh(sc, this.ids()));
      await this.pollToDone(sc, started.jobId);
    } catch {
      this.toast.add({ severity: 'error', summary: "Couldn't start the image refresh.", life: 4000 });
      this.busy.set(false);
    }
  }

  private async pollToDone(sc: BulkScope, jobId: string): Promise<void> {
    const tick = async (): Promise<void> => {
      let job: RefreshJob;
      try {
        job = await firstValueFrom(this.bulk.pollRefresh(sc, jobId));
      } catch {
        this.toast.add({ severity: 'error', summary: 'Lost track of the image refresh.', life: 4000 });
        this.busy.set(false);
        return;
      }
      this.busyLabel.set(`Refreshing images… ${job.processed}/${job.total}`);
      if (job.status === 'running' || job.status === 'cancelling') {
        setTimeout(() => void tick(), 1200);
        return;
      }
      // Terminal — report + refresh the grid with the new photos.
      this.bulk.invalidate();
      if (job.status === 'error') {
        this.toast.add({ severity: 'error', summary: job.error || 'The image refresh failed.', life: 5000 });
      } else {
        this.toast.add({
          severity: 'success',
          summary: `Refreshed ${job.updated} ${job.updated === 1 ? 'image' : 'images'}`
            + (job.skipped > 0 ? ` · ${job.skipped} had none` : '')
            + (job.failed > 0 ? ` · ${job.failed} failed` : ''),
          life: 5000,
        });
      }
      this.selection.clear();
      this.done.emit();
      this.busy.set(false);
    };
    await tick();
  }
}

/** Toast verb per synchronous action. */
const ACTION_VERB: Record<string, string> = {
  activate: 'Activated',
  deactivate: 'Deactivated',
  submit: 'Submitted',
  delete: 'Deleted',
  approve: 'Approved',
  reject: 'Rejected',
};
