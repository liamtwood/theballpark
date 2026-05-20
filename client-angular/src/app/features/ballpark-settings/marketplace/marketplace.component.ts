import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputSwitchModule } from 'primeng/inputswitch';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule } from 'lucide-angular';
import { OrgService } from '../../../core/services/org.service';
import { ConfigService } from '../../../core/services/config.service';
import { Org, PlatformConfig } from '../../../models';
import { ImageUploadPanelComponent } from '../../../shared/components/image-upload-panel/image-upload-panel.component';

@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    LucideAngularModule,
    ButtonModule, InputTextModule, InputSwitchModule, DropdownModule, DialogModule, ToastModule,
    ImageUploadPanelComponent
  ],
  providers: [MessageService],
  template: `
    <div class="bp-team-title-bar">
      <h2 class="bp-page-title">Marketplace</h2>
    </div>

    <div style="padding: var(--section-pad); max-width: 640px; margin: 0 auto;">

      <!-- PLATFORM -->
      <div class="bp-section">
        <div class="bp-section-header">
          <span class="bp-section-title">PLATFORM</span>
          <div class="bp-section-actions">
            <button *ngIf="!editingPlatform" class="bp-icon-btn" (click)="startEdit('platform')" title="Edit">
              <lucide-icon name="square-pen" [size]="14"></lucide-icon>
            </button>
            <ng-container *ngIf="editingPlatform">
              <button class="bp-icon-btn bp-icon-save" (click)="saveSection('platform')" title="Save">
                <i class="pi pi-check"></i>
              </button>
              <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('platform')" title="Cancel">
                <i class="pi pi-times"></i>
              </button>
            </ng-container>
          </div>
        </div>
        <ng-container *ngIf="!editingPlatform">
          <div class="mb-3">
            <label class="bp-field-label">Platform name</label>
            <input pInputText [value]="appearance.platformName || '—'" class="w-full bp-field-readonly" readonly/>
          </div>
          <div>
            <label class="bp-field-label">Tagline</label>
            <input pInputText [value]="appearance.tagline || '—'" class="w-full bp-field-readonly" readonly/>
          </div>
        </ng-container>
        <ng-container *ngIf="editingPlatform">
          <div class="mb-3">
            <label class="bp-field-label">Platform name</label>
            <input pInputText [(ngModel)]="appearance.platformName" class="w-full bp-input-edit"/>
          </div>
          <div>
            <label class="bp-field-label">Tagline</label>
            <input pInputText [(ngModel)]="appearance.tagline" class="w-full bp-input-edit"/>
          </div>
        </ng-container>
      </div>

      <!-- MARKETPLACE LOGO -->
      <div class="bp-section">
        <div class="bp-section-header">
          <span class="bp-section-title">MARKETPLACE LOGO</span>
          <div class="bp-section-actions">
            <button *ngIf="!editingLogo" class="bp-icon-btn" (click)="editingLogo = true" title="Edit">
              <lucide-icon name="square-pen" [size]="14"></lucide-icon>
            </button>
            <ng-container *ngIf="editingLogo">
              <button class="bp-icon-btn bp-icon-cancel" (click)="editingLogo = false" title="Cancel">
                <i class="pi pi-times"></i>
              </button>
            </ng-container>
          </div>
        </div>

        <!-- VIEW MODE -->
        <ng-container *ngIf="!editingLogo">
          <div class="flex items-center gap-4">
            <div *ngIf="org?.logo_url" class="bp-logo-preview">
              <img [src]="org!.logo_url" alt="Marketplace logo" class="max-w-full max-h-full object-contain"/>
            </div>
            <div *ngIf="!org?.logo_url" class="bp-logo-placeholder">
              <i class="pi pi-image" style="font-size:20px;color:var(--color-text-muted);"></i>
            </div>
            <span class="bp-muted-text" style="font-size:var(--text-sm);">
              {{ org?.logo_url ? 'Logo uploaded' : 'No logo uploaded' }}
            </span>
          </div>
        </ng-container>

        <!-- EDIT MODE -->
        <ng-container *ngIf="editingLogo">
          <p class="bp-muted-text mb-3" style="font-size:var(--text-sm);">Displayed in the nav and on supplier-facing pages.</p>
          <app-image-upload-panel
            entityId="marketplace-logo"
            type="logo"
            [existingCoverUrl]="org?.logo_url || ''"
            (imagesUpdated)="onLogoUpdated($event)">
          </app-image-upload-panel>
        </ng-container>
      </div>

      <!-- TERMINOLOGY -->
      <div class="bp-section">
        <div class="bp-section-header">
          <span class="bp-section-title">TERMINOLOGY</span>
          <div class="bp-section-actions">
            <button *ngIf="!editingTerminology" class="bp-icon-btn" (click)="startEdit('terminology')" title="Edit">
              <lucide-icon name="square-pen" [size]="14"></lucide-icon>
            </button>
            <ng-container *ngIf="editingTerminology">
              <button class="bp-icon-btn bp-icon-save" (click)="saveSection('terminology')" title="Save">
                <i class="pi pi-check"></i>
              </button>
              <button class="bp-icon-btn bp-icon-cancel" (click)="cancelEdit('terminology')" title="Cancel">
                <i class="pi pi-times"></i>
              </button>
            </ng-container>
          </div>
        </div>
        <ng-container *ngIf="!editingTerminology">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="bp-field-label">Projects are called</label>
              <input pInputText [value]="appearance.projectLabel || '—'" class="w-full bp-field-readonly" readonly/>
            </div>
            <div>
              <label class="bp-field-label">Credits are called</label>
              <input pInputText [value]="appearance.creditLabel || '—'" class="w-full bp-field-readonly" readonly/>
            </div>
            <div>
              <label class="bp-field-label">Catalogue page is called</label>
              <input pInputText [value]="appearance.catalogueLabel || '—'" class="w-full bp-field-readonly" readonly/>
            </div>
            <div>
              <label class="bp-field-label">Feedback page is called</label>
              <input pInputText [value]="appearance.feedbackLabel || '—'" class="w-full bp-field-readonly" readonly/>
            </div>
          </div>
        </ng-container>
        <ng-container *ngIf="editingTerminology">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="bp-field-label">Projects are called</label>
              <input pInputText [(ngModel)]="appearance.projectLabel" class="w-full bp-input-edit"/>
            </div>
            <div>
              <label class="bp-field-label">Credits are called</label>
              <input pInputText [(ngModel)]="appearance.creditLabel" class="w-full bp-input-edit"/>
            </div>
            <div>
              <label class="bp-field-label">Catalogue page is called</label>
              <input pInputText [(ngModel)]="appearance.catalogueLabel" class="w-full bp-input-edit"/>
            </div>
            <div>
              <label class="bp-field-label">Feedback page is called</label>
              <input pInputText [(ngModel)]="appearance.feedbackLabel" class="w-full bp-input-edit"/>
            </div>
          </div>
        </ng-container>
      </div>

      <!-- TYPOGRAPHY -->
      <div class="bp-section">
        <div class="bp-section-header">
          <span class="bp-section-title">TYPOGRAPHY</span>
        </div>
        <label class="bp-field-label">Font pairing</label>
        <p-dropdown
          [(ngModel)]="appearance.fontPairing"
          [options]="fontPairingOptions"
          optionLabel="label"
          optionValue="value"
          styleClass="w-full bp-input-edit mt-2"
          (ngModelChange)="liveUpdate()">
          <ng-template pTemplate="selectedItem" let-item>
            <span [style.font-family]="item?.preview">{{ item?.label }}</span>
          </ng-template>
          <ng-template pTemplate="item" let-item>
            <div>
              <div [style.font-family]="item?.preview" style="font-size:14px;">{{ item?.label }}</div>
              <div style="font-size:11px;color:var(--color-text-muted);margin-top:2px;">{{ item?.specimen }}</div>
            </div>
          </ng-template>
        </p-dropdown>
      </div>

      <!-- COLOUR THEME -->
      <div class="bp-section">
        <div class="bp-section-header">
          <span class="bp-section-title">COLOUR THEME</span>
        </div>
        <div class="flex gap-3 mt-2">
          <button *ngFor="let t of themeNames" (click)="selectTheme(t)"
            class="bp-swatch" [style.background]="themePresets[t].accent"
            [class.bp-swatch-active]="appearance.themeName === t" [title]="t">
            <i *ngIf="appearance.themeName === t" class="pi pi-check" style="color:#fff;font-size:12px;"></i>
          </button>
        </div>
      </div>

      <!-- MODE -->
      <div class="bp-section">
        <div class="bp-section-header">
          <span class="bp-section-title">MODE</span>
        </div>
        <div class="flex gap-2 mt-2">
          <button (click)="selectMode('light')"  [class.bp-mode-active]="appearance.mode==='light'"  class="bp-mode-option">Light</button>
          <button (click)="selectMode('dark')"   [class.bp-mode-active]="appearance.mode==='dark'"   class="bp-mode-option">Dark</button>
          <button (click)="selectMode('system')" [class.bp-mode-active]="appearance.mode==='system'" class="bp-mode-option">System</button>
        </div>
      </div>

      <!-- HERO BANNER -->
      <div class="bp-section">
        <div class="bp-section-header">
          <span class="bp-section-title">HERO BANNER</span>
        </div>
        <label class="bp-field-label">Alignment</label>
        <div class="flex gap-2 mt-1 mb-4">
          <button (click)="setHeroAlign('left')"   [class.bp-mode-active]="appearance.heroAlign!=='center'" class="bp-mode-option">Left</button>
          <button (click)="setHeroAlign('center')" [class.bp-mode-active]="appearance.heroAlign==='center'" class="bp-mode-option">Centre</button>
        </div>
        <label class="bp-field-label">Components</label>
        <div class="bp-toggle-list">
          <div class="bp-toggle-row">
            <span>Organisation name</span>
            <span class="bp-toggle-disabled">Always on</span>
          </div>
          <div class="bp-toggle-row">
            <span>User name &amp; role</span>
            <p-inputSwitch [(ngModel)]="appearance.showUserName" (ngModelChange)="liveUpdate()"></p-inputSwitch>
          </div>
          <div class="bp-toggle-row">
            <span>Location pill</span>
            <p-inputSwitch [(ngModel)]="appearance.showLocation" (ngModelChange)="liveUpdate()"></p-inputSwitch>
          </div>
          <div class="bp-toggle-row">
            <span>Upcoming events pill</span>
            <p-inputSwitch [(ngModel)]="appearance.showUpcoming" (ngModelChange)="liveUpdate()"></p-inputSwitch>
          </div>
          <div class="bp-toggle-row">
            <span>Stats bar</span>
            <p-inputSwitch [(ngModel)]="appearance.showStats" (ngModelChange)="liveUpdate()"></p-inputSwitch>
          </div>
        </div>
      </div>

      <!-- NAVIGATION -->
      <div class="bp-section">
        <div class="bp-section-header">
          <span class="bp-section-title">NAVIGATION</span>
        </div>
        <label class="bp-field-label">Layout</label>
        <div class="flex gap-2 mt-2">
          <button (click)="selectNavMode('tabs')"
            [class.bp-mode-active]="appearance.navMode === 'tabs'"
            class="bp-mode-option">
            Tabs
          </button>
          <button (click)="selectNavMode('sidenav')"
            [class.bp-mode-active]="appearance.navMode === 'sidenav'"
            class="bp-mode-option">
            Side navigation
          </button>
        </div>
      </div>

      <!-- ACTIONS -->
      <div class="flex gap-3">
        <p-button label="Save marketplace settings" icon="pi pi-save" styleClass="flex-1" (onClick)="saveAppearance()"></p-button>
        <p-button label="Preview" icon="pi pi-eye" styleClass="p-button-outlined" (onClick)="showPreviewDialog = true"></p-button>
      </div>

    </div>

    <!-- PREVIEW DIALOG -->
    <p-dialog [(visible)]="showPreviewDialog" [modal]="true" [closable]="true"
      header="Marketplace preview" styleClass="bp-preview-dialog" [style]="{width:'480px'}">
      <div class="bp-preview-panel" style="border:none;box-shadow:none;">
        <div class="bp-preview-nav">
          <div class="flex items-baseline">
            <span style="font-family:var(--font-display);font-size:10px;color:var(--color-text-primary);">{{ previewLogoFirst }}</span>
            <span style="font-family:var(--font-display);font-size:10px;" [style.color]="previewAccent">{{ previewLogoSecond }}</span>
            <span class="ml-1" style="font-size:6px;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.05em;">{{ appearance.tagline }}</span>
          </div>
          <span [style.background]="previewBg" [style.color]="previewText" style="font-size:7px;font-weight:600;padding:2px 6px;border-radius:10px;">3 {{ appearance.creditLabel }}s</span>
        </div>
        <div [style.background]="previewBg" [style.text-align]="appearance.heroAlign==='center'?'center':'left'" class="bp-preview-hero">
          <div style="font-family:var(--font-display);font-size:20px;color:var(--color-text-primary);letter-spacing:-0.02em;line-height:1.1;" class="mb-1">Anchor Events</div>
          <div *ngIf="appearance.showUserName" style="font-size:8px;color:var(--color-text-muted);">Jamie Hollis &middot; Agency account</div>
        </div>
        <div *ngIf="appearance.showStats" class="bp-preview-stats">
          <div class="bp-preview-stat" style="border-right:0.5px solid var(--color-border);">
            <div [style.color]="previewAccent" style="font-size:6px;font-weight:600;text-transform:uppercase;">{{ appearance.creditLabel }}s</div>
            <div style="font-size:14px;font-weight:700;color:var(--color-text-primary);">3</div>
          </div>
          <div class="bp-preview-stat" style="border-right:0.5px solid var(--color-border);">
            <div style="font-size:6px;font-weight:600;text-transform:uppercase;color:var(--color-text-muted);">Active</div>
            <div style="font-size:14px;font-weight:700;color:var(--color-text-primary);">1</div>
          </div>
          <div class="bp-preview-stat">
            <div style="font-size:6px;font-weight:600;text-transform:uppercase;color:var(--color-text-muted);">Suppliers</div>
            <div style="font-size:14px;font-weight:700;color:var(--color-text-primary);">8</div>
          </div>
        </div>
        <div class="p-2">
          <div class="rounded-lg p-2" style="background:var(--color-surface);border:0.5px solid var(--color-border);">
            <div class="flex justify-between items-center mb-1">
              <span style="font-weight:600;color:var(--color-text-primary);">Sample {{ appearance.projectLabel }}</span>
              <span [style.background]="previewBg" [style.color]="previewText" style="font-size:7px;font-weight:600;padding:2px 6px;border-radius:10px;">Active</span>
            </div>
            <div style="color:var(--color-text-muted);">Client &middot; Jun 2026</div>
          </div>
        </div>
      </div>
    </p-dialog>

    <p-toast></p-toast>
  `,
  styles: [`
    /* ── LOGO PREVIEW ── */
    .bp-logo-preview     { width: 80px; height: 80px; border-radius: 8px; border: 0.5px solid var(--color-border); display: flex; align-items: center; justify-content: center; overflow: hidden; background: #fff; }
    .bp-logo-placeholder { width: 80px; height: 80px; border-radius: 8px; border: 0.5px solid var(--color-border); background: var(--theme-bg); display: flex; align-items: center; justify-content: center; }

    /* ── THEME SWATCHES ── */
    .bp-swatch        { width: 40px; height: 40px; border-radius: 50%; cursor: pointer; border: 3px solid transparent; transition: all 0.15s; display: flex; align-items: center; justify-content: center; }
    .bp-swatch-active { border-color: #111 !important; box-shadow: 0 0 0 2px #fff, 0 0 0 4px #111; }

    /* ── MODE BUTTONS ── */
    .bp-mode-option { padding: 6px 14px; border-radius: 6px; font-size: var(--text-sm); font-weight: 500; border: 0.5px solid var(--color-border); background: var(--color-surface); color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s; font-family: var(--font-body); }
    .bp-mode-option.bp-mode-active { background: var(--color-black); color: #fff; border-color: var(--color-black); }

    /* ── TOGGLE LIST ── */
    .bp-toggle-list     { display: flex; flex-direction: column; }
    .bp-toggle-row      { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; font-size: var(--text-sm); color: var(--color-text-primary); border-bottom: 0.5px solid var(--color-border); }
    .bp-toggle-disabled { font-size: var(--text-xs); color: var(--color-text-muted); font-style: italic; }

    /* ── PREVIEW PANEL ── */
    .bp-preview-panel  { border: 0.5px solid var(--color-border); border-radius: 10px; overflow: hidden; font-size: 9px; }
    .bp-preview-nav    { display: flex; align-items: center; justify-content: space-between; padding: 0 12px; height: 28px; border-bottom: 0.5px solid var(--color-border); background: var(--color-surface); }
    .bp-preview-hero   { padding: 12px; border-bottom: 0.5px solid var(--color-border); }
    .bp-preview-stats  { display: grid; grid-template-columns: repeat(3,1fr); border-bottom: 0.5px solid var(--color-border); background: var(--color-surface); }
    .bp-preview-stat   { padding: 6px 8px; }
  `]
})
export class MarketplaceComponent implements OnInit {
  org: Org | null = null;
  showPreviewDialog = false;
  editingLogo = false;
  editingPlatform = false;
  editingTerminology = false;
  private platformSnapshot: any = null;
  private terminologySnapshot: any = null;

