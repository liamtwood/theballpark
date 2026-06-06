import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ThemePreset, PlatformConfig } from '../../models';

/* p0003 — three-stop contrast set per preset.
   Soft = active-tab light fill; mid = bold-mode hero orbs; strong = active-tab text. */
// `accent2` is the second stop of the derived --grad-accent gradient
// (accent → accent2). Predefined per theme so the brand gradient tracks the
// active theme without a separate setting. The pink preset's accent is
// #EC4899 (pink-500) so its gradient is the canonical pink-500 → green-500.
const THEME_PRESETS: Record<string, ThemePreset> = {
  amber:   { name: 'amber',   accent: '#D97706', accent2: '#EC4899', bg: '#F5F0E8', empty: '#EDD9A3', text: '#92400E', border: '#E8D9C0',
             contrastSoft: '#DDEEF2', contrast: '#3FA8C4', contrastStrong: '#0C447C' },
  emerald: { name: 'emerald', accent: '#00B84A', accent2: '#2563EB', bg: '#EDF7F1', empty: '#A7F3D0', text: '#065F46', border: '#B8E8CC',
             contrastSoft: '#FBE4EC', contrast: '#F06F9C', contrastStrong: '#993556' },
  pink:    { name: 'pink',    accent: '#EC4899', accent2: '#22C55E', bg: '#FFF0F5', empty: '#FFD6E8', text: '#99003D', border: '#FFB3D4',
             contrastSoft: '#DFF0E4', contrast: '#3DBE73', contrastStrong: '#0F6E56' },
  ocean:   { name: 'ocean',   accent: '#2563EB', accent2: '#22D3EE', bg: '#EFF6FF', empty: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE',
             contrastSoft: '#FBECD3', contrast: '#F0A93E', contrastStrong: '#854F0B' },
  slate:   { name: 'slate',   accent: '#64748B', accent2: '#94A3B8', bg: '#F8F9FA', empty: '#E8EDF2', text: '#334155', border: '#E2E8F0',
             contrastSoft: '#F6E6E1', contrast: '#D88A6E', contrastStrong: '#7A3A26' },
};

const STORAGE_KEY  = 'ballpark_config';            // legacy single config (migrated)
const PROFILES_KEY = 'ballpark_config_profiles';   // v1.66an — per (platform, role)
const ACTIVE_KEY   = 'ballpark_config_active';

// v1.66an — page settings are now a first-class object: a SettingsProfile
// keyed by (platform, role). The system admin authors any profile via the
// page-config drawer's Platform + Role selectors. Built as a layered model
// (today only the role layer is populated); Phase 2 adds a user-override
// layer + per-setting owner tiers (platform / orgAdmin / user).
export const CONFIG_PLATFORMS = ['Ballpark', 'Platform'] as const;
export const CONFIG_ROLES     = ['agent', 'admin', 'supplier'] as const;
const profileKey = (platform: string, role: string) => `${platform}::${role}`;

const DEFAULT_CONFIG: PlatformConfig = {
  platformName: 'The Ballpark',
  tagline: 'Exhibition Costing',
  projectLabel: 'Event',
  creditLabel: 'Ball',
  catalogueLabel: 'Catalogue',
  feedbackLabel: 'Feedback',
  homePageLabel: 'Projects',
  themeName: 'amber',
  mode: 'system',
  heroAlign: 'center',
  // p0023 — hero title source + strip treatment (home / agent).
  heroTitleMode: 'greeting',
  heroColor: 'none',
  separatorWidth: 100,
  currency: 'GBP',
  showUserName: true,
  showLocation: true,
  showOrg: true,
  showUpcoming: true,
  showStats: true,
  // p0018 — dashboard body sections, all visible by default.
  showQuickActions: true,
  showCredits: true,
  showSavedSuppliers: true,
  showRecentActivity: true,
};

@Injectable({ providedIn: 'root' })
export class ConfigService {
  static readonly THEME_PRESETS = THEME_PRESETS;

  // v1.66an — every (platform, role) profile lives here; `config` always
  // points at the active one, so all the getters below are unchanged.
  private profiles: Record<string, PlatformConfig> = {};
  private activeProfileKey = profileKey('Ballpark', 'agent');
  private config: PlatformConfig = { ...DEFAULT_CONFIG };

  private configSubject = new BehaviorSubject<PlatformConfig>(this.config);
  config$ = this.configSubject.asObservable();

  constructor() {
    this.load();
    this.applyTheme();
    this.applyMode();
  }

