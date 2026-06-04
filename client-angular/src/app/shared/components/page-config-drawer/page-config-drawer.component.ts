// v1.65hJ (p0017) — Shared <app-page-config-drawer> standalone
// component. Container migration of p0016's page-config-strip into a
// proper p-sidebar drawer per the WORKING_STANDARDS Drawer Standard.
//
// Why drawer over strip:
// - The strip was one horizontal row, fighting for space.
// - The next round of work (section-visibility toggles for Quick
//   Actions / Active Events / Credits / Saved Suppliers / Recent
//   Activity on top of the existing User/Location/Upcoming/Stats)
//   would push the row to ~9 toggles — cramped and overflowing.
// - Drawer scrolls, doesn't compete with content, matches every other
//   "configure this" surface (event drawer, estimate drawer, cart
//   drawer).
//
// Wiring:
// - Page mounts <app-page-config-drawer /> once. ngOnInit calls
//   ConfigStripService.register() which flips hasConfig$=true so the
//   top-nav cog appears.
// - Cog click → ConfigStripService.toggle() flips open$. The drawer
//   subscribes to open$ for its [visible] binding.
// - Drawer X (or backdrop click) → (visibleChange)=false →
//   ConfigStripService.setOpen(false).
// - ngOnDestroy → unregister() → cog disappears + drawer auto-closes.
//
// State + handlers (theme, labels, hero align, nav mode, component
// visibility) are unchanged from p0016's strip — they still write to
// the ConfigService singleton on change, so toggling propagates to
// the rest of the app immediately and any other consumer of the
// drawer / config gets the same value.

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { SidebarModule } from 'primeng/sidebar';
import { CheckboxModule } from 'primeng/checkbox';
import { DropdownModule } from 'primeng/dropdown';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ConfigService } from '../../../core/services/config.service';
import { ConfigStripService } from '../../../core/services/config-strip.service';

