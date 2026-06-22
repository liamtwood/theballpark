import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { AdminSecretService } from '../../core/admin/admin-secret.service';
import { AdminMarketingService } from '../../core/admin/admin-marketing.service';

/** pV2-EA-02 — the `/ballpark-settings/*` shell + interim secret gate.
 *  Pure-bleed (outside the app shell): Ballpark team reach it without an org
 *  session — the admin secret IS the auth (TECH-DEBT-01 / BALLPARK_ADMIN §5).
 *  When the secret is present the routed child renders; otherwise a one-time
 *  entry form. Validates by hitting a gated endpoint (the interceptor attaches
 *  the secret). RP-A1: the secret is never logged or echoed. */
@Component({
  selector: 'app-ballpark-settings-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [RouterOutlet, FormsModule, LucideAngularModule],
  template: `
    @if (adminSecret.hasSecret()) {
      <router-outlet />
    } @else {
      <div class="bp-gate">
        <form class="bp-gate-card" (ngSubmit)="unlock()">
          <span class="bp-gate-lock"><lucide-icon name="lock" [size]="22" /></span>
          <h1 class="bp-gate-title">Ballpark Settings</h1>
          <p class="bp-gate-sub">Enter the admin secret to continue.</p>
          <input
            class="bp-gate-input"
            type="password"
            name="secret"
            autocomplete="off"
            placeholder="Admin secret"
            [(ngModel)]="secret"
            [disabled]="checking()"
          />
          @if (error()) {
            <p class="bp-gate-error">{{ error() }}</p>
          }
          <button class="bp-btn-grad bp-gate-submit" type="submit" [disabled]="checking() || !secret.trim()">
            {{ checking() ? 'Checking…' : 'Unlock' }}
          </button>
        </form>
      </div>
    }
  `,
  styles: `
    .bp-gate {
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: var(--color-surface-sunken, var(--color-surface));
    }
    .bp-gate-card {
      width: 100%;
      max-width: 360px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 32px 28px;
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-card);
      background: var(--color-surface);
      box-shadow: var(--shadow-md);
      text-align: center;
    }
    .bp-gate-lock {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 999px;
      background: var(--theme-soft);
      color: var(--theme-accent);
    }
    .bp-gate-title { font-size: var(--text-2xl); font-weight: 400; color: var(--color-text-strong); margin-top: 4px; }
    .bp-gate-sub { font-size: var(--text-sm); color: var(--color-text-secondary); margin-bottom: 8px; }
    .bp-gate-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--color-border-medium);
      border-radius: var(--radius-button);
      background: var(--color-surface);
      color: var(--color-text);
      font-size: var(--text-base);
    }
    .bp-gate-input:focus-visible { outline: 2px solid var(--theme-accent); outline-offset: 1px; }
    .bp-gate-error { color: var(--color-state-error, var(--theme-accent)); font-size: var(--text-sm); margin: 0; }
    .bp-gate-submit { width: 100%; margin-top: 4px; }
  `,
})
export class BallparkSettingsLayoutComponent {
  protected readonly adminSecret = inject(AdminSecretService);
  private readonly adminMkt = inject(AdminMarketingService);

  protected secret = '';
  protected readonly checking = signal(false);
  protected readonly error = signal('');

  protected async unlock(): Promise<void> {
    const candidate = this.secret.trim();
    if (!candidate || this.checking()) return;
    this.checking.set(true);
    this.error.set('');
    // Set it so the interceptor attaches it to the validation call; clear on
    // rejection. We never log or surface the secret value itself (RP-A1).
    this.adminSecret.set(candidate);
    try {
      await firstValueFrom(this.adminMkt.getSettings());
      this.secret = '';
    } catch {
      this.adminSecret.clear();
      this.error.set('That secret was not accepted.');
    } finally {
      this.checking.set(false);
    }
  }
}
