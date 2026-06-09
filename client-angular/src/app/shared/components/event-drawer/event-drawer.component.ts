import {
  Component, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarModule } from 'primeng/sidebar';
import { Subscription } from 'rxjs';

import {
  EventDrawerService, EventDrawerSection
} from '../../../core/services/event-drawer.service';
import { Project } from '../../../models';
import { ProjectEventFormComponent } from '../project-event-form/project-event-form.component';

/**
 * Event drawer — v1.67.
 *
 * ⚠️ DEPRECATED SURFACE. The canonical destination for editing a
 * project's event facts is now the /projects/:id/details PAGE
 * (ProjectDetailsComponent). This drawer stays mounted only because
 * other surfaces (overview event strip, marketplace project-summary
 * panel kebabs) still open it via EventDrawerService.open(). Full
 * removal is a follow-up commit once those callers move to the tab.
 *
 * v1.67 reduced this from a 950-line bespoke form to a thin SHELL.
 * All field markup + save logic (snapshot/restore/save, sectionFields
 * whitelist, status code→id resolution, client find-or-create, codelist
 * hydration) was extracted to the shared <app-project-event-form>, which
 * the new /details page consumes at card density and this drawer consumes
 * at drawer density — ONE source of truth, zero duplication.
 *
 * The shell owns only: the sidebar chrome (PROJECT ref-chip header +
 * "last edited" footer) and the service plumbing. It feeds the form a
 * projectId, relays the form's (projectLoaded) into its own header/footer
 * state, and relays (saved) to EventDrawerService.markSaved so existing
 * subscribers refresh.
 *
 * Opened from any surface via EventDrawerService.open(projectId, section?).
 */
@Component({
  selector: 'app-event-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, SidebarModule, ProjectEventFormComponent],
  template: `
    <p-sidebar [(visible)]="visible" position="right"
               styleClass="bp-drawer" [style]="{width:'480px'}"
               [showCloseIcon]="false"
               (visibleChange)="onVisibleChange($event)">

      <ng-template pTemplate="header">
        <div class="bp-drawer-header-row">
          <div class="bp-drawer-header">
            <span class="bp-drawer-label">
              PROJECT
              <span *ngIf="project?.ref" class="bp-drawer-ref-chip">{{ project?.ref }}</span>
            </span>
            <div class="bp-drawer-title">Event details</div>
          </div>
          <button class="bp-icon-btn" (click)="close()" title="Close">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </ng-template>

      <div class="bp-drawer-body">
        <app-project-event-form *ngIf="pid"
          [projectId]="pid" density="drawer"
          [initialEditSection]="pendingSection"
          (projectLoaded)="onProjectLoaded($event)"
          (saved)="onSaved($event)"></app-project-event-form>
      </div>

      <ng-template pTemplate="footer">
        <div class="bp-evd-footer">
          Last edited {{ lastEditedLabel }}
        </div>
      </ng-template>
    </p-sidebar>
  `,
  styles: [`
    :host { font-family: var(--font-body); }
    .bp-evd-footer {
      font-size: 11px;
      color: var(--color-text-muted);
      text-align: center;
      width: 100%;
    }
  `]
})
export class EventDrawerComponent implements OnInit, OnDestroy {
  visible = false;
  pid = '';
  /** Only the sections the form actually renders are deep-linkable; a
      legacy 'financials'/'brief' request degrades to no auto-edit. */
  pendingSection?: 'details' | 'type' | 'logistics';
  /** Header ref chip + footer "last edited" — populated from the form's
      (projectLoaded) / (saved), so the drawer never fetches separately. */
  project: Project | null = null;

  private sub?: Subscription;

  constructor(
    private svc: EventDrawerService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sub = this.svc.request$.subscribe(req => {
      if (!req) {
        this.visible = false;
        this.pid = '';
        this.project = null;
        this.pendingSection = undefined;
        this.cdr.markForCheck();
        return;
      }
      this.pendingSection = this.narrowSection(req.section);
      this.pid = req.projectId;
      this.project = null;
      this.visible = true;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  private narrowSection(s?: EventDrawerSection): 'details' | 'type' | 'logistics' | undefined {
    return (s === 'details' || s === 'type' || s === 'logistics') ? s : undefined;
  }

  /** PrimeNG sidebar's two-way visible binding — only react on close,
      since we control open via the service. */
  onVisibleChange(open: boolean): void { if (!open) this.close(); }

  close(): void {
    this.visible = false;
    this.pid = '';
    this.svc.close();
  }

  onProjectLoaded(p: Project): void {
    this.project = p;
    this.cdr.markForCheck();
  }

  onSaved(p: Project): void {
    this.project = p;
    this.svc.markSaved(p);
    this.cdr.markForCheck();
  }

  get lastEditedLabel(): string {
    const iso = (this.project as any)?.updated_at;
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const diffMs = Date.now() - d.getTime();
    const m = Math.floor(diffMs / 60000);
    const h = Math.floor(m / 60);
    const days = Math.floor(h / 24);
    if (m < 1)   return 'just now';
    if (m < 60)  return m + ' min ago';
    if (h < 24)  return h + ' hour' + (h === 1 ? '' : 's') + ' ago';
    if (days < 30) return days + ' day' + (days === 1 ? '' : 's') + ' ago';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
