import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ShellTab {
  label: string;
  path: string;
  /** v1.24: optional notification badge rendered top-right of the
      tab label. AppShell only renders the chip when badge > 0, so
      pages can leave it undefined / 0 by default. Used by the
      project Messages tab when there are unread replies. */
  badge?: number;
}

/** Optional "back" link shown on the LEFT of the shell hero, vertically
    centered. Pages set this via shellCtx.set({ back: {...} }) and the
    shell handles rendering + positioning so individual feature pages
    don't have to reach into the hero's layout. */
export interface ShellBack {
  label: string;
  onBack: () => void;
}

export interface ShellContext {
  heroTitle:    string;
  heroSub:      string;
  pills:        string[];
  tabs:         ShellTab[];
  showStats:    boolean;
  // Optional callback — if provided, AppShell calls this instead of navigating
  // Used by dashboard tabs which switch internal state rather than routing
  onTabClick?:  (tab: ShellTab) => void;
  // Active tab override — used when tabs don't map to routes
  activeTabPath?: string;
  /** Optional back link on the hero's left edge. Cleared on every reset(). */
  back?: ShellBack;
  /** v1.23: optional "Next event" pill payload. Dashboard pushes this
      when ConfigService.showUpcoming is true and a future project
      exists; app-shell renders a calendar-iconned pill in the hero. */
  upcomingPill?: { text: string };
}

const DEFAULT_CONTEXT: ShellContext = {
  heroTitle:    '',
  heroSub:      '',
  pills:        [],
  tabs:         [],
  showStats:    false,
};

@Injectable({ providedIn: 'root' })
export class ShellContextService {
  private ctx$ = new BehaviorSubject<ShellContext>({ ...DEFAULT_CONTEXT });

  readonly context$ = this.ctx$.asObservable();

  get current(): ShellContext { return this.ctx$.value; }

  set(ctx: Partial<ShellContext>) {
    this.ctx$.next({ ...DEFAULT_CONTEXT, ...ctx });
  }

  reset() {
    this.ctx$.next({ ...DEFAULT_CONTEXT });
  }
}
