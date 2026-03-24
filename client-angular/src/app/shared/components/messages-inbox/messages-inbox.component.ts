import { Component, OnInit, Input, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule, Warehouse, Headset, Spotlight, Signature, Martini, PersonStanding, ChevronLeft } from 'lucide-angular';
import { MessageService as MsgSvc } from '../../../core/services/message.service';
import { ProjectCategoryService } from '../../../core/services/project-category.service';
import { ProjectService } from '../../../core/services/project.service';
import { OrgService } from '../../../core/services/org.service';
import { ShellContextService } from '../../../core/services/shell-context.service';
import { Project, Message } from '../../../models';
import { GbpPipe } from '../../pipes/gbp.pipe';
import { LoadingSpinnerComponent } from '../loading-spinner/loading-spinner.component';

const STATUSES = [
  { id: 'all',           label: 'All',     color: '' },
  { id: 'action_needed', label: 'Action',  color: '#DC2626' },
  { id: 'follow_up',     label: 'Waiting', color: '#D97706' },
  { id: 'quoted',        label: 'Quoted',  color: '#2563EB' },
  { id: 'booked',        label: 'Booked',  color: '#059669' },
];

interface QuotedItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  accepted: boolean;
}

interface ThreadMessage extends Message {
  supplier_org_id?: string;
  supplier_name?: string;
  category_id?: string;
  category_name?: string;
  msg_status?: string;
  read?: boolean;
  quoted_items?: QuotedItem[];
  project_name?: string;
}

interface VendorThread {
  key: string;
  supplierId: string;
  supplierName: string;
  categoryId: string;
  categoryName: string;
  projectId: string;
  projectName: string;
  latestMsg: ThreadMessage;
  status: string;
  count: number;
  unread: boolean;
  messages: ThreadMessage[];
}

