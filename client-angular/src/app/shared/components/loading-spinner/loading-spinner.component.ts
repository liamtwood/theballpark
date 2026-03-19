import { Component, Input } from '@angular/core';
import { LucideAngularModule, LoaderCircle } from 'lucide-angular';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [LucideAngularModule],
  template: `
    <div style="display:flex;align-items:center;justify-content:center;" [style.height]="height">
      <lucide-icon name="loader-circle" [size]="32" class="bp-spinner" style="color:var(--theme-accent);"></lucide-icon>
    </div>
  `,
  styles: [`
    .bp-spinner { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  `]
})
export class LoadingSpinnerComponent {
  readonly icons = { LoaderCircle };
  @Input() height = '16rem';
}
