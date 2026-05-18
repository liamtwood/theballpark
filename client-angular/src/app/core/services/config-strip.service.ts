import { Injectable, TemplateRef } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Drives the in-context config strip — a horizontal bar between the
 * top-nav and the page hero that holds per-page toggles (theme, circle
 * size, view, detail size, detail mode etc).
 *
 * The strip is hidden by default. The cog icon in the top-nav calls
 * toggle() to show/hide it. Pages opt into the strip in one of two
 * ways:
 *
 *   1. Wrap their config UI in <app-config-strip>…</app-config-strip>.
 *      The component projects via <ng-content> and the strip renders
 *      inline (at the position of the host page's template).
 *
 *   2. Provide a TemplateRef via setTemplate(). The AppShell picks
 *      this up and renders the strip in its lifted slot — between the
 *      hero and bp-shell-body — so the strip spans full width even
 *      when navMode='sidenav' (i.e. the sidenav starts BELOW the
 *      strip). Used by the dashboard so its Home settings strip sits
 *      above the left menu rather than beside it. v1.23f.
 *
 * Both paths feed into the same hasConfig$ + open$ state, so the
 * top-nav cog renders consistently regardless of which the page
 * chose.
 */
@Injectable({ providedIn: 'root' })
export class ConfigStripService {
  private readonly _open$ = new BehaviorSubject<boolean>(false);
  private readonly _hasConfig$ = new BehaviorSubject<boolean>(false);
  private readonly _template$ = new BehaviorSubject<TemplateRef<any> | null>(null);
  private mountedCount = 0;

  readonly open$ = this._open$.asObservable();
  readonly hasConfig$ = this._hasConfig$.asObservable();
  readonly template$ = this._template$.asObservable();

  toggle() { this._open$.next(!this._open$.value); }
  setOpen(open: boolean) { this._open$.next(open); }
  get isOpen() { return this._open$.value; }
  get template() { return this._template$.value; }

  /** Increment mount count. Used by the inline <app-config-strip>
      component on init so the cog button appears on its host page. */
  register() {
    this.mountedCount++;
    this._hasConfig$.next(this.mountedCount > 0 || !!this._template$.value);
  }

  /** Decrement mount count and force-close if no strips remain. */
  unregister() {
    this.mountedCount = Math.max(0, this.mountedCount - 1);
    const has = this.mountedCount > 0 || !!this._template$.value;
    this._hasConfig$.next(has);
    if (!has) this._open$.next(false);
  }

  /** v1.23f: push (or clear) the lifted-slot template. AppShell
      renders this via *ngTemplateOutlet in its own DOM, between the
      hero and bp-shell-body. Pass null on destroy to clear.
      Internally treated as a register/unregister so hasConfig$ stays
      accurate. */
  setTemplate(tpl: TemplateRef<any> | null) {
    const had = !!this._template$.value;
    this._template$.next(tpl);
    const has = this.mountedCount > 0 || !!tpl;
    this._hasConfig$.next(has);
    if (!has) this._open$.next(false);
    // No-op transitions are fine — _hasConfig$ only emits if the
    // BehaviorSubject value actually changed (or always emits; either
    // way subscribers handle it).
    void had;
  }
}
