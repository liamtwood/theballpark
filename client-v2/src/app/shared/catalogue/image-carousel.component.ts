import { ChangeDetectionStrategy, Component, computed, effect, input, linkedSignal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

/** pV2-STORE-QUICKVIEW-SUPPLIER-01 — the shared image carousel, extracted from the
 *  Quick View item cover (was inline `.bp-qv-img*`). One pattern, two consumers: the
 *  item pane (fit="contain" on neutral, DECISION 2) and the supplier "Past projects"
 *  gallery (fit="cover"). Arrows page a flat `string[]`; the component owns the index
 *  and resets to 0 whenever the list changes. `jumpTo` lets the item pane jump to a
 *  variant's image (does nothing if that url isn't in the list). `emptyIcon` draws a
 *  placeholder tile when there are no images (null → renders nothing; consumers that
 *  hide the whole block, like the gallery, leave it null). */
@Component({
  selector: 'app-image-carousel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LucideAngularModule],
  host: { class: 'bp-ic' },
  template: `
    @if (current(); as src) {
      <img class="bp-ic-img" [class.bp-ic-img--contain]="fit() === 'contain'" [src]="src" [alt]="alt()" loading="eager" />
    } @else if (emptyIcon(); as icon) {
      <div class="bp-ic-img bp-ic-img--empty"><lucide-icon [name]="icon" [size]="26" [strokeWidth]="1.5" /></div>
    }
    @if (images().length > 1) {
      <button type="button" class="bp-ic-arrow bp-ic-arrow--l" (click)="prev()" aria-label="Previous image"><lucide-icon name="chevron-left" [size]="20" /></button>
      <button type="button" class="bp-ic-arrow bp-ic-arrow--r" (click)="next()" aria-label="Next image"><lucide-icon name="chevron-right" [size]="20" /></button>
    }
  `,
  styles: `
    :host { position: relative; display: block; }
    .bp-ic-img {
      width: 100%;
      aspect-ratio: 16 / 10;
      object-fit: cover;
      border-radius: var(--radius-lg);
      display: block;
    }
    /* Item pane (DECISION 2) — show the whole product, letterboxed on neutral. */
    .bp-ic-img--contain { object-fit: contain; background: var(--color-fill); }
    .bp-ic-img--empty {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-fill);
      color: var(--color-text-secondary);
    }
    .bp-ic-arrow {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: var(--radius-pill);
      background: color-mix(in srgb, var(--color-surface) 88%, transparent);
      color: var(--color-text);
      border: 1px solid var(--color-border-hairline);
      box-shadow: var(--shadow-md);
      cursor: pointer;
    }
    .bp-ic-arrow:hover { background: var(--color-surface); border-color: var(--theme-accent); }
    .bp-ic-arrow--l { left: 10px; }
    .bp-ic-arrow--r { right: 10px; }
  `,
})
export class ImageCarouselComponent {
  /** The images to page through (cover/first = index 0). */
  readonly images = input<string[]>([]);
  readonly alt = input<string>('');
  /** 'cover' (default, fills the tile) or 'contain' (whole image on neutral). */
  readonly fit = input<'cover' | 'contain'>('cover');
  /** Lucide icon for the empty-state tile; null renders nothing (consumer hides). */
  readonly emptyIcon = input<string | null>(null);
  /** A url to jump the carousel to (e.g. a variant's image). Ignored if absent. */
  readonly jumpTo = input<string | null>(null);

  /** Current index — resets to 0 whenever the image list changes (new item/supplier). */
  protected readonly index = linkedSignal<readonly string[], number>({
    source: this.images,
    computation: () => 0,
  });
  protected readonly current = computed(() => this.images()[this.index()] ?? null);

  protected prev(): void { const n = this.images().length; if (n) this.index.set((this.index() - 1 + n) % n); }
  protected next(): void { const n = this.images().length; if (n) this.index.set((this.index() + 1) % n); }

  constructor() {
    // Jump to a requested url (variant image). Stay put if it isn't in the list.
    effect(() => {
      const u = this.jumpTo();
      if (!u) return;
      const i = this.images().indexOf(u);
      if (i >= 0) this.index.set(i);
    });
  }
}
