import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

/**
 * v1.65ab — shared "Project Items" cart drawer coordinator. Mirrors the
 * EstimateDrawerService / AddCategoryService pattern: every surface (the
 * project marketplace cart icon, future Plan/Build tabs) opens the same
 * drawer via `open(projectId)`. Drawer mounted once globally in app-shell.
 *
 * The drawer renders the project's project_items: selected (tick) above,
 * wishlist (heart) below. It is NOT the Estimate drawer.
 */
@Injectable({ providedIn: 'root' })
export class CartDrawerService {
  /** Active project id when open, null when closed. */
  private readonly _projectId = new BehaviorSubject<string | null>(null);
  readonly projectId$ = this._projectId.asObservable();

  /** Emits after a row is mutated (remove / promote) so the calling
      surface can refresh its own project_items cache + badge count. */
  private readonly _changed = new Subject<{ projectId: string }>();
  readonly changed$ = this._changed.asObservable();

  open(projectId: string): void { this._projectId.next(projectId); }
  close(): void { this._projectId.next(null); }
  markChanged(projectId: string): void { this._changed.next({ projectId }); }
}
