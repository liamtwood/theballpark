import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { Project } from '../../models';

/**
 * v1.65o — shared Event drawer coordinator. Same pattern as
 * OutreachService / EstimateDrawerService / AddCategoryService: the
 * EventDrawerComponent is mounted ONCE globally in app-shell and every
 * surface that wants to edit a project's details opens it via
 * `EventDrawerService.open(projectId, section?)` rather than mounting
 * its own copy of the drawer.
 *
 * Open with an optional `section` to jump the drawer straight into edit
 * mode for that section (matches the legacy kebab-menu behaviour from
 * the Overview event strip — "Edit event" → 'details', "Project brief"
 * → 'brief').
 *
 * `saved$` fires after a successful save so the calling surface can
 * refresh its local project copy without re-fetching elsewhere.
 */

export type EventDrawerSection =
  | 'details' | 'type' | 'logistics' | 'financials' | 'brief';

export interface EventDrawerRequest {
  projectId: string;
  /** Optional — start the drawer in edit mode for this section. */
  section?: EventDrawerSection;
}

@Injectable({ providedIn: 'root' })
export class EventDrawerService {
  private readonly _request = new BehaviorSubject<EventDrawerRequest | null>(null);
  readonly request$ = this._request.asObservable();

  /** Emits after a successful save with the freshly re-fetched project,
      so callers can update their local state. */
  private readonly _saved = new Subject<Project>();
  readonly saved$ = this._saved.asObservable();

  open(projectId: string, section?: EventDrawerSection): void {
    this._request.next({ projectId, section });
  }
  close(): void { this._request.next(null); }
  markSaved(p: Project): void { this._saved.next(p); }
}
