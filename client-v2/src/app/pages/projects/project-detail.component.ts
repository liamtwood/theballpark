import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';
import { CodelistService } from '../../core/codelists/codelist.service';
import { PageConfigService } from '../../core/config/page-config.service';
import { ProjectService } from '../../core/projects/project.service';
import { EstimateBreakdown, ProjectDetail, ProjectUpdate } from '../../core/projects/project.types';
import { GalleryImage, PickerResult } from '../../core/media/media.types';
import { errorDetail } from '../../core/http-error';
import { EditFieldOption } from '../../shared/edit-field/edit-field.component';
import { SelectComponent, SelectOption } from '../../shared/select/select.component';
import { natoDate } from '../../shared/details-format';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { TabBandComponent, TabBandTab } from '../../shared/tab-band/tab-band.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { ImagePickerComponent } from '../../shared/image-picker/image-picker.component';
import { ImageGalleryComponent } from '../../shared/image-gallery/image-gallery.component';
import { EntityIconComponent } from '../../shared/entity-icon/entity-icon.component';
import { CompletenessCardComponent } from '../../shared/completeness/completeness-card.component';
import { SaveStatePillComponent } from '../../shared/save-state-pill/save-state-pill.component';
import { CompletenessConfig } from '../../shared/completeness/completeness.types';
import { ProjectMarketplaceComponent } from './project-marketplace.component';
import { ProjectEstimateComponent } from './project-estimate.component';
import { QuoteDocumentComponent } from './quote-document.component';
import { SowDocumentComponent } from './sow-document.component';
import { InboxProjectComponent } from '../inbox/inbox-project.component';
import { ProjectOverviewHeroComponent } from './project-overview-hero.component';
import { InboxService } from '../../core/inbox/inbox.service';
import { CoachmarkComponent } from '../../shared/coachmark/coachmark.component';

type Tab = 'marketplace' | 'estimate' | 'final' | 'reports' | 'details' | 'inbox';
const TABS: Tab[] = ['marketplace', 'estimate', 'final', 'reports', 'details', 'inbox'];

/** The editable Details sections (v1 parity + per-project Financials). */
type Section = 'event' | 'type' | 'logistics' | 'financials' | 'sow';

/** The editable detail form (strings — edit-field's surface). Ref, Status
 *  and Client are read-only (rendered from the loaded detail, not here). */
