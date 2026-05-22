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
