// v1.66e (p0024) — /projects landing page.
//
// Recovers the Active / Inactive / Past project grid + the project-card
// markup, handlers and styles that were stripped from the dashboard
// centre column in p0019 §2 (they lived only in git history at
// v1.65hP). The card is reused once as a single <ng-template> rather
// than duplicated across the Active + Inactive grids (per
// WORKING_STANDARDS "Extract Before Duplicate"). Hero is pushed via
// ShellContextService so the p0023 drawer customisation (Title /
// Subtitle / Hero color) applies here too.

import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Subscription } from 'rxjs';

import { ProjectService } from '../../core/services/project.service';
import { CodelistService } from '../../core/services/codelist.service';
import { EstimateDrawerService } from '../../core/services/estimate-drawer.service';
import { CreateProjectService } from '../../core/services/create-project.service';
import { ConfigService } from '../../core/services/config.service';
import { ShellContextService } from '../../core/services/shell-context.service';
import { Project } from '../../models';
import { ImageUploadPanelComponent } from '../../shared/components/image-upload-panel/image-upload-panel.component';
import { EventDatePipe } from '../../shared/pipes/event-date.pipe';
import { CompactCurrencyPipe } from '../../shared/pipes/compact-currency.pipe';

@Component({
  selector: 'app-projects-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterModule, LucideAngularModule,
    CardModule, ConfirmDialogModule, ToastModule,
    ImageUploadPanelComponent, EventDatePipe, CompactCurrencyPipe,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <div class="bp-projects-page">
      <div class="bp-projects-inner">

        <!-- ACTIVE — expanded, project-card grid -->
        <div class="bp-dash-card">
          <div class="bp-section-header">
            <lucide-icon name="folder-open" [size]="13" class="bp-section-icon"></lucide-icon>
            <span class="bp-section-title">Active {{ projectLabel }}s</span>
            <button type="button" class="bp-section-new-btn" (click)="openNewProject()">
              + New {{ projectLabel }}
            </button>
          </div>
          <p *ngIf="!loading && activeProjects.length === 0" class="bp-empty">
            No active {{ projectLabel.toLowerCase() }}s yet.
          </p>
          <div class="bp-project-grid">
            <ng-container *ngFor="let p of activeProjects">
              <ng-container *ngTemplateOutlet="cardTpl; context: { $implicit: p }"></ng-container>
            </ng-container>
          </div>
        </div>

        <!-- INACTIVE — collapsed by default, same card grid -->
        <div class="bp-dash-card bp-dash-card--collapsible"
             *ngIf="completedProjects.length > 0"
             [class.bp-dash-card--open]="inactiveOpen">
          <button type="button" class="bp-section-header bp-section-header--toggle"
                  (click)="inactiveOpen = !inactiveOpen">
            <lucide-icon name="folder-open" [size]="13" class="bp-section-icon"></lucide-icon>
            <span class="bp-section-title">Inactive {{ projectLabel }}s</span>
            <span class="bp-section-count">{{ completedProjects.length }}</span>
            <lucide-icon class="bp-section-chev"
                         [name]="inactiveOpen ? 'chevron-up' : 'chevron-down'"
                         [size]="14"></lucide-icon>
          </button>
          <div *ngIf="inactiveOpen" class="bp-project-grid">
            <ng-container *ngFor="let p of completedProjects">
              <ng-container *ngTemplateOutlet="cardTpl; context: { $implicit: p }"></ng-container>
            </ng-container>
          </div>
        </div>

        <!-- PAST — collapsed by default, compact carousel -->
        <div class="bp-dash-card bp-dash-card--collapsible"
             *ngIf="completedProjects.length > 0"
             [class.bp-dash-card--open]="pastOpen">
          <button type="button" class="bp-section-header bp-section-header--toggle"
                  (click)="pastOpen = !pastOpen">
            <lucide-icon name="folder-open" [size]="13" class="bp-section-icon"></lucide-icon>
            <span class="bp-section-title">Past {{ projectLabel }}s</span>
            <span class="bp-section-count">{{ completedProjects.length }}</span>
            <lucide-icon class="bp-section-chev"
                         [name]="pastOpen ? 'chevron-up' : 'chevron-down'"
                         [size]="14"></lucide-icon>
          </button>
          <div *ngIf="pastOpen" class="bp-past-carousel">
            <a *ngFor="let p of completedProjects.slice(0, 10); let i = index"
               class="bp-past-card"
               [class.bp-past-card--fade]="i === 9 && completedProjects.length > 10"
               [routerLink]="['/projects', p.id]">
              <div class="bp-past-cover"
                   [style.background-image]="p.cover_image_url ? 'url(' + p.cover_image_url + ')' : null"
                   [class.bp-past-cover--empty]="!p.cover_image_url">
                <span class="bp-past-year">{{ extractYear(p.event_date) || '—' }}</span>
                <span class="bp-past-status-pill">Closed</span>
              </div>
              <div class="bp-past-body">
                <div class="bp-past-name">{{ p.event_name || p.name }}</div>
                <div class="bp-past-sub">
                  <ng-container *ngIf="p.client_name">{{ p.client_name }} · </ng-container>
                  Est. {{ p.total_client_cost | compactCurrency }}
                </div>
              </div>
            </a>
          </div>
        </div>

      </div>
    </div>

    <!-- Shared project card — reused by Active + Inactive grids. -->
    <ng-template #cardTpl let-p>
      <div class="bp-project-card-wrap"
           [class.bp-project-card-wrap--menu-open]="openMenuProjectId === p.id">
        <p-card styleClass="bp-project-card" [routerLink]="['/projects', p.id]">
          <ng-template pTemplate="header">
            <div class="bp-card-header"
              [style.background-image]="p.cover_image_url ? 'url(' + p.cover_image_url + ')' : null"
              [class.bp-card-header-active]="!p.cover_image_url && projectStatus(p).key !== 'draft'"
              [class.bp-card-header-draft]="!p.cover_image_url && projectStatus(p).key === 'draft'">
              <span class="bp-card-status-pill"
                    [style.background-color]="projectStatus(p).color">
                {{ projectStatus(p).label }}
              </span>
              <span *ngIf="p.client_name" class="bp-card-client-chip">{{ p.client_name }}</span>
              <img *ngIf="p.client_logo_url" [src]="p.client_logo_url" class="bp-card-logo" alt="client logo"/>
            </div>
          </ng-template>
          <div class="bp-card-content">
            <div class="bp-card-name-row">
              <div class="bp-card-name">
                <span *ngIf="p.ref" class="bp-card-ref-chip">{{ p.ref }}</span>
                {{ p.event_name || p.name }}
              </div>
              <button type="button" class="bp-card-menu-btn"
                      (click)="toggleMenu($event, p)"
                      title="More actions">⋯</button>
            </div>
            <div class="bp-card-meta">{{ p.event_date | eventDate }}</div>
            <div class="bp-card-cost">Est. {{ p.total_client_cost | compactCurrency }}</div>
            <div *ngIf="openMenuProjectId === p.id"
                 class="bp-card-menu"
                 (click)="$event.stopPropagation(); $event.preventDefault()">
              <button type="button" class="bp-card-menu-item"
                      (click)="onMenuAction('estimate', p, $event)">Estimate</button>
              <div class="bp-card-menu-sep"></div>
              <button type="button" class="bp-card-menu-item"
                      (click)="onMenuAction('edit-image', p, $event)">Edit image</button>
              <button type="button" class="bp-card-menu-item"
                      (click)="onMenuAction('copy', p, $event)">Copy</button>
              <div class="bp-card-menu-sep"></div>
              <button type="button" class="bp-card-menu-item bp-card-menu-item--danger"
                      (click)="onMenuAction('delete', p, $event)">Delete</button>
            </div>
          </div>
        </p-card>
        <app-image-upload-panel *ngIf="uploadPanelProjectId === p.id"
          [projectId]="p.id"
          [existingCoverUrl]="p.cover_image_url || ''"
          [existingLogoUrl]="p.client_logo_url || ''"
          [existingCardColor]="p.card_color || ''"
          (imagesUpdated)="onImagesUpdated(p, $event)"
          (closed)="uploadPanelProjectId = ''"></app-image-upload-panel>
      </div>
    </ng-template>

    <p-confirmDialog styleClass="bp-confirm"></p-confirmDialog>
    <p-toast></p-toast>
  `,
  styles: [`
    /* Page — parchment ground, centred single column (the dashboard is
       3-col; /projects is a vertical stack of the three sections). */
    .bp-projects-page {
      background: var(--theme-bg);
      min-height: calc(100vh - var(--nav-height));
      padding: 24px 20px 48px;
    }
    .bp-projects-inner {
      max-width: 960px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Card shell + section header (recovered from the pre-p0019
       dashboard; shared primitives copied so this component is
       self-contained). */
    .bp-dash-card {
      background: var(--color-surface);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-xs);
      padding: 16px 18px;
    }
    .bp-dash-card--collapsible { padding: 0; }
    .bp-dash-card--collapsible .bp-section-header { padding: 14px 18px; margin: 0; }
    .bp-dash-card--collapsible .bp-project-grid,
    .bp-dash-card--collapsible .bp-past-carousel { padding: 0 18px 16px; margin: 0; }

    .bp-section-header {
      display: flex; align-items: center; gap: 8px;
      justify-content: flex-start;
      padding-bottom: 10px;
      margin: 0 -18px 14px;
      padding-left: 18px;
      padding-right: 18px;
      border-bottom: var(--border-hairline);
    }
    .bp-section-header > .bp-section-new-btn,
    .bp-section-header > .bp-section-chev { margin-left: auto; }
    .bp-section-title { font-size:11px; font-weight:500; color:var(--theme-accent); text-transform:uppercase; letter-spacing:0.06em; }
    .bp-section-icon { color: var(--theme-accent); flex-shrink: 0; }
    .bp-section-count {
      font-size: 10px; font-weight: 600; letter-spacing: 0.04em;
      padding: 1px 7px; border-radius: var(--radius-pill);
      background: var(--theme-soft); color: var(--theme-accent);
    }
    .bp-section-chev { margin-left: auto; color: var(--color-text-muted); }
    .bp-section-header--toggle {
      width: 100%; background: none; border: none; cursor: pointer;
      font-family: var(--font-body); text-align: left;
    }
    .bp-section-header--toggle:hover .bp-section-title { color: var(--color-text-primary); }
    .bp-dash-card--collapsible .bp-section-header {
      margin: 0; padding: 14px 18px; border-bottom: var(--border-hairline);
    }
    .bp-dash-card--collapsible:not(.bp-dash-card--open) .bp-section-header {
      border-bottom: none;
    }

    /* "+ New" primary pill (recovered). */
    .bp-section-new-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 18px;
      font-size: 12px; font-weight: 600; font-family: var(--font-body);
      color: var(--color-surface); background: var(--theme-accent);
      border: none; border-radius: var(--radius-pill);
      cursor: pointer; box-shadow: var(--shadow-xs);
      transition: box-shadow 150ms ease, transform 150ms ease, filter 150ms ease;
    }
    .bp-section-new-btn:hover { box-shadow: var(--shadow-sm); transform: translateY(-1px); filter: brightness(1.05); }
    .bp-section-new-btn:active { transform: scale(0.98); }

    .bp-empty { font-size:var(--text-sm); color:var(--color-text-muted); padding:16px 0; }

    /* ── PROJECT CARD GRID (recovered verbatim from pre-p0019) ── */
    .bp-project-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; margin-bottom:8px; }
    .bp-project-card-wrap { display:block; position:relative; }
    .bp-project-card-wrap--menu-open { z-index:30; }
    :host ::ng-deep .bp-project-card.p-card {
      border: var(--border-hairline) !important;
      border-radius: var(--radius-card) !important;
      box-shadow: var(--shadow-xs) !important;
      overflow: visible !important;
      margin: 0; cursor: pointer; position: relative;
      transition: box-shadow 150ms ease, border-color 150ms ease, transform 150ms ease;
    }
    :host ::ng-deep .bp-project-card-wrap:hover .bp-project-card.p-card {
      border: var(--border-hairline-strong) !important;
      box-shadow: var(--shadow-sm) !important;
      transform: translateY(-1px);
    }
    :host ::ng-deep .bp-project-card .p-card-body,
    :host ::ng-deep .bp-project-card .p-card-content,
    :host ::ng-deep .bp-project-card .p-card-header { padding:0 !important; }
    .bp-card-header {
      height:110px; position:relative;
      display:flex; align-items:flex-end; justify-content:space-between;
      padding:8px 10px;
      background-size:cover; background-position:center;
      border-top-left-radius: var(--radius-card);
      border-top-right-radius: var(--radius-card);
      overflow:hidden;
    }
    .bp-card-header-active { background-image:linear-gradient(160deg,#1e3a5f,#2563eb); }
    .bp-card-header-draft  { background-image:linear-gradient(160deg,#374151,#4B5563); }
    .bp-card-client-chip {
      position:absolute; bottom:8px; left:8px;
      background:rgba(255,255,255,0.92); color:var(--color-text-primary);
      border-radius: var(--radius-pill); padding:3px 10px;
      font-size:10px; font-weight:500; font-family: var(--font-body);
    }
    .bp-card-status-pill {
      position:absolute; top:8px; right:8px;
      font-size:10px; font-weight:500; padding:3px 10px;
      border-radius: var(--radius-pill);
      color:var(--color-surface); background:var(--color-text-secondary);
      font-family: var(--font-body); letter-spacing: 0.01em;
    }
    .bp-card-logo { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); max-width:70%; max-height:70%; object-fit:contain; pointer-events:none; }
    .bp-card-content { padding:12px 14px 14px; position: relative; }
    .bp-card-name-row { display:flex; align-items:flex-start; gap:6px; margin-bottom:4px; }
    .bp-card-name { font-size:13px; font-weight:600; color:var(--color-text-primary); flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .bp-card-ref-chip {
      display:inline-block; margin-right:6px; padding:1px 7px; border-radius:999px;
      background:var(--theme-bg); border:0.5px solid var(--color-border);
      font-size:10px; font-weight:500; letter-spacing:0.04em;
      color:var(--color-text-secondary); vertical-align:middle;
    }
    .bp-card-menu-btn {
      width:24px; height:24px; border-radius:50%;
      border:none; background:none; color:var(--color-text-muted);
      cursor:pointer; flex-shrink:0; font-size:16px; line-height:1;
      display:flex; align-items:center; justify-content:center;
      transition: background 0.15s, color 0.15s;
    }
    .bp-card-menu-btn:hover { background:var(--theme-bg); color:var(--theme-accent); }
    .bp-card-menu {
      position:absolute; top:32px; right:12px; width:150px;
      background:var(--color-surface); border: var(--border-hairline);
      border-radius: var(--radius-button); padding:4px 0;
      z-index:50; box-shadow: var(--shadow-md);
    }
    .bp-card-menu-item {
      display:block; width:100%; padding:8px 12px;
      font-size:12px; font-weight:500; text-align:left;
      background:none; border:none; cursor:pointer;
      color:var(--color-text-primary); font-family: var(--font-body);
      transition: background 0.1s;
    }
    .bp-card-menu-item:hover { background:var(--theme-bg); }
    .bp-card-menu-item--danger { color:var(--color-danger); }
    .bp-card-menu-item--danger:hover { background:rgba(225, 29, 72, 0.06); }
    .bp-card-menu-sep { height:0.5px; background:var(--color-border); margin:4px 0; }
    .bp-card-meta { font-size:11px; color:var(--color-text-muted); margin-bottom:6px; }
    .bp-card-cost { font-size:13px; font-weight:500; color:var(--color-text-secondary); }

    /* ── PAST EVENTS CAROUSEL (recovered) ── */
    .bp-past-carousel {
      display:flex; gap:8px; overflow-x:auto; padding:0 0 8px;
      scroll-snap-type: x mandatory; scrollbar-width:none; -ms-overflow-style:none;
    }
    .bp-past-carousel::-webkit-scrollbar { display:none; }
    .bp-past-card {
      flex-shrink:0; width:130px; scroll-snap-align:start;
      border: var(--border-hairline); border-radius: var(--radius-card);
      box-shadow: var(--shadow-xs); overflow:hidden;
      background:var(--color-surface); text-decoration:none; color:inherit;
      transition: box-shadow 150ms ease, border-color 150ms ease, transform 150ms ease;
    }
    .bp-past-card:hover { border: var(--border-hairline-strong); box-shadow: var(--shadow-sm); transform: translateY(-1px); }
    .bp-past-card--fade { opacity: 0.6; }
    .bp-past-cover { position:relative; height:72px; background-size:cover; background-position:center; background-color: var(--theme-bg); }
    .bp-past-cover--empty { background-image: linear-gradient(160deg, var(--theme-bg), var(--theme-border)); }
    .bp-past-year {
      position:absolute; bottom:6px; left:8px;
      font-family: var(--font-display); font-size:14px;
      color:var(--color-surface); text-shadow: 0 1px 3px rgba(0,0,0,0.4); letter-spacing: 0.02em;
    }
    .bp-past-status-pill {
      position:absolute; top:6px; right:6px;
      font-size:9px; font-weight:500; padding:2px 8px;
      border-radius: var(--radius-pill); color:var(--color-surface);
      background: var(--color-text-muted); font-family: var(--font-body);
    }
    .bp-past-body { padding:6px 8px 8px; }
    .bp-past-name { font-size:10px; font-weight:500; color:var(--color-text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:2px; }
    .bp-past-sub { font-size:9px; color:var(--color-text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  `],
})
export class ProjectsListComponent implements OnInit, OnDestroy {
  loading = true;
  projects: Project[] = [];
  activeProjects: Project[] = [];
  completedProjects: Project[] = [];
  projectLabel = 'Event';
  /** id of the project whose "..." dropdown is open ('' = none). */
  openMenuProjectId = '';
  uploadPanelProjectId = '';
  inactiveOpen = false;
  pastOpen = false;
  private sub?: Subscription;

  constructor(
    private projectService: ProjectService,
    private codelistSvc: CodelistService,
    private estimateDrawer: EstimateDrawerService,
    private createProjectSvc: CreateProjectService,
    private configService: ConfigService,
    private shellCtx: ShellContextService,
    private confirm: ConfirmationService,
    private msg: MessageService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    // Warm the project_status codelist so card pills resolve immediately.
    this.codelistSvc.getByName('project_status').subscribe(() => this.cdr.detectChanges());

    this.sub = this.configService.config$.subscribe(cfg => {
      this.projectLabel = cfg.projectLabel || 'Event';
      this.pushHero();
      this.cdr.detectChanges();
    });

    this.projectService.refresh$.subscribe(() => this.loadProjects());
    this.loadProjects();
  }

  ngOnDestroy() {
    this.shellCtx.reset();
    this.sub?.unsubscribe();
  }

  /** Push hero context so the AppShell computes the title from
      config.heroTitleMode and applies the heroColor strip treatment —
      same pattern as dashboard / agent, so the p0023 drawer applies. */
  private pushHero() {
    this.shellCtx.set({
      heroColor: this.configService.heroColor,
      heroSub: (this.configService.homePageLabel || 'Projects').toUpperCase(),
      pills: [],
      tabs: [],
    });
  }

  loadProjects() {
    this.projectService.getAll().subscribe({
      next: projects => {
        this.projects = projects || [];
        this.activeProjects = this.projects.filter(p =>
          ['draft', 'active', 'costing'].includes(this.projectStatus(p).key));
        this.completedProjects = this.projects.filter(p =>
          ['completed', 'archived', 'closed', 'cancelled'].includes(this.projectStatus(p).key));
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); },
    });
  }

  /** Codelist-driven status bucketing — single source of truth for the
      filter buckets + the card pill colour/label. */
  projectStatus(p: Project): { key: string; label: string; color: string } {
    const code = (p.status_name || 'draft').toLowerCase();
    const label = this.codelistSvc.getLabel('project_status', code) || 'Draft';
    const meta  = this.codelistSvc.getMeta('project_status', code);
    return { key: code, label, color: meta?.['color'] || '#F59E0B' };
  }

  openNewProject() {
    this.createProjectSvc.open();
  }

  toggleMenu(event: MouseEvent, p: Project) {
    event.stopPropagation();
    event.preventDefault();
    this.openMenuProjectId = this.openMenuProjectId === p.id ? '' : p.id;
    this.cdr.detectChanges();
  }

  @HostListener('document:click')
  onDocumentClick() {
    if (this.openMenuProjectId) {
      this.openMenuProjectId = '';
      this.cdr.detectChanges();
    }
  }

  onMenuAction(action: 'estimate' | 'edit-image' | 'copy' | 'delete', p: Project, event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    this.openMenuProjectId = '';
    if (action === 'estimate') {
      this.estimateDrawer.open(p.id);
    } else if (action === 'edit-image') {
      this.uploadPanelProjectId = p.id;
    } else if (action === 'copy') {
      this.duplicateProject(p);
    } else if (action === 'delete') {
      this.confirmDelete(p);
    }
    this.cdr.detectChanges();
  }

  duplicateProject(p: Project) {
    this.projectService.duplicate(p.id).subscribe({
      next: (created: Project) => {
        this.msg.add({ severity: 'success', summary: 'Project copied', detail: created.name, life: 2500 });
        this.router.navigate(['/projects', created.id, 'brief']);
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Copy failed', detail: 'Could not duplicate the project.', life: 3500 });
      },
    });
  }

  confirmDelete(p: Project) {
    this.confirm.confirm({
      header: `Delete ${p.event_name || p.name}?`,
      message: 'This will permanently remove the project and all its categories, items, and estimates.',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => {
        this.projectService.delete(p.id).subscribe({
          next: () => {
            this.activeProjects    = this.activeProjects.filter(x => x.id !== p.id);
            this.completedProjects = this.completedProjects.filter(x => x.id !== p.id);
            this.msg.add({ severity: 'success', summary: 'Project deleted', life: 2500 });
            this.cdr.detectChanges();
          },
          error: () => {
            this.msg.add({ severity: 'error', summary: 'Delete failed', life: 3500 });
          },
        });
      },
    });
  }

  onImagesUpdated(project: Project, urls: { coverUrl: string; logoUrl: string; cardColor?: string }) {
    project.cover_image_url = urls.coverUrl;
    project.client_logo_url = urls.logoUrl;
    if (urls.cardColor) project.card_color = urls.cardColor;
    this.uploadPanelProjectId = '';
    this.cdr.detectChanges();
  }

  /** Year overlay for the past-events carousel; null → caller shows "—". */
  extractYear(dateStr?: string): string | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return String(d.getFullYear());
  }
}