@Component({
  selector: 'app-page-config-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, InputTextModule, SidebarModule, CheckboxModule, DropdownModule],
  template: `
    <p-sidebar [(visible)]="visible"
               (visibleChange)="onVisibleChange($event)"
               position="right"
               styleClass="bp-drawer"
               [style]="{width:'480px'}"
               [showCloseIcon]="false"
               [dismissible]="true">
      <ng-template pTemplate="header">
        <div class="bp-drawer-header-row">
          <div class="bp-drawer-header">
            <span class="bp-drawer-label">CUSTOMISE</span>
            <div class="bp-drawer-title">Page settings</div>
          </div>
          <button type="button" class="bp-icon-btn" (click)="close()" aria-label="Close">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </ng-template>

      <div class="bp-drawer-body bp-pcd-body">

        <!-- p0032 — two tabs replace the four legacy sub-eyebrow groups.
             Dashboard = settings for THIS page; General = app-wide hero /
             site preferences. Default Dashboard; remembered in state. -->
        <div class="bp-cfg-seg bp-pcd-tabs">
          <button type="button" class="bp-cfg-seg-btn"
                  [class.p-highlight]="activeDrawerTab === 'dashboard'"
                  (click)="activeDrawerTab = 'dashboard'">Dashboard</button>
          <button type="button" class="bp-cfg-seg-btn"
                  [class.p-highlight]="activeDrawerTab === 'general'"
                  (click)="activeDrawerTab = 'general'">General</button>
        </div>

        <!-- ── DASHBOARD TAB — customises this page only ── -->
        <div class="bp-pcd-group" *ngIf="activeDrawerTab === 'dashboard'">
          <!-- Title source for the dashboard hero (p0023 heroTitleMode). -->
          <div class="bp-pcd-field">
            <label class="bp-pcd-field-label">Title</label>
            <p-dropdown styleClass="bp-pcd-dropdown"
                        [options]="heroTitleOptions"
                        optionLabel="label"
                        optionValue="value"
                        [appendTo]="'body'"
                        [(ngModel)]="settingsDraft.heroTitleMode"
                        (onChange)="onHeroTitleModeChange($event.value)">
            </p-dropdown>
          </div>

          <!-- Subtitle — the small-caps eyebrow (writes homePageLabel). -->
          <div class="bp-pcd-field">
            <label class="bp-pcd-field-label">Subtitle</label>
            <input pInputText
                   class="bp-pcd-input"
                   [(ngModel)]="settingsDraft.homePageLabel"
                   (blur)="saveLabels()"
                   placeholder="Projects"/>
          </div>

          <!-- Section visibility for the dashboard body. -->
          <label class="bp-pcd-check-row">
            <p-checkbox [(ngModel)]="settingsDraft.showUpcoming"
                        [binary]="true"
                        (ngModelChange)="saveToggles()"></p-checkbox>
            <span class="bp-pcd-check-label">Upcoming</span>
          </label>
          <label class="bp-pcd-check-row">
            <p-checkbox [(ngModel)]="settingsDraft.showStats"
                        [binary]="true"
                        (ngModelChange)="saveToggles()"></p-checkbox>
            <span class="bp-pcd-check-label">Stats</span>
          </label>
          <label class="bp-pcd-check-row">
            <p-checkbox [(ngModel)]="settingsDraft.showQuickActions"
                        [binary]="true"
                        (ngModelChange)="saveToggles()"></p-checkbox>
            <span class="bp-pcd-check-label">Quick Actions</span>
          </label>
          <label class="bp-pcd-check-row">
            <p-checkbox [(ngModel)]="settingsDraft.showCredits"
                        [binary]="true"
                        (ngModelChange)="saveToggles()"></p-checkbox>
            <span class="bp-pcd-check-label">{{ settingsDraft.creditLabel }}s card</span>
          </label>
          <label class="bp-pcd-check-row">
            <p-checkbox [(ngModel)]="settingsDraft.showSavedSuppliers"
                        [binary]="true"
                        (ngModelChange)="saveToggles()"></p-checkbox>
            <span class="bp-pcd-check-label">Saved Suppliers</span>
          </label>
          <label class="bp-pcd-check-row">
            <p-checkbox [(ngModel)]="settingsDraft.showRecentActivity"
                        [binary]="true"
                        (ngModelChange)="saveToggles()"></p-checkbox>
            <span class="bp-pcd-check-label">Recent Activity</span>
          </label>
        </div>

        <!-- ── GENERAL TAB — app-wide hero / site preferences ── -->
        <div class="bp-pcd-group" *ngIf="activeDrawerTab === 'general'">
          <div class="bp-pcd-field">
            <label class="bp-pcd-field-label">Theme</label>
            <div class="bp-cfg-swatches-row">
              <button *ngFor="let t of themeOptions"
                      type="button"
                      class="bp-cfg-swatch-btn"
                      [class.active]="settingsDraft.themeName === t.value"
                      [style.background]="t.color"
                      [title]="t.label"
                      (click)="onThemeChange(t.value)">
              </button>
            </div>
          </div>

          <!-- p0032 — Hero color now applies to EVERY hero in the app
               (global ConfigService read). Theme = accent fill, None =
               calm parchment. -->
          <div class="bp-pcd-field">
            <label class="bp-pcd-field-label">Hero color</label>
            <div class="bp-cfg-seg">
              <button *ngFor="let opt of heroColorOptions"
                      type="button"
                      class="bp-cfg-seg-btn"
                      [class.p-highlight]="settingsDraft.heroColor === opt.value"
                      (click)="selectHeroColor(opt.value)">
                {{ opt.label }}
              </button>
            </div>
          </div>

          <div class="bp-pcd-field">
            <label class="bp-pcd-field-label">Hero align</label>
            <div class="bp-cfg-seg">
              <button *ngFor="let opt of alignOptions"
                      type="button"
                      class="bp-cfg-seg-btn"
                      [class.p-highlight]="settingsDraft.heroAlign === opt.value"
                      (click)="selectHeroAlign(opt.value)">
                {{ opt.label }}
              </button>
            </div>
          </div>

          <div class="bp-pcd-field">
            <label class="bp-pcd-field-label">Navigation</label>
            <div class="bp-cfg-seg">
              <button *ngFor="let opt of navOptions"
                      type="button"
                      class="bp-cfg-seg-btn"
                      [class.p-highlight]="settingsDraft.navMode === opt.value"
                      (click)="selectNavMode(opt.value)">
                {{ opt.label }}
              </button>
            </div>
          </div>

          <!-- Hero meta chips (gate the AppShell user / location pills). -->
          <label class="bp-pcd-check-row">
            <p-checkbox [(ngModel)]="settingsDraft.showUserName"
                        [binary]="true"
                        (ngModelChange)="saveToggles()"></p-checkbox>
            <span class="bp-pcd-check-label">User name</span>
          </label>
          <label class="bp-pcd-check-row">
            <p-checkbox [(ngModel)]="settingsDraft.showLocation"
                        [binary]="true"
                        (ngModelChange)="saveToggles()"></p-checkbox>
            <span class="bp-pcd-check-label">Location</span>
          </label>

          <!-- App-wide object labels. -->
          <div class="bp-pcd-field">
            <label class="bp-pcd-field-label">Credits label</label>
            <input pInputText
                   class="bp-pcd-input"
                   [(ngModel)]="settingsDraft.creditLabel"
                   (blur)="saveLabels()"
                   placeholder="Balls"/>
          </div>

          <div class="bp-pcd-field">
            <label class="bp-pcd-field-label">Events label</label>
            <input pInputText
                   class="bp-pcd-input"
                   [(ngModel)]="settingsDraft.projectLabel"
                   (blur)="saveLabels()"
                   placeholder="Events"/>
          </div>
        </div>

      </div>
    </p-sidebar>
  `,
  styles: [`
    /* p0032 — drawer body = the tab strip + the one active panel. */
    .bp-pcd-body {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .bp-pcd-group {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    /* Two-tab segmented control — full width, equal halves, a touch
       taller than the inline bp-cfg-seg controls so it reads as a tab
       strip at the top of the drawer. */
    .bp-pcd-tabs { display: flex; width: 100%; }
    .bp-pcd-tabs .bp-cfg-seg-btn { flex: 1; height: 34px; font-size: 13px; }

    /* Field row — label sits above the control so the drawer reads as
       a vertical list (the strip's inline label-then-input pattern
       doesn't fit a narrow 480px column). */
    .bp-pcd-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .bp-pcd-field-label {
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 500;
      color: var(--color-text-secondary);
      letter-spacing: 0.02em;
    }

    /* Drawer body input — wider than the strip's compact inline input.
       Heights + radii follow the canonical .bp-input-edit metric so it
       matches every other form field in the app (event drawer, etc.). */
    :host ::ng-deep .bp-pcd-input.p-inputtext {
      width: 100%;
      height: 34px;
      padding: 0 10px;
      font-size: 13px;
      font-family: var(--font-body);
      color: var(--color-text-primary);
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      border-radius: 6px;
      box-shadow: none;
    }
    :host ::ng-deep .bp-pcd-input.p-inputtext:focus {
      border-color: var(--theme-accent);
      box-shadow: 0 0 0 1px var(--theme-accent);
      outline: none;
    }

    /* p0023 — Title dropdown. Matches the .bp-pcd-input metric (full
       width, 34px, 6px radius) so it sits in the field list like the
       text inputs. Panel is appendTo body — PrimeNG's themed panel
       styling applies there; --primary-color (= --theme-accent) drives
       the highlighted option. */
    :host ::ng-deep .bp-pcd-dropdown.p-dropdown {
      width: 100%;
      height: 34px;
      display: inline-flex;
      align-items: center;
      background: var(--color-surface);
      border: 0.5px solid var(--color-border);
      border-radius: 6px;
      box-shadow: none;
    }
    :host ::ng-deep .bp-pcd-dropdown.p-dropdown:not(.p-disabled).p-focus {
      border-color: var(--theme-accent);
      box-shadow: 0 0 0 1px var(--theme-accent);
      outline: none;
    }
    :host ::ng-deep .bp-pcd-dropdown .p-dropdown-label {
      padding: 0 10px;
      font-size: 13px;
      font-family: var(--font-body);
      color: var(--color-text-primary);
      display: flex;
      align-items: center;
    }
    :host ::ng-deep .bp-pcd-dropdown .p-dropdown-trigger {
      width: 32px;
      color: var(--color-text-muted);
    }

    /* p0018 — checkbox list (HERO + SECTIONS groups). Each row is a
       32px-high <label> wrapping a p-checkbox + text, so clicking
       anywhere on the row toggles the box (the input lives inside the
       label). The accent fill on check comes from the global
       --primary-color → --theme-accent mapping in styles.css. */
    .bp-pcd-check-row {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 32px;
      cursor: pointer;
      user-select: none;
    }
    .bp-pcd-check-label {
      font-family: var(--font-body);
      font-size: 14px;
      color: var(--color-text-primary);
    }

    /* Strip control primitives — copied verbatim from
       page-config-strip.component.ts (now deleted) since they're not in
       global styles.css. Used inside the drawer body for the theme
       swatches + segmented align/nav/components rows. Plain selectors
       (not :host scoped) — the p-sidebar content portal would otherwise
       lose them. */
    .bp-cfg-swatches-row { display: inline-flex; gap: 8px; }
    .bp-cfg-swatch-btn {
      width: 22px; height: 22px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      padding: 0;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .bp-cfg-swatch-btn:hover { transform: scale(1.1); }
    .bp-cfg-swatch-btn.active {
      box-shadow:
        0 0 0 2px var(--color-surface),
        0 0 0 3.5px var(--color-text-primary);
    }
    .bp-cfg-seg {
      display: inline-flex;
      border: 0.5px solid var(--color-border);
      border-radius: 6px;
      overflow: hidden;
    }
    .bp-cfg-seg-btn {
      padding: 4px 12px;
      height: 28px;
      font-size: 12px;
      font-weight: 500;
      background: var(--color-surface);
      color: var(--color-text-secondary);
      border: none;
      border-left: 0.5px solid var(--color-border);
      cursor: pointer;
      font-family: var(--font-body);
      transition: background 0.15s, color 0.15s;
    }
    .bp-cfg-seg-btn:first-child { border-left: none; }
    .bp-cfg-seg-btn:hover:not(:disabled):not(.p-highlight) {
      background: var(--theme-bg);
      color: var(--theme-accent);
    }
    .bp-cfg-seg-btn.p-highlight {
      background: var(--theme-accent);
      color: var(--color-surface);
      font-weight: 600;
    }
    .bp-cfg-seg-btn:disabled {
      cursor: not-allowed;
      opacity: 0.85;
    }
    .bp-cfg-seg-btn:disabled.p-highlight {
      opacity: 1;
    }

    /* Close icon button — drawer headers use the .bp-icon-btn primitive
       (defined globally in styles.css). Nothing to override locally. */
  `],
})
export class PageConfigDrawerComponent implements OnInit, OnDestroy {
  /** Two-way bound to <p-sidebar>. Mirrors ConfigStripService.open$.
      Writes flow through onVisibleChange() so the service stays
      authoritative — every other consumer of open$ (top-nav cog
      animation, for instance) sees the same value. */
  visible = false;

