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
  /** v1.65ej — when scoped to a category (Catering, AV, etc.), pass
      the category_id so the drawer's budget headroom card reads the
      project_category's ballpark_budget instead of the project-wide
      project_budget. Omitting it (or passing null) keeps the All
      view's project-wide budget. */
  contextCategoryId?: string;
  /** v1.65er — when set, the drawer renders these rows directly
      INSTEAD of fetching project_items. Used by the inbox "Cart"
      chip so the supplier sees every message_item (catalogue
      matches AND ad-hoc asks) — not just the intersection that
      happens to live in the agency's project cart. Each row is a
      simplified shape carrying enough to render + show the price. */
  rows?: CartDrawerRow[];
  /** v1.65es — viewer side. 'agent' (default) shows the full
      agency-facing chrome: WISHLIST, ADDITIONAL ASKS, margin in
      the summary footer, Send Brief CTA. 'supplier' tightens the
      view down to what Ryan needs: just the cart rows, cost per
      head, VAT (no margin — that's the agency's bookkeeping), and
      a forward CTA into the supplier action train. */
  viewer?: 'agent' | 'supplier';
}

/** v1.65er — simplified row shape for the inbox "Cart" view. Mirrors
    the fields the cart drawer reads off project_items so the existing
    template can render either source with no branching. */
export interface CartDrawerRow {
  id: string;
  item_id?: string | null;
  name: string;
  description?: string | null;
  image_url?: string | null;
  base_price?: number | null;
  unit?: string | null;
  supplier_name?: string | null;
  supplier_cover_url?: string | null;
  category_icon_color?: string | null;
  /** Pre-computed line total. When omitted the drawer falls back to
      base_price × guest_count for per-attendee units. */
  line_total?: number | null;
  /** message_items.status for this row when sourced from a thread —
      drives a small status pill ("Quoted", "Adjusted", etc). */
  status?: string | null;
  /** Mark adhoc rows so the template can swap the thumbnail for a
      sparkles glyph and dim the price (pending the supplier's quote). */
  isAdhoc?: boolean;
}

export interface CartDrawerRequest {
  projectId: string;
  options: CartDrawerOptions;
}

/** v1.65et — fired when a supplier acts on a row in the drawer
    (Accept / Decline / Adjust). The inbox subscribes and routes
    through its existing onItemAction reply path so the action lands
    on the right message_item server-side. */
export interface CartDrawerRowAction {
  rowId: string;                     // message_items.id
  action: 'accept' | 'decline' | 'adjust' | 'think';
  reason_code?: string;
  note?: string;
  name?: string;
  description?: string;
  price?: number;
  unit?: string;
  image_url?: string;
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

  /** v1.65et — emits when a supplier acts on a row from the drawer. */
  private readonly _rowAction = new Subject<CartDrawerRowAction>();
  readonly rowAction$ = this._rowAction.asObservable();

  open(projectId: string, options: CartDrawerOptions = {}): void {
    this._request.next({ projectId, options });
  }
  close(): void { this._request.next(null); }
  markChanged(projectId: string): void { this._changed.next({ projectId }); }
  emitRowAction(a: CartDrawerRowAction): void { this._rowAction.next(a); }
}
