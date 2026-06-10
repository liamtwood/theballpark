import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * inbox-v2 — shared, reusable inbox shell (p0037, hero layer only).
 *
 * Mirrors v1's pattern: this is the REAL component; the route wrapper
 * `features/messages/inbox-v2.component.ts` mounts it. The hero itself is
 * rendered globally by app-shell from route data (title / subtitle / back /
 * align), overridable via page-settings (HeroSettingsService) — so there is
 * nothing local to render yet below the padded wrapper.
 *
 * The full reusable contract (scope + chrome flags + events) is declared now
 * so future embeds (project page, item card) compile against the final shape;
 * the flags don't gate anything until later layers (search-row, filter-drawer,
 * tree-rail, thread-pane) are added in subsequent prompts.
 *
 * Living spec: features/messages/inbox-v2.schematic.yaml
 */
@Component({
  selector: 'app-messages-inbox-v2',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="bp-inbox-v2" [class.bp-inbox-v2--compact]="compact">
      <!-- hero rendered by app-shell via route data when showHero=true,
           nothing local until we add chrome layers -->
    </div>
  `,
  styles: [`
    .bp-inbox-v2 {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }
    .bp-inbox-v2--compact { padding: 12px; }
  `]
})
export class MessagesInboxV2Component {
  // SCOPE
  @Input() scopedToProjectId?: string;
  @Input() scopedToSupplierId?: string;
  @Input() scopedToItemId?: string;
  @Input() viewerRole: 'agency' | 'supplier' = 'agency';

  // CHROME
  @Input() showHero = true;
  @Input() showSearchRow = true;
  @Input() showFilterDrawer = true;
  @Input() showTreeRail = true;
  @Input() compact = false;

  // EVENTS
  @Output() threadSelected = new EventEmitter<string>();
  @Output() messageSent = new EventEmitter<any>();
}
