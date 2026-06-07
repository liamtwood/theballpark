import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy, ChangeDetectorRef,
  OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputSwitchModule } from 'primeng/inputswitch';
import { SidebarModule } from 'primeng/sidebar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { Org } from '../../../models';
import { OrgService } from '../../../core/services/org.service';
import { ImageUploadPanelComponent } from '../image-upload-panel/image-upload-panel.component';
import { EditSectionComponent } from '../edit-section/edit-section.component';
import { EditFieldComponent } from '../edit-field/edit-field.component';

interface SupplierForm {
  name: string;
  description: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  vat_registered: boolean;
  vat_number: string;
  cover_image_url: string | null;
  logo_url: string | null;
  image_display: 'cover' | 'contain';
}

@Component({
  selector: 'app-supplier-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    SidebarModule, ButtonModule, InputSwitchModule,
    ToastModule, ImageUploadPanelComponent,
    EditSectionComponent, EditFieldComponent
  ],
  providers: [MessageService],
  template: `
    <p-sidebar [(visible)]="visible"
               (visibleChange)="onVisibleChange($event)"
               position="right"
               styleClass="bp-drawer"
               [style]="{width:'480px'}"
               [showCloseIcon]="false"
               (onHide)="onCancel()">

      <ng-template pTemplate="header">
        <div class="bp-drawer-header-row">
          <div class="bp-drawer-header">
            <span class="bp-drawer-label">SUPPLIER</span>
            <div class="bp-drawer-title">Edit details</div>
          </div>
          <button class="bp-icon-btn" (click)="onCancel()" title="Close">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </ng-template>

      <div class="bp-drawer-body">

        <!-- v1.66dq — Tier 2: always-edit drawer adopts the shared
             <app-edit-section editable=false> + <app-edit-field editing> at
             drawer density. No per-section lifecycle (one Save in the footer);
             every field reads as editable (grey fill). -->

        <!-- ═══ DETAILS ═══ -->
        <app-edit-section title="Details" density="drawer" [editable]="false">
          <div class="bp-field-grid-2">
            <app-edit-field span2 label="Name *" density="drawer" [editing]="true"
                            [(value)]="form.name" placeholder="Supplier name"></app-edit-field>
            <app-edit-field span2 label="Description" type="textarea" [rows]="10"
                            density="drawer" [editing]="true" [(value)]="form.description"
                            placeholder="What this supplier does, who they work with, capabilities, geographic coverage, notable clients or projects..."
                            hint="A few paragraphs work well. Plain text for now — markdown rendering on the Home tab lands next."></app-edit-field>
          </div>
        </app-edit-section>

        <!-- ═══ ADDRESS ═══ -->
        <app-edit-section title="Address" density="drawer" [editable]="false">
          <div class="bp-field-grid-2">
            <app-edit-field span2 label="Address" density="drawer" [editing]="true"
                            [(value)]="form.address" placeholder="Street address"></app-edit-field>
            <app-edit-field label="City" density="drawer" [editing]="true" [(value)]="form.city" placeholder="London"></app-edit-field>
            <app-edit-field label="Country" density="drawer" [editing]="true" [(value)]="form.country" placeholder="United Kingdom"></app-edit-field>
          </div>
        </app-edit-section>

        <!-- ═══ CONTACT ═══ -->
        <app-edit-section title="Contact" density="drawer" [editable]="false">
          <div class="bp-field-grid-2">
            <app-edit-field span2 label="Phone" type="tel" density="drawer" [editing]="true" [(value)]="form.phone" placeholder="+44 ..."></app-edit-field>
            <app-edit-field span2 label="Email" type="email" density="drawer" [editing]="true" [(value)]="form.email" placeholder="hello@example.com"></app-edit-field>
            <app-edit-field span2 label="Website" density="drawer" [editing]="true" [(value)]="form.website" placeholder="https://..."></app-edit-field>
          </div>
        </app-edit-section>

        <!-- ═══ VAT ═══ -->
        <app-edit-section title="VAT" density="drawer" [editable]="false">
          <label class="bp-vat-toggle">
            <p-inputSwitch [(ngModel)]="form.vat_registered"></p-inputSwitch>
            <span>VAT registered</span>
          </label>
          <div class="bp-field-grid-2" *ngIf="form.vat_registered" style="margin-top:12px;">
            <app-edit-field span2 label="VAT number" density="drawer" [editing]="true" [(value)]="form.vat_number" placeholder="GB 123 4567 89"></app-edit-field>
          </div>
        </app-edit-section>

        <!-- ═══ IMAGES ═══ -->
        <app-edit-section title="Images" density="drawer" [editable]="false">
          <label class="bp-field-label">Cover &amp; logo</label>
          <div class="bp-image-preview-row">
            <div class="bp-image-slot">
              <div class="bp-image-slot-label">Cover</div>
              <div class="bp-image-thumb bp-image-thumb--cover"
                   [style.background-image]="form.cover_image_url ? 'url(' + form.cover_image_url + ')' : null"
                   [class.bp-image-thumb--empty]="!form.cover_image_url">
                <span *ngIf="!form.cover_image_url" class="bp-image-empty-text">No cover</span>
              </div>
            </div>
            <div class="bp-image-slot">
              <div class="bp-image-slot-label">Logo</div>
              <div class="bp-image-thumb bp-image-thumb--logo"
                   [style.background-image]="form.logo_url ? 'url(' + form.logo_url + ')' : null"
                   [class.bp-image-thumb--empty]="!form.logo_url">
                <span *ngIf="!form.logo_url" class="bp-image-empty-text">No logo</span>
              </div>
            </div>
          </div>
          <p-button label="Edit images" icon="pi pi-image"
                    styleClass="p-button-outlined w-full"
                    [disabled]="!supplier?.id"
                    (onClick)="showImagePanel = true">
          </p-button>
          <div class="bp-field-hint" *ngIf="!supplier?.id">
            Save the supplier first, then you can attach images.
          </div>
        </app-edit-section>

      </div>

      <ng-template pTemplate="footer">
        <div class="bp-drawer-footer-row">
          <p-button label="Cancel"
                    styleClass="bp-btn-cancel"
                    (onClick)="onCancel()">
          </p-button>
          <p-button label="Save"
                    styleClass="bp-btn-save"
                    [disabled]="!isValid() || saving"
                    [loading]="saving"
                    (onClick)="onSave()">
          </p-button>
        </div>
      </ng-template>
    </p-sidebar>

    <!-- Image upload panel — opens on demand inside the drawer.
         Uses the existing supplier-typed panel which PATCHes
         /api/suppliers/:id/images and emits the saved URLs back. -->
    <app-image-upload-panel
      *ngIf="showImagePanel && supplier?.id"
      [entityId]="supplier!.id"
      type="supplier"
      [existingCoverUrl]="form.cover_image_url || ''"
      [existingLogoUrl]="form.logo_url || ''"
      [existingImageDisplay]="form.image_display"
      [searchTerm]="form.name || ''"
      (imagesUpdated)="onImagesUpdated($event)"
      (closed)="showImagePanel = false">
    </app-image-upload-panel>

    <p-toast></p-toast>
  `,
  styles: [`
    :host { display: contents; }

    /* Section chrome + fields now come from <app-edit-section> / <app-edit-field>
       (drawer density). Only the bespoke bits (images label/hint, VAT toggle,
       image previews) keep local styles. */
    .bp-field-label {
      display: block;
      font-size: 11px;
      font-weight: 500;
      color: var(--color-text-secondary);
      margin-bottom: 4px;
      font-family: var(--font-body);
    }
    .bp-field-hint {
      font-size: 11px;
      color: var(--color-text-muted);
      margin-top: 4px;
      line-height: 1.4;
    }

    /* VAT toggle row */
    .bp-vat-toggle {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      color: var(--color-text-primary);
      cursor: pointer;
    }

    /* Image previews */
    .bp-image-preview-row {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 10px;
      margin-bottom: 10px;
    }
    .bp-image-slot { display: flex; flex-direction: column; gap: 4px; }
    .bp-image-slot-label { font-size: 11px; color: var(--color-text-muted); }
    .bp-image-thumb {
      height: 80px;
      border-radius: 8px;
      background-size: cover;
      background-position: center;
      border: 0.5px solid var(--color-border);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bp-image-thumb--logo {
      background-size: contain;
      background-repeat: no-repeat;
      background-color: var(--color-fill);
    }
    .bp-image-thumb--empty { background: var(--color-fill); }
    .bp-image-empty-text { font-size: 11px; color: var(--color-text-muted); }

    .bp-drawer-footer-row {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `]
})
export class SupplierDrawerComponent implements OnChanges {
  @Input() supplier: Org | null = null;
  @Input() visible = false;

