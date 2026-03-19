import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabViewModule } from 'primeng/tabview';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { OrgService } from '../../core/services/org.service';
import { CategoryService } from '../../core/services/category.service';
import { ConfigService, ThemePreset, PlatformConfig } from '../../core/services/config.service';
import { Org, User, Category } from '../../core/models';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TabViewModule, ButtonModule, InputTextModule, InputNumberModule, InputTextareaModule, ToastModule, LoadingSpinnerComponent],
  providers: [MessageService],
  template: `
    <div style="padding: var(--section-pad);">
    <app-loading *ngIf="loading"></app-loading>
    <div *ngIf="!loading">
      <h1 style="font-size: var(--text-2xl); font-weight: 600; color: var(--color-text-primary); margin-bottom: 6px;">Settings</h1>
      <p style="font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: 24px;">Manage your organisation settings, team and appearance</p>
      <p-tabView>

        <!-- ORGANISATION TAB -->
        <p-tabPanel header="Organisation">
          <div class="max-w-2xl mt-4 space-y-5">
            <div><label class="bp-label">Organisation Name</label><input pInputText [(ngModel)]="form.name" class="w-full"/></div>
            <div><label class="bp-label">Address</label><textarea pInputTextarea [(ngModel)]="form.address" [rows]="2" class="w-full"></textarea></div>
            <div class="grid grid-cols-3 gap-4">
              <div><label class="bp-label">Default VAT %</label><p-inputNumber [(ngModel)]="form.vat" suffix="%" styleClass="w-full"></p-inputNumber></div>
              <div><label class="bp-label">Default Margin %</label><p-inputNumber [(ngModel)]="form.margin" suffix="%" styleClass="w-full"></p-inputNumber></div>
              <div><label class="bp-label">Default Contingency %</label><p-inputNumber [(ngModel)]="form.contingency" suffix="%" styleClass="w-full"></p-inputNumber></div>
            </div>
            <p-button icon="pi pi-save" label="{{saving?'Saving...':'Save Changes'}}" [loading]="saving" (click)="save()"></p-button>
          </div>
        </p-tabPanel>

        <!-- TEAM TAB -->
        <p-tabPanel header="Team">
          <div class="mt-4">
            <p *ngIf="users.length===0" style="font-size: var(--text-sm); color: var(--color-text-muted);">No team members found.</p>
            <div *ngIf="users.length>0">
              <div *ngFor="let u of users" class="flex items-center justify-between py-3" style="border-bottom: 0.5px solid var(--color-border);">
                <div class="flex items-center gap-3">
                  <div style="width:32px;height:32px;border-radius:50%;background:var(--theme-bg);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:var(--theme-text);">
                    {{(u.name||'U').charAt(0).toUpperCase()}}
                  </div>
                  <div>
                    <p style="font-size:var(--text-md);font-weight:500;color:var(--color-text-primary);">{{u.name}}</p>
                    <p style="font-size:var(--text-sm);color:var(--color-text-muted);">{{u.email}}</p>
                  </div>
                </div>
                <span class="bp-badge bp-badge-active" style="text-transform:uppercase;">{{u.role}}</span>
              </div>
            </div>
          </div>
        </p-tabPanel>

        <!-- CATEGORIES TAB -->
        <p-tabPanel header="Categories">
          <div class="mt-4">
            <p *ngIf="categories.length===0" style="font-size: var(--text-sm); color: var(--color-text-muted);">No categories found.</p>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3" *ngIf="categories.length>0">
              <div *ngFor="let c of categories" class="flex items-center gap-2 px-3 py-2" style="background:var(--color-surface);border:0.5px solid var(--color-border);border-radius:8px;">
                <span style="color:var(--color-text-muted);">&#x1F3F7;</span>
                <span style="font-size:var(--text-md);font-weight:500;color:var(--color-text-primary);">{{c.name}}</span>
              </div>
            </div>
          </div>
        </p-tabPanel>

        <!-- SUBSCRIPTION TAB -->
        <p-tabPanel header="Subscription">
          <div class="mt-4" *ngIf="org">
            <div style="background:var(--color-surface);border:0.5px solid var(--color-border);border-radius:10px;padding:18px;max-width:400px;">
              <h2 style="font-size:var(--text-md);font-weight:600;color:var(--color-text-primary);margin-bottom:12px;">Current Plan</h2>
              <span class="bp-badge bp-badge-active" style="margin-bottom:12px;display:inline-block;text-transform:capitalize;">{{org.subscription_tier}}</span>
              <div style="font-size:var(--text-sm);color:var(--color-text-secondary);">
                <div class="flex justify-between py-1"><span>{{ appearance.creditLabel }}s Balance</span><span style="font-weight:600;color:var(--color-text-primary);">{{org.balls_balance}}</span></div>
                <div class="flex justify-between py-1"><span>Monthly Allowance</span><span style="font-weight:600;color:var(--color-text-primary);">{{org.balls_monthly_allowance}}</span></div>
              </div>
            </div>
          </div>
        </p-tabPanel>

        <!-- APPEARANCE TAB -->
        <p-tabPanel header="Appearance">
          <div class="mt-4" style="display:grid;grid-template-columns:1fr 360px;gap:32px;">
            <!-- Settings form -->
            <div style="max-width:480px;">
              <div style="margin-bottom:16px;">
                <label class="bp-label">Platform Name</label>
                <input pInputText [(ngModel)]="appearance.platformName" class="w-full" (ngModelChange)="previewUpdate()"/>
              </div>
              <div style="margin-bottom:16px;">
                <label class="bp-label">Tagline</label>
                <input pInputText [(ngModel)]="appearance.tagline" class="w-full" (ngModelChange)="previewUpdate()"/>
              </div>
              <div class="grid grid-cols-2 gap-4" style="margin-bottom:16px;">
                <div>
                  <label class="bp-label">Projects are called</label>
                  <input pInputText [(ngModel)]="appearance.projectLabel" class="w-full" (ngModelChange)="previewUpdate()"/>
                </div>
                <div>
                  <label class="bp-label">Credits are called</label>
                  <input pInputText [(ngModel)]="appearance.creditLabel" class="w-full" (ngModelChange)="previewUpdate()"/>
                </div>
              </div>

              <!-- Colour theme swatches -->
              <div style="margin-bottom:20px;">
                <label class="bp-label">Colour Theme</label>
                <div style="display:flex;gap:10px;margin-top:6px;">
                  <button *ngFor="let t of themeNames" (click)="selectTheme(t)"
                    [style.background]="themePresets[t].accent"
                    [style.border]="appearance.themeName === t ? '2px solid var(--color-text-primary)' : '2px solid transparent'"
                    style="width:36px;height:36px;border-radius:50%;cursor:pointer;transition:border-color 0.15s;"
                    [title]="t">
                  </button>
                </div>
              </div>

              <!-- Mode toggle -->
              <div style="margin-bottom:24px;">
                <label class="bp-label">Mode</label>
                <div style="display:flex;gap:8px;margin-top:6px;">
                  <button *ngFor="let m of ['light','dark','system']" (click)="selectMode(m)"
                    [class.bp-mode-active]="appearance.mode === m"
                    class="bp-mode-option">
                    {{ m === 'light' ? '\u2600\uFE0F Light' : m === 'dark' ? '\u263E Dark' : '\uD83D\uDCBB System' }}
                  </button>
                </div>
              </div>

              <button (click)="saveAppearance()" class="bp-save-btn">Save Appearance</button>
            </div>

            <!-- Live preview panel -->
            <div style="border:0.5px solid var(--color-border);border-radius:10px;overflow:hidden;font-size:9px;height:fit-content;">
              <!-- Preview nav -->
              <div style="display:flex;align-items:center;justify-content:space-between;padding:0 12px;height:28px;border-bottom:0.5px solid var(--color-border);background:var(--color-surface);">
                <div style="display:flex;align-items:baseline;">
                  <span style="font-family:var(--font-display);font-size:10px;color:var(--color-text-primary);">{{ previewLogoFirst }}</span>
                  <span style="font-family:var(--font-display);font-size:10px;" [style.color]="previewAccent">{{ previewLogoSecond }}</span>
                  <span style="font-size:6px;color:var(--color-text-muted);margin-left:4px;text-transform:uppercase;letter-spacing:0.05em;">{{ appearance.tagline }}</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="color:var(--color-text-muted);">Home</span>
                  <span [style.background]="previewBg" [style.color]="previewText" style="font-size:7px;font-weight:600;padding:2px 6px;border-radius:10px;">3 {{ appearance.creditLabel }}s</span>
                </div>
              </div>
              <!-- Preview hero -->
              <div [style.background]="previewBg" style="padding:12px;border-bottom:0.5px solid var(--color-border);">
                <div style="font-family:var(--font-display);font-size:20px;color:var(--color-text-primary);letter-spacing:-0.02em;line-height:1.1;margin-bottom:3px;">Anchor Events</div>
                <div style="font-size:8px;color:var(--color-text-muted);">Jamie Hollis \u00B7 Agency account</div>
              </div>
              <!-- Preview stats -->
              <div style="display:grid;grid-template-columns:repeat(3,1fr);border-bottom:0.5px solid var(--color-border);background:var(--color-surface);">
                <div style="padding:6px 8px;border-right:0.5px solid var(--color-border);">
                  <div [style.color]="previewAccent" style="font-size:6px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">{{ appearance.creditLabel }}s</div>
                  <div style="font-size:14px;font-weight:700;color:var(--color-text-primary);">3</div>
                </div>
                <div style="padding:6px 8px;border-right:0.5px solid var(--color-border);">
                  <div style="font-size:6px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--color-text-muted);">Active</div>
                  <div style="font-size:14px;font-weight:700;color:var(--color-text-primary);">1</div>
                </div>
                <div style="padding:6px 8px;">
                  <div style="font-size:6px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--color-text-muted);">Suppliers</div>
                  <div style="font-size:14px;font-weight:700;color:var(--color-text-primary);">8</div>
                </div>
              </div>
              <!-- Preview project card -->
              <div style="padding:10px;">
                <div style="background:var(--color-surface);border:0.5px solid var(--color-border);border-radius:6px;padding:8px 10px;">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                    <span style="font-weight:600;color:var(--color-text-primary);">Sample {{ appearance.projectLabel }}</span>
                    <span [style.background]="previewBg" [style.color]="previewText" style="font-size:7px;font-weight:600;padding:2px 6px;border-radius:10px;">Active</span>
                  </div>
                  <div style="color:var(--color-text-muted);">Client \u00B7 Jun 2026</div>
                </div>
              </div>
            </div>
          </div>
        </p-tabPanel>

      </p-tabView>
    </div>
    </div>
    <p-toast></p-toast>
  `,
  styles: [`
    .bp-label {
      display: block; font-size: var(--text-sm); font-weight: 500;
      color: var(--color-text-secondary); margin-bottom: 4px;
    }
    .bp-badge { font-size: 10px; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
    .bp-badge-active { background: var(--theme-bg); color: var(--theme-text); }
    .bp-mode-option {
      padding: 6px 14px; border-radius: 6px; font-size: var(--text-sm); font-weight: 500;
      border: 0.5px solid var(--color-border); background: var(--color-surface);
      color: var(--color-text-secondary); cursor: pointer; transition: all 0.15s;
    }
    .bp-mode-option.bp-mode-active {
      background: var(--color-black); color: #fff; border-color: var(--color-black);
    }
    .bp-save-btn {
      background: var(--color-black); color: #fff; border: none;
      padding: 10px 24px; border-radius: 8px; font-size: var(--text-md);
      font-weight: 600; cursor: pointer; font-family: var(--font-body);
      transition: background 0.2s;
    }
    .bp-save-btn:hover { background: var(--theme-accent); }
  `]
})
export class SettingsComponent implements OnInit {
  org: Org | null = null;
  users: User[] = [];
  categories: Category[] = [];
  loading = true;
  saving = false;
  form = { name: '', address: '', vat: 20, margin: 20, contingency: 5 };

