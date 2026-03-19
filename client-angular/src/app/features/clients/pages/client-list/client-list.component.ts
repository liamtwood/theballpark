import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ClientService } from '../../../../core/services/client.service';
import { Client } from '../../../../models';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-client-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TableModule, ButtonModule, DialogModule, InputTextModule, ToastModule, LoadingSpinnerComponent, EmptyStateComponent],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>
    <div *ngIf="!loading">
      <div class="flex items-center justify-between mb-8">
        <div><h1 class="text-2xl font-bold text-gray-900">Clients</h1><p class="text-sm text-gray-500 mt-1">{{clients.length}} total clients</p></div>
        <p-button icon="pi pi-plus" label="Add Client" (click)="showAdd=true"></p-button>
      </div>
      <app-empty-state *ngIf="clients.length===0" icon="pi-users" message="No clients yet. Add your first client."></app-empty-state>
      <div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden" *ngIf="clients.length>0">
        <p-table [value]="clients" styleClass="p-datatable-sm">
          <ng-template pTemplate="header"><tr><th>Name</th><th>Contact</th><th>Email</th><th>Phone</th></tr></ng-template>
          <ng-template pTemplate="body" let-c>
            <tr class="hover:bg-gray-50">
              <td><a [routerLink]="['/clients',c.id]" class="text-sm font-medium text-brand-600 hover:text-brand-700">{{c.name}}</a></td>
              <td class="text-sm text-gray-700">{{c.contact_name||'-'}}</td>
              <td class="text-sm text-gray-700">{{c.email||'-'}}</td>
              <td class="text-sm text-gray-700">{{c.phone||'-'}}</td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </div>
    <p-dialog header="Add Client" [(visible)]="showAdd" [modal]="true" [style]="{width:'450px'}">
      <div class="space-y-4">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Company Name *</label><input pInputText [(ngModel)]="nc.name" class="w-full"/></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Contact Name</label><input pInputText [(ngModel)]="nc.contact_name" class="w-full"/></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Email</label><input pInputText [(ngModel)]="nc.email" class="w-full"/></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Phone</label><input pInputText [(ngModel)]="nc.phone" class="w-full"/></div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancel" [text]="true" (click)="showAdd=false"></p-button>
        <p-button label="Add Client" icon="pi pi-plus" [disabled]="!nc.name" (click)="add()" [loading]="adding"></p-button>
      </ng-template>
    </p-dialog>
    <p-toast></p-toast>
  `
})
export class ClientListComponent implements OnInit {
  clients: Client[] = [];
  loading = true;
  showAdd = false;
  adding = false;
  nc = { name: '', contact_name: '', email: '', phone: '' };

  constructor(private svc: ClientService, private msg: MessageService) {}
  ngOnInit() { this.load(); }
  load() { this.svc.getAll().subscribe({ next: d => { this.clients = d; this.loading = false; }, error: () => this.loading = false }); }
  add() {
    this.adding = true;
    this.svc.create(this.nc).subscribe({
      next: () => { this.showAdd = false; this.adding = false; this.nc = { name: '', contact_name: '', email: '', phone: '' }; this.msg.add({ severity: 'success', summary: 'Added' }); this.load(); },
      error: () => { this.adding = false; this.msg.add({ severity: 'error', summary: 'Error' }); }
    });
  }
}
