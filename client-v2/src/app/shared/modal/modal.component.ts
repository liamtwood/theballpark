import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DialogModule } from 'primeng/dialog';

/** app-modal — the ONE dialog shell (DESIGN.md). Wraps PrimeNG `p-dialog` with the
 *  `bp-modal` chrome so every dialog shares the same header, subtitle, body and
 *  footer treatment, the hairline separators, and the close / escape / mask
 *  behaviour. Change the standard here and every dialog follows.
 *
 *  Three content slots:
 *   • default        — the dialog body.
 *   • `[modalHeader]`— a CUSTOM header (replaces title/subtitle — e.g. quick-view's
 *                      supplier + page switcher). Omit it and set `title` for the
 *                      common case.
 *   • `[modalFooter]`— the footer buttons. Lands in the footer slot, so it gets the
 *                      separator + right-alignment for free. Convention: a dismiss
 *                      button reads **Cancel** in an editor dialog, **Close** in a
 *                      viewer; primary = `bp-btn--primary`, secondary =
 *                      `bp-btn--secondary`, destructive = `bp-btn-danger`.
 *
 *  Visibility is driven by the host (`[open]` + `(close)`); the parent either mounts
 *  it conditionally or toggles `open`. X / escape / backdrop all emit `close`. */
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule],
  template: `
    <p-dialog
      [visible]="open()"
      (visibleChange)="onVisible($event)"
      [styleClass]="styleClass()"
      [modal]="true"
      [closable]="closable()"
      [closeOnEscape]="true"
      [dismissableMask]="dismissable()"
      [style]="dialogStyle()"
      (onShow)="shown.emit()"
    >
      <ng-template pTemplate="header">
        <ng-content select="[modalHeader]" />
        @if (title()) {
          <div>
            <h2 class="bp-card-title">{{ title() }}</h2>
            @if (subtitle()) {
              <p class="bp-body-small mt-1 text-secondary">{{ subtitle() }}</p>
            }
          </div>
        }
      </ng-template>

      <ng-content />

      <ng-template pTemplate="footer">
        <!-- The footer flex lives here (the standard: right-aligned, gap 10).
             Tag each footer button with modalFooter; a left-aligned item uses
             mr-auto. The hairline separator comes from the bp-modal chrome. -->
        <div class="flex w-full items-center justify-end gap-2.5">
          <ng-content select="[modalFooter]" />
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class ModalComponent {
  /** Host-driven visibility. */
  readonly open = input(true);
  /** Common-case header — a plain title (+ optional subtitle). Leave blank and use
   *  the `[modalHeader]` slot for a custom header. */
  readonly title = input<string>('');
  readonly subtitle = input<string>('');
  /** Dialog width (and optional max-width for responsive caps, e.g. quick-view). */
  readonly width = input<string>('460px');
  readonly maxWidth = input<string>('');
  /** X / escape / backdrop-dismiss toggles. */
  readonly closable = input(true);
  readonly dismissable = input(true);
  /** Extra styleClass appended to `bp-modal` (e.g. `bp-modal--confirm`, `bp-quickview`). */
  readonly variantClass = input<string>('');
  readonly close = output<void>();
  /** Forwards p-dialog's onShow — fired when the dialog becomes visible (e.g. to
   *  lazy-load content on open). */
  readonly shown = output<void>();

  protected readonly styleClass = computed(
    () => 'bp-modal' + (this.variantClass() ? ' ' + this.variantClass() : '')
  );
  protected readonly dialogStyle = computed(() => {
    const s: Record<string, string> = { width: this.width() };
    if (this.maxWidth()) s['maxWidth'] = this.maxWidth();
    return s;
  });

  protected onVisible(v: boolean): void {
    if (!v) this.close.emit();
  }
}
