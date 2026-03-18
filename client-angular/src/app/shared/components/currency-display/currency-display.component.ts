import { Component, Input } from '@angular/core';
import { GbpPipe } from '../../pipes/gbp.pipe';

@Component({
  selector: 'app-currency',
  standalone: true,
  imports: [GbpPipe],
  template: `<span [class]="cssClass">{{ value | gbp }}</span>`
})
export class CurrencyDisplayComponent {
  @Input() value: number | string | null = 0;
  @Input() cssClass = '';
}
