import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CategoryInfo } from './catalogue.types';

/** pV2-06a — the left category rail: "All Categories" + one row per
 *  active top-level category with its live count. Dumb — selection comes
 *  in, clicks go out (the store owns ?cat=). */
@Component({
  selector: 'app-category-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <nav class="flex flex-col gap-0.5">
      <button
        type="button"
        class="bp-catstrip-row"
        [class.bp-catstrip-row--active]="!activeId()"
        (click)="categorySelected.emit(null)"
      >
        <span class="truncate">All Categories</span>
        <span class="bp-meta">{{ totalCount() }}</span>
      </button>
      @for (cat of categories(); track cat.id) {
        <button
          type="button"
          class="bp-catstrip-row"
          [class.bp-catstrip-row--active]="activeId() === cat.id"
          (click)="categorySelected.emit(cat.id)"
        >
          <span class="truncate">{{ cat.name }}</span>
          <span class="bp-meta">{{ cat.count }}</span>
        </button>
      }
    </nav>
  `,
})
export class CategoryStripComponent {
  readonly categories = input.required<readonly CategoryInfo[]>();
  readonly activeId = input<string | null>(null);
  readonly totalCount = input<number>(0);
  readonly categorySelected = output<string | null>();
}
