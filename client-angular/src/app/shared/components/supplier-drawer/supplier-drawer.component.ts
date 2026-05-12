import {
  Component, Input, Output, EventEmitter,
  ChangeDetectionStrategy, ChangeDetectorRef,
  OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputSwitchModule } from 'primeng/inputswitch';
import { SidebarModule } from 'primeng/sidebar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { Org } from '../../../models';
import { OrgService } from '../../../core/services/org.service';
import { ImageUploadPanelComponent } from '../image-upload-panel/image-upload-panel.component';

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
    SidebarModule, ButtonModule, InputTextModule, InputTextareaModule, InputSwitchModule,
    ToastModule, ImageUploadPanelComponent
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

        <!-- ═══ DETAILS ═══ -->
        <div class="bp-section-h">DETAILS</div>

        <div class="bp-field">
          <label class="bp-field-label">Name *</label>
          <input pInputText
                 [(ngModel)]="form.name"
                 class="w-full bp-input-edit"
                 placeholder="Supplier name"/>
        </div>

        <div class="bp-field">
          <label class="bp-field-label">Description</label>
          <textarea pInputTextarea
                    [(ngModel)]="form.description"
                    class="w-full bp-input-edit"
                    [autoResize]="true"
                    [rows]="4"
                    placeholder="What this supplier does, who they work with..."></textarea>
          <div class="bp-field-hint">Markdown supported on the Home tab.</div>
        </div>

        <!-- ═══ ADDRESS ═══ -->
        <div class="bp-section-h">ADDRESS</div>

        <div class="bp-field">
          <label class="bp-field-label">Address</label>
          <input pInputText
                 [(ngModel)]="form.address"
                 class="w-full bp-input-edit"
                 placeholder="Street address"/>
        </div>

        <div class="bp-grid-2">
          <div class="bp-field">
            <label class="bp-field-label">City</label>
            <input pInputText
                   [(ngModel)]="form.city"
                   class="w-full bp-input-edit"
                   placeholder="London"/>
          </div>
          <div class="bp-field">
            <label class="bp-field-label">Country</label>
            <input pInputText
                   [(ngModel)]="form.country"
                   class="w-full bp-input-edit"
                   placeholder="United Kingdom"/>
          </div>
        </div>

        <!-- ═══ CONTACT ═══ -->
        <div class="bp-section-h">CONTACT</div>

        <div class="bp-field">
          <label class="bp-field-label">Phone</label>
          <input pInputText
                 [(ngModel)]="form.phone"
                 class="w-full bp-input-edit"
                 placeholder="+44 ..."/>
        </div>

        <div class="bp-field">
          <label class="bp-field-label">Email</label>
          <input pInputText
                 type="email"
                 [(ngModel)]="form.email"
                 class="w-full bp-input-edit"
                 placeholder="hello@example.com"/>
        </div>

        <div class="bp-field">
          <label class="bp-field-label">Website</label>
          <input pInputText
                 [(ngModel)]="form.website"
                 class="w-full bp-input-edit"
                 placeholder="https://..."/>
        </div>

        <!-- ═══ VAT ═══ -->
        <div class="bp-section-h">VAT</div>

        <div class="bp-field">
          <label class="bp-vat-toggle">
            <p-inputSwitch [(ngModel)]="form.vat_registered"></p-inputSwitch>
            <span>VAT registered</span>
          </label>
        </div>

        <div class="bp-field" *ngIf="form.vat_registered">
          <label class="bp-field-label">VAT number</label>
          <input pInputText
                 [(ngModel)]="form.vat_number"
                 class="w-full bp-input-edit"
                 placeholder="GB 123 4567 89"/>
        </div>

        <!-- ═══ IMAGES ═══ -->
        <div class="bp-section-h">IMAGES</div>

        <div class="bp-field">
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
        </div>

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

    .bp-section-h {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: var(--color-text-muted);
      text-transform: uppercase;
      padding: 14px 0 6px;
      margin: 6px 0 10px;
      border-bottom: 0.5px solid var(--color-border);
      font-family: var(--font-body);
    }
    .bp-section-h:first-child { padding-top: 0; }

    .bp-field { margin-bottom: 14px; }
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
    .bp-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

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
      background-color: var(--theme-bg);
    }
    .bp-image-thumb--empty { background: var(--theme-bg); }
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
