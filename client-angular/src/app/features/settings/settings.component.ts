import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabViewModule } from 'primeng/tabview';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LucideAngularModule, Building2, Users, Layers, CreditCard, Palette, Upload, Save } from 'lucide-angular';
import { OrgService } from '../../core/services/org.service';
import { CategoryService } from '../../core/services/category.service';
import { ConfigService } from '../../core/services/config.service';
import { Org, User, Category, PlatformConfig } from '../../models';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, TabViewModule, ButtonModule, InputTextModule, InputNumberModule, InputTextareaModule, ToastModule, LoadingSpinnerComponent],
  providers: [MessageService],
  template: `
    <!-- HERO BANNER with tabs — always visible -->
    <div class="bp-hero">
      <h1 class="bp-hero-org-name">{{ org?.name || 'Organisation' }}</h1>
      <p class="bp-hero-page-label">SETTINGS</p>
      <div class="bp-hero-tabs">
        <button *ngFor="let tab of tabs; let i = index"
          class="bp-hero-tab" [class.active]="activeTab === i"
          (click)="activeTab = i">
            <lucide-icon [name]="tabIcons[i]" [size]="12" style="display:inline;vertical-align:middle;margin-right:4px;"></lucide-icon>{{ tab }}
          </button>
      </div>
    </div>

    <div class="bp-content">
      <app-loading *ngIf="loading"></app-loading>
      <ng-container *ngIf="!loading">

        <!-- ORGANISATION -->
        <div *ngIf="activeTab === 0" class="max-w-2xl space-y-5">
          <div>
            <label class="bp-label">Marketplace Logo</label>
            <div style="display:flex;align-items:center;gap:16px;margin-top:4px;">
              <div *ngIf="logoPreview" class="bp-logo-preview">
                <img [src]="logoPreview" alt="Logo" style="max-width:100%;max-height:100%;object-fit:contain;"/>
              </div>
              <div *ngIf="!logoPreview" class="bp-logo-placeholder">No logo</div>
              <div>
                <label class="btn-primary" style="display:inline-flex;cursor:pointer;padding:6px 14px;font-size:var(--text-sm);">
                  <lucide-icon name="upload" [size]="12"></lucide-icon> Upload Logo
                  <input type="file" accept="image/*" (change)="onLogoUpload($event)" style="display:none;"/>
                </label>
                <button *ngIf="logoPreview" (click)="removeLogo()" style="margin-left:8px;font-size:var(--text-sm);color:var(--color-text-muted);background:none;border:none;cursor:pointer;text-decoration:underline;">Remove</button>
              </div>
            </div>
          </div>
          <div><label class="bp-label">Organisation Name</label><input pInputText [(ngModel)]="form.name" class="w-full"/></div>
          <div><label class="bp-label">Address</label><textarea pInputTextarea [(ngModel)]="form.address" [rows]="2" class="w-full" style="resize:none;"></textarea></div>
          <div class="grid grid-cols-3 gap-4">
            <div><label class="bp-label">Default VAT %</label><p-inputNumber [(ngModel)]="form.vat" suffix="%" styleClass="w-full"></p-inputNumber></div>
            <div><label class="bp-label">Default Margin %</label><p-inputNumber [(ngModel)]="form.margin" suffix="%" styleClass="w-full"></p-inputNumber></div>
            <div><label class="bp-label">Default Contingency %</label><p-inputNumber [(ngModel)]="form.contingency" suffix="%" styleClass="w-full"></p-inputNumber></div>
          </div>
          <button class="btn-primary" style="width:100%;" [disabled]="saving" (click)="save()"><lucide-icon name="save" [size]="14"></lucide-icon> {{ saving ? 'Saving...' : 'Save changes' }}</button>
        </div>

        <!-- TEAM -->
        <div *ngIf="activeTab === 1">
          <p *ngIf="users.length===0" class="bp-muted-text">No team members found.</p>
          <div *ngIf="users.length>0">
            <div *ngFor="let u of users" class="flex items-center justify-between py-3" style="border-bottom:0.5px solid var(--color-border);">
              <div class="flex items-center gap-3">
                <div class="bp-avatar-sm">{{(u.name||'U').charAt(0).toUpperCase()}}</div>
                <div>
                  <p style="font-size:var(--text-md);font-weight:500;color:var(--color-text-primary);">{{u.name}}</p>
                  <p class="bp-muted-text">{{u.email}}</p>
                </div>
              </div>
              <span class="bp-pill" style="text-transform:uppercase;">{{u.role}}</span>
            </div>
          </div>
        </div>

        <!-- CATEGORIES -->
        <div *ngIf="activeTab === 2">
          <p *ngIf="categories.length===0" class="bp-muted-text">No categories found.</p>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3" *ngIf="categories.length>0">
            <div *ngFor="let c of categories" class="flex items-center gap-2 px-3 py-2" style="background:var(--color-surface);border:0.5px solid var(--color-border);border-radius:8px;">
              <span style="color:var(--color-text-muted);">&#x1F3F7;</span>
              <span style="font-size:var(--text-md);font-weight:500;color:var(--color-text-primary);">{{c.name}}</span>
            </div>
          </div>
        </div>

        <!-- SUBSCRIPTION -->
        <div *ngIf="activeTab === 3 && org">
          <div style="background:var(--color-surface);border:0.5px solid var(--color-border);border-radius:10px;padding:18px;max-width:400px;">
            <h2 style="font-size:var(--text-md);font-weight:600;color:var(--color-text-primary);margin-bottom:12px;">Current Plan</h2>
            <span class="bp-pill" style="margin-bottom:12px;display:inline-block;text-transform:capitalize;">{{org.subscription_tier}}</span>
            <div style="font-size:var(--text-sm);color:var(--color-text-secondary);">
              <div class="flex justify-between py-1"><span>{{ appearance.creditLabel }}s Balance</span><span style="font-weight:600;color:var(--color-text-primary);">{{org.balls_balance}}</span></div>
              <div class="flex justify-between py-1"><span>Monthly Allowance</span><span style="font-weight:600;color:var(--color-text-primary);">{{org.balls_monthly_allowance}}</span></div>
            </div>
          </div>
        </div>

        <!-- APPEARANCE -->
        <div *ngIf="activeTab === 4" style="display:grid;grid-template-columns:1fr 360px;gap:32px;">
          <div>
            <div class="bp-app-section">
              <h3 class="bp-app-title">Platform</h3>
              <div class="bp-field"><label class="bp-label">Platform Name</label><input pInputText [(ngModel)]="appearance.platformName" class="w-full" (ngModelChange)="liveUpdate()"/></div>
              <div class="bp-field"><label class="bp-label">Tagline</label><input pInputText [(ngModel)]="appearance.tagline" class="w-full" (ngModelChange)="liveUpdate()"/></div>
            </div>
            <div class="bp-app-section">
              <h3 class="bp-app-title">Terminology</h3>
              <div class="grid grid-cols-2 gap-4">
                <div class="bp-field"><label class="bp-label">Projects are called</label><input pInputText [(ngModel)]="appearance.projectLabel" class="w-full" (ngModelChange)="liveUpdate()"/></div>
                <div class="bp-field"><label class="bp-label">Credits are called</label><input pInputText [(ngModel)]="appearance.creditLabel" class="w-full" (ngModelChange)="liveUpdate()"/></div>
              </div>
            </div>
            <div class="bp-app-section">
              <h3 class="bp-app-title">Colour Theme</h3>
              <div style="display:flex;gap:12px;margin-top:8px;">
                <button *ngFor="let t of themeNames" (click)="selectTheme(t)" class="bp-swatch" [style.background]="themePresets[t].accent" [class.bp-swatch-active]="appearance.themeName === t" [title]="t">
                  <span *ngIf="appearance.themeName === t" style="color:#fff;font-size:14px;">&#10003;</span>
                </button>
              </div>
            </div>
            <div class="bp-app-section">
              <h3 class="bp-app-title">Mode</h3>
              <div style="display:flex;gap:8px;margin-top:8px;">
                <button (click)="selectMode('light')" [class.bp-mode-active]="appearance.mode==='light'" class="bp-mode-option">&#x2600;&#xFE0F; Light</button>
                <button (click)="selectMode('dark')" [class.bp-mode-active]="appearance.mode==='dark'" class="bp-mode-option">&#x263E; Dark</button>
                <button (click)="selectMode('system')" [class.bp-mode-active]="appearance.mode==='system'" class="bp-mode-option">&#x1F4BB; System</button>
              </div>
            </div>
            <div class="bp-app-section">
              <h3 class="bp-app-title">Hero Banner</h3>
              <label class="bp-label" style="margin-top:8px;">Alignment</label>
              <div style="display:flex;gap:8px;margin-top:4px;margin-bottom:12px;">
                <button (click)="setHeroAlign('left')" [class.bp-mode-active]="appearance.heroAlign!=='center'" class="bp-mode-option">&#x2B05; Left</button>
                <button (click)="setHeroAlign('center')" [class.bp-mode-active]="appearance.heroAlign==='center'" class="bp-mode-option">&#x2194;&#xFE0F; Centre</button>
              </div>
              <label class="bp-label">Components</label>
              <div class="bp-toggle-list">
                <div class="bp-toggle-row"><span>Org name</span><span class="bp-toggle-disabled">Always on</span></div>
                <div class="bp-toggle-row"><span>User name &amp; role</span><label class="bp-switch"><input type="checkbox" [(ngModel)]="appearance.showUserName" (ngModelChange)="liveUpdate()"><span class="bp-switch-slider"></span></label></div>
                <div class="bp-toggle-row"><span>Location pill</span><label class="bp-switch"><input type="checkbox" [(ngModel)]="appearance.showLocation" (ngModelChange)="liveUpdate()"><span class="bp-switch-slider"></span></label></div>
                <div class="bp-toggle-row"><span>Upcoming events pill</span><label class="bp-switch"><input type="checkbox" [(ngModel)]="appearance.showUpcoming" (ngModelChange)="liveUpdate()"><span class="bp-switch-slider"></span></label></div>
                <div class="bp-toggle-row"><span>Stats bar</span><label class="bp-switch"><input type="checkbox" [(ngModel)]="appearance.showStats" (ngModelChange)="liveUpdate()"><span class="bp-switch-slider"></span></label></div>
              </div>
            </div>
            <button (click)="saveAppearance()" class="btn-primary" style="width:100%;justify-content:center;"><lucide-icon name="save" [size]="14"></lucide-icon> Save Appearance</button>
          </div>

          <!-- LIVE PREVIEW -->
          <div style="border:0.5px solid var(--color-border);border-radius:10px;overflow:hidden;font-size:9px;height:fit-content;">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:0 12px;height:28px;border-bottom:0.5px solid var(--color-border);background:var(--color-surface);">
              <div style="display:flex;align-items:baseline;">
                <span style="font-family:var(--font-display);font-size:10px;color:var(--color-text-primary);">{{ previewLogoFirst }}</span>
                <span style="font-family:var(--font-display);font-size:10px;" [style.color]="previewAccent">{{ previewLogoSecond }}</span>
                <span style="font-size:6px;color:var(--color-text-muted);margin-left:4px;text-transform:uppercase;letter-spacing:0.05em;">{{ appearance.tagline }}</span>
              </div>
              <span [style.background]="previewBg" [style.color]="previewText" style="font-size:7px;font-weight:600;padding:2px 6px;border-radius:10px;">3 {{ appearance.creditLabel }}s</span>
            </div>
            <div [style.background]="previewBg" [style.text-align]="appearance.heroAlign==='center'?'center':'left'" style="padding:12px;border-bottom:0.5px solid var(--color-border);">
              <div style="font-family:var(--font-display);font-size:20px;color:var(--color-text-primary);letter-spacing:-0.02em;line-height:1.1;margin-bottom:3px;">Anchor Events</div>
              <div *ngIf="appearance.showUserName" style="font-size:8px;color:var(--color-text-muted);">Jamie Hollis &middot; Agency account</div>
            </div>
            <div *ngIf="appearance.showStats" style="display:grid;grid-template-columns:repeat(3,1fr);border-bottom:0.5px solid var(--color-border);background:var(--color-surface);">
              <div style="padding:6px 8px;border-right:0.5px solid var(--color-border);"><div [style.color]="previewAccent" style="font-size:6px;font-weight:600;text-transform:uppercase;">{{ appearance.creditLabel }}s</div><div style="font-size:14px;font-weight:700;color:var(--color-text-primary);">3</div></div>
              <div style="padding:6px 8px;border-right:0.5px solid var(--color-border);"><div style="font-size:6px;font-weight:600;text-transform:uppercase;color:var(--color-text-muted);">Active</div><div style="font-size:14px;font-weight:700;color:var(--color-text-primary);">1</div></div>
              <div style="padding:6px 8px;"><div style="font-size:6px;font-weight:600;text-transform:uppercase;color:var(--color-text-muted);">Suppliers</div><div style="font-size:14px;font-weight:700;color:var(--color-text-primary);">8</div></div>
            </div>
            <div style="padding:10px;">
              <div style="background:var(--color-surface);border:0.5px solid var(--color-border);border-radius:6px;padding:8px 10px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                  <span style="font-weight:600;color:var(--color-text-primary);">Sample {{ appearance.projectLabel }}</span>
                  <span [style.background]="previewBg" [style.color]="previewText" style="font-size:7px;font-weight:600;padding:2px 6px;border-radius:10px;">Active</span>
                </div>
                <div style="color:var(--color-text-muted);">Client &middot; Jun 2026</div>
              </div>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
    <p-toast></p-toast>
  `,
  styles: [`
    .bp-hero {
      background: var(--theme-bg); padding: 32px var(--section-pad) 0;
      border-bottom: 0.5px solid var(--theme-border); text-align: center;
    }
    .bp-hero-org-name {
      font-family: var(--font-display); font-size: 36px; font-weight: 400;
      color: var(--color-text-primary); letter-spacing: -0.02em; line-height: 1.1; margin-bottom: 6px;
    }
    .bp-hero-page-label {
      font-family: var(--font-body); font-size: 11px; font-weight: 500;
      color: var(--color-text-muted); text-transform: uppercase;
      letter-spacing: 0.1em; margin-bottom: 20px;
    }
    .bp-hero-tabs { display: flex; justify-content: center; gap: 0; }
    .bp-hero-tab {
      padding: 10px 20px; font-size: var(--text-sm); font-weight: 500;
      color: var(--color-text-muted); background: none; border: none;
      border-bottom: 2px solid transparent; cursor: pointer; transition: all 0.15s;
    }
    .bp-hero-tab:hover { color: var(--color-text-primary); }
    .bp-hero-tab.active { color: var(--theme-accent); border-bottom-color: var(--theme-accent); }
    .bp-content { padding: var(--section-pad); }
    .bp-label { display: block; font-size: var(--text-sm); font-weight: 500; color: var(--color-text-secondary); margin-bottom: 4px; }
    .bp-muted-text { font-size: var(--text-sm); color: var(--color-text-muted); }
    .bp-avatar-sm { width: 32px; height: 32px; border-radius: 50%; background: var(--theme-bg); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: var(--theme-text); }
    .bp-pill { font-size: 10px; font-weight: 600; padding: 3px 10px; border-radius: 20px; background: var(--theme-bg); color: var(--theme-text); }
    .bp-logo-preview { width: 60px; height: 60px; border-radius: 8px; border: 0.5px solid var(--color-border); display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .bp-logo-placeholder { width: 60px; height: 60px; border-radius: 8px; border: 0.5px solid var(--color-border); background: var(--theme-bg); display: flex; align-items: center; justify-content: center; font-size: var(--text-sm); color: var(--color-text-muted); }
    .btn-primary {
      background: var(--theme-bg); color: var(--theme-text); border: 0.5px solid var(--theme-border);
      border-radius: 6px; padding: 10px 20px; font-weight: 600; font-size: var(--text-md);
      font-family: var(--font-body); cursor: pointer; transition: all 0.2s ease;
      display: inline-flex; align-items: center; gap: 6px; text-decoration: none;
    }
    .btn-primary:hover { background: var(--theme-accent); color: #ffffff; }
    .btn-primary:disabled { background: #F5F5F5; color: #bbb; border-color: #eee; cursor: default; }
    .bp-app-section { margin-bottom: 24px; padding-bottom: 20px; border-bottom: 0.5px solid var(--color-border); }
    .bp-app-title { font-size: var(--text-md); font-weight: 600; color: var(--color-text-primary); margin-bottom: 12px; }
    .bp-field { margin-bottom: 12px; }
    .bp-swatch { width: 40px; height: 40px; border-radius: 50%; cursor: pointer; border: 3px solid transparent; transition: all 0.15s; display: flex; align-items: center; justify-content: center; }
    .bp-swatch-active { border-color: #111 !important; box-shadow: 0 0 0 2px #fff, 0 0 0 4px #111; }
    .bp-mode-option { padding: 6px 14px; border-radius: 6px; font-size: var(--text-sm); font-weight: 500; border: 0.5px solid var(--color-border); background: var(--color-surface); color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s; }
    .bp-mode-option.bp-mode-active { background: var(--color-black); color: #fff; border-color: var(--color-black); }
    .bp-toggle-list { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
    .bp-toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; font-size: var(--text-sm); color: var(--color-text-primary); }
    .bp-toggle-disabled { font-size: var(--text-xs); color: var(--color-text-muted); font-style: italic; }
    .bp-switch { position: relative; display: inline-block; width: 36px; height: 20px; }
    .bp-switch input { opacity: 0; width: 0; height: 0; }
    .bp-switch-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: var(--color-border); border-radius: 20px; transition: 0.2s; }
    .bp-switch-slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.2s; }
    .bp-switch input:checked + .bp-switch-slider { background: var(--theme-accent); }
    .bp-switch input:checked + .bp-switch-slider:before { transform: translateX(16px); }
  `]
})
export class SettingsComponent implements OnInit {
  org: Org | null = null;
  users: User[] = [];
  categories: Category[] = [];
  loading = true;
  saving = false;
  form = { name: '', address: '', vat: 20, margin: 20, contingency: 5 };
  readonly icons = { Building2, Users, Layers, CreditCard, Palette, Upload, Save };
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

