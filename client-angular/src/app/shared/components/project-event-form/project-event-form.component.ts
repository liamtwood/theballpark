import {
  Component, Input, Output, EventEmitter,
  OnChanges, SimpleChanges,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { ProjectService } from '../../../core/services/project.service';
import { CodelistService } from '../../../core/services/codelist.service';
import { ClientService } from '../../../core/services/client.service';
import { ApiService } from '../../../core/services/api.service';
import { Project, Codelist, Client } from '../../../models';
import { EditSectionComponent } from '../edit-section/edit-section.component';
import { EditFieldComponent, EditFieldDensity } from '../edit-field/edit-field.component';

/**
 * <app-project-event-form> — v1.67.
 *
 * THE single source of truth for editing a project's event facts
 * (Event details / Event type / Logistics). Extracted from
 * event-drawer.component.ts in v1.67 so the drawer and the new
 * /projects/:id/details PAGE both consume one form — no duplicated
 * save logic (snapshot/restore/save, sectionFields whitelist, status
 * code→id resolution, client find-or-create, codelist hydration).
 *
 * ONE FORM, TWO DENSITIES. The consuming surface picks the container
 * (drawer OR page) and passes the matching `density` straight through
 * to <app-edit-section> + <app-edit-field>. Drawer → density="drawer",
 * page → density="card". Same sections, same fields, same save path.
 *
 * The form owns the data lifecycle end-to-end:
 *   - loads the project itself from `projectId` (re-loads on change),
 *   - emits (projectLoaded) so a host can populate its own chrome
 *     (the drawer's PROJECT ref chip + "last edited" footer) without a
 *     second fetch,
 *   - emits (saved) with the freshly re-read project after a section
 *     persists (the drawer relays this to EstimateDrawerService.markSaved
 *     + ProjectService.triggerRefresh).
 *
 * Status keeps its bespoke colour-pill (view) / p-dropdown (edit) —
 * colour carries meaning. Event type + Tier stay bespoke dropdowns
 * (view = label, edit = p-dropdown) pending a zero-shift EF-select.
 *
 * The legacy FINANCIALS + PROJECT BRIEF sections were dropped in the
 * v1.67 extraction: they were gated off (`showLegacySections=false`)
 * in the drawer and unreachable on every surface. Re-introducing them
 * is a deliberate addition, not a silent carry-over of dead code.
 */
type SectionKey = 'details' | 'type' | 'logistics';

@Component({
  selector: 'app-project-event-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, TitleCasePipe,
    InputTextModule, DropdownModule, ToastModule,
    EditSectionComponent, EditFieldComponent,
  ],
  providers: [MessageService],
  template: `
    <div class="bp-pef" *ngIf="project">

      <!-- ═══ EVENT DETAILS ═══ -->
      <app-edit-section title="Event details" [density]="density"
                        [(editing)]="editing.details" [saving]="saving"
                        (edit)="snapshotSection('details')" (cancel)="restoreSection('details')"
                        (save)="saveSection('details')">
        <div class="bp-field-grid-2">
          <app-edit-field label="PO Ref" [density]="density" [editing]="editing.details"
                          [(value)]="form.po_ref" placeholder="e.g. TVS-2026-047"></app-edit-field>

          <!-- Status — bespoke colour pill (view) / dropdown (edit). -->
          <div class="bp-field" [class.bp-field--drawer]="density === 'drawer'">
            <label class="bp-field-label">Status</label>
            <div *ngIf="!editing.details" class="bp-pef-status-view" [class.bp-pef-status-view--drawer]="density === 'drawer'">
              <span class="bp-pef-status-pill" [style.background-color]="statusColor()">{{ statusLabel() }}</span>
            </div>
            <p-dropdown *ngIf="editing.details"
                        [(ngModel)]="form.status_code"
                        [options]="statusOptions" optionLabel="label" optionValue="code"
                        [styleClass]="dropdownClass" placeholder="Draft"></p-dropdown>
          </div>

          <app-edit-field label="Event name" [density]="density" [editing]="editing.details" [(value)]="form.event_name"></app-edit-field>
          <app-edit-field label="Client" [density]="density" [editing]="editing.details" [(value)]="form.client_name"></app-edit-field>
          <app-edit-field label="Venue" [density]="density" [editing]="editing.details" [(value)]="form.venue_name"></app-edit-field>
          <app-edit-field label="City" [density]="density" [editing]="editing.details" [(value)]="form.venue_city"></app-edit-field>
        </div>
      </app-edit-section>

      <!-- ═══ EVENT TYPE ═══ -->
      <app-edit-section title="Event type" [density]="density"
                        [(editing)]="editing.type" [saving]="saving"
                        (edit)="snapshotSection('type')" (cancel)="restoreSection('type')"
                        (save)="saveSection('type')">
        <div class="bp-field-grid-2">
          <div class="bp-field" [class.bp-field--drawer]="density === 'drawer'">
            <label class="bp-field-label">Event type</label>
            <input pInputText *ngIf="!editing.type"
                   [value]="(form.event_type | titlecase) || '—'"
                   class="w-full bp-field-readonly" readonly/>
            <p-dropdown *ngIf="editing.type"
                        [(ngModel)]="form.event_type"
                        [options]="eventTypeOptions" optionLabel="label" optionValue="value"
                        [styleClass]="dropdownClass" placeholder="Select event type"></p-dropdown>
          </div>
          <div class="bp-field" [class.bp-field--drawer]="density === 'drawer'">
            <label class="bp-field-label">Tier</label>
            <input pInputText *ngIf="!editing.type"
                   [value]="tierDisplay()"
                   class="w-full bp-field-readonly" readonly/>
            <p-dropdown *ngIf="editing.type"
                        [(ngModel)]="form.tier"
                        [options]="tierOptions" optionLabel="label" optionValue="code"
                        [styleClass]="dropdownClass" placeholder="Select tier"></p-dropdown>
          </div>
        </div>
      </app-edit-section>

      <!-- ═══ LOGISTICS ═══ -->
      <!-- Event date is FREE TEXT (often approximate — "Late September"/"TBC"). -->
      <app-edit-section title="Logistics" [density]="density"
                        [(editing)]="editing.logistics" [saving]="saving"
                        (edit)="snapshotSection('logistics')" (cancel)="restoreSection('logistics')"
                        (save)="saveSection('logistics')">
        <div class="bp-field-grid-3">
          <app-edit-field label="Event date" [density]="density" [editing]="editing.logistics"
                          [(value)]="form.event_date" placeholder="e.g. 2 Jun 2026 / TBC"></app-edit-field>
          <app-edit-field label="Duration (days)" type="number" [density]="density"
                          [editing]="editing.logistics" [(value)]="form.duration_days"></app-edit-field>
          <app-edit-field label="Guest count" type="number" [density]="density"
                          [editing]="editing.logistics" [(value)]="form.guest_count"></app-edit-field>
        </div>
      </app-edit-section>

    </div>

    <p-toast></p-toast>
  `,
  styles: [`
    :host { font-family: var(--font-body); display: block; }

    /* Status pill — colour from the project_status codelist meta.color.
       View container height tracks the field metric (card 38 / drawer 34)
       so the pill sits where the value text would, no view→edit shift. */
    .bp-pef-status-view { display: flex; align-items: center; height: 38px; }
    .bp-pef-status-view--drawer { height: 34px; }
    .bp-pef-status-pill {
      display: inline-flex; align-items: center;
      padding: 4px 12px;
      border-radius: 14px;
      font-size: 11px; font-weight: 600;
      color: #fff;
      text-transform: none;
      letter-spacing: 0.02em;
    }

    /* Bespoke dropdowns fill their field column (the global .p-dropdown
       calm style supplies the rest). is-edit rides on styleClass per the
       PrimeNG-wrapper rule — see dropdownClass. */
    :host ::ng-deep .bp-pef-dropdown.p-dropdown { width: 100% !important; }
  `]
})
export class ProjectEventFormComponent implements OnChanges {
  /** Project to edit. The form loads it itself and re-loads on change. */
  @Input() projectId?: string;
  /** Metric scale passed straight through to edit-section/edit-field. */
  @Input() density: EditFieldDensity = 'card';
  /** Optionally open a section straight into edit mode once loaded
      (the drawer's kebab "Edit event" / req.section deep-link). */
  @Input() initialEditSection?: SectionKey;

