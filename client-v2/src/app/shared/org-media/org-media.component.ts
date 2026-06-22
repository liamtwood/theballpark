import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ImageGalleryComponent } from '../image-gallery/image-gallery.component';
import { GalleryImage } from '../../core/media/media.types';

/** pV2-MEDIA-01e — the org's branding (cover + logo) and portfolio gallery,
 *  rendered identically on the owner's /settings/profile (edit mode) and a
 *  visitor's /suppliers/:id storefront (view mode). One definition, two
 *  consumers — the architectural lock: view mode is purely a render flag,
 *  NOT a fork. Only edit affordances toggle.
 *
 *  Fields are passed individually (not a DTO) so either consumer's shape —
 *  OrgProfile (`coverImageUrl`) or SupplierDetail (`coverUrl`) — feeds it
 *  without a shared interface.
 *
 *  - edit mode: empty cover/logo show "No …" placeholders + an Edit button
 *    (gated by `canEdit`); the gallery is editable (add/remove/reorder).
 *  - view mode: only POPULATED media renders (no empty placeholders, no
 *    buttons); the gallery is read-only. */
@Component({
  selector: 'app-org-media',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  imports: [LucideAngularModule, ImageGalleryComponent],
  template: `
    @if (showBranding()) {
      <div class="bp-card p-5">
        <h3 class="bp-edit-section-title">Branding</h3>
        <div class="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2">
          @if (mode() === 'edit' || coverUrl()) {
            <div>
              <p class="bp-field-label">Cover image</p>
              <div class="mt-2 flex flex-col items-start gap-3">
                <div class="bp-media-preview">
                  @if (coverUrl()) {
                    <img [src]="coverUrl()" alt="" />
                  } @else {
                    <span class="bp-caption">No cover</span>
                  }
                </div>
                @if (mode() === 'edit' && canEdit()) {
                  <button type="button" class="bp-btn-outline" (click)="editCover.emit()">
                    <lucide-icon name="square-pen" [size]="16" /> Edit
                  </button>
                }
              </div>
            </div>
          }
          @if (mode() === 'edit' || logoUrl()) {
            <div>
              <p class="bp-field-label">Logo</p>
              <div class="mt-2 flex flex-col items-start gap-3">
                <div class="bp-media-preview">
                  @if (logoUrl()) {
                    <img [src]="logoUrl()" alt="" />
                  } @else {
                    <span class="bp-caption">No logo</span>
                  }
                </div>
                @if (mode() === 'edit' && canEdit()) {
                  <button type="button" class="bp-btn-outline" (click)="editLogo.emit()">
                    <lucide-icon name="square-pen" [size]="16" /> Edit
                  </button>
                }
              </div>
            </div>
          }
        </div>
      </div>
    }

    @if (showGallery()) {
      <div class="bp-card p-5">
        <h3 class="bp-edit-section-title">Gallery</h3>
        @if (mode() === 'edit') {
          <p class="bp-caption mt-1">Add up to 5 photos — set one as the cover (used on your supplier card).</p>
        }
        <div class="mt-3">
          <app-image-gallery
            entityType="profile"
            [images]="images()"
            [primaryUrl]="coverUrl()"
            [searchSeed]="name()"
            [editable]="mode() === 'edit' && canEdit()"
            (imagesChange)="imagesChange.emit($event)"
            (primarySet)="primarySet.emit($event)"
          />
        </div>
      </div>
    }
  `,
})
export class OrgMediaComponent {
  readonly mode = input<'edit' | 'view'>('view');
  /** Only consulted in edit mode — gates the Edit buttons + gallery editing. */
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

  /** In view mode the card only appears when there's something to show. */
  protected readonly showBranding = computed(
    () => this.mode() === 'edit' || !!this.coverUrl() || !!this.logoUrl()
  );
  protected readonly showGallery = computed(
    () => this.mode() === 'edit' || (this.images()?.length ?? 0) > 0
  );
}
