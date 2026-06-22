import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';
import {
  AdminMarketingService,
  ContentField,
  SignupRow,
  WelcomeSettings,
} from '../../../core/admin/admin-marketing.service';

type Tab = 'signups' | 'content' | 'notifications';
type Env = 'dev' | 'preview' | 'master' | 'unknown';

interface SlideGroup {
  slide: number;
  title: string;
  fields: ContentField[];
  dirty: boolean;
}

const SLIDE_TITLES: Record<number, string> = { 1: 'Hero', 2: 'Suppliers', 3: 'Producers', 4: 'Guestlist' };
const ENV_CHIPS: { key: Env; label: string }[] = [
  { key: 'dev', label: 'Dev' },
  { key: 'preview', label: 'Preview' },
  { key: 'master', label: 'Master' },
  { key: 'unknown', label: 'Unknown' },
];

/** pV2-EA-02 — the Early Access admin (port of v1's early-access, on v2
 *  standards + the new signup schema). Three tabs: Signups (env-aware),
 *  Page content, and the admin-Notification half (user-welcome + signature
 *  land in pV2-EA-03). */
@Component({
  selector: 'app-early-access',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [FormsModule, ToastModule, LucideAngularModule],
  providers: [MessageService],
  template: `
    <p-toast position="bottom-right" styleClass="bp-toast" />

    <div class="bp-ea-page">
      <div class="bp-ea-head">
        <div>
          <h1 class="bp-ea-title">Early Access</h1>
          <p class="bp-ea-sub">Waitlist signups, welcome-page copy, and admin notifications.</p>
        </div>
        <a class="bp-ea-preview-link" href="/welcome" target="_blank" rel="noopener">
          <lucide-icon name="external-link" [size]="13" /> Preview welcome page
        </a>
      </div>

      <div class="bp-ea-tabs" role="tablist">
        <button class="bp-ea-tab" [class.active]="tab() === 'signups'" (click)="tab.set('signups')">Signups</button>
        <button class="bp-ea-tab" [class.active]="tab() === 'content'" (click)="openContent()">Page content</button>
        <button class="bp-ea-tab" [class.active]="tab() === 'notifications'" (click)="openNotifications()">Notifications</button>
      </div>

      <!-- ── SIGNUPS ─────────────────────────────────────────────── -->
      @if (tab() === 'signups') {
        @if (signupsRes.value(); as data) {
          <div class="bp-ea-stats">
            <div class="bp-ea-stat"><span class="bp-ea-stat-val">{{ data.stats.total }}</span><span class="bp-ea-stat-lab">Total</span></div>
            <div class="bp-ea-stat"><span class="bp-ea-stat-val">{{ data.stats.today }}</span><span class="bp-ea-stat-lab">Today</span></div>
            <div class="bp-ea-stat"><span class="bp-ea-stat-val">{{ data.stats.this_week }}</span><span class="bp-ea-stat-lab">This week</span></div>
            <div class="bp-ea-stat">
              <span class="bp-ea-stat-val bp-ea-stat-env">
                @for (e of envChips; track e.key) {
                  <span>{{ e.label[0] }}<b>{{ data.stats.by_environment[e.key] || 0 }}</b></span>
                }
              </span>
              <span class="bp-ea-stat-lab">By environment</span>
            </div>
          </div>

          <div class="bp-ea-filters">
            <div class="bp-ea-search">
              <lucide-icon name="search" [size]="14" />
              <input type="text" [ngModel]="search()" (ngModelChange)="onSearch($event)" placeholder="Search name or email…" />
            </div>
            <div class="bp-ea-actions">
              <button class="bp-ea-sort" (click)="toggleSort()">
                <lucide-icon [name]="sort() === 'newest' ? 'chevron-down' : 'chevron-up'" [size]="14" />
                {{ sort() === 'newest' ? 'Newest' : 'Oldest' }}
              </button>
              <button class="bp-btn-outline" [disabled]="!data.rows.length" (click)="exportCsv(data.rows)">
                <lucide-icon name="download" [size]="14" /> Export CSV
              </button>
            </div>
            <div class="bp-ea-chips">
              <button class="bp-ea-chip" [class.active]="!envFilters().size" (click)="clearEnvFilter()">All</button>
              @for (e of envChips; track e.key) {
                <button class="bp-ea-chip" [class.active]="envFilters().has(e.key)" (click)="toggleEnv(e.key)">
                  {{ e.label }} <span class="bp-ea-chip-count">{{ data.stats.by_environment[e.key] || 0 }}</span>
                </button>
              }
            </div>
          </div>

          @if (!data.rows.length) {
            <p class="bp-ea-empty bp-body-small text-secondary">No signups match these filters.</p>
          } @else {
            <div class="bp-ea-table">
              <div class="bp-ea-tr bp-ea-tr--head">
                <span>First name</span><span>Last name</span><span>Email</span><span>Env</span><span>Date</span><span></span>
              </div>
              @for (row of data.rows; track row.id) {
                <div class="bp-ea-tr">
                  <span class="bp-ea-strong">{{ row.first_name }}</span>
                  <span>{{ row.last_name || '—' }}</span>
                  <span class="bp-ea-muted">{{ row.email }}</span>
                  <span><span class="bp-ea-env-pill">{{ row.source_environment }}</span></span>
                  <span class="bp-ea-muted" [title]="row.created_at">{{ relativeTime(row.created_at) }}</span>
                  <span>
                    <button class="bp-ea-del" [disabled]="deletingId() === row.id" [attr.aria-label]="'Remove ' + row.email" (click)="deleteSignup(row)">
                      <lucide-icon name="trash-2" [size]="14" />
                    </button>
                  </span>
                </div>
              }
            </div>
          }
        } @else if (signupsRes.error()) {
          <p class="bp-ea-empty text-warn">Couldn't load signups.</p>
        } @else {
          <p class="bp-ea-empty bp-body-small text-secondary">Loading…</p>
        }
      }

      <!-- ── PAGE CONTENT ────────────────────────────────────────── -->
      @if (tab() === 'content') {
        @if (contentGroups(); as groups) {
          <p class="bp-ea-note bp-body-small text-secondary">Edit the public welcome copy. Changes go live immediately on /welcome.</p>
          @for (group of groups; track group.slide) {
            <div class="bp-card p-5 bp-ea-slide">
              <div class="bp-ea-slide-head">
                <h3 class="bp-edit-section-title">Slide {{ group.slide }} · {{ group.title }}</h3>
                <button class="bp-btn-outline" [disabled]="!group.dirty || savingContent()" (click)="saveSlide(group)">Save changes</button>
              </div>
              @for (f of group.fields; track f.key) {
                <div class="bp-ea-field">
                  <label class="bp-field-label">{{ f.label }}</label>
                  @if (f.field_type === 'longtext') {
                    <textarea class="bp-ea-textarea" rows="3" [ngModel]="f.value" (ngModelChange)="editField(group, f, $event)"></textarea>
                  } @else {
                    <input class="bp-ea-input" type="text" [ngModel]="f.value" (ngModelChange)="editField(group, f, $event)"
                           [placeholder]="f.field_type === 'list' ? 'Comma-separated' : ''" />
                  }
                  @if (f.help_text) { <p class="bp-ea-help">{{ f.help_text }}</p> }
                </div>
              }
            </div>
          }
        } @else {
          <p class="bp-ea-empty bp-body-small text-secondary">Loading…</p>
        }
      }

      <!-- ── NOTIFICATIONS (admin half) ──────────────────────────── -->
      @if (tab() === 'notifications') {
        @if (settings(); as s) {
          <div class="bp-ea-notif">
            <div class="bp-card p-5 bp-ea-notif-form">
              <h3 class="bp-edit-section-title">Admin notification</h3>
              <p class="bp-caption">Sent to the team whenever someone joins the guestlist.</p>

              <div class="bp-ea-field">
                <label class="bp-field-label">Recipients</label>
                <div class="bp-ea-chip-input">
                  @for (r of s.notify_recipients; track r) {
                    <span class="bp-ea-recip">{{ r }}<button type="button" (click)="removeRecipient(r)" aria-label="Remove">×</button></span>
                  }
                  <input type="email" class="bp-ea-recip-input" placeholder="Add email + Enter"
                         [ngModel]="recipientDraft()" (ngModelChange)="recipientDraft.set($event)"
                         (keydown.enter)="addRecipient($event)" />
                </div>
                <p class="bp-ea-help">1–10 addresses. One email goes to all of them.</p>
              </div>

              <div class="bp-ea-field">
                <label class="bp-field-label">Email subject</label>
                <input class="bp-ea-input" type="text" [ngModel]="s.email_subject" (ngModelChange)="patchSettings({ email_subject: $event })" />
                <p class="bp-ea-help">Variables: <code>{{ '{{name}}' }}</code> <code>{{ '{{firstName}}' }}</code> <code>{{ '{{email}}' }}</code> <code>{{ '{{created_at}}' }}</code></p>
              </div>

              <div class="bp-ea-field">
                <label class="bp-field-label">Email body</label>
                <textarea class="bp-ea-textarea" rows="9" [ngModel]="s.email_body_template" (ngModelChange)="patchSettings({ email_body_template: $event })"></textarea>
                <p class="bp-ea-help">Same variables, plus <code>{{ '{{admin_url}}' }}</code>.</p>
              </div>

              <div class="bp-ea-notif-actions">
                <button class="bp-btn-outline" [disabled]="testing() || !s.notify_recipients.length" (click)="sendTest()">
                  <lucide-icon name="send" [size]="14" /> {{ testing() ? 'Sending…' : 'Send test' }}
                </button>
                <button class="bp-btn-grad" [disabled]="savingSettings()" (click)="saveSettings()">
                  {{ savingSettings() ? 'Saving…' : 'Save settings' }}
                </button>
              </div>
            </div>

            <aside class="bp-card p-5 bp-ea-preview">
              <div class="bp-ea-preview-label">Preview · sample data</div>
              <div class="bp-ea-preview-subject">{{ previewSubject() }}</div>
              <pre class="bp-ea-preview-body">{{ previewBody() }}</pre>
            </aside>
          </div>
        } @else {
          <p class="bp-ea-empty bp-body-small text-secondary">Loading…</p>
        }
      }
    </div>
  `,
  styles: `
    .bp-ea-page { max-width: 1080px; margin: 0 auto; padding: 32px 24px; }
    .bp-ea-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 20px; }
    .bp-ea-title { font-size: var(--text-4xl); font-weight: 400; color: var(--color-text-strong); }
    .bp-ea-sub { font-size: var(--text-base); color: var(--color-text-secondary); margin-top: 2px; }
    .bp-ea-preview-link {
      display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
      padding: 6px 12px; border: 1px solid var(--color-border-hairline); border-radius: var(--radius-button);
      background: var(--color-surface); color: var(--theme-accent);
      font-size: var(--text-sm); font-weight: 600; text-decoration: none;
    }
    .bp-ea-preview-link:hover { background: var(--theme-soft); border-color: var(--theme-accent); }

    .bp-ea-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--color-border-hairline); margin-bottom: 24px; }
    .bp-ea-tab {
      background: transparent; border: none; padding: 10px 16px; cursor: pointer;
      font-size: var(--text-sm); font-weight: 500; color: var(--color-text-secondary);
      border-bottom: 2px solid transparent; margin-bottom: -1px;
    }
    .bp-ea-tab:hover { color: var(--color-text); }
    .bp-ea-tab.active { color: var(--theme-accent); border-bottom-color: var(--theme-accent); font-weight: 600; }

    .bp-ea-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    @media (max-width: 768px) { .bp-ea-stats { grid-template-columns: repeat(2, 1fr); } }
    .bp-ea-stat {
      display: flex; flex-direction: column; gap: 2px; padding: 14px 16px;
      border: 1px solid var(--color-border-hairline); border-radius: var(--radius-card); background: var(--color-surface);
    }
    .bp-ea-stat-val { font-size: var(--text-2xl); font-weight: 500; color: var(--color-text-strong); }
    .bp-ea-stat-lab { font-size: var(--text-xs); color: var(--color-text-muted); text-transform: uppercase; letter-spacing: var(--tracking-wide); }
    .bp-ea-stat-env { display: flex; gap: 10px; font-size: var(--text-base); }
    .bp-ea-stat-env b { margin-left: 2px; color: var(--theme-accent); }

    .bp-ea-filters { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; margin-bottom: 16px; }
    .bp-ea-search { position: relative; display: flex; align-items: center; }
    .bp-ea-search lucide-icon { position: absolute; left: 10px; color: var(--color-text-muted); }
    .bp-ea-search input { width: 100%; padding: 8px 12px 8px 32px; border: 1px solid var(--color-border-medium); border-radius: var(--radius-button); background: var(--color-surface); color: var(--color-text); }
    .bp-ea-actions { display: flex; gap: 8px; }
    .bp-ea-sort { display: inline-flex; align-items: center; gap: 4px; padding: 8px 12px; background: var(--color-surface); border: 1px solid var(--color-border-medium); border-radius: 999px; cursor: pointer; font-size: var(--text-sm); color: var(--color-text-secondary); }
    .bp-ea-chips { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 6px; }
    .bp-ea-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; background: var(--color-surface); border: 1px solid var(--color-border-hairline); border-radius: 999px; cursor: pointer; font-size: var(--text-sm); color: var(--color-text-secondary); }
    .bp-ea-chip.active { background: var(--theme-accent); color: var(--theme-accent-contrast); border-color: var(--theme-accent); }
    .bp-ea-chip-count { font-size: var(--text-2xs); opacity: 0.75; }

    .bp-ea-empty { padding: 40px 0; text-align: center; }
    .bp-ea-table { border: 1px solid var(--color-border-hairline); border-radius: var(--radius-card); overflow: hidden; background: var(--color-surface); }
    .bp-ea-tr { display: grid; grid-template-columns: 1fr 1fr 1.6fr auto auto auto; gap: 12px; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--color-border-hairline); font-size: var(--text-sm); }
    .bp-ea-tr:last-child { border-bottom: none; }
    .bp-ea-tr--head { font-size: var(--text-2xs); text-transform: uppercase; letter-spacing: var(--tracking-wide); color: var(--color-text-muted); background: var(--color-surface-sunken, var(--color-surface)); }
    .bp-ea-strong { font-weight: 600; color: var(--color-text); }
    .bp-ea-muted { color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bp-ea-env-pill { padding: 2px 8px; border-radius: 999px; background: var(--theme-soft); color: var(--theme-accent); font-size: var(--text-2xs); font-weight: 600; }
    .bp-ea-del { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: transparent; border: 1px solid transparent; border-radius: 6px; color: var(--color-text-muted); cursor: pointer; }
    .bp-ea-del:hover { color: var(--color-state-error, var(--theme-accent)); border-color: var(--color-border-hairline); }
    .bp-ea-del:disabled { opacity: 0.4; cursor: default; }

    .bp-ea-note { margin-bottom: 16px; }
    .bp-ea-slide { margin-bottom: 16px; }
    .bp-ea-slide-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
    .bp-ea-field { margin-bottom: 14px; }
    .bp-ea-field:last-child { margin-bottom: 0; }
    .bp-ea-input, .bp-ea-textarea { width: 100%; padding: 8px 12px; border: 1px solid var(--color-border-medium); border-radius: var(--radius-button); background: var(--color-surface); color: var(--color-text); font-family: inherit; font-size: var(--text-base); }
    .bp-ea-textarea { resize: vertical; line-height: 1.5; }
    .bp-ea-help { margin: 6px 0 0; font-size: var(--text-xs); color: var(--color-text-muted); }
    .bp-ea-help code { background: var(--color-surface-sunken, var(--theme-soft)); padding: 1px 5px; border-radius: 3px; font-size: var(--text-2xs); }

    .bp-ea-notif { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 16px; }
    @media (max-width: 900px) { .bp-ea-notif { grid-template-columns: 1fr; } }
    .bp-ea-notif-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px; }
    .bp-ea-chip-input { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 6px; border: 1px solid var(--color-border-medium); border-radius: var(--radius-button); background: var(--color-surface); }
    .bp-ea-recip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 4px 2px 10px; border-radius: 999px; background: var(--theme-soft); color: var(--color-text); font-size: var(--text-sm); }
    .bp-ea-recip button { border: none; background: transparent; cursor: pointer; color: var(--color-text-muted); font-size: var(--text-base); line-height: 1; padding: 0 4px; }
    .bp-ea-recip-input { flex: 1; min-width: 140px; border: none; outline: none; background: transparent; padding: 4px; color: var(--color-text); }
    .bp-ea-preview { align-self: flex-start; position: sticky; top: 16px; }
    .bp-ea-preview-label { font-size: var(--text-2xs); font-weight: 700; letter-spacing: var(--tracking-wide); color: var(--color-text-muted); text-transform: uppercase; margin-bottom: 10px; }
    .bp-ea-preview-subject { font-weight: 600; font-size: var(--text-sm); padding-bottom: 10px; border-bottom: 1px solid var(--color-border-hairline); margin-bottom: 10px; }
    .bp-ea-preview-body { font-family: ui-monospace, monospace; font-size: var(--text-xs); line-height: 1.55; white-space: pre-wrap; margin: 0; color: var(--color-text); }
  `,
})
export class EarlyAccessComponent {
  private readonly adminMkt = inject(AdminMarketingService);
  private readonly toast = inject(MessageService);

