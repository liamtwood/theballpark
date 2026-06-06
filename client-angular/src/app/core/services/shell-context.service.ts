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
  /** Transient hero alignment override (wins over the saved per-page setting).
      The marketplace pushes 'left' when categories sit in the left rail so the
      hero lines up with the catalogue's left edge. */
  heroAlign?:   'left' | 'center';
  /** Extra left inset (CSS length) for the left-aligned hero content — the
      marketplace pushes the rail width here so the hero lines up with the
      catalogue's main column (first item card) in Left categories mode. */
  heroExtraLeft?: string;
  /** Page-scoped org identity. When a page shows a DIFFERENT org than the
      logged-in viewer (e.g. a supplier detail page viewing "Rocket Food"),
      it sets this so the hero's org title-mode + org pill reflect the org
      being VIEWED, not the viewer's own org. Empty = use the viewer's org. */
  orgName?:     string;
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
  /** p0032: a surface (the dashboard) sets this to drive its hero title
      from ConfigService.heroTitleMode (org / username / greeting) instead
      of a fixed page title. Hero COLOR is no longer pushed per-surface —
      it's a global ConfigService setting read directly by the AppShell. */
  useConfiguredTitle?: boolean;
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
