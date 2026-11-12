import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/auth/auth.service';
import { errorDetail } from '../../../core/http-error';
import { TeamMember, TeamService } from '../../../core/team/team.service';
import { PageHeroComponent } from '../../../shell/page-hero/page-hero.component';
import { TeamMemberRowComponent } from './team-member-row.component';
import { ModalComponent } from '../../../shared/modal/modal.component';

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
  imports: [ReactiveFormsModule, ModalComponent, LucideAngularModule, ToastModule, PageHeroComponent, TeamMemberRowComponent],
  providers: [MessageService],
  host: { class: 'block' },
  template: `
    @let me = auth.user();

    <app-page-hero align="block" [back]="{ label: 'Back', href: '/home' }" title="Team" [subtitle]="me?.activeOrgName ?? ''">
      <button hero-actions type="button" class="bp-btn-grad" (click)="openInvite()">
        <lucide-icon name="circle-plus" [size]="15" /> Invite Team Member
      </button>
    </app-page-hero>

    <div class="bp-page-body bp-page-body--workspace">
      @if (members.isLoading()) {
        <p class="text-md text-secondary">Loading team…</p>
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
            <p class="px-4 py-6 text-md text-secondary">No team members yet.</p>
          }
        </div>
      }
    </div>

    <!-- Invite modal — ESC + backdrop dismiss = Cancel (DIALOGS.md rule 5). -->
    <app-modal title="Invite a team member" [open]="inviteOpen()" (close)="inviteOpen.set(false)" width="380px">
      <form class="flex flex-col gap-4" [formGroup]="inviteForm" (ngSubmit)="submitInvite()">
        <label class="block">
          <span class="ed-label mb-1.5 block">Email *</span>
          <input type="email" formControlName="email" class="ed-input" placeholder="name@company.com" />
        </label>
        <label class="block">
          <span class="ed-label mb-1.5 block">Name</span>
          <input type="text" formControlName="displayName" class="ed-input" />
        </label>
        <label class="block">
          <span class="ed-label mb-1.5 block">Job title</span>
          <input type="text" formControlName="jobTitle" class="ed-input" />
        </label>
        <label class="flex items-center gap-2 text-md text-secondary">
          <input type="checkbox" formControlName="isAdmin" class="rounded border-medium" />
          Make admin
        </label>
      </form>

      <button modalFooter type="button" class="bp-btn--secondary" (click)="inviteOpen.set(false)">Cancel</button>
      <button modalFooter type="button" class="bp-btn--primary" [disabled]="inviteForm.invalid || inviting()" (click)="submitInvite()">Invite</button>
    </app-modal>

    <!-- Remove confirmation — the locked confirm template + bp-btn-danger
         (the pairing rule holds). ESC + backdrop dismiss = Cancel. -->
    <app-modal
      variantClass="bp-modal--confirm"
      [open]="removeTarget() !== null"
      (close)="removeTarget.set(null)"
      [closable]="false"
      width="420px"
    >
      <div modalHeader>
        <div class="bp-modal__icon">
          <lucide-icon name="trash-2" [size]="20" />
        </div>
        <h2 class="bp-card-title">Remove {{ removeTarget()?.displayName ?? removeTarget()?.email }}?</h2>
      </div>
      @if (removeTarget(); as t) {
        <p class="bp-body text-secondary">
          They'll lose access to this org. Reversible — you can re-invite them by email.
        </p>
      }
      <button modalFooter type="button" class="bp-btn--secondary" (click)="removeTarget.set(null)">Cancel</button>
      @if (removeTarget(); as t) {
        <button modalFooter type="button" class="bp-btn-danger" (click)="doRemove(t)">Remove</button>
      }
    </app-modal>

    <!-- MessageService supplies aria-live by severity (polite success/info,
         assertive error) — no explicit role needed (audit F-10). -->
    <p-toast position="bottom-right" styleClass="bp-toast" />
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
      // Locked toast copy (DIALOGS.md standard messages).
      this.toast.add({ severity: 'success', summary: 'Sent.', detail: v.email, life: 3000 });
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
