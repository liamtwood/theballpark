import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';
import { ActivatedRoute } from '@angular/router';
import { ProjectService } from '../../../../../../core/services/project.service';
import { Project } from '../../../../../../models';
import { LoadingSpinnerComponent } from '../../../../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-brief',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    LucideAngularModule,
    ButtonModule, InputTextModule, InputTextareaModule, InputNumberModule,
    DropdownModule, ToastModule,
    LoadingSpinnerComponent
  ],
  providers: [MessageService],
  template: `
    <app-loading *ngIf="loading"></app-loading>

    <ng-container *ngIf="!loading && project">
      <div class="bp-brief-body">

        <!-- EVENT DETAILS -->
        <div class="bp-section">
          <div class="bp-section-header">
            <span class="bp-section-title">EVENT DETAILS</span>
            <div class="bp-section-actions">
              <button *ngIf="!editingDetails" class="bp-icon-btn" (click)="startEdit('details')" title="Edit">
                <lucide-icon name="square-pen" [size]="14"></lucide-icon>
              </button>
              <ng-container *ngIf="editingDetails">
                <button class="bp-icon-btn bp-icon-save" (click)="save()" [disabled]="saving" title="Save">
                  <i class="pi pi-check"></i>
                </button>
                <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('details')" title="Cancel">
                  <i class="pi pi-times"></i>
                </button>
              </ng-container>
            </div>
          </div>

          <!-- VIEW MODE -->
          <ng-container *ngIf="!editingDetails">
            <div class="bp-field-grid-2">
              <div>
                <label class="bp-field-label">Event name</label>
                <input pInputText [value]="form.event_name || '—'" class="w-full bp-field-readonly" readonly/>
              </div>
              <div>
                <label class="bp-field-label">Client</label>
                <input pInputText [value]="form.client_name || '—'" class="w-full bp-field-readonly" readonly/>
              </div>
            </div>
            <div class="bp-field-grid-2 mt-4">
              <div>
                <label class="bp-field-label">Venue</label>
                <input pInputText [value]="form.venue_name || '—'" class="w-full bp-field-readonly" readonly/>
              </div>
              <div>
                <label class="bp-field-label">City</label>
                <input pInputText [value]="form.venue_city || '—'" class="w-full bp-field-readonly" readonly/>
              </div>
            </div>
            <div class="bp-field-grid-3 mt-4">
              <div>
                <label class="bp-field-label">Event date</label>
                <input pInputText [value]="form.event_date || '—'" class="w-full bp-field-readonly" readonly/>
              </div>
              <div>
                <label class="bp-field-label">Guest count</label>
                <input pInputText [value]="form.guest_count || '—'" class="w-full bp-field-readonly" readonly/>
              </div>
              <div>
                <label class="bp-field-label">Tier</label>
                <input pInputText [value]="(form.tier | titlecase) || '—'" class="w-full bp-field-readonly" readonly/>
              </div>
            </div>
            <div class="bp-field-grid-3 mt-4">
              <div>
                <label class="bp-field-label">Stand size</label>
                <input pInputText [value]="form.stand_size || '—'" class="w-full bp-field-readonly" readonly/>
              </div>
              <div>
                <label class="bp-field-label">Width (m)</label>
                <input pInputText [value]="form.stand_width_m || '—'" class="w-full bp-field-readonly" readonly/>
              </div>
              <div>
                <label class="bp-field-label">Depth (m)</label>
                <input pInputText [value]="form.stand_depth_m || '—'" class="w-full bp-field-readonly" readonly/>
              </div>
            </div>
          </ng-container>

          <!-- EDIT MODE -->
          <ng-container *ngIf="editingDetails">
            <div class="bp-field-grid-2">
              <div>
                <label class="bp-field-label">Event name</label>
                <input pInputText [(ngModel)]="form.event_name" class="w-full bp-input-edit" placeholder="e.g. TechVista at ExCeL"/>
              </div>
              <div>
                <label class="bp-field-label">Client</label>
                <input pInputText [(ngModel)]="form.client_name" class="w-full bp-input-edit" placeholder="Client company name"/>
              </div>
            </div>
            <div class="bp-field-grid-2 mt-4">
              <div>
                <label class="bp-field-label">Venue</label>
                <input pInputText [(ngModel)]="form.venue_name" class="w-full bp-input-edit" placeholder="Venue name"/>
              </div>
              <div>
                <label class="bp-field-label">City</label>
                <input pInputText [(ngModel)]="form.venue_city" class="w-full bp-input-edit" placeholder="City"/>
              </div>
            </div>
            <div class="bp-field-grid-3 mt-4">
              <div>
                <label class="bp-field-label">Event date</label>
                <input pInputText [(ngModel)]="form.event_date" class="w-full bp-input-edit" placeholder="e.g. June 2026"/>
              </div>
              <div>
                <label class="bp-field-label">Guest count</label>
                <input pInputText [(ngModel)]="form.guest_count" class="w-full bp-input-edit" placeholder="e.g. 200"/>
              </div>
              <div>
                <label class="bp-field-label">Tier</label>
                <p-dropdown [(ngModel)]="form.tier" [options]="tierOptions"
                  optionLabel="label" optionValue="value"
                  styleClass="w-full bp-input-edit" placeholder="Select tier">
                </p-dropdown>
              </div>
            </div>
            <div class="bp-field-grid-3 mt-4">
              <div>
                <label class="bp-field-label">Stand size</label>
                <p-dropdown [(ngModel)]="form.stand_size" [options]="standSizeOptions"
                  optionLabel="label" optionValue="value"
                  styleClass="w-full bp-input-edit" placeholder="Select size">
                </p-dropdown>
              </div>
              <div>
                <label class="bp-field-label">Width (m)</label>
                <p-inputNumber [(ngModel)]="form.stand_width_m" styleClass="w-full bp-input-edit"
                  [min]="1" [max]="100" suffix=" m">
                </p-inputNumber>
              </div>
              <div>
                <label class="bp-field-label">Depth (m)</label>
                <p-inputNumber [(ngModel)]="form.stand_depth_m" styleClass="w-full bp-input-edit"
                  [min]="1" [max]="100" suffix=" m">
                </p-inputNumber>
              </div>
            </div>
          </ng-container>
        </div>

        <!-- FINANCIAL -->
        <div class="bp-section">
          <div class="bp-section-header">
            <span class="bp-section-title">FINANCIALS</span>
            <div class="bp-section-actions">
              <button *ngIf="!editingFin" class="bp-icon-btn" (click)="startEdit('fin')" title="Edit">
                <lucide-icon name="square-pen" [size]="14"></lucide-icon>
              </button>
              <ng-container *ngIf="editingFin">
                <button class="bp-icon-btn bp-icon-save" (click)="save()" [disabled]="saving" title="Save">
                  <i class="pi pi-check"></i>
                </button>
                <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('fin')" title="Cancel">
                  <i class="pi pi-times"></i>
                </button>
              </ng-container>
            </div>
          </div>

          <ng-container *ngIf="!editingFin">
            <div class="bp-field-grid-3">
              <div>
                <label class="bp-field-label">Budget</label>
                <input pInputText [value]="form.project_budget ? ('£' + form.project_budget) : '—'" class="w-full bp-field-readonly" readonly/>
              </div>
              <div>
                <label class="bp-field-label">Margin</label>
                <input pInputText [value]="form.default_margin_pct ? (form.default_margin_pct + '%') : '—'" class="w-full bp-field-readonly" readonly/>
              </div>
              <div>
                <label class="bp-field-label">Contingency</label>
                <input pInputText [value]="form.default_contingency_pct ? (form.default_contingency_pct + '%') : '—'" class="w-full bp-field-readonly" readonly/>
              </div>
            </div>
          </ng-container>

          <ng-container *ngIf="editingFin">
            <div class="bp-field-grid-3">
              <div>
                <label class="bp-field-label">Budget (£)</label>
                <p-inputNumber [(ngModel)]="form.project_budget" styleClass="w-full bp-input-edit"
                  mode="currency" currency="GBP" locale="en-GB">
                </p-inputNumber>
              </div>
              <div>
                <label class="bp-field-label">Margin %</label>
                <p-inputNumber [(ngModel)]="form.default_margin_pct" styleClass="w-full bp-input-edit"
                  suffix="%" [min]="0" [max]="100">
                </p-inputNumber>
              </div>
              <div>
                <label class="bp-field-label">Contingency %</label>
                <p-inputNumber [(ngModel)]="form.default_contingency_pct" styleClass="w-full bp-input-edit"
                  suffix="%" [min]="0" [max]="100">
                </p-inputNumber>
              </div>
            </div>
          </ng-container>
        </div>

        <!-- BRIEF TEXT -->
        <div class="bp-section">
          <div class="bp-section-header">
            <span class="bp-section-title">BRIEF</span>
            <div class="bp-section-actions">
              <button *ngIf="!editingBrief" class="bp-icon-btn" (click)="startEdit('brief')" title="Edit">
                <lucide-icon name="square-pen" [size]="14"></lucide-icon>
              </button>
              <ng-container *ngIf="editingBrief">
                <button class="bp-icon-btn bp-icon-save" (click)="save()" [disabled]="saving" title="Save">
                  <i class="pi pi-check"></i>
                </button>
                <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('brief')" title="Cancel">
                  <i class="pi pi-times"></i>
                </button>
              </ng-container>
            </div>
          </div>

          <ng-container *ngIf="!editingBrief">
            <div *ngIf="form.raw_brief_text" class="bp-brief-text">{{ form.raw_brief_text }}</div>
            <p *ngIf="!form.raw_brief_text" class="bp-muted-text">No brief added yet. Click edit to add one, or use the AI parser on the Build tab.</p>
          </ng-container>

          <ng-container *ngIf="editingBrief">
            <textarea pInputTextarea [(ngModel)]="form.raw_brief_text"
              class="w-full bp-input-edit bp-brief-textarea"
              [rows]="10" style="resize:vertical;"
              placeholder="Paste the client brief here...">
            </textarea>
          </ng-container>
        </div>

      </div>
    </ng-container>

    <p-toast></p-toast>
  `,
  styles: [`
    .bp-brief-body     { max-width: 760px; margin: 0 auto; padding: var(--section-pad); }
    .bp-brief-text     { font-size: 13px; color: var(--color-text-primary); line-height: 1.8; white-space: pre-wrap; background: var(--color-surface); border: 0.5px solid var(--color-border); border-radius: 8px; padding: 16px 20px; }
    .bp-brief-textarea { line-height: 1.8 !important; }
    .bp-muted-text     { font-size: var(--text-sm); color: var(--color-text-muted); }
  `]
})
export class BriefComponent implements OnInit {
  project: Project | null = null;
  loading = true;
  saving = false;
  pid = '';

