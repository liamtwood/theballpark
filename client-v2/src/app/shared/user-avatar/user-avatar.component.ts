import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Initials from a display name ("Sarah Mitchell" → "SM"), falling back to the
 *  email's first letter, then "?". */
function deriveInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return '?';
}

/** Atomic identity primitive — image when available, themed-gradient initials
 *  circle otherwise. Used wherever a user circle appears (header 40px, team
 *  rows 28px, message bubbles 20px, …). The host stays a layout-neutral inline
 *  element; the circle itself is the conditional img/div leaf (semantically
 *  required — an <img> can't be the host), per the host:-binding standard. */
@Component({
  selector: 'app-user-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    @if (imageUrl()) {
      <img
        [src]="imageUrl()"
        [alt]="displayName() ?? 'User avatar'"
        class="avatar avatar--img"
        [style.width.px]="size()"
        [style.height.px]="size()"
      />
    } @else {
      <div
        class="avatar avatar--initials"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.font-size.px]="fontSize()"
      >
        {{ initials() }}
      </div>
    }
  `,
  styles: [
    `
      .avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        flex-shrink: 0;
        font-weight: 600;
        color: var(--theme-accent);
      }
      .avatar--initials {
        background: var(--theme-soft);
        font-family: var(--font-display, inherit);
      }
      .avatar--img {
        object-fit: cover;
      }
    `,
  ],
})
export class UserAvatarComponent {
  /** Full display name — drives two-letter initials. */
  readonly displayName = input<string | null>(null);
  /** Email fallback for initials when no display name exists. */
  readonly email = input<string | null>(null);
  /** Avatar image URL; initials render when null. */
  readonly imageUrl = input<string | null>(null);
  /** Circle diameter in px (header 40, list rows 28, bubbles 20). */
  readonly size = input<number>(36);

  protected readonly initials = computed(() => deriveInitials(this.displayName(), this.email()));
  protected readonly fontSize = computed(() => Math.round(this.size() * 0.4));
}
