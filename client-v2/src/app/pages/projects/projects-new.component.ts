import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';
import { AiService } from '../../core/ai/ai.service';
import { PageConfigService } from '../../core/config/page-config.service';
import { ProjectService } from '../../core/projects/project.service';
import { parsedBriefToCreate } from '../../core/projects/project.types';
import { errorDetail } from '../../core/http-error';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';

/** pV2-PROJECTS-03 (scoped — brief → project, no items) — /projects/new
 *  per add-project-1.png: Upload Brief OR Write Brief. The AI parses the
 *  brief into project fields (reusing the v1 /api/ai endpoints); we create
 *  the project (status draft) and land on the list. The "Your ballpark is
 *  ready" item accordion (add-project-2.png) is deferred. */
@Component({
  selector: 'app-projects-new',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToastModule, LucideAngularModule, PageHeroComponent],
  providers: [MessageService],
  host: { class: 'block' },
  template: `
    <app-page-hero
      [back]="{ label: 'Back', href: '/home' }"
      [title]="'Upload or write your brief'"
      [subtitle]="subtitle()"
    />

    <div class="bp-page-body">
      @if (busy()) {
        <!-- Recommend progress (mockup 160953) — steps advance as the brief is
             parsed, items matched, and the ballpark cost is built. -->
        <div class="mx-auto max-w-xl py-4 text-center">
          <h2 class="bp-page-title">Building your {{ label().toLowerCase() }}…</h2>
          <p class="bp-body-small mt-2 text-secondary">We're reading your brief, pulling out key details, matching marketplace suppliers and estimating the project cost.</p>
          <div class="mt-6 flex flex-col gap-2.5 text-left">
            @for (s of steps; track s.label; let i = $index) {
              <div class="bp-card flex items-center gap-3 p-3.5" [class.opacity-40]="i > step()">
                <span class="bp-icon-block h-9 w-9 shrink-0">
                  @if (i < step()) {
                    <lucide-icon name="check" [size]="16" />
                  } @else {
                    <lucide-icon [name]="s.icon" [size]="16" [class.animate-pulse]="i === step()" />
                  }
                </span>
                <span class="bp-body">{{ s.label }}</span>
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
          <!-- Upload Brief -->
          <div class="bp-card p-6">
            <span class="bp-icon-block h-12 w-12"><lucide-icon name="upload" [size]="20" [strokeWidth]="1.75" /></span>
            <h2 class="bp-card-title mt-4">Upload Brief</h2>
            <p class="bp-card-subtitle mt-1">Upload a PDF, Word doc or presentation.</p>
            <label class="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-medium px-4 py-8 text-center hover:bg-fill">
              <input type="file" class="hidden" accept=".pdf,.doc,.docx,.txt,.eml" (change)="onFile($event)" />
              <span class="bp-caption">{{ fileName() || 'Drop files here or click to browse' }}</span>
            </label>
          </div>

          <!-- Write Brief -->
          <div class="bp-card p-6">
            <span class="bp-icon-block h-12 w-12"><lucide-icon name="file-text" [size]="20" [strokeWidth]="1.75" /></span>
            <h2 class="bp-card-title mt-4">Write Brief</h2>
            <p class="bp-card-subtitle mt-1">Type or paste your project brief manually.</p>
            <textarea
              class="mt-4 h-40 w-full resize-none rounded-xl border border-hairline bg-surface p-3 text-md outline-none focus:border-accent"
              placeholder="Start typing your project brief…"
              [value]="briefText()"
              (input)="briefText.set($any($event.target).value)"
            ></textarea>
          </div>
        </div>

        <div class="mt-6 flex items-center gap-3">
          <button type="button" class="bp-btn-grad" [disabled]="!canSubmit()" (click)="submit()">
            <lucide-icon name="sparkles" [size]="16" />
            Build my {{ label().toLowerCase() }}
          </button>
        </div>
      }
    </div>

    <!-- MessageService supplies aria-live by severity (audit F-10). -->
    <p-toast position="bottom-right" styleClass="bp-toast" />
  `,
})
export class ProjectsNewComponent {
  private readonly ai = inject(AiService);
  private readonly projects = inject(ProjectService);
  private readonly pageConfig = inject(PageConfigService);
  private readonly router = inject(Router);
  private readonly toast = inject(MessageService);

  protected readonly label = computed(() => this.pageConfig.eventLabel());
  protected readonly subtitle = computed(
    () =>
      `Ballpark will read your brief, understand what you need, and build an estimated ${this.label().toLowerCase()} from the marketplace.`
  );

  protected readonly briefText = signal('');
  protected readonly fileName = signal('');
  private readonly file = signal<File | null>(null);
  protected readonly busy = signal(false);

  /** Recommend progress steps (mockup 160953). `step()` is the active index. */
  protected readonly steps = [
    { icon: 'file-text', label: 'Reading brief' },
    { icon: 'calendar', label: 'Finding dates and deliverables' },
    { icon: 'store', label: 'Matching marketplace items' },
    { icon: 'wallet', label: 'Building ballpark cost' },
  ];
  protected readonly step = signal(0);

  protected readonly canSubmit = computed(() => !this.busy() && (this.briefText().trim().length > 0 || !!this.file()));

  protected onFile(e: Event): void {
    const f = (e.target as HTMLInputElement).files?.[0] ?? null;
    this.file.set(f);
    this.fileName.set(f?.name ?? '');
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.busy.set(true);
    this.step.set(0);
    let projectId: string | null = null;
    try {
      // Step 0 — read the brief (extract text for uploads, then parse).
      let text = this.briefText().trim();
      const f = this.file();
      if (f && !text) {
        text = (await firstValueFrom(this.ai.extractText(f))).text;
      }
      const parsed = await firstValueFrom(this.ai.parseBrief(text));
      this.step.set(1); // finding dates & deliverables
      const card = await firstValueFrom(this.projects.create(parsedBriefToCreate(parsed, text)));
      projectId = card.id;

      // Step 2 — match marketplace items (v1 recommender, per category). A
      // failure here shouldn't lose the created project: warn and still land
      // them on the (empty) estimate to add items manually.
      this.step.set(2);
      try {
        await firstValueFrom(this.projects.recommend(card.id));
      } catch (recErr) {
        console.warn('[ProjectsNew] recommend failed', recErr);
        this.toast.add({
          severity: 'warn',
          summary: 'Created — but auto-recommend didn’t run. Add items from the marketplace.',
          detail: errorDetail(recErr),
          life: 6000,
        });
      }
      this.step.set(3); // building ballpark cost
      await this.router.navigate(['/projects', card.id], { queryParams: { tab: 'estimate' } });
    } catch (err) {
      console.warn('[ProjectsNew] brief → create failed', err);
      if (projectId) {
        // Created, but a post-create step threw — take them into the project.
        await this.router.navigate(['/projects', projectId], { queryParams: { tab: 'estimate' } });
        return;
      }
      this.toast.add({
        severity: 'error',
        summary: "Couldn't build your " + this.label().toLowerCase() + ' — please try again.',
        detail: errorDetail(err),
        life: 6000,
      });
      this.busy.set(false);
    }
  }
}
