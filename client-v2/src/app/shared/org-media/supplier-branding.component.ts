import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { MarkdownPipe } from '../markdown.pipe';

/** pV2-PROFILE-BRANDING-01 — the ONE supplier branding block, rendered identically
 *  on the owner's /settings/profile (edit mode) and a producer's marketplace Quick
 *  View (read-only). Banner cover + circular logo straddling it, then identity (name
 *  + approved check + "Approved Ballpark <role> · <city>"), About, and contact pills
 *  (website · instagram · email, then company number). One definition, two modes —
 *  mounting the same component in both places guarantees they can't drift (Liam
 *  2026-11-02). `editable` gates the affordances: cover/logo upload buttons, the
 *  inline About textarea, and the "Add …" placeholder pills. In VIEW mode About is
 *  rendered markdown and only POPULATED pills show (option 1). Past projects is the
 *  separate app-org-media portfolio, mounted alongside by each consumer. All styling
 *  is the global .bp-org-banner / .bp-branding-media / .bp-contact-* / .bp-about-edit
 *  kit — only the empty-logo monogram is local. */
@Component({
  selector: 'app-supplier-branding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [FormsModule, LucideAngularModule, MarkdownPipe],
  template: `
    <div class="bp-branding-media">
      <div class="bp-org-banner">
        <div class="bp-org-banner__cover" [class.bp-org-banner__cover--empty]="!coverUrl()">
          @if (coverUrl()) { <img [src]="coverUrl()" [alt]="name()" /> }
          @if (editable()) {
            <button type="button" class="bp-btn--secondary bp-org-banner__cover-btn" (click)="editCover.emit()">
              <lucide-icon name="upload" [size]="15" /> Upload Cover Photo
            </button>
          }
        </div>
        <!-- Circular logo straddling the cover's bottom-left; monogram when empty
             (same in both modes, matching the Quick View). -->
        <div class="bp-org-banner__logo">
          @if (logoUrl()) {
            <img [src]="logoUrl()" [alt]="name() + ' logo'" />
          } @else {
            <span class="bp-sb-mono">{{ monogram() }}</span>
          }
          @if (editable()) {
            <button type="button" class="bp-org-banner__logo-btn" (click)="editLogo.emit()" aria-label="Upload logo">
              <lucide-icon name="upload" [size]="13" />
            </button>
          }
        </div>
      </div>
    </div>

    <!-- Identity: name + approved check, then "Approved Ballpark <role> · <city>".
         Lifted up beside the logo (see profile; negative top margin + left pad). -->
    <div class="-mt-10 pl-32">
      <div class="flex items-center gap-1.5">
        <h3 class="bp-card-title">{{ name() }}</h3>
        <lucide-icon name="circle-check" [size]="20" class="bp-verified" />
      </div>
      <div class="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-secondary">
        <span class="bp-body-small">Approved Ballpark {{ roleLabel() }}</span>
        @if (city()) {
          <span class="bp-body-small">·</span>
          <lucide-icon name="map-pin" [size]="14" [strokeWidth]="1.75" />
          <span class="bp-body-small">{{ city() }}</span>
        }
      </div>
    </div>

    <!-- About: inline editable text in edit mode; rendered markdown in view. -->
    @if (editable()) {
      <textarea class="bp-about-edit bp-body mt-3 block w-full resize-none border-0 text-secondary focus:outline-none"
                rows="5"
                placeholder="Tell customers about your company…"
                [ngModel]="description()"
                (ngModelChange)="descriptionChange.emit($event)"
                (blur)="descriptionCommit.emit()"></textarea>
    } @else if (description()) {
      <div class="bp-md bp-body mt-3 text-secondary" [innerHTML]="description() | md"></div>
    }

    <!-- Contact pills: website · instagram · email. Edit shows "Add …" placeholders;
         view shows only populated pills. -->
    @if (showPills()) {
      <div class="bp-contact-row mt-4 flex flex-wrap justify-center gap-2">
        @if (website()) {
          <a class="bp-contact-pill" [href]="webHref()" target="_blank" rel="noopener noreferrer">
            <lucide-icon name="globe" [size]="15" /><span>{{ webText() }}</span>
          </a>
        } @else if (editable()) {
          <span class="bp-contact-pill bp-contact-pill--empty">
            <lucide-icon name="globe" [size]="15" /><span>Add website</span>
          </span>
        }
        @if (instagram()) {
          <a class="bp-contact-pill" [href]="instaHref()" target="_blank" rel="noopener noreferrer">
            <lucide-icon name="instagram" [size]="15" /><span>{{ instaText() }}</span>
          </a>
        } @else if (editable()) {
          <span class="bp-contact-pill bp-contact-pill--empty">
            <lucide-icon name="instagram" [size]="15" /><span>Instagram</span>
          </span>
        }
        @if (email()) {
          <a class="bp-contact-pill" [href]="'mailto:' + email()">
            <lucide-icon name="mail" [size]="15" /><span>{{ email() }}</span>
          </a>
        } @else if (editable()) {
          <span class="bp-contact-pill bp-contact-pill--empty">
            <lucide-icon name="mail" [size]="15" /><span>Add email</span>
          </span>
        }
      </div>
    }
    @if (companyNumber() || editable()) {
      <div class="bp-contact-row mt-2 flex justify-center">
        @if (companyNumber()) {
          <span class="bp-contact-pill bp-contact-pill--fill"><span>Company no. {{ companyNumber() }}</span></span>
        } @else {
          <span class="bp-contact-pill bp-contact-pill--fill bp-contact-pill--empty"><span>Add company number</span></span>
        }
      </div>
    }
  `,
  styles: `
    /* Empty-logo monogram (initials) on the white logo ground. */
    .bp-sb-mono {
      font-family: var(--font-display, var(--font-body));
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--color-text);
      text-transform: uppercase;
    }
  `,
})
export class SupplierBrandingComponent {
  /** Edit affordances: cover/logo upload, inline About textarea, "Add …" pills. */
  readonly editable = input<boolean>(false);
  readonly name = input<string>('');
  readonly coverUrl = input<string | null>(null);
  readonly logoUrl = input<string | null>(null);
  /** "supplier" | "agency" → "Approved Ballpark <role>". */
  readonly roleLabel = input<string>('supplier');
  readonly city = input<string | null>(null);
  readonly description = input<string | null>(null);
  readonly website = input<string | null>(null);
  readonly email = input<string | null>(null);
  readonly companyNumber = input<string | null>(null);
  readonly instagram = input<string | null>(null);

