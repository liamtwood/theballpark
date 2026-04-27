import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ChipsModule } from 'primeng/chips';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { StatCardComponent } from '../../../shared/components/stat-card/stat-card.component';

import {
  MarketingService, ContentField, WelcomeSettings, SignupRow
} from '../../../core/services/marketing.service';

type Tab = 'signups' | 'content' | 'settings';

const ROLE_OPTIONS = [
  'Agency producer',
  'Freelance producer',
  'Supplier',
  'Brand / in-house',
  'Just curious'
];

@Component({
  selector: 'app-early-access',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, DatePipe, LucideAngularModule,
    ButtonModule, InputTextModule, InputTextareaModule, ChipsModule, ToastModule,
    LoadingSpinnerComponent, StatCardComponent
  ],
  providers: [MessageService],
  template: `
    <p-toast></p-toast>

    <div class="bp-ea-page">
      <h2 class="bp-page-title">Early Access</h2>

      <!-- Sub-tab switcher -->
      <div class="bp-ea-tabs" role="tablist">
        <button class="bp-ea-tab" [class.active]="tab === 'signups'"  (click)="setTab('signups')">Signups</button>
        <button class="bp-ea-tab" [class.active]="tab === 'content'"  (click)="setTab('content')">Page content</button>
        <button class="bp-ea-tab" [class.active]="tab === 'settings'" (click)="setTab('settings')">Notification settings</button>
      </div>

      <!-- ╭───────────────╮ -->
      <!-- │ TAB: SIGNUPS  │ -->
      <!-- ╰───────────────╯ -->
      <ng-container *ngIf="tab === 'signups'">

        <!-- Stat tiles -->
        <div class="bp-ea-stats">
          <app-stat-card label="TOTAL"     [value]="stats.total"     sub="all-time" [themed]="true"></app-stat-card>
          <app-stat-card label="TODAY"     [value]="stats.today"     sub="signed up today"></app-stat-card>
          <app-stat-card label="THIS WEEK" [value]="stats.this_week" sub="last 7 days"></app-stat-card>
          <app-stat-card label="TOP ROLE"  [value]="topRole.label"   [sub]="topRole.count + ' signups'"></app-stat-card>
        </div>

        <!-- Filters bar -->
        <div class="bp-ea-filters">
          <div class="bp-ea-search">
            <i class="pi pi-search"></i>
            <input pInputText
                   [(ngModel)]="searchTerm"
                   (ngModelChange)="onSearchChange()"
                   placeholder="Search name, email, company…"/>
          </div>

          <div class="bp-ea-role-chips">
            <button *ngFor="let r of roleOptions"
                    class="bp-ea-chip"
                    [class.active]="roleFilters.has(r)"
                    (click)="toggleRoleFilter(r)">
              {{ r }}
              <span class="bp-ea-chip-count">{{ stats.by_role[r] || 0 }}</span>
            </button>
          </div>

          <div class="bp-ea-actions">
            <button class="bp-ea-sort" (click)="toggleSort()" [title]="sort === 'newest' ? 'Newest first' : 'Oldest first'">
              <lucide-icon [name]="sort === 'newest' ? 'chevron-down' : 'chevron-up'" [size]="14"></lucide-icon>
              {{ sort === 'newest' ? 'Newest' : 'Oldest' }}
            </button>
            <p-button label="Export CSV" icon="pi pi-download" styleClass="p-button-outlined"
                      (onClick)="exportCsv()" [disabled]="!filteredRows.length"></p-button>
          </div>
        </div>

        <!-- List -->
        <app-loading *ngIf="loadingSignups"></app-loading>

        <div *ngIf="!loadingSignups && !filteredRows.length" class="bp-ea-empty">
          <p class="bp-muted-text">No signups match these filters.</p>
        </div>

        <div *ngIf="!loadingSignups && filteredRows.length" class="bp-ea-list">
          <div *ngFor="let row of filteredRows; let last = last"
               class="bp-ea-row"
               [style.border-bottom]="!last ? '0.5px solid var(--color-border)' : 'none'">
            <div class="bp-ea-row-main">
              <div class="bp-ea-row-name">{{ row.name }}</div>
              <div class="bp-ea-row-meta">
                <span>{{ row.email }}</span>
                <span *ngIf="row.company"> · {{ row.company }}</span>
              </div>
            </div>
            <span class="bp-ea-role-pill">{{ row.role }}</span>
            <div class="bp-ea-row-time" [title]="row.created_at | date:'medium'">
              {{ relativeTime(row.created_at) }}
            </div>
          </div>
        </div>
      </ng-container>

      <!-- ╭───────────────╮ -->
      <!-- │ TAB: CONTENT  │ -->
      <!-- ╰───────────────╯ -->
      <ng-container *ngIf="tab === 'content'">
        <app-loading *ngIf="loadingContent"></app-loading>

        <ng-container *ngIf="!loadingContent">
          <div class="bp-ea-content-header">
            <p class="bp-muted-text">Edit the public welcome page copy. Changes go live immediately on /welcome.</p>
            <a href="/welcome" target="_blank" rel="noopener" class="bp-ea-preview-link">
              <lucide-icon name="sparkles" [size]="14"></lucide-icon>
              Preview page
            </a>
          </div>

          <div *ngFor="let group of contentGroups" class="bp-ea-content-card">
            <div class="bp-ea-content-card-header">
              <h3 class="bp-ea-content-card-title">Slide {{ group.slide }} · {{ group.title }}</h3>
              <p-button label="Save changes"
                        styleClass="p-button-outlined"
                        [disabled]="!group.dirty"
                        (onClick)="saveSlide(group)"></p-button>
            </div>

            <div *ngFor="let f of group.fields" class="bp-ea-field">
              <label class="bp-field-label">{{ f.label }}</label>

              <input *ngIf="f.field_type === 'text'"
                     pInputText
                     [(ngModel)]="f.value"
                     (ngModelChange)="markGroupDirty(group)"
                     class="bp-input-edit w-full"/>

              <textarea *ngIf="f.field_type === 'longtext'"
                        pInputTextarea
                        rows="3"
                        [(ngModel)]="f.value"
                        (ngModelChange)="markGroupDirty(group)"
                        class="bp-input-edit w-full"></textarea>

              <input *ngIf="f.field_type === 'list'"
                     pInputText
                     [(ngModel)]="f.value"
                     (ngModelChange)="markGroupDirty(group)"
                     class="bp-input-edit w-full"
                     placeholder="Comma-separated"/>

              <p *ngIf="f.help_text" class="bp-ea-help">{{ f.help_text }}</p>
            </div>
          </div>
        </ng-container>
      </ng-container>

      <!-- ╭────────────────╮ -->
      <!-- │ TAB: SETTINGS  │ -->
      <!-- ╰────────────────╯ -->
      <ng-container *ngIf="tab === 'settings'">
        <app-loading *ngIf="loadingSettings"></app-loading>

        <ng-container *ngIf="!loadingSettings && settings">
          <div class="bp-ea-settings-grid">

            <!-- Form column -->
            <div class="bp-ea-settings-form">
              <div class="bp-ea-field">
                <label class="bp-field-label">Notification recipients</label>
                <p-chips [(ngModel)]="settings.notify_recipients"
                         separator=","
                         placeholder="Add email and press Enter"
                         [allowDuplicate]="false"
                         styleClass="w-full"></p-chips>
                <p class="bp-ea-help">Min 1, max 10. New signups send a single email to all listed addresses.</p>
              </div>

              <div class="bp-ea-field">
                <label class="bp-field-label">Email subject</label>
                <input pInputText [(ngModel)]="settings.email_subject" class="bp-input-edit w-full"/>
                <p class="bp-ea-help">Variables: <code>{{ '{{name}}' }}</code> <code>{{ '{{email}}' }}</code> <code>{{ '{{company}}' }}</code> <code>{{ '{{role}}' }}</code> <code>{{ '{{created_at}}' }}</code></p>
              </div>

              <div class="bp-ea-field">
                <label class="bp-field-label">Email body template</label>
                <textarea pInputTextarea rows="10"
                          [(ngModel)]="settings.email_body_template"
                          class="bp-input-edit w-full"></textarea>
                <p class="bp-ea-help">Same variables as subject, plus <code>{{ '{{admin_url}}' }}</code>.</p>
              </div>

              <div class="bp-ea-settings-actions">
                <p-button label="Send test email" icon="pi pi-send"
                          styleClass="p-button-outlined"
                          [disabled]="testing || !settings.notify_recipients?.length"
                          (onClick)="sendTest()"></p-button>
                <p-button label="Save settings" icon="pi pi-check"
                          [disabled]="saving"
                          (onClick)="saveSettings()"></p-button>
              </div>
            </div>

            <!-- Preview column -->
            <aside class="bp-ea-settings-preview">
              <div class="bp-ea-preview-label">PREVIEW · sample data</div>
              <div class="bp-ea-preview-pane">
                <div class="bp-ea-preview-subject">{{ previewSubject }}</div>
                <pre class="bp-ea-preview-body">{{ previewBody }}</pre>
              </div>
              <p class="bp-ea-help">Sample registrant: <strong>Jane Doe</strong> · jane&#64;studio.com · Studio Example · Agency producer</p>
            </aside>

          </div>
        </ng-container>
      </ng-container>
    </div>
  `,
  styles: [`
    .bp-ea-page { max-width: 1080px; margin: 0 auto; padding: 0 var(--section-pad); }

    /* ── Sub-tabs ─────────────────── */
    .bp-ea-tabs {
      display: flex; gap: 4px;
      border-bottom: 0.5px solid var(--color-border);
      margin-bottom: 24px;
    }
    .bp-ea-tab {
      background: transparent; border: none;
      padding: 10px 16px; cursor: pointer;
      font-family: var(--font-body); font-size: 13px; font-weight: 500;
      color: var(--color-text-secondary);
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: color 0.15s, border-color 0.15s;
    }
    .bp-ea-tab:hover { color: var(--color-text-primary); }
    .bp-ea-tab.active {
      color: var(--theme-accent);
      border-bottom-color: var(--theme-accent);
      font-weight: 600;
    }

    /* ── Stat tiles ───────────────── */
    .bp-ea-stats {
      display: grid; grid-template-columns: repeat(4, 1fr);
      border: 0.5px solid var(--color-border);
      border-radius: 6px;
      margin-bottom: 24px;
      background: #fff;
    }
    @media (max-width: 768px) {
      .bp-ea-stats { grid-template-columns: repeat(2, 1fr); }
    }

    /* ── Filters bar ──────────────── */
    .bp-ea-filters {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) auto auto;
      gap: 12px; align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .bp-ea-search {
      position: relative;
      display: flex; align-items: center;
    }
    .bp-ea-search i {
      position: absolute; left: 10px;
      color: var(--color-text-muted);
      font-size: 12px;
      pointer-events: none;
    }
    .bp-ea-search input {
      width: 100%; padding-left: 30px;
    }
    .bp-ea-role-chips {
      display: flex; flex-wrap: wrap; gap: 6px;
      grid-column: 1 / -1;
    }
    .bp-ea-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px;
      background: #fff; border: 0.5px solid var(--color-border);
      border-radius: 999px;
      cursor: pointer;
      font-family: var(--font-body); font-size: 12px;
      color: var(--color-text-secondary);
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .bp-ea-chip:hover { color: var(--color-text-primary); }
    .bp-ea-chip.active {
      background: var(--theme-accent);
      color: #fff;
      border-color: var(--theme-accent);
    }
    .bp-ea-chip-count {
      font-size: 10px;
      opacity: 0.7;
    }
    .bp-ea-actions {
      display: flex; gap: 8px; align-items: center;
    }
    .bp-ea-sort {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 6px 12px;
      background: #fff;
      border: 0.5px solid var(--color-border);
      border-radius: 999px;
      cursor: pointer;
      font-size: 12px;
      color: var(--color-text-secondary);
    }
    .bp-ea-sort:hover { color: var(--color-text-primary); }

    /* ── Signups list ─────────────── */
    .bp-ea-empty {
      padding: 48px 0;
      text-align: center;
    }
    .bp-ea-list {
      background: #fff;
      border: 0.5px solid var(--color-border);
      border-radius: 6px;
      overflow: hidden;
    }
    .bp-ea-row {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 16px; align-items: center;
      padding: 14px 18px;
    }
    .bp-ea-row-main { min-width: 0; }
    .bp-ea-row-name {
      font-weight: 600;
      font-size: 14px;
      color: var(--color-text-primary);
      margin-bottom: 2px;
    }
    .bp-ea-row-meta {
      font-size: 12px;
      color: var(--color-text-muted);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .bp-ea-role-pill {
      display: inline-flex; align-items: center;
      padding: 3px 10px;
      background: var(--theme-bg);
      color: var(--theme-text);
      border: 0.5px solid var(--theme-border);
      border-radius: 20px;
      font-size: 11px; font-weight: 600;
      white-space: nowrap;
    }
    .bp-ea-row-time {
      font-size: 12px;
      color: var(--color-text-muted);
      white-space: nowrap;
    }

    /* ── Content tab ──────────────── */
    .bp-ea-content-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap; gap: 12px;
    }
    .bp-ea-preview-link {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 14px;
      border: 0.5px solid var(--theme-accent);
      color: var(--theme-accent);
      border-radius: 999px;
      font-size: 12px; font-weight: 600;
      text-decoration: none;
      transition: background 0.15s, color 0.15s;
    }
    .bp-ea-preview-link:hover {
      background: var(--theme-accent);
      color: #fff;
    }
    .bp-ea-content-card {
      background: #fff;
      border: 0.5px solid var(--color-border);
      border-radius: 6px;
      padding: 20px 22px;
      margin-bottom: 16px;
    }
    .bp-ea-content-card-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 0.5px solid var(--color-border);
    }
    .bp-ea-content-card-title {
      font-family: var(--font-display);
      font-size: 18px; font-weight: 400;
      margin: 0;
    }
    .bp-ea-field { margin-bottom: 16px; }
    .bp-ea-field:last-child { margin-bottom: 0; }
    .bp-ea-help {
      margin: 6px 0 0;
      font-size: 11px;
      color: var(--color-text-muted);
    }
    .bp-ea-help code {
      background: var(--theme-bg);
      padding: 1px 5px;
      border-radius: 3px;
      font-family: ui-monospace, 'SF Mono', monospace;
      font-size: 11px;
    }

    /* ── Settings tab ─────────────── */
    .bp-ea-settings-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
      gap: 24px;
    }
    @media (max-width: 900px) { .bp-ea-settings-grid { grid-template-columns: 1fr; } }
    .bp-ea-settings-form { display: flex; flex-direction: column; gap: 16px; }
    .bp-ea-settings-actions {
      display: flex; gap: 8px;
      margin-top: 8px;
      justify-content: flex-end;
    }
    .bp-ea-settings-preview {
      background: var(--theme-bg);
      border: 0.5px solid var(--theme-border);
      border-radius: 6px;
      padding: 16px;
      align-self: flex-start;
      position: sticky; top: 16px;
    }
    .bp-ea-preview-label {
      font-size: 10px; font-weight: 700;
      letter-spacing: 0.15em;
      color: var(--theme-text);
      opacity: 0.7;
      margin-bottom: 10px;
    }
    .bp-ea-preview-pane {
      background: #fff;
      border: 0.5px solid var(--theme-border);
      border-radius: 4px;
      padding: 14px;
      margin-bottom: 10px;
    }
    .bp-ea-preview-subject {
      font-weight: 600;
      font-size: 13px;
      color: var(--color-text-primary);
      padding-bottom: 10px;
      border-bottom: 0.5px solid var(--color-border);
      margin-bottom: 10px;
    }
    .bp-ea-preview-body {
      font-family: ui-monospace, 'SF Mono', monospace;
      font-size: 12px; line-height: 1.55;
      color: var(--color-text-primary);
      white-space: pre-wrap;
      margin: 0;
    }
  `]
})
export class EarlyAccessComponent implements OnInit {
  readonly roleOptions = ROLE_OPTIONS;

