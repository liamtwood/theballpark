import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { LucideAngularModule } from 'lucide-angular';

/** One choice in an app-select. `value` is what's stored; `label` is shown.
 *  `separatorBefore` draws a divider line above the row (like the rule before
 *  "Manually create PR" in the Claude Code split-button menu). */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  separatorBefore?: boolean;
}

let uid = 0;

/**
 * app-select — the shared rounded "list of values" (LOV) control. Replaces the
 * native `<select>` (whose OS-drawn option list can't be given rounded corners),
 * so every picker matches the app's rounded design: a pill trigger + a floating
 * panel with soft shadow, hover highlight, and a check on the selected row.
 *
 * Floats on the CDK overlay so the panel is never clipped by a scrolling card.
 * Fully keyboard-driven (arrows / Home / End / Enter / Esc) and screen-reader
 * labelled via role=combobox + aria-activedescendant. Two-way `value`.
 */
@Component({
  selector: 'app-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayModule, LucideAngularModule],
  host: { class: 'block' },
  styles: [`
    .sel-trigger {
      display: flex; align-items: center; gap: 8px;
      height: 44px; width: 100%;
      border-radius: var(--radius-pill);
      border: 1px solid var(--color-border-hairline);
      background: var(--color-surface);
      padding: 0 14px 0 16px;
      font-size: var(--text-md);
      font-family: var(--font-body);
      color: var(--color-text);
      text-align: left;
      cursor: pointer;
      outline: none;
    }
    .sel-trigger:focus-visible,
    .sel-trigger.is-open { border-color: var(--theme-accent); }
    .sel-trigger:disabled { background: var(--color-fill); color: var(--color-text-secondary); cursor: not-allowed; }
    .sel-value { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sel-value.is-placeholder { color: var(--color-text-secondary); opacity: 0.7; }
    /* Chevron is quiet by default — appears on hover / focus / open, like the
       native number-input spinner (Liam's call). */
    .sel-chev { flex: 0 0 auto; color: var(--color-text-secondary); opacity: 0; transition: opacity 0.15s ease, transform 0.15s ease; }
    .sel-trigger:hover .sel-chev,
    .sel-trigger:focus-visible .sel-chev,
    .sel-trigger.is-open .sel-chev { opacity: 1; }
    .sel-trigger.is-open .sel-chev { transform: rotate(180deg); }

    .sel-panel {
      background: var(--color-surface);
      border: 1px solid var(--color-border-hairline);
      border-radius: 14px;
      box-shadow: var(--shadow-lg);
      padding: 6px;
      max-height: 280px;
      overflow-y: auto;
      font-family: var(--font-body);
    }
    .sel-option {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 12px;
      border-radius: 9px;
      font-size: var(--text-md);
      color: var(--color-text);
      cursor: pointer;
      user-select: none;
    }
    .sel-option-label { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sel-option .sel-check { flex: 0 0 auto; color: var(--theme-accent); opacity: 0; }
    .sel-option.is-selected .sel-check { opacity: 1; }
    .sel-option.is-active { background: var(--color-fill); }
    .sel-option.is-disabled { color: var(--color-text-secondary); opacity: 0.5; cursor: not-allowed; }
    .sel-sep { height: 1px; margin: 5px 8px; background: var(--color-border-hairline); }
    .sel-empty { padding: 10px 12px; font-size: var(--text-sm); color: var(--color-text-secondary); }
  `],
  template: `
    <button #trigger type="button" class="sel-trigger" [class.is-open]="open()" [disabled]="disabled()"
      role="combobox" aria-haspopup="listbox" [attr.aria-expanded]="open()"
      [attr.aria-label]="ariaLabel() || null"
      [attr.aria-activedescendant]="open() && activeIndex() >= 0 ? optId(activeIndex()) : null"
      (click)="toggle()" (keydown)="onKeydown($event)">
      <span class="sel-value" [class.is-placeholder]="!selectedLabel()">{{ selectedLabel() || placeholder() }}</span>
      <lucide-icon class="sel-chev" name="chevron-down" [size]="16" />
    </button>

    <ng-template cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="trigger"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayWidth]="panelWidth()"
      [cdkConnectedOverlayPositions]="positions"
      [cdkConnectedOverlayViewportMargin]="8"
      (overlayOutsideClick)="close()"
      (detach)="close()">
      <div class="sel-panel" role="listbox" [attr.aria-label]="ariaLabel() || null">
        @for (o of options(); track o.value; let i = $index; let first = $first) {
          @if (o.separatorBefore && !first) { <div class="sel-sep"></div> }
          <div class="sel-option"
            [id]="optId(i)"
            role="option"
            [attr.aria-selected]="o.value === value()"
            [class.is-selected]="o.value === value()"
            [class.is-active]="i === activeIndex()"
            [class.is-disabled]="o.disabled"
            (click)="pick(o)"
            (mouseenter)="activeIndex.set(i)">
            <span class="sel-option-label">{{ o.label }}</span>
            <lucide-icon class="sel-check" name="check" [size]="16" />
          </div>
        } @empty {
          <div class="sel-empty">No options</div>
        }
      </div>
    </ng-template>
  `,
})
export class SelectComponent {
  /** Choices to show. */
  readonly options = input<SelectOption[]>([]);
  /** Selected value (two-way). */
  readonly value = model<string>('');
  /** Shown when nothing is selected. */
  readonly placeholder = input<string>('—');
  readonly disabled = input<boolean>(false);
  readonly ariaLabel = input<string>();

