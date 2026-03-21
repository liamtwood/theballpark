import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputSwitchModule } from 'primeng/inputswitch';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { LucideAngularModule, Building2, Users, Layers, CreditCard, Palette, Pencil } from 'lucide-angular';
import { OrgService } from '../../core/services/org.service';
import { CategoryService } from '../../core/services/category.service';
import { ConfigService } from '../../core/services/config.service';
import { Org, User, Category, PlatformConfig } from '../../models';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule, LucideAngularModule,
    ButtonModule, InputTextModule, InputNumberModule, InputTextareaModule,
    InputSwitchModule, ToastModule, TagModule,
    LoadingSpinnerComponent, AvatarComponent
  ],
  providers: [MessageService],
  template: `
    <!-- HERO BANNER -->
    <div class="bp-hero">
      <h1 class="bp-hero-org-name">{{ org?.name || 'Organisation' }}</h1>
      <p class="bp-hero-page-label">SETTINGS</p>
      <div class="bp-hero-tabs">
        <button *ngFor="let tab of tabs; let i = index"
          class="bp-hero-tab" [class.active]="activeTab === i"
          (click)="activeTab = i">
          <lucide-icon [name]="tabIcons[i]" [size]="12" class="inline align-middle mr-1"></lucide-icon>{{ tab }}
        </button>
      </div>
    </div>

    <div class="bp-content">
      <app-loading *ngIf="loading"></app-loading>

      <ng-container *ngIf="!loading">

        <!-- ── ORGANISATION TAB ── -->
        <div *ngIf="activeTab === 0" class="bp-settings-body">

          <!-- SECTION: ORGANISATION DETAILS -->
          <div class="bp-section" (mouseenter)="hoverSection('org')" (mouseleave)="hoverSection(null)">
            <div class="bp-section-header">
              <span class="bp-section-title">ORGANISATION DETAILS</span>
              <button *ngIf="!editingOrg" class="bp-pencil-btn"
                [class.visible]="hoveredSection === 'org'"
                (click)="startEdit('org')">
                <lucide-icon name="pencil" [size]="14"></lucide-icon>
              </button>
            </div>

            <!-- VIEW MODE -->
            <ng-container *ngIf="!editingOrg">
              <div class="bp-field-grid-2">
                <div class="bp-field-view">
                  <span class="bp-field-label">Organisation name</span>
                  <span class="bp-field-value">{{ form.name || '—' }}</span>
                </div>
                <div class="bp-field-view">
                  <span class="bp-field-label">City</span>
                  <span class="bp-field-value">{{ form.city || '—' }}</span>
                </div>
              </div>
              <div class="bp-field-view mt-4">
                <span class="bp-field-label">Address</span>
                <span class="bp-field-value">{{ form.address || '—' }}</span>
              </div>
              <div class="bp-field-grid-2 mt-4">
                <div class="bp-field-view">
                  <span class="bp-field-label">Email</span>
                  <span class="bp-field-value">{{ form.email || '—' }}</span>
                </div>
                <div class="bp-field-view">
                  <span class="bp-field-label">Phone</span>
                  <span class="bp-field-value">{{ form.phone || '—' }}</span>
                </div>
              </div>
            </ng-container>

            <!-- EDIT MODE -->
            <ng-container *ngIf="editingOrg">
              <div class="bp-field-grid-2">
                <div>
                  <label class="bp-label">Organisation name</label>
                  <input pInputText [(ngModel)]="form.name" class="w-full"/>
                </div>
                <div>
                  <label class="bp-label">City</label>
                  <input pInputText [(ngModel)]="form.city" class="w-full"/>
                </div>
              </div>
              <div class="mt-4">
                <label class="bp-label">Address</label>
                <input pInputText [(ngModel)]="form.address" class="w-full"/>
              </div>
              <div class="bp-field-grid-2 mt-4">
                <div>
                  <label class="bp-label">Email</label>
                  <input pInputText [(ngModel)]="form.email" class="w-full" type="email"/>
                </div>
                <div>
                  <label class="bp-label">Phone</label>
                  <input pInputText [(ngModel)]="form.phone" class="w-full" type="tel"/>
                </div>
              </div>
              <div class="flex justify-end items-center gap-2 mt-5">
                <p-button label="Cancel" styleClass="p-button-text" (onClick)="cancelEdit('org')"></p-button>
                <p-button label="Save changes" icon="pi pi-save" [loading]="saving" (onClick)="save()"></p-button>
              </div>
            </ng-container>
          </div>

          <!-- SECTION: MARKETPLACE LOGO -->
          <div class="bp-section">
            <div class="bp-section-header">
              <span class="bp-section-title">MARKETPLACE LOGO</span>
            </div>
            <div class="flex items-center gap-4">
              <div *ngIf="logoPreview" class="bp-logo-preview">
                <img [src]="logoPreview" alt="Logo" class="max-w-full max-h-full object-contain"/>
              </div>
              <div *ngIf="!logoPreview" class="bp-logo-placeholder">No logo</div>
              <div class="flex items-center gap-2">
                <label class="p-button p-button-outlined" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
                  <i class="pi pi-upload"></i> Upload logo
                  <input type="file" accept="image/*" (change)="onLogoUpload($event)" class="hidden"/>
                </label>
                <p-button *ngIf="logoPreview" label="Remove" styleClass="p-button-text p-button-danger" (onClick)="removeLogo()"></p-button>
              </div>
            </div>
          </div>

          <!-- SECTION: FINANCIAL DEFAULTS -->
          <div class="bp-section" (mouseenter)="hoverSection('fin')" (mouseleave)="hoverSection(null)">
            <div class="bp-section-header">
              <span class="bp-section-title">FINANCIAL DEFAULTS</span>
              <button *ngIf="!editingFin" class="bp-pencil-btn"
                [class.visible]="hoveredSection === 'fin'"
                (click)="startEdit('fin')">
                <lucide-icon name="pencil" [size]="14"></lucide-icon>
              </button>
            </div>

            <!-- VIEW MODE -->
            <ng-container *ngIf="!editingFin">
              <div class="bp-field-grid-3">
                <div class="bp-field-view">
                  <span class="bp-field-label">Default VAT</span>
                  <span class="bp-field-value">{{ form.vat }}%</span>
                </div>
                <div class="bp-field-view">
                  <span class="bp-field-label">Default margin</span>
                  <span class="bp-field-value">{{ form.margin }}%</span>
                </div>
                <div class="bp-field-view">
                  <span class="bp-field-label">Default contingency</span>
                  <span class="bp-field-value">{{ form.contingency }}%</span>
                </div>
              </div>
            </ng-container>

            <!-- EDIT MODE -->
            <ng-container *ngIf="editingFin">
              <div class="bp-field-grid-3">
                <div>
                  <label class="bp-label">Default VAT %</label>
                  <p-inputNumber [(ngModel)]="form.vat" suffix="%" styleClass="w-full"></p-inputNumber>
                </div>
                <div>
                  <label class="bp-label">Default margin %</label>
                  <p-inputNumber [(ngModel)]="form.margin" suffix="%" styleClass="w-full"></p-inputNumber>
                </div>
                <div>
                  <label class="bp-label">Default contingency %</label>
                  <p-inputNumber [(ngModel)]="form.contingency" suffix="%" styleClass="w-full"></p-inputNumber>
                </div>
              </div>
              <div class="flex justify-end items-center gap-2 mt-5">
                <p-button label="Cancel" styleClass="p-button-text" (onClick)="cancelEdit('fin')"></p-button>
                <p-button label="Save changes" icon="pi pi-save" [loading]="saving" (onClick)="save()"></p-button>
              </div>
            </ng-container>
          </div>

        </div>

        <!-- ── TEAM TAB ── -->
        <div *ngIf="activeTab === 1" class="bp-settings-body">
          <p *ngIf="users.length===0" class="bp-muted-text">No team members found.</p>
          <div *ngIf="users.length>0" class="bp-section">
            <div *ngFor="let u of users" class="flex items-center justify-between py-3"
              style="border-bottom:0.5px solid var(--color-border);">
              <div class="flex items-center gap-3">
                <app-avatar [name]="u.name"></app-avatar>
                <div>
                  <p class="text-sm font-medium" style="color:var(--color-text-primary);">{{u.name}}</p>
                  <p class="bp-muted-text">{{u.email}}</p>
                </div>
              </div>
              <p-tag [value]="u.role" styleClass="uppercase"></p-tag>
            </div>
          </div>
        </div>

        <!-- ── CATEGORIES TAB ── -->
        <div *ngIf="activeTab === 2" class="bp-settings-body">
          <p *ngIf="categories.length===0" class="bp-muted-text">No categories found.</p>
          <div class="bp-section" *ngIf="categories.length>0">
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div *ngFor="let c of categories"
                class="flex items-center gap-2 px-3 py-2 rounded-lg"
                style="background:var(--color-surface);border:0.5px solid var(--color-border);">
                <span style="color:var(--color-text-muted);">&#x1F3F7;</span>
                <span class="text-sm font-medium" style="color:var(--color-text-primary);">{{c.name}}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ── SUBSCRIPTION TAB ── -->
        <div *ngIf="activeTab === 3 && org" class="bp-settings-body">
          <div class="bp-section" style="max-width:400px;">
            <div class="bp-section-header">
              <span class="bp-section-title">CURRENT PLAN</span>
            </div>
            <p-tag [value]="org.subscription_tier" styleClass="capitalize mb-4 inline-block"></p-tag>
            <div class="mt-3 text-sm" style="color:var(--color-text-secondary);">
              <div class="flex justify-between py-2" style="border-bottom:0.5px solid var(--color-border);">
                <span>{{ appearance.creditLabel }}s balance</span>
                <span class="font-semibold" style="color:var(--color-text-primary);">{{org.balls_balance}}</span>
              </div>
              <div class="flex justify-between py-2">
                <span>Monthly allowance</span>
                <span class="font-semibold" style="color:var(--color-text-primary);">{{org.balls_monthly_allowance}}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ── APPEARANCE TAB ── -->
        <div *ngIf="activeTab === 4" class="bp-appearance-body">
          <div class="bp-appearance-grid">

            <div>
              <!-- Platform -->
              <div class="bp-section">
                <div class="bp-section-header"><span class="bp-section-title">PLATFORM</span></div>
                <div class="mb-3"><label class="bp-label">Platform name</label><input pInputText [(ngModel)]="appearance.platformName" class="w-full" (ngModelChange)="liveUpdate()"/></div>
                <div class="mb-3"><label class="bp-label">Tagline</label><input pInputText [(ngModel)]="appearance.tagline" class="w-full" (ngModelChange)="liveUpdate()"/></div>
              </div>

              <!-- Terminology -->
              <div class="bp-section">
                <div class="bp-section-header"><span class="bp-section-title">TERMINOLOGY</span></div>
                <div class="grid grid-cols-2 gap-4">
                  <div><label class="bp-label">Projects are called</label><input pInputText [(ngModel)]="appearance.projectLabel" class="w-full" (ngModelChange)="liveUpdate()"/></div>
                  <div><label class="bp-label">Credits are called</label><input pInputText [(ngModel)]="appearance.creditLabel" class="w-full" (ngModelChange)="liveUpdate()"/></div>
                </div>
              </div>

              <!-- Colour theme -->
              <div class="bp-section">
                <div class="bp-section-header"><span class="bp-section-title">COLOUR THEME</span></div>
                <div class="flex gap-3 mt-2">
                  <button *ngFor="let t of themeNames" (click)="selectTheme(t)"
                    class="bp-swatch" [style.background]="themePresets[t].accent"
                    [class.bp-swatch-active]="appearance.themeName === t" [title]="t">
                    <span *ngIf="appearance.themeName === t" class="text-white text-sm">&#10003;</span>
                  </button>
                </div>
              </div>

              <!-- Mode -->
              <div class="bp-section">
                <div class="bp-section-header"><span class="bp-section-title">MODE</span></div>
                <div class="flex gap-2 mt-2">
                  <button (click)="selectMode('light')" [class.bp-mode-active]="appearance.mode==='light'" class="bp-mode-option">&#x2600;&#xFE0F; Light</button>
                  <button (click)="selectMode('dark')" [class.bp-mode-active]="appearance.mode==='dark'" class="bp-mode-option">&#x263E; Dark</button>
                  <button (click)="selectMode('system')" [class.bp-mode-active]="appearance.mode==='system'" class="bp-mode-option">&#x1F4BB; System</button>
                </div>
              </div>

              <!-- Hero banner -->
              <div class="bp-section">
                <div class="bp-section-header"><span class="bp-section-title">HERO BANNER</span></div>
                <label class="bp-label">Alignment</label>
                <div class="flex gap-2 mt-1 mb-4">
                  <button (click)="setHeroAlign('left')" [class.bp-mode-active]="appearance.heroAlign!=='center'" class="bp-mode-option">&#x2B05; Left</button>
                  <button (click)="setHeroAlign('center')" [class.bp-mode-active]="appearance.heroAlign==='center'" class="bp-mode-option">&#x2194;&#xFE0F; Centre</button>
                </div>
                <label class="bp-label">Components</label>
                <div class="bp-toggle-list">
                  <div class="bp-toggle-row">
                    <span>Org name</span>
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

              <p-button label="Save appearance" icon="pi pi-save" styleClass="w-full" (onClick)="saveAppearance()"></p-button>
            </div>

            <!-- LIVE PREVIEW — inline styles intentional: dynamic theme values from ConfigService -->
            <div class="bp-preview-panel">
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

          </div>
        </div>

      </ng-container>
    </div>

    <p-toast></p-toast>
  `,
  styles: [`
    /* ── HERO ── */
    .bp-hero {
      background: var(--theme-bg);
      padding: 32px var(--section-pad) 0;
      border-bottom: 0.5px solid var(--theme-border);
      text-align: center;
    }
    .bp-hero-org-name {
      font-family: var(--font-display);
      font-size: 36px;
      font-weight: 400;
      color: var(--color-text-primary);
      letter-spacing: -0.02em;
      line-height: 1.1;
      margin-bottom: 6px;
    }
    .bp-hero-page-label {
      font-size: 11px;
      font-weight: 500;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 20px;
    }
    .bp-hero-tabs { display: flex; justify-content: center; }
    .bp-hero-tab {
      padding: 10px 20px;
      font-size: var(--text-sm);
      font-weight: 500;
      color: var(--color-text-muted);
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      transition: all 0.15s;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-family: var(--font-body);
    }
    .bp-hero-tab:hover { color: var(--color-text-primary); }
    .bp-hero-tab.active { color: var(--theme-accent); border-bottom-color: var(--theme-accent); }

    /* ── PAGE LAYOUT ── */
    .bp-content { padding: var(--section-pad); }
    .bp-settings-body { max-width: 640px; margin: 0 auto; }
    .bp-appearance-body { padding: 0; }
    .bp-appearance-grid {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: 32px;
      max-width: 960px;
      margin: 0 auto;
      padding: var(--section-pad);
    }

    /* ── SECTIONS ── */
    .bp-section { padding-bottom: 32px; margin-bottom: 8px; position: relative; }
    .bp-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .bp-section-title {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: var(--theme-text);
      text-transform: uppercase;
    }

    /* ── HOVER PENCIL ── */
    .bp-pencil-btn {
      opacity: 0;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-text-muted);
      padding: 4px;
      border-radius: 4px;
      transition: opacity 0.15s, color 0.15s;
      display: flex;
      align-items: center;
    }
    .bp-pencil-btn.visible { opacity: 1; }
    .bp-pencil-btn:hover { color: var(--theme-accent); }

    /* ── FIELD GRIDS ── */
    .bp-field-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .bp-field-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }

    /* ── VIEW MODE ── */
    .bp-field-view { display: flex; flex-direction: column; gap: 2px; }
    .bp-field-label { font-size: 11px; color: var(--color-text-muted); font-weight: 500; }
    .bp-field-value { font-size: var(--text-md); color: var(--color-text-primary); }

    /* ── LABELS & MISC ── */
    .bp-label { display: block; font-size: var(--text-sm); font-weight: 500; color: var(--color-text-secondary); margin-bottom: 4px; }
    .bp-muted-text { font-size: var(--text-sm); color: var(--color-text-muted); }

    /* ── LOGO ── */
    .bp-logo-preview { width: 60px; height: 60px; border-radius: 8px; border: 0.5px solid var(--color-border); display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .bp-logo-placeholder { width: 60px; height: 60px; border-radius: 8px; border: 0.5px solid var(--color-border); background: var(--theme-bg); display: flex; align-items: center; justify-content: center; font-size: var(--text-sm); color: var(--color-text-muted); }

    /* ── APPEARANCE: unique visuals, no PrimeNG equivalent ── */
    .bp-swatch { width: 40px; height: 40px; border-radius: 50%; cursor: pointer; border: 3px solid transparent; transition: all 0.15s; display: flex; align-items: center; justify-content: center; }
    .bp-swatch-active { border-color: #111 !important; box-shadow: 0 0 0 2px #fff, 0 0 0 4px #111; }
    .bp-mode-option { padding: 6px 14px; border-radius: 6px; font-size: var(--text-sm); font-weight: 500; border: 0.5px solid var(--color-border); background: var(--color-surface); color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s; font-family: var(--font-body); }
    .bp-mode-option.bp-mode-active { background: var(--color-black); color: #fff; border-color: var(--color-black); }
    .bp-toggle-list { display: flex; flex-direction: column; }
    .bp-toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; font-size: var(--text-sm); color: var(--color-text-primary); border-bottom: 0.5px solid var(--color-border); }
    .bp-toggle-disabled { font-size: var(--text-xs); color: var(--color-text-muted); font-style: italic; }

    /* ── PREVIEW PANEL ── */
    .bp-preview-panel { border: 0.5px solid var(--color-border); border-radius: 10px; overflow: hidden; font-size: 9px; height: fit-content; position: sticky; top: 24px; }
    .bp-preview-nav { display: flex; align-items: center; justify-content: space-between; padding: 0 12px; height: 28px; border-bottom: 0.5px solid var(--color-border); background: var(--color-surface); }
    .bp-preview-hero { padding: 12px; border-bottom: 0.5px solid var(--color-border); }
    .bp-preview-stats { display: grid; grid-template-columns: repeat(3,1fr); border-bottom: 0.5px solid var(--color-border); background: var(--color-surface); }
    .bp-preview-stat { padding: 6px 8px; }
  `]
})
export class SettingsComponent implements OnInit {
  org: Org | null = null;
  users: User[] = [];
  categories: Category[] = [];
  loading = true;
  saving = false;