  /** p0032 — active drawer tab. Default Dashboard; persists across
      open/close within the session (the drawer mounts once per page). */
  activeDrawerTab: 'dashboard' | 'general' = 'dashboard';

  private destroy$ = new Subject<void>();

  /** Draft copy of the configurable fields; saved back to ConfigService
      on blur / change. Mirrored from ConfigService.config$ so changes
      from anywhere else (settings sub-tree, another tab via storage
      event) reflect here without a reload. */
  settingsDraft: {
    homePageLabel: string;
    creditLabel: string;
    projectLabel: string;
    themeName: string;
    heroAlign: 'left' | 'center';
    navMode: 'tabs' | 'sidenav';
    // p0023 — hero customisation.
    heroTitleMode: 'org' | 'user' | 'greeting';
    heroColor: 'theme' | 'none';
    showUserName: boolean;
    showLocation: boolean;
    showUpcoming: boolean;
    showStats: boolean;
    // p0018 — dashboard body sections.
    showQuickActions: boolean;
    showCredits: boolean;
    showSavedSuppliers: boolean;
    showRecentActivity: boolean;
  } = {
    homePageLabel: 'Projects',
    creditLabel: 'Ball',
    projectLabel: 'Event',
    themeName: 'amber',
    heroAlign: 'center',
    navMode: 'tabs',
    heroTitleMode: 'greeting',
    heroColor: 'none',
    showUserName: true,
    showLocation: true,
    showUpcoming: true,
    showStats: true,
    showQuickActions: true,
    showCredits: true,
    showSavedSuppliers: true,
    showRecentActivity: true,
  };

