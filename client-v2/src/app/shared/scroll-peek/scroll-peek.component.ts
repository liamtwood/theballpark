import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/** Scrolls its projected content WITHOUT a scrollbar, showing a small down
 *  chevron when there's more below (click nudges it down). Used for the project
 *  Marketplace category rail — a fixed panel that peeks rather than scrolls. */
@Component({
  selector: 'app-scroll-peek',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'relative block min-h-0' },
  template: `
    <div #box class="h-full overflow-y-auto bp-noscrollbar" (scroll)="recompute()">
      <ng-content />
    </div>
    @if (canDown()) {
      <button type="button" class="bp-scroll-peek-down" aria-label="Scroll for more" (click)="nudge()">
        <lucide-icon name="chevron-down" [size]="16" />
      </button>
    }
  `,
})
export class ScrollPeekComponent {
  private readonly box = viewChild.required<ElementRef<HTMLDivElement>>('box');
  protected readonly canDown = signal(false);
  private ro?: ResizeObserver;

  constructor() {
    afterNextRender(() => {
      const el = this.box().nativeElement;
      this.recompute();
      // Recompute when the panel resizes OR its content changes height
      // (categories load/expand) — no scrollbar means no native affordance.
      this.ro = new ResizeObserver(() => this.recompute());
      this.ro.observe(el);
      if (el.firstElementChild) this.ro.observe(el.firstElementChild);
    });
    inject(DestroyRef).onDestroy(() => this.ro?.disconnect());
  }

  protected recompute(): void {
    const el = this.box().nativeElement;
    this.canDown.set(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  }

  protected nudge(): void {
    this.box().nativeElement.scrollBy({ top: 140, behavior: 'smooth' });
  }
}