  appearance: PlatformConfig & {
    heroAlign?: string;
    showUserName?: boolean;
    showLocation?: boolean;
    showUpcoming?: boolean;
    showStats?: boolean;
    navMode?: 'tabs' | 'sidenav';
    fontPairing?: string;
  } = {
    platformName: 'The Ballpark', tagline: 'Exhibition Costing',
    projectLabel: 'Event', creditLabel: 'Ball', catalogueLabel: 'Catalogue', feedbackLabel: 'Feedback', themeName: 'amber',
    mode: 'system' as 'light' | 'dark' | 'system',
    heroAlign: 'center', showUserName: true, showLocation: true,
    showUpcoming: true, showStats: true, navMode: 'tabs',
    fontPairing: 'playfair-franklin'
  };

  themePresets = ConfigService.THEME_PRESETS;
  themeNames   = Object.keys(ConfigService.THEME_PRESETS);
  previewLogoFirst  = 'The Ball';
  previewLogoSecond = 'park';
  previewAccent = '#D97706';
  previewBg     = '#F5F0E8';
  previewText   = '#92400E';

  constructor(
    private orgSvc: OrgService,
    private configService: ConfigService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const current = this.configService.current as any;
    this.appearance = {
      ...this.appearance, ...current,
      heroAlign:    current.heroAlign    || 'center',
      showUserName: current.showUserName !== false,
      showLocation: current.showLocation !== false,
      showUpcoming: current.showUpcoming !== false,
      showStats:    current.showStats    !== false,
      navMode:      current.navMode      || 'tabs',
      fontPairing:  current.fontPairing  || 'playfair-franklin'
    };
    this.previewUpdate();
    this.orgSvc.getCurrentOrg().subscribe({
      next: (org) => { this.org = org || null; this.cdr.detectChanges(); }
    });
  }

