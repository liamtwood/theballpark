import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ProjectService } from '../../core/services/project.service';
import { OrgService } from '../../core/services/org.service';
import { Project, Org } from '../../core/models';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { GbpPipe } from '../../shared/pipes/gbp.pipe';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, TableModule, ButtonModule, StatusBadgeComponent, GbpPipe, LoadingSpinnerComponent],
  template: `
    <app-loading *ngIf="loading"></app-loading>
    <div *ngIf="!loading">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p class="text-sm text-gray-500 mt-1">Overview of your projects and activity</p>
        </div>
        <a routerLink="/projects/new"><p-button icon="pi pi-plus" label="New Project"></p-button></a>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-6" *ngFor="let card of statCards">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center" [class]="card.bg">
              <i [class]="card.icon"></i>
            </div>
            <div>
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ card.label }}</p>
              <p class="text-xl font-bold text-gray-900 mt-0.5">{{ card.value }}</p>
            </div>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div class="px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">Recent Projects</h2>
        </div>
        <div *ngIf="projects.length === 0" class="px-6 py-12 text-center">
          <i class="pi pi-folder text-4xl text-gray-300 mb-3"></i>
          <p class="text-sm text-gray-500">No projects yet. Create your first project to get started.</p>
        </div>
        <p-table [value]="projects.slice(0, 10)" styleClass="p-datatable-sm" *ngIf="projects.length > 0">
          <ng-template pTemplate="header"><tr>
            <th>Project</th><th>Client</th><th>Event Date</th><th>Status</th><th class="text-right">Total Cost</th>
          </tr></ng-template>
          <ng-template pTemplate="body" let-p>
            <tr class="cursor-pointer hover:bg-gray-50" [routerLink]="['/projects', p.id]">
              <td><span class="font-medium text-brand-600">{{ p.event_name || p.name }}</span>
                <div class="text-xs text-gray-500" *ngIf="p.venue_city">{{ p.venue_city }}</div></td>
              <td>{{ p.client_name || '-' }}</td>
              <td>{{ p.event_date || '-' }}</td>
              <td><app-status-badge [status]="p.status_name"></app-status-badge></td>
              <td class="text-right font-medium">{{ p.total_client_cost | gbp }}</td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </div>
  `
})
export class DashboardComponent implements OnInit {
  projects: Project[] = [];
  org: Org | null = null;
  loading = true;
  statCards: { label: string; value: string | number; icon: string; bg: string }[] = [];

  constructor(private projectService: ProjectService, private orgService: OrgService) {}

  ngOnInit() {
    this.projectService.getAll().subscribe({
      next: (data) => { this.projects = data; this.buildCards(); this.loading = false; },
      error: () => { this.loading = false; }
    });
    this.orgService.getCurrentOrg().subscribe({
      next: (org) => { this.org = org; this.buildCards(); },
      error: () => {}
    });
  }

  buildCards() {
    const active = this.projects.filter(p => p.status_name === 'active').length;
    const budget = this.projects.reduce((s, p) => s + (+(p.total_client_cost || p.project_budget || 0)), 0);
    const fmt = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(budget);
    this.statCards = [
      { label: 'Total Projects', value: this.projects.length, icon: 'pi pi-folder text-brand-600', bg: 'bg-brand-50' },
      { label: 'Active Projects', value: active, icon: 'pi pi-chart-line text-green-600', bg: 'bg-green-50' },
      { label: 'Total Budget', value: fmt, icon: 'pi pi-pound text-purple-600', bg: 'bg-purple-50' },
      { label: 'Balls Balance', value: this.org?.balls_balance ?? 0, icon: 'pi pi-circle-fill text-blue-600', bg: 'bg-blue-50' },
    ];
  }
}
