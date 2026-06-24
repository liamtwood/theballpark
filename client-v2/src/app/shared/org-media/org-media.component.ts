import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ImageGalleryComponent } from '../image-gallery/image-gallery.component';
import { UnsplashCreditComponent } from '../media/unsplash-credit.component';
import { GalleryImage } from '../../core/media/media.types';

/** pV2-MEDIA-01e — the org's branding (cover banner + logo pill) and portfolio
 *  gallery, rendered identically on the owner's /settings/profile (edit mode)
 *  and a visitor's /suppliers/:id storefront (view mode). One definition, two
 *  consumers — the architectural lock: view mode is purely a render flag, NOT
 *  a fork. Only edit affordances toggle.
 *
 *  Layout (v2.34s, Liam's canonical edit view): the cover is a wide banner; in
 *  EDIT mode a SQUARE logo straddles its bottom-left corner (gradient placeholder
 *  when empty), an "Upload Cover Photo" button sits top-right of the cover, the
 *  logo carries a small upload affordance, and the org name + subtitle render
 *  below. Fields are passed individually so either consumer's DTO shape —
 *  OrgProfile (`coverImageUrl`) or SupplierDetail (`coverUrl`) — feeds it.
 *
 *  - edit mode: empty cover/logo show gradient placeholders + upload affordances
 *    (gated by `canEdit`); the gallery is editable.
 *  - view mode: ONLY the cover renders in the banner (NO logo overlay — the
 *    shopfront places the logo in its Company Information card); the gallery is
 *    read-only and titled "My portfolio". */
@Component({
  selector: 'app-org-media',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  imports: [LucideAngularModule, ImageGalleryComponent, UnsplashCreditComponent],
  template: `
    @if (showBanner()) {
      <div class="bp-org-banner">
        <div class="bp-org-banner__cover" [class.bp-org-banner__cover--empty]="!coverUrl()">
          @if (coverUrl()) {
            <img [src]="coverUrl()" alt="" />
          }
          @if (mode() === 'edit' && canEdit()) {
            <button type="button" class="bp-org-banner__cover-btn" (click)="editCover.emit()">
              <lucide-icon name="upload" [size]="15" /> Upload Cover Photo
            </button>
          }
        </div>

        @if (mode() === 'edit') {
          <!-- Square logo straddling the cover's bottom-left (canonical edit
               view). Gradient placeholder when empty; upload affordance on the
               corner. View mode shows NO logo here — the shopfront renders it
               in its Company Information card. -->
          <div class="bp-org-banner__logo" [class.bp-org-banner__logo--empty]="!logoUrl()">
            @if (logoUrl()) {
              <img [src]="logoUrl()" alt="" />
            }
            @if (canEdit()) {
              <button type="button" class="bp-org-banner__logo-btn" (click)="editLogo.emit()" aria-label="Upload logo">
                <lucide-icon name="upload" [size]="13" />
              </button>
            }
          </div>
        }
      </div>

      @if (mode() === 'edit' && (name() || subtitle())) {
        <div class="mt-2 pl-0.5">
          <p class="text-md font-semibold text-text">{{ name() }}</p>
          @if (subtitle()) {
            <p class="bp-caption truncate">{{ subtitle() }}</p>
          }
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
                <app-unsplash-credit [attribution]="img.attribution" />
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
})
export class OrgMediaComponent {
  readonly mode = input<'edit' | 'view'>('view');
  /** Which sub-sections to render. The storefront places the banner at the top
   *  of the page and the portfolio at the bottom, so it mounts the component
   *  twice ('banner' / 'portfolio'); the profile editor renders 'all'. */
  readonly show = input<'all' | 'banner' | 'portfolio'>('all');
  /** Only consulted in edit mode — gates the Edit row + gallery editing. */
  readonly canEdit = input(false);
  readonly name = input('');
  /** Optional line under the org name in the EDIT branding view. */
  readonly subtitle = input('');
  readonly coverUrl = input<string | null>(null);
  readonly logoUrl = input<string | null>(null);
  readonly images = input<GalleryImage[]>([]);

  /** Edit-mode only — the consumer owns the picker drawers + persistence. */
  readonly editCover = output<void>();
  readonly editLogo = output<void>();
  readonly imagesChange = output<GalleryImage[]>();
  readonly primarySet = output<GalleryImage>();

  /** In view mode each block only appears when there's something to show, and
   *  only when `show` includes it. The banner in VIEW mode is the cover alone
   *  (logo moved to the consumer's Company Info), so it needs a coverUrl. */
  protected readonly showBanner = computed(
    () =>
      (this.show() === 'all' || this.show() === 'banner') &&
      (this.mode() === 'edit' || !!this.coverUrl())
  );
  protected readonly showGallery = computed(
    () =>
      (this.show() === 'all' || this.show() === 'portfolio') &&
      (this.mode() === 'edit' || (this.images()?.length ?? 0) > 0)
  );
}