  // Appearance
  appearance: PlatformConfig = {
    platformName: 'The Ballpark',
    tagline: 'Exhibition Costing',
    projectLabel: 'Event',
    creditLabel: 'Ball',
    themeName: 'amber',
    mode: 'system' as 'light' | 'dark' | 'system',
  };
  themePresets = ConfigService.THEME_PRESETS;
  themeNames = Object.keys(ConfigService.THEME_PRESETS);

  // Preview computed
  previewLogoFirst = 'The Ball';
  previewLogoSecond = 'park';
  previewAccent = '#D97706';
  previewBg = '#F5F0E8';
  previewText = '#92400E';

  constructor(
    private orgSvc: OrgService,
    private catSvc: CategoryService,
    private configService: ConfigService,
    private msg: MessageService,
  ) {}

  ngOnInit() {
    // Load current config
    this.appearance = { ...this.configService.current };
    this.previewUpdate();

    Promise.all([
      this.orgSvc.getCurrentOrg().toPromise(),
      this.orgSvc.getUsers().toPromise(),
      this.catSvc.getAll().toPromise(),
    ]).then(([org, users, cats]) => {
      this.org = org || null;
      if (org) this.form = { name: org.name, address: org.address || '', vat: +org.default_vat_pct || 20, margin: +org.default_margin_pct || 20, contingency: +org.default_contingency_pct || 5 };
      this.users = users || [];
      this.categories = cats || [];
      this.loading = false;
    }).catch(() => this.loading = false);
  }

