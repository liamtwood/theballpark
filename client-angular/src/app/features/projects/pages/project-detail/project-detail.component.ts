import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject, forkJoin, of } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { MessageService as PrimeMessageService } from 'primeng/api';
import { catchError } from 'rxjs/operators';
import { ProjectService } from '../../../../core/services/project.service';
import { MessageService } from '../../../../core/services/message.service';
import { ShellContextService } from '../../../../core/services/shell-context.service';
import { Project, Message } from '../../../../models';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    CommonModule, RouterModule, RouterOutlet,
    ToastModule, LoadingSpinnerComponent
  ],
  providers: [PrimeMessageService],
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
  private msgUnread = 0;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projSvc: ProjectService,
    private msgSvc: MessageService,
    private shellCtx: ShellContextService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.pid = this.route.snapshot.paramMap.get('id') || '';

    // Load project + a thin message preview in parallel so the hero
    // tab bar can render the Messages notification badge straight
    // away (v1.24). Both calls fail soft — the hero still pushes
    // even if /messages errors.
    forkJoin({
      project:  this.projSvc.getById(this.pid).pipe(catchError(() => of(null))),
      messages: this.msgSvc.getByProject(this.pid).pipe(catchError(() => of([] as Message[]))),
    }).subscribe(({ project, messages }) => {
      this.project   = project;
      this.msgUnread = (messages || []).filter(
        m => m.direction === 'inbound' && (!m.msg_status || m.msg_status === 'unread')
      ).length;
      if (project) this.pushContext(project);
      this.loading = false;
      this.cdr.detectChanges();
    });

    // Re-push on navigation so the heroSub eyebrow swaps (PROJECT
    // OVERVIEW / EVENT / BRIEF / etc.) — each tab tells us by URL
    // segment, not by manipulating ShellContext itself, which keeps
    // child tabs free of cross-tab knowledge.
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      if (this.project) {
        this.pushContext(this.project);
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy() {
    // Reset hero when leaving project
    this.destroy$.next();
    this.destroy$.complete();
    this.shellCtx.reset();
  }

  private pushContext(p: Project) {
    // v1.24 tab bar — Overview is the new first tab and default
    // landing route. Order:
    //   Overview · Event · Brief · Marketplace · Estimate · Messages
    // Estimate keeps the old /build → /estimate redirect alive for
    // bookmarks; /supplier (legacy vendor-selection) and
    // /estimate-legacy stay routable but aren't surfaced.
    const tabs = [
      { label: 'Overview',    path: `/projects/${this.pid}/overview` },
      { label: 'Event',       path: `/projects/${this.pid}/event` },
      { label: 'Brief',       path: `/projects/${this.pid}/brief` },
      { label: 'Marketplace', path: `/projects/${this.pid}/marketplace` },
      { label: 'Estimate',    path: `/projects/${this.pid}/estimate` },
      {
        label: 'Messages',
        path: `/projects/${this.pid}/messages`,
        // v1.24: render the red notification chip next to the tab
        // label when there are unread inbound messages.
        ...(this.msgUnread > 0 ? { badge: this.msgUnread } : {})
      },
    ];

    // Pills: client name + venue
    const pills: string[] = [];
    if (p.client_name) pills.push(p.client_name);
    if (p.venue_name)  pills.push(p.venue_name);

    // v1.24: eyebrow tracks the current tab. Spec calls for "PROJECT
    // OVERVIEW" only on the Overview tab — other tabs use their own
    // labels via heroSub. Drive it off the URL so we don't need each
    // tab component to push heroSub itself.
    const heroSub = this.eyebrowForUrl(this.router.url);

    this.shellCtx.set({
      heroTitle:  p.event_name || p.name || 'Untitled',
      heroSub,
      pills,
      tabs,
      showStats:  false,
    });
  }

  /** Map the current URL segment to the hero's eyebrow label.
      Returns '' for tabs that prefer their own page-level title. */
  private eyebrowForUrl(url: string): string {
    if (url.includes('/overview'))     return 'PROJECT OVERVIEW';
    if (url.includes('/event'))        return 'EVENT';
    if (url.includes('/brief'))        return 'BRIEF';
    if (url.includes('/marketplace'))  return 'MARKETPLACE';
    if (url.includes('/estimate'))     return 'ESTIMATE';
    if (url.includes('/messages'))     return 'MESSAGES';
    return '';
  }
}
