import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    <div class="rounded-full flex items-center justify-center text-white font-semibold select-none flex-shrink-0"
         [style.width.px]="size"
         [style.height.px]="size"
         [style.background]="'var(--theme-accent)'"
         [style.font-size.px]="size * 0.35">
      {{ initials }}
    </div>
  `,
})
export class AvatarComponent {
  @Input() name = '';
  @Input() size = 32;

  get initials(): string {
    if (!this.name) return 'U';
    const trimmed = this.name.trim();
    // If a 2-letter initials code is passed directly (e.g. "LW"), use it.
    // Distinguishes "LW" (initials) from "Liam" (name to derive from).
    if (/^[A-Za-z]{2}$/.test(trimmed)) {
      return trimmed.toUpperCase();
    }
    return trimmed
      .split(/\s+/)
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U';
  }
}