  protected readonly envChips = ENV_CHIPS;
  protected readonly tab = signal<Tab>('signups');

  // ── Signups (reactive list) ──────────────────────────────────────────
  protected readonly search = signal('');
  private readonly searchDebounced = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  protected readonly envFilters = signal<Set<Env>>(new Set());
  protected readonly sort = signal<'newest' | 'oldest'>('newest');
  protected readonly deletingId = signal<string | null>(null);

  protected readonly signupsRes = resource({
    params: () => ({
      q: this.searchDebounced(),
      envs: [...this.envFilters()],
      sort: this.sort(),
      tab: this.tab(),
    }),
    loader: ({ params }) => {
      if (params.tab !== 'signups') return Promise.resolve(undefined as never);
      return firstValueFrom(this.adminMkt.listSignups({ q: params.q, envs: params.envs, sort: params.sort }));
    },
  });

  protected onSearch(v: string): void {
    this.search.set(v);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.searchDebounced.set(v.trim()), 300);
  }
  protected toggleSort(): void {
    this.sort.update((s) => (s === 'newest' ? 'oldest' : 'newest'));
  }
  protected clearEnvFilter(): void {
    this.envFilters.set(new Set());
  }
  protected toggleEnv(e: Env): void {
    this.envFilters.update((set) => {
      const next = new Set(set);
      next.has(e) ? next.delete(e) : next.add(e);
      return next;
    });
  }

  protected async deleteSignup(row: SignupRow): Promise<void> {
    if (this.deletingId()) return;
    const ok = window.confirm(
      `Remove ${row.email} from the guestlist?\n\nThe record stays in the database (soft-delete) but is hidden from this list. The same email can sign up again.`
    );
    if (!ok) return;
    this.deletingId.set(row.id);
    try {
      await firstValueFrom(this.adminMkt.deleteSignup(row.id));
      this.toast.add({ severity: 'success', summary: 'Removed', detail: row.email, life: 3000 });
      this.signupsRes.reload();
    } catch {
      this.toast.add({ severity: 'error', summary: "Couldn't remove — please try again.", life: 5000 });
    } finally {
      this.deletingId.set(null);
    }
  }

  protected relativeTime(iso: string): string {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  protected exportCsv(rows: SignupRow[]): void {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const header = ['First name', 'Last name', 'Email', 'Environment', 'Registered'];
    const lines = [
      header.join(','),
      ...rows.map((r) => [r.first_name, r.last_name, r.email, r.source_environment, new Date(r.created_at).toISOString()].map(esc).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ballpark-signups-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Page content (lazy editable) ─────────────────────────────────────
  protected readonly contentGroups = signal<SlideGroup[] | null>(null);
  protected readonly savingContent = signal(false);

  protected async openContent(): Promise<void> {
    this.tab.set('content');
    if (this.contentGroups()) return;
    try {
      const fields = await firstValueFrom(this.adminMkt.getContent());
      const bySlide = new Map<number, ContentField[]>();
      for (const f of fields) {
        if (!bySlide.has(f.slide)) bySlide.set(f.slide, []);
        bySlide.get(f.slide)!.push({ ...f });
      }
      const groups = [1, 2, 3, 4]
        .filter((s) => bySlide.has(s))
        .map((s) => ({
          slide: s,
          title: SLIDE_TITLES[s],
          fields: bySlide.get(s)!.sort((a, b) => a.display_order - b.display_order),
          dirty: false,
        }));
      this.contentGroups.set(groups);
    } catch {
      this.toast.add({ severity: 'error', summary: "Couldn't load content.", life: 5000 });
    }
  }

  protected editField(group: SlideGroup, field: ContentField, value: string): void {
    field.value = value;
    this.contentGroups.update((gs) => gs!.map((g) => (g.slide === group.slide ? { ...g, dirty: true } : g)));
  }

  protected async saveSlide(group: SlideGroup): Promise<void> {
    this.savingContent.set(true);
    try {
      await firstValueFrom(this.adminMkt.patchContent(group.fields.map((f) => ({ key: f.key, value: f.value }))));
      this.contentGroups.update((gs) => gs!.map((g) => (g.slide === group.slide ? { ...g, dirty: false } : g)));
      this.toast.add({ severity: 'success', summary: `Slide ${group.slide} saved`, life: 3000 });
    } catch {
      this.toast.add({ severity: 'error', summary: 'Save failed — please try again.', life: 5000 });
    } finally {
      this.savingContent.set(false);
    }
  }

  // ── Notifications (admin half) ───────────────────────────────────────
  protected readonly settings = signal<WelcomeSettings | null>(null);
  protected readonly recipientDraft = signal('');
  protected readonly savingSettings = signal(false);
  protected readonly testing = signal(false);

  protected async openNotifications(): Promise<void> {
    this.tab.set('notifications');
    if (this.settings()) return;
    try {
      const s = await firstValueFrom(this.adminMkt.getSettings());
      this.settings.set({ ...s, notify_recipients: [...(s.notify_recipients ?? [])] });
    } catch {
      this.toast.add({ severity: 'error', summary: "Couldn't load settings.", life: 5000 });
    }
  }

  protected patchSettings(patch: Partial<WelcomeSettings>): void {
    this.settings.update((s) => (s ? { ...s, ...patch } : s));
  }

  protected addRecipient(ev: Event): void {
    ev.preventDefault();
    const email = this.recipientDraft().trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.toast.add({ severity: 'warn', summary: 'Invalid email', life: 3000 });
      return;
    }
    this.settings.update((s) => {
      if (!s || s.notify_recipients.includes(email)) return s;
      return { ...s, notify_recipients: [...s.notify_recipients, email] };
    });
    this.recipientDraft.set('');
  }
  protected removeRecipient(email: string): void {
    this.settings.update((s) => (s ? { ...s, notify_recipients: s.notify_recipients.filter((r) => r !== email) } : s));
  }

  protected async saveSettings(): Promise<void> {
    const s = this.settings();
    if (!s) return;
    if (!s.notify_recipients.length || s.notify_recipients.length > 10) {
      this.toast.add({ severity: 'warn', summary: 'Recipients must be 1–10', life: 4000 });
      return;
    }
    this.savingSettings.set(true);
    try {
      const fresh = await firstValueFrom(this.adminMkt.updateSettings(s));
      this.settings.set({ ...fresh, notify_recipients: [...(fresh.notify_recipients ?? [])] });
      this.toast.add({ severity: 'success', summary: 'Settings saved', life: 3000 });
    } catch {
      this.toast.add({ severity: 'error', summary: 'Save failed — please try again.', life: 5000 });
    } finally {
      this.savingSettings.set(false);
    }
  }

  protected async sendTest(): Promise<void> {
    const s = this.settings();
    if (!s) return;
    this.testing.set(true);
    try {
      await firstValueFrom(this.adminMkt.sendTestEmail({ recipients: s.notify_recipients, subject: s.email_subject, body_template: s.email_body_template }));
      this.toast.add({ severity: 'success', summary: 'Test email sent', life: 3000 });
    } catch {
      this.toast.add({ severity: 'error', summary: 'Test failed — check RESEND_API_KEY', life: 5000 });
    } finally {
      this.testing.set(false);
    }
  }

  // ── Live preview (sample data) ───────────────────────────────────────
  private readonly sample: Record<string, string> = {
    name: 'Jane Doe',
    firstName: 'Jane',
    email: 'jane@studio.com',
    created_at: '27 Apr 2026, 14:32 BST',
    admin_url: 'https://theballpark.ai/ballpark-settings/early-access',
  };
  private render(tpl: string): string {
    return (tpl || '').replace(/\{\{(\w+)\}\}/g, (_, k: string) => this.sample[k] ?? '');
  }
  protected readonly previewSubject = computed(() => this.render(this.settings()?.email_subject ?? ''));
  protected readonly previewBody = computed(() => this.render(this.settings()?.email_body_template ?? ''));
}
