import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

/** The standard page hero band — first child of every v2 feature page, below
 *  the shell header. Optional back link (left), title + subtitle, optional
 *  right-side actions via `<ng-content select="[hero-actions]">`. The host IS
 *  the band (no inner wrapper) per the host:-binding standard; align/accent
 *  variants bind as host classes. Page-settings overrides come in a later
 *  prompt — this renders exactly what the route hands it. */
@Component({
  selector: 'app-page-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, RouterLink],
  host: {
    class: 'bp-page-hero',
    '[class.bp-page-hero--align-center]': "align() === 'center'",
    '[class.bp-page-hero--accent-none]': "accent() === 'none'",
  },
  template: `
    @if (back(); as b) {
      <a class="bp-page-hero__back" [routerLink]="b.href">
        <lucide-icon name="chevron-left" [size]="16"></lucide-icon>
        <span>{{ b.label }}</span>
      </a>
    }

    <div class="bp-page-hero__text">
      <h1 class="bp-page-title bp-page-hero__title">{{ title() }}</h1>
      @if (subtitle()) {
        <p class="bp-page-subtitle bp-page-hero__subtitle">{{ subtitle() }}</p>
      }
    </div>

    <div class="bp-page-hero__actions">
      <ng-content select="[hero-actions]"></ng-content>
    </div>
  `,
  styles: [
    `
      :host {
        position: relative;
        display: grid;
        grid-template-columns: auto 1fr auto;
        grid-template-rows: auto auto;
        grid-template-areas:
          'back  text    actions'
          'back  text    actions';
        align-items: center;
        gap: 12px 20px;
        padding: 28px 32px 24px;
        background: var(--theme-soft);
        border-bottom: var(--border-hairline);
      }

      :host(.bp-page-hero--accent-none) {
        background: transparent;
      }

      .bp-page-hero__back {
        grid-area: back;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: var(--text-base); /* family inherits --bp-font */
        color: var(--color-text-secondary);
        text-decoration: none;
        padding-top: 4px;
      }
      .bp-page-hero__back:hover {
        color: var(--theme-accent);
      }

      .bp-page-hero__text {
        grid-area: text;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      :host(.bp-page-hero--align-center) .bp-page-hero__text {
        text-align: center;
      }

      /* Type comes from .bp-page-title / .bp-page-subtitle (pV2-TYPE-01 —
         was a local 28px/700; the table's 36/400 is the title2 standard).
         Structural classes keep only spacing. */
      .bp-page-hero__title {
        margin: 0;
      }

      .bp-page-hero__subtitle {
        margin: 0;
      }

      .bp-page-hero__actions {
        grid-area: actions;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      @media (max-width: 600px) {
        :host {
          padding: 20px 16px 16px;
          grid-template-columns: 1fr auto;
          grid-template-areas:
            'back    actions'
            'text    text';
        }
        .bp-page-hero__title {
          font-size: var(--text-2xl);
        }
      }
    `,
  ],
})
export class PageHeroComponent {
  /** Optional back link target — when set, renders a back chevron + label. */
  readonly back = input<{ label: string; href: string } | null>(null);

  /** Main title — required. */
  readonly title = input.required<string>();

  /** Subtitle / lede — optional. */
  readonly subtitle = input<string>('');

  /** Alignment of title/subtitle text. */
  readonly align = input<'left' | 'center'>('left');

  /** Accent treatment. `'none'` (default) is transparent over the page
   *  background; routes opt in to the soft theme wash with `accent="theme"`. */
  readonly accent = input<'theme' | 'none'>('none');
}