  @Output() saved = new EventEmitter<Org>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() visibleChange = new EventEmitter<boolean>();

  form: SupplierForm = this.emptyForm();
  saving = false;
  showImagePanel = false;

  constructor(
    private orgSvc: OrgService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    // Repopulate whenever the parent swaps the supplier prop OR the drawer
    // becomes visible — the parent typically sets supplier + visible
    // together but we don't want to depend on order.
    if (changes['supplier'] || (changes['visible'] && this.visible)) {
      this.populateForm();
    }
  }

  private emptyForm(): SupplierForm {
    return {
      name: '', description: '',
      address: '', city: '', country: '',
      phone: '', email: '', website: '',
      vat_registered: false, vat_number: '',
      cover_image_url: null, logo_url: null,
      image_display: 'cover'
    };
  }

  private populateForm(): void {
    const s = this.supplier;
    if (!s) { this.form = this.emptyForm(); return; }
    this.form = {
      name: s.name || '',
      description: s.description || '',
      address: s.address || '',
      city: s.city || '',
      country: s.country || '',
      phone: s.phone || '',
      email: s.email || '',
      website: s.website || '',
      vat_registered: !!s.vat_registered,
      vat_number: s.vat_number || '',
      cover_image_url: s.cover_image_url || null,
      logo_url: s.logo_url || null,
      image_display: 'cover'
    };
  }

