import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabViewModule } from 'primeng/tabview';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { OrgService } from '../../core/services/org.service';
import { CategoryService } from '../../core/services/category.service';
import { Org, User, Category } from '../../core/models';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TabViewModule, ButtonModule, InputTextModule, InputNumberModule, InputTextareaModule, ToastModule, LoadingSpinnerComponent],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>
    <div *ngIf="!loading">
      <h1 class="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
      <p class="text-sm text-gray-500 mb-8">Manage your organisation settings and team</p>
      <p-tabView>
        <p-tabPanel header="Organisation">
          <div class="max-w-2xl mt-4 space-y-5">
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Organisation Name</label><input pInputText [(ngModel)]="form.name" class="w-full"/></div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Address</label><textarea pInputTextarea [(ngModel)]="form.address" [rows]="2" class="w-full"></textarea></div>
            <div class="grid grid-cols-3 gap-4">
              <div><label class="block text-sm font-medium text-gray-700 mb-1">Default VAT %</label><p-inputNumber [(ngModel)]="form.vat" suffix="%" styleClass="w-full"></p-inputNumber></div>
              <div><label class="block text-sm font-medium text-gray-700 mb-1">Default Margin %</label><p-inputNumber [(ngModel)]="form.margin" suffix="%" styleClass="w-full"></p-inputNumber></div>
              <div><label class="block text-sm font-medium text-gray-700 mb-1">Default Contingency %</label><p-inputNumber [(ngModel)]="form.contingency" suffix="%" styleClass="w-full"></p-inputNumber></div>
            </div>
            <p-button icon="pi pi-save" label="{{saving?'Saving...':'Save Changes'}}" [loading]="saving" (click)="save()"></p-button>
          </div>
        </p-tabPanel>
        <p-tabPanel header="Team">
          <div class="mt-4">
            <p *ngIf="users.length===0" class="text-sm text-gray-500">No team members found.</p>
            <div class="divide-y divide-gray-100" *ngIf="users.length>0">
              <div *ngFor="let u of users" class="flex items-center justify-between py-3">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center"><span class="text-sm font-semibold text-brand-600">{{(u.name||'U').charAt(0).toUpperCase()}}</span></div>
                  <div><p class="text-sm font-medium text-gray-900">{{u.name}}</p><p class="text-xs text-gray-500">{{u.email}}</p></div>
                </div>
                <span class="text-xs font-medium text-gray-500 uppercase bg-gray-100 px-2.5 py-1 rounded-full">{{u.role}}</span>
              </div>
            </div>
          </div>
        </p-tabPanel>
        <p-tabPanel header="Categories">
          <div class="mt-4">
            <p *ngIf="categories.length===0" class="text-sm text-gray-500">No categories found.</p>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3" *ngIf="categories.length>0">
              <div *ngFor="let c of categories" class="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <i class="pi pi-tag text-gray-400"></i><span class="text-sm font-medium text-gray-900">{{c.name}}</span>
              </div>
            </div>
          </div>
        </p-tabPanel>
        <p-tabPanel header="Subscription">
          <div class="mt-4" *ngIf="org">
            <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-6 max-w-md">
              <div class="flex items-center gap-3 mb-4"><i class="pi pi-credit-card text-brand-600 text-xl"></i><h2 class="text-lg font-semibold text-gray-900">Current Plan</h2></div>
              <span class="inline-flex items-center rounded-full bg-brand-100 text-brand-700 px-3 py-1 text-sm font-semibold capitalize mb-4">{{org.subscription_tier}}</span>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between"><span class="text-gray-500">Balls Balance</span><span class="font-semibold">{{org.balls_balance}}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Monthly Allowance</span><span class="font-semibold">{{org.balls_monthly_allowance}}</span></div>
              </div>
            </div>
          </div>
        </p-tabPanel>
      </p-tabView>
    </div>
    <p-toast></p-toast>
  `
})
export class SettingsComponent implements OnInit {
  org: Org | null = null;
  users: User[] = [];
  categories: Category[] = [];
  loading = true;
  saving = false;
  form = { name: '', address: '', vat: 20, margin: 20, contingency: 5 };

  constructor(private orgSvc: OrgService, private catSvc: CategoryService, private msg: MessageService) {}

  ngOnInit() {
    Promise.all([
      this.orgSvc.getCurrentOrg().toPromise(),
      this.orgSvc.getUsers().toPromise(),
      this.catSvc.getAll().toPromise(),
    ]).then(([org, users, cats]) => {
      this.org = org || null;
      if (org) this.form = { name: org.name, address: org.address || '', vat: +org.default_vat_pct || 20, margin: +org.default_margin_pct || 20, contingency: +org.default_contingency_pct || 5 };
      this.users = users || [];
      this.categories = cats || [];
      this.loading = false;
    }).catch(() => this.loading = false);
  }

  save() {
    this.saving = true;
    this.orgSvc.updateCurrentOrg({ name: this.form.name, address: this.form.address, default_vat_pct: this.form.vat, default_margin_pct: this.form.margin, default_contingency_pct: this.form.contingency }).subscribe({
      next: () => { this.saving = false; this.msg.add({ severity: 'success', summary: 'Saved' }); },
      error: () => { this.saving = false; this.msg.add({ severity: 'error', summary: 'Error' }); }
    });
  }
}
