import { Injectable, signal } from '@angular/core';

/** What a page registers so the shell can offer its settings drawer. */
export interface PageSettingsConfig {
  /** Which config surface the drawer edits (e.g. 'v2Home'). */
  pageKey: string;
  /** Drawer title, e.g. "Customise your home". */
  label: string;
}

/** pV2-04b1-qc — shell context: pages with a settings surface register here
 *  on mount (and clear on destroy); the shell renders ONE cog + ONE drawer
 *  for whichever page is active. pV2-04c's Profile registers its own config
 *  through the same signal — the mechanism scales without touching the
 *  shell again. */
@Injectable({ providedIn: 'root' })
export class ShellContextService {
  private readonly _pageSettings = signal<PageSettingsConfig | null>(null);
  private readonly _settingsOpen = signal(false);

  /** The active page's settings registration, or null (no cog). */
  readonly pageSettings = this._pageSettings.asReadonly();
  /** Drawer visibility — owned here so shell (cog) and drawer share it. */
  readonly settingsOpen = this._settingsOpen.asReadonly();

  /** Called by pages on mount (config) and destroy (null). */
  setPageSettings(config: PageSettingsConfig | null): void {
    this._pageSettings.set(config);
    if (!config) {
      this._settingsOpen.set(false); // never leave a drawer open for a dead page
    }
  }

  openSettings(): void {
    this._settingsOpen.set(true);
  }

  setSettingsOpen(open: boolean): void {
    this._settingsOpen.set(open);
  }
}
