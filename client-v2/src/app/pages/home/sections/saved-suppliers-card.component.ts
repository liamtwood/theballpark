import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DashboardService } from '../../../core/dashboard/dashboard.service';
import { SectionCardComponent } from '../../../shared/section-card/section-card.component';
import { UserAvatarComponent } from '../../../shared/user-avatar/user-avatar.component';

/** pV2-04 — Saved Suppliers (right column): the org's favourited supplier
 *  orgs. Avatar reuses <app-user-avatar> (logo image or initials circle). */
@Component({
  selector: 'app-saved-suppliers-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionCardComponent, UserAvatarComponent],
  host: { class: 'block' },
  template: `
    <app-section-card icon="heart" label="Saved Suppliers">
      @if (saved.isLoading()) {
        <p class="text-xs text-muted">Loading…</p>
      } @else if (saved.error()) {
        <p class="text-xs text-warn">Couldn't load saved suppliers.</p>
      } @else if ((saved.value() ?? []).length === 0) {
        <p class="text-xs text-muted">No saved suppliers yet — heart one in the marketplace.</p>
      } @else {
        @for (s of saved.value(); track s.id) {
          <div class="flex items-center gap-2.5 border-b border-hairline py-2 last:border-b-0">
            <app-user-avatar [displayName]="s.name" [imageUrl]="s.logoUrl" [size]="28" />
            <span class="min-w-0">
              <span class="block truncate text-[13px] font-medium">{{ s.name }}</span>
              @if (s.city) {
                <span class="block truncate text-[11px] text-muted">{{ s.city }}</span>
              }
            </span>
          </div>
        }
      }
    </app-section-card>
  `,
})
export class SavedSuppliersCardComponent {
  protected readonly saved = inject(DashboardService).savedSuppliers(4);
}