@Component({
  selector: 'app-messages-inbox',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    ButtonModule, InputTextModule, DropdownModule, ToastModule,
    LucideAngularModule,
    GbpPipe, LoadingSpinnerComponent
  ],
  providers: [MessageService, DatePipe],
  template: `
    <app-loading *ngIf="loading"></app-loading>
    <ng-container *ngIf="!loading">

      <!-- ═══════════════════════════════
           LIST VIEW
      ═══════════════════════════════ -->
      <ng-container *ngIf="!activeThread">

        <!-- PROJECT SELECTOR — global only -->
        <div class="bp-msg-project-bar" *ngIf="!boundProjectId">
          <p-dropdown
            [(ngModel)]="selectedProjectId"
            [options]="projectOptions"
            optionLabel="name" optionValue="id"
            styleClass="w-full bp-input-edit"
            placeholder="All projects"
            (onChange)="onProjectChange()">
          </p-dropdown>
        </div>

        <!-- STATUS PILLS -->
        <div class="bp-msg-status-bar">
          <button *ngFor="let s of statuses"
            class="bp-msg-status-pill"
            [class.active]="activeStatus === s.id"
            [style.--pill-color]="s.color"
            (click)="activeStatus = s.id; cdr.detectChanges()">
            {{ s.label }}
            <span *ngIf="s.id !== 'all' && countByStatus(s.id) > 0" class="bp-pill-count">{{ countByStatus(s.id) }}</span>
          </button>
        </div>

        <!-- CATEGORY FOLDERS -->
        <div class="bp-msg-folders" *ngIf="categoryFolders.length > 0">
          <button class="bp-folder-tab" [class.active]="activeFolder === 'all'" (click)="activeFolder = 'all'">All</button>
          <button *ngFor="let f of categoryFolders"
            class="bp-folder-tab" [class.active]="activeFolder === f.id"
            (click)="activeFolder = f.id">{{ f.name }}</button>
        </div>

        <!-- VENDOR LIST -->
        <div class="bp-vendor-list">
          <div *ngIf="filteredThreads().length === 0" class="bp-msg-empty">
            <span *ngIf="!selectedProjectId && !boundProjectId">Select a project or send a quote request to see messages here.</span>
            <span *ngIf="selectedProjectId || boundProjectId">No messages yet. Request quotes from the Build tab.</span>
          </div>

          <div *ngFor="let t of filteredThreads()"
            class="bp-vendor-row"
            [class.unread]="t.unread"
            (click)="openThread(t)">

            <div class="bp-cat-avatar" [ngClass]="'bp-cat-' + statusClass(t.status)">
              <lucide-icon [name]="getCatIcon(t.categoryName)" [size]="20"></lucide-icon>
            </div>

            <div class="bp-vendor-body">
              <div class="bp-vendor-top">
                <span class="bp-vendor-name">{{ t.supplierName }}</span>
                <span class="bp-vendor-time">{{ fmtTime(t.latestMsg.created_at) }}</span>
              </div>
              <div class="bp-vendor-cat">
                {{ t.categoryName }}
                <span *ngIf="!boundProjectId && t.projectName" class="bp-vendor-project"> · {{ t.projectName }}</span>
              </div>
              <div class="bp-vendor-preview">"{{ t.latestMsg.body }}"</div>
            </div>

            <div class="bp-vendor-right">
              <span *ngIf="t.status && t.status !== 'all'" class="bp-vendor-badge" [ngClass]="'bp-badge-' + statusClass(t.status)">
                {{ statusLabel(t.status) }}
              </span>
              <div class="bp-vendor-meta">
                <span class="bp-msg-count">{{ t.count }} msg{{ t.count !== 1 ? 's' : '' }}</span>
                <div *ngIf="t.unread" class="bp-unread-dot"></div>
              </div>
            </div>
          </div>
        </div>

      </ng-container>

      <!-- ═══════════════════════════════
           THREAD VIEW
      ═══════════════════════════════ -->
      <ng-container *ngIf="activeThread">

        <div class="bp-thread-header">
          <div class="bp-thread-top">
            <button class="bp-back-btn" (click)="closeThread()">
              <lucide-icon name="chevron-left" [size]="16"></lucide-icon>
              <span>Messages</span>
            </button>
            <div class="bp-thread-cat-icon" [ngClass]="'bp-cat-' + statusClass(activeThread.status)">
              <lucide-icon [name]="getCatIcon(activeThread.categoryName)" [size]="16"></lucide-icon>
            </div>
            <div class="bp-thread-info">
              <div class="bp-thread-name">{{ activeThread.supplierName }}</div>
              <div class="bp-thread-sub">
                {{ activeThread.categoryName }}
                <span *ngIf="!boundProjectId && activeThread.projectName"> · {{ activeThread.projectName }}</span>
              </div>
            </div>
          </div>
          <div class="bp-thread-status-tags">
            <button *ngFor="let s of statuses.slice(1)"
              class="bp-status-tag"
              [class.active]="activeThread.status === s.id"
              [style.--tag-color]="s.color"
              (click)="setThreadStatus(activeThread, s.id)">
              {{ s.label }}
            </button>
          </div>
        </div>

        <div class="bp-thread-msgs" #messageList>
          <ng-container *ngFor="let m of activeThread.messages">
            <div class="bp-date-sep" *ngIf="shouldShowDate(m)">{{ m.created_at | date:'d MMMM yyyy' }}</div>

            <div class="bp-msg-card"
              [class.bp-msg-read]="m.direction === 'inbound' && m.read"
              [class.bp-msg-unread]="m.direction === 'inbound' && !m.read"
              [class.bp-msg-out]="m.direction === 'outbound'">
              <div class="bp-msg-card-header">
                <span class="bp-msg-card-sender">{{ m.direction === 'outbound' ? 'You' : activeThread.supplierName }}</span>
                <span class="bp-msg-card-time">{{ m.created_at | date:'HH:mm' }}</span>
              </div>
              <div class="bp-msg-card-body">{{ m.body }}</div>

              <div *ngIf="m.quoted_items && m.quoted_items.length > 0" class="bp-quoted-items">
                <div class="bp-quoted-items-label">Quoted items</div>
                <div *ngFor="let item of m.quoted_items" class="bp-quoted-item">
                  <div class="bp-quoted-item-icon">
                    <lucide-icon [name]="getCatIcon(activeThread.categoryName)" [size]="14"></lucide-icon>
                  </div>
                  <div class="bp-quoted-item-body">
                    <div class="bp-quoted-item-name">{{ item.name }}</div>
                    <div class="bp-quoted-item-desc" *ngIf="item.description">{{ item.description }}</div>
                  </div>
                  <div class="bp-quoted-item-right">
                    <div class="bp-quoted-item-price">{{ item.price | gbp }}</div>
                    <button *ngIf="!item.accepted" class="bp-accept-btn" (click)="acceptItem(activeThread, m, item)">Accept</button>
                    <span *ngIf="item.accepted" class="bp-accepted-tag">✓ Accepted</span>
                  </div>
                </div>
              </div>
            </div>
          </ng-container>
        </div>

        <div class="bp-compose">
          <input pInputText [(ngModel)]="newMsg"
            placeholder="Reply to {{ activeThread.supplierName }}..."
            class="bp-compose-input bp-input-edit"
            (keyup.enter)="send()"/>
          <button class="bp-send-btn" [disabled]="!newMsg.trim() || sending" (click)="send()">↑</button>
        </div>

      </ng-container>

    </ng-container>
    <p-toast></p-toast>
  `,
  styles: [`
    .bp-msg-project-bar { padding:10px 14px; background:#fff; border-bottom:0.5px solid var(--color-border); flex-shrink:0; }
    .bp-msg-status-bar { display:flex; gap:6px; padding:10px 14px; border-bottom:0.5px solid var(--color-border); background:#fff; overflow-x:auto; scrollbar-width:none; flex-shrink:0; }
    .bp-msg-status-bar::-webkit-scrollbar { display:none; }
    .bp-msg-status-pill { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:500; border:0.5px solid var(--color-border); background:#fff; color:var(--color-text-secondary); cursor:pointer; font-family:var(--font-body); white-space:nowrap; transition:all 0.15s; }
    .bp-msg-status-pill.active { background:var(--pill-color,#111827); color:#fff; border-color:var(--pill-color,#111827); }
    .bp-pill-count { background:rgba(255,255,255,0.25); border-radius:20px; padding:0 5px; font-size:10px; }
    .bp-msg-folders { display:flex; overflow-x:auto; border-bottom:0.5px solid var(--color-border); background:#fff; scrollbar-width:none; padding:0 8px; flex-shrink:0; }
    .bp-msg-folders::-webkit-scrollbar { display:none; }
    .bp-folder-tab { padding:8px 12px; font-size:12px; font-weight:500; color:var(--color-text-muted); white-space:nowrap; background:none; border:none; border-bottom:2px solid transparent; cursor:pointer; font-family:var(--font-body); flex-shrink:0; }
    .bp-folder-tab.active { color:var(--theme-accent); border-bottom-color:var(--theme-accent); font-weight:600; }
    .bp-vendor-list { background:var(--color-bg); overflow-y:auto; }
    .bp-msg-empty { padding:40px 16px; text-align:center; font-size:13px; color:var(--color-text-muted); line-height:1.6; }
    .bp-vendor-row { display:flex; align-items:center; gap:12px; padding:13px 16px; border-bottom:0.5px solid var(--color-border); background:#fff; cursor:pointer; transition:background 0.15s; }
    .bp-vendor-row:active { background:var(--color-surface); }
    .bp-vendor-row.unread { border-left:3px solid var(--theme-accent); background:#FEFCF8; }
    .bp-cat-avatar { width:44px; height:44px; border-radius:12px; flex-shrink:0; display:flex; align-items:center; justify-content:center; border:0.5px solid; }
    .bp-cat-action  { background:#FEF2F2; border-color:#FECACA; color:#DC2626; }
    .bp-cat-waiting { background:#FFFBEB; border-color:#FDE68A; color:#D97706; }
    .bp-cat-quoted  { background:#EFF6FF; border-color:#BFDBFE; color:#2563EB; }
    .bp-cat-booked  { background:#ECFDF5; border-color:#6EE7B7; color:#059669; }
    .bp-cat-default { background:var(--theme-bg); border-color:var(--theme-border); color:var(--theme-accent); }
    .bp-vendor-body { flex:1; min-width:0; }
    .bp-vendor-top  { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:1px; }
    .bp-vendor-name { font-size:14px; font-weight:600; color:var(--color-text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .bp-vendor-time { font-size:11px; color:var(--color-text-muted); white-space:nowrap; margin-left:6px; flex-shrink:0; }
    .bp-vendor-cat  { font-size:11px; color:var(--color-text-muted); margin-bottom:3px; }
    .bp-vendor-project { color:var(--theme-accent); }
    .bp-vendor-preview { font-size:12px; color:var(--color-text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-style:italic; }
    .bp-vendor-right { display:flex; flex-direction:column; align-items:flex-end; gap:5px; flex-shrink:0; }
    .bp-vendor-badge { font-size:10px; font-weight:600; padding:3px 9px; border-radius:20px; white-space:nowrap; }
    .bp-badge-action  { background:#FEF2F2; color:#DC2626; }
    .bp-badge-waiting { background:#FFFBEB; color:#D97706; }
    .bp-badge-quoted  { background:#EFF6FF; color:#2563EB; }
    .bp-badge-booked  { background:#ECFDF5; color:#059669; }
    .bp-vendor-meta { display:flex; align-items:center; gap:5px; }
    .bp-msg-count   { font-size:10px; color:var(--color-text-muted); }
    .bp-unread-dot  { width:7px; height:7px; border-radius:50%; background:var(--theme-accent); }
    .bp-thread-header { background:var(--theme-bg); border-bottom:0.5px solid var(--theme-border); padding:12px 14px; flex-shrink:0; }
    .bp-thread-top    { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
    .bp-back-btn { display:flex; align-items:center; gap:4px; font-size:12px; color:var(--color-text-muted); background:none; border:none; cursor:pointer; font-family:var(--font-body); flex-shrink:0; padding:0; transition:color 0.15s; }
    .bp-back-btn:hover { color:var(--theme-accent); }
    .bp-thread-cat-icon { width:32px; height:32px; border-radius:8px; flex-shrink:0; display:flex; align-items:center; justify-content:center; border:0.5px solid; }
    .bp-thread-info { flex:1; min-width:0; }
    .bp-thread-name { font-family:var(--font-display); font-size:16px; font-weight:400; color:var(--color-text-primary); }
    .bp-thread-sub  { font-size:11px; color:var(--color-text-muted); }
    .bp-thread-status-tags { display:flex; gap:6px; flex-wrap:wrap; }
    .bp-status-tag { font-size:11px; font-weight:500; padding:3px 10px; border-radius:20px; border:0.5px solid var(--tag-color); color:var(--tag-color); background:#fff; cursor:pointer; font-family:var(--font-body); transition:all 0.15s; }
    .bp-status-tag.active { background:var(--tag-color); color:#fff; }
    .bp-thread-msgs { flex:1; overflow-y:auto; padding:12px 14px; display:flex; flex-direction:column; gap:8px; background:#F9FAFB; min-height:200px; }
    .bp-date-sep { text-align:center; font-size:10px; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:0.06em; margin:4px 0; }
    .bp-msg-card { border-radius:10px; padding:10px 12px; border:0.5px solid; }
    .bp-msg-read   { background:#F3F4F6; border-color:#E5E7EB; }
    .bp-msg-unread { background:#fff; border-color:#E5E7EB; border-left:3px solid var(--theme-accent); border-radius:0 10px 10px 0; }
    .bp-msg-out    { background:#FEFCF0; border-color:#FDE68A; }
    .bp-msg-card-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; }
    .bp-msg-card-sender { font-size:12px; font-weight:600; color:var(--color-text-primary); }
    .bp-msg-card-time   { font-size:10px; color:var(--color-text-muted); }
    .bp-msg-card-body   { font-size:13px; color:var(--color-text-primary); line-height:1.5; }
    .bp-quoted-items { margin-top:10px; border-top:0.5px solid var(--color-border); padding-top:10px; display:flex; flex-direction:column; gap:6px; }
    .bp-quoted-items-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:var(--theme-accent); margin-bottom:4px; }
    .bp-quoted-item { display:flex; align-items:center; gap:10px; background:#fff; border:0.5px solid var(--color-border); border-radius:8px; padding:9px 11px; }
    .bp-quoted-item-icon { width:28px; height:28px; border-radius:7px; background:var(--theme-bg); border:0.5px solid var(--theme-border); display:flex; align-items:center; justify-content:center; color:var(--theme-accent); flex-shrink:0; }
    .bp-quoted-item-body { flex:1; min-width:0; }
    .bp-quoted-item-name { font-size:13px; font-weight:500; color:var(--color-text-primary); }
    .bp-quoted-item-desc { font-size:11px; color:var(--color-text-muted); }
    .bp-quoted-item-right { display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0; }
    .bp-quoted-item-price { font-size:14px; font-weight:700; color:var(--color-text-primary); }
    .bp-accept-btn { font-size:11px; font-weight:600; padding:4px 10px; border-radius:6px; background:var(--theme-accent); color:#fff; border:none; cursor:pointer; font-family:var(--font-body); }
    .bp-accepted-tag { font-size:11px; font-weight:600; padding:4px 10px; border-radius:6px; background:#ECFDF5; color:#059669; border:0.5px solid #6EE7B7; }
    .bp-compose { display:flex; gap:8px; padding:12px 14px; border-top:0.5px solid var(--color-border); background:#fff; flex-shrink:0; align-items:center; }
    .bp-compose-input { flex:1; }
    .bp-send-btn { width:36px; height:36px; border-radius:8px; background:var(--theme-accent); border:none; color:#fff; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .bp-send-btn:disabled { opacity:0.4; cursor:default; }
  `]
})
export class MessagesInboxComponent implements OnInit {
  // When used as project tab, pass the project ID directly
  @Input() boundProjectId = '';
  // When used as global inbox, shows project selector
  @Input() showProjectSelector = false;

