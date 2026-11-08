import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';
import { AiService } from '../../core/ai/ai.service';
import { CodelistService } from '../../core/codelists/codelist.service';
import { PageConfigService } from '../../core/config/page-config.service';
import { ProjectService } from '../../core/projects/project.service';
import { parsedBriefToCreate } from '../../core/projects/project.types';
import { errorDetail } from '../../core/http-error';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { ProjectDetailsFieldsComponent } from './project-details-fields.component';

/** pV2-PROJ-UNIFY-01 (Stage 1) — /projects/new.
 *  Brief (upload/paste) + an OPTIONAL details form (fill ahead if you want).
 *  Create parses the brief, creates the project (status draft), kicks off
 *  recommend (fire-and-forget — it builds while you're on the project page), and
 *  lands on the project with ?welcome=1 — where a confirm dialog surfaces the
 *  details and animates them into the Details tab. Fast hand-off: we do NOT wait
 *  for recommend here. */
@Component({
  selector: 'app-projects-new',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToastModule, LucideAngularModule, PageHeroComponent, ProjectDetailsFieldsComponent],
  providers: [MessageService],
  host: { class: 'block' },
  template: `
    <app-page-hero
      align="block"
      [eyebrow]="hero().eyebrow"
      [title]="hero().title"
      [subtitle]="hero().subtitle"
    />

    <div class="bp-page-body">
      <div class="min-h-0 flex-1 overflow-y-auto">
      @if (busy()) {
        <div class="mx-auto flex max-w-xl flex-col items-center gap-3 py-16 text-center">
          <span class="bp-icon-block h-11 w-11"><lucide-icon name="sparkles" [size]="20" class="animate-pulse text-accent" /></span>
          <h2 class="bp-page-title">Creating your {{ label().toLowerCase() }}…</h2>
          <p class="bp-body-small text-secondary">Reading your brief and setting up the project.</p>
        </div>
      } @else {
        <div class="mx-auto grid w-full max-w-[var(--workspace-max)] grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
          <!-- Left: the brief (upload + paste). -->
          <div class="bp-card bp-card--lifted flex h-full flex-col p-6">
            <h2 class="bp-card-title">The brief</h2>

            <label class="mt-4 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-[var(--radius-card)] border border-hairline bg-fill px-4 py-8 text-center transition-colors hover:border-accent">
              <input type="file" class="hidden" accept=".txt,.md,.csv,.rtf" (change)="onFile($event)" />
              <lucide-icon name="file-up" [size]="20" [strokeWidth]="1.75" class="text-accent" />
              <span class="bp-body-small font-medium">{{ fileName() || 'Upload a brief' }}</span>
              <span class="bp-caption">.txt, .md, .csv or .rtf — or paste the text below</span>
            </label>

            <label class="mt-5 flex flex-1 flex-col">
              <span class="bp-field-label">Brief text</span>
              <textarea
                class="mt-1.5 min-h-64 w-full flex-1 resize-none rounded-xl border border-hairline bg-surface p-3 text-md outline-none focus:border-accent"
                placeholder="Paste the client brief: objectives, audience, dates, venue thoughts, guest numbers, deliverables, budget guidance…"
                [value]="briefText()"
                (input)="briefText.set($any($event.target).value)"
              ></textarea>
              <p class="bp-caption mt-1.5">{{ briefLen() }} characters · at least {{ MIN_BRIEF }} needed</p>
            </label>
          </div>

          <!-- Right: OPTIONAL project details (fill ahead, or confirm on the next
               page). Any field left blank is taken from the parsed brief. -->
          <div class="flex flex-col gap-6">
            <div class="bp-card bp-card--lifted p-6">
              <div class="flex items-center justify-between">
                <h2 class="bp-card-title">Project details</h2>
                <span class="bp-caption text-secondary">Optional — we'll read these from the brief</span>
              </div>

              <div class="mt-4">
                <app-project-details-fields
                  [eventTypeOptions]="eventTypeOptions()"
                  [(name)]="name"
                  [(client)]="client"
                  [(eventType)]="eventType"
                  [(eventDate)]="eventDate"
                  [(location)]="location"
                  [(guests)]="guests"
                  [(budget)]="budget"
                />
              </div>
            </div>

            <button type="button" class="bp-btn-grad w-full justify-center" [disabled]="!canSubmit()" (click)="submit()">
              <lucide-icon name="sparkles" [size]="16" />
              Create ballpark
            </button>
            <p class="bp-caption">
              Ballpark estimates are indicative and subject to supplier confirmation, final scope,
              availability, delivery requirements and VAT.
            </p>
          </div>
        </div>
      }
      </div>
    </div>

    <p-toast position="bottom-right" styleClass="bp-toast" />
  `,
})
export class ProjectsNewComponent {
  private readonly ai = inject(AiService);
  private readonly projects = inject(ProjectService);
  private readonly codelists = inject(CodelistService);
  private readonly pageConfig = inject(PageConfigService);

