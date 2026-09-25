import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, signal, viewChild } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/** A horizontal scroller with left/right arrow affordances instead of a scrollbar.
 *  Content is projected into a scroll track (native scrollbar hidden); the arrows
 *  appear only when there's more to scroll in that direction and nudge by ~80% of the
 *  visible width. Centres content that fits (`safe center` — never clips the start). */
@Component({
  selector: 'app-hscroll',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'bp-hscroll' },
  template: `
    <button
      type="button"
      class="bp-hscroll__arrow bp-hscroll__arrow--l"
      [class.bp-hscroll__arrow--hidden]="!canLeft()"
      (click)="nudge(-1)"
      aria-label="Scroll left"
      tabindex="-1"
    ><lucide-icon name="chevron-left" [size]="18" /></button>

    <div #track class="bp-hscroll__track" (scroll)="update()"><ng-content /></div>

    <button
      type="button"
      class="bp-hscroll__arrow bp-hscroll__arrow--r"
      [class.bp-hscroll__arrow--hidden]="!canRight()"
      (click)="nudge(1)"
      aria-label="Scroll right"
      tabindex="-1"
    ><lucide-icon name="chevron-right" [size]="18" /></button>
  `,
  styles: [
    `
      :host {
        position: relative;
        display: block;
        width: 100%;
      }
      .bp-hscroll__track {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        overflow-x: auto;
        scroll-behavior: smooth;
        justify-content: safe center;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .bp-hscroll__track::-webkit-scrollbar { display: none; }
      .bp-hscroll__arrow {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        z-index: 2;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, #fff 45%, transparent);
        background: color-mix(in srgb, var(--theme-accent) 90%, #000);
        color: var(--theme-accent-contrast, #fff);
        cursor: pointer;
        box-shadow: var(--shadow-md);
        transition: opacity 0.12s ease;
      }
      .bp-hscroll__arrow--l { left: 2px; }
      .bp-hscroll__arrow--r { right: 2px; }
      .bp-hscroll__arrow--hidden { opacity: 0; pointer-events: none; }
    `,
  ],
})
export class HScrollComponent implements AfterViewInit, OnDestroy {
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  protected readonly canLeft = signal(false);
  protected readonly canRight = signal(false);
  private ro?: ResizeObserver;

  ngAfterViewInit(): void {
    const el = this.track().nativeElement;
    // Recompute when the track OR its content resizes (menu items load async).
    this.ro = new ResizeObserver(() => this.update());
    this.ro.observe(el);
    for (const child of Array.from(el.children)) this.ro.observe(child as Element);
    this.update();
  }

  ngOnDestroy(): void { this.ro?.disconnect(); }

  protected update(): void {
    const el = this.track().nativeElement;
    this.canLeft.set(el.scrollLeft > 1);
    this.canRight.set(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }

  protected nudge(dir: number): void {
    const el = this.track().nativeElement;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  }
}
