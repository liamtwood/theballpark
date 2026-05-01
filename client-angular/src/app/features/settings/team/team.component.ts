import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { SidebarModule } from 'primeng/sidebar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';
import { OrgService } from '../../../core/services/org.service';
import { User } from '../../../models';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

interface InviteCode {
  code: string;
  type: 'Single use' | 'Multi-use';
  expires: string;
}

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TitleCasePipe,
    LucideAngularModule,
    ButtonModule, InputTextModule, DropdownModule, SidebarModule, ToastModule,
    LoadingSpinnerComponent, AvatarComponent, StatusBadgeComponent
  ],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading">
      <div class="bp-team-page">

        <div class="bp-team-title-bar">
          <h2 class="bp-page-title">Team</h2>
        </div>

        <div class="bp-team-body">

          <!-- SIDEBAR: sort + filter -->
          <div class="bp-team-sidebar">
            <div class="bp-sidebar-heading">Sort by</div>
            <div *ngFor="let s of sortOptions"
              class="bp-sidebar-item" [class.active]="teamSort === s.value"
              (click)="setTeamSort(s.value)">
              {{ s.label }}
              <span class="bp-sidebar-arrow">{{ teamSort === s.value ? '↑' : '↕' }}</span>
            </div>

            <hr class="bp-sidebar-divider"/>

            <div class="bp-sidebar-heading">Filter by</div>
            <div class="bp-team-search">
              <i class="pi pi-search" style="color:var(--color-text-muted);font-size:12px;"></i>
              <input pInputText [(ngModel)]="teamSearch" placeholder="Search..."
                class="bp-team-search-input" (ngModelChange)="applyFilters()"/>
            </div>

            <div class="bp-sidebar-sublabel">Role</div>
            <div *ngFor="let r of roleFilters"
              class="bp-sidebar-item" [class.active]="teamRoleFilter === r.value"
              (click)="setRoleFilter(r.value)">
              {{ r.label }}
              <span class="bp-sidebar-count">{{ getRoleCount(r.value) }}</span>
            </div>
          </div>

          <!-- MEMBERS -->
          <div class="bp-team-main">
            <div class="bp-section-header">
              <span class="bp-section-title">MEMBERS</span>
              <div class="flex items-center gap-2">
                <p-button label="+ Invite member"
                  styleClass="p-button-outlined bp-section-add-btn"
                  (onClick)="inviteMember()"></p-button>
                <div class="bp-view-toggle">
                  <button class="bp-view-btn" [class.active]="teamView==='list'" (click)="teamView='list'" title="List view">
                    <i class="pi pi-bars"></i>
                  </button>
                  <button class="bp-view-btn" [class.active]="teamView==='grid'" (click)="teamView='grid'" title="Card view">
                    <i class="pi pi-th-large"></i>
                  </button>
                </div>
              </div>
            </div>

            <p *ngIf="filteredUsers.length===0" class="bp-muted-text">No members found.</p>

            <!-- LIST VIEW -->
            <ng-container *ngIf="teamView==='list'">
              <div *ngFor="let u of filteredUsers; let last = last"
                class="bp-member-row bp-member-row-clickable"
                [style.border-bottom]="!last ? '0.5px solid var(--color-border)' : 'none'"
                (click)="viewMember(u)">
                <div class="flex items-center gap-3">
                  <app-avatar [name]="u.name"></app-avatar>
                  <div>
                    <p class="bp-member-name">{{u.name}}</p>
                    <p class="bp-muted-text">{{u.email}}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2" (click)="$event.stopPropagation()">
                  <span class="bp-member-joined" *ngIf="u.joined">{{u.joined}}</span>
                  <app-status-badge [status]="u.role"></app-status-badge>
                  <button class="bp-icon-btn bp-icon-danger" title="Remove" (click)="removeMember(u)">
                    <i class="pi pi-trash"></i>
                  </button>
                </div>
              </div>
            </ng-container>

            <!-- GRID VIEW -->
            <div *ngIf="teamView==='grid'" class="bp-member-grid">
              <div *ngFor="let u of filteredUsers" class="bp-member-card bp-member-row-clickable"
                (click)="viewMember(u)">
                <div class="flex items-center gap-3 mb-3">
                  <app-avatar [name]="u.name" [size]="44"></app-avatar>
                  <div>
                    <p class="bp-member-name">{{u.name}}</p>
                    <p class="bp-muted-text">{{u.email}}</p>
                  </div>
                </div>
                <div class="bp-member-card-footer" (click)="$event.stopPropagation()">
                  <app-status-badge [status]="u.role"></app-status-badge>
                  <button class="bp-icon-btn bp-icon-danger" title="Remove" (click)="removeMember(u)">
                    <i class="pi pi-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- INVITE CODES -->
          <div class="bp-invite-panel">
            <div class="bp-section-header">
              <span class="bp-section-title">INVITE CODES</span>
              <p-button label="+ Generate code" styleClass="p-button-outlined p-button-sm" (onClick)="generateCode()"></p-button>
            </div>
            <p class="bp-muted-text mb-4" style="font-size:11px;">Share a code for colleagues to join without an email invite.</p>

            <p *ngIf="inviteCodes.length === 0" class="bp-muted-text">No codes generated yet.</p>

            <div *ngFor="let c of inviteCodes; let last = last"
              class="bp-code-row" [style.border-bottom]="!last ? '0.5px solid var(--color-border)' : 'none'">
              <div>
                <div class="bp-code-value">{{ c.code }}</div>
                <div class="bp-code-meta">{{ c.type }} · Expires {{ c.expires }}</div>
              </div>
              <button class="bp-copy-btn" (click)="copyCode(c.code)" title="Copy">Copy</button>
            </div>
          </div>

        </div>
      </div>
    </ng-container>

    <!-- INVITE MEMBER DRAWER -->
    <p-sidebar [(visible)]="showInviteDrawer" position="right"
      styleClass="bp-drawer" [style]="{width:'480px'}"
      [showCloseIcon]="false"
      (onHide)="closeInviteDrawer()">
      <ng-template pTemplate="header">
        <div class="bp-drawer-header-row">
          <div class="bp-drawer-header">
            <span class="bp-drawer-label">MEMBER</span>
            <div class="bp-drawer-title">Invite member</div>
          </div>
          <button class="bp-icon-btn" (click)="closeInviteDrawer()" title="Close">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </ng-template>
      <div class="bp-drawer-body">
        <div class="mb-4">
          <label class="bp-field-label">Email address</label>
          <input pInputText [(ngModel)]="inviteForm.email" class="w-full bp-input-edit"
            type="email" placeholder="colleague@company.com"/>
        </div>
        <div>
          <label class="bp-field-label">Role</label>
          <p-dropdown [(ngModel)]="inviteForm.role" [options]="roleOptions"
            optionLabel="label" optionValue="value"
            styleClass="w-full bp-input-edit" placeholder="Select role">
          </p-dropdown>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancel" styleClass="bp-btn-cancel" (onClick)="closeInviteDrawer()"></p-button>
        <p-button label="Send invitation" styleClass="bp-btn-save"
          [disabled]="!inviteForm.email?.includes('@')"
          (onClick)="submitInvite()">
        </p-button>
      </ng-template>
    </p-sidebar>

    <!-- VIEW / EDIT MEMBER DRAWER -->
    <p-sidebar [(visible)]="showEditDrawer" position="right"
      styleClass="bp-drawer" [style]="{width:'480px'}"
      [showCloseIcon]="false"
      (onHide)="closeEditDrawer()">
      <ng-template pTemplate="header">
        <div class="bp-drawer-header-row">
          <div class="bp-drawer-header">
            <span class="bp-drawer-label">MEMBER</span>
            <div class="bp-drawer-title">{{ editForm.name || 'Member' }}</div>
          </div>
          <button class="bp-icon-btn" (click)="closeEditDrawer()" title="Close">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </ng-template>

      <div class="bp-drawer-body">
        <div class="bp-section-header mb-4">
          <span class="bp-section-title">MEMBER DETAILS</span>
          <div class="flex items-center gap-1">
            <ng-container *ngIf="!editingMember">
              <button class="bp-icon-btn" (click)="startEditMember()" title="Edit">
                <lucide-icon name="square-pen" [size]="14"></lucide-icon>
              </button>
            </ng-container>
            <ng-container *ngIf="editingMember">
              <button class="bp-icon-btn bp-icon-save" (click)="submitEdit()"
                [disabled]="!editForm.name?.trim()" title="Save">
                <i class="pi pi-check"></i>
              </button>
              <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEditMember()" title="Cancel">
                <i class="pi pi-times"></i>
              </button>
            </ng-container>
          </div>
        </div>

        <ng-container *ngIf="!editingMember">
          <div class="mb-4">
            <label class="bp-field-label">Name</label>
            <input pInputText [value]="editForm.name" class="w-full bp-field-readonly" readonly/>
          </div>
          <div class="mb-4">
            <label class="bp-field-label">Email address</label>
            <input pInputText [value]="editForm.email" class="w-full bp-field-readonly" readonly/>
          </div>
          <div>
            <label class="bp-field-label">Role</label>
            <input pInputText [value]="editForm.role | titlecase" class="w-full bp-field-readonly" readonly/>
          </div>
        </ng-container>

        <ng-container *ngIf="editingMember">
          <div class="mb-4">
            <label class="bp-field-label">Name</label>
            <input pInputText [(ngModel)]="editForm.name" class="w-full bp-input-edit" placeholder="Full name"/>
          </div>
          <div class="mb-4">
            <label class="bp-field-label">Email address</label>
            <input pInputText [value]="editForm.email" class="w-full bp-field-readonly" readonly/>
          </div>
          <div>
            <label class="bp-field-label">Role</label>
            <p-dropdown [(ngModel)]="editForm.role" [options]="roleOptions"
              optionLabel="label" optionValue="value"
              styleClass="w-full bp-input-edit">
            </p-dropdown>
          </div>
        </ng-container>
      </div>
    </p-sidebar>

    <p-toast></p-toast>
  `,
  styles: [`
    /* ── TEAM LAYOUT ── */
    .bp-team-body    { display: grid; grid-template-columns: 180px 1fr 300px; min-height: calc(100vh - 300px); }
    .bp-team-sidebar { border-right: 0.5px solid var(--color-border); padding: 20px 16px; }
    .bp-team-main    { padding: 20px 28px; border-right: 0.5px solid var(--color-border); }

    /* ── SIDEBAR ── */
    .bp-sidebar-heading  { font-size: 14px; font-weight: 500; color: var(--theme-accent); margin-bottom: 8px; }
    .bp-sidebar-sublabel { font-size: 11px; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin: 10px 0 6px; }
    .bp-sidebar-item     { display: flex; align-items: center; justify-content: space-between; padding: 5px 8px; border-radius: 6px; cursor: pointer; font-size: 12px; color: var(--color-text-secondary); margin-bottom: 2px; transition: background 0.15s; }
    .bp-sidebar-item:hover { background: var(--color-surface); }
    .bp-sidebar-item.active { background: var(--theme-bg); color: var(--theme-text); font-weight: 500; }
    .bp-sidebar-arrow { font-size: 10px; color: var(--color-text-muted); }
    .bp-sidebar-item.active .bp-sidebar-arrow { color: var(--theme-accent); }
    .bp-sidebar-count { font-size: 11px; color: var(--color-text-muted); background: var(--color-surface); padding: 1px 7px; border-radius: 20px; border: 0.5px solid var(--color-border); }
    .bp-sidebar-item.active .bp-sidebar-count { background: var(--theme-bg); color: var(--theme-text); border-color: var(--theme-border); }
    .bp-sidebar-divider { border: none; border-top: 0.5px solid var(--color-border); margin: 16px 0; }
    .bp-team-search { display: flex; align-items: center; gap: 8px; border: 0.5px solid var(--color-border); border-radius: 6px; padding: 5px 10px; margin-bottom: 10px; }
    .bp-team-search:focus-within { border-color: var(--theme-accent); }

    /* ── VIEW TOGGLE ── */
    .bp-view-toggle { display: flex; border: 0.5px solid var(--color-border); border-radius: 6px; overflow: hidden; }
    .bp-view-btn    { width: 30px; height: 28px; display: flex; align-items: center; justify-content: center; border: none; background: var(--color-surface); cursor: pointer; color: var(--color-text-muted); font-size: 13px; transition: all 0.15s; }
    .bp-view-btn.active { background: var(--theme-bg); color: var(--theme-accent); }

    /* Section-header add button — sized to match the view-toggle row. */
    :host ::ng-deep .bp-section-add-btn .p-button {
      height: 30px; padding: 0 12px;
      font-size: 12px; font-weight: 500;
      font-family: var(--font-body);
    }

    /* ── MEMBERS ── */
    .bp-member-row           { display: flex; align-items: center; justify-content: space-between; padding: 10px 8px; }
    .bp-member-row-clickable { cursor: pointer; border-radius: 6px; transition: background 0.15s; }
    .bp-member-row-clickable:hover { background: var(--theme-bg); }
    .bp-member-grid          { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 4px; }
    .bp-member-card          { border: 0.5px solid var(--color-border); border-radius: 10px; padding: 16px; }
    .bp-member-card-footer   { display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 0.5px solid var(--color-border); }
    .bp-member-joined        { font-size: 11px; color: var(--color-text-muted); }
    .bp-member-name          { font-size: var(--text-md); font-weight: 500; color: var(--color-text-primary); margin: 0; }

    /* ── INVITE CODES PANEL ── */
    .bp-invite-panel { padding: 20px 24px; }
    .bp-code-row     { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; }
    .bp-code-value   { font-size: 13px; font-weight: 600; color: var(--color-text-primary); font-family: monospace; letter-spacing: 0.04em; margin-bottom: 3px; }
    .bp-code-meta    { font-size: 11px; color: var(--color-text-muted); }
    .bp-copy-btn     { font-size: 12px; font-weight: 500; color: var(--color-text-secondary); background: var(--color-surface); border: 0.5px solid var(--color-border); border-radius: 6px; padding: 4px 12px; cursor: pointer; transition: all 0.15s; font-family: var(--font-body); }
    .bp-copy-btn:hover { border-color: var(--theme-accent); color: var(--theme-accent); background: var(--theme-bg); }
  `]
})
export class TeamComponent implements OnInit {
  users: User[] = [];
  filteredUsers: User[] = [];
  loading = true;

  teamView: 'list' | 'grid' = 'list';
  teamSort = 'name';
  teamSearch = '';
  teamRoleFilter = 'all';

  sortOptions = [
    { label: 'Name',   value: 'name' },
    { label: 'Joined', value: 'joined' },
    { label: 'Role',   value: 'role' }
  ];

  roleFilters = [
    { label: 'All members', value: 'all' },
    { label: 'Admin',       value: 'admin' },
    { label: 'Member',      value: 'member' }
  ];

  roleOptions = [
    { label: 'Admin',  value: 'admin' },
    { label: 'Member', value: 'member' }
  ];

  // Invite codes — stub data until API is wired
  inviteCodes: InviteCode[] = [
    { code: 'ANCHOR-7X2K', type: 'Single use', expires: '20 Mar 2026' },
    { code: 'ANCHOR-9QWP', type: 'Multi-use',  expires: '30 Apr 2026' },
    { code: 'ANCHOR-RPSD', type: 'Single use', expires: '30 Apr 2026' },
  ];

  showInviteDrawer = false;
  showEditDrawer   = false;
  editingMember    = false;
  selectedMember: User | null = null;
  private memberSnapshot: typeof this.editForm | null = null;

  inviteForm = { email: '', role: 'member' };
  editForm   = { name: '', email: '', role: 'member' };

  constructor(
    private orgSvc: OrgService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.orgSvc.getUsers().subscribe({
      next: (users) => {
        this.users = users || [];
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  getRoleCount(role: string): number {
    if (role === 'all') return this.users.length;
    return this.users.filter(u => u.role === role).length;
  }

  setTeamSort(val: string)   { this.teamSort = val; this.applyFilters(); }
  setRoleFilter(val: string) { this.teamRoleFilter = val; this.applyFilters(); }

  applyFilters() {
    let list = [...this.users];
    if (this.teamRoleFilter !== 'all') list = list.filter(u => u.role === this.teamRoleFilter);
    if (this.teamSearch.trim()) {
      const q = this.teamSearch.toLowerCase();
      list = list.filter(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      if (this.teamSort === 'name')   return (a.name   || '').localeCompare(b.name   || '');
      if (this.teamSort === 'role')   return (a.role   || '').localeCompare(b.role   || '');
      if (this.teamSort === 'joined') return (a.joined || '').localeCompare(b.joined || '');
      return 0;
    });
    this.filteredUsers = list;
    this.cdr.detectChanges();
  }

  inviteMember()      { this.inviteForm = { email: '', role: 'member' }; this.showInviteDrawer = true; }
  closeInviteDrawer() { this.showInviteDrawer = false; }

  submitInvite() {
    if (!this.inviteForm.email?.includes('@')) return;
    this.msg.add({ severity: 'success', summary: `Invitation sent to ${this.inviteForm.email}` });
    this.closeInviteDrawer();
  }

  viewMember(u: User) {
    this.selectedMember = u;
    this.editForm = { name: u.name || '', email: u.email || '', role: u.role || 'member' };
    this.editingMember = false;
    this.showEditDrawer = true;
  }

  startEditMember()  { this.memberSnapshot = { ...this.editForm }; this.editingMember = true; }
  cancelEditMember() { if (this.memberSnapshot) this.editForm = { ...this.memberSnapshot }; this.editingMember = false; }
  closeEditDrawer()  { this.showEditDrawer = false; this.editingMember = false; this.selectedMember = null; }

  submitEdit() {
    if (!this.editForm.name?.trim() || !this.selectedMember) return;
    this.selectedMember.name = this.editForm.name;
    this.selectedMember.role = this.editForm.role as 'admin' | 'member';
    this.editingMember = false;
    this.applyFilters();
    this.msg.add({ severity: 'success', summary: 'Member updated' });
  }

  removeMember(u: User) {
    this.msg.add({ severity: 'warn', summary: `Remove ${u.name} — coming soon` });
  }

  generateCode() {
    // TODO: wire to API
    this.msg.add({ severity: 'info', summary: 'Generate code — coming soon' });
  }

  copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      this.msg.add({ severity: 'success', summary: `${code} copied to clipboard` });
    });
  }
}
