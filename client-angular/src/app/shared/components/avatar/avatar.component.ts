import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `<div class="bp-avatar" [style.width.px]="size" [style.height.px]="size" [style.font-size.px]="size * 0.375">{{ initials }}</div>`,
  styles: [`
    .bp-avatar {
      border-radius: 50%;
      background: #1E1E1E;
      color: #ffffff;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
  `]
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
