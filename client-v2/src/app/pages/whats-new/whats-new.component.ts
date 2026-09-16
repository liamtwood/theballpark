import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { environment } from '../../../environments/environment';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';

interface NoteItem { type: string; text: string; }
interface NoteArea { area: string; items: NoteItem[]; }
interface Fix { ref: string; type: string; reporter: string; text: string; done: boolean; }
interface ChangeEntry {
  version: string;
  name?: string;
  build?: string;
  date: string;
  datetime?: string;
  env: 'preview' | 'dev';
  notes: NoteArea[];
  fixes: Fix[];
}
interface Changelog { dev: ChangeEntry[]; preview: ChangeEntry[]; }

/** pV2-WHATSNEW-REDESIGN-01 — master-detail What's New. Left rail lists releases
 *  grouped On preview / On dev (version + name + date·time); right pane shows the
 *  selected release: a fixes table for a patch, or typed area sections for a
 *  base/feature release. Reads the release-keyed client-v2/public/changelog.json
 *  (npm run changelog). Structured content — no raw markdown. */
@Component({
  selector: 'app-whats-new',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, PageHeroComponent],
  host: { class: 'block' },
  template: `
    <app-page-hero align="block" [back]="{ label: 'Back', href: '/home', history: true }" title="What's new" subtitle="Version history" />

    <div class="bp-page-body bp-page-body--workspace">
      @if (log.isLoading()) {
        <p class="bp-body-small text-secondary">Loading…</p>
      } @else if (log.error()) {
        <p class="bp-body-small text-warn">Couldn't load the version history.</p>
      } @else if (log.value(); as c) {
        <div class="grid gap-6 md:grid-cols-[280px_1fr]">
          <!-- Left rail: grouped release hierarchy. -->
          <aside class="bp-card bp-card--lifted flex flex-col gap-1 p-2">
            @if (c.preview.length) {
              <div class="bp-field-label px-2 pb-1 pt-2">On preview</div>
              @for (v of c.preview; track v.env + v.version) {
                <button type="button" class="rounded-[var(--radius-field)] px-3 py-2 text-left transition-colors"
                        [class.bg-soft]="isActive(v)" [class.hover:bg-fill]="!isActive(v)" (click)="select(v)">
                  <div class="flex items-center gap-2">
                    <span class="bp-body-small font-semibold" [class.text-accent]="isActive(v)">{{ v.version }}</span>
                    @if (v.name) { <span class="bp-caption truncate text-secondary">{{ v.name }}</span> }
                  </div>
                  <div class="bp-meta">{{ fmtWhen(v.datetime || v.date) }}</div>
                </button>
              }
            }
            @if (c.dev.length) {
              <div class="bp-field-label px-2 pb-1 pt-3">On dev — not yet promoted</div>
              @for (v of c.dev; track v.env + v.version) {
                <button type="button" class="rounded-[var(--radius-field)] px-3 py-2 text-left transition-colors"
                        [class.bg-soft]="isActive(v)" [class.hover:bg-fill]="!isActive(v)" (click)="select(v)">
                  <div class="bp-body-small font-semibold" [class.text-accent]="isActive(v)">{{ v.version }}</div>
                  <div class="bp-meta">{{ fmtWhen(v.datetime || v.date) }}</div>
                </button>
              }
            }
          </aside>

          <!-- Right detail: the selected release. -->
          <section>
            @if (selected(); as v) {
              <div class="bp-card bp-card--lifted p-6">
                <header class="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-4">
                  <div class="min-w-0">
                    <h2 class="bp-card-title">{{ v.version }}@if (v.name) { <span class="text-secondary"> · {{ v.name }}</span> }</h2>
                    @if (v.build) { <p class="bp-caption mt-1 text-muted">built from {{ v.build }}</p> }
                  </div>
                  <div class="flex shrink-0 items-center gap-2">
                    <span class="bp-pill bp-body-small" [class]="v.env === 'preview' ? 'bp-pill--success' : 'bp-pill--warn'">
                      {{ v.env === 'preview' ? 'Preview' : 'Dev' }}
                    </span>
                    <span class="bp-meta">{{ fmtWhen(v.datetime || v.date) }}</span>
                  </div>
                </header>

                @if (v.fixes.length) {
                  <!-- Patch release → fixes table (standard table-view grid). -->
                  <div class="mt-4 overflow-hidden rounded-xl border border-hairline bg-surface">
                    <div class="grid grid-cols-[90px_120px_minmax(0,1fr)_130px_40px] gap-x-4 border-b border-hairline bg-fill px-4 py-2">
                      <span class="bp-table-column-header">Ref</span>
                      <span class="bp-table-column-header">Type</span>
                      <span class="bp-table-column-header">Fixed</span>
                      <span class="bp-table-column-header">Reported by</span>
                      <span class="bp-table-column-header"></span>
                    </div>
                    @for (f of v.fixes; track f.ref) {
                      <div class="grid grid-cols-[90px_120px_minmax(0,1fr)_130px_40px] items-start gap-x-4 border-b border-hairline px-4 py-2.5 last:border-b-0">
                        <span class="bp-ref-eyebrow whitespace-nowrap">{{ f.ref }}</span>
                        <span class="bp-body-small text-secondary">{{ f.type }}</span>
                        <span class="bp-body-small text-text">{{ f.text }}</span>
                        <span class="bp-body-small whitespace-nowrap text-secondary">{{ f.reporter }}</span>
                        <span>@if (f.done) { <lucide-icon name="circle-check" [size]="16" class="text-success" /> }</span>
                      </div>
                    }
                  </div>
                } @else {
                  <!-- Base / feature release → typed area sections. -->
                  <div class="mt-4 flex flex-col gap-5">
                    @for (a of v.notes; track a.area) {
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="bp-icon-block h-7 w-7"><lucide-icon [name]="areaIcon(a.area)" [size]="15" /></span>
                          <h3 class="bp-edit-section-title text-md">{{ a.area }}</h3>
                        </div>
                        <ul class="mt-2 flex flex-col gap-2">
                          @for (it of a.items; track it.text) {
                            <li class="flex items-start gap-2">
                              <span class="bp-pill bp-body-small mt-0.5 shrink-0" [class]="chipClass(it.type)">{{ chipLabel(it.type) }}</span>
                              <span class="bp-body-small text-secondary">{{ it.text }}</span>
                            </li>
                          }
                        </ul>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </section>
        </div>
      }
    </div>
  `,
})
export class WhatsNewComponent {
  private readonly http = inject(HttpClient);

