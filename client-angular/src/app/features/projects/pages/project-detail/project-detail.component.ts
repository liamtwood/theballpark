import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, Router, ActivatedRoute } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProjectService } from '../../../../core/services/project.service';
import { Project } from '../../../../models';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { GbpPipe } from '../../../../shared/pipes/gbp.pipe';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';

interface DetailTab { label: string; path: string; }

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    CommonModule, RouterModule, RouterOutlet,
    ToastModule, StatusBadgeComponent, GbpPipe, LoadingSpinnerComponent
  ],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading && !project">
      <div class="bp-page" style="text-align:center;padding:80px 0;">
        <p class="bp-muted-text">Project not found.</p>
        <a routerLink="/projects" style="color:var(--theme-accent);font-size:var(--text-sm);margin-top:8px;display:inline-block;">
          ← Back to Projects
        </a>
      </div>
    </ng-container>

    <ng-container *ngIf="!loading && project">

      <!-- PROJECT HERO -->
      <div class="bp-project-hero">

        <!-- Back link -->
        <a routerLink="/projects" class="bp-back-link">← Projects</a>

        <!-- Project name + status -->
        <div class="bp-project-hero-title">
          <h1 class="bp-project-name">{{ project.event_name || project.name }}</h1>
          <app-status-badge [status]="project.status_name"></app-status-badge>
        </div>

        <!-- Client + meta pills -->
        <div class="bp-project-meta">
          <span *ngIf="project.client_name" class="bp-project-client">{{ project.client_name }}</span>
          <span *ngIf="project.venue_name" class="bp-meta-pill">{{ project.venue_name }}</span>
          <span *ngIf="project.venue_city" class="bp-meta-pill">{{ project.venue_city }}</span>
          <span *ngIf="project.event_date" class="bp-meta-pill">{{ project.event_date }}</span>
          <span *ngIf="project.stand_size" class="bp-meta-pill">{{ project.stand_size }}</span>
          <span *ngIf="project.project_budget" class="bp-meta-pill">Budget: {{ project.project_budget | gbp }}</span>
        </div>

        <!-- Tabs -->
        <div class="bp-hero-tabs">
          <button *ngFor="let tab of tabs"
            class="bp-hero-tab" [class.active]="isActive(tab.path)"
            (click)="navigate(tab.path)">
            {{ tab.label }}
          </button>
        </div>

      </div>

      <!-- TAB CONTENT -->
      <div class="bp-project-content">
        <router-outlet></router-outlet>
      </div>

    </ng-container>

    <p-toast></p-toast>
  `,
  styles: [`
    /* ── HERO ── */
    .bp-project-hero {
      background: var(--theme-bg);
      padding: 24px var(--section-pad) 0;
      border-bottom: 0.5px solid var(--theme-border);
      flex-shrink: 0;
    }

    /* ── BACK LINK ── */
    .bp-back-link {
      font-size: 12px;
      color: var(--color-text-muted);
      text-decoration: none;
      display: inline-block;
      margin-bottom: 12px;
      transition: color 0.15s;
    }
    .bp-back-link:hover { color: var(--theme-accent); }

    /* ── TITLE ROW ── */
    .bp-project-hero-title {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
    }
    .bp-project-name {
      font-family: var(--font-display);
      font-size: 28px;
      font-weight: 400;
      color: var(--color-text-primary);
      letter-spacing: -0.02em;
      margin: 0;
    }

    /* ── META ROW ── */
    .bp-project-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .bp-project-client {
      font-size: 13px;
      font-weight: 500;
      color: var(--color-text-secondary);
    }
    .bp-meta-pill {
      font-size: 11px;
      color: var(--color-text-muted);
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      border-radius: 20px;
      padding: 2px 10px;
    }

    /* ── CONTENT AREA ── */
    .bp-project-content {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
    }

    /* ── MISC ── */
    .bp-muted-text { color: var(--color-text-muted); font-size: var(--text-sm); }
  `]
})
export class ProjectDetailComponent implements OnInit {
  project: Project | null = null;
  loading = true;
  pid = '';

  tabs: DetailTab[] = [
    { label: 'Brief',     path: 'brief' },
    { label: 'Build',     path: 'build' },
    { label: 'Estimate',  path: 'estimate' },
    { label: 'Suppliers', path: 'suppliers' },
    { label: 'Messages',  path: 'messages' },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projSvc: ProjectService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.pid = this.route.snapshot.paramMap.get('id') || '';
    this.projSvc.getById(this.pid).subscribe({
      next: p => { this.project = p; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  navigate(path: string) {
    this.router.navigate(['/projects', this.pid, path]);
  }

  isActive(path: string) {
    return this.router.url.includes(`/projects/${this.pid}/${path}`);
  }
}