  save() {
    this.saving = true;
    this.orgSvc.updateCurrentOrg({ name: this.form.name, address: this.form.address, default_vat_pct: this.form.vat, default_margin_pct: this.form.margin, default_contingency_pct: this.form.contingency }).subscribe({
      next: () => { this.saving = false; this.msg.add({ severity: 'success', summary: 'Saved' }); },
      error: () => { this.saving = false; this.msg.add({ severity: 'error', summary: 'Error' }); }
    });
  }

  selectTheme(name: string) {
    this.appearance.themeName = name;
    this.previewUpdate();
  }

  selectMode(mode: string) {
    this.appearance.mode = mode as 'light' | 'dark' | 'system';
  }

  previewUpdate() {
    const theme = this.themePresets[this.appearance.themeName] || this.themePresets['amber'];
    this.previewAccent = theme.accent;
    this.previewBg = theme.bg;
    this.previewText = theme.text;

    // Split logo name for preview
    const name = this.appearance.platformName;
    const mid = Math.ceil(name.length / 2);
    const spaceAfter = name.indexOf(' ', mid);
    const spaceBefore = name.lastIndexOf(' ', mid);
    let split = mid;
    if (spaceAfter !== -1 && spaceAfter <= mid + 4) split = spaceAfter;
    else if (spaceBefore > 0) split = spaceBefore;
    this.previewLogoFirst = name.slice(0, split).trimEnd();
    this.previewLogoSecond = name.slice(split).trimStart();
  }

  saveAppearance() {
    this.configService.update(this.appearance);
    this.msg.add({ severity: 'success', summary: 'Appearance saved', detail: 'Your branding has been updated.' });
  }
}
