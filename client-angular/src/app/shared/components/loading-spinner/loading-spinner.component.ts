import { Component, Input } from '@angular/core';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [ProgressSpinnerModule],
  template: `
    <div class="flex items-center justify-center p-8">
      <p-progressSpinner
        [style]="{width:'40px', height:'40px'}"
        strokeWidth="3"
        animationDuration=".8s">
      </p-progressSpinner>
    </div>
  `,
})
export class LoadingSpinnerComponent {
  @Input() height = '16rem';
}
