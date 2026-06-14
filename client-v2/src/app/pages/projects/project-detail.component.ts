import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CodelistService } from '../../core/codelists/codelist.service';
import { PageConfigService } from '../../core/config/page-config.service';
import { ProjectService } from '../../core/projects/project.service';
import { ProjectDetail, ProjectUpdate } from '../../core/projects/project.types';
import { errorDetail } from '../../core/http-error';
import { EditFieldComponent, EditFieldOption } from '../../shared/edit-field/edit-field.component';
import { EditSectionComponent } from '../../shared/edit-section/edit-section.component';
import { PageHeroComponent } from '../../shell/page-hero/page-hero.component';
import { TabBandComponent, TabBandTab } from '../../shared/tab-band/tab-band.component';
import { ProjectMarketplaceComponent } from './project-marketplace.component';
import { ProjectEstimateComponent } from './project-estimate.component';

type Tab = 'marketplace' | 'estimate' | 'details';
const TABS: Tab[] = ['marketplace', 'estimate', 'details'];

/** The three editable Details sections (v1 parity). */
type Section = 'event' | 'type' | 'logistics';

/** The editable detail form (strings — edit-field's surface). Ref, Status
 *  and Client are read-only (rendered from the loaded detail, not here). */
interface DetailForm {
  name: string;
  eventType: string;
  eventDate: string;
  venueName: string;
  venueCity: string;
  guestCount: string;
  durationDays: string;
  tier: string;
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
    ToastModule,
    PageHeroComponent,
    TabBandComponent,
    EditSectionComponent,
    EditFieldComponent,
    ProjectMarketplaceComponent,
    ProjectEstimateComponent,
  ],
  providers: [MessageService],
  /* Viewport-fit on EVERY tab (universal rule: the hero never scrolls).
     The marketplace tab manages its own column scroll; Details/Estimate
     scroll inside their own region below the anchored hero. */
  host: { class: 'block bp-vpfit' },
  template: `
    @if (detail.value(); as p) {
      <app-page-hero [back]="{ label: labelPlural(), href: '/projects' }" [title]="p.name" [subtitle]="p.ref ?? ''">
        <div hero-actions class="flex items-center gap-3">
          <app-tab-band [tabs]="tabs()" [active]="tab()" (activeChange)="setTab($event)" />
        </div>
      </app-page-hero>

      <div class="bp-page-body">
        @switch (tab()) {
          @case ('details') {
            <div class="bp-settings-body min-h-0 flex-1 overflow-y-auto">
              <!-- Event details (v1 parity): Ref + Status read-only header,
                   then editable name / venue / city. Client is read-only
                   (changing it needs a picker — out of this slice). -->
              <app-edit-section
                title="Event details"
                [editable]="true"
                [(editing)]="editingEvent"
                [saving]="saving()"
                (edit)="snapshot('event')"
                (cancelled)="restore('event')"
                (save)="save('event')"
              >
                <div class="bp-field-grid-2">
                  <app-edit-field label="Ref" density="page" [readonlyAlways]="true" [value]="p.ref ?? '—'" />
                  <app-edit-field label="Event name" density="page" [editing]="editingEvent()" [value]="form().name" (valueChange)="patch({ name: $event })" />
                  <app-edit-field label="Client" density="page" [readonlyAlways]="true" [value]="p.clientName ?? '—'" />
                  <app-edit-field label="Venue" density="page" [editing]="editingEvent()" [value]="form().venueName" (valueChange)="patch({ venueName: $event })" />
                  <app-edit-field label="City" density="page" [editing]="editingEvent()" [value]="form().venueCity" (valueChange)="patch({ venueCity: $event })" />
                </div>
              </app-edit-section>

              <app-edit-section
                title="Event type"
                [editable]="true"
                [(editing)]="editingType"
                [saving]="saving()"
                (edit)="snapshot('type')"
                (cancelled)="restore('type')"
                (save)="save('type')"
              >
                <div class="bp-field-grid-2">
                  <app-edit-field label="Event type" type="select" [options]="eventTypeOptions()" density="page" [editing]="editingType()" [value]="form().eventType" (valueChange)="patch({ eventType: $event })" />
                  <app-edit-field label="Tier" type="select" [options]="tierOptions" density="page" [editing]="editingType()" [value]="form().tier" (valueChange)="patch({ tier: $event })" />
                </div>
              </app-edit-section>

              <app-edit-section
                title="Logistics"
                [editable]="true"
                [(editing)]="editingLogistics"
                [saving]="saving()"
                (edit)="snapshot('logistics')"
                (cancelled)="restore('logistics')"
                (save)="save('logistics')"
              >
                <div class="bp-field-grid-2">
                  <app-edit-field label="Event date" density="page" [editing]="editingLogistics()" [value]="form().eventDate" (valueChange)="patch({ eventDate: $event })" />
                  <app-edit-field label="Duration (days)" type="number" density="page" [editing]="editingLogistics()" [value]="form().durationDays" (valueChange)="patch({ durationDays: $event })" />
                  <app-edit-field label="Guest count" type="number" density="page" [editing]="editingLogistics()" [value]="form().guestCount" (valueChange)="patch({ guestCount: $event })" />
                </div>
              </app-edit-section>
            </div>
          }
          @case ('estimate') {
            <div class="min-h-0 flex-1 overflow-y-auto">
              <app-project-estimate [projectId]="p.id" [project]="p" />
            </div>
          }
          @default {
            <app-project-marketplace [projectId]="p.id" />
          }
        }
      </div>
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
  private readonly codelists = inject(CodelistService);
  private readonly pageConfig = inject(PageConfigService);
  private readonly toast = inject(MessageService);

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly id = computed(() => this.params().get('id') ?? '');

  /** Marketplace is the default tab (PROJECTS.md) — it's where you build
   *  the project's quote. */
  protected readonly tab = computed<Tab>(() => {
    const t = this.query().get('tab');
    return (TABS as string[]).includes(t ?? '') ? (t as Tab) : 'marketplace';
  });

  protected readonly label = computed(() => this.pageConfig.eventLabel());
  protected readonly labelPlural = computed(() => `${this.label()}s`);
  protected readonly tabs = computed<TabBandTab[]>(() => [
    { key: 'marketplace', label: 'Marketplace' },
    { key: 'estimate', label: 'Estimate' },
    { key: 'details', label: this.label() + ' details' },
  ]);

  protected readonly detail = resource<ProjectDetail, string>({
    params: () => this.id(),
    loader: async ({ params }) => {
      const d = await firstValueFrom(this.projects.getDetail(params));
      this.form.set(toForm(d));
      return d;
    },
  });

  protected readonly form = signal<DetailForm>(toForm(null));
  protected readonly editingEvent = signal(false);
  protected readonly editingType = signal(false);
  protected readonly editingLogistics = signal(false);
  protected readonly saving = signal(false);
  private snapshots: Partial<Record<Section, DetailForm>> = {};

  protected readonly tierOptions: EditFieldOption[] = [
    { label: 'Starter', value: 'starter' },
    { label: 'Professional', value: 'professional' },
    { label: 'Premium', value: 'premium' },
  ];

  // Status shows as a pill (hero + Event details, v1 parity); transitions
  // get a dedicated allowed_next_codes control later, not a free dropdown.
  private readonly eventTypeRes = resource({
    loader: () => this.codelists.list('event_type'),
  });
  protected readonly eventTypeOptions = computed<EditFieldOption[]>(
    () => this.eventTypeRes.value()?.map((v) => ({ label: v.label, value: v.code })) ?? []
  );

  protected setTab(t: string): void {
    this.router
      .navigate([], { relativeTo: this.route, queryParams: { tab: t }, queryParamsHandling: 'merge' })
      .catch((err) => console.warn('[ProjectDetail] nav failed', err));
  }

  protected patch(p: Partial<DetailForm>): void {
    this.form.update((f) => ({ ...f, ...p }));
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
  };

  /** Per-section save (audit 02-F-2 lesson) — only the edited section's
   *  fields travel. Match v1's three sections. */
  protected async save(section: Section): Promise<void> {
    const id = this.id();
    if (!id) return;
    this.saving.set(true);
    const f = this.form();
    const patch: ProjectUpdate =
      section === 'event'
        ? {
            name: f.name.trim() || undefined,
            venueName: nullable(f.venueName),
            venueCity: nullable(f.venueCity),
          }
        : section === 'type'
          ? { eventType: nullable(f.eventType), tier: asTier(f.tier) }
          : {
              eventDate: nullable(f.eventDate),
              durationDays: numOrNull(f.durationDays),
              guestCount: numOrNull(f.guestCount),
            };
    try {
      const fresh = await firstValueFrom(this.projects.update(id, patch));
      this.form.set(toForm(fresh));
      this.detail.set(fresh);
      this.editingFlags[section].set(false);
      this.toast.add({ severity: 'success', summary: 'Saved.', life: 3000 });
    } catch (err) {
      this.toast.add({ severity: 'error', summary: "Couldn't save — please try again.", detail: errorDetail(err), life: 5000 });
    } finally {
      this.saving.set(false);
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
    eventType: d?.eventType ?? '',
    eventDate: d?.eventDate ?? '',
    venueName: d?.venueName ?? '',
    venueCity: d?.venueCity ?? '',
    guestCount: d?.guestCount != null ? String(d.guestCount) : '',
    durationDays: d?.durationDays != null ? String(d.durationDays) : '',
    tier: d?.tier ?? '',
  };
}
