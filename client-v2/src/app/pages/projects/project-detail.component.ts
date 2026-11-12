import { ChangeDetectionStrategy, Component, computed, effect, inject, resource, signal } from '@angular/core';
import { ModalComponent } from '../../shared/modal/modal.component';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';
import { CodelistService } from '../../core/codelists/codelist.service';
import { PageConfigService } from '../../core/config/page-config.service';
import { ProjectService } from '../../core/projects/project.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { EstimateBreakdown, ProjectDetail, ProjectUpdate } from '../../core/projects/project.types';
import { PickerResult } from '../../core/media/media.types';
import { errorDetail } from '../../core/http-error';
import { EditFieldOption } from '../../shared/edit-field/edit-field.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { ImagePickerComponent } from '../../shared/image-picker/image-picker.component';
import { ProjectMarketplaceComponent } from './project-marketplace.component';
import { ProjectEstimateComponent } from './project-estimate.component';
import { ProjectDetailsFieldsComponent } from './project-details-fields.component';
import { QuoteDocumentComponent } from './quote-document.component';
import { SowDocumentComponent } from './sow-document.component';
import { InboxProjectComponent } from '../inbox/inbox-project.component';
import { ProjectOverviewHeroComponent } from './project-overview-hero.component';
import { InboxService } from '../../core/inbox/inbox.service';
import { CoachmarkComponent } from '../../shared/coachmark/coachmark.component';

type Tab = 'marketplace' | 'estimate' | 'final' | 'reports' | 'inbox';
const TABS: Tab[] = ['marketplace', 'estimate', 'final', 'reports', 'inbox'];

/** pV2-PROJECTS-02 (slice 1) — /projects/:id inside-project view: hero +
 *  three-tab band (Marketplace / Estimate / Project Details). This slice
 *  ships the shell + the Project Details tab (view/edit on the Profile
 *  edit-section pattern, status codelist-driven). Marketplace (project-
 *  scoped catalogue + Quote rail) and Estimate (v1 port) land in slices
 *  2 + 3. eventLabel everywhere user-visible. */