  /** Theme dot swatches — values match ConfigService.THEME_PRESETS keys. */
  readonly themeOptions = [
    { value: 'amber',   label: 'Amber',   color: '#D97706' },
    { value: 'emerald', label: 'Emerald', color: '#00B84A' },
    { value: 'pink',    label: 'Pink',    color: '#FF0066' },
    { value: 'ocean',   label: 'Ocean',   color: '#2563EB' },
    { value: 'slate',   label: 'Slate',   color: '#64748B' },
  ];

  /** p0023 — hero title source (GENERAL dropdown). */
  readonly heroTitleOptions: Array<{ value: 'org' | 'user' | 'greeting'; label: string }> = [
    { value: 'org',      label: 'Org Name' },
    { value: 'user',     label: 'Username' },
    { value: 'greeting', label: 'Greeting' },
  ];

  /** p0023 — hero strip treatment (APPEARANCE segmented). */
  readonly heroColorOptions: Array<{ value: 'theme' | 'none'; label: string }> = [
    { value: 'theme', label: 'Theme' },
    { value: 'none',  label: 'None' },
  ];

  /** Hero alignment — single-pick segmented group. */
  readonly alignOptions: Array<{ value: 'left' | 'center'; label: string }> = [
    { value: 'left',   label: 'Left' },
    { value: 'center', label: 'Centre' },
  ];

