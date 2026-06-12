import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CategoryInfo } from './catalogue.types';

/** pV2-06-subcats (v2.16b — RP-06 fix): the subcategory chip strip as a
 *  SHARED primitive. Extracted after the third reuse miss in this arc
 *  (view-toggle, layout shell, now this) — marketplace items mode and the
 *  supplier Store tab both mount it. Dumb: chips in, selection out. */
@Component({
  selector: 'app-subcategory-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-wrap gap-2' },
  template: `
    <button
      type="button"
      class="bp-cat-chip"
      [class.bp-cat-chip--active]="!activeId()"
      (click)="selected.emit(null)"
    >
      All {{ allLabel() }}
    </button>
    @for (sub of subcategories(); track sub.id) {
      <button
        type="button"
        class="bp-cat-chip"
        [class.bp-cat-chip--active]="activeId() === sub.id"
        (click)="selected.emit(sub.id)"
      >
        {{ sub.name }}
        <span class="bp-meta">{{ sub.count }}</span>
      </button>
    }
  `,
})
export class SubcategoryStripComponent {
  readonly subcategories = input.required<readonly CategoryInfo[]>();
  readonly activeId = input<string | null>(null);
  /** "All {label}" chip text — usually the parent category name. */
  readonly allLabel = input<string>('');
  readonly selected = output<string | null>();
}
