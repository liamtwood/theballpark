import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ViewMode } from './catalogue.types';

/** pV2-06d (v2.15c audit fix) — the card/list/table toggle as a shared
 *  primitive (was inline in marketplace-page; supplier-detail's Store tab
 *  lacked it entirely — architect finding M8 / chat flag). */
@Component({
  selector: 'app-view-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: {
    class: 'inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-hairline bg-surface p-1',
  },
  template: `
    @for (v of views; track v.mode) {
      <button
        type="button"
        class="bp-viewtoggle"
        [class.bp-viewtoggle--active]="active() === v.mode"
        [attr.aria-label]="v.label"
        (click)="activeChange.emit(v.mode)"
      >
        <lucide-icon [name]="v.icon" [size]="15" />
      </button>
    }
  `,
})
export class ViewToggleComponent {
  readonly active = input.required<ViewMode>();
  readonly activeChange = output<ViewMode>();

  protected readonly views: { mode: ViewMode; icon: string; label: string }[] = [
    { mode: 'card', icon: 'layout-grid', label: 'Card view' },
    { mode: 'list', icon: 'list', label: 'List view' },
    { mode: 'table', icon: 'table', label: 'Table view' },
  ];
}
