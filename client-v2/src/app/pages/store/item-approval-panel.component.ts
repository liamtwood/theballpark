import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { StatusPillComponent } from '../../shared/status-pill/status-pill.component';

/** pV2-STORE-01 — the item editor's right-hand aside: the Image Approval Process
 *  copy + the Status section (codelist pill + the date/time the status was set).
 *  Extracted from item-edit.component.ts (STORE-01 audit F-2 bloat). Presentation
 *  only — `status` is the approval_status code, `statusAt` the formatted date. */
@Component({
  selector: 'app-item-approval-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'bp-card p-5 self-start block' },
  imports: [StatusPillComponent],
  template: `
    <h3 class="bp-edit-section-title">Image Approval Process</h3>
    <p class="bp-body-small mt-3 text-secondary">
      All images uploaded to Ballpark Marketplace must be reviewed and approved by the Ballpark team.
    </p>
    <p class="bp-body-small mt-3 text-secondary">
      This helps maintain a consistent and high-quality marketplace experience for all users.
    </p>
    <p class="bp-body-small mt-3 text-secondary">
      If you need help preparing your images or listings, please contact the Ballpark team.
    </p>

    <!-- Status — pill + when it was set. Reads as one row today; the layout is
         the seed for a status-over-time history. -->
    <h3 class="bp-edit-section-title mt-6">Status</h3>
    <div class="mt-3 flex flex-wrap items-center gap-3">
      <app-status-pill list="item_approval_status" [code]="status()" />
      @if (statusAt(); as at) {
        <span class="bp-caption">{{ at }}</span>
      }
    </div>
  `,
})
export class ItemApprovalPanelComponent {
  readonly status = input.required<string>();
  readonly statusAt = input<string | null>(null);
}
