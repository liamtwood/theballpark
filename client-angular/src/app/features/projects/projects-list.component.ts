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

@Component({
  selector: 'app-projects-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterModule, LucideAngularModule,
    CardModule, ConfirmDialogModule, ToastModule,
    ImageUploadPanelComponent,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <div class="bp-projects-page">
      <div class="bp-projects-inner">

        <!-- v1.66aw — Current / Completed driven by the hero tabs. The
             "+ New" dashed tile sits in the Current grid only. -->
        <div class="bp-project-grid bp-active-grid" *ngIf="activeTab === 'current'">
          <ng-container *ngFor="let p of activeProjects">
            <ng-container *ngTemplateOutlet="cardTpl; context: { $implicit: p }"></ng-container>
          </ng-container>
          <button type="button" class="bp-new-tile"
                  (click)="openNewProject()"
                  [attr.aria-label]="'Create new ' + projectLabel.toLowerCase()">
            <lucide-icon name="plus" [size]="38" class="bp-new-tile-icon"></lucide-icon>
            <span class="bp-new-tile-label">New {{ projectLabel }}</span>
          </button>
        </div>

        <div class="bp-project-grid" *ngIf="activeTab === 'completed'">
          <ng-container *ngFor="let p of completedProjects">
            <ng-container *ngTemplateOutlet="cardTpl; context: { $implicit: p }"></ng-container>
          </ng-container>
          <div *ngIf="completedProjects.length === 0" class="bp-empty">
            No completed {{ projectLabel.toLowerCase() }}s yet.
          </div>
        </div>

      </div>
    </div>

    <!-- Shared project card — reused by Active + Completed grids. -->
    <ng-template #cardTpl let-p>
      <div class="bp-project-card-wrap"
           [class.bp-project-card-wrap--menu-open]="openMenuProjectId === p.id">
        <p-card styleClass="bp-project-card" [routerLink]="['/projects', p.id]">
          <ng-template pTemplate="header">
            <div class="bp-card-header"
              [style.background-image]="p.cover_image_url ? 'url(' + p.cover_image_url + ')' : null"
              [class.bp-card-header-active]="!p.cover_image_url && projectStatus(p).key !== 'draft'"
              [class.bp-card-header-draft]="!p.cover_image_url && projectStatus(p).key === 'draft'">
              <!-- p0031: notification badge top-right, only when the
                   project has action-needed items (>0). -->
              <span *ngIf="actionNeeded(p) > 0" class="bp-card-notif">
                <lucide-icon name="message-circle" [size]="12"></lucide-icon>
                {{ actionNeeded(p) }} New
              </span>
              <span *ngIf="p.client_name" class="bp-card-client-chip">{{ p.client_name }}</span>
              <img *ngIf="p.client_logo_url" [src]="p.client_logo_url" class="bp-card-logo" alt="client logo"/>
            </div>
          </ng-template>
          <div class="bp-card-content">
            <!-- p0031: REF chip above the name (no fallback when null). -->
            <span *ngIf="p.ref" class="bp-card-ref-chip">{{ p.ref }}</span>
            <div class="bp-card-name-row">
              <div class="bp-card-name">{{ p.event_name || p.name }}</div>
              <button type="button" class="bp-card-menu-btn"
                      (click)="toggleMenu($event, p)"
                      title="More actions">⋯</button>
            </div>
            <!-- Status pill below the title (codelist colour). -->
            <span class="bp-card-status" [style.background-color]="projectStatus(p).color">
              {{ projectStatus(p).label }}
            </span>
            <!-- Suppliers count (left) + relative time (right). -->
            <div class="bp-card-stats">
              <span>{{ supplierCount(p) }} Suppliers</span>
              <span>{{ relativeTime(p.updated_at) }}</span>
            </div>
            <!-- Headline "Ballpark" estimate — live client total in the
                 configured currency, suffixed with the product term, painted
                 in the rainbow gradient (--grad-tab). -->
            <div class="bp-card-total-row">
              <span class="bp-card-total">{{ (p.total_client_cost || 0) | currency:currencyCode:'symbol':'1.0-0' }} Ballpark</span>
            </div>
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
      /* Horizontal pad mirrors the hero (.bp-hero uses --section-pad) so the
         body content box equals the hero content box — a prerequisite for
         pixel-aligning the cards to the separator/title. v1.66bg */
      padding: 24px var(--section-pad) 48px;
    }
    .bp-projects-inner {
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    /* v1.66bg — when the hero is left-aligned, anchor the first project card
       to the separator's LEFT edge (matching the title/sub/tabs). The inner's
       100% equals the hero content box (full − 2·--section-pad), so the same
       gap formula used by the hero title lands the card at the identical x. */
    :host-context([data-hero-align="left"]) .bp-projects-inner {
      max-width: none;
      margin: 0;
      padding-left: calc((100% - var(--hero-sep-width, 100%)) / 2);
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
    .bp-dash-card--collapsible .bp-project-grid { padding: 0 18px 16px; margin: 0; }

    .bp-section-header {
      display: flex; align-items: center; gap: 8px;
      justify-content: flex-start;
      padding-bottom: 10px;
      margin: 0 -18px 14px;
      padding-left: 18px;
      padding-right: 18px;
      border-bottom: var(--border-hairline);
    }
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

    /* ── PROJECT CARD GRID ── */
    .bp-project-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:16px; margin-bottom:8px; }
    .bp-project-card-wrap { display:block; position:relative; }
    .bp-project-card-wrap--menu-open { z-index:30; }
    /* v1.66bh — event cards are more rounded (20px) and taller; the radius
       is shared with the cover header below so the top corners stay flush. */
    :host ::ng-deep .bp-project-card.p-card {
      border: var(--border-hairline) !important;
      border-radius: 20px !important;
      box-shadow: var(--shadow-xs) !important;
      overflow: visible !important;
      margin: 0; cursor: pointer; position: relative;
      transition: var(--card-hover-transition);   /* card hover standard */
    }
    /* References the global card-hover tokens (styles.css) so the event cards
       lift identically to every other interactive card. !important is needed
       to beat PrimeNG's p-card base styles. */
    :host ::ng-deep .bp-project-card-wrap:hover .bp-project-card.p-card {
      border-color: var(--card-hover-border) !important;
      box-shadow: var(--card-hover-shadow) !important;
      transform: var(--card-hover-transform);
    }
    :host ::ng-deep .bp-project-card .p-card-body,
    :host ::ng-deep .bp-project-card .p-card-content,
    :host ::ng-deep .bp-project-card .p-card-header { padding:0 !important; }
    .bp-card-header {
      height:260px; position:relative;
      display:flex; align-items:flex-end; justify-content:space-between;
      padding:8px 10px;
      background-size:cover; background-position:center;
      border-top-left-radius: 20px;
      border-top-right-radius: 20px;
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
    /* p0031: notification badge — message-circle + count + "New", a
       gradient action→accent pill top-right of the cover. */
    .bp-card-notif {
      position:absolute; top:8px; right:8px;
      display:inline-flex; align-items:center; gap:4px;
      padding:4px 10px; border-radius: var(--radius-pill);
      background: linear-gradient(90deg, var(--color-action-text), var(--theme-accent));
      color:#fff; font-size:11px; font-weight:600;
      font-family: var(--font-body); box-shadow: var(--shadow-xs);
    }
    .bp-card-logo { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); max-width:70%; max-height:70%; object-fit:contain; pointer-events:none; }
    .bp-card-content { padding:14px 16px 16px; position: relative; display:flex; flex-direction:column; gap:8px; }
    .bp-card-name-row { display:flex; align-items:flex-start; gap:6px; }
    .bp-card-name { font-size:16px; font-weight:600; color:var(--color-text-primary); flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    /* p0031: REF eyebrow chip above the name (inbox Ref XX-NNN style). */
    .bp-card-ref-chip {
      display:inline-flex; align-self:flex-start; padding:2px 9px;
      border-radius: var(--radius-pill);
      background:var(--theme-soft); color:var(--theme-accent);
      font-size:10px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase;
      font-family: var(--font-body);
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
    /* p0031: status pill below the title (codelist colour, white text). */
    .bp-card-status {
      display:inline-flex; align-self:flex-start;
      padding:4px 12px; border-radius: var(--radius-pill);
      font-size:11px; font-weight:600; color:#fff; font-family: var(--font-body);
    }
    /* Suppliers (left) + relative time (right). */
    .bp-card-stats {
      display:flex; align-items:center; justify-content:space-between;
      font-size:13px; color:var(--color-text-muted); font-family: var(--font-body);
    }
    /* Headline "Ballpark" estimate — pink-500 -> green-500 action gradient
       (--grad-accent), weight 400, ~30px (text-3xl). Matches the customer's
       Projects.tsx reference; the same gradient used for primary buttons. */
    .bp-card-total-row { display:flex; align-items:baseline; gap:8px; margin-top:2px; }
    .bp-card-total {
      font-size:30px; font-weight:400; line-height:1; font-family: var(--font-body);
      background: var(--grad-accent);
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent; color: transparent;
    }
    .bp-card-total-label { font-size:12px; color:var(--color-text-muted); font-weight:500; }

    /* p0031: "+ New" dashed tile — last item in the Active grid. Grid
       stretch matches it to the card height; min-height covers the
       empty-grid case. */
    .bp-new-tile {
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:10px; min-height:400px;
      border:2px dashed var(--color-border); border-radius: 20px;
      background: transparent; cursor:pointer;
      color:var(--color-text-muted); font-family: var(--font-body);
      transition: var(--card-hover-transition), color 0.3s ease, background 0.3s ease;
    }
    /* Lift + shadow + border from the central card-hover tokens, plus the
       tile's own fill-on-hover identity. */
    .bp-new-tile:hover {
      transform: var(--card-hover-transform);
      box-shadow: var(--card-hover-shadow);
      border-color: var(--card-hover-border);
      color: var(--theme-accent);
      background: var(--theme-soft);
    }
    .bp-new-tile-icon { color: inherit; }
    .bp-new-tile-label { font-size:14px; font-weight:600; }
  `],
})
export class ProjectsListComponent implements OnInit, OnDestroy {
  loading = true;
  projects: Project[] = [];
  activeProjects: Project[] = [];      // Current bucket (Draft + Active)
  completedProjects: Project[] = [];   // Completed bucket (the rest)
  activeTab: 'current' | 'completed' = 'current';   // v1.66aw — hero filter tab
  projectLabel = 'Event';
  /** id of the project whose "..." dropdown is open ('' = none). */
  openMenuProjectId = '';
  uploadPanelProjectId = '';
  completedOpen = false;
  private sub?: Subscription;

  /** Financial defaults — headline currency for the card "Ballpark" total
      (ISO 4217 code from the active profile). Drives the Angular currency
      pipe in the template. */
  get currencyCode(): string { return this.configService.currency; }

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

  /** Push the /projects hero eyebrow. Hero colour is applied globally by
      the AppShell (p0032); the title is the org-name fallback. */
  private pushHero() {
    // v1.66aw — Current / Completed filter tabs in the hero band. They
    // don't navigate: onTabClick switches the in-page filter and
    // activeTabPath drives the active state. Title + subtitle still come
    // from route data (Events + the route subtitle).
    this.shellCtx.set({
      tabs: [
        { label: 'Current',   path: 'current' },
        { label: 'Completed', path: 'completed' },
      ],
      activeTabPath: this.activeTab,
      onTabClick: (tab) => {
        this.activeTab = tab.path === 'completed' ? 'completed' : 'current';
        this.pushHero();          // refresh activeTabPath
        this.cdr.detectChanges();
      },
    });
  }

  loadProjects() {
    this.projectService.getAll().subscribe({
      next: projects => {
        this.projects = projects || [];
        // v1.66aw — Current = Draft + Active; Completed = everything else.
        this.activeProjects = this.projects.filter(p =>
          ['draft', 'active'].includes(this.projectStatus(p).key));
        this.completedProjects = this.projects.filter(p =>
          !['draft', 'active'].includes(this.projectStatus(p).key));
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

  /** p0031: unread / action-needed item count for the cover badge.
      No field on the project list payload today — plumbed as a computed
      property defaulting to 0, so the badge stays hidden until the
      backend supplies it (no model change per the prompt). */
  actionNeeded(p: Project): number {
    return (p as any).action_needed_count ?? 0;
  }

  /** p0031 / v1.66j: distinct suppliers with items added to the project.
      Computed live by the projects list endpoint. */
  supplierCount(p: Project): number {
    return p.supplier_count ?? 0;
  }

  /** p0031: coarse relative time (date-fns isn't installed). Reads
      updated_at — "Today" / "3 Days Ago" / "5 Months Ago". */
  relativeTime(dateStr?: string): string {
    if (!dateStr) return '';
    const then = new Date(dateStr).getTime();
    if (isNaN(then)) return '';
    const days = Math.floor(Math.max(0, Date.now() - then) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days} Days Ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return months === 1 ? '1 Month Ago' : `${months} Months Ago`;
    const years = Math.floor(days / 365);
    return years === 1 ? '1 Year Ago' : `${years} Years Ago`;
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
}