  constructor(private orgSvc: OrgService, private catSvc: CategoryService, private configService: ConfigService, private msg: MessageService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    const current = this.configService.current as any;
    this.appearance = { ...this.appearance, ...current, heroAlign: current.heroAlign || 'center', showUserName: current.showUserName !== false, showLocation: current.showLocation !== false, showUpcoming: current.showUpcoming !== false, showStats: current.showStats !== false };
    this.logoPreview = this.configService.logoUrl;
    this.previewUpdate();

    Promise.all([this.orgSvc.getCurrentOrg().toPromise(), this.orgSvc.getUsers().toPromise(), this.catSvc.getAll().toPromise()])
      .then(([org, users, cats]) => {
        this.org = org || null;
        if (org) this.form = { name: org.name, address: org.address || '', vat: +org.default_vat_pct || 20, margin: +org.default_margin_pct || 20, contingency: +org.default_contingency_pct || 5 };
        this.users = users || [];
        this.categories = cats || [];
        this.loading = false;
        this.cdr.detectChanges();
      }).catch(() => { this.loading = false; this.cdr.detectChanges(); });
  }

  save() {
    this.saving = true;
    this.orgSvc.updateCurrentOrg({ name: this.form.name, address: this.form.address, default_vat_pct: this.form.vat, default_margin_pct: this.form.margin, default_contingency_pct: this.form.contingency }).subscribe({
      next: () => { this.saving = false; this.msg.add({ severity: 'success', summary: 'Saved' }); },
      error: () => { this.saving = false; this.msg.add({ severity: 'error', summary: 'Error' }); }
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
    reader.onload = () => { this.logoPreview = reader.result as string; this.configService.update({ logoUrl: this.logoPreview }); this.msg.add({ severity: 'success', summary: 'Logo uploaded' }); };
    reader.readAsDataURL(file);
  }

  removeLogo() { this.logoPreview = ''; this.configService.update({ logoUrl: '' }); this.msg.add({ severity: 'info', summary: 'Logo removed' }); }

  saveAppearance() { this.configService.update(this.appearance as any); this.msg.add({ severity: 'success', summary: 'Appearance saved' }); }
}