  get current(): PlatformConfig { return { ...this.config }; }
  get theme(): ThemePreset { return THEME_PRESETS[this.config.themeName] || THEME_PRESETS['amber']; }
  get platformName(): string { return this.config.platformName; }
  get tagline(): string { return this.config.tagline; }
  get projectLabel(): string { return this.config.projectLabel; }
  get creditLabel(): string { return this.config.creditLabel; }
  get catalogueLabel(): string { return this.config.catalogueLabel || 'Catalogue'; }
  get feedbackLabel(): string { return this.config.feedbackLabel || 'Feedback'; }
  get homePageLabel(): string { return this.config.homePageLabel || 'Projects'; }
  get logoUrl(): string { return this.config.logoUrl || ''; }
  get heroAlign(): string { return this.config.heroAlign || 'center'; }
  // p0023 — hero customisation (home / agent surfaces).
  get heroTitleMode(): 'org' | 'user' | 'greeting' | 'purpose' { return this.config.heroTitleMode || 'greeting'; }
  get heroColor(): 'theme' | 'none' { return this.config.heroColor || 'none'; }
  get separatorWidth(): number { return this.config.separatorWidth ?? 100; }
  /** Financial defaults — headline currency (ISO 4217). Default GBP. */
  get currency(): string { return this.config.currency || 'GBP'; }
  get showUserName(): boolean { return this.config.showUserName !== false; }
  get showLocation(): boolean { return this.config.showLocation !== false; }
  get showOrg(): boolean { return this.config.showOrg !== false; }
  get showUpcoming(): boolean { return this.config.showUpcoming !== false; }
  get showStats(): boolean { return this.config.showStats !== false; }
  // p0018 — dashboard body section getters (default true when unset).
  get showQuickActions(): boolean { return this.config.showQuickActions !== false; }
  get showCredits(): boolean { return this.config.showCredits !== false; }
  get showSavedSuppliers(): boolean { return this.config.showSavedSuppliers !== false; }
  get showRecentActivity(): boolean { return this.config.showRecentActivity !== false; }

