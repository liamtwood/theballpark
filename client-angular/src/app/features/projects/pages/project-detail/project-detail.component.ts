import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, Router, ActivatedRoute } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProjectService } from '../../../../core/services/project.service';
import { ShellContextService } from '../../../../core/services/shell-context.service';
import { Project } from '../../../../models';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    CommonModule, RouterModule, RouterOutlet,
    ToastModule, LoadingSpinnerComponent
  ],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading && !project">
      <div class="bp-page" style="text-align:center;padding:80px 0;">
        <p style="color:var(--color-text-muted);font-size:var(--text-sm);">Project not found.</p>
        <a routerLink="/projects" style="color:var(--theme-accent);font-size:var(--text-sm);margin-top:8px;display:inline-block;">
          ← Back to Projects
        </a>
      </div>
    </ng-container>

    <!-- No hero here — AppShellComponent renders it via ShellContextService -->
    <ng-container *ngIf="!loading && project">
      <router-outlet></router-outlet>
    </ng-container>

    <p-toast></p-toast>
  `,
  styles: []
})
export class ProjectDetailComponent implements OnInit, OnDestroy {
  project: Project | null = null;
  loading = true;
  pid = '';

  // v1.18b: tab bar reads Estimate (formerly Build — same unified
  // compressed-cards-plus-summary component, just renamed):
  //   Event · Brief · Marketplace · Estimate · Messages
  private readonly PROJECT_TABS = [
    { label: 'Event',       path: '' },  // path set dynamically with pid
    { label: 'Brief',       path: '' },
    { label: 'Marketplace', path: '' },
    { label: 'Estimate',    path: '' },
    { label: 'Messages',    path: '' },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projSvc: ProjectService,
    private shellCtx: ShellContextService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.pid = this.route.snapshot.paramMap.get('id') || '';
    this.projSvc.getById(this.pid).subscribe({
      next: p => {
        this.project = p;
        this.pushContext(p);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  ngOnDestroy() {
    // Reset hero when leaving project
    this.shellCtx.reset();
  }

  private pushContext(p: Project) {
    // v1.18b tab bar — Build renamed to Estimate (same component, new
    // user-facing label + slug). /build still works via a redirectTo
    // entry in the route table so existing bookmarks keep landing
    // somewhere sensible.
    //   Marketplace → /marketplace (catalogue-grid in project context)
    //   Estimate    → /estimate    (compressed cards + summary panel)
    // Legacy /supplier (vendor selection) and /estimate-legacy
    // (old standalone summary) are preserved for safety but not in
    // the bar.
    const tabs = [
      { label: 'Event',       path: `/projects/${this.pid}/event` },
      { label: 'Brief',       path: `/projects/${this.pid}/brief` },
      { label: 'Marketplace', path: `/projects/${this.pid}/marketplace` },
      { label: 'Estimate',    path: `/projects/${this.pid}/estimate` },
      { label: 'Messages',    path: `/projects/${this.pid}/messages` },
    ];

    // Pills: client name + venue
    const pills: string[] = [];
    if (p.client_name) pills.push(p.client_name);
    if (p.venue_name)  pills.push(p.venue_name);

    this.shellCtx.set({
      heroTitle:  p.event_name || p.name || 'Untitled',
      heroSub:    '',
      pills,
      tabs,
      showStats:  false,
    });
  }
}