  form = {
    name: '', city: '', address: '', email: '', phone: '',
    vat: 20, margin: 20, contingency: 5
  };

  editingOrg = false;
  editingFin = false;
  hoveredSection: string | null = null;

  private orgSnapshot: typeof this.form | null = null;
  private finSnapshot: typeof this.form | null = null;

  readonly icons = { Building2, Users, Layers, CreditCard, Palette, Pencil };
  tabs = ['Organisation', 'Team', 'Categories', 'Subscription', 'Appearance'];
  tabIcons = ['building-2', 'users', 'layers', 'credit-card', 'palette'];
  activeTab = 0;

  appearance: PlatformConfig & {
    heroAlign?: string;
    showUserName?: boolean;
    showLocation?: boolean;
    showUpcoming?: boolean;
    showStats?: boolean;
  } = {
    platformName: 'The Ballpark', tagline: 'Exhibition Costing',
    projectLabel: 'Event', creditLabel: 'Ball', themeName: 'amber',
    mode: 'system' as 'light' | 'dark' | 'system',
    heroAlign: 'center', showUserName: true, showLocation: true,
    showUpcoming: true, showStats: true,
  };

  themePresets = ConfigService.THEME_PRESETS;
  themeNames = Object.keys(ConfigService.THEME_PRESETS);
  previewLogoFirst = 'The Ball';
  previewLogoSecond = 'park';
  previewAccent = '#D97706';
  previewBg = '#F5F0E8';
  previewText = '#92400E';
  logoPreview = '';

