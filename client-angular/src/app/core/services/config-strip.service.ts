import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Drives the in-context config strip — a horizontal bar between the
 * top-nav and the page hero that holds per-page toggles (theme, circle
 * size, view, detail size, detail mode etc).
 *
 * The strip is hidden by default. The cog icon in the top-nav calls
 * toggle() to show/hide it. Pages mount <app-config-strip> which
 * registers itself so the cog only renders on pages that have config.
 */
@Injectable({ providedIn: 'root' })
export class ConfigStripService {
  private readonly _open$ = new BehaviorSubject<boolean>(false);
  private readonly _hasConfig$ = new BehaviorSubject<boolean>(false);
  private mountedCount = 0;

  readonly open$ = this._open$.asObservable();
  readonly hasConfig$ = this._hasConfig$.asObservable();

  toggle() { this._open$.next(!this._open$.value); }
  setOpen(open: boolean) { this._open$.next(open); }
  get isOpen() { return this._open$.value; }

  register() {
    this.mountedCount++;
    this._hasConfig$.next(this.mountedCount > 0);
  }

  unregister() {
    this.mountedCount = Math.max(0, this.mountedCount - 1);
    this._hasConfig$.next(this.mountedCount > 0);
    if (this.mountedCount === 0) this._open$.next(false);
  }
}
