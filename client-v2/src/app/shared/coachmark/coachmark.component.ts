import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CoachmarkService } from '../../core/coachmark.service';

/** A pink "coachmark" help bubble (Liam's spec): white card, rose-tinted border,
 *  pink glow + faint ring, a rotated-square tail, body text, an "Okay" button and
 *  a "Don't show again" toggle. Content is admin-managed data: on init it RESOLVES
 *  `(page, name)` (register-if-missing with `defaultText`) and renders the
 *  (possibly admin-edited) description + tail, unless it's inactive or the viewer
 *  chose "Don't show again" (persisted per-browser in localStorage). */
@Component({
  selector: 'app-coachmark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block pointer-events-auto' },
  template: `
    @if (visible()) {
      <div class="bp-coachmark" [class.bp-coachmark--up]="tail() === 'up'" [class.bp-coachmark--down]="tail() === 'down'">
        <p class="bp-coachmark__text">{{ text() }}</p>
        <div class="bp-coachmark__foot">
          <label class="bp-coachmark__dsa">
            <input type="checkbox" class="bp-check" [checked]="dontShow()" (change)="dontShow.set($any($event.target).checked)" />
            <span>Don't show again</span>
          </label>
          <button type="button" class="bp-coachmark__ok" (click)="ok()">Okay</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .bp-coachmark {
      position: relative;
      width: 18rem;
      background: var(--color-surface);
      border: 1px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
      border-radius: 1rem;
      padding: 0.95rem 1.1rem 0.8rem;
      box-shadow:
        0 0 0 2px color-mix(in srgb, var(--theme-accent) 25%, transparent),
        0 0 24px -2px color-mix(in srgb, var(--theme-accent) 55%, transparent);
    }
    .bp-coachmark__text {
      margin: 0;
      font-size: var(--text-md);
      line-height: var(--leading-normal, 1.5);
      color: var(--color-text);
    }
    .bp-coachmark__foot {
      display: flex; align-items: center; justify-content: space-between;
      gap: 1rem; margin-top: 0.9rem;
    }
    .bp-coachmark__dsa {
      display: inline-flex; align-items: center; gap: 0.5rem;
      font-size: var(--text-sm); color: var(--color-text-secondary); cursor: pointer;
    }
    /* Solid brand-rose "primary" button — accent fill, near-white text, hover
       lightens to 90% opacity (matches the spec / the example bubble). */
    .bp-coachmark__ok {
      padding: 0.4rem 1.15rem;
      border: none;
      border-radius: var(--radius-pill);
      background: var(--theme-accent);
      color: var(--theme-accent-contrast, #fff);
      font-family: var(--bp-font);
      font-size: var(--text-md);
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.12s ease;
    }
    .bp-coachmark__ok:hover { opacity: 0.9; }
    /* Tail — a rotated square sharing the card's bg + border on two edges so it
       reads as a pointer merging into the card. */
    .bp-coachmark::before {
      content: ''; position: absolute;
      width: 14px; height: 14px;
      left: 50%; margin-left: -7px;
      background: var(--color-surface);
      border: 1px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
      transform: rotate(45deg);
    }
    .bp-coachmark--up::before { top: -8px; border-right: none; border-bottom: none; }
    .bp-coachmark--down::before { bottom: -8px; border-left: none; border-top: none; }
  `],
})
export class CoachmarkComponent implements OnInit {
  private readonly coachmarks = inject(CoachmarkService);

  /** The (page, name) key — the admin edits + the "Don't show again" both key
   *  on this. `defaultText` seeds the row the first time it's seen. */
  readonly page = input.required<string>();
  readonly name = input.required<string>();
  readonly defaultText = input<string>('');
  /** Which side the tail points from — a placement concern set at the usage
   *  site (up = bubble sits below its target, down = bubble sits above it). */
  readonly tail = input<'up' | 'down'>('up');
  readonly dismissed = output<void>();

  protected readonly visible = signal(false);
  protected readonly dontShow = signal(false);
  protected readonly text = signal('');

  ngOnInit(): void {
    if (this.suppressed()) return;
    this.coachmarks.resolve(this.page(), this.name(), this.defaultText() || null).subscribe({
      next: (c) => {
        if (!c.isActive) return; // admin turned it off
        this.text.set(c.description || this.defaultText());
        this.visible.set(true);
      },
      // API down → still show the code default (help shouldn't just vanish).
      error: () => { this.text.set(this.defaultText()); this.visible.set(true); },
    });
  }

  protected ok(): void {
    if (this.dontShow()) {
      try { localStorage.setItem(this.storageKey(), '1'); } catch { /* private mode */ }
    }
    this.visible.set(false);
    this.dismissed.emit();
  }

  private storageKey(): string { return `bp-coachmark:${this.page()}:${this.name()}`; }
  private suppressed(): boolean {
    try { return localStorage.getItem(this.storageKey()) === '1'; } catch { return false; }
  }
}
