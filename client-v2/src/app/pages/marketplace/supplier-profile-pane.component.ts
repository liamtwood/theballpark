import { ChangeDetectionStrategy, Component, computed, inject, input, resource } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { CatalogueService } from '../../core/marketplace/catalogue.service';
import { sizedImage } from '../../shared/catalogue/catalogue.types';
import { ImageCarouselComponent } from '../../shared/catalogue/image-carousel.component';
import { MarkdownPipe } from '../../shared/markdown.pipe';

/** pV2-STORE-QUICKVIEW-SUPPLIER-01 — the supplier-profile PANE of the two-page Quick
 *  View. Reads the storefront projection (GET /api/marketplace/suppliers/:id →
 *  supplier_directory) and renders, in order: cover + overlapping circular logo →
 *  name + location → website pill → description (markdown, clamped with Show more) →
 *  "Past projects" (the supplier's gallery images in the shared carousel). No
 *  "approved/verified" badge (every marketplace supplier is approved by default) and
 *  NO "View full store" / store navigation (deferred, Liam 2026-10-15) — the pane
 *  never routes. Conditional-everywhere: no cover → neutral band, no logo → monogram,
 *  no gallery → hide "Past projects", no description/website/city → hide. */
@Component({
  selector: 'app-supplier-profile-pane',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LucideAngularModule, ImageCarouselComponent, MarkdownPipe],
  template: `
    @if (detail.value(); as s) {
      @if (wide()) {
        <!-- LAYOUT 2 — brand page (Liam 2026-11-10): cinematic cover + large logo,
             bold name, website, about, and a tiled "Their work" gallery grid. -->
        <div class="bp-sp2">
          <div class="bp-sp2-cover" [class.bp-sp2-cover--empty]="!coverSrc()">
            @if (coverSrc(); as cover) {
              <img class="bp-sp2-cover__img" [src]="cover" [alt]="s.name" loading="eager" />
            }
          </div>

          <!-- Identity row: logo with the name to its right, city under the name. -->
          <div class="bp-sp2-id">
            <div class="bp-sp2-logo">
              @if (logoSrc(); as logo) {
                <img class="bp-sp2-logo__img" [src]="logo" [alt]="s.name + ' logo'" loading="eager" />
              } @else {
                <span class="bp-sp2-logo__mono">{{ monogram() }}</span>
              }
            </div>
            <div class="min-w-0">
              <h2 class="bp-sp2-name">{{ s.name }}</h2>
              @if (s.city) {
                <div class="mt-0.5 flex items-center gap-1 text-secondary">
                  <lucide-icon name="map-pin" [size]="14" [strokeWidth]="1.75" />
                  <span class="bp-body-small">{{ s.city }}</span>
                </div>
              }
            </div>
          </div>

          <div class="bp-sp2-body">
            <!-- LEFT — website + about. -->
            <div class="bp-sp2-info min-w-0">
              @if (websiteHref(); as href) {
                <a class="bp-sp-web self-start" [href]="href" target="_blank" rel="noopener noreferrer">
                  <lucide-icon name="globe" [size]="15" />
                  <span>{{ websiteLabel() }}</span>
                  <lucide-icon name="external-link" [size]="14" />
                </a>
              }
              @if (s.description) {
                <div class="bp-md bp-body text-secondary" [class.mt-3]="websiteHref()" [innerHTML]="s.description | md"></div>
              }
            </div>

            <!-- RIGHT — Past projects (half-size shots, vertical shuttle). Hover shows
                 the project's caption (label), else the supplier name. -->
            <div class="bp-sp2-side min-w-0">
              @if (galleryShots().length) {
                <span class="bp-qv-spec__label">Past projects</span>
                <div class="bp-sp2-scroller">
                  @for (shot of galleryShots(); track shot.url) {
                    <div class="bp-sp2-shot" [title]="shot.label || s.name">
                      <img [src]="shot.url" [alt]="shot.label || (s.name + ' project')" loading="lazy" />
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      } @else {
      <div class="flex flex-col gap-4">
        <!-- Cover + overlapping logo. The logo always has a ground (ring + fill) so a
             sparse supplier still reads; the no-cover case falls back to a neutral band. -->
        <div class="bp-sp-cover" [class.bp-sp-cover--empty]="!coverSrc()">
          @if (coverSrc(); as cover) {
            <img class="bp-sp-cover__img" [src]="cover" [alt]="s.name" loading="eager" />
          }
          <div class="bp-sp-logo">
            @if (logoSrc(); as logo) {
              <img class="bp-sp-logo__img" [src]="logo" [alt]="s.name + ' logo'" loading="eager" />
            } @else {
              <span class="bp-sp-logo__mono">{{ monogram() }}</span>
            }
          </div>
        </div>

        <div class="flex flex-col gap-3 pt-1">
          <div class="min-w-0">
            <span class="bp-sp-eyebrow">Quick view</span>
            <h2 class="bp-card-title mt-0.5">{{ s.name }}</h2>
            @if (s.city) {
              <div class="mt-1 flex items-center gap-1 text-secondary">
                <lucide-icon name="map-pin" [size]="14" [strokeWidth]="1.75" />
                <span class="bp-body-small">{{ s.city }}</span>
              </div>
            }
          </div>

          @if (websiteHref(); as href) {
            <a class="bp-sp-web self-start" [href]="href" target="_blank" rel="noopener noreferrer">
              <lucide-icon name="globe" [size]="15" />
              <span>{{ websiteLabel() }}</span>
              <lucide-icon name="external-link" [size]="14" />
            </a>
          }

          @if (s.description) {
            <div class="bp-md bp-body text-secondary" [innerHTML]="s.description | md"></div>
          }

          @if (gallery().length) {
            <div class="flex flex-col gap-2">
              <span class="bp-qv-spec__label"><lucide-icon name="image" [size]="13" /> Projects</span>
              <app-image-carousel [images]="gallery()" [alt]="s.name + ' project'" fit="cover" />
            </div>
          }
        </div>
      </div>
      }
    } @else if (detail.error()) {
      <div class="bp-sp-state text-secondary">
        <lucide-icon name="store" [size]="22" [strokeWidth]="1.5" />
        <span class="bp-body-small">Couldn't load this supplier's profile.</span>
      </div>
    } @else {
      <div class="bp-sp-state text-secondary">
        <lucide-icon name="store" [size]="22" [strokeWidth]="1.5" />
        <span class="bp-body-small">Loading supplier profile…</span>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .bp-sp-cover {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 7;
      border-radius: var(--radius-lg);
      overflow: visible;
      background: var(--color-fill);
    }
    .bp-sp-cover__img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: var(--radius-lg);
      display: block;
    }
    .bp-sp-cover--empty { background: var(--color-fill); }
    /* Circular logo overlapping the cover's bottom-left; white ring so it reads on
       any cover. The content below starts clear of the overflow (see pane pt). */
    .bp-sp-logo {
      position: absolute;
      left: 16px;
      bottom: -28px;
      width: 68px;
      height: 68px;
      border-radius: var(--radius-pill);
      background: var(--color-surface);
      border: 3px solid var(--color-surface);
      box-shadow: var(--shadow-md);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bp-sp-logo__img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .bp-sp-logo__mono {
      font-family: var(--font-display, var(--font-body));
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--color-text);
      text-transform: uppercase;
    }
    /* Clear the logo overflow before the name block. */
    .bp-sp-cover + div { margin-top: 20px; }
    .bp-sp-eyebrow {
      font-size: var(--text-xs);
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--color-text-secondary);
    }
    .bp-sp-web {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border: 1px solid var(--color-border-hairline);
      border-radius: var(--radius-pill);
      background: var(--color-surface);
      color: var(--color-text);
      text-decoration: none;
      font-family: var(--font-body);
      font-size: var(--text-sm);
      box-shadow: var(--shadow-md);
    }
    .bp-sp-web:hover { border-color: var(--theme-accent); }
    .bp-sp-state {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 48px 0;
      justify-content: center;
    }

    /* ── Layout 2 brand page (Liam 2026-11-10) ─────────────────────────────── */
    .bp-sp2 { display: flex; flex-direction: column; gap: 1rem; }
    .bp-sp2-cover {
      position: relative;
      width: 100%;
      /* Banner strip (Liam 2026-11-10) — a capped height, clamped to the viewport so
         the cover never takes the whole fold; object-fit:cover crops to the band. */
      height: clamp(110px, 20vh, 170px);
      border-radius: var(--radius-lg);
      background: var(--color-fill);
    }
    .bp-sp2-cover__img { width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-lg); display: block; }
    .bp-sp2-cover--empty { background: var(--color-fill); }
    /* Identity row: logo + (name / city). The logo pulls up to overlap the banner. */
    .bp-sp2-id { display: flex; align-items: center; gap: 0.9rem; padding-left: 4px; }
    .bp-sp2-logo {
      flex: none;
      margin-top: -44px;
      position: relative;
      z-index: 1;
      width: 84px;
      height: 84px;
      border-radius: 50%;
      background: var(--color-surface);
      border: 4px solid var(--color-surface);
      box-shadow: var(--shadow-md);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bp-sp2-logo__img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .bp-sp2-logo__mono {
      font-family: var(--font-display, var(--font-body));
      font-size: 2rem;
      font-weight: 600;
      color: var(--color-text);
      text-transform: uppercase;
    }
    .bp-sp2-name {
      font-family: var(--font-display, var(--font-body));
      font-size: var(--text-2xl, 1.5rem);
      font-weight: 600;
      line-height: var(--leading-tight, 1.2);
      color: var(--color-text);
      margin: 0;
    }
    /* Two columns (like the item view): identity left, Past projects + about right. */
    .bp-sp2-body { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: start; }
    .bp-sp2-info { display: flex; flex-direction: column; }
    .bp-sp2-side { display: flex; flex-direction: column; gap: 0.5rem; min-width: 0; }
    /* Vertical shuttle — half-size shots, two across, the rest scroll vertically. */
    .bp-sp2-scroller {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.6rem;
      max-height: 360px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .bp-sp2-shot {
      flex: none;
      width: 100%;
      aspect-ratio: 3 / 2;
      border-radius: var(--radius-card);
      overflow: hidden;
      background: var(--color-fill);
    }
    .bp-sp2-shot img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.25s ease; }
    .bp-sp2-shot:hover img { transform: scale(1.04); }
    @media (max-width: 720px) {
      .bp-sp2-body { grid-template-columns: 1fr; }
    }
  `,
})
export class SupplierProfilePaneComponent {
  private readonly catalogue = inject(CatalogueService);

