import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

/** Brand values from the `bp_brand_config` registry (GET /api/brand). */
export interface BrandConfig {
  font_pair?: string;
  gradient?: string;
  text_color?: string;
}

/** DB key → the `--bp-*` CSS token it drives. */
const TOKEN_MAP: Record<keyof BrandConfig, string> = {
  font_pair: '--bp-font',
  gradient: '--bp-gradient',
  text_color: '--bp-text-color',
};

/** Loads brand config from the API at bootstrap (before first paint — see
 *  app.config.ts initializer chain) and applies it onto the `--bp-*` tokens
 *  on `:root`. On failure the styles.css fallbacks simply remain in effect. */
@Injectable({ providedIn: 'root' })
export class BrandConfigService {
  private readonly api = inject(ApiService);
  private readonly _config = signal<BrandConfig | null>(null);

  /** The loaded brand config, or null when the API was unreachable. */
  readonly config = this._config.asReadonly();

  /** Fetch /api/brand and set the tokens. Never throws — brand is cosmetic,
   *  so an unreachable API must not block bootstrap. */
  async load(): Promise<void> {
    try {
      const cfg = await firstValueFrom(this.api.get<BrandConfig>('/api/brand'));
      this._config.set(cfg);
      this.applyToRoot(cfg);
    } catch (e) {
      console.warn('BrandConfig: failed to load, using styles.css defaults', e);
    }
  }

  private applyToRoot(cfg: BrandConfig): void {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(cfg)) {
      const token = TOKEN_MAP[key as keyof BrandConfig];
      if (token && value) {
        root.style.setProperty(token, value);
      }
    }
  }
}
