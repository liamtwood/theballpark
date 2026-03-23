import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ShellTab {
  label: string;
  path: string;
}

export interface ShellContext {
  // Hero title — org name by default, project name on project pages
  heroTitle: string;

  // Sub-label — page label (SETTINGS) by default, "Org name · status" on project pages
  heroSub: string;

  // Pills — [userName · role, city] by default, [clientName, venue] on project pages
  pills: string[];

  // Tabs
  tabs: ShellTab[];

  // Whether to show the stats bar (org home only)
  showStats: boolean;
}

const DEFAULT_CONTEXT: ShellContext = {
  heroTitle: '',
  heroSub:   '',
  pills:     [],
  tabs:      [],
  showStats: false,
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
