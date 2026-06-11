import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../core/auth/auth.service';
import { errorDetail } from '../../core/http-error';
import { OnboardingService } from '../../core/onboarding.service';
import { defaultOrgName } from './org-name-default';

/** Typed onboarding form. */
interface OnboardingForm {
  orgType: FormControl<'agency' | 'supplier'>;
  orgName: FormControl<string>;
}

/** Onboarding (pV2-02b) — the one screen between a brand-new Google signup
 *  and their /home: pick Agency or Supplier, name the org, submit. Pure-bleed
 *  route (no shell); needsOnboardingGuard keeps has-org users out. Success
 *  hard-reloads to /home so the whole app re-bootstraps on the re-signed
 *  cookie (same pattern as devLogin / the Google callback). */
@Component({
  selector: 'app-onboarding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ButtonModule, ToastModule],
  providers: [MessageService],
  host: { class: 'flex min-h-screen items-center justify-center px-6' },
  template: `
    <article class="w-full max-w-lg rounded-2xl bg-surface-alt p-8 shadow-sm">
      <h1 class="text-2xl font-semibold tracking-tight">Set up your organisation</h1>
      <p class="mt-1 text-md text-secondary">
        Pick the type that fits, name it, and you're in. You can rename later in Settings.
      </p>

      <form [formGroup]="form" (ngSubmit)="submit()" class="mt-6">
        <fieldset class="grid grid-cols-2 gap-3">
          <label
            class="type-tile cursor-pointer rounded-xl border border-hairline p-4"
            [class.type-tile--selected]="form.controls.orgType.value === 'agency'"
          >
            <input type="radio" formControlName="orgType" value="agency" class="sr-only" (change)="onTypeChange()" />
            <strong class="block text-md">Event Agency</strong>
            <span class="mt-1 block text-sm text-secondary">
              Produce events. Build estimates, browse suppliers, send leads.
            </span>
          </label>
          <label
            class="type-tile cursor-pointer rounded-xl border border-hairline p-4"
            [class.type-tile--selected]="form.controls.orgType.value === 'supplier'"
          >
            <input type="radio" formControlName="orgType" value="supplier" class="sr-only" (change)="onTypeChange()" />
            <strong class="block text-md">Supplier</strong>
            <span class="mt-1 block text-sm text-secondary">
              Supply products or services. Upload your catalogue, receive leads.
            </span>
          </label>
        </fieldset>

        <label class="mt-5 block">
          <span class="block text-md font-medium">Organisation name</span>
          <input
            type="text"
            formControlName="orgName"
            maxlength="100"
            class="mt-1 w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-md"
          />
          <span class="mt-1 block text-sm text-secondary">
            e.g. Anchor Events, Studio Volta, Webb &amp; Co.
          </span>
        </label>

        <p-button
          label="Create Organisation →"
          type="submit"
          styleClass="w-full"
          class="mt-6 block"
          [disabled]="form.invalid || inFlight()"
        />
      </form>
    </article>

    <p-toast position="bottom-right" />
  `,
  styles: [
    `
      /* Selected tile — theme tokens only (soft surface + accent border). */
      .type-tile--selected {
        background: var(--theme-soft);
        border-color: var(--theme-accent);
      }
      .type-tile:has(input:focus-visible) {
        outline: 2px solid var(--theme-accent);
        outline-offset: 2px;
      }
    `,
  ],
})
export class OnboardingComponent {
  private readonly auth = inject(AuthService);
  private readonly onboarding = inject(OnboardingService);
  private readonly router = inject(Router);
  private readonly toast = inject(MessageService);

  protected readonly inFlight = signal(false);

  protected readonly form = new FormGroup<OnboardingForm>({
    orgType: new FormControl<'agency' | 'supplier'>('agency', { nonNullable: true }),
    orgName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
    }),
  });

  constructor() {
    const u = this.auth.user();
    this.form.controls.orgName.setValue(
      defaultOrgName(u?.displayName ?? null, u?.email ?? null, 'agency')
    );
  }

  /** Radio change swaps the pre-filled suffix — but never overwrites a name
   *  the user has typed (dirty check). */
  protected onTypeChange(): void {
    if (this.form.controls.orgName.dirty) return;
    const u = this.auth.user();
    this.form.controls.orgName.setValue(
      defaultOrgName(u?.displayName ?? null, u?.email ?? null, this.form.controls.orgType.value)
    );
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.inFlight()) return;
    this.inFlight.set(true);
    try {
      await firstValueFrom(
        this.onboarding.createOrg({
          orgType: this.form.controls.orgType.value,
          orgName: this.form.controls.orgName.value.trim(),
        })
      );
      // Server re-signed the cookie with the new org_id — hard reload so the
      // app re-bootstraps with the fresh session.
      window.location.href = '/home';
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 401) {
        // Cookie expired mid-form (e.g. server restart) — back through login.
        this.toast.add({ severity: 'warn', summary: 'Please sign in again', life: 3000 });
        void this.router.navigate(['/login']);
      } else if (e instanceof HttpErrorResponse && e.status >= 400 && e.status < 500) {
        this.toast.add({ severity: 'error', summary: 'Could not create organisation', detail: errorDetail(e), life: 4000 });
      } else {
        // 5xx / network — generic message for the user, detail to the console.
        console.warn('[onboarding] create-org failed unexpectedly', e);
        this.toast.add({ severity: 'error', summary: 'Something went wrong. Please try again.', life: 4000 });
      }
      this.inFlight.set(false);
    }
  }
}