  // Tabs
  tab: Tab = 'signups';

  // Signups
  loadingSignups = true;
  rows: SignupRow[] = [];
  stats = { total: 0, today: 0, this_week: 0, by_role: {} as Record<string, number> };
  searchTerm = '';
  roleFilters = new Set<string>();
  sort: 'newest' | 'oldest' = 'newest';
  private searchTimer?: any;

  // Content
  loadingContent = true;
  contentGroups: { slide: number; title: string; fields: ContentField[]; dirty: boolean }[] = [];

  // Settings
  loadingSettings = true;
  settings: WelcomeSettings | null = null;
  saving = false;
  testing = false;

  constructor(
    private marketing: MarketingService,
    private toast: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadSignups();
  }

  // ── Tabs ──────────────────────────────────────────────────────
  setTab(t: Tab) {
    this.tab = t;
    if (t === 'content'  && !this.contentGroups.length) this.loadContent();
    if (t === 'settings' && !this.settings)             this.loadSettings();
    this.cdr.markForCheck();
  }

  // ── Signups ───────────────────────────────────────────────────
  loadSignups() {
    this.loadingSignups = true;
    this.cdr.markForCheck();
    this.marketing.listSignups({
      q: this.searchTerm || undefined,
      roles: this.roleFilters.size ? Array.from(this.roleFilters) : undefined,
      sort: this.sort
    }).subscribe({
      next: (res) => {
        this.rows = res.rows;
        this.stats = res.stats;
        this.loadingSignups = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingSignups = false;
        this.toast.add({ severity: 'error', summary: 'Failed to load signups' });
        this.cdr.markForCheck();
      }
    });
  }

