// v1.65hG (p0016 Step 2) — Shared <app-page-config-strip> standalone
// component. Owns the full lifecycle of the admin page-settings strip
// that was previously duplicated between dashboard.component.ts (home)
// and agent.component.ts.
//
// Naming: the marketplace catalogue grid already has its own inline
// <app-config-strip> for browse settings (open/close + content-projection
// shell — a different concept). This component is the page-level
// settings strip: theme, labels, hero align, nav mode, component
// visibility — pushed into the AppShell's lifted slot via
// ConfigStripService.setTemplate(). The "page-" prefix disambiguates.
//
// Consumers mount it with a single tag — `<app-page-config-strip />` —
// and inherit the cog toggle, theme picker, labels, hero align, nav
// mode, and component visibility toggles for free. State syncs through
// the shared ConfigService singleton so toggling on one page is
// reflected on every other page that uses the strip.
//
// The template sits at the component ROOT (not inside any structural
// directive), so the ViewChild query resolves cleanly without the
// { static: true } / *ngIf race that bit dashboard pre-v1.65hG (see
// p0016 prompt for the full bug write-up).

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ConfigService } from '../../../core/services/config.service';
import { ConfigStripService } from '../../../core/services/config-strip.service';

@Component({
  selector: 'app-page-config-strip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, InputTextModule],
  template: `
    <!-- Template lives at component root — no *ngIf wrapping it.
         ViewChild with default (static:false) resolves after the first
         CD cycle. -->
    <ng-template #cfgStripTpl>
      <div class="bp-cfg-row">

        <!-- Labels -->
        <span class="bp-cfg-lab">PAGE LABEL</span>
        <input pInputText
               class="bp-cfg-page-label"
               [(ngModel)]="settingsDraft.homePageLabel"
               (blur)="saveLabels()"
               placeholder="Projects"/>
        <span class="bp-cfg-divider"></span>

        <span class="bp-cfg-lab">CREDITS</span>
        <input pInputText
               class="bp-cfg-page-label"
               [(ngModel)]="settingsDraft.creditLabel"
               (blur)="saveLabels()"
               placeholder="Balls"/>
        <span class="bp-cfg-divider"></span>

        <span class="bp-cfg-lab">EVENTS</span>
        <input pInputText
               class="bp-cfg-page-label"
               [(ngModel)]="settingsDraft.projectLabel"
               (blur)="saveLabels()"
               placeholder="Events"/>
        <span class="bp-cfg-divider"></span>

        <!-- Theme swatches -->
        <span class="bp-cfg-lab">THEME</span>
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
        <span class="bp-cfg-divider"></span>

        <!-- Component visibility toggles -->
        <span class="bp-cfg-lab">COMPONENTS</span>
        <div class="bp-cfg-seg bp-cfg-seg--multi">
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
        <span class="bp-cfg-divider"></span>

        <!-- Hero alignment -->
        <span class="bp-cfg-lab">ALIGN</span>
        <div class="bp-cfg-seg">
          <button *ngFor="let opt of alignOptions"
                  type="button"
                  class="bp-cfg-seg-btn"
                  [class.p-highlight]="settingsDraft.heroAlign === opt.value"
                  (click)="selectHeroAlign(opt.value)">
            {{ opt.label }}
          </button>
        </div>
        <span class="bp-cfg-divider"></span>

        <!-- Nav mode -->
        <span class="bp-cfg-lab">NAV</span>
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
    </ng-template>
  `,
  styles: [`
    /* Plain selectors (not :host scoped) so the encapsulation attribute
       set on the template's elements at declaration time still matches
       when AppShell renders the captured template in its lifted slot.
       Same approach the dashboard/agent used pre-extraction. */
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
    .bp-cfg-seg.bp-cfg-seg--multi {
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
  `],
})
export class PageConfigStripComponent implements OnInit, AfterViewInit, OnDestroy {
  /** Default static:false ViewChild — the template is at component root
      (no structural directive above it), but the default mode is also
      the correct one for any template that might one day move under
      *ngIf, so we use it here as the safe baseline. */
  @ViewChild('cfgStripTpl') cfgStripTpl?: TemplateRef<any>;

  private destroy$ = new Subject<void>();

  /** Draft copy of the configurable fields; bound to the inputs +
      buttons in the strip. Saved back to ConfigService on blur / change.
      Defaults populated from configService.current in ngOnInit, then
      kept in sync via the config$ subscription. */
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
      pill was dropped (always-on, added visual noise). */
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

  /** Nav mode — single-pick segmented group. 'sidenav' is labelled
      'Menu' (shorter than 'Side navigation') to fit the compact strip. */
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
    // Keep the draft mirrored to the canonical config so changes made
    // elsewhere (other pages, settings sub-tree) reflect here without
    // a reload.
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
  }

  ngAfterViewInit() {
    if (this.cfgStripTpl) {
      this.configStripSvc.setTemplate(this.cfgStripTpl);
    }
  }

  ngOnDestroy() {
    // Clear the strip slot when this consumer unmounts. The next page
    // that mounts <app-page-config-strip /> will re-register its own
    // template in ngAfterViewInit.
    this.configStripSvc.setTemplate(null);
    this.destroy$.next();
    this.destroy$.complete();
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
