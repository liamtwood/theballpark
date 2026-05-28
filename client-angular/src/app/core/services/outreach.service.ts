import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

/**
 * v1.50 — Competitive-quote outreach coordinator.
 *
 * The outreach flow (supplier select → requirements → compose → send) is
 * ONE shared component — OutreachComposeComponent — mounted once in
 * app-shell, exactly like the create-project modal. Every entry point
 * (Brief tab, project marketplace, item detail) opens it through this
 * service rather than mounting its own copy.
 */

/** The requirement an outreach is built around. A matched catalogue item
    carries item_id; a brand-new / AI-proposed requirement sets isNew and
    carries name + description + price instead. */
export interface OutreachItem {
  item_id?: string | null;
  name: string;
  description?: string;
  /** reference / estimated price */
  price?: number | null;
  /** true = AI-proposed or hand-entered requirement, no catalogue row yet */
  isNew?: boolean;
}

/** Optional AI-ranked supplier hint — drives pre-tick + ordering of the
    supplier list. Without it the drawer just lists every category supplier. */
export interface OutreachRankedSupplier {
  supplier_id: string;
  supplier_name?: string;
}

export interface OutreachRequest {
  item: OutreachItem;
  categoryId: string;
  categoryName?: string;
  projectId: string;
  /** project_categories.id, when the caller has it (Brief tab does). */
  projectCategoryId?: string | null;
  /** AI-ranked suppliers to pre-select + sort to the top. */
  suppliers?: OutreachRankedSupplier[];
  /** v1.65em — when the outreach is for a multi-item cart, pass the
      cart rows here. Step 2 renders them as a row list (image +
      name + line total) and lets the agent add ad-hoc items by
      title. The email body in step 3 builds from this list. */
  cartItems?: OutreachCartItem[];
  /** v1.65ep — title-only ad-hoc asks the agent added in the cart
      drawer's ADDITIONAL ASKS section. Pre-seed the outreach
      drawer's adhocItems[] in step 2 so the agent doesn't re-type
      them; they can still add more or remove these. */
  adhocAsks?: string[];
  /** Project-wide context for the per-item line math. Used to label
      per-cover/per-head items in step 2. */
  guestCount?: number;
}

/** v1.65em — a cart-derived line item for the outreach drawer. Carries
    enough display fields to render as a row in step 2 (same shape
    the cart drawer uses), plus optional supplier scoping. */
export interface OutreachCartItem {
  item_id?: string | null;
  name: string;
  description?: string;
  image_url?: string | null;
  base_price?: number | null;
  unit?: string | null;
  /** Pre-computed line total (per-cover × guests when applicable). */
  line_total?: number | null;
  supplier_org_id?: string | null;
  supplier_name?: string | null;
  /** True for ad-hoc items added by the agent in step 2. */
  isAdhoc?: boolean;
}

@Injectable({ providedIn: 'root' })
export class OutreachService {
  /** Current open request, or null when the drawer is closed. */
  private readonly _request = new BehaviorSubject<OutreachRequest | null>(null);
  readonly request$ = this._request.asObservable();

  /** Emits after an outreach is successfully sent, so surfaces like the
      Brief tab can reflect the consequences live (e.g. flip the
      category status to "Out for Quote"). */
  private readonly _sent = new Subject<{ projectId: string; categoryId: string }>();
  readonly sent$ = this._sent.asObservable();

  /** Open the outreach drawer for the given requirement. */
  open(req: OutreachRequest): void { this._request.next(req); }

  /** Close the drawer / reset. */
  close(): void { this._request.next(null); }

  /** Signal that an outreach for this project/category was sent. */
  markSent(projectId: string, categoryId: string): void {
    this._sent.next({ projectId, categoryId });
  }
}