  fontPairingOptions = [
    { value: 'playfair-franklin', label: 'Playfair Display + Libre Franklin', preview: "'Playfair Display', serif",  specimen: 'The quick brown fox' },
    { value: 'playfair-dm',       label: 'Playfair Display + DM Sans',        preview: "'Playfair Display', serif",  specimen: 'The quick brown fox' },
    { value: 'inter',             label: 'Inter + Inter',                      preview: "'Inter', sans-serif",        specimen: 'The quick brown fox' },
    { value: 'fraunces-nunito',   label: 'Fraunces + Nunito',                  preview: "'Fraunces', serif",          specimen: 'The quick brown fox' },
  ];

  startEdit(section: 'platform' | 'terminology') {
    if (section === 'platform') {
      this.platformSnapshot = { platformName: this.appearance.platformName, tagline: this.appearance.tagline };
      this.editingPlatform = true;
    } else {
      this.terminologySnapshot = { projectLabel: this.appearance.projectLabel, creditLabel: this.appearance.creditLabel, catalogueLabel: this.appearance.catalogueLabel, feedbackLabel: this.appearance.feedbackLabel };
      this.editingTerminology = true;
    }
    this.cdr.detectChanges();
  }

  cancelEdit(section: 'platform' | 'terminology') {
    if (section === 'platform' && this.platformSnapshot) {
      Object.assign(this.appearance, this.platformSnapshot);
      this.editingPlatform = false;
    } else if (section === 'terminology' && this.terminologySnapshot) {
      Object.assign(this.appearance, this.terminologySnapshot);
      this.editingTerminology = false;
    }
    this.liveUpdate();
    this.cdr.detectChanges();
  }

