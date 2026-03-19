import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { LucideAngularModule, ArrowLeft, User, Mail, Phone } from 'lucide-angular';
import { ClientService } from '../../../../core/services/client.service';
import { Client, Project } from '../../../../models';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { GbpPipe } from '../../../../shared/pipes/gbp.pipe';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, StatusBadgeComponent, GbpPipe, LoadingSpinnerComponent, EmptyStateComponent],
  template: `
    <app-loading *ngIf="loading"></app-loading>
    <div *ngIf="!loading && !client" class="text-center py-16"><p class="text-gray-500">Client not found.</p>
      <a routerLink="/clients" style="color:var(--theme-accent);font-size:var(--text-sm);" class="mt-2 inline-block">Back to Clients</a></div>
    <div *ngIf="!loading && client">
      <a routerLink="/clients" class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"><lucide-icon name="arrow-left" [size]="12"></lucide-icon> Back to Clients</a>
      <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-8">
        <div class="flex items-start gap-4">
          <div class="w-14 h-14 rounded-xl flex items-center justify-center" style="background:var(--theme-bg);"><lucide-icon name="user" [size]="24" style="color:var(--theme-accent);"></lucide-icon></div>
          <div class="flex-1">
            <h1 class="text-xl font-bold text-gray-900">{{client.name}}</h1>
            <div class="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
              <span *ngIf="client.contact_name" class="flex items-center gap-1.5"><lucide-icon name="user" [size]="14" style="color:var(--color-text-muted);"></lucide-icon>{{client.contact_name}}</span>
              <span *ngIf="client.email" class="flex items-center gap-1.5"><lucide-icon name="mail" [size]="14" style="color:var(--color-text-muted);"></lucide-icon>{{client.email}}</span>
              <span *ngIf="client.phone" class="flex items-center gap-1.5"><lucide-icon name="phone" [size]="14" style="color:var(--color-text-muted);"></lucide-icon>{{client.phone}}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div class="px-6 py-4 border-b border-gray-200"><h2 class="text-lg font-semibold text-gray-900">Projects</h2></div>
        <app-empty-state *ngIf="projects.length===0" icon="pi-folder" message="No projects for this client yet."></app-empty-state>
        <div class="divide-y divide-gray-100" *ngIf="projects.length>0">
          <a *ngFor="let p of projects" [routerLink]="['/projects',p.id]" class="flex items-center justify-between px-6 py-4 hover:bg-gray-50">
            <div class="flex-1 min-w-0"><p class="text-sm font-medium text-gray-900 truncate">{{p.event_name||p.name}}</p>
              <p class="text-xs text-gray-500 mt-0.5">{{p.event_date}}<span *ngIf="p.venue_city"> · {{p.venue_city}}</span></p></div>
            <div class="flex items-center gap-4 ml-4">
              <span class="text-sm font-medium text-gray-700">{{p.total_client_cost||p.project_budget|gbp}}</span>
              <app-status-badge [status]="p.status_name"></app-status-badge>
            </div>
          </a>
        </div>
      </div>
    </div>
  `
})
export class ClientDetailComponent implements OnInit {
  readonly icons = { ArrowLeft, User, Mail, Phone };
  client: Client | null = null;
  projects: Project[] = [];
  loading = true;

  constructor(private route: ActivatedRoute, private svc: ClientService) {}
  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.svc.getById(id).subscribe({ next: c => { this.client = c; this.loading = false; }, error: () => this.loading = false });
    this.svc.getProjectsForClient(id).subscribe({ next: p => this.projects = p, error: () => {} });
  }
}
