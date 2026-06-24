import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/auth/auth.service';
import { errorDetail } from '../../../core/http-error';
import { TeamService, TeamMember } from '../../../core/team/team.service';
import { EditSectionComponent } from '../../../shared/edit-section/edit-section.component';
import { EditFieldComponent } from '../../../shared/edit-field/edit-field.component';
import { DrawerComponent } from '../../../shared/drawer/drawer.component';
import { UserAvatarComponent } from '../../../shared/user-avatar/user-avatar.component';

/** The invite-team-member drawer form. */
interface InviteForm {
  email: string;
  displayName: string;
  jobTitle: string;
  isAdmin: boolean;
}

/** pV2-STORE-01 — the Profile "Team Members" section: roster (avatar · name ·
 *  role · email) + the inline invite drawer. Extracted from profile.component.ts
 *  (STORE-01 audit — profile was 660 lines, over the component alarm). `/api/team`
 *  is admin-gated, so the roster only populates for admins (members see a note).
 *  Inherits the host page's MessageService (toasts land in its p-toast). */
@Component({
  selector: 'app-profile-team-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [FormsModule, ToggleSwitchModule, LucideAngularModule, EditSectionComponent, EditFieldComponent, DrawerComponent, UserAvatarComponent],
  template: `
    <app-edit-section title="Team Members" [editable]="false">
      @if (team.value(); as members) {
        <div class="flex flex-col gap-4">
          @for (m of members; track m.userId ?? m.email) {
            <div class="flex items-center gap-3">
              <app-user-avatar [displayName]="m.displayName" [email]="m.email" [imageUrl]="m.avatarUrl" [size]="40" />
              <div class="min-w-0 flex-1">
                <div class="bp-list-title truncate">{{ m.displayName ?? m.email }}</div>
                <div class="truncate bp-body-small text-secondary">{{ memberRole(m) }}</div>
              </div>
              <div class="shrink-0 truncate bp-body-small text-secondary">{{ m.email }}</div>
            </div>
          }
        </div>
      } @else if (team.isLoading()) {
        <p class="bp-caption">Loading…</p>
      } @else {
        <p class="bp-caption">Only organisation admins can view team members.</p>
      }
      @if (canEdit()) {
        <button type="button" class="bp-btn-grad mt-5" (click)="openInvite()">
          <lucide-icon name="plus" [size]="15" /> Invite Team Member
        </button>
      }
    </app-edit-section>

    <app-drawer [(open)]="inviteDrawer" title="Invite team member">
      <div class="flex flex-col gap-5">
        <app-edit-field label="Email" type="email" density="page" [editing]="true" [value]="inviteForm().email" (valueChange)="patchInvite({ email: $event })" />
        <app-edit-field label="Display name" density="page" [editing]="true" [value]="inviteForm().displayName" (valueChange)="patchInvite({ displayName: $event })" />
        <app-edit-field label="Job title" density="page" [editing]="true" [value]="inviteForm().jobTitle" (valueChange)="patchInvite({ jobTitle: $event })" />
        <label class="flex items-center gap-2.5">
          <span class="bp-field-label">Admin</span>
          <p-toggleswitch
            [ngModel]="inviteForm().isAdmin"
            ariaLabel="Invite as admin"
            (onChange)="patchInvite({ isAdmin: $event.checked === true })"
          />
        </label>
        <div class="mt-1 flex justify-end gap-2.5">
          <button type="button" class="bp-btn-outline" [disabled]="inviting()" (click)="inviteDrawer.set(false)">Cancel</button>
          <button type="button" class="bp-btn-grad" [disabled]="inviting()" (click)="sendInvite()">
            {{ inviting() ? 'Inviting…' : 'Send invite' }}
          </button>
        </div>
      </div>
    </app-drawer>
  `,
})
export class ProfileTeamSectionComponent {
  private readonly auth = inject(AuthService);
  private readonly teamSvc = inject(TeamService);
  private readonly toast = inject(MessageService);

  /** Org admins (org.manage_billing) see the Invite button. */
  readonly canEdit = input(false);

  protected readonly team = resource({
    params: () => (this.canEdit() ? (this.auth.user()?.activeOrgId ?? undefined) : undefined),
    loader: () => firstValueFrom(this.teamSvc.list()),
  });

  protected readonly inviteDrawer = signal(false);
  protected readonly inviting = signal(false);
  protected readonly inviteForm = signal<InviteForm>({ email: '', displayName: '', jobTitle: '', isAdmin: false });

  protected openInvite(): void {
    this.inviteForm.set({ email: '', displayName: '', jobTitle: '', isAdmin: false });
    this.inviteDrawer.set(true);
  }
  protected patchInvite(p: Partial<InviteForm>): void {
    this.inviteForm.update((f) => ({ ...f, ...p }));
  }
  protected async sendInvite(): Promise<void> {
    const f = this.inviteForm();
    if (!f.email.trim()) {
      this.toast.add({ severity: 'warn', summary: 'Email is required', life: 3000 });
      return;
    }
    this.inviting.set(true);
    try {
      await firstValueFrom(
        this.teamSvc.invite({
          email: f.email.trim(),
          displayName: f.displayName.trim() || undefined,
          jobTitle: f.jobTitle.trim() || undefined,
          isAdmin: f.isAdmin,
        })
      );
      this.toast.add({ severity: 'success', summary: 'Invite sent.', life: 3000 });
      this.inviteDrawer.set(false);
      this.team.reload();
    } catch (e) {
      this.toast.add({ severity: 'error', summary: "Couldn't send invite — please try again.", detail: errorDetail(e), life: 5000 });
    } finally {
      this.inviting.set(false);
    }
  }

  /** Display role: the member's job title, else their effective role. */
  protected memberRole(m: TeamMember): string {
    if (m.jobTitle) return m.jobTitle;
    const t = this.auth.user()?.activeOrgType;
    return t === 'ballpark' ? 'ballpark_admin'
      : t === 'agency' ? (m.isAdmin ? 'agency_admin' : 'agency_member')
      : t === 'supplier' ? (m.isAdmin ? 'supplier_admin' : 'supplier_member')
      : (m.isAdmin ? 'admin' : 'member');
  }
}
