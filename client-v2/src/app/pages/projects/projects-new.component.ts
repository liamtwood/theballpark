import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';
import { AiService } from '../../core/ai/ai.service';
import { CodelistService } from '../../core/codelists/codelist.service';
import { natoDate } from '../../shared/details-format';
import { PageConfigService } from '../../core/config/page-config.service';
import { ProjectService } from '../../core/projects/project.service';
import { parsedBriefToCreate } from '../../core/projects/project.types';
import { errorDetail } from '../../core/http-error';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { SelectComponent } from '../../shared/select/select.component';

/** pV2-PROJECTS-03 (scoped — brief → project, no items) — /projects/new
 *  per add-project-1.png: Upload Brief OR Write Brief. The AI parses the
 *  brief into project fields (reusing the v1 /api/ai endpoints); we create
 *  the project (status draft) and land on the list. The "Your ballpark is
 *  ready" item accordion (add-project-2.png) is deferred. */
@Component({
  selector: 'app-projects-new',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToastModule, LucideAngularModule, PageHeroComponent, SelectComponent],
  providers: [MessageService],
  // bp-vpfit: the PAGE never scrolls — the hero stays anchored and only the
  // form body scrolls within itself (matches the catalogue pages). This keeps
  // the scrollbar below the fixed header, not spanning it.
  // Flowing page (standard): the whole page scrolls at the window edge under the
  // fixed top nav — the hero scrolls with the content (Liam 2026-10-30).
  host: { class: 'block' },
  template: `
    <app-page-hero
      align="block"
      [eyebrow]="hero().eyebrow"
      [title]="hero().title"
      [subtitle]="hero().subtitle"
    />

    <!-- Full-width bp-page-body (NOT --workspace) so the scroll area spans the page
         and the scrollbar sits at the window edge like the other vpfit pages; the
         content centres itself in the workspace column inside (Liam 2026-10-30). -->
    <div class="bp-page-body">
      <!-- Own the overflow so the body scrolls, not the whole page. -->
      <div class="min-h-0 flex-1 overflow-y-auto">
      @if (busy()) {
        <!-- Simple loading state (S1): read the brief → set up the project. The
             4-step "building your project" deck (deck slide 3) is dropped — its
             item-match / ballpark steps are S2. -->
        <div class="mx-auto flex max-w-xl flex-col items-center gap-3 py-16 text-center">
          <span class="bp-icon-block h-11 w-11"><lucide-icon name="sparkles" [size]="20" class="animate-pulse text-accent" /></span>
          <h2 class="bp-page-title">Creating your {{ label().toLowerCase() }}…</h2>
          <p class="bp-body-small text-secondary">Reading your brief and setting up the project.</p>
        </div>
      } @else {
        <div class="mx-auto grid w-full max-w-[var(--workspace-max)] grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
          <!-- Left: the brief (upload + paste). Fills the column so it matches
               the right side's full height (details + button + disclaimer). -->
          <div class="bp-card bp-card--lifted flex h-full flex-col p-6">
            <h2 class="bp-card-title">The brief</h2>

            <!-- Standard light-gray container (bg-fill + hairline), matching the
                 payment summary cards; border highlights on hover (Liam 2026-10-30). -->
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

          <!-- Right: project details + submit. -->
          <div class="flex flex-col gap-6">
            <div class="bp-card bp-card--lifted p-6">
              <h2 class="bp-card-title">Project details</h2>

              <!-- Ref hidden here — auto-assigned on create; managed in project
                   Details later (Liam 2026-10-30). One field per row. -->
              <div class="mt-4 flex flex-col gap-4">
                <label class="block">
                  <span class="ed-label mb-1.5 block">Project name</span>
                  <input type="text" class="ed-input" [value]="name()" (input)="name.set($any($event.target).value)" />
                </label>
              </div>
              <div class="mt-4 grid grid-cols-1 gap-4">
                <label class="block">
                  <span class="ed-label mb-1.5 block">Client</span>
                  <input type="text" class="ed-input" [value]="client()" (input)="client.set($any($event.target).value)" />
                </label>
                <label class="block">
                  <span class="ed-label mb-1.5 block">Event type</span>
                  <app-select ariaLabel="Event type" placeholder="Select…" [options]="eventTypeOptions()" [value]="eventType()" (changed)="eventType.set($event)" />
                </label>
              </div>
              <div class="mt-4 grid grid-cols-1 gap-4">
                <label class="block">
                  <span class="ed-label mb-1.5 block">Event date</span>
                  <!-- NATO display + native OS picker: the transparent date input
                       sits over the calendar icon; picking reformats to NATO. -->
                  <div class="relative">
                    <input type="text" class="ed-input pr-10" placeholder="e.g. 20-Aug-2026" title="Standard format: DD-Mmm-YYYY (free text like 'Q4' is fine too)" [value]="eventDate()" (input)="eventDate.set($any($event.target).value)" (blur)="onEventDateBlur()" />
                    <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"><lucide-icon name="calendar" [size]="16" /></span>
                    <input type="date" aria-label="Pick event date" class="absolute right-0 top-0 h-full w-11 cursor-pointer opacity-0" (change)="onEventDatePicked($any($event.target).value)" />
                  </div>
                </label>
                <label class="block">
                  <span class="ed-label mb-1.5 block">Location</span>
                  <input type="text" class="ed-input" placeholder="London" [value]="location()" (input)="location.set($any($event.target).value)" />
                </label>
              </div>
              <!-- Guests + Budget side by side (Liam 2026-10-30). -->
              <div class="mt-4 grid grid-cols-2 gap-4">
                <label class="block">
                  <span class="ed-label mb-1.5 block">Guests</span>
                  <input type="number" min="0" class="ed-input" [value]="guests()" (input)="guests.set($any($event.target).value)" />
                </label>
                <label class="block">
                  <span class="ed-label mb-1.5 block">Budget (£)</span>
                  <input type="number" min="0" class="ed-input" [value]="budget()" (input)="budget.set($any($event.target).value)" />
                </label>
              </div>
            </div>

            <button type="button" class="bp-msg-btn w-full justify-center" [disabled]="!canSubmit()" (click)="submit()">
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

    <!-- MessageService supplies aria-live by severity (audit F-10). -->
    <p-toast position="bottom-right" styleClass="bp-toast" />
  `,
})
export class ProjectsNewComponent {
  private readonly ai = inject(AiService);
  private readonly projects = inject(ProjectService);
  private readonly codelists = inject(CodelistService);
  private readonly pageConfig = inject(PageConfigService);

