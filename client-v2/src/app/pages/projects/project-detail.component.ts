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
import { StatusPillComponent } from '../../shared/status-pill/status-pill.component';
import { TabBandComponent, TabBandTab } from '../../shared/tab-band/tab-band.component';

type Tab = 'marketplace' | 'estimate' | 'details';
const TABS: Tab[] = ['marketplace', 'estimate', 'details'];

/** The editable detail form (strings — edit-field's surface). */
interface DetailForm {
  name: string;
  status: string;
  eventType: string;
  eventDate: string;
  venueName: string;
  venueCity: string;
  venueAddress: string;
  guestCount: string;
  durationDays: string;
  projectBudget: string;
  currency: string;
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
    StatusPillComponent,
  ],
  providers: [MessageService],
  host: { class: 'block' },
  template: `
    @if (detail.value(); as p) {
      <app-page-hero [back]="{ label: labelPlural(), href: '/projects' }" [title]="p.name" [subtitle]="p.ref ?? ''">
        <div hero-actions class="flex items-center gap-3">
          <app-status-pill list="project_status" [code]="p.status" />
          <app-tab-band [tabs]="tabs()" [active]="tab()" (activeChange)="setTab($event)" />
        </div>
      </app-page-hero>

      <div class="bp-page-body">
        @switch (tab()) {
          @case ('details') {
            <div class="bp-settings-body">
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
                  <app-edit-field label="Name" density="page" [editing]="editingEvent()" [value]="form().name" (valueChange)="patch({ name: $event })" />
                  <app-edit-field label="Status" type="select" [options]="statusOptions()" density="page" [editing]="editingEvent()" [value]="form().status" (valueChange)="patch({ status: $event })" />
                  <app-edit-field label="Event type" density="page" [editing]="editingEvent()" [value]="form().eventType" (valueChange)="patch({ eventType: $event })" />
                  <app-edit-field label="Event date" density="page" [editing]="editingEvent()" [value]="form().eventDate" (valueChange)="patch({ eventDate: $event })" />
                  <app-edit-field label="Venue name" density="page" [editing]="editingEvent()" [value]="form().venueName" (valueChange)="patch({ venueName: $event })" />
                  <app-edit-field label="Venue city" density="page" [editing]="editingEvent()" [value]="form().venueCity" (valueChange)="patch({ venueCity: $event })" />
                  <app-edit-field label="Venue address" density="page" [span2]="true" [editing]="editingEvent()" [value]="form().venueAddress" (valueChange)="patch({ venueAddress: $event })" />
                  <app-edit-field label="Guest count" type="number" density="page" [editing]="editingEvent()" [value]="form().guestCount" (valueChange)="patch({ guestCount: $event })" />
                  <app-edit-field label="Duration (days)" type="number" density="page" [editing]="editingEvent()" [value]="form().durationDays" (valueChange)="patch({ durationDays: $event })" />
                </div>
              </app-edit-section>

              <app-edit-section
                title="Budget"
                [editable]="true"
                [(editing)]="editingBudget"
                [saving]="saving()"
                (edit)="snapshot('budget')"
                (cancelled)="restore('budget')"
                (save)="save('budget')"
              >
                <div class="bp-field-grid-3">
                  <app-edit-field label="Project budget" type="number" density="page" [editing]="editingBudget()" [value]="form().projectBudget" (valueChange)="patch({ projectBudget: $event })" />
                  <app-edit-field label="Currency" type="select" [options]="currencyOptions()" density="page" [editing]="editingBudget()" [value]="form().currency" (valueChange)="patch({ currency: $event })" />
                  <app-edit-field label="Tier" type="select" [options]="tierOptions" density="page" [editing]="editingBudget()" [value]="form().tier" (valueChange)="patch({ tier: $event })" />
                </div>
              </app-edit-section>
            </div>
          }
          @case ('estimate') {
            <p class="bp-body-small text-secondary">Estimate lands in the next slice of this arc (v1 estimate port).</p>
          }
          @default {
            <p class="bp-body-small text-secondary">
              The project marketplace + Quote rail land in the next slice of this arc.
            </p>
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

  /** Slice 1 default = details (the working tab); Marketplace becomes the
   *  default when slice 2 lands the project catalogue. */
  protected readonly tab = computed<Tab>(() => {
    const t = this.query().get('tab');
    return (TABS as string[]).includes(t ?? '') ? (t as Tab) : 'details';
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
  protected readonly editingBudget = signal(false);
  protected readonly saving = signal(false);
  private snapshots: { event?: DetailForm; budget?: DetailForm } = {};

  protected readonly tierOptions: EditFieldOption[] = [
    { label: 'Starter', value: 'starter' },
    { label: 'Professional', value: 'professional' },
    { label: 'Premium', value: 'premium' },
  ];

  private readonly statusRes = resource({
    loader: () => this.codelists.list('project_status'),
  });
  protected readonly statusOptions = computed<EditFieldOption[]>(
    () => this.statusRes.value()?.map((v) => ({ label: v.label, value: v.code })) ?? []
  );

  private readonly currencyRes = resource({
    loader: () => this.codelists.list('currency'),
  });
  protected readonly currencyOptions = computed<EditFieldOption[]>(
    () => this.currencyRes.value()?.map((v) => ({ label: v.label, value: v.code })) ?? []
  );

  protected setTab(t: string): void {
    this.router
      .navigate([], { relativeTo: this.route, queryParams: { tab: t }, queryParamsHandling: 'merge' })
      .catch((err) => console.warn('[ProjectDetail] nav failed', err));
  }

  protected patch(p: Partial<DetailForm>): void {
    this.form.update((f) => ({ ...f, ...p }));
  }

  protected snapshot(section: 'event' | 'budget'): void {
    this.snapshots[section] = { ...this.form() };
  }

  protected restore(section: 'event' | 'budget'): void {
    const snap = this.snapshots[section];
    if (snap) this.form.set({ ...snap });
  }

  /** Per-section save (audit 02-F-2 lesson) — only the edited section's
   *  fields travel; status dual-written server-side. */
  protected async save(section: 'event' | 'budget'): Promise<void> {
    const id = this.id();
    if (!id) return;
    this.saving.set(true);
    const f = this.form();
    const patch: ProjectUpdate =
      section === 'event'
        ? {
            name: f.name.trim() || undefined,
            status: asStatus(f.status),
            eventType: nullable(f.eventType),
            eventDate: nullable(f.eventDate),
            venueName: nullable(f.venueName),
            venueCity: nullable(f.venueCity),
            venueAddress: nullable(f.venueAddress),
            guestCount: numOrNull(f.guestCount),
            durationDays: numOrNull(f.durationDays),
          }
        : {
            projectBudget: numOrNull(f.projectBudget),
            currency: f.currency || 'GBP',
            tier: asTier(f.tier),
          };
    try {
      const fresh = await firstValueFrom(this.projects.update(id, patch));
      this.form.set(toForm(fresh));
      this.detail.set(fresh);
      if (section === 'event') this.editingEvent.set(false);
      else this.editingBudget.set(false);
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
function asStatus(v: string): ProjectUpdate['status'] {
  return (['draft', 'active', 'completed', 'archived'] as const).find((s) => s === v) ?? undefined;
}
function asTier(v: string): ProjectUpdate['tier'] {
  return (['starter', 'professional', 'premium'] as const).find((t) => t === v) ?? null;
}

function toForm(d: ProjectDetail | null): DetailForm {
  return {
    name: d?.name ?? '',
    status: d?.status ?? 'draft',
    eventType: d?.eventType ?? '',
    eventDate: d?.eventDate ?? '',
    venueName: d?.venueName ?? '',
    venueCity: d?.venueCity ?? '',
    venueAddress: d?.venueAddress ?? '',
    guestCount: d?.guestCount != null ? String(d.guestCount) : '',
    durationDays: d?.durationDays != null ? String(d.durationDays) : '',
    projectBudget: d?.projectBudget != null ? String(d.projectBudget) : '',
    currency: d?.currency ?? 'GBP',
    tier: d?.tier ?? '',
  };
}