  /** Nav mode — single-pick segmented group. */
  readonly navOptions: Array<{ value: 'tabs' | 'sidenav'; label: string }> = [
    { value: 'tabs',    label: 'Tabs' },
    { value: 'sidenav', label: 'Menu' },
  ];

  constructor(
    private configService: ConfigService,
    private configStripSvc: ConfigStripService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    // Mount-side: tell the service we exist so the top-nav cog appears.
    // The service's mountedCount tracks how many hosts have registered
    // — increments here, decrements in ngOnDestroy. hasConfig$ flips
    // true when mountedCount > 0.
    this.configStripSvc.register();

    // Keep the draft mirrored to the canonical config so changes made
    // elsewhere reflect here without a reload.
    this.configService.config$
      .pipe(takeUntil(this.destroy$))
      .subscribe(cfg => {
        this.settingsDraft = {
          homePageLabel: cfg.homePageLabel || 'Projects',
          creditLabel:   cfg.creditLabel   || 'Ball',
          projectLabel:  cfg.projectLabel  || 'Event',
          themeName:     cfg.themeName     || 'amber',
          heroAlign:     (cfg.heroAlign === 'left' ? 'left' : 'center'),
          navMode:       (cfg.navMode === 'sidenav' ? 'sidenav' : 'tabs'),
          // p0023 — hero customisation (default greeting / none).
          heroTitleMode: (cfg.heroTitleMode === 'org' || cfg.heroTitleMode === 'user' ? cfg.heroTitleMode : 'greeting'),
          heroColor:     (cfg.heroColor === 'theme' ? 'theme' : 'none'),
          showUserName:  cfg.showUserName  !== false,
          showLocation:  cfg.showLocation  !== false,
          // p0018 — all section flags default visible (!== false) so a
          // saved config missing the key reads as ticked.
          showUpcoming:       cfg.showUpcoming       !== false,
          showStats:          cfg.showStats          !== false,
          showQuickActions:   cfg.showQuickActions   !== false,
          showCredits:        cfg.showCredits        !== false,
          showSavedSuppliers: cfg.showSavedSuppliers !== false,
          showRecentActivity: cfg.showRecentActivity !== false,
        };
        this.cdr.markForCheck();
      });

    // Bind visibility to the shared open$ signal so the top-nav cog
    // toggle() reaches the drawer.
    this.configStripSvc.open$
      .pipe(takeUntil(this.destroy$))
      .subscribe(open => {
        if (this.visible !== open) {
          this.visible = open;
          this.cdr.markForCheck();
        }
      });
  }

