import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/** One member of a collection / related strip — a cover+name chip that LINKS to its item
 *  (pV2-ADDONS-02). `isCurrent` marks the item you're already viewing (membership strips). */
export interface StripMember { id: string; bpin: string | null; name: string; coverUrl: string | null; isChild: boolean; isCurrent?: boolean; }
/** One strip = a collection + its visible members. */
export interface Strip { id: string; name: string; items: StripMember[]; }

/** pV2-ADDONS-02 — the quick-view Collections / Related-items strip. ONE behaviour: every
 *  member is a LINK (click to open its quick-view); the current item is a plain marked chip.
 *  No add-to-cart here — that's the add-ons picker. Used for both the membership strip and the
 *  related strip (only the icon differs), so the markup lives in one place. */
@Component({
  selector: 'app-collection-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div class="bp-coll">
      <span class="bp-qv-spec__label"><lucide-icon [name]="icon()" [size]="13" /> {{ strip().name }}</span>
      <div class="bp-coll__row">
        @for (m of strip().items; track m.id) {
          @if (m.isCurrent) {
            <div class="bp-coll__chip bp-coll__chip--current" [title]="m.name">
              @if (m.coverUrl) { <img class="bp-coll__img" [src]="m.coverUrl" [alt]="m.name" loading="lazy" /> }
              @else { <div class="bp-coll__img bp-coll__img--ph"><lucide-icon name="image" [size]="16" /></div> }
              <span class="bp-coll__name">{{ m.name }}</span>
              <span class="bp-coll__current">Current item</span>
            </div>
          } @else {
            <button type="button" class="bp-coll__chip bp-coll__chip--link"
                    [class.bp-coll__chip--child]="m.isChild" [title]="'Open ' + m.name"
                    (click)="open.emit(m.bpin ?? m.id)">
              @if (m.coverUrl) { <img class="bp-coll__img" [src]="m.coverUrl" [alt]="m.name" loading="lazy" /> }
              @else { <div class="bp-coll__img bp-coll__img--ph"><lucide-icon name="image" [size]="16" /></div> }
              <span class="bp-coll__name">{{ m.name }}</span>
            </button>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .bp-coll { display: flex; flex-direction: column; gap: 0.5rem; }
    .bp-coll__row { display: flex; gap: 0.6rem; overflow-x: auto; padding-bottom: 0.25rem; scrollbar-width: thin; }
    .bp-coll__chip { position: relative; flex: none; width: 5.25rem; display: flex; flex-direction: column; gap: 0.3rem; }
    .bp-coll__chip--child { opacity: 0.9; }
    .bp-coll__chip--current .bp-coll__img { outline: 2px solid var(--theme-accent); outline-offset: -2px; }
    .bp-coll__current { font-size: var(--text-xs); font-weight: 600; color: var(--theme-accent); }
    /* Members are links — button reset + a hover lift to signal clickability. */
    button.bp-coll__chip--link { background: none; border: none; padding: 0; margin: 0; text-align: left; cursor: pointer; }
    button.bp-coll__chip--link:hover .bp-coll__img { outline: 2px solid var(--theme-accent); outline-offset: -2px; }
    button.bp-coll__chip--link:hover .bp-coll__name { color: var(--theme-accent); }
    .bp-coll__img {
      width: 5.25rem; height: 5.25rem; object-fit: cover; border-radius: var(--radius-input, 10px);
      background: var(--color-fill); border: 1px solid var(--color-border-hairline);
    }
    .bp-coll__img--ph { display: flex; align-items: center; justify-content: center; color: var(--color-text-muted); }
    .bp-coll__name {
      font-size: var(--text-xs); line-height: 1.2; color: var(--color-text-secondary);
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
  `],
})
export class CollectionStripComponent {
  readonly strip = input.required<Strip>();
  readonly icon = input<string>('layers');
  /** A member link was clicked — the viewer should open that item (bpin or id). */
  readonly open = output<string>();
}
