import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarModule } from 'primeng/sidebar';
import { LucideAngularModule } from 'lucide-angular';
import { Subscription } from 'rxjs';

import { EstimateDrawerService } from '../../../core/services/estimate-drawer.service';
import { EstimateComponent } from '../../../features/projects/pages/project-detail/tabs/estimate/estimate.component';

/**
 * v1.64 — single shared drawer that surfaces the project Estimate
 * (the financial summary: category rows + subtotal / delivery /
 * contingency / margin / client total / budget bar). Mounted once
 * globally in app-shell; opened from every surface via
 * EstimateDrawerService.open(projectId).
 *
 * Wraps the existing EstimateComponent — the @Input() projectId
 * overrides the route param so the same view works inside this drawer
 * regardless of where it is opened from.
 */
@Component({
  selector: 'app-estimate-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, SidebarModule, LucideAngularModule, EstimateComponent],
  template: `
    <p-sidebar [(visible)]="visible"
               (visibleChange)="onVisibleChange($event)"
               position="right"
               [style]="{ width: '480px' }"
               styleClass="bp-est-drawer"
               [showCloseIcon]="false">
      <!-- v1.65co — header swapped to the .bp-ov-head + .bp-ov-label
           treatment used by EVENT DETAILS / BRIEF / MARKETPLACE /
           ESTIMATE / MESSAGES cards on the Overview. Solid accent
           bar, centred white uppercase label. Close button overlays
           the top-right corner as a white icon button. -->
      <div class="bp-est-d-head bp-ov-head">
        <span class="bp-ov-label">ESTIMATE</span>
        <button type="button" class="bp-est-d-close" title="Close" (click)="close()">
          <lucide-icon name="x" [size]="16"></lucide-icon>
        </button>
      </div>
      <div class="bp-est-d-body">
        <app-estimate *ngIf="visible && pid" [projectId]="pid"></app-estimate>
      </div>
    </p-sidebar>
  `,
  styles: [`
    :host ::ng-deep .bp-est-drawer .p-sidebar-content { padding: 0; }
    /* v1.65co — Header pinned at the top of the drawer; the .bp-ov-head
       global rules paint it solid accent + centred white label. The
       close icon overlays absolutely so the label stays optically
       centred and the bar matches the Overview card heads. */
    .bp-est-d-head.bp-ov-head {
      position: relative;
    }
    .bp-est-d-close {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: var(--color-surface);
      cursor: pointer;
      padding: 4px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-button);
      opacity: 0.85;
      transition: opacity 0.15s, background 0.15s;
    }
    .bp-est-d-close:hover {
      opacity: 1;
      background: rgba(255, 255, 255, 0.15);
    }
    .bp-est-d-body { padding: 0 0 20px; }
    /* the embedded EstimateComponent owns its own .bp-page wrapper */
  `]
})
export class EstimateDrawerComponent implements OnInit, OnDestroy {
  visible = false;
  pid = '';

  private sub?: Subscription;

  constructor(
    private svc: EstimateDrawerService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sub = this.svc.projectId$.subscribe(id => {
      this.pid = id || '';
      this.visible = !!id;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  onVisibleChange(open: boolean): void { if (!open) this.close(); }
  close(): void { this.svc.close(); }
}
