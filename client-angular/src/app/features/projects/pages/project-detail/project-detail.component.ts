import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ProjectService } from '../../../../core/services/project.service';
import { EstimateService } from '../../../../core/services/estimate.service';
import { MessageService } from '../../../../core/services/message.service';
import { ProjectCategoryService } from '../../../../core/services/project-category.service';
import { Project, ProjectCategory, Estimate, Message } from '../../../../core/models';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { GbpPipe } from '../../../../shared/pipes/gbp.pipe';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TabViewModule, TableModule, ButtonModule, DialogModule, InputTextModule, InputTextareaModule, StatusBadgeComponent, GbpPipe, LoadingSpinnerComponent, EmptyStateComponent],
  template: `
    <app-loading *ngIf="loading"></app-loading>
    <div *ngIf="!loading && !project" class="text-center py-16"><p class="text-gray-500">Project not found.</p>
      <a routerLink="/projects" class="text-brand-600 text-sm mt-2 inline-block">Back to Projects</a></div>
    <div *ngIf="!loading && project">
      <div class="mb-6">
        <a routerLink="/projects" class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"><i class="pi pi-arrow-left text-xs"></i> Back to Projects</a>
        <div class="flex items-start justify-between">
          <div><h1 class="text-2xl font-bold text-gray-900">{{project.event_name||project.name}}</h1>
            <div class="flex items-center gap-3 mt-2 text-sm text-gray-500">
              <span *ngIf="project.venue_name">{{project.venue_name}}</span>
              <span *ngIf="project.venue_city">· {{project.venue_city}}</span>
              <span *ngIf="project.event_date">· {{project.event_date}}</span>
            </div>
          </div>
          <app-status-badge [status]="project.status_name"></app-status-badge>
        </div>
      </div>
      <p-tabView>
        <p-tabPanel header="Overview">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 class="text-sm font-semibold text-gray-900 mb-4">Event Details</h3>
              <dl class="space-y-3">
                <div class="flex justify-between" *ngFor="let r of eventRows"><dt class="text-sm text-gray-500">{{r.l}}</dt><dd class="text-sm font-medium text-gray-900 capitalize">{{r.v||'-'}}</dd></div>
              </dl>
            </div>
            <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h3 class="text-sm font-semibold text-gray-900 mb-4">Stand Configuration</h3>
              <dl class="space-y-3">
                <div class="flex justify-between"><dt class="text-sm text-gray-500">Size</dt><dd class="text-sm font-medium text-gray-900 capitalize">{{project.stand_size||'-'}}</dd></div>
                <div class="flex justify-between"><dt class="text-sm text-gray-500">Area</dt><dd class="text-sm font-medium text-gray-900">{{standArea ? standArea+' m²' : '-'}}</dd></div>
                <div class="flex justify-between"><dt class="text-sm text-gray-500">Type</dt><dd class="text-sm font-medium text-gray-900">{{(project.stand_type||'-').replace('_',' ')}}</dd></div>
              </dl>
            </div>
            <div *ngIf="project.raw_brief_text" class="bg-white rounded-lg border border-gray-200 shadow-sm p-6 lg:col-span-2">
              <h3 class="text-sm font-semibold text-gray-900 mb-4">Brief</h3>
              <p class="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{{project.raw_brief_text}}</p>
            </div>
            <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-6 lg:col-span-2">
              <h3 class="text-sm font-semibold text-gray-900 mb-4">Financial Summary</h3>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div><p class="text-xs text-gray-500 uppercase">Budget</p><p class="text-lg font-bold text-gray-900 mt-1">{{project.project_budget|gbp}}</p></div>
                <div><p class="text-xs text-gray-500 uppercase">Margin</p><p class="text-lg font-bold text-gray-900 mt-1">{{project.default_margin_pct||0}}%</p></div>
                <div><p class="text-xs text-gray-500 uppercase">Contingency</p><p class="text-lg font-bold text-gray-900 mt-1">{{project.default_contingency_pct||0}}%</p></div>
                <div><p class="text-xs text-gray-500 uppercase">Total Client Cost</p><p class="text-lg font-bold text-brand-600 mt-1">{{project.total_client_cost|gbp}}</p></div>
              </div>
            </div>
          </div>
        </p-tabPanel>
        <p-tabPanel header="Categories">
          <div class="mt-4">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-semibold text-gray-900">Cost Breakdown by Category</h3>
              <p-button icon="pi pi-plus" label="Add Category" size="small" (click)="showAddCat=true"></p-button>
            </div>
            <app-empty-state *ngIf="cats.length===0" icon="pi-list" message="No categories yet."></app-empty-state>
            <div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto" *ngIf="cats.length>0">
              <p-table [value]="cats" styleClass="p-datatable-sm">
                <ng-template pTemplate="header"><tr>
                  <th>Category</th><th>Brief</th><th class="text-right">Ballpark</th><th class="text-right">Base</th>
                  <th class="text-right">Contingency</th><th class="text-right">Subtotal</th><th class="text-right">Margin</th>
                  <th class="text-right">Net</th><th class="text-right">VAT</th><th class="text-right">Client Cost</th><th class="text-center">Status</th>
                </tr></ng-template>
                <ng-template pTemplate="body" let-c>
                  <tr><td class="font-medium">{{c.name}}</td><td class="text-gray-600 max-w-[180px] truncate">{{c.requirement_brief||'-'}}</td>
                    <td class="text-right">{{c.ballpark_cost|gbp}}</td><td class="text-right">{{c.base_cost|gbp}}</td>
                    <td class="text-right">{{c.contingency_amount|gbp}}</td><td class="text-right">{{c.subtotal|gbp}}</td>
                    <td class="text-right">{{c.margin_amount|gbp}}</td><td class="text-right">{{c.net_cost|gbp}}</td>
                    <td class="text-right">{{c.vat_amount|gbp}}</td><td class="text-right font-medium">{{c.client_cost|gbp}}</td>
                    <td class="text-center"><app-status-badge [status]="c.status_name||'pending'"></app-status-badge></td>
                  </tr>
                </ng-template>
              </p-table>
            </div>
          </div>
        </p-tabPanel>
        <p-tabPanel header="Estimates">
          <div class="mt-4">
            <app-empty-state *ngIf="ests.length===0" icon="pi-file" message="No estimates yet."></app-empty-state>
            <div class="space-y-3" *ngIf="ests.length>0">
              <div *ngFor="let e of ests" class="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
                <div class="flex items-center justify-between">
                  <div><p class="text-sm font-semibold text-gray-900">{{e.name||'Version '+e.version}}</p><p class="text-xs text-gray-500 mt-1">{{e.created_at|date:'d MMM yyyy'}}</p></div>
                  <div class="flex items-center gap-4">
                    <div class="text-right"><p class="text-xs text-gray-500">Total Value</p><p class="text-sm font-bold">{{e.total_value|gbp}}</p></div>
                    <div class="text-right"><p class="text-xs text-gray-500">Balls</p><p class="text-sm font-bold text-purple-600">{{e.balls_cost}}</p></div>
                    <app-status-badge [status]="e.status_name||'draft'"></app-status-badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </p-tabPanel>
        <p-tabPanel header="Messages">
          <div class="mt-4">
            <div class="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div class="max-h-96 overflow-y-auto p-6 space-y-4">
                <p *ngIf="msgs.length===0" class="text-sm text-gray-400 text-center py-8">No messages yet.</p>
                <div *ngFor="let m of msgs" [class]="m.direction==='outbound'?'flex justify-end':'flex justify-start'">
                  <div [class]="'max-w-[70%] rounded-lg p-3 '+(m.direction==='outbound'?'bg-brand-50':'bg-gray-50')">
                    <div class="flex items-center gap-2 mb-1"><span class="text-xs font-medium text-gray-900">{{m.sender_name||'User'}}</span>
                      <span class="text-xs text-gray-400">{{m.created_at|date:'d MMM HH:mm'}}</span></div>
                    <p class="text-sm text-gray-700">{{m.body}}</p>
                  </div>
                </div>
              </div>
              <div class="border-t border-gray-200 p-4"><div class="flex gap-3">
                <input pInputText [(ngModel)]="newMsg" placeholder="Type a message..." class="flex-1" (keyup.enter)="sendMsg()"/>
                <p-button icon="pi pi-send" [disabled]="!newMsg.trim()||sending" (click)="sendMsg()" [loading]="sending"></p-button>
              </div></div>
            </div>
          </div>
        </p-tabPanel>
      </p-tabView>
    </div>
    <p-dialog header="Add Category" [(visible)]="showAddCat" [modal]="true" [style]="{width:'450px'}">
      <div class="space-y-4">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Category Name</label><input pInputText [(ngModel)]="newCat.name" class="w-full"/></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Requirement Brief</label><textarea pInputTextarea [(ngModel)]="newCat.brief" [rows]="3" class="w-full"></textarea></div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancel" [text]="true" (click)="showAddCat=false"></p-button>
        <p-button label="Add" icon="pi pi-plus" [disabled]="!newCat.name" (click)="addCat()" [loading]="addingCat"></p-button>
      </ng-template>
    </p-dialog>
  `
})
export class ProjectDetailComponent implements OnInit {
  project: Project | null = null;
  cats: ProjectCategory[] = [];
  ests: Estimate[] = [];
  msgs: Message[] = [];
  loading = true;
  newMsg = '';
  sending = false;
  showAddCat = false;
  addingCat = false;
  newCat = { name: '', brief: '' };
  private pid = '';