  protected readonly log = resource<Changelog, void>({
    loader: () => firstValueFrom(this.http.get<Changelog>(`/changelog.json?v=${encodeURIComponent(environment.build)}`)),
  });

  /** Selected release key ("env:version"); defaults to the newest preview. */
  private readonly selectedKey = signal<string | null>(null);
  private readonly keyOf = (v: ChangeEntry) => `${v.env}:${v.version}`;

  protected readonly selected = computed<ChangeEntry | null>(() => {
    const c = this.log.value();
    if (!c) return null;
    const all = [...c.preview, ...c.dev];
    if (!all.length) return null;
    return all.find((v) => this.keyOf(v) === this.selectedKey()) ?? c.preview[0] ?? c.dev[0] ?? null;
  });

  protected isActive(v: ChangeEntry): boolean {
    const sel = this.selected();
    return !!sel && this.keyOf(sel) === this.keyOf(v);
  }
  protected select(v: ChangeEntry): void {
    this.selectedKey.set(this.keyOf(v));
  }

  /** NATO date (DD-Mmm-YYYY), keeping any "HH:MM" time. Input is the
   *  release-note meta datetime, e.g. "2026-09-16 18:47". */
  private readonly MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  protected fmtWhen(dt: string): string {
    if (!dt) return '';
    const [d, t] = dt.split(' ');
    const [y, m, day] = d.split('-');
    if (!y || !m || !day) return dt;
    const nato = `${day}-${this.MONTHS[+m - 1] ?? m}-${y}`;
    return t ? `${nato} · ${t}` : nato;
  }

  protected chipLabel(t: string): string {
    return t === 'improved' ? 'Improved' : t === 'fixed' ? 'Fixed' : 'New';
  }
  protected chipClass(t: string): string {
    return t === 'improved' ? 'bp-pill--info' : t === 'fixed' ? 'bp-pill--warn' : 'bp-pill--success';
  }

  private readonly AREA_ICONS: Record<string, string> = {
    Projects: 'folder-kanban', Marketplace: 'store', 'Shop Front': 'package', Items: 'package',
    'Taxonomy & Categories': 'tags', Inbox: 'inbox', 'AI Agent': 'sparkles', 'SOW & Invoice': 'file-text',
    Clients: 'building-2', Coachmarks: 'lightbulb', 'Platform & Admin': 'settings', 'Ballpark Base Release': 'rocket',
    'Bug fixes (Beth review)': 'wrench',
  };
  protected areaIcon(area: string): string {
    return this.AREA_ICONS[area] ?? 'sparkles';
  }
}
