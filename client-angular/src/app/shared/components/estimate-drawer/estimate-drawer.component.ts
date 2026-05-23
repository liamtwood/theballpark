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
      <div class="bp-est-d-head">
        <div>
          <div class="bp-drawer-label">Project</div>
          <div class="bp-est-d-title">Estimate</div>
        </div>
        <button type="button" class="bp-icon-btn" title="Close" (click)="close()">
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
    .bp-est-d-head { display: flex; align-items: flex-start; justify-content: space-between;
      padding: 16px 18px; border-bottom: 0.5px solid var(--color-border); }
    .bp-est-d-title { font-family: var(--font-display); font-size: var(--text-xl);
      color: var(--color-text-primary); margin-top: 2px; }
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
