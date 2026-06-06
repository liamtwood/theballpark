import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Catalogue view preferences (circle size / view / detail size / detail mode)
 * shared between a catalogue page and the global page-config drawer.
 *
 * The old per-page "config strip" bar (app-config-strip + app-page-config-
 * toggles) duplicated the drawer — the top-nav cog opened both. These controls
 * now live ONLY in the drawer; this service is the bridge:
 *
 *   - A catalogue page (marketplace, feedback) calls register() on init with
 *     its current values + an apply callback, and unregister() on destroy.
 *   - state$ is null when no catalogue page is active, so the drawer hides the
 *     controls; non-null while a catalogue page is mounted.
 *   - The drawer edits via apply(); the host persists + re-syncs via sync().
 *
 * State stays authoritative on the page (each keeps its own localStorage
 * namespace + feeds the catalogue-grid); this service is a thin editor bridge.
 */
export interface CatalogueViewState {
  /** Category navigation position — 'top' (horizontal circle strip) or
      'left' (a vertical rail with cats + expandable subcats). */
  categoriesPosition: 'top' | 'left';
  /** Category-strip shape — round circles or rounded squares. */
  shape: 'circle' | 'square';
  /** Item/supplier card size — sm (≈190px, today) / md (≈255px) / lg
      (≈320px, the project-card width). */
  cardSize: 'sm' | 'md' | 'lg';
  /** Category-strip size (sm/md/lg). Labelled "Shape size" in the UI. */
  circleSize: 'sm' | 'md' | 'lg';
  detailSize: 'sm' | 'md' | 'lg';
  view: 'card' | 'list' | 'table';
  detailMode: 'inline' | 'drawer';
  /** Show the left filter sidebar. */
  showFilter: boolean;
  /** Show the right preview / detail panel. */
  showPreview: boolean;
}

@Injectable({ providedIn: 'root' })
export class CatalogueViewService {
  private _state$ = new BehaviorSubject<CatalogueViewState | null>(null);
  /** null = no catalogue page active (drawer hides the controls). */
  readonly state$ = this._state$.asObservable();

  private applyFn: ((partial: Partial<CatalogueViewState>) => void) | null = null;

  /** Active catalogue page registers its view + an apply callback. */
  register(state: CatalogueViewState, apply: (partial: Partial<CatalogueViewState>) => void): void {
    this.applyFn = apply;
    this._state$.next({ ...state });
  }

  /** Host pushes refreshed values after a change (keeps the drawer in sync). */
  sync(state: CatalogueViewState): void {
    this._state$.next({ ...state });
  }

  /** Drawer → host: apply an edit. The host persists + re-syncs. */
  apply(partial: Partial<CatalogueViewState>): void {
    this.applyFn?.(partial);
  }

  unregister(): void {
    this.applyFn = null;
    this._state$.next(null);
  }

  get current(): CatalogueViewState | null {
    return this._state$.value;
  }
}
