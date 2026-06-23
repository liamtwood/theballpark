import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../api.service';
import { AuthService } from '../auth/auth.service';
import { CONFIG_DEFAULTS, PageConfigPayload, mergeConfig } from './page-config.types';

/** pV2-04b — signal-backed page-settings store. One config per org_type
 *  (org_type_config.payload.v2Home); loaded at bootstrap after the session,
 *  written by the drawer with optimistic updates. */
@Injectable({ providedIn: 'root' })
export class PageConfigService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  private readonly _config = signal<PageConfigPayload | null>(null);

  /** The raw payload (null until loaded; {} = server defaults). */
  readonly config = this._config.asReadonly();

  readonly heroTitleMode = computed(() => this._config()?.heroTitleMode ?? CONFIG_DEFAULTS.heroTitleMode);
  readonly heroTitleFixed = computed(() => this._config()?.heroTitleFixed ?? '');
  readonly heroSubtitle = computed(() => this._config()?.heroSubtitle ?? CONFIG_DEFAULTS.heroSubtitle);
  readonly heroAlign = computed(() => this._config()?.heroAlign ?? CONFIG_DEFAULTS.heroAlign);
  readonly creditLabel = computed(() => this._config()?.creditLabel ?? CONFIG_DEFAULTS.creditLabel);
  readonly eventLabel = computed(() => this._config()?.eventLabel ?? CONFIG_DEFAULTS.eventLabel);
  readonly clientLabel = computed(() => this._config()?.clientLabel ?? CONFIG_DEFAULTS.clientLabel);

  /** Profile-page hero overrides (title2/subtitle2) — unset = page defaults. */
  readonly profileTitle = computed(() => this._config()?.pages?.profile?.title ?? '');
  readonly profileSubtitle = computed(() => this._config()?.pages?.profile?.subtitle ?? '');

  /** Marketplace-page hero overrides (HERO ONLY — v1's other marketplace
   *  view settings are deliberately ignored, Liam 2026-06-12). */
  readonly marketplaceTitle = computed(() => this._config()?.pages?.marketplace?.title ?? '');
  readonly marketplaceSubtitle = computed(() => this._config()?.pages?.marketplace?.subtitle ?? '');

  /** Load the org_type's config. Called from the bootstrap initializer chain
   *  AFTER AuthService.loadSession (needs activeOrgType); orgless / signed-out
   *  users skip — they never see /home. Never throws (boot must proceed). */
  async load(): Promise<void> {
    const u = this.auth.user();
    if (!u?.activeOrgType || !u.activeOrgId) return;
    try {
      const cfg = await firstValueFrom(
        this.api.get<PageConfigPayload>(`/api/config/${u.activeOrgType}`)
      );
      this._config.set(cfg ?? {});
    } catch (err) {
      // Config is cosmetic: defaults render fine without it, so boot
      // continues — but a failed load is never silent (Rule 5).
      console.warn('[PageConfig] load failed; using defaults', err);
      this._config.set({});
    }
  }

  /** Drawer auto-save: optimistic set, then PUT; on failure reload ground
   *  truth from the server (which also reverts the optimistic state). */
  async update(patch: Partial<PageConfigPayload>): Promise<void> {
    const next = mergeConfig(this._config(), patch);
    this._config.set(next); // optimistic — drawer + page react instantly
    try {
      const orgType = this.auth.user()?.activeOrgType;
      if (!orgType) return;
      await firstValueFrom(this.api.put(`/api/config/${orgType}`, { payload: next }));
    } catch (err) {
      // Save failed (403 non-admin race, 5xx, offline): log + recover ground
      // truth — silently keeping the optimistic state would lie (Rule 5).
      console.warn('[PageConfig] save failed; reloading server state', err);
      await this.load();
    }
  }
}
