import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/** Runtime configuration shipped beside the built static assets. Customers can
 *  edit `public/runtime-config.json` post-build without rebuilding the bundle. */
export interface RuntimeConfig {
  /** Base URL of the Ballpark API (no trailing slash). */
  apiBaseUrl: string;
  /** Google OAuth client id — consumed by pV2-02 auth; empty until then. */
  googleOAuthClientId: string;
}

/** Loads `/runtime-config.json` once, at app bootstrap, before any feature
 *  reads the API URL. See app.config.ts `provideAppInitializer`. */
@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  private readonly http = inject(HttpClient);
  private config?: RuntimeConfig;

  /** Fetch and cache the runtime config. Resolves before the app renders. */
  async load(): Promise<void> {
    this.config = await firstValueFrom(this.http.get<RuntimeConfig>('/runtime-config.json'));
  }

  /** The loaded config. Throws if read before {@link load} completes. */
  get(): RuntimeConfig {
    if (!this.config) {
      throw new Error('Runtime config not loaded — call load() at bootstrap first.');
    }
    return this.config;
  }
}
