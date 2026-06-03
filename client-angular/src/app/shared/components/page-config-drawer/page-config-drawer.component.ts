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
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ConfigService } from '../../../core/services/config.service';
import { ConfigStripService } from '../../../core/services/config-strip.service';

@Component({
  selector: 'app-page-config-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, InputTextModule, SidebarModule],
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

        <!-- ── GENERAL ─────────────────────────────────────────── -->
        <section class="bp-pcd-group">
          <div class="bp-drawer-label bp-pcd-sub-eyebrow">GENERAL</div>

          <div class="bp-pcd-field">
            <label class="bp-pcd-field-label">Page label</label>
            <input pInputText
                   class="bp-pcd-input"
                   [(ngModel)]="settingsDraft.homePageLabel"
                   (blur)="saveLabels()"
                   placeholder="Projects"/>
          </div>

          <div class="bp-pcd-field">
            <label class="bp-pcd-field-label">Credits</label>
            <input pInputText
                   class="bp-pcd-input"
                   [(ngModel)]="settingsDraft.creditLabel"
                   (blur)="saveLabels()"
                   placeholder="Balls"/>
          </div>

          <div class="bp-pcd-field">
            <label class="bp-pcd-field-label">Events</label>
            <input pInputText
                   class="bp-pcd-input"
                   [(ngModel)]="settingsDraft.projectLabel"
                   (blur)="saveLabels()"
                   placeholder="Events"/>
          </div>
        </section>

        <!-- ── APPEARANCE ──────────────────────────────────────── -->
        <section class="bp-pcd-group">
          <div class="bp-drawer-label bp-pcd-sub-eyebrow">APPEARANCE</div>

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
        </section>

        <!-- ── SECTIONS ────────────────────────────────────────── -->
        <section class="bp-pcd-group">
          <div class="bp-drawer-label bp-pcd-sub-eyebrow">SECTIONS</div>
          <p class="bp-pcd-help">Show or hide hero meta + dashboard sections.</p>

          <div class="bp-cfg-seg bp-cfg-seg--multi bp-pcd-multi-wrap">
            <button *ngFor="let opt of componentOptions"
                    type="button"
                    class="bp-cfg-seg-btn"
                    [class.p-highlight]="isComponentActive(opt.value)"
                    [disabled]="opt.disabled"
                    [title]="opt.disabled ? opt.label + ' — always on' : opt.label"
                    (click)="toggleComponent(opt.value)">
              {{ opt.label }}
            </button>
          </div>
        </section>

      </div>
    </p-sidebar>
  `,
  styles: [`
    /* Drawer body grouping — stacked sections with a sub-eyebrow at the
       top of each. Sub-eyebrow uses the existing .bp-drawer-label small-
       caps treatment; we just add bottom spacing so the controls below
       breathe. */
    .bp-pcd-body {
      display: flex;
      flex-direction: column;
      gap: 28px;
    }
    .bp-pcd-group {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .bp-pcd-sub-eyebrow {
      /* Inherits .bp-drawer-label styling; only spacing override here. */
      margin-bottom: 2px;
    }

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
    .bp-pcd-help {
      margin: 0 0 4px 0;
      font-family: var(--font-body);
      font-size: 12px;
      color: var(--color-text-muted);
      line-height: 1.4;
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

    /* Multi-button row gets its own wrap context inside the drawer so
       longer label sets (the next prompt will add ~5 more options)
       flow gracefully into multiple lines. */
    .bp-pcd-multi-wrap {
      flex-wrap: wrap;
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
    .bp-cfg-seg.bp-cfg-seg--multi {
      display: inline-flex;
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
    showUserName: boolean;
    showLocation: boolean;
    showUpcoming: boolean;
    showStats: boolean;
  } = {
    homePageLabel: 'Projects',
    creditLabel: 'Ball',
    projectLabel: 'Event',
    themeName: 'amber',
    heroAlign: 'center',
    navMode: 'tabs',
    showUserName: true,
    showLocation: true,
    showUpcoming: false,
    showStats: true,
  };

  /** Theme dot swatches — values match ConfigService.THEME_PRESETS keys. */
  readonly themeOptions = [
    { value: 'amber',   label: 'Amber',   color: '#D97706' },
    { value: 'emerald', label: 'Emerald', color: '#00B84A' },
    { value: 'pink',    label: 'Pink',    color: '#FF0066' },
    { value: 'ocean',   label: 'Ocean',   color: '#2563EB' },
    { value: 'slate',   label: 'Slate',   color: '#64748B' },
  ];

  /** Component visibility toggles. Each pill is independent. The org
      pill was dropped (always-on, added visual noise). The next prompt
      adds Quick Actions / Active Events / Credits / Saved Suppliers /
      Recent Activity to this list — that's why the drawer migration
      happens FIRST. */
  readonly componentOptions: Array<{ value: string; label: string; disabled?: boolean }> = [
    { value: 'user',     label: 'User' },
    { value: 'location', label: 'Location' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'stats',    label: 'Stats' },
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
          showUserName:  cfg.showUserName  !== false,
          showLocation:  cfg.showLocation  !== false,
          showUpcoming:  cfg.showUpcoming  === true,
          showStats:     cfg.showStats     !== false,
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

  saveToggles() {
    this.configService.update({
      showUserName: this.settingsDraft.showUserName,
      showLocation: this.settingsDraft.showLocation,
      showUpcoming: this.settingsDraft.showUpcoming,
      showStats:    this.settingsDraft.showStats,
    });
  }

  isComponentActive(key: string): boolean {
    switch (key) {
      case 'org':      return true;
      case 'user':     return this.settingsDraft.showUserName;
      case 'location': return this.settingsDraft.showLocation;
      case 'upcoming': return this.settingsDraft.showUpcoming;
      case 'stats':    return this.settingsDraft.showStats;
      default:         return false;
    }
  }

  toggleComponent(key: string) {
    if (key === 'org') return;
    switch (key) {
      case 'user':     this.settingsDraft.showUserName = !this.settingsDraft.showUserName; break;
      case 'location': this.settingsDraft.showLocation = !this.settingsDraft.showLocation; break;
      case 'upcoming': this.settingsDraft.showUpcoming = !this.settingsDraft.showUpcoming; break;
      case 'stats':    this.settingsDraft.showStats    = !this.settingsDraft.showStats;    break;
      default: return;
    }
    this.saveToggles();
  }
}