  form: Partial<Project> = {};

  editingDetails = false;
  editingFin     = false;
  editingBrief   = false;

  private detailsSnapshot: Partial<Project> = {};
  private finSnapshot:     Partial<Project> = {};
  private briefSnapshot:   Partial<Project> = {};

  tierOptions = [
    { label: 'Basic',   value: 'basic' },
    { label: 'Mid',     value: 'mid' },
    { label: 'Premium', value: 'premium' },
  ];

  standSizeOptions = [
    { label: 'S  (3×3m)',   value: 'S' },
    { label: 'M  (4×6m)',   value: 'M' },
    { label: 'L  (6×9m)',   value: 'L' },
    { label: 'XL (9×12m)', value: 'XL' },
  ];

  constructor(
    private route: ActivatedRoute,
    private projSvc: ProjectService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Get project ID from parent route
    this.pid = this.route.parent?.snapshot.paramMap.get('id') || '';
    this.projSvc.getById(this.pid).subscribe({
      next: p => {
        this.project = p;
        this.syncForm(p);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  private syncForm(p: Project) {
    this.form = {
      event_name:              p.event_name,
      client_name:             p.client_name,
      venue_name:              p.venue_name,
      venue_city:              p.venue_city,
      event_date:              p.event_date,
      guest_count:             p.guest_count,
      tier:                    p.tier,
      stand_size:              p.stand_size,
      stand_width_m:           p.stand_width_m,
      stand_depth_m:           p.stand_depth_m,
      project_budget:          p.project_budget,
      default_margin_pct:      p.default_margin_pct,
      default_contingency_pct: p.default_contingency_pct,
      raw_brief_text:          p.raw_brief_text,
    };
  }

  startEdit(section: 'details' | 'fin' | 'brief') {
    if (section === 'details') { this.detailsSnapshot = { ...this.form }; this.editingDetails = true; }
    if (section === 'fin')     { this.finSnapshot     = { ...this.form }; this.editingFin     = true; }
    if (section === 'brief')   { this.briefSnapshot   = { ...this.form }; this.editingBrief   = true; }
    this.cdr.detectChanges();
  }

  cancelEdit(section: 'details' | 'fin' | 'brief') {
    if (section === 'details') { Object.assign(this.form, this.detailsSnapshot); this.editingDetails = false; }
    if (section === 'fin')     { Object.assign(this.form, this.finSnapshot);     this.editingFin     = false; }
    if (section === 'brief')   { Object.assign(this.form, this.briefSnapshot);   this.editingBrief   = false; }
    this.cdr.detectChanges();
  }

  save() {
    this.saving = true;
    this.projSvc.update(this.pid, this.form).subscribe({
      next: p => {
        this.project = p;
        this.syncForm(p);
        this.saving       = false;
        this.editingDetails = false;
        this.editingFin     = false;
        this.editingBrief   = false;
        this.msg.add({ severity: 'success', summary: 'Project saved' });
        this.cdr.detectChanges();
      },
      error: () => {
        this.saving = false;
        this.msg.add({ severity: 'error', summary: 'Failed to save' });
      }
    });
  }
}