  /** Fired after the project loads — host populates its own chrome. */
  @Output() projectLoaded = new EventEmitter<Project>();
  /** Fired after a section persists, with the re-read project. */
  @Output() saved = new EventEmitter<Project>();

  project: Project | null = null;
  saving = false;
  form: Partial<Project> = {};

  /** Per-section edit flags — only the touched section's fields persist. */
  editing = { details: false, type: false, logistics: false };
  private snapshots: Record<SectionKey, Partial<Project>> = {
    details: {}, type: {}, logistics: {}
  };

  /** Lifted verbatim from event.component.ts — same labels, same DB values. */
  eventTypeOptions = [
    { label: 'Gala',         value: 'gala' },
    { label: 'Conference',   value: 'conference' },
    { label: 'Activation',   value: 'activation' },
    { label: 'Exhibition',   value: 'exhibition' },
    { label: 'Summer Party', value: 'summer_party' },
    { label: 'Awards',       value: 'awards' },
    { label: 'Corporate',    value: 'corporate' },
    { label: 'Private',      value: 'private' },
  ];
  /** Codelist-driven tier (budget_tier rows in shared.codelists). */
  tierOptions: Codelist[] = [];
  /** project_status codelist drives the Status dropdown + pill colour. */
  statusOptions: Codelist[] = [];
  /** code → id map from /api/statuses, used to resolve status_code →
      projects.status_id client-side on save. */
  private statusIdByCode = new Map<string, string>();
  /** Client list cached for find-or-create on save. */
  private clients: Client[] = [];