  saveSection(section: 'platform' | 'terminology') {
    if (section === 'platform') this.editingPlatform = false;
    else this.editingTerminology = false;
    this.liveUpdate();
    this.saveAppearance();
    this.cdr.detectChanges();
  }

  selectTheme(name: string)       { this.appearance.themeName = name; this.liveUpdate(); }
  selectMode(mode: string)        { this.appearance.mode = mode as 'light' | 'dark' | 'system'; this.liveUpdate(); }
  setHeroAlign(align: string)     { this.appearance.heroAlign = align; this.liveUpdate(); }
  selectNavMode(mode: 'tabs' | 'sidenav') { this.appearance.navMode = mode; this.liveUpdate(); }

  liveUpdate() { this.configService.update(this.appearance as any); this.previewUpdate(); }

  previewUpdate() {
    const theme = this.themePresets[this.appearance.themeName] || this.themePresets['amber'];
    this.previewAccent    = theme.accent;
    this.previewBg        = theme.bg;
    this.previewText      = theme.text;
    const logo            = this.configService.splitLogoName();
    this.previewLogoFirst = logo.first;
    this.previewLogoSecond = logo.second;
  }

  onLogoUpdated(urls: { coverUrl: string }) {
    if (!this.org || urls.coverUrl === undefined) return;
    const logoUrl = urls.coverUrl;
    // Local display update for the marketplace settings page itself.
    (this.org as any).logo_url = logoUrl;
    this.editingLogo = false;
    this.cdr.detectChanges();

    // v1.23g: image-upload-panel uploads the file to storage but
    // doesn't persist the URL anywhere when type='logo' (its API
    // endpoint is null for that type). We persist it here:
    //   1. ConfigService.logoUrl — picked up by the top-nav via
    //      config$ so the brand mark swaps to the uploaded logo
    //      immediately. Also written to localStorage so it survives
    //      a reload in this browser.
    //   2. orgs.logo_url via the API — canonical DB record so other
    //      sessions / browsers see the same logo.
    this.configService.update({ logoUrl });
    this.orgSvc.updateCurrentOrg({ logo_url: logoUrl } as any).subscribe({
      next: () => {
        this.msg.add({ severity: 'success', summary: 'Logo saved' });
      },
      error: () => {
        this.msg.add({ severity: 'error', summary: 'Saved locally, sync to server failed' });
      }
    });
  }

  saveAppearance() {
    this.configService.update(this.appearance as any);
    this.msg.add({ severity: 'success', summary: 'Appearance saved' });
  }
}