  ngOnDestroy() {
    // Unregister so the cog disappears on the next page (if that page
    // has no drawer / strip). The service force-closes when mounted-
    // Count drops to zero.
    this.configStripSvc.unregister();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Two-way binding sink — fires when PrimeNG closes the sidebar
      (clicking X, the backdrop, or hitting ESC). Funnel the new value
      back through the service so every other subscriber stays in sync. */
  onVisibleChange(open: boolean) {
    if (open !== this.configStripSvc.isOpen) {
      this.configStripSvc.setOpen(open);
    }
  }

  /** Explicit close from the header X. (visibleChange) also fires for
      backdrop / ESC, so this is just a convenience for the click
      handler. */
  close() {
    this.configStripSvc.setOpen(false);
  }

  /** Persist label changes (page / credits / events) on blur. */
  saveLabels() {
    this.configService.update({
      homePageLabel: this.settingsDraft.homePageLabel || 'Projects',
      creditLabel:   this.settingsDraft.creditLabel   || 'Ball',
      projectLabel:  this.settingsDraft.projectLabel  || 'Event',
    });
  }

  /** p0023 — hero title source (GENERAL dropdown). Save on change. */
  onHeroTitleModeChange(mode: 'org' | 'user' | 'greeting') {
    this.settingsDraft.heroTitleMode = mode;
    this.configService.update({ heroTitleMode: mode });
  }

  /** p0023 — hero strip treatment (APPEARANCE segmented). Save on change. */
  selectHeroColor(value: 'theme' | 'none') {
    this.settingsDraft.heroColor = value;
    this.configService.update({ heroColor: value });
  }

  onThemeChange(theme: string) {
    this.settingsDraft.themeName = theme;
    this.configService.update({ themeName: theme });
  }

  selectNavMode(mode: 'tabs' | 'sidenav') {
    this.settingsDraft.navMode = mode;
    this.configService.update({ navMode: mode });
  }

  selectHeroAlign(align: 'left' | 'center') {
    this.settingsDraft.heroAlign = align;
    this.configService.update({ heroAlign: align });
  }

  /** p0018 — persist all hero-meta + section visibility flags. Fired by
      every checkbox's (ngModelChange); the two-way [(ngModel)] has
      already mutated settingsDraft, so we just push the whole set to
      ConfigService (which spreads + saves + re-emits). */
  saveToggles() {
    this.configService.update({
      showUserName:       this.settingsDraft.showUserName,
      showLocation:       this.settingsDraft.showLocation,
      showUpcoming:       this.settingsDraft.showUpcoming,
      showStats:          this.settingsDraft.showStats,
      showQuickActions:   this.settingsDraft.showQuickActions,
      showCredits:        this.settingsDraft.showCredits,
      showSavedSuppliers: this.settingsDraft.showSavedSuppliers,
      showRecentActivity: this.settingsDraft.showRecentActivity,
    });
  }
}
