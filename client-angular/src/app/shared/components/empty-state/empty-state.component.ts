import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Inbox, Folder, Users, Truck, FileText, List, Package } from 'lucide-angular';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div style="background:var(--color-surface);border:0.5px solid var(--color-border);border-radius:10px;padding:48px 24px;text-align:center;">
      <lucide-icon [name]="lucideIcon" [size]="36" style="color:var(--color-text-muted);margin-bottom:12px;"></lucide-icon>
      <p style="font-size:var(--text-sm);color:var(--color-text-muted);margin-top:12px;">{{ message }}</p>
      <ng-content></ng-content>
    </div>
  `
})
export class EmptyStateComponent {
  readonly icons = { Inbox, Folder, Users, Truck, FileText, List, Package };
  @Input() icon = 'pi-inbox';
  @Input() message = 'No data found.';

  private iconMap: Record<string, string> = {
    'pi-inbox': 'inbox', 'pi-folder': 'folder', 'pi-users': 'users',
    'pi-truck': 'truck', 'pi-file': 'file-text', 'pi-list': 'list',
    'pi-box': 'package',
  };

  get lucideIcon(): string { return this.iconMap[this.icon] || 'inbox'; }
}
