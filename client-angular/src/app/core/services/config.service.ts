import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ThemePreset, PlatformConfig } from '../../models';

const THEME_PRESETS: Record<string, ThemePreset> = {
  amber:   { name: 'amber',   accent: '#D97706', bg: '#F5F0E8', empty: '#EDD9A3', text: '#92400E', border: '#E8D9C0' },
  emerald: { name: 'emerald', accent: '#00B84A', bg: '#EDF7F1', empty: '#A7F3D0', text: '#065F46', border: '#B8E8CC' },
  pink:    { name: 'pink',    accent: '#FF0066', bg: '#FFF0F5', empty: '#FFD6E8', text: '#99003D', border: '#FFB3D4' },
  ocean:   { name: 'ocean',   accent: '#2563EB', bg: '#EFF6FF', empty: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' },
  slate:   { name: 'slate',   accent: '#64748B', bg: '#F8F9FA', empty: '#E8EDF2', text: '#334155', border: '#E2E8F0' },
};

const STORAGE_KEY = 'ballpark_config';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  static readonly THEME_PRESETS = THEME_PRESETS;

  private config: PlatformConfig = {
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
    showUserName: true,
    showLocation: true,
    showUpcoming: true,
    showStats: true,
  };

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
  get showUserName(): boolean { return this.config.showUserName !== false; }
  get showLocation(): boolean { return this.config.showLocation !== false; }
  get showUpcoming(): boolean { return this.config.showUpcoming !== false; }
  get showStats(): boolean { return this.config.showStats !== false; }

  get isDarkMode(): boolean {
    if (this.config.mode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return this.config.mode === 'dark';
  }

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
    this.config = { ...this.config, ...partial };
    this.save();
    this.applyTheme();
    this.applyMode();
    this.configSubject.next({ ...this.config });
  }

  private load(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.config = { ...this.config, ...parsed };
      }
    } catch {}

    // Validate theme — fall back to amber if missing or invalid
    if (!this.config.themeName || !THEME_PRESETS[this.config.themeName]) {
      this.config.themeName = 'amber';
    }

    // Notify subscribers with the loaded (and validated) config
    this.configSubject.next({ ...this.config });
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
  }

  applyTheme(): void {
    const t = this.theme;
    const root = document.documentElement;
    root.style.setProperty('--theme-accent', t.accent);
    root.style.setProperty('--theme-bg', t.bg);
    root.style.setProperty('--theme-empty', t.empty);
    root.style.setProperty('--theme-text', t.text);
    root.style.setProperty('--theme-border', t.border);

    if (this.isDarkMode) {
      root.style.setProperty('--theme-bg', this.darkenForDark(t.accent));
      root.style.setProperty('--theme-border', this.darkenBorderForDark(t.accent));
    }
  }

  applyMode(): void {
    const dark = this.isDarkMode;
    document.documentElement.setAttribute('data-mode', dark ? 'dark' : 'light');
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
