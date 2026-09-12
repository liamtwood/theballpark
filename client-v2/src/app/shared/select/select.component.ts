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
  // Styles live in styles.css as `.bp-select-*` (one-definition rule + the
  // panel renders in the CDK overlay at the document root, so its chrome must
  // be global, not component-scoped).
  template: `
    <button #trigger type="button" class="bp-select-trigger" [class.bp-select-trigger--sm]="compact()" [class.is-open]="open()" [disabled]="disabled()"
      role="combobox" aria-haspopup="listbox" [attr.aria-expanded]="open()"
      [attr.aria-label]="ariaLabel() || null"
      [attr.aria-activedescendant]="open() && activeIndex() >= 0 ? optId(activeIndex()) : null"
      (click)="toggle()" (keydown)="onKeydown($event)">
      <span class="bp-select-value" [class.is-placeholder]="!selectedLabel()">{{ selectedLabel() || placeholder() }}</span>
      <lucide-icon class="bp-select-chev" name="chevron-down" [size]="16" />
    </button>

    <ng-template cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="trigger"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayWidth]="panelWidth()"
      [cdkConnectedOverlayPositions]="positions"
      [cdkConnectedOverlayViewportMargin]="8"
      (overlayOutsideClick)="close()"
      (attach)="onAttach()"
      (detach)="close()">
      <div class="bp-select-panel" role="listbox" [attr.aria-label]="ariaLabel() || null">
        @if (filter()) {
          <div class="bp-select-searchwrap">
            <input [id]="searchId" class="bp-select-search" type="text" autocomplete="off"
              placeholder="Type to filter…" [attr.aria-label]="'Filter ' + (ariaLabel() || 'options')"
              [value]="query()" (input)="onQuery($any($event.target).value)" (keydown)="onKeydown($event)" />
          </div>
        }
        @for (o of visibleOptions(); track o.value; let i = $index; let first = $first) {
          @if (o.separatorBefore && !first) { <div class="bp-select-sep"></div> }
          <div class="bp-select-option"
            [id]="optId(i)"
            role="option"
            [attr.aria-selected]="o.value === value()"
            [class.is-selected]="o.value === value()"
            [class.is-active]="i === activeIndex()"
            [class.is-disabled]="o.disabled"
            (click)="pick(o)"
            (mouseenter)="activeIndex.set(i)">
            <span class="bp-select-option-label">{{ o.label }}</span>
            <lucide-icon class="bp-select-check" name="check" [size]="16" />
          </div>
        } @empty {
          <div class="bp-select-empty">{{ query() ? 'No matches' : 'No options' }}</div>
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
  /** 40px trigger (matches the view/tab pills) instead of the default 44px. */
  readonly compact = input<boolean>(false);
  readonly ariaLabel = input<string>();
  /** Show a type-ahead filter box at the top of the panel (for long lists). */
  readonly filter = input<boolean>(false);

  /** Fires with the new value when the selection changes (parity with (change)). */
  readonly changed = output<string>();

  protected readonly open = signal(false);
  protected readonly activeIndex = signal(-1);
  protected readonly panelWidth = signal<number | string>('auto');
  protected readonly query = signal('');

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly id = ++uid;
  protected readonly searchId = `sel-${this.id}-search`;

  /** Below-then-above, left-aligned; the overlay flips when there's no room. */
  protected readonly positions = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 } as const,
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 } as const,
  ];

  protected readonly selectedLabel = computed(
    () => this.options().find((o) => o.value === this.value())?.label ?? '',
  );

  /** Options after the type-ahead filter (identity when filter off / empty). */
  protected readonly visibleOptions = computed<SelectOption[]>(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.options();
    return this.filter() && q ? all.filter((o) => o.label.toLowerCase().includes(q)) : all;
  });

  constructor() {
    // Keep the active row on the current selection each time the panel opens.
    effect(() => {
      if (this.open()) {
        const vis = this.visibleOptions();
        const sel = vis.findIndex((o) => o.value === this.value());
        this.activeIndex.set(sel >= 0 ? sel : this.firstEnabled());
      }
    });
  }

  /** Focus the filter box when the panel attaches (long-list ergonomics). */
  protected onAttach(): void {
    if (this.filter()) queueMicrotask(() => document.getElementById(this.searchId)?.focus());
  }

  protected onQuery(v: string): void {
    this.query.set(v);
    this.activeIndex.set(this.firstEnabled());
  }

  protected optId(i: number): string {
    return `sel-${this.id}-opt-${i}`;
  }

  protected toggle(): void {
    if (this.disabled()) return;
    this.open() ? this.close() : this.openPanel();
  }

  private openPanel(): void {
    this.query.set('');
    this.panelWidth.set(this.trigger().nativeElement.offsetWidth);
    this.open.set(true);
  }

  protected close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.query.set('');
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
    if (!this.open()) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.openPanel();
      }
      return;
    }
    // In filter mode focus is in the search box — let space/Home/End edit text.
    const inFilter = this.filter();
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
        if (inFilter) break;
        e.preventDefault();
        this.activeIndex.set(this.firstEnabled());
        break;
      case 'End':
        if (inFilter) break;
        e.preventDefault();
        this.activeIndex.set(this.lastEnabled());
        break;
      case ' ':
        if (inFilter) break; // typing a space into the filter box
        e.preventDefault();
        { const o = this.visibleOptions()[this.activeIndex()]; if (o) this.pick(o); }
        break;
      case 'Enter':
        e.preventDefault();
        { const o = this.visibleOptions()[this.activeIndex()]; if (o) this.pick(o); }
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
    const opts = this.visibleOptions();
    let i = this.activeIndex();
    for (let n = 0; n < opts.length; n++) {
      i += dir;
      if (i < 0 || i >= opts.length) return this.activeIndex();
      if (!opts[i].disabled) return i;
    }
    return this.activeIndex();
  }

  private firstEnabled(): number {
    return this.visibleOptions().findIndex((o) => !o.disabled);
  }

  private lastEnabled(): number {
    const opts = this.visibleOptions();
    for (let i = opts.length - 1; i >= 0; i--) if (!opts[i].disabled) return i;
    return -1;
  }
}