  /** Fires with the new value when the selection changes (parity with (change)). */
  readonly changed = output<string>();

  protected readonly open = signal(false);
  protected readonly activeIndex = signal(-1);
  protected readonly panelWidth = signal<number | string>('auto');

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly id = ++uid;

  /** Below-then-above, left-aligned; the overlay flips when there's no room. */
  protected readonly positions = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 } as const,
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 } as const,
  ];

  protected readonly selectedLabel = computed(
    () => this.options().find((o) => o.value === this.value())?.label ?? '',
  );

  constructor() {
    // Keep the active row on the current selection each time the panel opens.
    effect(() => {
      if (this.open()) {
        const sel = this.options().findIndex((o) => o.value === this.value());
        this.activeIndex.set(sel >= 0 ? sel : this.firstEnabled());
      }
    });
  }

  protected optId(i: number): string {
    return `sel-${this.id}-opt-${i}`;
  }

  protected toggle(): void {
    if (this.disabled()) return;
    this.open() ? this.close() : this.openPanel();
  }

  private openPanel(): void {
    this.panelWidth.set(this.trigger().nativeElement.offsetWidth);
    this.open.set(true);
  }

  protected close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.trigger().nativeElement.focus();
  }

  protected pick(o: SelectOption): void {
    if (o.disabled) return;
    if (o.value !== this.value()) {
      this.value.set(o.value);
      this.changed.emit(o.value);
    }
    this.close();
  }

  protected onKeydown(e: KeyboardEvent): void {
    const opts = this.options();
    if (!this.open()) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.openPanel();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.activeIndex.set(this.step(1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.activeIndex.set(this.step(-1));
        break;
      case 'Home':
        e.preventDefault();
        this.activeIndex.set(this.firstEnabled());
        break;
      case 'End':
        e.preventDefault();
        this.activeIndex.set(this.lastEnabled());
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        { const o = opts[this.activeIndex()]; if (o) this.pick(o); }
        break;
      case 'Escape':
        e.preventDefault();
        this.close();
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  /** Move the active index by ±1, skipping disabled options, clamped at the ends. */
  private step(dir: 1 | -1): number {
    const opts = this.options();
    let i = this.activeIndex();
    for (let n = 0; n < opts.length; n++) {
      i += dir;
      if (i < 0 || i >= opts.length) return this.activeIndex();
      if (!opts[i].disabled) return i;
    }
    return this.activeIndex();
  }

  private firstEnabled(): number {
    return this.options().findIndex((o) => !o.disabled);
  }

  private lastEnabled(): number {
    const opts = this.options();
    for (let i = opts.length - 1; i >= 0; i--) if (!opts[i].disabled) return i;
    return -1;
  }
}
