import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ClientService } from '../../../../core/services/client.service';
import { Client, Project } from '../../../../core/models';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { GbpPipe } from '../../../../shared/pipes/gbp.pipe';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, StatusBadgeComponent, GbpPipe, LoadingSpinnerComponent, EmptyStateComponent],
  template: `
    <app-loading *ngIf="loading"></app-loading>
    <div *ngIf="!loading && !client" class="text-center py-16"><p class="text-gray-500">Client not found.</p>
      <a routerLink="/clients" class="text-brand-600 text-sm mt-2 inline-block">Back to Clients</a></div>
    <div *ngIf="!loading && client">
      <a routerLink="/clients" class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"><i class="pi pi-arrow-left text-xs"></i> Back to Clients</a>
      <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-8">
        <div class="flex items-start gap-4">
          <div class="w-14 h-14 bg-brand-50 rounded-xl flex items-center justify-center"><i class="pi pi-user text-2xl text-brand-600"></i></div>
          <div class="flex-1">
            <h1 class="text-xl font-bold text-gray-900">{{client.name}}</h1>
            <div class="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
              <span *ngIf="client.contact_name" class="flex items-center gap-1.5"><i class="pi pi-user text-gray-400"></i>{{client.contact_name}}</span>
              <span *ngIf="client.email" class="flex items-center gap-1.5"><i class="pi pi-envelope text-gray-400"></i>{{client.email}}</span>
              <span *ngIf="client.phone" class="flex items-center gap-1.5"><i class="pi pi-phone text-gray-400"></i>{{client.phone}}</span>
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
