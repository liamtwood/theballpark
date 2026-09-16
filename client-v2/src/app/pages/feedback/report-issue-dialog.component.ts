import { ChangeDetectionStrategy, Component, computed, inject, model, output, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { FeedbackService, MyIssue } from '../../core/feedback/feedback.service';
import { SelectComponent, SelectOption } from '../../shared/select/select.component';
import { errorDetail } from '../../core/http-error';

/** pV2-WHATSNEW-REDESIGN-01 Part B — "Report an issue" dialog. Writes to the
 *  feedback subsystem via the SECURED POST /api/feedback (submitted_by +
 *  environment set server-side from the JWT). Standard v2 dialog + app-select. */
@Component({
  selector: 'app-report-issue-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule, SelectComponent],
  template: `
    <p-dialog
      [visible]="open()"
      (visibleChange)="onVisible($event)"
      styleClass="bp-modal"
      [closable]="true"
      [closeOnEscape]="true"
      [dismissableMask]="true"
      [modal]="true"
      [style]="{ width: '560px', maxWidth: '94vw' }"
    >
      <ng-template pTemplate="header">
        <h2 class="bp-card-title">Report an issue</h2>
      </ng-template>

      <div class="flex flex-col gap-4">
        <div>
          <span class="bp-field-label mb-1.5 block">Type</span>
          <app-select ariaLabel="Issue type" [options]="typeOptions" [value]="type()" (changed)="type.set($any($event))" />
        </div>

        <div>
          <span class="bp-field-label mb-1.5 block">Page / area</span>
          <app-select ariaLabel="Area" [options]="areaOptions()" [value]="areaId() ?? ''" (changed)="areaId.set($event || null)" />
        </div>

        <div>
          <span class="bp-field-label mb-1.5 block">Title</span>
          <input class="ed-input" type="text" [value]="title()" (input)="title.set($any($event.target).value)"
                 placeholder="Short summary" maxlength="255" />
        </div>

        <div>
          <span class="bp-field-label mb-1.5 block">Details</span>
          <textarea class="ed-input min-h-[110px]" [value]="details()" (input)="details.set($any($event.target).value)"
                    placeholder="What happened, and what did you expect?" maxlength="8000"></textarea>
        </div>

        @if (error()) {
          <p class="bp-body-small text-warn">{{ error() }}</p>
        }
      </div>

      <ng-template pTemplate="footer">
        <button type="button" class="bp-btn-outline" (click)="close()">Cancel</button>
        <button type="button" class="bp-btn-accent" [disabled]="!canSubmit() || submitting()" (click)="submit()">
          {{ submitting() ? 'Sending…' : 'Report issue' }}
        </button>
      </ng-template>
    </p-dialog>
  `,
})
export class ReportIssueDialogComponent {
  private readonly feedback = inject(FeedbackService);
  private readonly toast = inject(MessageService);

  /** Two-way open state; the page toggles it. */
  readonly open = model(false);
  /** The page the user came from (auto-captured into pages[]). */
  readonly pageUrl = model<string>('');
  /** Emits the created issue so the parent refreshes the My-issues list. */
  readonly reported = output<MyIssue>();

  protected readonly type = signal<'bug' | 'enhancement' | 'question'>('bug');
  protected readonly areaId = signal<string | null>(null);
  protected readonly title = signal('');
  protected readonly details = signal('');
  protected readonly submitting = signal(false);
  protected readonly error = signal('');

  protected readonly typeOptions: SelectOption[] = [
    { label: 'Bug', value: 'bug' },
    { label: 'Enhancement', value: 'enhancement' },
    { label: 'Question', value: 'question' },
  ];

  private readonly areasRes = resource({
    loader: () => firstValueFrom(this.feedback.areaCategories()),
  });
  protected readonly areaOptions = computed<SelectOption[]>(() => [
    { label: '— pick a page / area —', value: '' },
    ...(this.areasRes.value() ?? []).map((a) => ({ label: a.name, value: a.id })),
  ]);

  protected readonly canSubmit = computed(() => this.title().trim().length > 0);

  protected onVisible(v: boolean): void {
    this.open.set(v);
    if (!v) this.reset();
  }

  protected close(): void {
    this.open.set(false);
    this.reset();
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit() || this.submitting()) return;
    this.submitting.set(true);
    this.error.set('');
    try {
      const created = await firstValueFrom(
        this.feedback.report({
          type: this.type(),
          area_category_id: this.areaId(),
          title: this.title().trim(),
          description: this.details().trim() || null,
          page_url: this.pageUrl() || null,
          pages: this.pageUrl() ? [this.pageUrl()] : [],
        })
      );
      this.toast.add({
        severity: 'success',
        summary: created.ref ? `Logged as ${created.ref} — thanks.` : 'Issue logged — thanks.',
        life: 5000,
      });
      this.reported.emit(created);
      this.open.set(false);
      this.reset();
    } catch (err) {
      // Keep the draft; surface the error.
      this.error.set(errorDetail(err) || "Couldn't report the issue — please try again.");
    } finally {
      this.submitting.set(false);
    }
  }

  private reset(): void {
    this.type.set('bug');
    this.areaId.set(null);
    this.title.set('');
    this.details.set('');
    this.error.set('');
  }
}
