import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';
import { OrgService } from '../../../core/services/org.service';
import { PersonaService } from '../../../core/services/persona.service';
import { Org } from '../../../models';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-organisation',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    LucideAngularModule,
    ButtonModule, InputTextModule, InputNumberModule, ToastModule,
    LoadingSpinnerComponent
  ],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading">
      <div class="bp-settings-body">
        <!-- v1.66s — page title moved to the shell hero ("Profile" +
             subtitle, set on the /settings route data). The hand-rolled
             <h2 page header was removed, so the app-page-header debt
             marker is resolved. -->

        <!-- ORGANISATION card (v1.66t — light-card standard) -->
        <div class="bp-card">
          <div class="bp-card-head">
            <h3 class="bp-card-title">Organisation</h3>
          </div>

          <!-- Zero-shift fields: one input per field. View = transparent
               (reads as plain text), edit = grey fill + border. Same
               metrics in both, so the value never moves or resizes. -->
          <div class="bp-field-grid-2">
            <div class="bp-field">
              <label class="bp-field-label">Organisation name</label>
              <input pInputText [(ngModel)]="form.name" [readonly]="!editingOrg"
                     class="w-full bp-fld" [class.is-edit]="editingOrg"/>
            </div>
            <div class="bp-field">
              <label class="bp-field-label">City</label>
              <input pInputText [(ngModel)]="form.city" [readonly]="!editingOrg"
                     class="w-full bp-fld" [class.is-edit]="editingOrg"/>
            </div>
            <div class="bp-field bp-field-s2">
              <label class="bp-field-label">Address</label>
              <input pInputText [(ngModel)]="form.address" [readonly]="!editingOrg"
                     class="w-full bp-fld" [class.is-edit]="editingOrg"/>
            </div>
            <div class="bp-field">
              <label class="bp-field-label">Email</label>
              <input pInputText [(ngModel)]="form.email" [readonly]="!editingOrg" type="email"
                     class="w-full bp-fld" [class.is-edit]="editingOrg"/>
            </div>
            <div class="bp-field">
              <label class="bp-field-label">Phone</label>
              <input pInputText [(ngModel)]="form.phone" [readonly]="!editingOrg" type="tel"
                     class="w-full bp-fld" [class.is-edit]="editingOrg"/>
            </div>
            <!-- v1.39: ref prefix drives the auto-generated project ref
                 ({prefix}-001 …); the counter is server-driven, read-only. -->
            <div class="bp-field">
              <label class="bp-field-label">Project reference prefix</label>
              <input pInputText [(ngModel)]="form.ref_prefix" [readonly]="!editingOrg"
                     maxlength="4"
                     (ngModelChange)="form.ref_prefix = ($event || '').toUpperCase()"
                     [placeholder]="editingOrg ? 'e.g. WA' : ''"
                     class="w-full bp-fld" [class.is-edit]="editingOrg"/>
            </div>
            <div class="bp-field">
              <label class="bp-field-label">Projects numbered so far</label>
              <input pInputText [value]="refCounter || 0" readonly class="w-full bp-fld"/>
            </div>
          </div>

          <div class="bp-card-foot">
            <button *ngIf="!editingOrg" class="bp-btn-outline" (click)="startEdit('org')">
              <lucide-icon name="square-pen" [size]="16"></lucide-icon> Edit organisation
            </button>
            <div *ngIf="editingOrg" class="bp-card-actions">
              <button class="bp-btn-outline" (click)="cancelEdit('org')">Cancel</button>
              <button class="bp-btn-grad" (click)="save()" [disabled]="saving">
                <i class="pi pi-check" style="font-size:12px"></i> Save changes
              </button>
            </div>
          </div>
        </div>

        <!-- FINANCIAL DEFAULTS card (v1.66t) -->
        <div class="bp-card">
          <div class="bp-card-head">
            <h3 class="bp-card-title">Financial defaults</h3>
          </div>

          <!-- Zero-shift fields (same single-input pattern as above). -->
          <div class="bp-field-grid-3">
            <div class="bp-field">
              <label class="bp-field-label">VAT</label>
              <p-inputNumber [(ngModel)]="form.vat" suffix="%" [readonly]="!editingFin"
                             [styleClass]="editingFin ? 'w-full bp-fld is-edit' : 'w-full bp-fld'"></p-inputNumber>
            </div>
            <div class="bp-field">
              <label class="bp-field-label">Margin</label>
              <p-inputNumber [(ngModel)]="form.margin" suffix="%" [readonly]="!editingFin"
                             [styleClass]="editingFin ? 'w-full bp-fld is-edit' : 'w-full bp-fld'"></p-inputNumber>
            </div>
            <div class="bp-field">
              <label class="bp-field-label">Contingency</label>
              <p-inputNumber [(ngModel)]="form.contingency" suffix="%" [readonly]="!editingFin"
                             [styleClass]="editingFin ? 'w-full bp-fld is-edit' : 'w-full bp-fld'"></p-inputNumber>
            </div>
          </div>

          <div class="bp-card-foot">
            <button *ngIf="!editingFin" class="bp-btn-outline" (click)="startEdit('fin')">
              <lucide-icon name="square-pen" [size]="16"></lucide-icon> Edit defaults
            </button>
            <div *ngIf="editingFin" class="bp-card-actions">
              <button class="bp-btn-outline" (click)="cancelEdit('fin')">Cancel</button>
              <button class="bp-btn-grad" (click)="save()" [disabled]="saving">
                <i class="pi pi-check" style="font-size:12px"></i> Save changes
              </button>
            </div>
          </div>
        </div>

      </div>
    </ng-container>

    <p-toast></p-toast>
  `,
  // v1.66t — all chrome now uses the shared light-card vocabulary
  // (.bp-card / .bp-field / .bp-field-value / .bp-input-soft / pill
  // buttons) defined in styles.css. No component-specific styles.
  styles: [``]
})
export class OrganisationComponent implements OnInit {
  org: Org | null = null;
  loading = true;
  saving = false;

  form = {
    name: '', city: '', address: '', email: '', phone: '',
    vat: 20, margin: 20, contingency: 5,
    // v1.39: project ref prefix (e.g. WA). Display-only counter
    // tracked alongside.
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
    // v1.65eb (p0015) — persona-aware org load. Reads the active
    // persona's orgId and hits /orgs/:id directly. Falls back to
    // /api/org (first agency) only when no persona orgId is set —
    // preserves the legacy single-org behaviour for any code path
    // not yet on the persona model.
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

  startEdit(section: 'org' | 'fin') {
    if (section === 'org') { this.orgSnapshot = { ...this.form }; this.editingOrg = true; }
    else { this.finSnapshot = { ...this.form }; this.editingFin = true; }
    this.cdr.detectChanges();
  }

  cancelEdit(section: 'org' | 'fin') {
    if (section === 'org' && this.orgSnapshot) { this.form = { ...this.orgSnapshot }; this.editingOrg = false; }
    else if (section === 'fin' && this.finSnapshot) { this.form = { ...this.finSnapshot }; this.editingFin = false; }
    this.cdr.detectChanges();
  }

  save() {
    this.saving = true;
    // v1.65eb (p0015) — write to the persona's actual org row when a
    // persona is active, otherwise hit the legacy /api/org PUT
    // (first-agency convenience endpoint).
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
