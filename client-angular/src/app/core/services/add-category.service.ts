import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { Category } from '../../models';

/**
 * v1.65b — shared "Add category" drawer coordinator. The Plan tab and
 * the project Marketplace both open the same drawer via
 * `open(projectId, unused)`. Drawer mounted once globally in app-shell.
 */
export interface AddCategoryRequest {
  projectId: string;
  /** Catalogue parent categories not yet in this project. */
  unused: Category[];
}

@Injectable({ providedIn: 'root' })
export class AddCategoryService {
  private readonly _request = new BehaviorSubject<AddCategoryRequest | null>(null);
  readonly request$ = this._request.asObservable();

  /** Emits after a category has been successfully added so the calling
      surface can refresh its list. */
  private readonly _added = new Subject<{ projectId: string; category: Category }>();
  readonly added$ = this._added.asObservable();

  open(projectId: string, unused: Category[]): void {
    this._request.next({ projectId, unused });
  }
  close(): void { this._request.next(null); }
  markAdded(projectId: string, category: Category): void {
    this._added.next({ projectId, category });
  }
}
