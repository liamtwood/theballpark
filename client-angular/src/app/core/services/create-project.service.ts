import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Tiny coordinator for the "+ New project" intake modal — v1.30.
 *
 * The modal itself is mounted ONCE inside app-shell so every "+ New
 * project" trigger across the app (dashboard, project list, future
 * top-nav button) just calls `open()` instead of routing to a
 * standalone /projects/new page.
 *
 * Component subscribes to `visible$` to flip its [(visible)] binding.
 */
@Injectable({ providedIn: 'root' })
export class CreateProjectService {
  private _visible = new BehaviorSubject<boolean>(false);
  readonly visible$ = this._visible.asObservable();

  open()  { this._visible.next(true); }
  close() { this._visible.next(false); }
  /** Used by [(visible)]="…" two-way binding in the host template. */
  setVisible(v: boolean) { this._visible.next(v); }
}
