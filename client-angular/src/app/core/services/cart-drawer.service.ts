import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

/**
 * v1.65ab — shared "Project Items" cart drawer coordinator. Mirrors the
 * EstimateDrawerService / AddCategoryService pattern: every surface (the
 * project marketplace cart icon, future Plan/Build tabs) opens the same
 * drawer via `open(projectId, opts?)`. Drawer mounted once globally in
 * app-shell.
 *
 * The drawer renders the project's project_items: selected (tick) above,
 * wishlist (heart) below. It is NOT the Estimate drawer.
 *
 * v1.65ae — open() now accepts an optional CartDrawerOptions payload so
 * a caller can scope the drawer to a single category. The catalogue-grid
 * already knows the category-tree matching, so it pre-computes the
 * matching item_ids and passes them through here; the drawer stays
 * dumb about taxonomy.
 */
export interface CartDrawerOptions {
  /** Eyebrow label override. Default: 'PROJECT ITEMS'. */
  contextLabel?: string;
  /** Title override. Default: 'Your selections'. */
  contextTitle?: string;
  /** Whitelist of item_ids — drawer renders only rows whose item_id is
      in this set. When omitted, all project_items render. */
  itemIds?: string[];
}

export interface CartDrawerRequest {
  projectId: string;
  options: CartDrawerOptions;
}

@Injectable({ providedIn: 'root' })
export class CartDrawerService {
  /** Active request when open, null when closed. */
  private readonly _request = new BehaviorSubject<CartDrawerRequest | null>(null);
  readonly request$ = this._request.asObservable();

  /** Emits after a row is mutated (remove / promote) so the calling
      surface can refresh its own project_items cache + badge count. */
  private readonly _changed = new Subject<{ projectId: string }>();
  readonly changed$ = this._changed.asObservable();

  open(projectId: string, options: CartDrawerOptions = {}): void {
    this._request.next({ projectId, options });
  }
  close(): void { this._request.next(null); }
  markChanged(projectId: string): void { this._changed.next({ projectId }); }
}