  loading = true;
  msgs: ThreadMessage[] = [];
  threads: VendorThread[] = [];
  categoryFolders: { id: string; name: string }[] = [];
  projects: Project[] = [];
  projectOptions: any[] = [];
  selectedProjectId = '';
  activeStatus = 'all';
  activeFolder = 'all';
  activeThread: VendorThread | null = null;
  newMsg = '';
  sending = false;
  statuses = STATUSES;
  private lastDate = '';
  private orgId = '';

  @ViewChild('messageList') messageList?: ElementRef;

  constructor(
    private route: ActivatedRoute,
    private msgSvc: MsgSvc,
    private projectCategorySvc: ProjectCategoryService,
    private projectSvc: ProjectService,
    private orgSvc: OrgService,
    private shellCtx: ShellContextService,
    private toast: MessageService,
    private datePipe: DatePipe,
    public cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Resolve project ID — from @Input or from parent route
    if (!this.boundProjectId) {
      let r = this.route;
      while (r.parent) r = r.parent;
      this.boundProjectId = r.snapshot.paramMap.get('id') || this.route.parent?.snapshot.paramMap.get('id') || '';
    }

    // Check for projectId from query params (from bottom nav in project context)
    const qpProjectId = this.route.snapshot.queryParams['projectId'];
    if (qpProjectId && !this.boundProjectId) {
      this.boundProjectId = qpProjectId;
    }

    this.orgSvc.getCurrentOrg().subscribe(org => {
      if (org) { this.orgId = org.id; }
    });

    if (this.showProjectSelector && !this.boundProjectId) {
      // Global mode — load all projects for selector
      this.projectSvc.getAll().subscribe({
        next: projects => {
          this.projects = projects || [];
          this.projectOptions = [
            { name: 'All Projects', id: '' },
            ...this.projects.map(p => ({ name: p.event_name || p.name, id: p.id }))
          ];
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
    } else if (this.boundProjectId) {
      // Project mode — load categories + messages immediately
      this.loadCategories();
      this.load();
    } else {
      this.loading = false;
    }
  }

  onProjectChange() {
    this.threads = [];
    this.activeThread = null;
    this.categoryFolders = [];
    this.activeFolder = 'all';
    if (this.selectedProjectId) {
      this.loadCategories(this.selectedProjectId);
      this.load(this.selectedProjectId);
    } else {
      this.loadAllMessages();
    }
  }

  loadCategories(pid?: string) {
    const id = pid || this.boundProjectId;
    if (!id) return;
    this.projectCategorySvc.getByProject(id).subscribe({
      next: cats => {
        this.categoryFolders = (cats || []).map(c => ({ id: c.id, name: c.name || 'Unnamed' }));
        this.cdr.detectChanges();
      }
    });
  }

  load(pid?: string) {
    const id = pid || this.boundProjectId;
    if (!id) return;
    this.loading = true;
    this.msgSvc.getByProject(id).subscribe({
      next: msgs => {
        this.msgs = (msgs || []) as ThreadMessage[];
        this.buildThreads();
        this.loading = false;
        this.cdr.detectChanges();
        setTimeout(() => this.scrollBottom(), 50);
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  loadAllMessages() {
    if (!this.orgId) return;
    this.loading = true;
    this.msgSvc.getAllByOrg(this.orgId).subscribe({
      next: msgs => {
        this.msgs = (msgs || []) as ThreadMessage[];
        this.buildThreads();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  buildThreads() {
    const map: Record<string, VendorThread> = {};
    for (const m of this.msgs) {
      const sid = m.supplier_org_id || 'unknown';
      const cid = m.category_id || '';
      const pid = (m as any).project_id || '';
      const key = sid + '_' + cid + '_' + pid;
      if (!map[key]) {
        map[key] = {
          key, supplierId: sid,
          supplierName: m.supplier_name || 'Unknown Supplier',
          categoryId: cid, categoryName: m.category_name || '',
          projectId: pid, projectName: m.project_name || '',
          latestMsg: m, status: '', count: 0, unread: false, messages: []
        };
      }
      map[key].messages.push(m);
      map[key].count++;
      if (new Date(m.created_at) >= new Date(map[key].latestMsg.created_at)) map[key].latestMsg = m;
      if (m.direction === 'inbound' && !m.read) map[key].unread = true;
      if (m.msg_status) map[key].status = m.msg_status;
    }
    this.threads = Object.values(map).sort((a, b) =>
      new Date(b.latestMsg.created_at).getTime() - new Date(a.latestMsg.created_at).getTime()
    );
  }

  filteredThreads(): VendorThread[] {
    let r = this.threads;
    if (this.activeFolder !== 'all') r = r.filter(t => t.categoryId === this.activeFolder);
    if (this.activeStatus !== 'all') r = r.filter(t => t.status === this.activeStatus);
    return r;
  }

  countByStatus(id: string) { return this.threads.filter(t => t.status === id).length; }

  openThread(t: VendorThread) {
    this.activeThread = t;
    this.lastDate = '';
    t.unread = false;
    setTimeout(() => this.scrollBottom(), 50);
  }

  closeThread() {
    this.activeThread = null;
    this.lastDate = '';
  }

  setThreadStatus(t: VendorThread, statusId: string) {
    t.status = t.status === statusId ? '' : statusId;
    t.messages.filter(m => m.direction === 'inbound').forEach(m => {
      m.msg_status = t.status;
      this.msgSvc.update(m.id, { msg_status: t.status }).subscribe();
    });
    this.cdr.detectChanges();
  }

  acceptItem(thread: VendorThread, msg: ThreadMessage, item: QuotedItem) {
    item.accepted = true;
    thread.status = 'booked';
    this.msgSvc.update(msg.id, { accepted_item_id: item.id }).subscribe();
    this.toast.add({ severity: 'success', summary: 'Item accepted', detail: `${item.name} added to your estimate.`, life: 3000 });
    this.cdr.detectChanges();
  }

  send() {
    if (!this.newMsg?.trim() || !this.activeThread) return;
    this.sending = true;
    const pid = this.boundProjectId || this.activeThread.projectId;
    this.msgSvc.create({
      project_id: pid, body: this.newMsg, direction: 'outbound', subject: 'Message',
      category_id: this.activeThread.categoryId, supplier_org_id: this.activeThread.supplierId
    }).subscribe({
      next: () => {
        this.newMsg = '';
        this.sending = false;
        const key = this.activeThread?.key;
        this.load(pid);
        setTimeout(() => {
          this.activeThread = this.threads.find(t => t.key === key) || null;
          this.cdr.detectChanges();
        }, 300);
      },
      error: () => {
        this.sending = false;
        this.toast.add({ severity: 'error', summary: 'Failed to send', life: 3000 });
        this.cdr.detectChanges();
      }
    });
  }

  shouldShowDate(m: ThreadMessage): boolean {
    const d = m.created_at ? new Date(m.created_at).toDateString() : '';
    if (d !== this.lastDate) { this.lastDate = d; return true; }
    return false;
  }

  fmtTime(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (diff === 0) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    if (diff === 1) return 'Yesterday';
    if (diff < 7)  return d.toLocaleDateString('en-GB', { weekday: 'long' });
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  statusLabel(id: string) { return STATUSES.find(s => s.id === id)?.label || ''; }
  statusClass(id: string): string {
    return ({ action_needed: 'action', follow_up: 'waiting', quoted: 'quoted', booked: 'booked' } as any)[id] || 'default';
  }

  getCatIcon(name: string): string {
    const n = (name || '').toLowerCase();
    if (n.includes('structure') || n.includes('set build') || n.includes('stand')) return 'warehouse';
    if (n.includes('lighting')) return 'spotlight';
    if (n.includes('av') || n.includes('audio') || n.includes('technology')) return 'headset';
    if (n.includes('graphics') || n.includes('signage') || n.includes('print') || n.includes('permits')) return 'signature';
    if (n.includes('catering') || n.includes('hospitality') || n.includes('bar')) return 'martini';
    if (n.includes('talent') || n.includes('staffing') || n.includes('entertainment') || n.includes('security')) return 'person-standing';
    return 'warehouse';
  }

  scrollBottom() {
    if (this.messageList?.nativeElement) {
      this.messageList.nativeElement.scrollTop = this.messageList.nativeElement.scrollHeight;
    }
  }
}
