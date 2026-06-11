import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/auth/auth.service';
import { TeamMember, TeamService } from '../../../core/team/team.service';
import { PageHeroComponent } from '../../../shell/page-hero/page-hero.component';
import { TeamMemberRowComponent } from './team-member-row.component';

/** Typed invite form. */
interface InviteForm {
  email: FormControl<string>;
  displayName: FormControl<string>;
  jobTitle: FormControl<string>;
  isAdmin: FormControl<boolean>;
}

/** Settings → Team: list, invite, role/suspend toggles, removal. Admin-gated
 *  (adminGuard + every server route re-checks live membership). */
@Component({
  selector: 'app-team',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ButtonModule, DialogModule, ToastModule, PageHeroComponent, TeamMemberRowComponent],
  providers: [MessageService],
  host: { class: 'block' },
  template: `
    @let me = auth.user();

    <app-page-hero title="Team" [subtitle]="me?.activeOrgName ?? ''">
      <p-button hero-actions label="+ Invite Team Member" size="small" (onClick)="openInvite()" />
    </app-page-hero>

    <div class="bp-page-body">
      @if (members.isLoading()) {
        <p class="text-sm text-secondary">Loading team…</p>
      } @else if (members.value(); as list) {
        <div class="overflow-hidden rounded-xl border border-hairline bg-surface">
          @for (m of list; track m.userId ?? m.email) {
            <app-team-member-row
              [member]="m"
              [currentUserId]="me?.id ?? ''"
              (roleChanged)="setAdmin(m, $event)"
              (statusChanged)="setSuspended(m, $event)"
              (removed)="confirmRemove(m)"
            />
          } @empty {
            <p class="px-4 py-6 text-sm text-secondary">No team members yet.</p>
          }
        </div>
      }
    </div>

    <!-- Invite modal -->
    <p-dialog header="Invite a team member" [visible]="inviteOpen()" (visibleChange)="inviteOpen.set($event === true)" [modal]="true" [style]="{ width: '380px' }">
      <form class="flex flex-col gap-3" [formGroup]="inviteForm" (ngSubmit)="submitInvite()">
        <label class="text-xs font-medium text-secondary">
          Email *
          <input type="email" formControlName="email" class="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm" placeholder="name@company.com" />
        </label>
        <label class="text-xs font-medium text-secondary">
          Name
          <input type="text" formControlName="displayName" class="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm" />
        </label>
        <label class="text-xs font-medium text-secondary">
          Job title
          <input type="text" formControlName="jobTitle" class="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm" />
        </label>
        <label class="flex items-center gap-2 text-sm text-secondary">
          <input type="checkbox" formControlName="isAdmin" class="rounded border-medium" />
          Make admin
        </label>
        <div class="mt-2 flex justify-end gap-2">
          <p-button label="Cancel" severity="secondary" [text]="true" size="small" (onClick)="inviteOpen.set(false)" />
          <p-button label="Invite" size="small" type="submit" [disabled]="inviteForm.invalid || inviting()" />
        </div>
      </form>
    </p-dialog>

    <!-- Remove confirmation -->
    <p-dialog header="Remove member?" [visible]="removeTarget() !== null" (visibleChange)="!$event && removeTarget.set(null)" [modal]="true" [style]="{ width: '380px' }">
      @if (removeTarget(); as t) {
        <p class="text-sm text-secondary">
          Remove <strong>{{ t.displayName ?? t.email }}</strong>? They'll lose access to this org.
          Reversible — you can re-invite them by email.
        </p>
        <div class="mt-4 flex justify-end gap-2">
          <p-button label="Cancel" severity="secondary" [text]="true" size="small" (onClick)="removeTarget.set(null)" />
          <p-button label="Remove" severity="danger" size="small" (onClick)="doRemove(t)" />
        </div>
      }
    </p-dialog>

    <p-toast position="bottom-right" />
  `,
})
export class TeamComponent {
  protected readonly auth = inject(AuthService);
  private readonly team = inject(TeamService);
  private readonly toast = inject(MessageService);

  /** The member list — resource per the v2 fetch-into-state standard. */
  protected readonly members = resource<TeamMember[], void>({
    loader: () => firstValueFrom(this.team.list()),
  });

  protected readonly inviteOpen = signal(false);
  protected readonly inviting = signal(false);
  protected readonly removeTarget = signal<TeamMember | null>(null);

  protected readonly inviteForm = new FormGroup<InviteForm>({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    displayName: new FormControl('', { nonNullable: true }),
    jobTitle: new FormControl('', { nonNullable: true }),
    isAdmin: new FormControl(false, { nonNullable: true }),
  });

  protected openInvite(): void {
    this.inviteForm.reset();
    this.inviteOpen.set(true);
  }

  protected async submitInvite(): Promise<void> {
    if (this.inviteForm.invalid) return;
    this.inviting.set(true);
    const v = this.inviteForm.getRawValue();
    try {
      await firstValueFrom(this.team.invite({
        email: v.email,
        displayName: v.displayName || undefined,
        jobTitle: v.jobTitle || undefined,
        isAdmin: v.isAdmin,
      }));
      this.inviteOpen.set(false);
      this.members.reload();
      this.toast.add({ severity: 'success', summary: 'Invite created', detail: v.email, life: 3000 });
    } catch (e) {
      this.toast.add({ severity: 'error', summary: 'Invite failed', detail: errorDetail(e), life: 4000 });
    } finally {
      this.inviting.set(false);
    }
  }

  protected async setAdmin(m: TeamMember, isAdmin: boolean): Promise<void> {
    if (!m.userId) return;
    try {
      await firstValueFrom(this.team.setAdmin(m.userId, isAdmin));
      this.members.reload();
    } catch (e) {
      this.toast.add({ severity: 'error', summary: 'Change rejected', detail: errorDetail(e), life: 4000 });
      this.members.reload(); // revert the toggle to server truth
    }
  }

  protected async setSuspended(m: TeamMember, suspend: boolean): Promise<void> {
    if (!m.userId) return;
    try {
      await firstValueFrom(this.team.setStatus(m.userId, suspend));
      this.members.reload();
    } catch (e) {
      this.toast.add({ severity: 'error', summary: 'Change rejected', detail: errorDetail(e), life: 4000 });
      this.members.reload();
    }
  }

  protected confirmRemove(m: TeamMember): void {
    this.removeTarget.set(m);
  }

  protected async doRemove(m: TeamMember): Promise<void> {
    if (!m.userId) return;
    this.removeTarget.set(null);
    try {
      await firstValueFrom(this.team.remove(m.userId));
      this.members.reload();
      this.toast.add({ severity: 'success', summary: 'Member removed', detail: m.displayName ?? m.email, life: 3000 });
    } catch (e) {
      this.toast.add({ severity: 'error', summary: 'Remove rejected', detail: errorDetail(e), life: 4000 });
    }
  }
}

/** Pull the API's { error } message out of an HttpErrorResponse-ish unknown. */
function errorDetail(e: unknown): string {
  if (e && typeof e === 'object' && 'error' in e) {
    const inner = (e as { error: unknown }).error;
    if (inner && typeof inner === 'object' && 'error' in inner) {
      return String((inner as { error: unknown }).error);
    }
  }
  return 'Request failed';
}
