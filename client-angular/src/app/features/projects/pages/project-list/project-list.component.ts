import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ProjectService } from '../../../../core/services/project.service';
import { Project } from '../../../../models';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { GbpPipe } from '../../../../shared/pipes/gbp.pipe';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TableModule, ButtonModule, InputTextModule, ConfirmDialogModule, ToastModule, StatusBadgeComponent, GbpPipe, LoadingSpinnerComponent, EmptyStateComponent],
  providers: [ConfirmationService, MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>
    <div *ngIf="!loading">
      <div class="flex items-center justify-between mb-8">
        <div><h1 class="text-2xl font-bold text-gray-900">Projects</h1>
          <p class="text-sm text-gray-500 mt-1">{{ projects.length }} total projects</p></div>
        <a routerLink="/projects/new"><p-button icon="pi pi-plus" label="New Project"></p-button></a>
      </div>
      <div class="mb-6 max-w-md">
        <span class="p-input-icon-left w-full"><i class="pi pi-search"></i>
          <input pInputText [(ngModel)]="searchTerm" placeholder="Search projects..." class="w-full" (input)="filter()" /></span>
      </div>
      <app-empty-state *ngIf="filtered.length === 0" icon="pi-folder" [message]="searchTerm ? 'No projects match your search.' : 'No projects yet. Create your first project.'"></app-empty-state>
      <div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden" *ngIf="filtered.length > 0">
        <p-table [value]="filtered" [paginator]="filtered.length > 20" [rows]="20" styleClass="p-datatable-sm">
          <ng-template pTemplate="header"><tr>
            <th pSortableColumn="event_name">Project <p-sortIcon field="event_name"></p-sortIcon></th>
            <th>Client</th><th>Event Date</th><th>Venue</th><th>Status</th>
            <th class="text-right">Total Cost</th><th class="text-center" style="width:80px">Actions</th>
          </tr></ng-template>
          <ng-template pTemplate="body" let-p>
            <tr class="hover:bg-gray-50">
              <td><a [routerLink]="['/projects', p.id]" class="text-sm font-medium text-brand-600 hover:text-brand-700">{{ p.event_name || p.name || 'Untitled' }}</a>
                <div class="text-xs text-gray-500" *ngIf="p.venue_city">{{ p.venue_city }}</div></td>
              <td class="text-sm text-gray-700">{{ p.client_name || '-' }}</td>
              <td class="text-sm text-gray-700">{{ p.event_date || '-' }}</td>
              <td class="text-sm text-gray-700">{{ p.venue_name || '-' }}</td>
              <td><app-status-badge [status]="p.status_name"></app-status-badge></td>
              <td class="text-right text-sm font-medium">{{ p.total_client_cost | gbp }}</td>
              <td class="text-center">
                <a [routerLink]="['/projects', p.id]"><p-button icon="pi pi-eye" [rounded]="true" [text]="true" severity="info" size="small"></p-button></a>
                <p-button icon="pi pi-trash" [rounded]="true" [text]="true" severity="danger" size="small" (click)="confirmDelete(p)"></p-button>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </div>
    <p-confirmDialog></p-confirmDialog><p-toast></p-toast>
  `
})
export class ProjectListComponent implements OnInit {
  projects: Project[] = [];
  filtered: Project[] = [];
  searchTerm = '';
  loading = true;

  constructor(private svc: ProjectService, private confirm: ConfirmationService, private msg: MessageService) {}
  ngOnInit() { this.load(); }

  load() {
    this.svc.getAll().subscribe({
      next: d => { this.projects = d; this.filtered = d; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  filter() {
    const t = this.searchTerm.toLowerCase();
    this.filtered = this.projects.filter(p =>
      (p.event_name || p.name || '').toLowerCase().includes(t) ||
      (p.client_name || '').toLowerCase().includes(t)
    );
  }

  confirmDelete(p: Project) {
    this.confirm.confirm({
      message: `Delete "${p.event_name || p.name}"?`, header: 'Confirm', icon: 'pi pi-exclamation-triangle',
      accept: () => this.svc.delete(p.id).subscribe({ next: () => { this.msg.add({ severity: 'success', summary: 'Deleted' }); this.load(); } })
    });
  }
}
