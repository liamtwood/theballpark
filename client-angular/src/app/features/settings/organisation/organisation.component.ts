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
        <h2 class="bp-page-title">Organisation</h2>

        <!-- ORGANISATION DETAILS -->
        <div class="bp-section">
          <div class="bp-section-header">
            <span class="bp-section-title">ORGANISATION DETAILS</span>
            <div class="bp-section-actions">
              <button *ngIf="!editingOrg" class="bp-icon-btn" (click)="startEdit('org')" title="Edit">
                <lucide-icon name="square-pen" [size]="14"></lucide-icon>
              </button>
              <ng-container *ngIf="editingOrg">
                <button class="bp-icon-btn bp-icon-save" (click)="save()" [disabled]="saving" title="Save">
                  <i class="pi pi-check"></i>
                </button>
                <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('org')" title="Cancel">
                  <i class="pi pi-times"></i>
                </button>
              </ng-container>
            </div>
          </div>

          <ng-container *ngIf="!editingOrg">
            <div class="bp-field-grid-2">
              <div>
                <label class="bp-field-label">Organisation name</label>
                <input pInputText [value]="form.name || '—'" class="w-full bp-field-readonly" readonly/>
              </div>
              <div>
                <label class="bp-field-label">City</label>
                <input pInputText [value]="form.city || '—'" class="w-full bp-field-readonly" readonly/>
              </div>
            </div>
            <div class="mt-4">
              <label class="bp-field-label">Address</label>
              <input pInputText [value]="form.address || '—'" class="w-full bp-field-readonly" readonly/>
            </div>
            <div class="bp-field-grid-2 mt-4">
              <div>
                <label class="bp-field-label">Email</label>
                <input pInputText [value]="form.email || '—'" class="w-full bp-field-readonly" readonly/>
              </div>
              <div>
                <label class="bp-field-label">Phone</label>
                <input pInputText [value]="form.phone || '—'" class="w-full bp-field-readonly" readonly/>
              </div>
            </div>
          </ng-container>

          <ng-container *ngIf="editingOrg">
            <div class="bp-field-grid-2">
              <div>
                <label class="bp-field-label">Organisation name</label>
                <input pInputText [(ngModel)]="form.name" class="w-full bp-input-edit"/>
              </div>
              <div>
                <label class="bp-field-label">City</label>
                <input pInputText [(ngModel)]="form.city" class="w-full bp-input-edit"/>
              </div>
            </div>
            <div class="mt-4">
              <label class="bp-field-label">Address</label>
              <input pInputText [(ngModel)]="form.address" class="w-full bp-input-edit"/>
            </div>
            <div class="bp-field-grid-2 mt-4">
              <div>
                <label class="bp-field-label">Email</label>
                <input pInputText [(ngModel)]="form.email" class="w-full bp-input-edit" type="email"/>
              </div>
              <div>
                <label class="bp-field-label">Phone</label>
                <input pInputText [(ngModel)]="form.phone" class="w-full bp-input-edit" type="tel"/>
              </div>
            </div>
          </ng-container>
        </div>

        <!-- FINANCIAL DEFAULTS -->
        <div class="bp-section">
          <div class="bp-section-header">
            <span class="bp-section-title">FINANCIAL DEFAULTS</span>
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
                <label class="bp-field-label">Default VAT</label>
                <input pInputText [value]="form.vat + '%'" class="w-full bp-field-readonly" readonly/>
              </div>
              <div>
                <label class="bp-field-label">Default margin</label>
                <input pInputText [value]="form.margin + '%'" class="w-full bp-field-readonly" readonly/>
              </div>
              <div>
                <label class="bp-field-label">Default contingency</label>
                <input pInputText [value]="form.contingency + '%'" class="w-full bp-field-readonly" readonly/>
              </div>
            </div>
          </ng-container>

          <ng-container *ngIf="editingFin">
            <div class="bp-field-grid-3">
              <div>
                <label class="bp-field-label">Default VAT %</label>
                <p-inputNumber [(ngModel)]="form.vat" suffix="%" styleClass="w-full bp-input-edit"></p-inputNumber>
              </div>
              <div>
                <label class="bp-field-label">Default margin %</label>
                <p-inputNumber [(ngModel)]="form.margin" suffix="%" styleClass="w-full bp-input-edit"></p-inputNumber>
              </div>
              <div>
                <label class="bp-field-label">Default contingency %</label>
                <p-inputNumber [(ngModel)]="form.contingency" suffix="%" styleClass="w-full bp-input-edit"></p-inputNumber>
              </div>
            </div>
          </ng-container>
        </div>

      </div>
    </ng-container>

    <p-toast></p-toast>
  `,
  // No component-specific styles — all shared CSS is in styles.css
  styles: []
})
export class OrganisationComponent implements OnInit {
  org: Org | null = null;
  loading = true;
  saving = false;

  form = {
    name: '', city: '', address: '', email: '', phone: '',
    vat: 20, margin: 20, contingency: 5
  };

  editingOrg = false;
  editingFin = false;
  private orgSnapshot: typeof this.form | null = null;
  private finSnapshot: typeof this.form | null = null;

  constructor(
    private orgSvc: OrgService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.orgSvc.getCurrentOrg().subscribe({
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
            contingency: +org.default_contingency_pct || 5
          };
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
    this.orgSvc.updateCurrentOrg({
      name: this.form.name,
      address: this.form.address,
      default_vat_pct: this.form.vat,
      default_margin_pct: this.form.margin,
      default_contingency_pct: this.form.contingency
    }).subscribe({
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
