import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  input,
  output,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/** pV2-06a — the catalogue search box. Dumb: emits the DEBOUNCED settled
 *  term only (the store writes it to ?q=); count is display context. */
@Component({
  selector: 'app-catalogue-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="flex h-[38px] items-center gap-2 rounded-[var(--radius-pill)] border border-hairline bg-surface px-4 shadow-[var(--shadow-xs)] focus-within:border-accent">
      <lucide-icon name="search" [size]="15" class="text-muted" />
      <input
        type="search"
        class="w-full border-none bg-transparent p-0 text-md outline-none ring-0 placeholder:text-muted focus:ring-0"
        [placeholder]="'Search ' + count() + ' items…'"
        [value]="value()"
        (input)="onInput($event)"
      />
    </div>
  `,
})
export class CatalogueSearchComponent implements OnDestroy {
  readonly value = input<string>('');
  readonly count = input<number>(0);
  readonly valueChange = output<string>();

  private timer: ReturnType<typeof setTimeout> | null = null;

  protected onInput(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.valueChange.emit(v.trim()), 300);
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }
}
