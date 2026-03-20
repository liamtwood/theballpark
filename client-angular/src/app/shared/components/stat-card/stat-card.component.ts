import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="flex flex-col justify-between p-6 border-r border-gray-100 h-full">
      <div class="text-xs font-bold uppercase tracking-widest mb-1"
           [class.text-amber-600]="themed"
           [class.text-gray-400]="!themed">
        <lucide-icon *ngIf="icon" [name]="icon" [size]="10" style="display:inline;vertical-align:middle;margin-right:3px;"></lucide-icon>{{ label }}
      </div>
      <div class="text-2xl font-bold text-gray-900 mb-1">{{ value }}</div>
      <div class="text-xs text-gray-400">{{ sub }}</div>
    </div>
  `,
  styles: [`:host:last-child .border-r { border-right: none; }`]
})
export class StatCardComponent {
  @Input() label = '';
  @Input() value: string | number = 0;
  @Input() sub = '';
  @Input() themed = false;
  @Input() icon?: string;
}
