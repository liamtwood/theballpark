import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ImageGalleryComponent } from '../image-gallery/image-gallery.component';
import { GalleryImage } from '../../core/media/media.types';

/** pV2-MEDIA-01e — the org's branding (cover banner + logo pill) and portfolio
 *  gallery, rendered identically on the owner's /settings/profile (edit mode)
 *  and a visitor's /suppliers/:id storefront (view mode). One definition, two
 *  consumers — the architectural lock: view mode is purely a render flag, NOT
 *  a fork. Only edit affordances toggle.
 *
 *  Layout (v2.32i, per Liam's reference): the cover is a wide banner with the
 *  logo in a stadium "pill" straddling its bottom edge (where a profile avatar
 *  would sit). No "Branding" heading. Fields are passed individually so either
 *  consumer's DTO shape — OrgProfile (`coverImageUrl`) or SupplierDetail
 *  (`coverUrl`) — feeds it without a shared interface.
 *
 *  - edit mode: empty cover/logo show placeholders; an Edit cover / Edit logo
 *    row appears (gated by `canEdit`); the gallery is editable.
 *  - view mode: only POPULATED media renders (no placeholders, no buttons);
 *    the gallery is read-only and titled "My portfolio". */
@Component({
  selector: 'app-org-media',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  imports: [LucideAngularModule, ImageGalleryComponent],
  template: `
    @if (showBanner()) {
      <div class="bp-org-banner">
        <div class="bp-org-banner__cover">
          @if (coverUrl()) {
            <img [src]="coverUrl()" alt="" />
          } @else {
            <span class="bp-caption">No cover image</span>
          }
        </div>

        @if (mode() === 'edit' || logoUrl()) {
          <div class="bp-org-banner__pill" [class.bp-org-banner__pill--empty]="!logoUrl()">
            @if (logoUrl()) {
              <img [src]="logoUrl()" alt="" />
            } @else {
              <span>{{ initialChar() }}</span>
            }
          </div>
        }
      </div>

      @if (mode() === 'edit' && canEdit()) {
        <div class="bp-org-banner__actions">
          <button type="button" class="bp-btn-outline" (click)="editCover.emit()">
            <lucide-icon name="square-pen" [size]="16" /> Edit cover
          </button>
          <button type="button" class="bp-btn-outline" (click)="editLogo.emit()">
            <lucide-icon name="square-pen" [size]="16" /> Edit logo
          </button>
        </div>
      }
    }

    @if (showGallery()) {
      @if (mode() === 'view') {
        <!-- Portfolio — photos as cards using the storefront subcat-card chrome
             (.bp-card--zoom), no surrounding container (pV2-MEDIA-01e QC). -->
        <section>
          <h3 class="bp-edit-section-title">My portfolio</h3>
          <div class="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            @for (img of images(); track img.url) {
              <div class="bp-card bp-card--zoom">
                <img
                  class="bp-item-card__img"
                  [src]="img.url"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  [style.object-position]="img.focalX + '% ' + img.focalY + '%'"
                />
              </div>
            }
          </div>
        </section>
      } @else {
        <div class="bp-card p-5">
          <h3 class="bp-edit-section-title">Gallery</h3>
          <p class="bp-caption mt-1">Add up to 5 photos — set one as the cover (used on your supplier card).</p>
          <div class="mt-3">
            <app-image-gallery
              entityType="profile"
              [images]="images()"
              [primaryUrl]="coverUrl()"
              [searchSeed]="name()"
              [editable]="canEdit()"
              (imagesChange)="imagesChange.emit($event)"
              (primarySet)="primarySet.emit($event)"
            />
          </div>
        </div>
      }
    }
  `,
  styles: `
    .bp-org-banner {
      position: relative;
      /* Reserve room for the pill straddling the cover's bottom edge so it
         stays inside the box (no overflow into the parent's flex gap). */
      padding-bottom: 36px;
    }
    .bp-org-banner__cover {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 7;
      border-radius: var(--radius-card);
      overflow: hidden;
      border: 1px solid var(--color-border-hairline);
      background: var(--color-surface);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bp-org-banner__cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .bp-org-banner__pill {
      position: absolute;
      left: 50%;
      bottom: 6px;
      transform: translateX(-50%);
      height: 60px;
      min-width: 96px;
      max-width: 70%;
      padding: 0 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      background: var(--color-surface);
      /* The surface-coloured ring lifts the pill off the cover (reference). */
      border: 4px solid var(--color-surface);
      box-shadow: 0 6px 18px var(--color-border-medium);
      overflow: hidden;
    }
    .bp-org-banner__pill img {
      height: 100%;
      width: auto;
      max-width: 100%;
      object-fit: contain;
      border-radius: 999px;
      display: block;
    }
    .bp-org-banner__pill--empty {
      color: var(--color-text-muted);
      font-weight: 600;
      font-size: var(--text-lg, 1.125rem);
    }
    .bp-org-banner__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
  `,
})
export class OrgMediaComponent {
  readonly mode = input<'edit' | 'view'>('view');
  /** Only consulted in edit mode — gates the Edit row + gallery editing. */
  readonly canEdit = input(false);
  readonly name = input('');
  readonly coverUrl = input<string | null>(null);
  readonly logoUrl = input<string | null>(null);
  readonly images = input<GalleryImage[]>([]);

  /** Edit-mode only — the consumer owns the picker drawers + persistence. */
  readonly editCover = output<void>();
  readonly editLogo = output<void>();
  readonly imagesChange = output<GalleryImage[]>();
  readonly primarySet = output<GalleryImage>();

  /** Pill fallback when the org has no logo yet. */
  protected readonly initialChar = computed(() => (this.name().trim()[0] || '?').toUpperCase());

  /** In view mode each block only appears when there's something to show. */
  protected readonly showBanner = computed(
    () => this.mode() === 'edit' || !!this.coverUrl() || !!this.logoUrl()
  );
  protected readonly showGallery = computed(
    () => this.mode() === 'edit' || (this.images()?.length ?? 0) > 0
  );
}