  /** The supplier whose storefront profile to show. */
  readonly supplierId = input.required<string>();
  /** Quick View layout 2 (wide dialog) — render the richer brand-page variant
   *  (cinematic cover, large logo, bold name, tiled work gallery) instead of the
   *  narrow single-column pane. Liam 2026-11-10. */
  readonly wide = input<boolean>(false);

  /** Storefront projection (cached per id in the service). Reloads when the id
   *  changes — opening the Quick View on a different item re-fetches its supplier. */
  protected readonly detail = resource({
    params: () => this.supplierId(),
    loader: ({ params }) => this.catalogue.supplierDetail(params),
  });

  protected readonly coverSrc = computed(() => sizedImage(this.detail.value()?.coverUrl ?? null, 900));

  /** Logo src with spaces encoded (some imported logo URLs carry raw spaces that
   *  break the <img> load — matches the supplier card/shopfront fix). */
  protected readonly logoSrc = computed(() => {
    const u = (this.detail.value()?.logoUrl ?? '').trim();
    return u ? u.replace(/ /g, '%20') : null;
  });

  /** First letter of the name for the no-logo monogram avatar. */
  protected readonly monogram = computed(() => (this.detail.value()?.name ?? '?').trim().charAt(0) || '?');

  /** Gallery image urls for "Past projects" (spaces encoded like the logo). */
  protected readonly gallery = computed(() =>
    (this.detail.value()?.images ?? []).map((g) => g.url.trim().replace(/ /g, '%20')).filter((u) => !!u)
  );

  /** Past-projects shots WITH their caption (label) — the layout-2 grid shows a
   *  hover title (the project's caption, else the supplier name). */
  protected readonly galleryShots = computed(() =>
    (this.detail.value()?.images ?? [])
      .map((g) => ({ url: g.url.trim().replace(/ /g, '%20'), label: (g.label ?? '').trim() }))
      .filter((s) => !!s.url)
  );

  /** A safe absolute href for the website link (prefix https:// when the stored
   *  value omits a scheme); null when there's no website. */
  protected readonly websiteHref = computed(() => {
    const raw = (this.detail.value()?.website ?? '').trim();
    if (!raw) return null;
    return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  });

  /** The link label — host without protocol or leading www / trailing slash. */
  protected readonly websiteLabel = computed(() => {
    const href = this.websiteHref();
    if (!href) return '';
    try {
      return new URL(href).host.replace(/^www\./, '');
    } catch {
      return href.replace(/^https?:\/\//i, '').replace(/\/$/, '');
    }
  });
}
