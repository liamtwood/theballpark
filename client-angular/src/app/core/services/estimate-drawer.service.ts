import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * v1.64 — opens the shared EstimateDrawerComponent for a given project.
 * Mirrors the OutreachService pattern: every surface (project home,
 * Overview card, Brief col-1 card, Marketplace) calls `open(projectId)`
 * rather than mounting its own copy of the drawer.
 */
@Injectable({ providedIn: 'root' })
export class EstimateDrawerService {
  /** The active project id when the drawer is open, or null when closed. */
  private readonly _projectId = new BehaviorSubject<string | null>(null);
  readonly projectId$ = this._projectId.asObservable();

  open(projectId: string): void { this._projectId.next(projectId); }
  close(): void { this._projectId.next(null); }
}