  constructor(
    private orgSvc: OrgService,
    private catSvc: CategoryService,
    private configService: ConfigService,
    private msg: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const current = this.configService.current as any;
    this.appearance = {
      ...this.appearance, ...current,
      heroAlign: current.heroAlign || 'center',
      showUserName: current.showUserName !== false,
      showLocation: current.showLocation !== false,
      showUpcoming: current.showUpcoming !== false,
      showStats: current.showStats !== false
    };
    this.logoPreview = this.configService.logoUrl;
    this.previewUpdate();

    Promise.all([
      this.orgSvc.getCurrentOrg().toPromise(),
      this.orgSvc.getUsers().toPromise(),
      this.catSvc.getAll().toPromise()
    ]).then(([org, users, cats]) => {
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
      this.users = users || [];
      this.categories = cats || [];
      this.loading = false;
      this.cdr.detectChanges();
    }).catch(() => { this.loading = false; this.cdr.detectChanges(); });
  }

  hoverSection(section: string | null) { this.hoveredSection = section; }

  startEdit(section: 'org' | 'fin') {
    if (section === 'org') { this.orgSnapshot = { ...this.form }; this.editingOrg = true; }
    else { this.finSnapshot = { ...this.form }; this.editingFin = true; }
  }

  cancelEdit(section: 'org' | 'fin') {
    if (section === 'org' && this.orgSnapshot) { this.form = { ...this.orgSnapshot }; this.editingOrg = false; }
    else if (section === 'fin' && this.finSnapshot) { this.form = { ...this.finSnapshot }; this.editingFin = false; }
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
      },
      error: () => {
        this.saving = false;
        this.msg.add({ severity: 'error', summary: 'Error saving changes' });
      }
    });
  }

  selectTheme(name: string) { this.appearance.themeName = name; this.liveUpdate(); }
  selectMode(mode: string) { this.appearance.mode = mode as 'light' | 'dark' | 'system'; this.liveUpdate(); }
  setHeroAlign(align: string) { this.appearance.heroAlign = align; this.liveUpdate(); }
  liveUpdate() { this.configService.update(this.appearance as any); this.previewUpdate(); }

  previewUpdate() {
    const theme = this.themePresets[this.appearance.themeName] || this.themePresets['amber'];
    this.previewAccent = theme.accent; this.previewBg = theme.bg; this.previewText = theme.text;
    const logo = this.configService.splitLogoName();
    this.previewLogoFirst = logo.first; this.previewLogoSecond = logo.second;
  }

  onLogoUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.logoPreview = reader.result as string;
      this.configService.update({ logoUrl: this.logoPreview });
      this.msg.add({ severity: 'success', summary: 'Logo uploaded' });
    };
    reader.readAsDataURL(file);
  }

  removeLogo() {
    this.logoPreview = '';
    this.configService.update({ logoUrl: '' });
    this.msg.add({ severity: 'info', summary: 'Logo removed' });
  }

  saveAppearance() {
    this.configService.update(this.appearance as any);
    this.msg.add({ severity: 'success', summary: 'Appearance saved' });
  }
}
