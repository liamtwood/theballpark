import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span *ngIf="displayName" class="bp-pill" [ngClass]="pillClass">
      <span *ngIf="showDot" class="bp-pill-dot" [ngClass]="dotClass"></span>
      {{ displayName }}
    </span>
  `,
  styles: [`
    /* Pill base — sizing and shape only.
       Colours defined in styles.css as single source of truth. */
    .bp-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 20px;
      white-space: nowrap;
      font-family: var(--font-body);
    }
    .bp-pill-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
  `]
})
export class StatusBadgeComponent {
  @Input() status: string | null | undefined;
  @Input() statusName: string | null | undefined;

  get displayName(): string {
    return (this.statusName || this.status || '').replace(/_/g, ' ');
  }

  get key(): string {
    return (this.statusName || this.status || '').toLowerCase();
  }

  get showDot(): boolean {
    // Role pills (owner, member) don't need a dot
    return !['owner', 'member', 'admin'].includes(this.key);
  }

  get pillClass(): string {
    return `bp-pill-${this.key}`;
  }

  get dotClass(): string {
    return `bp-dot-${this.key}`;
  }
}