  isValid(): boolean {
    return !!(this.form.name && this.form.name.trim().length > 0);
  }

  /** Image panel emitted new URLs — reflect them in the local form. The
      panel has already PATCHed /api/suppliers/:id/images server-side, so
      no extra save call is needed for image fields; subsequent Save will
      keep them aligned via the org PUT payload. */
  onImagesUpdated(ev: { coverUrl?: string; logoUrl?: string; imageDisplay?: 'cover' | 'contain' }): void {
    if (ev.coverUrl !== undefined) this.form.cover_image_url = ev.coverUrl || null;
    if (ev.logoUrl !== undefined) this.form.logo_url = ev.logoUrl || null;
    if (ev.imageDisplay) this.form.image_display = ev.imageDisplay;
    this.showImagePanel = false;
    this.cdr.markForCheck();
  }

  onSave(): void {
    if (!this.supplier || !this.isValid()) return;
    this.saving = true;
    this.cdr.markForCheck();

    const payload: Partial<Org> = {
      name: this.form.name.trim(),
      description: this.form.description || '',
      address: this.form.address || '',
      city: this.form.city || '',
      country: this.form.country || '',
      phone: this.form.phone || '',
      email: this.form.email || '',
      website: this.form.website || '',
      vat_registered: this.form.vat_registered,
      vat_number: this.form.vat_registered ? (this.form.vat_number || '') : '',
      cover_image_url: this.form.cover_image_url || undefined,
      logo_url: this.form.logo_url || undefined
    };

    this.orgSvc.update(this.supplier.id, payload).subscribe({
      next: (updated: Org) => {
        this.saving = false;
        this.msg.add({
          severity: 'success',
          summary: 'Supplier updated',
          detail: updated.name,
          life: 3000
        });
        this.saved.emit(updated);
        this.close();
        this.cdr.markForCheck();
      },
      error: () => {
        this.saving = false;
        this.msg.add({
          severity: 'error',
          summary: 'Failed to update',
          life: 4000
        });
        this.cdr.markForCheck();
      }
    });
  }

  onCancel(): void {
    this.cancelled.emit();
    this.close();
  }

  onVisibleChange(v: boolean): void {
    this.visible = v;
    this.visibleChange.emit(v);
  }

  private close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
    this.showImagePanel = false;
  }
}