  get standArea(): number { return +(this.project?.stand_width_m || 0) * +(this.project?.stand_depth_m || 0); }
  get eventRows() {
    const p = this.project!;
    return [
      { l: 'Event Name', v: p.event_name }, { l: 'Event Date', v: p.event_date },
      { l: 'Venue', v: p.venue_name }, { l: 'City', v: p.venue_city },
      { l: 'Guest Count', v: p.guest_count }, { l: 'Tier', v: p.tier },
    ];
  }

  constructor(private route: ActivatedRoute, private projSvc: ProjectService, private estSvc: EstimateService, private msgSvc: MessageService, private pcSvc: ProjectCategoryService) {}

  ngOnInit() {
    this.pid = this.route.snapshot.paramMap.get('id') || '';
    this.loadAll();
  }

  loadAll() {
    this.loading = true;
    this.projSvc.getById(this.pid).subscribe({ next: p => { this.project = p; this.cats = p.project_categories || []; this.loading = false; }, error: () => this.loading = false });
    this.estSvc.getByProject(this.pid).subscribe({ next: d => this.ests = d, error: () => {} });
    this.msgSvc.getByProject(this.pid).subscribe({ next: d => this.msgs = d, error: () => {} });
  }

  sendMsg() {
    if (!this.newMsg?.trim()) return;
    this.sending = true;
    this.msgSvc.create({ project_id: this.pid, body: this.newMsg, direction: 'outbound', subject: 'Message' }).subscribe({
      next: () => { this.newMsg = ''; this.sending = false; this.msgSvc.getByProject(this.pid).subscribe(d => this.msgs = d); },
      error: () => this.sending = false
    });
  }

  addCat() {
    this.addingCat = true;
    this.pcSvc.create({ project_id: this.pid, name: this.newCat.name, requirement_brief: this.newCat.brief }).subscribe({
      next: () => { this.showAddCat = false; this.addingCat = false; this.newCat = { name: '', brief: '' }; this.loadAll(); },
      error: () => this.addingCat = false
    });
  }
}
