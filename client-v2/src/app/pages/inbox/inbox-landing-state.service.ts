import { Injectable, signal } from '@angular/core';

/** Session-lived UI state for the Messages landing. The landing component is
 *  destroyed when you open a conversation and recreated on "All messages" back,
 *  so the expanded-card set lives here (root-provided) to survive that round-trip
 *  and leave the page exactly as you left it (Liam 2026-10-30). Not persisted
 *  across a full page reload — purely an in-session convenience. */
@Injectable({ providedIn: 'root' })
export class InboxLandingStateService {
  /** Project-card ids whose supplier list is expanded. */
  readonly expanded = signal(new Set<string>());
}
