import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `<span *ngIf="displayName" [class]="badgeClass" class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize">{{ displayName }}</span>`
})
export class StatusBadgeComponent {
  @Input() status: string | null | undefined;
  @Input() statusName: string | null | undefined;

  private colorMap: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700', active: 'bg-green-100 text-green-700',
    sent: 'bg-blue-100 text-blue-700', accepted: 'bg-emerald-100 text-emerald-700',
    declined: 'bg-red-100 text-red-700', completed: 'bg-purple-100 text-purple-700',
    cancelled: 'bg-gray-200 text-gray-500', pending: 'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-blue-100 text-blue-700', quoted: 'bg-indigo-100 text-indigo-700',
    confirmed: 'bg-emerald-100 text-emerald-700', archived: 'bg-gray-200 text-gray-500',
    unread: 'bg-blue-100 text-blue-700', read: 'bg-gray-100 text-gray-600',
    replied: 'bg-green-100 text-green-700',
  };

  get displayName(): string { return (this.statusName || this.status || '').replace(/_/g, ' '); }
  get badgeClass(): string { return this.colorMap[(this.statusName || this.status || '').toLowerCase()] || 'bg-gray-100 text-gray-700'; }
}