@Component({
  selector: 'app-project-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToastModule,
    ModalComponent,
    ProjectDetailsFieldsComponent,
    LucideAngularModule,
    CoachmarkComponent,
    DrawerComponent,
    ImagePickerComponent,
    ProjectMarketplaceComponent,
    ProjectEstimateComponent,
    QuoteDocumentComponent,
    SowDocumentComponent,
    InboxProjectComponent,
    ProjectOverviewHeroComponent,
  ],
  providers: [MessageService],
  // EVERY tab now flows and scrolls at the window edge — one page scrollbar, no
  // viewport-fit / inner column scroll. The Inbox used to be viewport-fit (3-col
  // chat with internally-scrolling rails) but now flows like the Marketplace: the
  // conversation shows its messages inline and the page scrolls (Liam 2026-10-29).
  host: { class: 'block' },
  template: `
    @if (detail.value(); as p) {
      <!-- ONE hero across Draft ⇄ Active (Liam 2026-11-12): the overview hero
           (cover + name + the four negotiation tiles) renders in every mode. No
           image/status branch — keep it simple; the tiles self-reveal their
           numbers once the project goes live. -->
      <div class="shrink-0 bp-gutter px-6 pt-4">
        <div class="mx-auto w-full max-w-[var(--workspace-max)]">
          <app-project-overview-hero
            [project]="p"
            [collapsed]="heroCollapsed()"
            [workingTotal]="estimate.value()?.projectTotal ?? 0"
            [overview]="overview.value() ?? null"
            [currency]="p.currency || 'GBP'"
            [label]="label()"
            (changeImage)="imgDrawer.set(true)"
            (editDetails)="openEditDetails()" />
        </div>
      </div>

      <!-- Tabs sit just above the tab content (Liam 2026-08-28). Coachmarks
           overlay ABOVE the band in their own layer (absolute → no layout shift
           when they show/dismiss), tail pointing DOWN at the target tab. The
           x-offset aligns the tail with the target of the even-width tabs. -->
      <div class="relative shrink-0 pt-3">
        @if (projNavActive() === 'final') {
          <div class="pointer-events-none absolute bottom-full left-1/2 z-40 -translate-x-1/2 pb-2">
            <app-coachmark page="ballpark-cost" name="intro" tail="down"
                           defaultText="Here is your ballpark cost. Feel free to remove anything and add elements from the marketplace." />
          </div>
        }
        @if (projNavActive() === 'marketplace') {
          <div class="pointer-events-none absolute bottom-full left-1/2 z-40 -translate-x-1/2 pb-2">
            <app-coachmark page="marketplace" name="intro" tail="down"
                           defaultText="Here is the marketplace. Keep track of your running estimate by going back to the Ballpark tab." />
          </div>
        }
        <!-- pV2 project nav (Liam): a compact, centered 2-way dark-pill switch
             (Ballpark cost / Edit in marketplace) in place of the full tab band.
             The Details/Event-Logistics content folds into Ballpark cost (it
             already lives there). Inbox (S3) / Final-SOW (S4) / Reports are
             deferred — their @case code + routes stay, just not in the nav. -->
        <div class="flex justify-center px-6">
          <div class="bp-projnav" role="tablist" aria-label="Project view">
            @for (opt of projNav(); track opt.tab) {
              <button type="button" role="tab" class="bp-projnav-opt"
                      [attr.data-tab]="opt.tab"
                      [class.bp-projnav-opt--active]="projNavActive() === opt.tab"
                      [attr.aria-selected]="projNavActive() === opt.tab"
                      (click)="setTab(opt.tab)">
                @if (projNavActive() === opt.tab) { <lucide-icon name="check" [size]="15" /> }
                <span>{{ opt.label }}</span>
              </button>
            }
          </div>
        </div>
      </div>

      <div class="bp-page-body">
        @switch (tab()) {
          @case ('estimate') {
            <div class="min-h-0 flex-1 bp-gutter -mt-6">
              <app-project-estimate [projectId]="p.id" [project]="p" (goToFinal)="goToTab('final')" (detailsSaved)="detail.reload()" (deleteRequested)="onDelete()" />
            </div>
          }
          @case ('final') {
            <!-- -mt-6 shaves most of bp-page-body's 32px top so the content sits
                 the same distance under the tab band as the Marketplace tab
                 (Liam 2026-11-06). Vertical only — no -mx-8 (not a full-bleed grid). -->
            <div class="min-h-0 flex-1 bp-gutter -mt-6">
              @if (welcomeBuilding()) {
                <!-- pV2-PROJ-UNIFY-01 — the ballpark builds while/after the confirm
                     dialog; the list fills in when recommend finishes. -->
                <div class="mx-auto mb-3 flex max-w-[var(--workspace-max)] items-center gap-3 rounded-[var(--radius-card)] border border-hairline bg-fill px-4 py-3">
                  <lucide-icon name="sparkles" [size]="18" class="shrink-0 animate-pulse text-accent" />
                  <span class="bp-body-small text-secondary">Finding items for your ballpark — the list fills in as suppliers are matched…</span>
                </div>
              }
              <app-project-estimate [projectId]="p.id" [project]="p" view="final" [reloadToken]="estimateReloadToken()" (detailsSaved)="detail.reload()" (deleteRequested)="onDelete()" />
            </div>
          }
          @case ('reports') {
            <div class="min-h-0 flex-1 bp-gutter -mt-6">
              <!-- pV2-BUILDUP-04 — the client-facing documents (open as overlays);
                   styled to match the tab band. -->
              <div class="flex justify-center">
                <div class="bp-tab-band bp-tab-band--even">
                  <button type="button" class="bp-tab" (click)="docView.set(true)">
                    <lucide-icon name="file-text" [size]="16" [strokeWidth]="1.75" /> Ballpark
                  </button>
                  <button type="button" class="bp-tab" (click)="sowView.set(true)">
                    <lucide-icon name="signature" [size]="16" [strokeWidth]="1.75" /> SOW
                  </button>
                </div>
              </div>
            </div>
            @if (docView()) {
              <!-- Close returns to Reports, where the document was opened (Liam
                   QC 2026-09-16). -->
              <app-quote-document [projectId]="p.id" [project]="p" (close)="docView.set(false)" />
            }
            @if (sowView()) {
              <app-sow-document [projectId]="p.id" [project]="p" (close)="sowView.set(false)" />
            }
          }
          @case ('inbox') {
            <app-inbox-project [viewer]="'agency'" [projectId]="p.id" [embedded]="true" />
          }
          @default {
            <!-- Scrolls in the page's bp-gutter (window-edge scrollbar) like the
                 other project tabs; the bare workspace flows inside it. Pull up
                 to shave most of bp-page-body's 32px top so the grid sits close
                 under the tab band, and -mx-8 cancels bp-page-body's 32px side
                 padding so the workspace frame's own px-6 lines the card up with
                 the hero/banner at every width (Liam 2026-10-29) — mx-auto hides
                 the mismatch on a wide screen but not on a narrow one. -->
            <div class="min-h-0 flex-1 bp-gutter -mt-6 -mx-8">
              <app-project-marketplace [projectId]="p.id" [projectStatus]="p.status" />
            </div>
          }
        }
      </div>

      <!-- Image picker drawer (pV2-MEDIA-01b). -->
      <app-drawer [(open)]="imgDrawer" title="Project image">
        <app-image-picker
          entityType="project"
          [searchSeed]="p.name"
          [currentImageUrl]="p.coverUrl"
          [currentIconName]="p.iconName"
          [currentIconColor]="p.iconColor"
          previewAspect="4/3"
          (chosen)="onPick($event)"
          (removed)="onRemoveImage(); imgDrawer.set(false)"
          (cancelled)="imgDrawer.set(false)"
        />
      </app-drawer>
    } @else if (detail.isLoading()) {
      <div class="bp-page-body"><p class="bp-body-small text-secondary">Loading…</p></div>
    } @else {
      <div class="bp-page-body"><p class="bp-body-small text-warn">Couldn't load this {{ label().toLowerCase() }}.</p></div>
    }

    <!-- pV2-PROJ-UNIFY-01 — the create-flow project-details dialog, shared by two
         entries: the WELCOME confirm (opened once on ?welcome=1 — surfaces the
         parsed details, forced confirm) and the EDIT entry (the hero's "Edit
         details" button — closable). Same fields + w* model; mode branches the
         chrome and the save path. -->
    @if (detail.value()) {
      <app-modal
        [open]="welcomeOpen()"
        (close)="welcomeOpen.set(false)"
        [title]="detailsMode() === 'edit' ? 'Edit project details' : 'Confirm your project details'"
        [subtitle]="detailsDialogSubtitle()"
        width="560px"
        [closable]="detailsMode() === 'edit'"
        [dismissable]="detailsMode() === 'edit'"
      >
        <app-project-details-fields
          [eventTypeOptions]="eventTypeOptions()"
          [showFinancials]="detailsMode() === 'edit'"
          [(name)]="wName"
          [(client)]="wClient"
          [(eventType)]="wEventType"
          [(eventDate)]="wEventDate"
          [(location)]="wLocation"
          [(guests)]="wGuests"
          [(budget)]="wBudget"
          [(margin)]="wMargin"
          [(contingency)]="wContingency"
          [(vat)]="wVat"
          [(currency)]="wCurrency"
        />

        @if (detailsMode() === 'edit') {
          <button modalFooter type="button" class="bp-btn--secondary" [disabled]="savingWelcome()" (click)="welcomeOpen.set(false)">
            Cancel
          </button>
        }
        <button modalFooter type="button" class="bp-btn--primary" [disabled]="savingWelcome()" (click)="saveWelcome()">
          <lucide-icon name="check" [size]="15" />
          {{ savingWelcome() ? 'Saving…' : detailsMode() === 'edit' ? 'Save' : 'Save & continue' }}
        </button>
      </app-modal>
    }


    <!-- MessageService supplies aria-live by severity (audit F-10). -->
    <p-toast position="bottom-right" styleClass="bp-toast" />
  `,
})
export class ProjectDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projects = inject(ProjectService);
  private readonly inbox = inject(InboxService);
  private readonly codelists = inject(CodelistService);
  private readonly pageConfig = inject(PageConfigService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmService);

  /** Delete the DRAFT project (soft-delete). Confirm first; on success return to
   *  the projects list. The server gates to draft + the caller's org, so this is
   *  only ever offered on a draft. */
  protected async onDelete(): Promise<void> {
    const p = this.detail.value();
    if (!p) return;
    const ok = await this.confirm.ask({
      title: 'Delete this draft?',
      message: `“${p.name}” and its draft estimate will be removed. This can't be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await firstValueFrom(this.projects.deleteProject(p.id));
      this.toast.add({ severity: 'success', summary: 'Draft deleted', life: 3000 });
      await this.router.navigate(['/projects']);
    } catch {
      this.toast.add({ severity: 'error', summary: "Couldn't delete the project — please try again.", life: 5000 });
    }
  }

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly id = computed(() => this.params().get('id') ?? '');

  /** Marketplace is the default tab (PROJECTS.md) — it's where you build
   *  the project's quote. */
  protected readonly tab = computed<Tab>(() => {
    const raw = this.query().get('tab');
    const t: Tab = (TABS as string[]).includes(raw ?? '') ? (raw as Tab) : 'final';
    // pV2-PROJ-UNIFY-01 — all tabs available in every state (no draft redirect).
    return t;
  });

  /** The overview hero stays FULL (cover + stats pill) on every active tab
   *  (Liam 2026-10-23) — no per-tab collapse, so it doesn't resize or hide the
   *  stats when switching to Marketplace / Inbox. */
  protected readonly heroCollapsed = computed(() => false);

  protected readonly label = computed(() => this.pageConfig.eventLabel());
  protected readonly labelPlural = computed(() => `${this.label()}s`);
  /** A DRAFT project (not yet sent to suppliers) shows only Ballpark Cost +
   *  Marketplace — About Project (event details already live on Ballpark Cost),
   *  Reports and Inbox unlock once it goes Active (sent to suppliers). */
  protected readonly isDraft = computed(() => (this.detail.value()?.status ?? 'draft') === 'draft');
  /** The compact 2-way project nav (Liam's v2 design). Ballpark cost = the
   *  estimate/running-ballpark view ('final'; event details fold in here);
   *  Edit in marketplace = the catalogue browse. Inbox/Final-SOW/Reports are
   *  deferred until their stage lands (their @case + routes stay). */
  protected readonly projNav = computed<readonly { tab: Tab; label: string }[]>(() => {
    // pV2-PROJ-UNIFY-01 — the FULL tab set shows always, draft included (one
    // project view from creation; status no longer gates the nav). Inbox/Reports
    // carry tasteful empty-states on a fresh project. Labels still status-aware
    // (the "Running budget"/"Marketplace" relabel is deferred — Liam 2026-11-06).
    const n = this.overview.value()?.actionItems ?? 0;
    // Details tab is HIDDEN from the nav (Liam 2026-11-12) — project details are
    // edited via the hero's "Edit details" dialog now. The 'details' @case + route
    // stay for the welcome-flow landing and any deep link.
    return [
      { tab: 'final', label: 'Ballpark' },
      { tab: 'marketplace', label: 'Marketplace' },
      { tab: 'inbox', label: n > 0 ? `Inbox (${n})` : 'Inbox' },
      { tab: 'reports', label: 'Documents' },
    ];
  });
  /** Which switch option reads as selected — marketplace / inbox when on them,
   *  else the Ballpark cost side (covers the deferred/redirected tabs too). */
  protected readonly projNavActive = computed<Tab>(() => {
    const t = this.tab();
    if (t === 'marketplace') return 'marketplace';
    if (t === 'inbox') return 'inbox';
    if (t === 'reports') return 'reports';
    return 'final';
  });

  protected readonly detail = resource<ProjectDetail, string>({
    // EP-00021 — the URL param is a ref OR the UUID; getDetail resolves either.
    params: () => this.id(),
    loader: ({ params }) => firstValueFrom(this.projects.getDetail(params)),
  });

  /** The CANONICAL project id (UUID), resolved from the loaded detail. Everything
   *  except the detail load (overview/estimate/mutations) keys off this, never
   *  the URL param — state stays id-based (EP-00021). Undefined until loaded. */
  protected readonly pid = computed(() => this.detail.value()?.id);

  /** The server-computed cascade — the hero's "Ballpark / Project Total"
   *  headline reads its `projectTotal`. Reloaded after an estimate-affecting
   *  edit (rates / lines) so the headline stays live. */
  protected readonly estimate = resource<EstimateBreakdown, string | undefined>({
    params: () => this.pid(),
    loader: ({ params }) => firstValueFrom(this.projects.estimate(params!, 'all')),
  });

  /** Live-project overview metrics (confirmed / agreed / open threads) — only
   *  fetched once the project is Active (the cover hero's tiles). */
  protected readonly overview = resource({
    params: () => (this.isDraft() ? undefined : this.pid()),
    loader: ({ params }) => firstValueFrom(this.inbox.projectOverview(params)),
  });

  protected readonly saving = signal(false);
  /** Image-picker drawer (pV2-MEDIA-01b) — the hero's "change image" entry. */
  protected readonly imgDrawer = signal(false);
  /** pV2-BUILDUP-04 — Final Quote → client-facing document overlays. */
  protected readonly docView = signal(false);
  protected readonly sowView = signal(false);

  // The event-type codelist feeds the shared details dialog's picker.
  private readonly eventTypeRes = resource({
    loader: () => this.codelists.list('project_type'),
  });
  protected readonly eventTypeOptions = computed<EditFieldOption[]>(
    () => this.eventTypeRes.value()?.map((v) => ({ label: v.label, value: v.code })) ?? []
  );

  // ── pV2-PROJ-UNIFY-01 — create welcome flow ──────────────────────────────
  /** The project-details dialog (shared: the create-flow welcome confirm + the
   *  hero "Edit details" entry). Visibility is one signal; `detailsMode` picks
   *  the chrome + the save path. */
  protected readonly welcomeOpen = signal(false);
  /** 'welcome' = create-flow confirm (forced, flies to Details on save);
   *  'edit' = in-place edit from the hero (closable, saves without the fly). */
  protected readonly detailsMode = signal<'welcome' | 'edit'>('welcome');
  /** Dialog subtitle — the welcome confirm explains the parsed brief; edit has none. */
  protected readonly detailsDialogSubtitle = computed(() =>
    this.detailsMode() === 'edit'
      ? ''
      : "We read these from your brief — fix anything that's off, then continue. You can edit them any time with Edit details on the project."
  );
  /** recommend is building the ballpark (shown on the Ballpark cost tab). */
  protected readonly welcomeBuilding = signal(false);
  /** Bumped to force the estimate component to re-fetch its lines after recommend. */
  protected readonly estimateReloadToken = signal(0);
  /** Welcome-dialog fields (the add-project layout), seeded from the project. */
  protected readonly wName = signal('');
  protected readonly wClient = signal('');
  protected readonly wEventType = signal('');
  protected readonly wEventDate = signal('');
  protected readonly wLocation = signal('');
  protected readonly wGuests = signal('');
  protected readonly wBudget = signal('');
  /** Financial defaults — edit-dialog only (seeded in openEditDetails). */
  protected readonly wMargin = signal('');
  protected readonly wContingency = signal('');
  protected readonly wVat = signal('');
  protected readonly wCurrency = signal('GBP');
  protected readonly savingWelcome = signal(false);
  private welcomeShown = false;
  /** On ?welcome=1: open the confirm dialog once the project is loaded AND kick
   *  off recommend so the ballpark builds while the dialog is up; when it
   *  finishes, drop the building state and reload the estimate so items show. */
  private readonly welcomeWatcher = effect(() => {
    const wants = this.query().get('welcome') === '1';
    const p = this.detail.value();
    if (wants && p && !this.welcomeShown) {
      this.welcomeShown = true;
      this.detailsMode.set('welcome');
      // Seed the dialog from the created project (parsed values).
      this.wName.set(p.name ?? '');
      this.wClient.set(p.clientName ?? '');
      this.wEventType.set(p.eventType ?? '');
      this.wEventDate.set(p.eventDate ?? '');
      this.wLocation.set(p.venueName ?? '');
      this.wGuests.set(p.guestCount != null ? String(p.guestCount) : '');
      this.wBudget.set(p.projectBudget != null ? String(p.projectBudget) : '');
      this.welcomeOpen.set(true);
      this.welcomeBuilding.set(true);
      firstValueFrom(this.projects.recommend(p.id))
        .catch((err) => console.warn('[ProjectDetail] recommend failed', err))
        .finally(() => {
          this.welcomeBuilding.set(false);
          this.estimate.reload();
          // Force the estimate component to re-fetch its own lines (it loaded
          // empty before recommend wrote the items).
          this.estimateReloadToken.update((t) => t + 1);
        });
    }
  });

  /** Open the shared details dialog in EDIT mode (the hero's "Edit details"),
   *  seeded from the current project. Saves in place — no fly, no ?welcome. */
  protected openEditDetails(): void {
    const p = this.detail.value();
    if (!p) return;
    this.detailsMode.set('edit');
    this.wName.set(p.name ?? '');
    this.wClient.set(p.clientName ?? '');
    this.wEventType.set(p.eventType ?? '');
    this.wEventDate.set(p.eventDate ?? '');
    this.wLocation.set(p.venueName ?? '');
    this.wGuests.set(p.guestCount != null ? String(p.guestCount) : '');
    this.wBudget.set(p.projectBudget != null ? String(p.projectBudget) : '');
    this.wMargin.set(p.defaultMarginPct != null ? String(p.defaultMarginPct) : '');
    this.wContingency.set(p.defaultContingencyPct != null ? String(p.defaultContingencyPct) : '');
    this.wVat.set(p.defaultVatPct != null ? String(p.defaultVatPct) : '');
    this.wCurrency.set(p.currency || 'GBP');
    this.welcomeOpen.set(true);
  }

  /** Save the dialog's details onto the project. Welcome mode then flies into the
   *  Details tab; edit mode just refreshes the detail and closes. */
  protected async saveWelcome(): Promise<void> {
    const id = this.pid();
    if (id) {
      this.savingWelcome.set(true);
      const update: ProjectUpdate = {
        name: this.wName().trim() || undefined,
        clientName: this.wClient().trim() || undefined,
        eventType: this.wEventType().trim() || undefined,
        eventDate: this.wEventDate().trim() || undefined,
        venueName: this.wLocation().trim() || undefined,
        guestCount: this.wGuests().trim() ? Number(this.wGuests()) : undefined,
        projectBudget: this.wBudget().trim() ? Number(this.wBudget()) : undefined,
      };
      // Financial defaults only come from the EDIT dialog (welcome never shows
      // them). Blank clears to null (inherit the org default); a value overrides.
      if (this.detailsMode() === 'edit') {
        const numOrNull = (s: string) => (s.trim() ? Number(s) : null);
        update.currency = this.wCurrency() || 'GBP';
        update.defaultMarginPct = numOrNull(this.wMargin());
        update.defaultContingencyPct = numOrNull(this.wContingency());
        update.defaultVatPct = numOrNull(this.wVat());
      }
      try {
        await firstValueFrom(this.projects.update(id, update));
      } catch (err) {
        console.warn('[ProjectDetail] details save failed', err);
      } finally {
        this.savingWelcome.set(false);
      }
    }
    if (this.detailsMode() === 'edit') {
      // In-place edit: refresh the saved fields (hero + Details tab) and close.
      // The estimate re-reads too — guest count / event type feed line pricing.
      this.welcomeOpen.set(false);
      this.detail.reload();
      this.estimate.reload();
      return;
    }
    this.completeWelcome();
  }

  /** Dialog confirmed → close, refresh the saved detail fields (the estimate
   *  reload is owned by the recommend `.finally` above, so it lands once items
   *  exist), and drop the ?welcome param so a refresh doesn't re-open. */
  protected completeWelcome(): void {
    this.welcomeOpen.set(false);
    this.detail.reload();
    this.router
      .navigate([], { relativeTo: this.route, queryParams: { welcome: null }, queryParamsHandling: 'merge' })
      .catch(() => {});
  }

  protected setTab(t: string): void {
    // Landing on Ballpark Cost → refresh the hero headline (lines/rates may have
    // changed on the Marketplace tab since it last loaded).
    if (t === 'final') this.estimate.reload();
    this.router
      .navigate([], { relativeTo: this.route, queryParams: { tab: t }, queryParamsHandling: 'merge' })
      .catch((err) => console.warn('[ProjectDetail] nav failed', err));
  }

  /** Switch to another tab (e.g. "Go with this Ballpark" → Final Quote). */
  protected goToTab(tab: string): void {
    this.router
      .navigate([], { relativeTo: this.route, queryParams: { tab }, queryParamsHandling: 'merge' })
      .catch((err) => console.warn('[ProjectDetail] nav failed', err));
  }

  /** Map a picker result → ProjectUpdate (image clears icon + vice-versa) and
   *  persist (pV2-MEDIA-01b). */
  protected async onPick(r: PickerResult): Promise<void> {
    const patch: ProjectUpdate =
      r.type === 'image'
        ? {
            coverImageUrl: r.url,
            coverFocalX: r.focalX,
            coverFocalY: r.focalY,
            unsplashPhotographerName: r.attribution?.photographerName ?? null,
            unsplashPhotoUrl: r.attribution?.photoUrl ?? null,
            iconName: null,
            iconColor: null,
          }
        : {
            iconName: r.name,
            iconColor: r.color,
            coverImageUrl: null,
            unsplashPhotographerName: null,
            unsplashPhotoUrl: null,
          };
    await this.saveMedia(patch);
    this.imgDrawer.set(false);
  }

  protected onRemoveImage(): Promise<void> {
    return this.saveMedia({
      coverImageUrl: null,
      iconName: null,
      iconColor: null,
      unsplashPhotographerName: null,
      unsplashPhotoUrl: null,
    });
  }

  private async saveMedia(patch: ProjectUpdate, summary = 'Image updated.'): Promise<void> {
    const id = this.pid();
    if (!id) return;
    try {
      const fresh = await firstValueFrom(this.projects.update(id, patch));
      this.detail.set(fresh);
      this.toast.add({ severity: 'success', summary, life: 3000 });
    } catch (err) {
      this.toast.add({ severity: 'error', summary: "Couldn't update the image.", detail: errorDetail(err), life: 5000 });
    }
  }
}