  get isDarkMode(): boolean {
    if (this.config.mode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return this.config.mode === 'dark';
  }

  /** p0003 — bold mode shares panel + content surfaces with light mode;
      only the hero is decorated differently. Used by applyMode below. */
  get isBoldMode(): boolean { return this.config.mode === 'bold'; }

  static daysUntilReset(): number {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.getDate() - now.getDate();
  }

  static formatCurrency(value: number | string | null | undefined): string {
    const num = typeof value === 'number' ? value : parseFloat(value as string) || 0;
    if (num >= 1000) {
      return '\u00A3' + (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return '\u00A3' + Math.round(num);
  }

  splitLogoName(): { first: string; second: string } {
    const name = this.config.platformName;
    // For "The Ballpark" specifically, split as "The Ball" + "park"
    const lastSpace = name.lastIndexOf(' ');
    if (lastSpace === -1) {
      const mid = Math.ceil(name.length / 2);
      return { first: name.slice(0, mid), second: name.slice(mid) };
    }
    const lastWord = name.slice(lastSpace + 1);
    const prefix = name.slice(0, lastSpace + 1);
    const splitAt = Math.ceil(lastWord.length / 2);
    return {
      first: prefix + lastWord.slice(0, splitAt),
      second: lastWord.slice(splitAt),
    };
  }

  update(partial: Partial<PlatformConfig>): void {
    // v1.66an — writes target the ACTIVE (platform, role) profile.
    this.profiles[this.activeProfileKey] = { ...this.profiles[this.activeProfileKey], ...partial };
    this.config = this.profiles[this.activeProfileKey];
    this.save();
    this.applyTheme();
    this.applyMode();
    this.configSubject.next({ ...this.config });
  }

  // ── v1.66an — system-admin profile authoring ──────────────────────
  get platforms(): readonly string[] { return CONFIG_PLATFORMS; }
  get roles():     readonly string[] { return CONFIG_ROLES; }
  get activePlatform(): string { return this.activeProfileKey.split('::')[0]; }
  get activeRole():     string { return this.activeProfileKey.split('::')[1]; }

  /** Switch which (platform, role) profile is active + edited. Re-emits
      config$ so every surface re-renders from the selected profile. */
  // ── v1.66av — per-page hero overrides (within the active profile) ──
  getPageSetting(key: string): { heroTitleMode?: 'org' | 'user' | 'greeting' | 'purpose'; heroSub?: string; heroAlign?: 'left' | 'center' } {
    return this.config.pageSettings?.[key] || {};
  }
  updatePageSetting(key: string, partial: { heroTitleMode?: 'org' | 'user' | 'greeting' | 'purpose'; heroSub?: string; heroAlign?: 'left' | 'center' }): void {
    const profile = this.profiles[this.activeProfileKey];
    const ps = { ...(profile.pageSettings || {}) };
    ps[key] = { ...(ps[key] || {}), ...partial };
    profile.pageSettings = ps;
    this.config = profile;
    this.save();
    this.configSubject.next({ ...this.config });
  }

  setActiveProfile(platform: string, role: string): void {
    const key = profileKey(platform, role);
    if (!this.profiles[key]) this.profiles[key] = { ...DEFAULT_CONFIG };
    this.activeProfileKey = key;
    this.config = this.profiles[key];
    this.save();
    this.applyTheme();
    this.applyMode();
    this.configSubject.next({ ...this.config });
  }

  private load(): void {
    // 1. Seed every (platform, role) profile from the default.
    for (const platform of CONFIG_PLATFORMS) {
      for (const role of CONFIG_ROLES) {
        this.profiles[profileKey(platform, role)] = { ...DEFAULT_CONFIG };
      }
    }
    // 2. Migrate the legacy single config into Ballpark::agent.
    try {
      const legacy = localStorage.getItem(STORAGE_KEY);
      if (legacy) {
        const k = profileKey('Ballpark', 'agent');
        this.profiles[k] = { ...this.profiles[k], ...JSON.parse(legacy) };
      }
    } catch {}
    // 3. Overlay any stored per-profile settings.
    try {
      const stored = localStorage.getItem(PROFILES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, Partial<PlatformConfig>>;
        for (const key of Object.keys(parsed)) {
          this.profiles[key] = { ...(this.profiles[key] || DEFAULT_CONFIG), ...parsed[key] };
        }
      }
    } catch {}
    // 4. Resolve the active profile.
    const storedActive = localStorage.getItem(ACTIVE_KEY);
    if (storedActive && this.profiles[storedActive]) this.activeProfileKey = storedActive;
    this.config = this.profiles[this.activeProfileKey] || { ...DEFAULT_CONFIG };

    // Validate theme — fall back to amber if missing or invalid
    if (!this.config.themeName || !THEME_PRESETS[this.config.themeName]) {
      this.config.themeName = 'amber';
    }

    this.configSubject.next({ ...this.config });
  }

  private save(): void {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(this.profiles));
    localStorage.setItem(ACTIVE_KEY, this.activeProfileKey);
  }

  applyTheme(): void {
    const t = this.theme;
    const root = document.documentElement;
    root.style.setProperty('--theme-accent', t.accent);
    root.style.setProperty('--theme-accent-2', t.accent2);
    // Derived brand gradient — accent → accent2. Every object that uses the
    // "this color" gradient references var(--grad-accent), so they all track
    // the active theme with no per-object config.
    root.style.setProperty('--grad-accent', `linear-gradient(90deg, ${t.accent} 0%, ${t.accent2} 100%)`);
    root.style.setProperty('--theme-bg', t.bg);
    root.style.setProperty('--theme-empty', t.empty);
    root.style.setProperty('--theme-text', t.text);
    root.style.setProperty('--theme-border', t.border);
    /* p0003 — contrast set drives the real-tabs active state + Bold-mode
       hero orbs. Each preset carries its own three-stop. */
    root.style.setProperty('--theme-contrast-soft', t.contrastSoft);
    root.style.setProperty('--theme-contrast', t.contrast);
    root.style.setProperty('--theme-contrast-strong', t.contrastStrong);

    if (this.isDarkMode) {
      root.style.setProperty('--theme-bg', this.darkenForDark(t.accent));
      root.style.setProperty('--theme-border', this.darkenBorderForDark(t.accent));
    }
  }

  applyMode(): void {
    /* p0003 — three-way data-mode: light / dark / bold. Bold paints
       only the hero; panels and content reuse light-mode tokens. */
    let mode: 'light' | 'dark' | 'bold' = 'light';
    if (this.isDarkMode) mode = 'dark';
    else if (this.isBoldMode) mode = 'bold';
    document.documentElement.setAttribute('data-mode', mode);
  }

  private darkenForDark(accent: string): string {
    const r = parseInt(accent.slice(1, 3), 16);
    const g = parseInt(accent.slice(3, 5), 16);
    const b = parseInt(accent.slice(5, 7), 16);
    const mix = (c: number) => Math.round(0x11 * 0.85 + c * 0.15);
    return `#${mix(r).toString(16).padStart(2, '0')}${mix(g).toString(16).padStart(2, '0')}${mix(b).toString(16).padStart(2, '0')}`;
  }

  private darkenBorderForDark(accent: string): string {
    const r = parseInt(accent.slice(1, 3), 16);
    const g = parseInt(accent.slice(3, 5), 16);
    const b = parseInt(accent.slice(5, 7), 16);
    const mix = (c: number) => Math.round(0x1e * 0.75 + c * 0.25);
    return `#${mix(r).toString(16).padStart(2, '0')}${mix(g).toString(16).padStart(2, '0')}${mix(b).toString(16).padStart(2, '0')}`;
  }
}
