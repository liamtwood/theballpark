import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { TooltipModule } from 'primeng/tooltip';
import { AuthService } from '../../core/auth/auth.service';
import { CatalogueSupplier, sizedImage } from './catalogue.types';

/** pV2-CARDS-01 — the catalog supplier card per CARDS.md image 3 (Rocket
 *  Food): brand hero image, name, pin + city row, full-width gradient
 *  "View supplier" CTA, heart top-right. Chrome from `.bp-card
 *  .bp-card--zoom`. The whole card IS the link; the CTA is the visual
 *  affordance inside it (one tab stop, v1 parity). */
@Component({
  selector: 'app-supplier-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, TooltipModule],
  host: { class: 'bp-card bp-card--zoom' },
  template: `
    <a [routerLink]="['/suppliers', supplier().id]" class="bp-supplier-card__link" [attr.aria-label]="supplier().name">
      <!-- Auto-normalised hero (pV2-CARDS-01): a blurred cover backdrop (or soft
           brand wash when there's none) with the logo on a clean white plate,
           centred. Uniform across every supplier regardless of what art they
           uploaded — real covers, logo-as-cover, or nothing all read the same. -->
      <div class="bp-supplier-card__hero">
        @if (heroSrc(); as src) {
          <!-- Blurred-fill: the same art fills the box (blurred) behind the full,
               contained image — so any cover/logo-as-cover shows whole, never cropped. -->
          <img class="bp-supplier-card__bg" [src]="src" alt="" aria-hidden="true" loading="lazy" decoding="async" />
          <img class="bp-supplier-card__fg" [src]="src" [alt]="supplier().name" loading="lazy" decoding="async" />
        } @else {
          <lucide-icon name="store" [size]="26" [strokeWidth]="1.5" class="bp-supplier-card__fallback" />
        }
      </div>
      <div class="min-w-0 px-3.5 pb-3.5 pt-3">
        <div class="truncate text-md font-semibold text-text">{{ supplier().name }}</div>
        <div class="mt-1 flex items-center gap-1 text-secondary">
          <lucide-icon name="map-pin" [size]="13" [strokeWidth]="1.75" />
          <span class="bp-caption min-w-0 truncate">{{ supplier().city ?? '—' }}</span>
          <span class="bp-meta ml-auto shrink-0">{{ supplier().count }} item{{ supplier().count === 1 ? '' : 's' }}</span>
        </div>
        <!-- pV2-INBOX-02: in the project fan-out the CTA adds this supplier
             to the quote (a real button — stops the card's navigation);
             elsewhere it's the visual "View supplier" cue on the link. -->
        @if (quotable()) {
          <!-- Once added, the CTA is a non-interactive "Added" state — you
               remove a supplier from the Quote rail, not by re-clicking
               here (so a stray click can't toggle it back off). -->
          <button
            type="button"
            [class]="(inQuote() ? 'bp-btn-outline cursor-not-allowed opacity-70' : 'bp-btn-grad') + ' mt-3 w-full'"
            (click)="onQuote($event)"
          >
            <lucide-icon [name]="inQuote() ? 'check' : 'plus'" [size]="16" />
            {{ inQuote() ? 'Added to Quote' : 'Add to Quote' }}
          </button>
        } @else {
          <!-- Not a button — a text link cue (the whole card is the link). -->
          <span class="store-link mt-3 block">Visit the {{ supplier().name }} Store</span>
        }
      </div>
    </a>
    <!-- Wishlist is a buyer (agency) action — hidden for suppliers/others. -->
    @if (isAgent()) {
      <button
        type="button"
        class="bp-fav-btn"
        [class.bp-fav-btn--on]="favourited()"
        [attr.aria-label]="favourited() ? 'Remove from Wishlist' : 'Add to Wishlist'"
        [pTooltip]="favourited() ? 'Remove from Wishlist' : 'Add to Wishlist'"
        tooltipStyleClass="bp-tooltip"
        tooltipPosition="top"
        (click)="favouriteToggled.emit(supplier().id)"
      >
        <lucide-icon name="heart" [size]="15" />
      </button>
    }
  `,
  styles: `
    .store-link {
      font-family: var(--font-body);
      font-size: var(--text-sm);
      color: var(--theme-accent);
    }
    .store-link:hover { text-decoration: underline; }
    .bp-supplier-card__hero {
      position: relative;
      aspect-ratio: 4 / 3;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--theme-soft);
    }
    /* Blurred copy of the art fills the box — brand colour/texture, no crop. */
    .bp-supplier-card__bg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scale(1.18);
      filter: blur(18px) saturate(1.2);
    }
    /* The real art, shown WHOLE (contained) and centred over the blurred fill. */
    .bp-supplier-card__fg {
      position: relative;
      z-index: 1;
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
      object-fit: contain;
    }
    .bp-supplier-card__fallback { color: var(--color-text-secondary); }
  `,
})
export class SupplierCardComponent {
  private readonly auth = inject(AuthService);
  /** Wishlist heart is a buyer (agency) action only. */
  protected readonly isAgent = computed(() => this.auth.user()?.activeOrgType === 'agency');

  readonly supplier = input.required<CatalogueSupplier>();
  readonly favourited = input<boolean>(false);
  readonly favouriteToggled = output<string>();
  /** Project fan-out (pV2-INBOX-02): show "Add to Quote" instead of the
   *  "View supplier" cue, reflecting + toggling roster membership. */
  readonly quotable = input<boolean>(false);
  readonly inQuote = input<boolean>(false);
  readonly quoteToggled = output<string>();

  protected coverSrc(): string | null {
    return sizedImage(this.supplier().coverUrl, 480);
  }

  /** Logo src with spaces encoded — some imported logo URLs carry raw spaces
   *  that break the <img> load (matches the shopfront fix). */
  protected readonly logoSrc = computed(() => {
    const u = (this.supplier().logoUrl ?? '').trim();
    return u ? u.replace(/ /g, '%20') : null;
  });

  /** Hero art: prefer the cover (most suppliers have one), fall back to the logo.
   *  Shown as a blurred-fill so it's never cropped regardless of aspect. */
  protected readonly heroSrc = computed(() => this.coverSrc() ?? this.logoSrc());

  /** The CTA sits inside the card's <a>; always stop the navigation. Only
   *  ADD here — once in the quote it's inert (removal is via the rail), and
   *  we keep the click handler (not `disabled`) so it reliably swallows the
   *  click instead of letting it bubble to the card link. */
  protected onQuote(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
    if (this.inQuote()) return;
    this.quoteToggled.emit(this.supplier().id);
  }
}