  /** Edit mode: consumer owns the picker drawers + persistence. */
  readonly editCover = output<void>();
  readonly editLogo = output<void>();
  readonly descriptionChange = output<string>();
  readonly descriptionCommit = output<void>();

  /** Initials for the empty-logo monogram — first letters of up to two words. */
  protected readonly monogram = computed(() => {
    const words = (this.name() ?? '').trim().split(/\s+/).filter(Boolean);
    return (words.slice(0, 2).map((w) => w[0]).join('') || '?').toUpperCase();
  });

  /** Show the pills row at all: always in edit (placeholders), else only when a pill has data. */
  protected readonly showPills = computed(
    () => this.editable() || !!this.website() || !!this.instagram() || !!this.email(),
  );

  /** Website pill: safe absolute href (prefix https:// when missing) + host-only label. */
  protected readonly webHref = computed(() => {
    const r = (this.website() ?? '').trim();
    return /^https?:\/\//i.test(r) ? r : `https://${r}`;
  });
  protected readonly webText = computed(() => {
    try {
      return new URL(this.webHref()).host.replace(/^www\./, '');
    } catch {
      return (this.website() ?? '').replace(/^https?:\/\//i, '').replace(/\/$/, '');
    }
  });

  /** Instagram pill: @handle label + link to the profile (strip any URL/@). */
  protected readonly instaHandle = computed(() =>
    (this.instagram() ?? '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, ''),
  );
  protected readonly instaText = computed(() => (this.instaHandle() ? '@' + this.instaHandle() : ''));
  protected readonly instaHref = computed(() => `https://instagram.com/${this.instaHandle()}`);
}
