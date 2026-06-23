import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { OrgService } from '../../../core/services/org.service';
import { PersonaService } from '../../../core/services/persona.service';
import { Org } from '../../../models';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { EditSectionComponent } from '../../../shared/components/edit-section/edit-section.component';
import { EditFieldComponent } from '../../../shared/components/edit-field/edit-field.component';

@Component({
  selector: 'app-organisation',
  standalone: true,
  imports: [
    CommonModule, ToastModule,
    LoadingSpinnerComponent,
    EditSectionComponent, EditFieldComponent,
  ],
  providers: [MessageService],
  // v1.66t — light-card standard. v1.66dk — now the REFERENCE consumer of the
  // shared <app-edit-section> + <app-edit-field> standard (no hand-rolled
  // card/field markup; the zero-shift + is-edit wiring lives in the components).
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading">
      <div class="bp-settings-body">

        <app-edit-section title="Organisation" [(editing)]="editingOrg" [saving]="saving"
                          (edit)="snapshot('org')" (cancel)="restore('org')" (save)="save()">
          <div class="bp-field-grid-2">
            <app-edit-field label="Organisation name" [(value)]="form.name" [editing]="editingOrg"></app-edit-field>
            <app-edit-field label="City" [(value)]="form.city" [editing]="editingOrg"></app-edit-field>
            <app-edit-field label="Address" span2 [(value)]="form.address" [editing]="editingOrg"></app-edit-field>
            <app-edit-field label="Email" type="email" [(value)]="form.email" [editing]="editingOrg"></app-edit-field>
            <app-edit-field label="Phone" type="tel" [(value)]="form.phone" [editing]="editingOrg"></app-edit-field>
            <!-- v1.39: ref prefix drives the auto-generated project ref ({prefix}-001 …). -->
            <app-edit-field label="Project reference prefix" [(value)]="form.ref_prefix" [editing]="editingOrg"
                            [maxlength]="4" uppercase placeholder="e.g. WA"></app-edit-field>
            <!-- Server-driven counter — always read-only. -->
            <app-edit-field label="Projects numbered so far" [value]="refCounter || 0" readonlyAlways></app-edit-field>
          </div>
        </app-edit-section>

        <app-edit-section title="Financial defaults" [(editing)]="editingFin" [saving]="saving"
                          (edit)="snapshot('fin')" (cancel)="restore('fin')" (save)="save()">
          <div class="bp-field-grid-3">
            <app-edit-field label="VAT" type="number" suffix="%" [(value)]="form.vat" [editing]="editingFin"></app-edit-field>
            <app-edit-field label="Margin" type="number" suffix="%" [(value)]="form.margin" [editing]="editingFin"></app-edit-field>
            <app-edit-field label="Contingency" type="number" suffix="%" [(value)]="form.contingency" [editing]="editingFin"></app-edit-field>
          </div>
        </app-edit-section>

      </div>
    </ng-container>

    <p-toast></p-toast>
  `,
  styles: [``]
})
export class OrganisationComponent implements OnInit {
  org: Org | null = null;
  loading = true;
  saving = false;

  form = {
    name: '', city: '', address: '', email: '', phone: '',
    vat: 20, margin: 20, contingency: 5,
    // v1.39: project ref prefix (e.g. WA). Display-only counter tracked alongside.
    ref_prefix: ''
  };
  refCounter = 0;

  editingOrg = false;
  editingFin = false;
  private orgSnapshot: typeof this.form | null = null;
  private finSnapshot: typeof this.form | null = null;

  constructor(
    private orgSvc: OrgService,
    private personaSvc: PersonaService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // v1.65eb (p0015) — persona-aware org load. Reads the active persona's
    // orgId and hits /orgs/:id directly. Falls back to /api/org (first agency)
    // only when no persona orgId is set.
    const personaOrgId = this.personaSvc.active?.orgId;
    const req$ = personaOrgId
      ? this.orgSvc.getById(personaOrgId)
      : this.orgSvc.getCurrentOrg();
    req$.subscribe({
      next: (org) => {
        this.org = org || null;
        if (org) {
          this.form = {
            name: org.name,
            city: (org as any).city || '',
            address: org.address || '',
            email: (org as any).email || '',
            phone: (org as any).phone || '',
            vat: +org.default_vat_pct || 20,
            margin: +org.default_margin_pct || 20,
            contingency: +org.default_contingency_pct || 5,
            ref_prefix: (org.ref_prefix || '').toUpperCase()
          };
          this.refCounter = org.ref_counter || 0;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  /** (edit) — stash the section's fields so Cancel can restore them. */
  snapshot(section: 'org' | 'fin') {
    if (section === 'org') this.orgSnapshot = { ...this.form };
    else this.finSnapshot = { ...this.form };
  }

  /** (cancel) — the section already flipped editing off; revert the data. */
  restore(section: 'org' | 'fin') {
    if (section === 'org' && this.orgSnapshot) this.form = { ...this.orgSnapshot };
    else if (section === 'fin' && this.finSnapshot) this.form = { ...this.finSnapshot };
    this.cdr.detectChanges();
  }

  save() {
    this.saving = true;
    // v1.65eb (p0015) — write to the persona's actual org row when a persona is
    // active, otherwise hit the legacy /api/org PUT (first-agency convenience).
    const personaOrgId = this.personaSvc.active?.orgId;
    const payload: any = {
      name: this.form.name,
      address: this.form.address,
      default_vat_pct: this.form.vat,
      default_margin_pct: this.form.margin,
      default_contingency_pct: this.form.contingency,
      ref_prefix: (this.form.ref_prefix || '').trim().toUpperCase() || null
    };
    const save$ = personaOrgId
      ? this.orgSvc.update(personaOrgId, payload)
      : this.orgSvc.updateCurrentOrg(payload);
    save$.subscribe({
      next: () => {
        this.saving = false;
        this.editingOrg = false;
        this.editingFin = false;
        this.msg.add({ severity: 'success', summary: 'Saved' });
        this.cdr.detectChanges();
      },
      error: () => {
        this.saving = false;
        this.msg.add({ severity: 'error', summary: 'Error saving changes' });
      }
    });
  }
}
