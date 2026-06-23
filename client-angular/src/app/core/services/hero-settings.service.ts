import { Injectable } from '@angular/core';
import { ConfigService } from './config.service';
import { PersonaService } from './persona.service';

export type HeroTitleMode = 'org' | 'user' | 'greeting' | 'purpose';

/**
 * HeroSettingsService — v1.68v. One Definition for resolving a page's hero
 * title / subtitle / alignment from the per-page settings (the page-config
 * drawer writes these via ConfigService.updatePageSetting).
 *
 * Shared by the app-shell hero AND the launcher pages (Home / Projects hub /
 * Marketplace Profile), so the "org / user / greeting / purpose" title logic
 * — including the "Welcome back, {first}" greeting — lives in exactly one
 * place. Launcher pages set hideHero, so they render their own hero from the
 * same resolved values rather than the shell band.
 */
@Injectable({ providedIn: 'root' })
export class HeroSettingsService {
  constructor(
    private config: ConfigService,
    private persona: PersonaService,
  ) {}

  /** Resolve a title MODE to display text. `purpose` is the page's own
      default title (used directly for 'purpose', and as a last-resort
      fallback for the other modes). */
  resolveTitle(mode: HeroTitleMode, opts: { purpose: string; orgName?: string; userName?: string }): string {
    switch (mode) {
      case 'org':
        return opts.orgName || this.persona.active?.orgName || opts.purpose;
      case 'user':
        return opts.userName || this.persona.active?.name || 'there';
      case 'greeting': {
        const name = (opts.userName || this.persona.active?.name || '').trim();
        const first = name.split(/\s+/)[0] || 'there';
        return `Welcome back, ${first}`;
      }
      default:
        return opts.purpose;   // 'purpose' — the page's own name
    }
  }

  /** Title for a page: a saved per-page mode override wins; otherwise the
      page's own default text (so nothing changes until it's customised). */
  title(pageKey: string, defaultTitle: string, opts?: { orgName?: string; userName?: string }): string {
    const mode = this.config.getPageSetting(pageKey).heroTitleMode;
    if (!mode) return defaultTitle;
    return this.resolveTitle(mode, { purpose: defaultTitle, ...opts });
  }

  /** Subtitle for a page: saved override wins, else the page default. */
  subtitle(pageKey: string, defaultSubtitle: string): string {
    const ov = this.config.getPageSetting(pageKey).heroSub;
    return (ov === undefined || ov === null) ? defaultSubtitle : ov;
  }

  /** Hero alignment for a page (left | center); default centre. */
  align(pageKey: string): 'left' | 'center' {
    return this.config.getPageSetting(pageKey).heroAlign || 'center';
  }
}