interface DetailForm {
  name: string;
  description: string;
  clientName: string;
  clientCompanyNumber: string;
  clientAddress: string;
  eventType: string;
  eventDate: string;
  venueName: string;
  venueCity: string;
  guestCount: string;
  durationDays: string;
  tier: string;
  budget: string;
  marginPct: string;
  contingencyPct: string;
  vatPct: string;
  sowTimeline: string;
  sowPaymentTerms: string;
  sowSpecialTerms: string;
}

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
    CurrencyPipe,
    ToastModule,
    LucideAngularModule,
    CoachmarkComponent,
    PageHeroComponent,
    SelectComponent,
    TabBandComponent,
    CompletenessCardComponent,
    DrawerComponent,
    ImagePickerComponent,
    ImageGalleryComponent,
    EntityIconComponent,
    ProjectMarketplaceComponent,
    ProjectEstimateComponent,
    QuoteDocumentComponent,
    SowDocumentComponent,
    InboxProjectComponent,
    ProjectOverviewHeroComponent,
    FormsModule,
    SaveStatePillComponent,
  ],
  providers: [MessageService],
  /* Viewport-fit on EVERY tab (universal rule: the hero never scrolls).
     The marketplace tab manages its own column scroll; Details/Estimate
     scroll inside their own region below the anchored hero. */
  host: { class: 'block bp-vpfit' },
  template: `
    @if (detail.value(); as p) {
      @if (isDraft()) {
        <app-page-hero eyebrow="Project" [dense]="true" [contained]="true" [back]="{ label: 'Past projects', href: '/projects' }"
                       [title]="p.name" [subtitle]="p.ref ?? ''"
                       rightEyebrow="Ballpark"
                       [rightTitle]="(estimate.value()?.projectTotal | currency: (p.currency || 'GBP') : 'symbol' : '1.0-0') ?? '—'"
                       rightSubtitle="Exc. VAT" />
      } @else {
        <!-- Live project: cover hero + negotiation tiles, in the workspace column.
             bp-gutter reserves the scrollbar gutter so it lines up with the body. -->
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
              (buildCover)="onBuildCover()" />
          </div>
        </div>
      }

      <!-- Tabs sit just above the tab content (Liam 2026-08-28). Coachmarks
           overlay ABOVE the band in their own layer (absolute → no layout shift
           when they show/dismiss), tail pointing DOWN at the target tab. The
           x-offset aligns the tail with the target of the even-width tabs. -->
      <div class="relative shrink-0 pt-3">
        @if (tab() === 'final') {
          <div class="pointer-events-none absolute bottom-full left-1/2 z-40 -translate-x-1/2 pb-2">
            <div class="-translate-x-[150px]">
              <app-coachmark page="ballpark-cost" name="intro" tail="down"
                             defaultText="Here is your ballpark cost. Feel free to remove anything and add elements from the marketplace." />
            </div>
          </div>
        }
        @if (tab() === 'marketplace') {
          <!-- Marketplace is the centre tab (index 2 of 5) → no x-offset. -->
          <div class="pointer-events-none absolute bottom-full left-1/2 z-40 -translate-x-1/2 pb-2">
            <app-coachmark page="marketplace" name="intro" tail="down"
                           defaultText="Here is the marketplace. Keep track of your running estimate by going back to the Ballpark tab." />
          </div>
        }
        <!-- Fill the working column + reserve the scrollbar gutter so the tab
             band lines up with the hero above and the content below. -->
        <div class="bp-gutter px-6">
          <div class="mx-auto w-full max-w-[var(--workspace-max)]">
            <app-tab-band [tabs]="tabs()" [active]="tab()" [fill]="true" (activeChange)="setTab($event)" />
          </div>
        </div>
      </div>

      <div class="bp-page-body">
        @switch (tab()) {
          @case ('details') {
            <!-- Ready-to-edit rounded fields; each field saves on blur with the
                 shared "Details saved" pill (app-save-state-pill). Overflow is
                 full-width so the scrollbar sits at the window edge; content is
                 centred in the workspace column. -->
            <div class="min-h-0 flex-1 bp-gutter pt-4">
            <div class="mx-auto flex w-full max-w-[var(--workspace-max)] flex-col gap-4">
              <app-completeness-card
                [entity]="p"
                [config]="completenessConfig"
                title="Project completeness"
                entityLabel="project"
                (actionClicked)="handleCompletenessAction($event)"
              />

              <!-- Event details -->
              <div #companySection class="ed-card shrink-0 p-6">
                <div class="flex items-center justify-between">
                  <h2 class="bp-card-title">Event details</h2>
                  <app-save-state-pill [state]="detailState()" />
                </div>
                <div class="mt-4 flex flex-col gap-4">
                  <!-- Ref + Event name + Company number + Client on one line;
                       Ref and Company number share a width. -->
                  <div class="flex flex-wrap items-start gap-x-5 gap-y-4">
                    <label class="block w-[calc(11ch+2.5rem)]"><span class="ed-label mb-1.5 block">Ref</span><input class="ed-input" [value]="p.ref ?? '—'" disabled /></label>
                    <label class="block min-w-[12rem] flex-1"><span class="ed-label mb-1.5 block">Event name</span><input class="ed-input" [ngModel]="form().name" (ngModelChange)="patch({ name: $event })" (blur)="saveSection('event')" /></label>
                    <label class="block w-[calc(11ch+2.5rem)]"><span class="ed-label mb-1.5 block">Client company no.</span><input class="ed-input" [ngModel]="form().clientCompanyNumber" (ngModelChange)="patch({ clientCompanyNumber: $event })" (blur)="saveSection('event')" /></label>
                    <label class="block min-w-[12rem] flex-1"><span class="ed-label mb-1.5 block">Client</span><input class="ed-input" [ngModel]="form().clientName" (ngModelChange)="patch({ clientName: $event })" (blur)="saveSection('event')" /></label>
                  </div>
                  <label class="block"><span class="ed-label mb-1.5 block">Client address</span><textarea class="ed-textarea" rows="2" [ngModel]="form().clientAddress" (ngModelChange)="patch({ clientAddress: $event })" (blur)="saveSection('event')"></textarea></label>
                  <label class="block"><span class="ed-label mb-1.5 block">Description</span><textarea class="ed-textarea" rows="3" placeholder="Project overview — seeded from the brief; shown on the quote document." [ngModel]="form().description" (ngModelChange)="patch({ description: $event })" (blur)="saveSection('event')"></textarea></label>
                </div>
              </div>

              <!-- Event Logistics — type & tier + date / duration / guests -->
              <div class="ed-card shrink-0 p-6">
                <div class="flex items-center justify-between">
                  <h2 class="bp-card-title">Event Logistics</h2>
                  <app-save-state-pill [state]="detailState()" />
                </div>
                <div class="mt-4 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                  <label class="block"><span class="ed-label mb-1.5 block">Event type</span>
                    <app-select ariaLabel="Event type" [options]="eventTypeSelectOptions()" [value]="form().eventType" (changed)="patch({ eventType: $event }); saveSection('type')" />
                  </label>
                  <label class="block"><span class="ed-label mb-1.5 block">Tier</span>
                    <app-select ariaLabel="Tier" [options]="tierSelectOptions" [value]="form().tier" (changed)="patch({ tier: $event }); saveSection('type')" />
                  </label>
                </div>
                <div class="mt-4 flex flex-wrap gap-x-5 gap-y-4">
                  <label class="block w-[calc(12ch+2.5rem)]"><span class="ed-label mb-1.5 block">Event date</span>
                    <!-- NATO display + native OS picker: the transparent date input
                         sits over the calendar icon; picking reformats to NATO. -->
                    <div class="relative">
                      <input class="ed-input pr-10" type="text" placeholder="e.g. 20-Aug-2026" title="Standard format: DD-Mmm-YYYY (free text like 'TBC' / 'Q4' is fine too)" [ngModel]="form().eventDate" (ngModelChange)="patch({ eventDate: $event })" (blur)="onEventDateBlur()" />
                      <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style="color: var(--color-text-secondary);"><lucide-icon name="calendar" [size]="16" /></span>
                      <input type="date" aria-label="Pick event date" class="absolute right-0 top-0 h-full w-11 cursor-pointer opacity-0" (change)="onEventDatePicked($any($event.target).value)" />
                    </div>
                  </label>
                  <label class="block w-[calc(12ch+2.5rem)]"><span class="ed-label mb-1.5 block">Duration (days)</span><input class="ed-input" type="number" [ngModel]="form().durationDays" (ngModelChange)="patch({ durationDays: $event })" (blur)="saveSection('logistics')" /></label>
                  <label class="block w-[calc(12ch+2.5rem)]"><span class="ed-label mb-1.5 block">Guest count</span><input class="ed-input" type="number" [ngModel]="form().guestCount" (ngModelChange)="patch({ guestCount: $event })" (blur)="saveSection('logistics')" /></label>
                </div>
                <div class="mt-4 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                  <label class="block"><span class="ed-label mb-1.5 block">Venue</span><input class="ed-input" [ngModel]="form().venueName" (ngModelChange)="patch({ venueName: $event })" (blur)="saveSection('event')" /></label>
                  <label class="block"><span class="ed-label mb-1.5 block">City</span><input class="ed-input" [ngModel]="form().venueCity" (ngModelChange)="patch({ venueCity: $event })" (blur)="saveSection('event')" /></label>
                </div>
              </div>

              <!-- Financials -->
              <div class="ed-card shrink-0 p-6">
                <div class="flex items-center justify-between">
                  <h2 class="bp-card-title">Financials</h2>
                  <app-save-state-pill [state]="detailState()" />
                </div>
                <div class="mt-4 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                  <label class="block"><span class="ed-label mb-1.5 block">Budget ({{ cur() === 'USD' ? '$' : cur() === 'EUR' ? '€' : '£' }})</span><input class="ed-input" type="text" inputmode="numeric" [ngModel]="form().budget" (ngModelChange)="patch({ budget: $event })" (blur)="onBudgetBlur()" /></label>
                  <label class="block"><span class="ed-label mb-1.5 block">Margin (%)</span><input class="ed-input" type="number" [ngModel]="form().marginPct" (ngModelChange)="patch({ marginPct: $event })" (blur)="saveSection('financials')" /></label>
                  <label class="block"><span class="ed-label mb-1.5 block">Contingency (%)</span><input class="ed-input" type="number" [ngModel]="form().contingencyPct" (ngModelChange)="patch({ contingencyPct: $event })" (blur)="saveSection('financials')" /></label>
                  <label class="block"><span class="ed-label mb-1.5 block">VAT (%)</span><input class="ed-input" type="number" [ngModel]="form().vatPct" (ngModelChange)="patch({ vatPct: $event })" (blur)="saveSection('financials')" /></label>
                </div>
              </div>

              <!-- Statement of Work -->
              <div class="ed-card shrink-0 p-6">
                <div class="flex items-center justify-between">
                  <h2 class="bp-card-title">Statement of Work</h2>
                  <app-save-state-pill [state]="detailState()" />
                </div>
                <div class="mt-4 flex flex-col gap-4">
                  <label class="block"><span class="ed-label mb-1.5 block">Timeline</span><textarea class="ed-textarea" rows="4" placeholder="One milestone per line, e.g. 'Install 20.08.26'." [ngModel]="form().sowTimeline" (ngModelChange)="patch({ sowTimeline: $event })" (blur)="saveSection('sow')"></textarea></label>
                  <label class="block"><span class="ed-label mb-1.5 block">Payment Terms</span><textarea class="ed-textarea" rows="3" placeholder="e.g. 50% on signature, 50% on completion." [ngModel]="form().sowPaymentTerms" (ngModelChange)="patch({ sowPaymentTerms: $event })" (blur)="saveSection('sow')"></textarea></label>
                  <label class="block"><span class="ed-label mb-1.5 block">Special Terms</span><textarea class="ed-textarea" rows="3" placeholder="Anything bespoke to this project (default: N/A)." [ngModel]="form().sowSpecialTerms" (ngModelChange)="patch({ sowSpecialTerms: $event })" (blur)="saveSection('sow')"></textarea></label>
                </div>
              </div>

              <!-- Image -->
              <div class="ed-card shrink-0 p-6">
                <h2 class="bp-card-title">Image</h2>
                <div class="mt-3 flex flex-col items-start gap-3">
                  <div class="bp-media-preview">
                    @if (p.coverUrl) {
                      <img [src]="p.coverUrl" alt="" [style.object-position]="p.coverFocalX + '% ' + p.coverFocalY + '%'" />
                    } @else if (p.iconName) {
                      <app-entity-icon [name]="p.iconName" [color]="p.iconColor" [size]="36" />
                    } @else {
                      <span class="bp-caption">No image</span>
                    }
                  </div>
                  <button type="button" class="bp-btn-outline" (click)="imgDrawer.set(true)">
                    <lucide-icon name="square-pen" [size]="16" /> Edit
                  </button>
                </div>
                @if (p.unsplashPhotographerName) {
                  <p class="bp-caption mt-2">Photo by {{ p.unsplashPhotographerName }} on Unsplash</p>
                }
              </div>

              <!-- Gallery -->
              <div #mediaSection class="ed-card shrink-0 p-6">
                <h2 class="bp-card-title">Gallery</h2>
                <p class="bp-caption mt-1">Add up to 5 photos — hover one to reorder, set it as the cover, or remove it.</p>
                <div class="mt-3">
                  <app-image-gallery
                    entityType="project"
                    [images]="p.images"
                    [primaryUrl]="p.coverUrl"
                    [searchSeed]="p.name"
                    (imagesChange)="saveImages($event)"
                    (primarySet)="setPrimary($event)"
                  />
                </div>
              </div>
            </div>
            </div>
          }
          @case ('estimate') {
            <div class="min-h-0 flex-1 bp-gutter">
              <app-project-estimate [projectId]="p.id" [project]="p" (addItems)="addItems()" (goToFinal)="goToTab('final')" (detailsSaved)="detail.reload()" />
            </div>
          }
          @case ('final') {
            <div class="min-h-0 flex-1 bp-gutter">
              <app-project-estimate [projectId]="p.id" [project]="p" view="final" (detailsSaved)="detail.reload()" />
            </div>
          }
          @case ('reports') {
            <div class="min-h-0 flex-1 bp-gutter">
              <!-- pV2-BUILDUP-04 — the client-facing documents (open as overlays);
                   styled to match the tab band. -->
              <div class="flex justify-center pt-6">
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
            <app-project-marketplace [projectId]="p.id" />
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

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly id = computed(() => this.params().get('id') ?? '');

  /** Marketplace is the default tab (PROJECTS.md) — it's where you build
   *  the project's quote. */
  protected readonly tab = computed<Tab>(() => {
    const raw = this.query().get('tab');
    let t: Tab = (TABS as string[]).includes(raw ?? '') ? (raw as Tab) : 'final';
    // Draft hides About/Reports/Inbox — fall back to Ballpark Cost if the URL
    // points at a hidden tab (e.g. an old bookmark, or before the status flips).
    if (this.isDraft() && (t === 'details' || t === 'reports' || t === 'inbox')) t = 'final';
    return t;
  });

  /** Work-dense tabs collapse the overview hero to a slim name band to reclaim
   *  space (reverses automatically on the way back). Full hero stays on the
   *  landing (Ballpark Cost) + About Project. Reusable — add tabs here. */
  private readonly COLLAPSE_HERO_TABS = new Set<Tab>(['marketplace', 'reports', 'inbox']);
  protected readonly heroCollapsed = computed(() => this.COLLAPSE_HERO_TABS.has(this.tab()));

  protected readonly label = computed(() => this.pageConfig.eventLabel());
  protected readonly labelPlural = computed(() => `${this.label()}s`);
  /** A DRAFT project (not yet sent to suppliers) shows only Ballpark Cost +
   *  Marketplace — About Project (event details already live on Ballpark Cost),
   *  Reports and Inbox unlock once it goes Active (sent to suppliers). */
  protected readonly isDraft = computed(() => (this.detail.value()?.status ?? 'draft') === 'draft');
  protected readonly tabs = computed<TabBandTab[]>(() => {
    const draft = this.isDraft();
    const t: TabBandTab[] = [];
    if (!draft) t.push({ key: 'details', label: 'About ' + this.label() });
    t.push({ key: 'final', label: 'Ballpark Cost' });
    t.push({ key: 'marketplace', label: 'Marketplace' });
    if (!draft) {
      t.push({ key: 'reports', label: 'Reports' });
      t.push({ key: 'inbox', label: 'Inbox' });
    }
    return t;
  });

  protected readonly detail = resource<ProjectDetail, string>({
    params: () => this.id(),
    loader: async ({ params }) => {
      const d = await firstValueFrom(this.projects.getDetail(params));
      this.form.set(toForm(d));
      return d;
    },
  });

  /** The server-computed cascade — the hero's "Ballpark / Project Total"
   *  headline reads its `projectTotal`. Reloaded after an estimate-affecting
   *  edit (rates / lines) so the headline stays live. */
  protected readonly estimate = resource<EstimateBreakdown, string>({
    params: () => this.id(),
    loader: ({ params }) => firstValueFrom(this.projects.estimate(params, 'all')),
  });

  /** Live-project overview metrics (confirmed / agreed / open threads) — only
   *  fetched once the project is Active (the cover hero's tiles). */
  protected readonly overview = resource({
    params: () => (this.isDraft() ? undefined : this.id() || undefined),
    loader: ({ params }) => firstValueFrom(this.inbox.projectOverview(params)),
  });

  protected readonly form = signal<DetailForm>(toForm(null));
  protected readonly editingEvent = signal(false);
  protected readonly editingType = signal(false);
  protected readonly editingLogistics = signal(false);
  protected readonly editingFinancials = signal(false);
  protected readonly editingSow = signal(false);
  protected readonly saving = signal(false);
  /** Save-on-blur pill state for the always-editable About Project fields. */
  protected readonly detailState = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  /** The project's currency (for the Budget field symbol). */
  protected readonly cur = computed(() => this.detail.value()?.currency || 'GBP');
  /** Image-picker drawer (pV2-MEDIA-01b). */
  protected readonly imgDrawer = signal(false);
  /** pV2-BUILDUP-04 — Final Quote → client-facing document overlays. */
  protected readonly docView = signal(false);
  protected readonly sowView = signal(false);
  private snapshots: Partial<Record<Section, DetailForm>> = {};

  protected readonly tierOptions: EditFieldOption[] = [
    { label: 'Starter', value: 'starter' },
    { label: 'Professional', value: 'professional' },
    { label: 'Premium', value: 'premium' },
  ];
  /** app-select options — a leading "—" (none) row keeps the native clear. */
  protected readonly tierSelectOptions: SelectOption[] = [
    { value: '', label: '—' },
    ...this.tierOptions,
  ];

  // Status shows as a pill (hero + Event details, v1 parity); transitions
  // get a dedicated allowed_next_codes control later, not a free dropdown.
  private readonly eventTypeRes = resource({
    loader: () => this.codelists.list('event_type'),
  });
  protected readonly eventTypeOptions = computed<EditFieldOption[]>(
    () => this.eventTypeRes.value()?.map((v) => ({ label: v.label, value: v.code })) ?? []
  );
  protected readonly eventTypeSelectOptions = computed<SelectOption[]>(
    () => [{ value: '', label: '—' }, ...this.eventTypeOptions()],
  );

  /** Distinct client names this org has used — the Client field's type-ahead. */
  private readonly clientNamesRes = resource({
    loader: () => firstValueFrom(this.projects.clientNames()),
  });
  protected readonly clientNames = computed<string[]>(() => this.clientNamesRes.value() ?? []);

  protected setTab(t: string): void {
    // Landing on Ballpark Cost → refresh the hero headline (lines/rates may have
    // changed on the Marketplace tab since it last loaded).
    if (t === 'final') this.estimate.reload();
    this.router
      .navigate([], { relativeTo: this.route, queryParams: { tab: t }, queryParamsHandling: 'merge' })
      .catch((err) => console.warn('[ProjectDetail] nav failed', err));
  }

  /** "Add more items" (Estimate tab) → the Marketplace tab in item-browse
   *  mode (mode:null — the marketplace store treats absence as items). */
  protected addItems(): void {
    this.router
      .navigate([], { relativeTo: this.route, queryParams: { tab: 'marketplace', mode: null }, queryParamsHandling: 'merge' })
      .catch((err) => console.warn('[ProjectDetail] nav failed', err));
  }

  /** Switch to another tab (e.g. "Go with this Ballpark" → Final Quote). */
  protected goToTab(tab: string): void {
    this.router
      .navigate([], { relativeTo: this.route, queryParams: { tab }, queryParamsHandling: 'merge' })
      .catch((err) => console.warn('[ProjectDetail] nav failed', err));
  }

  protected patch(p: Partial<DetailForm>): void {
    this.form.update((f) => ({ ...f, ...p }));
  }

  /** Native OS picker → NATO, then save. Build a LOCAL date from the yyyy-mm-dd
   *  parts so the UTC-parsed ISO never shifts the day across a timezone boundary. */
  protected onEventDatePicked(iso: string): void {
    if (!iso) return;
    const [y, m, d] = iso.split('-').map(Number);
    this.patch({ eventDate: natoDate(new Date(y, m - 1, d).toDateString()) });
    void this.saveSection('logistics');
  }

  /** Normalise the typed date to NATO on blur (free text like "TBC"/"Q4" is left
   *  as-is), then save. */
  protected onEventDateBlur(): void {
    const v = this.form().eventDate.trim();
    if (v) this.patch({ eventDate: natoDate(v) });
    void this.saveSection('logistics');
  }

  protected snapshot(section: Section): void {
    this.snapshots[section] = { ...this.form() };
  }

  protected restore(section: Section): void {
    const snap = this.snapshots[section];
    if (snap) this.form.set({ ...snap });
  }

  private readonly editingFlags: Record<Section, ReturnType<typeof signal<boolean>>> = {
    event: this.editingEvent,
    type: this.editingType,
    logistics: this.editingLogistics,
    financials: this.editingFinancials,
    sow: this.editingSow,
  };

  /** Weighted "% complete" over the project's key fields — mirrors the Profile
   *  completeness card. Each unmet item deep-links into its edit section. */
  protected readonly completenessConfig: CompletenessConfig<ProjectDetail> = [
    { weight: 15, label: 'Add a cover image', action: 'image', done: (p) => !!p.coverUrl || !!p.iconName },
    { weight: 10, label: 'Add the client', action: 'event', done: (p) => !!p.clientName },
    { weight: 10, label: 'Set the event type', action: 'type', done: (p) => !!p.eventType },
    { weight: 15, label: 'Set the event date', action: 'logistics', done: (p) => !!p.eventDate },
    { weight: 10, label: 'Add the venue', action: 'event', done: (p) => !!p.venueName },
    { weight: 10, label: 'Add the venue city', action: 'event', done: (p) => !!p.venueCity },
    { weight: 10, label: 'Set the guest count', action: 'logistics', done: (p) => p.guestCount != null },
    { weight: 5, label: 'Set the duration', action: 'logistics', done: (p) => p.durationDays != null },
    { weight: 15, label: 'Set the budget', action: 'financials', done: (p) => p.projectBudget != null },
    { weight: 10, label: 'Set margin, contingency & VAT', action: 'financials',
      done: (p) => p.defaultMarginPct != null && p.defaultContingencyPct != null && p.defaultVatPct != null },
  ];

  /** Deep-link a completeness suggestion into its editor: open the image
   *  drawer, else snapshot + open the matching edit section. */
  protected handleCompletenessAction(action: string): void {
    if (action === 'image') {
      this.imgDrawer.set(true);
      return;
    }
    const flag = this.editingFlags[action as Section];
    if (flag) {
      this.snapshot(action as Section);
      flag.set(true);
    }
  }

  /** Per-section save (audit 02-F-2 lesson) — only the edited section's
   *  fields travel. Match v1's three sections. */
  /** Build a section's ProjectUpdate patch from the current form state. */
  private buildPatch(section: Section): ProjectUpdate {
    const f = this.form();
    return section === 'event'
      ? {
          name: f.name.trim() || undefined,
          description: nullable(f.description),
          clientName: nullable(f.clientName),
          clientCompanyNumber: nullable(f.clientCompanyNumber),
          clientAddress: nullable(f.clientAddress),
          venueName: nullable(f.venueName),
          venueCity: nullable(f.venueCity),
        }
      : section === 'type'
        ? { eventType: nullable(f.eventType), tier: asTier(f.tier) }
        : section === 'logistics'
          ? {
              eventDate: nullable(f.eventDate),
              durationDays: numOrNull(f.durationDays),
              guestCount: numOrNull(f.guestCount),
            }
          : section === 'financials'
            ? {
                projectBudget: numOrNull(f.budget.replace(/,/g, '')),
                defaultMarginPct: numOrNull(f.marginPct),
                defaultContingencyPct: numOrNull(f.contingencyPct),
                defaultVatPct: numOrNull(f.vatPct),
              }
            : {
                sowTimeline: nullable(f.sowTimeline),
                sowPaymentTerms: nullable(f.sowPaymentTerms),
                sowSpecialTerms: nullable(f.sowSpecialTerms),
              };
  }

  /** Budget blur — reflect thousands commas in the box, then save. */
  protected onBudgetBlur(): void {
    const n = numOrNull(this.form().budget.replace(/,/g, ''));
    this.patch({ budget: n != null ? n.toLocaleString('en-GB') : '' });
    void this.saveSection('financials');
  }

  /** "Build cover from your items" — compose a cover from the project's item
   *  images. Not built yet. */
  protected onBuildCover(): void {
    this.toast.add({ severity: 'info', summary: 'Build cover from your items is coming soon.', life: 4000 });
  }

  /** Save-on-blur (always-editable fields): persist the section, flash the
   *  "Details saved" pill — no edit-mode toggle, no toast. */
  protected async saveSection(section: Section): Promise<void> {
    const id = this.id();
    if (!id) return;
    this.detailState.set('saving');
    try {
      const fresh = await firstValueFrom(this.projects.update(id, this.buildPatch(section)));
      this.form.set(toForm(fresh));
      this.detail.set(fresh);
      if (section === 'event') this.clientNamesRes.reload();
      this.detailState.set('saved');
    } catch (err) {
      console.warn('[ProjectDetail] save failed', err);
      this.detailState.set('error');
    }
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

  /** pV2-MEDIA-01c — gallery edits (add / remove / reorder) persist the array. */
  protected saveImages(images: GalleryImage[]): Promise<void> {
    return this.saveMedia({ images }, 'Gallery updated.');
  }

  /** "Set as cover" — copy the chosen gallery photo into the cover_* columns
   *  (MEDIA.md §12); clears any icon fallback so the photo wins. */
  protected setPrimary(img: GalleryImage): Promise<void> {
    return this.saveMedia(
      {
        coverImageUrl: img.url,
        coverFocalX: img.focalX,
        coverFocalY: img.focalY,
        unsplashPhotographerName: img.attribution?.photographerName ?? null,
        unsplashPhotoUrl: img.attribution?.photoUrl ?? null,
        iconName: null,
        iconColor: null,
      },
      'Cover updated.'
    );
  }

  private async saveMedia(patch: ProjectUpdate, summary = 'Image updated.'): Promise<void> {
    const id = this.id();
    if (!id) return;
    try {
      const fresh = await firstValueFrom(this.projects.update(id, patch));
      this.detail.set(fresh);
      this.form.set(toForm(fresh));
      this.toast.add({ severity: 'success', summary, life: 3000 });
    } catch (err) {
      this.toast.add({ severity: 'error', summary: "Couldn't update the image.", detail: errorDetail(err), life: 5000 });
    }
  }
}

function nullable(v: string): string | null {
  return v.trim() || null;
}
function numOrNull(v: string): number | null {
  const n = Number(v);
  return v.trim() === '' || Number.isNaN(n) ? null : n;
}
function asTier(v: string): ProjectUpdate['tier'] {
  return (['starter', 'professional', 'premium'] as const).find((t) => t === v) ?? null;
}

function toForm(d: ProjectDetail | null): DetailForm {
  return {
    name: d?.name ?? '',
    description: d?.description ?? '',
    clientName: d?.clientName ?? '',
    clientCompanyNumber: d?.clientCompanyNumber ?? '',
    clientAddress: d?.clientAddress ?? '',
    eventType: d?.eventType ?? '',
    eventDate: d?.eventDate ?? '',
    venueName: d?.venueName ?? '',
    venueCity: d?.venueCity ?? '',
    guestCount: d?.guestCount != null ? String(d.guestCount) : '',
    durationDays: d?.durationDays != null ? String(d.durationDays) : '',
    tier: d?.tier ?? '',
    budget: d?.projectBudget != null ? d.projectBudget.toLocaleString('en-GB') : '',
    marginPct: d?.defaultMarginPct != null ? String(d.defaultMarginPct) : '',
    contingencyPct: d?.defaultContingencyPct != null ? String(d.defaultContingencyPct) : '',
    vatPct: d?.defaultVatPct != null ? String(d.defaultVatPct) : '',
    sowTimeline: d?.sowTimeline ?? '',
    sowPaymentTerms: d?.sowPaymentTerms ?? '',
    sowSpecialTerms: d?.sowSpecialTerms ?? '',
  };
}
