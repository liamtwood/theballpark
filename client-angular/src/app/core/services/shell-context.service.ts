import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ShellTab {
  label: string;
  path: string;
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
  // Back arrow — if set, renders a ← back link in the hero
  backPath?: string;
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
