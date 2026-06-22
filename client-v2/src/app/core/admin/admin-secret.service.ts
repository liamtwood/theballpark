import { Injectable, computed, signal } from '@angular/core';

/** pV2-EA-02 — interim admin auth (TECH-DEBT-01 UI counterpart, BALLPARK_ADMIN
 *  §5). The `ADMIN_API_SECRET` is entered once per browser session and held in
 *  sessionStorage (NOT localStorage — a server secret must not persist past the
 *  session). The HTTP interceptor attaches it to `/api/admin/*` calls. Retires
 *  at pV2-AUTH-01 (replaced by the verified JWT + ballpark_admin role).
 *
 *  RP-A1: never log the secret, never echo it back, never put it in an error. */
const KEY = 'bp_admin_secret';

@Injectable({ providedIn: 'root' })
export class AdminSecretService {
  private readonly _secret = signal<string | null>(sessionStorage.getItem(KEY));

  /** Reactive — the gate shows the entry form until this is true. */
  readonly hasSecret = computed(() => !!this._secret());

  get(): string | null {
    return this._secret();
  }

  set(secret: string): void {
    sessionStorage.setItem(KEY, secret);
    this._secret.set(secret);
  }

  clear(): void {
    sessionStorage.removeItem(KEY);
    this._secret.set(null);
  }
}
