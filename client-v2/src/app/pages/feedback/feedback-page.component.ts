import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { FeedbackService, MyIssue } from '../../core/feedback/feedback.service';
import { ReportIssueDialogComponent } from './report-issue-dialog.component';

/** pV2-WHATSNEW-REDESIGN-01 Part C — the Feedback page: the signed-in user's
 *  own reported issues (JWT-scoped server-side) + the "Report an issue" dialog.
 *  Standard page-hero + workspace layout + tokens. */
@Component({
  selector: 'app-feedback-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, PageHeroComponent, ReportIssueDialogComponent],
  host: { class: 'block bp-vpfit' },
  template: `
    <app-page-hero align="block" eyebrow="Feedback" title="Your issues"
                   subtitle="Bugs, enhancements and questions you've reported.">
      <div hero-actions>
        <button type="button" class="bp-btn-accent" (click)="openReport()">Report an issue</button>
      </div>
    </app-page-hero>

    <div class="bp-page-body">
      <div class="min-h-0 overflow-y-auto md:flex-1">
        <div class="mx-auto w-full max-w-[var(--workspace-max)]">
          @if (issues.isLoading()) {
            <p class="bp-body-small text-secondary">Loading…</p>
          } @else if (issues.error()) {
            <p class="bp-body-small text-warn">Couldn't load your issues.</p>
          } @else if ((issues.value() ?? []).length === 0) {
            <div class="bp-card bp-card--lifted p-8 text-center">
              <p class="bp-body-small text-secondary">No issues yet — spotted something?</p>
              <button type="button" class="bp-btn-accent mt-3" (click)="openReport()">Report an issue</button>
            </div>
          } @else {
            <!-- Standard table view (matches the marketplace table): a grid with
                 a gray header row, hairline dividers, truncating cells. Ref +
                 Title stay on one line (nowrap / truncate). -->
            <div class="overflow-hidden rounded-xl border border-hairline bg-surface">
              <div class="grid grid-cols-[110px_120px_140px_minmax(0,1.6fr)_120px_120px] gap-x-4 border-b border-hairline bg-fill px-4 py-2">
                <span class="bp-table-column-header">Ref</span>
                <span class="bp-table-column-header">Type</span>
                <span class="bp-table-column-header">Area</span>
                <span class="bp-table-column-header">Title</span>
                <span class="bp-table-column-header">Status</span>
                <span class="bp-table-column-header">Date</span>
              </div>
              @for (i of issues.value(); track i.id) {
                <button type="button"
                        class="grid w-full cursor-pointer grid-cols-[110px_120px_140px_minmax(0,1.6fr)_120px_120px] items-center gap-x-4 border-b border-hairline px-4 py-2.5 text-left last:border-b-0 hover:bg-fill"
                        [class.bg-fill]="openId() === i.id" (click)="toggle(i.id)">
                  <span class="bp-ref-eyebrow whitespace-nowrap">{{ i.ref ?? '—' }}</span>
                  <span class="bp-body-small truncate text-secondary">{{ typeLabel(i.type) }}</span>
                  <span class="bp-body-small truncate text-secondary">{{ i.area_name ?? '—' }}</span>
                  <span class="truncate text-base text-text">{{ i.title }}</span>
                  <span><span class="bp-pill bp-body-small" [class]="statusPill(i.status)">{{ statusLabel(i.status) }}</span></span>
                  <span class="bp-body-small whitespace-nowrap text-secondary">{{ i.created_at | date: 'dd-MMM-y' }}</span>
                </button>
                @if (openId() === i.id && (i.description || i.notes)) {
                  <div class="border-b border-hairline bg-fill px-4 py-3 last:border-b-0">
                    <p class="bp-body-small whitespace-pre-line text-secondary">{{ i.description || i.notes }}</p>
                  </div>
                }
              }
            </div>
          }
        </div>
      </div>
    </div>

    <app-report-issue-dialog [(open)]="reportOpen" [pageUrl]="pageUrl()" (reported)="issues.reload()" />
  `,
})
export class FeedbackPageComponent {
  private readonly feedback = inject(FeedbackService);

  protected readonly issues = resource({
    loader: () => firstValueFrom(this.feedback.myIssues()),
  });

  protected readonly reportOpen = signal(false);
  protected readonly pageUrl = signal('');
  protected readonly openId = signal<string | null>(null);

  protected openReport(): void {
    this.pageUrl.set(typeof window !== 'undefined' ? window.location.pathname : '');
    this.reportOpen.set(true);
  }

  protected toggle(id: string): void {
    this.openId.update((cur) => (cur === id ? null : id));
  }

  protected typeLabel(t: string): string {
    return t === 'bug' ? 'Bug' : t === 'enhancement' ? 'Enhancement' : t === 'question' ? 'Question' : t;
  }

  protected statusLabel(s: string | null): string {
    const v = (s || 'open').replace(/_/g, ' ');
    return v.charAt(0).toUpperCase() + v.slice(1);
  }

  protected statusPill(s: string | null): string {
    const v = s || 'open';
    if (v === 'done' || v === 'closed' || v === 'resolved') return 'bp-pill--success';
    if (v === 'in_progress' || v === 'in progress') return 'bp-pill--info';
    return 'bp-pill--muted';
  }
}
