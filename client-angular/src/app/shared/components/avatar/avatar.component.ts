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
    return this.name
      .split(' ')
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U';
  }
}
