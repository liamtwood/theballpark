import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { MessageService as MsgSvc } from '../../core/services/message.service';
import { ProjectService } from '../../core/services/project.service';
import { ProjectCategoryService } from '../../core/services/project-category.service';
import { OrgService } from '../../core/services/org.service';
import { ShellContextService } from '../../core/services/shell-context.service';
import { Message, Project } from '../../models';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';

interface CategoryFolder { id: string; name: string; actionCount: number; }

const MSG_STATUSES = [
  { id: 'all',           label: 'All',     color: '' },
  { id: 'action_needed', label: 'Action',  color: '#DC2626' },
  { id: 'follow_up',     label: 'Waiting', color: '#D97706' },
  { id: 'quoted',        label: 'Quoted',  color: '#2563EB' },
  { id: 'booked',        label: 'Booked',  color: '#059669' },
];

@Component({
  selector: 'app-global-messages',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, InputTextModule, DropdownModule, ToastModule,
    LoadingSpinnerComponent
  ],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading">
      <div class="bp-msg-wrap">

        <!-- PROJECT SELECTOR -->
        <div class="bp-msg-project-bar">
          <p-dropdown
            [(ngModel)]="selectedProjectId"
            [options]="projectOptions"
            optionLabel="name"
            optionValue="id"
            styleClass="w-full bp-msg-project-select bp-input-edit"
            (onChange)="onProjectChange()">
          </p-dropdown>
        </div>

        <!-- STATUS FILTER BAR -->
        <div class="bp-msg-status-bar">
          <button *ngFor="let s of statuses"
            class="bp-msg-status-pill"
            [class.active]="activeStatus === s.id"
            [style.--pill-color]="s.color"
            (click)="activeStatus = s.id">
            {{ s.label }}
            <span *ngIf="s.id !== 'all' && countByStatus(s.id) > 0" class="bp-msg-status-count">
              {{ countByStatus(s.id) }}
            </span>
          </button>
        </div>

        <div class="bp-msg-layout">

          <!-- LEFT — FOLDERS -->
          <div class="bp-msg-sidebar">
            <div class="bp-msg-sidebar-title">Folders</div>
            <div class="bp-msg-folder" [class.active]="activeFolderId === 'all'" (click)="setFolder('all')">
              <span class="bp-msg-folder-name">All Messages</span>
              <span *ngIf="actionCount('all') > 0" class="bp-msg-folder-badge">{{ actionCount('all') }}</span>
            </div>
            <ng-container *ngIf="selectedProjectId">
              <div class="bp-msg-folder-divider"></div>
              <div class="bp-msg-folder-group-label">By Category</div>
              <div *ngFor="let f of folders" class="bp-msg-folder"
                [class.active]="activeFolderId === f.id"
                (click)="setFolder(f.id)">
                <span class="bp-msg-folder-name">{{ f.name }}</span>
                <span *ngIf="f.actionCount > 0" class="bp-msg-folder-badge">{{ f.actionCount }}</span>
              </div>
            </ng-container>
            <div *ngIf="!selectedProjectId" class="bp-msg-folder-empty">Select a project to see categories</div>
          </div>

          <!-- RIGHT — THREAD -->
          <div class="bp-msg-thread">
            <div class="bp-msg-thread-header">
              <div>
                <span class="bp-msg-thread-title">{{ activeFolderName() }}</span>
                <span *ngIf="activeStatus !== 'all'" class="bp-msg-thread-status-tag"
                  [style.background]="statusColor(activeStatus) + '20'"
                  [style.color]="statusColor(activeStatus)"
                  [style.border-color]="statusColor(activeStatus) + '40'">
                  {{ statusLabel(activeStatus) }}
                </span>
              </div>
              <span class="bp-msg-thread-count">{{ filteredMsgs().length }} message{{ filteredMsgs().length !== 1 ? 's' : '' }}</span>
            </div>

            <div class="bp-messages-list" #messageList>
              <p *ngIf="filteredMsgs().length === 0" class="bp-msg-empty">
                <span *ngIf="!selectedProjectId">Select a project to see messages.</span>
                <span *ngIf="selectedProjectId && activeStatus === 'all' && activeFolderId === 'all'">No messages yet. Request quotes from the Build tab to start conversations.</span>
                <span *ngIf="selectedProjectId && (activeStatus !== 'all' || activeFolderId !== 'all')">No messages match this filter.</span>
              </p>

              <ng-container *ngFor="let m of filteredMsgs()">
                <div class="bp-msg-date" *ngIf="shouldShowDate(m)">{{ m.created_at | date:'d MMMM yyyy' }}</div>
                <div class="bp-msg-row" [class.bp-msg-outbound]="m.direction === 'outbound'">
                  <div class="bp-msg-bubble" [class.bp-msg-bubble-out]="m.direction === 'outbound'">
                    <div class="bp-msg-meta">
                      <span class="bp-msg-sender">{{ m.sender_name || (m.direction === 'outbound' ? 'You' : 'Supplier') }}</span>
                      <span *ngIf="activeFolderId === 'all' && m.category_name" class="bp-msg-cat-tag">{{ m.category_name }}</span>
                      <span *ngIf="!selectedProjectId && m.project_name" class="bp-msg-cat-tag">{{ m.project_name }}</span>
                      <span class="bp-msg-time">{{ m.created_at | date:'HH:mm' }}</span>
                    </div>
                    <p class="bp-msg-body">{{ m.body }}</p>
                    <div class="bp-msg-status-row" *ngIf="m.direction === 'inbound'">
                      <button *ngFor="let s of statuses.slice(1)"
                        class="bp-msg-tag-btn"
                        [class.active]="getMsgStatus(m) === s.id"
                        [style.--tag-color]="s.color"
                        (click)="setMsgStatus(m, s.id); $event.stopPropagation()">
                        {{ s.label }}
                      </button>
                    </div>
                  </div>
                </div>
              </ng-container>
            </div>

            <!-- Compose — only when project selected -->
            <div class="bp-compose" *ngIf="selectedProjectId">
              <input pInputText [(ngModel)]="newMsg"
                [placeholder]="composePlaceholder()"
                class="bp-compose-input bp-input-edit"
                (keyup.enter)="send()"/>
              <p-button icon="pi pi-send" styleClass="bp-btn-save"
                [disabled]="!newMsg.trim() || sending"
                [loading]="sending"
                (onClick)="send()">
              </p-button>
            </div>

          </div>
        </div>
      </div>
    </ng-container>

    <p-toast></p-toast>
  `,
  styles: [`
    .bp-msg-project-bar { padding: 10px 16px; background: #fff; border-bottom: 0.5px solid var(--color-border); flex-shrink: 0; }
    .bp-msg-project-select { font-size: 13px !important; }
    .bp-msg-wrap   { display: flex; flex-direction: column; height: calc(100vh - 220px); min-height: 500px; }
    .bp-msg-status-bar    { display: flex; align-items: center; gap: 6px; padding: 10px 16px; border-bottom: 0.5px solid var(--color-border); background: #fff; flex-shrink: 0; flex-wrap: wrap; }
    .bp-msg-status-pill   { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; border: 0.5px solid var(--color-border); background: #fff; color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s; font-family: var(--font-body); }
    .bp-msg-status-pill.active { background: var(--pill-color, var(--theme-accent)); color: #fff; border-color: var(--pill-color, var(--theme-accent)); }
    .bp-msg-status-pill:first-child.active { background: var(--color-text-primary); border-color: var(--color-text-primary); }
    .bp-msg-status-count  { background: rgba(255,255,255,0.25); border-radius: 20px; padding: 0 5px; font-size: 10px; }
    .bp-msg-layout  { display: grid; grid-template-columns: 220px 1fr; flex: 1; min-height: 0; overflow: hidden; }
    .bp-msg-sidebar { border-right: 0.5px solid var(--color-border); background: var(--color-surface); display: flex; flex-direction: column; overflow-y: auto; }
    .bp-msg-sidebar-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--theme-accent); padding: 16px 16px 10px; flex-shrink: 0; }
    .bp-msg-folder { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; cursor: pointer; font-size: 13px; color: var(--color-text-secondary); border-left: 2px solid transparent; transition: background 0.15s, color 0.15s; }
    .bp-msg-folder:hover { background: var(--theme-bg); color: var(--color-text-primary); }
    .bp-msg-folder.active { background: var(--theme-bg); color: var(--theme-accent); border-left-color: var(--theme-accent); font-weight: 500; }
    .bp-msg-folder-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bp-msg-folder-badge { background: var(--theme-accent); color: #fff; font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 20px; flex-shrink: 0; margin-left: 6px; }
    .bp-msg-folder-divider { border-top: 0.5px solid var(--color-border); margin: 8px 0; flex-shrink: 0; }
    .bp-msg-folder-group-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted); padding: 4px 16px 6px; flex-shrink: 0; }
    .bp-msg-folder-empty { font-size: 12px; color: var(--color-text-muted); padding: 12px 16px; line-height: 1.5; }
    .bp-msg-thread { display: flex; flex-direction: column; overflow: hidden; }
    .bp-msg-thread-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 0.5px solid var(--color-border); background: #fff; flex-shrink: 0; gap: 10px; }
    .bp-msg-thread-title { font-size: 14px; font-weight: 600; color: var(--color-text-primary); }
    .bp-msg-thread-status-tag { font-size: 11px; font-weight: 500; padding: 2px 10px; border-radius: 20px; border: 0.5px solid; margin-left: 8px; }
    .bp-msg-thread-count { font-size: 12px; color: var(--color-text-muted); white-space: nowrap; }
    .bp-messages-list { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; background: var(--color-bg); }
    .bp-msg-empty { font-size: 13px; color: var(--color-text-muted); text-align: center; padding: 40px 0; line-height: 1.6; }
    .bp-msg-date { font-size: 11px; color: var(--color-text-muted); text-align: center; margin: 12px 0 4px; text-transform: uppercase; letter-spacing: 0.06em; }
    .bp-msg-row { display: flex; justify-content: flex-start; }
    .bp-msg-outbound { justify-content: flex-end; }
    .bp-msg-bubble { max-width: 70%; background: #fff; border: 0.5px solid var(--color-border); border-radius: 12px 12px 12px 2px; padding: 10px 14px; }
    .bp-msg-bubble-out { background: var(--theme-bg); border-color: var(--theme-border); border-radius: 12px 12px 2px 12px; }
    .bp-msg-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
    .bp-msg-sender { font-size: 11px; font-weight: 600; color: var(--color-text-primary); }
    .bp-msg-cat-tag { font-size: 10px; font-weight: 500; color: var(--theme-accent); background: var(--theme-bg); border: 0.5px solid var(--theme-border); border-radius: 10px; padding: 1px 7px; }
    .bp-msg-time { font-size: 10px; color: var(--color-text-muted); margin-left: auto; }
    .bp-msg-body { font-size: 13px; color: var(--color-text-primary); line-height: 1.5; white-space: pre-wrap; margin: 0; }
    .bp-msg-status-row { display: flex; gap: 4px; margin-top: 8px; flex-wrap: wrap; }
    .bp-msg-tag-btn { font-size: 10px; font-weight: 500; padding: 2px 8px; border-radius: 20px; border: 0.5px solid var(--tag-color); color: var(--tag-color); background: transparent; cursor: pointer; font-family: var(--font-body); transition: all 0.15s; }
    .bp-msg-tag-btn.active { background: var(--tag-color); color: #fff; }
    .bp-compose { display: flex; gap: 8px; padding: 14px 20px; border-top: 0.5px solid var(--color-border); background: #fff; flex-shrink: 0; }
    .bp-compose-input { flex: 1; }
    @media (max-width: 768px) {
      .bp-msg-layout { grid-template-columns: 1fr; }
      .bp-msg-sidebar { flex-direction: row; overflow-x: auto; border-right: none; border-bottom: 0.5px solid var(--color-border); scrollbar-width: none; }
      .bp-msg-sidebar::-webkit-scrollbar { display: none; }
      .bp-msg-sidebar-title, .bp-msg-folder-divider, .bp-msg-folder-group-label { display: none; }
      .bp-msg-folder { border-left: none; border-bottom: 2px solid transparent; padding: 8px 14px; white-space: nowrap; flex-shrink: 0; }
      .bp-msg-folder.active { border-bottom-color: var(--theme-accent); border-left: none; background: transparent; }
    }
  `]
})
export class GlobalMessagesComponent implements OnInit {
  loading = true;
  msgs: Message[] = [];
  folders: CategoryFolder[] = [];
  projects: Project[] = [];
  projectOptions: any[] = [];
  selectedProjectId = '';
  activeFolderId = 'all';
  activeStatus = 'all';
  newMsg = '';
  sending = false;
  statuses = MSG_STATUSES;
  private lastDate = '';
  private msgStatuses: Record<string, string> = {};
  private orgId = '';

  @ViewChild('messageList') messageList?: ElementRef;

  constructor(
    private msgSvc: MsgSvc,
    private projectSvc: ProjectService,
    private projectCategorySvc: ProjectCategoryService,
    private orgSvc: OrgService,
    private shellCtx: ShellContextService,
    private toast: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.shellCtx.set({ heroTitle: 'Messages', heroSub: '', pills: [], tabs: [] });

    this.orgSvc.getCurrentOrg().subscribe(org => {
      if (org) {
        this.orgId = org.id;
        this.loadAllMessages();
      }
    });

    this.projectSvc.getAll().subscribe({
      next: projects => {
        this.projects = projects || [];
        this.projectOptions = [
          { name: 'All Projects', id: '' },
          ...this.projects.map(p => ({ name: p.event_name || p.name, id: p.id }))
        ];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  onProjectChange() {
    this.folders = [];
    this.msgs = [];
    this.activeFolderId = 'all';
    this.lastDate = '';
    if (this.selectedProjectId) {
      this.loadCategories();
      this.loadProjectMessages();
    } else {
      this.loadAllMessages();
    }
  }

  loadCategories() {
    this.projectCategorySvc.getByProject(this.selectedProjectId).subscribe({
      next: cats => {
        this.folders = (cats || []).map(c => ({ id: c.id, name: c.name || 'Unnamed', actionCount: 0 }));
        this.updateFolderCounts();
        this.cdr.detectChanges();
      }
    });
  }

  loadAllMessages() {
    if (!this.orgId) return;
    this.msgSvc.getAllByOrg(this.orgId).subscribe({
      next: msgs => { this.msgs = msgs || []; this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  loadProjectMessages() {
    this.msgSvc.getByProject(this.selectedProjectId).subscribe({
      next: msgs => {
        this.msgs = msgs || [];
        this.msgs.forEach(m => { if ((m as any).msg_status) this.msgStatuses[m.id] = (m as any).msg_status; });
        this.updateFolderCounts();
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  updateFolderCounts() {
    this.folders = this.folders.map(f => ({
      ...f,
      actionCount: this.msgs.filter(m => m.direction === 'inbound' && (m as any).category_id === f.id && this.getMsgStatus(m) === 'action_needed').length
    }));
  }

  setFolder(id: string) { this.activeFolderId = id; this.lastDate = ''; this.cdr.detectChanges(); }

  activeFolderName(): string {
    if (this.activeFolderId === 'all') return 'All Messages';
    return this.folders.find(f => f.id === this.activeFolderId)?.name || '';
  }

  filteredMsgs(): Message[] {
    this.lastDate = '';
    let result = this.msgs;
    if (this.activeFolderId !== 'all') result = result.filter(m => (m as any).category_id === this.activeFolderId);
    if (this.activeStatus !== 'all') result = result.filter(m => this.getMsgStatus(m) === this.activeStatus);
    return result;
  }

  countByStatus(statusId: string): number { return this.msgs.filter(m => this.getMsgStatus(m) === statusId).length; }
  actionCount(folderId: string): number {
    if (folderId === 'all') return this.msgs.filter(m => m.direction === 'inbound' && this.getMsgStatus(m) === 'action_needed').length;
    return this.folders.find(f => f.id === folderId)?.actionCount || 0;
  }
  getMsgStatus(m: Message): string { return this.msgStatuses[m.id] || (m as any).msg_status || ''; }
  setMsgStatus(m: Message, statusId: string) {
    const newStatus = this.getMsgStatus(m) === statusId ? '' : statusId;
    this.msgStatuses[m.id] = newStatus;
    this.msgSvc.update(m.id, { msg_status: newStatus }).subscribe({ next: () => { this.updateFolderCounts(); this.cdr.detectChanges(); } });
    this.updateFolderCounts(); this.cdr.detectChanges();
  }
  statusLabel(id: string): string { return MSG_STATUSES.find(s => s.id === id)?.label || ''; }
  statusColor(id: string): string { return MSG_STATUSES.find(s => s.id === id)?.color || ''; }
  shouldShowDate(m: Message): boolean {
    const d = m.created_at ? new Date(m.created_at).toDateString() : '';
    if (d !== this.lastDate) { this.lastDate = d; return true; }
    return false;
  }
  composePlaceholder(): string {
    if (this.activeFolderId === 'all') return 'Type a message...';
    return `Message re: ${this.activeFolderName()}...`;
  }
  send() {
    if (!this.newMsg?.trim() || !this.selectedProjectId) return;
    this.sending = true;
    const categoryId = this.activeFolderId !== 'all' ? this.activeFolderId : undefined;
    this.msgSvc.create({ project_id: this.selectedProjectId, body: this.newMsg, direction: 'outbound', subject: 'Message', ...(categoryId ? { category_id: categoryId } : {}) }).subscribe({
      next: () => { this.newMsg = ''; this.sending = false; this.loadProjectMessages(); },
      error: () => { this.sending = false; this.toast.add({ severity: 'error', summary: 'Failed to send', life: 3000 }); this.cdr.detectChanges(); }
    });
  }
}
