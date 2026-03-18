import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-lg border border-gray-200 shadow-sm px-6 py-16 text-center">
      <i [class]="'pi ' + icon + ' text-4xl text-gray-300 mb-3'"></i>
      <p class="text-sm text-gray-500 mt-3">{{ message }}</p>
      <ng-content></ng-content>
    </div>
  `
})
export class EmptyStateComponent {
  @Input() icon = 'pi-inbox';
  @Input() message = 'No data found.';
}
