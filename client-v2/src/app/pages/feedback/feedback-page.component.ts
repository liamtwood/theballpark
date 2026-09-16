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
            <div class="bp-card bp-card--lifted overflow-hidden">
              <div class="overflow-x-auto">
                <table class="w-full border-collapse">
                  <thead>
                    <tr class="border-b border-hairline text-left">
                      <th class="bp-field-label whitespace-nowrap px-4 py-3">Ref</th>
                      <th class="bp-field-label whitespace-nowrap px-4 py-3">Type</th>
                      <th class="bp-field-label whitespace-nowrap px-4 py-3">Area</th>
                      <th class="bp-field-label px-4 py-3">Title</th>
                      <th class="bp-field-label whitespace-nowrap px-4 py-3">Status</th>
                      <th class="bp-field-label whitespace-nowrap px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (i of issues.value(); track i.id) {
                      <tr class="cursor-pointer border-b border-hairline last:border-b-0 hover:bg-fill" (click)="toggle(i.id)">
                        <td class="whitespace-nowrap px-4 py-3"><span class="bp-ref-eyebrow">{{ i.ref ?? '—' }}</span></td>
                        <td class="whitespace-nowrap px-4 py-3 bp-body-small text-secondary">{{ typeLabel(i.type) }}</td>
                        <td class="whitespace-nowrap px-4 py-3 bp-body-small text-secondary">{{ i.area_name ?? '—' }}</td>
                        <td class="whitespace-nowrap px-4 py-3 bp-body-small text-text">{{ i.title }}</td>
                        <td class="whitespace-nowrap px-4 py-3"><span class="bp-pill bp-body-small" [class]="statusPill(i.status)">{{ statusLabel(i.status) }}</span></td>
                        <td class="whitespace-nowrap px-4 py-3 bp-meta">{{ i.created_at | date: 'dd-MMM-y' }}</td>
                      </tr>
                      @if (openId() === i.id && (i.description || i.notes)) {
                        <tr class="border-b border-hairline last:border-b-0 bg-fill">
                          <td colspan="6" class="px-4 py-3">
                            <p class="bp-body-small whitespace-pre-line text-secondary">{{ i.description || i.notes }}</p>
                          </td>
                        </tr>
                      }
                    }
                  </tbody>
                </table>
              </div>
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