  /** Event type is a curated LOV (admins own it) — same list the project
   *  detail's Event type dropdown reads. */
  private readonly eventTypeRes = resource({
    loader: () => this.codelists.list('project_type'),
  });
  protected readonly eventTypeOptions = computed(
    () => this.eventTypeRes.value()?.map((v) => ({ label: v.label, value: v.code })) ?? []
  );
  private readonly router = inject(Router);
  private readonly toast = inject(MessageService);

  protected readonly label = computed(() => this.pageConfig.eventLabel());
  /** Admin-driven hero (eyebrow / title / subtitle), tokens resolved. */
  protected readonly hero = computed(() => this.pageConfig.pageHero('newProject'));

  protected readonly briefText = signal('');
  protected readonly fileName = signal('');
  private readonly file = signal<File | null>(null);
  protected readonly busy = signal(false);

  /** Project-detail fields the user can fill directly (override the parsed
   *  brief). All map to existing project attributes. */
  /** The proposed next ref (server preview). Pre-fills the Ref field; the user
   *  can override it. A proposal, not a reservation — the real ref is allocated
   *  at create (and a blank field still auto-assigns). */
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

  /** Minimum brief length before the AI parse is worthwhile. */
  protected readonly MIN_BRIEF = 40;
  protected readonly briefLen = computed(() => this.briefText().trim().length);

  protected readonly canSubmit = computed(
    () => !this.busy() && (this.briefLen() >= this.MIN_BRIEF || !!this.file())
  );

  /** Normalise the typed date to the standard NATO format on blur; free text
   *  (e.g. "Q4"/"TBC") is left as-is. */
  protected onEventDateBlur(): void {
    const v = this.eventDate().trim();
    if (v) this.eventDate.set(natoDate(v));
  }

  /** OS date picker → NATO. Build a LOCAL date from the yyyy-mm-dd parts so the
   *  displayed day can't shift a day across time zones. */
  protected onEventDatePicked(iso: string): void {
    if (!iso) return;
    const [y, m, d] = iso.split('-').map(Number);
    this.eventDate.set(natoDate(new Date(y, m - 1, d).toDateString()));
  }

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
      // Read the brief (extract text for uploads, then parse).
      let text = this.briefText().trim();
      const f = this.file();
      if (f && !text) {
        text = (await firstValueFrom(this.ai.extractText(f))).text;
      }
      const parsed = await firstValueFrom(this.ai.parseBrief(text));

      // Manual detail fields win over the parsed brief (both map to existing
      // project attributes). Client + Budget aren't on the create schema, so
      // they're PATCHed straight after (create-then-update — no backend change).
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
      // create() also seeds project_settings (null rates) + scaffolds the
      // project_categories brief buckets from the parsed brief, server-side in
      // one transaction. Item matching (recommend) is S2 — not called here.
      const card = await firstValueFrom(this.projects.create(payload));
      projectId = card.id;

      const detailPatch: { clientName?: string; projectBudget?: number } = {};
      // The create schema doesn't take clientName; PATCH it in. The AI often
      // folds the client into the project NAME, so fall back to the parser's
      // dedicated `client` field when the form field is empty (FR-00240 hero
      // eyebrow reads client_name).
      const clientName = this.client().trim() || (parsed.client ?? '').trim();
      if (clientName) detailPatch.clientName = clientName;
      if (this.budget().trim()) detailPatch.projectBudget = Number(this.budget());
      if (Object.keys(detailPatch).length) {
        try {
          await firstValueFrom(this.projects.update(card.id, detailPatch));
        } catch (patchErr) {
          console.warn('[ProjectsNew] client/budget update failed', patchErr);
        }
      }

      // Land on the project detail (default tab). The tab bodies (Ballpark
      // Cost / Marketplace) depend on the line cluster (S2) — until that's
      // ported the hero is what renders; the project itself is saved.
      await this.router.navigate(['/projects', card.id]);
    } catch (err) {
      console.warn('[ProjectsNew] brief → create failed', err);
      if (projectId) {
        // Created, but a post-create step threw — take them into the project.
        await this.router.navigate(['/projects', projectId]);
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
