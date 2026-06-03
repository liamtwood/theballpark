import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Drives the page-settings surface — historically a horizontal config
 * strip, now (post-p0017) a right-side drawer.
 *
 * Hidden by default. The cog icon in the top-nav calls toggle() to
 * show/hide it. Pages opt in by mounting one of two consumers:
 *
 *   1. <app-page-config-drawer> — the canonical post-p0017 surface
 *      (theme / labels / hero align / nav / component visibility).
 *      Renders as a PrimeNG p-sidebar; binds two-way to open$.
 *
 *   2. <app-config-strip> — the legacy inline content-projection
 *      wrapper. Still used by catalogue-grid (marketplace) for its
 *      own browse-controls. Renders inline at the consumer's host
 *      position.
 *
 * Both call register()/unregister() so the top-nav cog renders
 * consistently regardless of which surface lit it up.
 *
 * v1.65hJ (p0017): setTemplate() + template$ removed. The lifted-slot
 * pattern they powered (AppShell rendering an external TemplateRef
 * between hero and body) is no longer needed now that the page-
 * settings surface migrated to a drawer.
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

  /** Mount-side. Called by <app-config-strip> / <app-page-config-drawer>
      on init so the top-nav cog appears on the host page. */
  register() {
    this.mountedCount++;
    this._hasConfig$.next(this.mountedCount > 0);
  }

  /** Decrement mount count and force-close if no consumers remain. */
  unregister() {
    this.mountedCount = Math.max(0, this.mountedCount - 1);
    const has = this.mountedCount > 0;
    this._hasConfig$.next(has);
    if (!has) this._open$.next(false);
  }
}
