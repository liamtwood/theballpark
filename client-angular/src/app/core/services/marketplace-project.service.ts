import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/** The project a user is "shopping for" while browsing any marketplace
    (standalone /shop or a supplier store). Chosen once via the project picker
    and remembered for the rest of the browser SESSION so "Add to Project" /
    "Wishlist" target it without re-asking. The project marketplace inside a
    project doesn't use this — it already has its own project from the route. */
export interface MarketplaceProject {
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class MarketplaceProjectService {
  private readonly key = 'ballpark:marketplace:project';
  private _project$ = new BehaviorSubject<MarketplaceProject | null>(this.load());

  /** Current shopping project (null = none chosen yet). */
  readonly project$ = this._project$.asObservable();

  get current(): MarketplaceProject | null {
    return this._project$.value;
  }

  set(project: MarketplaceProject | null): void {
    this._project$.next(project);
    this.save(project);
  }

  private load(): MarketplaceProject | null {
    try {
      const raw = sessionStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private save(project: MarketplaceProject | null): void {
    try {
      if (project) sessionStorage.setItem(this.key, JSON.stringify(project));
      else sessionStorage.removeItem(this.key);
    } catch {}
  }
}
