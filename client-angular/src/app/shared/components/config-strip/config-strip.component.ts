import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ConfigStripService } from '../../../core/services/config-strip.service';

/**
 * Horizontal bar between the top-nav and the page hero that hosts
 * per-page settings toggles (theme, circle size, view etc).
 *
 * Hidden by default. The cog icon in the top-nav toggles open/closed
 * via ConfigStripService. Each page projects its own controls into
 * the <ng-content> slot.
 *
 * Styling is shared chrome — horizontal row, subtle parchment tint,
 * compact spacing. Per-page toggle widgets (p-selectButton etc) are
 * the projecting page's responsibility.
 */
@Component({
  selector: 'app-config-strip',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bp-config-strip" *ngIf="isOpen">
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .bp-config-strip {
      display: flex; align-items: center; gap: 18px;
      padding: 10px 28px;
      background: var(--color-surface);
      border-bottom: 0.5px solid var(--color-border);
      flex-wrap: wrap;
      font-family: var(--font-body);
      font-size: 12px;
      color: var(--color-text-secondary);
    }
  `]
})
export class ConfigStripComponent implements OnInit, OnDestroy {
  isOpen = false;
  private sub?: Subscription;

  constructor(
    private svc: ConfigStripService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.svc.register();
    this.sub = this.svc.open$.subscribe(open => {
      this.isOpen = open;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.svc.unregister();
  }
}
