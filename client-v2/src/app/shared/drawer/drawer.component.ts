import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { DrawerModule } from 'primeng/drawer';
import { LucideAngularModule } from 'lucide-angular';

/** pV2-MEDIA-01a — generic right-side slide-in drawer (NOT media-specific;
 *  first consumer is the image picker, future consumers are filter/settings
 *  panels). Wraps PrimeNG p-drawer for the overlay mechanics (ESC dismiss,
 *  backdrop click, focus trap, scroll-lock, slide animation) and layers the
 *  Ballpark chrome + three content slots:
 *
 *    <app-drawer [(open)]="x" title="…">
 *      <ng-container drawer-header>…</ng-container>   (optional — overrides title)
 *      …body…
 *      <div drawer-footer>…</div>                     (optional)
 *    </app-drawer>
 *
 *  Desktop: right panel (width input, 520px default). Mobile (<md): full-screen
 *  via the .bp-drawer media rule. Minimum-viable per MEDIA.md lock §15. */
@Component({
  selector: 'app-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DrawerModule, LucideAngularModule],
  template: `
    <p-drawer
      [visible]="open()"
      (visibleChange)="onVisible($event)"
      position="right"
      [modal]="true"
      [dismissible]="dismissible()"
      [closeOnEscape]="true"
      [blockScroll]="true"
      [showCloseIcon]="false"
      styleClass="bp-drawer"
      [style]="{ width: width() }"
    >
      <div class="bp-drawer__inner">
        <div class="bp-drawer__header">
          <ng-content select="[drawer-header]">
            <h2 class="bp-drawer-title">{{ title() }}</h2>
          </ng-content>
          <button type="button" class="bp-drawer__close" aria-label="Close" (click)="close()">
            <lucide-icon name="x" [size]="18" />
          </button>
        </div>
        <div class="bp-drawer__body">
          <ng-content />
        </div>
        @if (hasFooter()) {
          <div class="bp-drawer__footer">
            <ng-content select="[drawer-footer]" />
          </div>
        }
      </div>
    </p-drawer>
  `,
})
export class DrawerComponent {
  /** Two-way open state. */
  readonly open = model<boolean>(false);
  /** Default header title (ignored if a [drawer-header] slot is projected). */
  readonly title = input<string>('');
  /** Desktop width (mobile is full-screen via CSS). */
  readonly width = input<string>('520px');
  /** Backdrop-click + ESC dismiss (default on). */
  readonly dismissible = input<boolean>(true);
  /** Whether to render the footer slot wrapper. */
  readonly hasFooter = input<boolean>(false);
  /** Fires when the drawer closes (ESC, backdrop, or close button). */
  readonly closed = output<void>();

  protected onVisible(v: boolean): void {
    this.open.set(v);
    if (!v) this.closed.emit();
  }
  protected close(): void {
    this.open.set(false);
    this.closed.emit();
  }
}
