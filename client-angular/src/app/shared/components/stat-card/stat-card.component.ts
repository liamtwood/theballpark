import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="bp-stat-cell">
      <div class="bp-stat-label" [class.themed]="themed">
        <lucide-icon *ngIf="icon" [name]="icon" [size]="10" style="display:inline;vertical-align:middle;margin-right:3px;"></lucide-icon>{{ label }}
      </div>
      <div class="bp-stat-number">{{ value }}</div>
      <div class="bp-stat-sub" [class.themed]="themed">{{ sub }}</div>
    </div>
  `,
  styles: [`
    .bp-stat-cell { padding: 18px 24px; border-right: 0.5px solid var(--color-border); }
    :host:last-child .bp-stat-cell { border-right: none; }
    .bp-stat-label {
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.1em; color: var(--color-text-muted); margin-bottom: 6px;
      display: flex; align-items: center; gap: 4px;
    }
    .bp-stat-label.themed { color: var(--theme-accent); }
    .bp-stat-number { font-size: 26px; font-weight: 700; color: var(--color-text-primary); line-height: 1; margin-bottom: 4px; }
    .bp-stat-sub { font-size: 11px; color: var(--color-text-muted); }
    .bp-stat-sub.themed { color: var(--theme-accent); }
  `]
})
export class StatCardComponent {
  @Input() label = '';
  @Input() value: string | number = 0;
  @Input() sub = '';
  @Input() themed = false;
  @Input() icon?: string;
}
