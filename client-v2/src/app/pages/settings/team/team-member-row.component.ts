import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { LucideAngularModule } from 'lucide-angular';
import { TeamMember } from '../../../core/team/team.service';
import { UserAvatarComponent } from '../../../shared/user-avatar/user-avatar.component';

/** One member row: avatar · name/title/email · Admin + Suspend toggles + trash.
 *  The signed-in admin's own row is fully disabled (self-modification guard,
 *  mirrored server-side). */
@Component({
  selector: 'app-team-member-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ToggleSwitchModule, LucideAngularModule, UserAvatarComponent],
  host: { class: 'flex items-center gap-4 border-b border-black/5 px-4 py-3 last:border-b-0' },
  template: `
    <app-user-avatar
      [displayName]="member().displayName"
      [email]="member().email"
      [imageUrl]="member().avatarUrl"
      [size]="36"
    />

    <div class="min-w-0 flex-1">
      <div class="truncate text-sm font-semibold">
        {{ member().displayName ?? member().email }}
        @if (member().status === 'invited') {
          <span class="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">pending invite</span>
        }
        @if (member().status === 'suspended') {
          <span class="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">suspended</span>
        }
      </div>
      <div class="truncate text-xs text-slate-500">{{ member().jobTitle ?? '—' }}</div>
      <div class="truncate text-xs text-slate-400">{{ member().email }}</div>
    </div>

    <div class="flex shrink-0 items-center gap-5" [title]="selfTooltip()">
      <span class="flex items-center gap-2 text-xs text-slate-500">
        Admin
        <p-toggleswitch
          [ngModel]="member().isAdmin"
          [disabled]="isSelf()"
          ariaLabel="Toggle admin"
          (onChange)="roleChanged.emit($event.checked === true)"
        />
      </span>
      <span class="flex items-center gap-2 text-xs text-slate-500">
        Suspend
        <p-toggleswitch
          [ngModel]="member().status === 'suspended'"
          [disabled]="isSelf()"
          ariaLabel="Toggle suspended"
          (onChange)="statusChanged.emit($event.checked === true)"
        />
      </span>
      <button
        type="button"
        class="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
        [disabled]="isSelf()"
        (click)="removed.emit()"
        aria-label="Remove member"
      >
        <lucide-icon name="trash-2" [size]="16"></lucide-icon>
      </button>
    </div>
  `,
})
export class TeamMemberRowComponent {
  /** The member this row renders. */
  readonly member = input.required<TeamMember>();
  /** The signed-in user's id — drives the self-modification lockout. */
  readonly currentUserId = input.required<string>();

  /** Admin toggle changed (desired isAdmin). */
  readonly roleChanged = output<boolean>();
  /** Suspend toggle changed (desired suspended state). */
  readonly statusChanged = output<boolean>();
  /** Trash clicked. */
  readonly removed = output<void>();

  protected readonly isSelf = computed(() => this.member().userId === this.currentUserId());
  protected readonly selfTooltip = computed(() =>
    this.isSelf() ? "You can't change your own membership." : ''
  );
}
