import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
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
        <p class="bp-coachmark__text">{{ displayText() }}</p>
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
  /** Optional `{key}` substitutions for the text — lets a coachmark reference
   *  the specific context (e.g. this item's rate/qty/total) while the admin
   *  still owns the sentence around them. */
  readonly vars = input<Record<string, string | number>>({});
  readonly dismissed = output<void>();

  protected readonly visible = signal(false);
  protected readonly dontShow = signal(false);
  protected readonly text = signal('');
  /** The text with `{key}` placeholders filled from `vars`. */
  protected readonly displayText = computed(() => {
    const v = this.vars();
    return this.text().replace(/\{(\w+)\}/g, (_, k) => (v[k] != null ? String(v[k]) : `{${k}}`));
  });

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
