import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** pV2-STORE-01 — the item editor's mode-dependent action buttons (moderator
 *  Approve/Reject · viewer Cancel · owner-approved Save Changes · owner-draft
 *  Save Draft/Submit/Cancel-request). Dumb: state in, clicks out. Extracted
 *  from item-edit (audit M3). */
@Component({
  selector: 'app-item-edit-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (isModerator()) {
      <!-- View (read-only) — ballpark admins Approve/Reject; everyone Cancels. -->
      <div class="mt-4 flex flex-wrap gap-3">
        <button type="button" class="bp-btn-grad" [disabled]="deciding()" (click)="approve.emit()">{{ deciding() ? 'Saving…' : 'Approve' }}</button>
        <button type="button" class="bp-btn-outline" [disabled]="deciding()" (click)="reject.emit()">{{ deciding() ? 'Saving…' : 'Reject' }}</button>
        <button type="button" class="bp-btn-outline" [disabled]="deciding()" (click)="cancel.emit()">Cancel</button>
      </div>
    } @else if (isViewer()) {
      <!-- Pure viewer (e.g. an agent) — read-only, back out only. -->
      <div class="mt-4 flex flex-wrap gap-3">
        <button type="button" class="bp-btn-outline" (click)="cancel.emit()">Cancel</button>
      </div>
    } @else if (isApproved()) {
      <!-- Owner, approved — editable (fields), photos locked. Stays live. -->
      <div class="mt-4 flex flex-wrap gap-3">
        <button type="button" class="bp-btn-grad" [disabled]="saving()" (click)="saveApproved.emit()">{{ saving() ? 'Saving…' : 'Save Changes' }}</button>
        <button type="button" class="bp-btn-outline" [disabled]="saving()" (click)="cancel.emit()">Back to store</button>
      </div>
    } @else {
      <div class="mt-4 flex flex-wrap gap-3">
        <button type="button" class="bp-btn-outline" [disabled]="saving()" (click)="saveDraft.emit()">{{ saving() ? 'Saving…' : 'Save Draft' }}</button>
        @if (currentStatus() === 'pending') {
          <!-- Submitted — withdraw the request instead of re-submitting. -->
          <button type="button" class="bp-btn-outline" [disabled]="saving()" (click)="cancelRequest.emit()">{{ saving() ? 'Saving…' : 'Cancel approval request' }}</button>
        } @else {
          <button type="button" class="bp-btn-grad" [disabled]="saving()" (click)="submit.emit()">{{ saving() ? 'Saving…' : 'Submit for Approval' }}</button>
        }
      </div>
    }
  `,
})
export class ItemEditActionsComponent {
  readonly isModerator = input<boolean>(false);
  readonly isViewer = input<boolean>(false);
  readonly isApproved = input<boolean>(false);
  readonly currentStatus = input<string>('draft');
  readonly deciding = input<boolean>(false);
  readonly saving = input<boolean>(false);

  readonly approve = output<void>();
  readonly reject = output<void>();
  readonly cancel = output<void>();
  readonly saveApproved = output<void>();
  readonly saveDraft = output<void>();
  readonly submit = output<void>();
  readonly cancelRequest = output<void>();
}
