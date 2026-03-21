import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputSwitchModule } from 'primeng/inputswitch';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { OrgService } from '../../core/services/org.service';
import { CategoryService } from '../../core/services/category.service';
import { ConfigService } from '../../core/services/config.service';
import { Org, User, Category, PlatformConfig } from '../../models';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, InputTextModule, InputNumberModule, InputTextareaModule,
    InputSwitchModule, ToastModule,
    LoadingSpinnerComponent, AvatarComponent, StatusBadgeComponent
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
          (click)="activeTab = i">{{ tab }}
        </button>
      </div>
    </div>

    <div class="bp-content">
      <app-loading *ngIf="loading"></app-loading>

      <ng-container *ngIf="!loading">

        <!-- ── ORGANISATION TAB ── -->
        <div *ngIf="activeTab === 0" class="bp-settings-body">
          <h2 class="bp-page-title">Organisation Settings</h2>

          <!-- SECTION: ORGANISATION DETAILS -->
          <div class="bp-section">
            <div class="bp-section-header">
              <span class="bp-section-title">ORGANISATION DETAILS</span>
              <div class="bp-section-actions">
                <button *ngIf="!editingOrg" class="bp-icon-btn" (click)="startEdit('org')" title="Edit">
                  <i class="pi pi-pencil"></i>
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

            <!-- VIEW MODE -->
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

            <!-- EDIT MODE -->
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
          <div class="bp-section">
            <div class="bp-section-header">
              <span class="bp-section-title">FINANCIAL DEFAULTS</span>
              <div class="bp-section-actions">
                <button *ngIf="!editingFin" class="bp-icon-btn" (click)="startEdit('fin')" title="Edit">
                  <i class="pi pi-pencil"></i>
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

            <!-- VIEW MODE -->
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

            <!-- EDIT MODE -->
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

        <!-- ── TEAM TAB ── -->
        <div *ngIf="activeTab === 1" class="bp-team-page">

          <!-- Full-width page title -->
          <div class="bp-team-title-bar">
            <h2 class="bp-page-title">Team</h2>
          </div>

          <div class="bp-team-body">

            <!-- LEFT: sort + filter sidebar -->
            <div class="bp-team-sidebar">

              <div class="bp-sidebar-heading">Sort by</div>
              <div *ngFor="let s of sortOptions"
                class="bp-sidebar-item" [class.active]="teamSort === s.value"
                (click)="setTeamSort(s.value)">
                {{ s.label }}
                <span class="bp-sidebar-arrow">{{ teamSort === s.value ? '↑' : '↕' }}</span>
              </div>

              <hr class="bp-sidebar-divider"/>

              <div class="bp-sidebar-heading">Filter by</div>

              <div class="bp-team-search">
                <i class="pi pi-search" style="color:var(--color-text-muted);font-size:12px;"></i>
                <input pInputText [(ngModel)]="teamSearch" placeholder="Search..."
                  class="bp-team-search-input" (ngModelChange)="applyFilters()"/>
              </div>

              <div class="bp-sidebar-sublabel">Role</div>
              <div *ngFor="let r of roleFilters"
                class="bp-sidebar-item" [class.active]="teamRoleFilter === r.value"
                (click)="setRoleFilter(r.value)">
                {{ r.label }}
                <span class="bp-sidebar-count">{{ getRoleCount(r.value) }}</span>
              </div>

            </div>

            <!-- RIGHT: members list/card -->
            <div class="bp-team-main">
              <div class="bp-section-header">
                <span class="bp-section-title">MEMBERS</span>
                <div class="flex items-center gap-2">
                  <div class="bp-view-toggle">
                    <button class="bp-view-btn" [class.active]="teamView==='list'" (click)="teamView='list'" title="List view">
                      <i class="pi pi-bars"></i>
                    </button>
                    <button class="bp-view-btn" [class.active]="teamView==='grid'" (click)="teamView='grid'" title="Card view">
                      <i class="pi pi-th-large"></i>
                    </button>
                  </div>
                  <p-button label="Invite member" icon="pi pi-plus" styleClass="p-button-outlined" (onClick)="inviteMember()"></p-button>
                </div>
              </div>

              <p *ngIf="filteredUsers.length===0" class="bp-muted-text">No members found.</p>

              <!-- LIST VIEW -->
              <ng-container *ngIf="teamView==='list'">
                <div *ngFor="let u of filteredUsers; let last = last"
                  class="bp-member-row" [style.border-bottom]="!last ? '0.5px solid var(--color-border)' : 'none'">
                  <div class="flex items-center gap-3">
                    <app-avatar [name]="u.name"></app-avatar>
                    <div>
                      <p class="bp-member-name">{{u.name}}</p>
                      <p class="bp-muted-text">{{u.email}}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="bp-member-joined">{{u.joined || '—'}}</span>
                    <app-status-badge [status]="u.role"></app-status-badge>
                    <button class="bp-icon-btn" title="Edit" (click)="editMember(u)">
                      <i class="pi pi-pencil"></i>
                    </button>
                    <button class="bp-icon-btn bp-icon-danger" title="Remove" (click)="removeMember(u)">
                      <i class="pi pi-trash"></i>
                    </button>
                  </div>
                </div>
              </ng-container>

              <!-- CARD VIEW -->
              <div *ngIf="teamView==='grid'" class="bp-member-grid">
                <div *ngFor="let u of filteredUsers" class="bp-member-card">
                  <div class="flex items-center gap-3 mb-3">
                    <app-avatar [name]="u.name" [size]="44"></app-avatar>
                    <div>
                      <p class="bp-member-name">{{u.name}}</p>
                      <p class="bp-muted-text">{{u.email}}</p>
                    </div>
                  </div>
                  <div class="bp-member-card-footer">
                    <app-status-badge [status]="u.role"></app-status-badge>
                    <div class="flex gap-1">
                      <button class="bp-icon-btn" title="Edit" (click)="editMember(u)">
                        <i class="pi pi-pencil"></i>
                      </button>
                      <button class="bp-icon-btn bp-icon-danger" title="Remove" (click)="removeMember(u)">
                        <i class="pi pi-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        <!-- ── CATEGORIES TAB ── -->
        <div *ngIf="activeTab === 2" class="bp-settings-body">
          <h2 class="bp-page-title">Categories</h2>

          <div class="bp-section">
            <div class="bp-section-header">
              <span class="bp-section-title">ACTIVE CATEGORIES</span>
            </div>
            <p *ngIf="categories.length===0" class="bp-muted-text">No categories found.</p>
            <div *ngIf="categories.length>0" class="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div *ngFor="let c of categories"
                class="flex items-center gap-2 px-3 py-2 rounded-lg"
                style="background:var(--color-surface);border:0.5px solid var(--color-border);">
                <i class="pi pi-tag" style="color:var(--color-text-muted);font-size:12px;"></i>
                <span class="bp-category-name">{{c.name}}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ── SUBSCRIPTION TAB ── -->
        <div *ngIf="activeTab === 3 && org" class="bp-settings-body">
          <h2 class="bp-page-title">Subscription</h2>

          <div class="bp-section">
            <div class="bp-section-header">
              <span class="bp-section-title">CURRENT PLAN</span>
            </div>
            <app-status-badge [status]="org.subscription_tier"></app-status-badge>
            <div class="mt-4" style="border-top:0.5px solid var(--color-border);">
              <div class="flex justify-between py-3" style="border-bottom:0.5px solid var(--color-border);">
                <span class="bp-field-label" style="margin:0;">{{ appearance.creditLabel }}s balance</span>
                <span class="bp-field-value-inline">{{org.balls_balance}}</span>
              </div>
              <div class="flex justify-between py-3">
                <span class="bp-field-label" style="margin:0;">Monthly allowance</span>
                <span class="bp-field-value-inline">{{org.balls_monthly_allowance}}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ── APPEARANCE TAB ── -->
        <div *ngIf="activeTab === 4" class="bp-appearance-body">
          <div class="bp-appearance-grid">

            <div>
              <h2 class="bp-page-title">Appearance</h2>

              <div class="bp-section">
                <div class="bp-section-header"><span class="bp-section-title">PLATFORM</span></div>
                <div class="mb-3">
                  <label class="bp-field-label">Platform name</label>
                  <input pInputText [(ngModel)]="appearance.platformName" class="w-full" (ngModelChange)="liveUpdate()"/>
                </div>
                <div class="mb-3">
                  <label class="bp-field-label">Tagline</label>
                  <input pInputText [(ngModel)]="appearance.tagline" class="w-full" (ngModelChange)="liveUpdate()"/>
                </div>
              </div>

              <div class="bp-section">
                <div class="bp-section-header"><span class="bp-section-title">TERMINOLOGY</span></div>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="bp-field-label">Projects are called</label>
                    <input pInputText [(ngModel)]="appearance.projectLabel" class="w-full" (ngModelChange)="liveUpdate()"/>
                  </div>
                  <div>
                    <label class="bp-field-label">Credits are called</label>
                    <input pInputText [(ngModel)]="appearance.creditLabel" class="w-full" (ngModelChange)="liveUpdate()"/>
                  </div>
                </div>
              </div>

              <div class="bp-section">
                <div class="bp-section-header"><span class="bp-section-title">COLOUR THEME</span></div>
                <div class="flex gap-3 mt-2">
                  <button *ngFor="let t of themeNames" (click)="selectTheme(t)"
                    class="bp-swatch" [style.background]="themePresets[t].accent"
                    [class.bp-swatch-active]="appearance.themeName === t" [title]="t">
                    <i *ngIf="appearance.themeName === t" class="pi pi-check" style="color:#fff;font-size:12px;"></i>
                  </button>
                </div>
              </div>

              <div class="bp-section">
                <div class="bp-section-header"><span class="bp-section-title">MODE</span></div>
                <div class="flex gap-2 mt-2">
                  <button (click)="selectMode('light')" [class.bp-mode-active]="appearance.mode==='light'" class="bp-mode-option">Light</button>
                  <button (click)="selectMode('dark')" [class.bp-mode-active]="appearance.mode==='dark'" class="bp-mode-option">Dark</button>
                  <button (click)="selectMode('system')" [class.bp-mode-active]="appearance.mode==='system'" class="bp-mode-option">System</button>
                </div>
              </div>

              <div class="bp-section">
                <div class="bp-section-header"><span class="bp-section-title">HERO BANNER</span></div>
                <label class="bp-field-label">Alignment</label>
                <div class="flex gap-2 mt-1 mb-4">
                  <button (click)="setHeroAlign('left')" [class.bp-mode-active]="appearance.heroAlign!=='center'" class="bp-mode-option">Left</button>
                  <button (click)="setHeroAlign('center')" [class.bp-mode-active]="appearance.heroAlign==='center'" class="bp-mode-option">Centre</button>
                </div>
                <label class="bp-field-label">Components</label>
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
      gap: 6px;
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

    /* ── PAGE TITLE ── */
    .bp-page-title {
      font-family: var(--font-display);
      font-size: var(--text-2xl);
      font-weight: 400;
      color: var(--theme-accent);
      margin-bottom: 24px;
      text-align: center;
    }

    /* ── SECTIONS ── */
    .bp-section { padding-bottom: 32px; margin-bottom: 8px; }
    .bp-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .bp-section-title {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: var(--theme-accent);
      text-transform: uppercase;
    }
    .bp-section-actions { display: flex; align-items: center; gap: 2px; }

    /* ── ICON ACTION BUTTONS (pencil / check / times) ── */
    .bp-icon-btn {
      width: 28px;
      height: 28px;
      border-radius: 4px;
      border: none;
      background: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-muted);
      transition: color 0.15s, background 0.15s;
      font-size: 13px;
    }
    .bp-icon-btn:hover { color: var(--theme-accent); background: var(--theme-bg); }
    .bp-icon-save { color: var(--theme-accent); }
    .bp-icon-save:hover:not(:disabled) { background: var(--theme-bg); }
    .bp-icon-save:disabled { opacity: 0.4; cursor: default; }
    .bp-icon-cancel:hover { color: var(--color-text-primary); background: var(--color-border); }

    /* ── FIELD GRIDS ── */
    .bp-field-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .bp-field-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }

    /* ── VIEW MODE — readonly pInputText ── */
    :host ::ng-deep .bp-field-readonly.p-inputtext {
      background: transparent !important;
      border-color: transparent !important;
      box-shadow: none !important;
      cursor: default !important;
      color: var(--color-text-primary) !important;
    }
    :host ::ng-deep .bp-field-readonly.p-inputtext:focus {
      box-shadow: none !important;
      border-color: transparent !important;
    }

    /* ── EDIT MODE INPUTS — parchment bg + theme accent border ── */
    :host ::ng-deep .bp-input-edit.p-inputtext,
    :host ::ng-deep input.bp-input-edit {
      background: var(--theme-bg) !important;
      border-color: var(--theme-accent) !important;
    }
    :host ::ng-deep .bp-input-edit.p-inputtext:focus,
    :host ::ng-deep input.bp-input-edit:focus {
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-accent) 20%, transparent) !important;
    }
    :host ::ng-deep .bp-input-edit .p-inputtext {
      background: var(--theme-bg) !important;
      border-color: var(--theme-accent) !important;
    }

    /* ── TEAM TAB ── */
    .bp-team-page { }
    .bp-team-title-bar { padding: 20px var(--section-pad) 0; border-bottom: 0.5px solid var(--color-border); }
    .bp-team-body { display: grid; grid-template-columns: 180px 1fr; min-height: calc(100vh - 300px); }
    .bp-team-sidebar { border-right: 0.5px solid var(--color-border); padding: 20px 16px; }
    .bp-team-main { padding: 20px 28px; }

    .bp-sidebar-heading { font-size: 14px; font-weight: 500; color: var(--theme-accent); margin-bottom: 8px; }
    .bp-sidebar-sublabel { font-size: 11px; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin: 10px 0 6px; }
    .bp-sidebar-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 5px 8px; border-radius: 6px; cursor: pointer;
      font-size: 12px; color: var(--color-text-secondary); margin-bottom: 2px;
      transition: background 0.15s;
    }
    .bp-sidebar-item:hover { background: var(--color-surface); }
    .bp-sidebar-item.active { background: var(--theme-bg); color: var(--theme-text); font-weight: 500; }
    .bp-sidebar-arrow { font-size: 10px; color: var(--color-text-muted); }
    .bp-sidebar-item.active .bp-sidebar-arrow { color: var(--theme-accent); }
    .bp-sidebar-count { font-size: 11px; color: var(--color-text-muted); background: var(--color-surface); padding: 1px 7px; border-radius: 20px; border: 0.5px solid var(--color-border); }
    .bp-sidebar-item.active .bp-sidebar-count { background: var(--theme-bg); color: var(--theme-text); border-color: var(--theme-border); }
    .bp-sidebar-divider { border: none; border-top: 0.5px solid var(--color-border); margin: 16px 0; }

    .bp-team-search { display: flex; align-items: center; gap: 8px; border: 0.5px solid var(--color-border); border-radius: 6px; padding: 5px 10px; margin-bottom: 10px; }
    .bp-team-search:focus-within { border-color: var(--theme-accent); }
    :host ::ng-deep .bp-team-search-input.p-inputtext { border: none !important; box-shadow: none !important; padding: 0 !important; font-size: 12px !important; background: transparent !important; }

    .bp-view-toggle { display: flex; border: 0.5px solid var(--color-border); border-radius: 6px; overflow: hidden; }
    .bp-view-btn { width: 30px; height: 28px; display: flex; align-items: center; justify-content: center; border: none; background: var(--color-surface); cursor: pointer; color: var(--color-text-muted); font-size: 13px; transition: all 0.15s; }
    .bp-view-btn.active { background: var(--theme-bg); color: var(--theme-accent); }

    .bp-member-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; }
    .bp-member-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 4px; }
    .bp-member-card { border: 0.5px solid var(--color-border); border-radius: 10px; padding: 16px; }
    .bp-member-card-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 10px; border-top: 0.5px solid var(--color-border); }
    .bp-member-joined { font-size: 11px; color: var(--color-text-muted); }

    /* ── MISC ── */
    .bp-muted-text { font-size: var(--text-sm); color: var(--color-text-muted); }
    .bp-member-name { font-size: var(--text-md); font-weight: 500; color: var(--color-text-primary); margin: 0; }
    .bp-category-name { font-size: var(--text-sm); font-weight: 500; color: var(--color-text-primary); }
    .bp-field-value-inline { font-size: var(--text-md); font-weight: 500; color: var(--color-text-primary); }

    /* ── LOGO ── */
    .bp-logo-preview { width: 60px; height: 60px; border-radius: 8px; border: 0.5px solid var(--color-border); display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .bp-logo-placeholder { width: 60px; height: 60px; border-radius: 8px; border: 0.5px solid var(--color-border); background: var(--theme-bg); display: flex; align-items: center; justify-content: center; font-size: var(--text-sm); color: var(--color-text-muted); }

    /* ── APPEARANCE: unique visuals ── */
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

  private orgSnapshot: typeof this.form | null = null;
  private finSnapshot: typeof this.form | null = null;

  tabs = ['Organisation', 'Team', 'Categories', 'Subscription', 'Appearance'];
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
      this.applyFilters();
      this.loading = false;
      this.cdr.detectChanges();
    }).catch(() => { this.loading = false; this.cdr.detectChanges(); });
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

  // Team tab
  teamView: 'list' | 'grid' = 'list';
  teamSort = 'name';
  teamSearch = '';
  teamRoleFilter = 'all';
  filteredUsers: User[] = [];

  sortOptions = [
    { label: 'Name', value: 'name' },
    { label: 'Joined', value: 'joined' },
    { label: 'Role', value: 'role' }
  ];

  roleFilters = [
    { label: 'All members', value: 'all' },
    { label: 'Owner', value: 'owner' },
    { label: 'Member', value: 'member' }
  ];

  getRoleCount(role: string): number {
    if (role === 'all') return this.users.length;
    return this.users.filter(u => u.role === role).length;
  }

  setTeamSort(val: string) {
    this.teamSort = val;
    this.applyFilters();
  }

  setRoleFilter(val: string) {
    this.teamRoleFilter = val;
    this.applyFilters();
  }

  applyFilters() {
    let list = [...this.users];
    if (this.teamRoleFilter !== 'all') {
      list = list.filter(u => u.role === this.teamRoleFilter);
    }
    if (this.teamSearch.trim()) {
      const q = this.teamSearch.toLowerCase();
      list = list.filter(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      if (this.teamSort === 'name') return (a.name || '').localeCompare(b.name || '');
      if (this.teamSort === 'role') return (a.role || '').localeCompare(b.role || '');
      if (this.teamSort === 'joined') return (a.joined || '').localeCompare(b.joined || '');
      return 0;
    });
    this.filteredUsers = list;
    this.cdr.detectChanges();
  }

  editMember(u: User) {
    this.msg.add({ severity: 'info', summary: `Edit ${u.name} — coming soon` });
  }

  removeMember(u: User) {
    this.msg.add({ severity: 'warn', summary: `Remove ${u.name} — coming soon` });
  }

  inviteMember() {
    this.msg.add({ severity: 'info', summary: 'Invite member — coming soon' });
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