  /** Event type is a curated LOV (admins own it). */
  private readonly eventTypeRes = resource({
    loader: () => this.codelists.list('project_type'),
  });
  protected readonly eventTypeOptions = computed(
    () => this.eventTypeRes.value()?.map((v) => ({ label: v.label, value: v.code })) ?? []
  );
  private readonly router = inject(Router);
  private readonly toast = inject(MessageService);

  protected readonly label = computed(() => this.pageConfig.eventLabel());
  protected readonly hero = computed(() => this.pageConfig.pageHero('newProject'));

  protected readonly briefText = signal('');
  protected readonly fileName = signal('');
  private readonly file = signal<File | null>(null);
  protected readonly busy = signal(false);

  private readonly nextRefRes = resource({
    loader: () => firstValueFrom(this.projects.nextRef()),
  });
  protected readonly ref = linkedSignal(() => this.nextRefRes.value()?.ref ?? '');
  protected readonly name = signal('');
  protected readonly client = signal('');
  protected readonly eventType = signal('');
  protected readonly eventDate = signal('');
  protected readonly location = signal('');
  protected readonly guests = signal('');
  protected readonly budget = signal('');

  protected readonly MIN_BRIEF = 40;
  protected readonly briefLen = computed(() => this.briefText().trim().length);

  protected readonly canSubmit = computed(
    () => !this.busy() && (this.briefLen() >= this.MIN_BRIEF || !!this.file())
  );

  protected onFile(e: Event): void {
    const f = (e.target as HTMLInputElement).files?.[0] ?? null;
    this.file.set(f);
    this.fileName.set(f?.name ?? '');
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.busy.set(true);
    let projectId: string | null = null;
    try {
      // Read + parse the brief (couple of seconds), then create.
      let text = this.briefText().trim();
      const f = this.file();
      if (f && !text) {
        text = (await firstValueFrom(this.ai.extractText(f))).text;
      }
      const parsed = await firstValueFrom(this.ai.parseBrief(text));

      // Optional form fields win over the parsed brief; blanks fall back to the parse.
      const base = parsedBriefToCreate(parsed, text);
      const payload = {
        ...base,
        ref: this.ref().trim() || undefined,
        name: this.name().trim() || base.name,
        eventType: this.eventType().trim() || base.eventType,
        eventDate: this.eventDate().trim() || base.eventDate,
        venueName: this.location().trim() || base.venueName,
        guestCount: this.guests().trim() ? Number(this.guests()) : base.guestCount,
      };
      const card = await firstValueFrom(this.projects.create(payload));
      projectId = card.id;

      // Client + Budget aren't on the create schema — PATCH them in.
      const detailPatch: { clientName?: string; projectBudget?: number } = {};
      const clientName = this.client().trim() || ((parsed as { client?: string }).client ?? '').trim();
      if (clientName) detailPatch.clientName = clientName;
      const budgetVal = this.budget().trim() ? Number(this.budget()) : parseMoney((parsed as { budget?: string }).budget);
      if (budgetVal != null && !Number.isNaN(budgetVal)) detailPatch.projectBudget = budgetVal;
      if (Object.keys(detailPatch).length) {
        try {
          await firstValueFrom(this.projects.update(card.id, detailPatch));
        } catch (patchErr) {
          console.warn('[ProjectsNew] client/budget update failed', patchErr);
        }
      }

      // recommend is owned by the project page's welcome flow (it kicks off on
      // landing so it can show the building state AND reload the estimate when it
      // finishes — a fire-and-forget here loses completion across navigation).
      // Land immediately; ?welcome=1 drives the confirm dialog + animation + build.
      // Human ref in the URL (EP-00021), falling back to the id.
      await this.router.navigate(['/projects', card.ref ?? card.id], { queryParams: { welcome: 1 } });
    } catch (err) {
      console.warn('[ProjectsNew] brief → create failed', err);
      if (projectId) {
        await this.router.navigate(['/projects', projectId], { queryParams: { welcome: 1 } });
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

/** Parse a loose money string ("£45,000", "£45k", "Unknown") into a number. */
function parseMoney(s?: string | null): number | null {
  if (!s) return null;
  const t = s.toLowerCase().replace(/[, ]/g, '');
  const m = t.match(/£?([\d.]+)\s*([km])?/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (Number.isNaN(n)) return null;
  if (m[2] === 'k') n *= 1000;
  else if (m[2] === 'm') n *= 1_000_000;
  return Math.round(n);
}