  onSearchChange() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadSignups(), 300);
  }

  toggleRoleFilter(role: string) {
    if (this.roleFilters.has(role)) this.roleFilters.delete(role);
    else this.roleFilters.add(role);
    this.loadSignups();
  }

  toggleSort() {
    this.sort = this.sort === 'newest' ? 'oldest' : 'newest';
    this.loadSignups();
  }

  get filteredRows(): SignupRow[] {
    return this.rows;
  }

  get topRole(): { label: string; count: number } {
    const entries = Object.entries(this.stats.by_role || {});
    if (!entries.length) return { label: '—', count: 0 };
    entries.sort((a, b) => b[1] - a[1]);
    return { label: entries[0][0], count: entries[0][1] };
  }

  exportCsv() {
    if (!this.rows.length) return;
    const header = ['Name', 'Email', 'Company', 'Role', 'Registered', 'Notified'];
    const escape = (v: any) => {
      const s = (v ?? '').toString();
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      header.join(','),
      ...this.rows.map(r => [
        r.name, r.email, r.company || '', r.role,
        new Date(r.created_at).toISOString(),
        r.notified_at ? new Date(r.notified_at).toISOString() : ''
      ].map(escape).join(','))
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ballpark-signups-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  relativeTime(iso: string): string {
    const t = new Date(iso).getTime();
    const diff = (Date.now() - t) / 1000;
    if (diff < 60)         return `${Math.floor(diff)}s ago`;
    if (diff < 3600)       return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)      return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 86400 * 7)  return `${Math.floor(diff / 86400)}d ago`;
    if (diff < 86400 * 30) return `${Math.floor(diff / (86400 * 7))}w ago`;
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ── Content ───────────────────────────────────────────────────
  loadContent() {
    this.loadingContent = true;
    this.cdr.markForCheck();
    this.marketing.getContent().subscribe({
      next: (fields) => {
        this.contentGroups = this.groupBySlide(fields);
        this.loadingContent = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingContent = false;
        this.toast.add({ severity: 'error', summary: 'Failed to load content' });
        this.cdr.markForCheck();
      }
    });
  }

  private groupBySlide(fields: ContentField[]) {
    const TITLES: Record<number, string> = { 1: 'Hero', 2: 'Suppliers', 3: 'Producers', 4: 'Guestlist' };
    const map = new Map<number, ContentField[]>();
    for (const f of fields) {
      if (!map.has(f.slide)) map.set(f.slide, []);
      map.get(f.slide)!.push(f);
    }
    return [1, 2, 3, 4]
      .filter(s => map.has(s))
      .map(s => ({
        slide: s,
        title: TITLES[s],
        fields: map.get(s)!.sort((a, b) => a.display_order - b.display_order),
        dirty: false
      }));
  }

  markGroupDirty(group: { dirty: boolean }) {
    group.dirty = true;
    this.cdr.markForCheck();
  }

  saveSlide(group: { fields: ContentField[]; dirty: boolean; slide: number; title: string }) {
    const updates = group.fields.map(f => ({ key: f.key, value: f.value }));
    this.marketing.patchContent(updates).subscribe({
      next: () => {
        group.dirty = false;
        this.toast.add({ severity: 'success', summary: `Slide ${group.slide} saved` });
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.add({ severity: 'error', summary: 'Save failed' });
      }
    });
  }

  // ── Settings ──────────────────────────────────────────────────
  loadSettings() {
    this.loadingSettings = true;
    this.cdr.markForCheck();
    this.marketing.getSettings().subscribe({
      next: (s) => {
        this.settings = s;
        this.loadingSettings = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingSettings = false;
        this.toast.add({ severity: 'error', summary: 'Failed to load settings' });
        this.cdr.markForCheck();
      }
    });
  }

  saveSettings() {
    if (!this.settings) return;
    const recipients = this.settings.notify_recipients || [];
    if (!recipients.length || recipients.length > 10) {
      this.toast.add({ severity: 'warn', summary: 'Recipients must be 1–10' });
      return;
    }
    if (!recipients.every(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))) {
      this.toast.add({ severity: 'warn', summary: 'Invalid email in recipients' });
      return;
    }
    this.saving = true;
    this.cdr.markForCheck();
    this.marketing.updateSettings({
      notify_recipients:   recipients,
      email_subject:       this.settings.email_subject,
      email_body_template: this.settings.email_body_template
    }).subscribe({
      next: (s) => {
        this.settings = s;
        this.saving = false;
        this.toast.add({ severity: 'success', summary: 'Settings saved' });
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        this.toast.add({ severity: 'error', summary: 'Save failed' });
        this.cdr.markForCheck();
      }
    });
  }

  sendTest() {
    if (!this.settings) return;
    this.testing = true;
    this.cdr.markForCheck();
    this.marketing.sendTestEmail({
      recipients:   this.settings.notify_recipients || [],
      subject:      this.settings.email_subject,
      body_template: this.settings.email_body_template
    }).subscribe({
      next: () => {
        this.testing = false;
        this.toast.add({ severity: 'success', summary: 'Test email sent' });
        this.cdr.markForCheck();
      },
      error: () => {
        this.testing = false;
        this.toast.add({ severity: 'error', summary: 'Test email failed — check RESEND_API_KEY' });
        this.cdr.markForCheck();
      }
    });
  }

  // ── Live preview rendering ────────────────────────────────────
  private get sample(): Record<string, string> {
    return {
      name:       'Jane Doe',
      email:      'jane@studio.com',
      company:    'Studio Example',
      role:       'Agency producer',
      created_at: new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' BST',
      admin_url:  'https://theballpark.ai/ballpark-settings/early-access',
      firstName:  'Jane'
    };
  }
  private render(tpl: string): string {
    const s = this.sample;
    return (tpl || '').replace(/\{\{(\w+)\}\}/g, (_, k) => s[k] ?? '');
  }
  get previewSubject(): string { return this.render(this.settings?.email_subject || ''); }
  get previewBody():    string { return this.render(this.settings?.email_body_template || ''); }
}
