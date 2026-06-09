import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarModule } from 'primeng/sidebar';
import { LucideAngularModule } from 'lucide-angular';
import { Subscription, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { EstimateDrawerService } from '../../../core/services/estimate-drawer.service';
import { ProjectService } from '../../../core/services/project.service';
import { Project } from '../../../models';
import { EstimateComponent } from '../../../features/projects/pages/project-detail/tabs/estimate/estimate.component';

/**
 * ⚠️ DEPRECATED SURFACE (v1.67). The canonical destination for the
 * project Estimate is now the /projects/:id/estimate PAGE
 * (EstimatePageComponent), which mounts the same read-only
 * <app-estimate> inside the card chrome. This drawer stays mounted only
 * for surfaces that still open it via EstimateDrawerService.open();
 * full removal is a follow-up commit.
 *
 * v1.64 — single shared drawer that surfaces the project Estimate
 * (the financial summary: category rows + subtotal / contingency /
 * margin / VAT / client total / budget bar). Mounted once globally
 * in app-shell; opened from every surface via
 * EstimateDrawerService.open(projectId).
 *
 * Wraps the existing EstimateComponent — the @Input() projectId
 * overrides the route param so the same view works inside this drawer
 * regardless of where it is opened from.
 *
 * v1.65cp — header uses the shared .bp-drawer chrome (light-theme
 * parchment fill via global p-sidebar-header override) and the same
 * .bp-drawer-header-row / .bp-drawer-label / .bp-drawer-title /
 * .bp-drawer-ref-chip primitives as the Event drawer, so the two
 * drawers' headers read as one family.
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
               styleClass="bp-drawer"
               [showCloseIcon]="false">
      <ng-template pTemplate="header">
        <div class="bp-drawer-header-row">
          <div class="bp-drawer-header">
            <span class="bp-drawer-label">
              PROJECT
              <span *ngIf="project?.ref" class="bp-drawer-ref-chip">{{ project?.ref }}</span>
            </span>
            <div class="bp-drawer-title">Estimate</div>
          </div>
          <button class="bp-icon-btn" (click)="close()" title="Close">
            <lucide-icon name="x" [size]="16"></lucide-icon>
          </button>
        </div>
      </ng-template>
      <div class="bp-est-d-body">
        <app-estimate *ngIf="visible && pid" [projectId]="pid"></app-estimate>
      </div>
    </p-sidebar>
  `,
  styles: [`
    /* v1.65cp — body padding is the only scoped style; everything else
       (header bg, padding, divider) comes from the global .bp-drawer
       rules in styles.css. The embedded EstimateComponent owns its
       own .bp-page wrapper. */
    .bp-est-d-body { padding: 0 0 20px; }
  `]
})
export class EstimateDrawerComponent implements OnInit, OnDestroy {
  visible = false;
  pid = '';
  /** v1.65cp — project row for the header's PROJECT chip. Fetched
      lazily whenever the drawer opens for a new pid. */
  project: Project | null = null;

  private sub?: Subscription;

  constructor(
    private svc: EstimateDrawerService,
    private projSvc: ProjectService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sub = this.svc.projectId$.subscribe(id => {
      this.pid = id || '';
      this.visible = !!id;
      if (id) {
        this.projSvc.getById(id)
          .pipe(catchError(() => of(null)))
          .subscribe(p => {
            this.project = p;
            this.cdr.markForCheck();
          });
      } else {
        this.project = null;
      }
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  onVisibleChange(open: boolean): void { if (!open) this.close(); }
  close(): void { this.svc.close(); }
}