  /** Which DB columns each section may persist — save sends only these. */
  private sectionFields: Record<SectionKey, (keyof Project)[]> = {
    details:   ['po_ref', 'event_name', 'client_name', 'venue_name', 'venue_city', 'status_code' as any],
    type:      ['event_type', 'tier'],
    logistics: ['event_date', 'duration_days', 'guest_count'],
  };

  constructor(
    private projSvc: ProjectService,
    private codelistSvc: CodelistService,
    private clientSvc: ClientService,
    private apiSvc: ApiService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {
    this.codelistSvc.getByName('budget_tier').subscribe(rows => {
      this.tierOptions = rows || [];
      this.cdr.markForCheck();
    });
    this.codelistSvc.getByName('project_status').subscribe(rows => {
      this.statusOptions = rows || [];
      this.cdr.markForCheck();
    });
    this.apiSvc.get<any[]>('/statuses').subscribe(rows => {
      for (const r of rows || []) {
        if (r.entity_type === 'project') this.statusIdByCode.set(r.name, r.id);
      }
    });
    this.clientSvc.getAll().subscribe(rows => { this.clients = rows || []; });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['projectId']) this.load();
  }

  private load(): void {
    // Reset edit state whenever a new project is mounted.
    this.editing = { details: false, type: false, logistics: false };
    if (!this.projectId) { this.project = null; this.form = {}; this.cdr.markForCheck(); return; }
    this.projSvc.getById(this.projectId).subscribe({
      next: p => {
        this.project = p;
        this.syncForm(p);
        this.projectLoaded.emit(p);
        // Deep-link straight into a section's edit mode if asked.
        if (this.initialEditSection) {
          const section = this.initialEditSection;
          // Wait a frame so the section's pencil is in the DOM.
          setTimeout(() => { this.startEdit(section); this.cdr.markForCheck(); }, 0);
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.project = null;
        this.msg.add({ severity: 'error', summary: 'Could not load project', detail: 'Try refreshing the page.', life: 3000 });
        this.cdr.markForCheck();
      }
    });
  }

  // ── Form sync ───────────────────────────────────────────────────────
  private syncForm(p: Project) {
    this.form = {
      // Sanitise the legacy literal "null" string at the source.
      po_ref:        (p.po_ref != null && String(p.po_ref).trim().toLowerCase() !== 'null') ? p.po_ref : '',
      event_name:    p.event_name,
      client_name:   p.client_name,
      venue_name:    p.venue_name,
      venue_city:    p.venue_city,
      event_date:    p.event_date,
      event_type:    p.event_type,
      tier:          p.tier,
      duration_days: p.duration_days,
      guest_count:   p.guest_count,
      // Synthetic status_code mirrors status_name so the dropdown
      // two-way-binds; on save it resolves to projects.status_id.
      status_code:   (p as any).status_name || 'draft',
    } as any;
  }

  /** styleClass for the bespoke p-dropdowns: fill the column + carry the
      edit fill. These only render in edit mode, so is-edit is constant
      while visible — routed via styleClass per the PrimeNG-wrapper rule. */
  get dropdownClass(): string {
    return 'w-full bp-pef-dropdown is-edit'
      + (this.density === 'drawer' ? ' bp-fld--drawer' : '');
  }

  // ── Status pill display ─────────────────────────────────────────────
  statusLabel(): string {
    const code = (this.form as any).status_code || 'draft';
    return this.codelistSvc.getLabel('project_status', code) || 'Draft';
  }
  statusColor(): string {
    const code = (this.form as any).status_code || 'draft';
    const meta = this.codelistSvc.getMeta('project_status', code);
    return meta?.['color'] || '#F59E0B';
  }
  /** Tier label for view mode (resolved against the budget_tier
      codelist; falls back to the raw code for legacy values). */
  tierDisplay(): string {
    const code = this.form.tier;
    if (!code) return '—';
    const row = this.tierOptions.find(t => t.code === code);
    return row?.label || code;
  }

  // ── Per-section edit controls ───────────────────────────────────────
  // <app-edit-section> owns the `editing` flag via [(editing)]; these own
  // the DATA. (edit)→snapshotSection, (cancel)→restoreSection, (save)→saveSection.
  snapshotSection(section: SectionKey) {
    this.snapshots[section] = { ...this.form };
  }
  restoreSection(section: SectionKey) {
    Object.assign(this.form, this.snapshots[section]);
    this.cdr.markForCheck();
  }
  startEdit(section: SectionKey) {
    this.snapshotSection(section);
    this.editing[section] = true;
    this.cdr.markForCheck();
  }

  saveSection(section: SectionKey) {
    if (!this.project) return;
    // Only send the columns this section owns — never the whole form.
    const patch: any = {};
    for (const k of this.sectionFields[section]) {
      patch[k] = (this.form as any)[k];
    }

    const finish = (resolved: any) => {
      this.saving = true;
      this.projSvc.update(this.project!.id, resolved).subscribe({
        next: () => {
          // Re-read via getById so the form picks up joined columns
          // (client_name, status_name, status_color) the raw UPDATE
          // RETURNING * doesn't include.
          this.projSvc.getById(this.project!.id).subscribe({
            next: p => {
              this.project = p;
              this.syncForm(p);
              this.saving = false;
              this.editing[section] = false;
              this.msg.add({ severity: 'success', summary: 'Saved ✓', life: 1500 });
              this.projSvc.triggerRefresh();
              this.saved.emit(p);
              this.cdr.markForCheck();
            },
            error: () => {
              // Save succeeded; the re-fetch failed. Close the editor.
              this.saving = false;
              this.editing[section] = false;
              this.projSvc.triggerRefresh();
              this.cdr.markForCheck();
            }
          });
        },
        error: () => {
          this.saving = false;
          this.msg.add({ severity: 'error', summary: 'Failed to save', life: 3000 });
          this.cdr.markForCheck();
        }
      });
    };

    if (section === 'details') {
      this.resolveDetailsPatch(patch).then(finish).catch(() => {
        this.saving = false;
        this.msg.add({ severity: 'error', summary: 'Failed to save', life: 3000 });
        this.cdr.markForCheck();
      });
    } else {
      finish(patch);
    }
  }

  /** Pre-flight the Event Details patch so the backend gets real FK
      columns (status_id / client_id) instead of synthetic form fields.
      Status code → id is a Map lookup. Client name → id is a
      find-or-create against the cached client list. */
  private async resolveDetailsPatch(patch: any): Promise<any> {
    if (patch.status_code) {
      const id = this.statusIdByCode.get(patch.status_code);
      if (id) patch.status_id = id;
    }
    delete patch.status_code;

    const name = (patch.client_name || '').trim();
    if (name) {
      const match = this.clients.find(c =>
        (c.name || '').toLowerCase() === name.toLowerCase()
      );
      if (match) {
        patch.client_id = match.id;
      } else {
        const created = await new Promise<Client | null>((resolve) =>
          this.clientSvc.create({ name }).subscribe({
            next: c => resolve(c),
            error: () => resolve(null)
          })
        );
        if (created) {
          patch.client_id = created.id;
          this.clients.push(created);
        }
      }
    } else if (patch.client_name === '') {
      patch.client_id = null;
    }
    delete patch.client_name;

    return patch;
  }
}
