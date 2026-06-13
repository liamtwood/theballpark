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
      <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
        <!-- Upload Brief -->
        <div class="bp-card p-6">
          <span class="bp-icon-block h-12 w-12"><lucide-icon name="upload" [size]="20" [strokeWidth]="1.75" /></span>
          <h2 class="bp-card-title mt-4">Upload Brief</h2>
          <p class="bp-card-subtitle mt-1">Upload a PDF, Word doc or presentation.</p>
          <label class="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-medium px-4 py-8 text-center hover:bg-fill">
            <input type="file" class="hidden" accept=".pdf,.doc,.docx,.txt,.eml" (change)="onFile($event)" [disabled]="busy()" />
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
            [disabled]="busy()"
            (input)="briefText.set($any($event.target).value)"
          ></textarea>
        </div>
      </div>

      <div class="mt-6 flex items-center gap-3">
        <button type="button" class="bp-btn-grad" [disabled]="!canSubmit()" (click)="submit()">
          <lucide-icon name="sparkles" [size]="16" />
          {{ busy() ? busyLabel() : 'Build my ' + label().toLowerCase() }}
        </button>
        @if (busy()) {
          <span class="bp-caption">This can take a few seconds…</span>
        }
      </div>
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
  protected readonly busyLabel = signal('Reading your brief…');

  protected readonly canSubmit = computed(() => !this.busy() && (this.briefText().trim().length > 0 || !!this.file()));

  protected onFile(e: Event): void {
    const f = (e.target as HTMLInputElement).files?.[0] ?? null;
    this.file.set(f);
    this.fileName.set(f?.name ?? '');
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.busy.set(true);
    try {
      // Upload path: extract text first, then parse (same as v1).
      let text = this.briefText().trim();
      const f = this.file();
      if (f && !text) {
        this.busyLabel.set('Reading your file…');
        text = (await firstValueFrom(this.ai.extractText(f))).text;
      }
      this.busyLabel.set('Understanding your brief…');
      const parsed = await firstValueFrom(this.ai.parseBrief(text));
      this.busyLabel.set('Building your ' + this.label().toLowerCase() + '…');
      const card = await firstValueFrom(this.projects.create(parsedBriefToCreate(parsed, text)));
      this.toast.add({ severity: 'success', summary: `Created "${card.name}".`, life: 3000 });
      await this.router.navigate(['/projects']);
    } catch (err) {
      console.warn('[ProjectsNew] brief → create failed', err);
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
