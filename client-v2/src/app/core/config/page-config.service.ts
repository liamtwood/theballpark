import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../api.service';
import { AuthService } from '../auth/auth.service';
import { firstName } from '../../pages/home/hero-title';
import {
  CONFIG_DEFAULTS,
  PAGE_HERO_DEFAULTS,
  PageConfigPayload,
  PageHeroOverride,
  PageKey,
  ProjectTokenContext,
  mergeConfig,
} from './page-config.types';

/** A page hero resolved for rendering (tokens substituted). */
export interface ResolvedHero {
  eyebrow: string;
  title: string;
  subtitle: string;
}

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
  // Tokenised like the eyebrow/title so {orgName}/{email}/{firstName}/… resolve
  // on the home hero subtitle; tidySeparators drops any empty ' · ' segment.
  readonly heroSubtitle = computed(() =>
    this.tidySeparators(this.applyTokens(this._config()?.heroSubtitle ?? CONFIG_DEFAULTS.heroSubtitle))
  );
  readonly heroAlign = computed(() => this._config()?.heroAlign ?? CONFIG_DEFAULTS.heroAlign);
  readonly creditLabel = computed(() => this._config()?.creditLabel ?? CONFIG_DEFAULTS.creditLabel);
  readonly eventLabel = computed(() => this._config()?.eventLabel ?? CONFIG_DEFAULTS.eventLabel);
  readonly clientLabel = computed(() => this._config()?.clientLabel ?? CONFIG_DEFAULTS.clientLabel);

  /** Home eyebrow above the greeting — default resolves to "<ORG TYPE>
   *  WORKSPACE" (the eyebrow style uppercases it). */
  readonly heroEyebrow = computed(() =>
    this.applyTokens(this._config()?.heroEyebrow || CONFIG_DEFAULTS.heroEyebrow)
  );

  /** Resolve a feature page's hero (eyebrow / title / subtitle): the role's
   *  admin overrides win over PAGE_HERO_DEFAULTS, then {tokens} substitute.
   *  Reactive — reads the config + session signals, so wrap the call in a
   *  component computed(). Pass `project` on a PROJECT page so {clientName}
   *  /{projectName}/{eventType}/{location}/{eventDate}/{guestCount} resolve
   *  from the current project; segments left empty drop from the ' · ' join. */
  pageHero(page: PageKey, project?: ProjectTokenContext | null): ResolvedHero {
    const ov: PageHeroOverride = this._config()?.pages?.[page] ?? {};
    const def = PAGE_HERO_DEFAULTS[page];
    return {
      eyebrow: this.tidySeparators(this.applyTokens(ov.eyebrow || def.eyebrow, project)),
      title: this.tidySeparators(this.applyTokens(ov.title || def.title, project)),
      subtitle: this.tidySeparators(this.applyTokens(ov.subtitle || def.subtitle, project)),
    };
  }

  /** Resolve the runtime {tokens} in an arbitrary string (e.g. the home hero
   *  title, which composes its own text outside pageHero). Public wrapper over
   *  the shared resolver; unknown tokens pass through untouched. */
  resolveTokens(s: string): string {
    return this.applyTokens(s);
  }

  /** Substitute the small whitelist of runtime tokens. Unknown tokens are
   *  left literal (never blanked). Project tokens resolve from `project` (empty
   *  when absent — a non-project page passes none, so they render ''). */
  private applyTokens(s: string, project?: ProjectTokenContext | null): string {
    const u = this.auth.user();
    const p = project ?? null;
    // {guestCount} carries its own "guests" word so the whole segment drops
    // cleanly when there's no count.
    const guests = p?.guestCount != null && Number(p.guestCount) > 0 ? `${p.guestCount} guests` : '';
    const location = p?.location ?? '';
    return s
      .replace(/\{email\}/g, u?.email ?? '')
      .replace(/\{orgName\}/g, u?.activeOrgName ?? '')
      .replace(/\{orgType\}/g, u?.activeOrgType ?? '')
      .replace(/\{eventLabel\}/g, this.eventLabel())
      // User-name tokens (home greeting, composable titles). {username} is an
      // alias of {firstName}. firstName() is the shared tested helper.
      .replace(/\{firstName\}/g, firstName(u))
      .replace(/\{username\}/g, firstName(u))
      .replace(/\{fullName\}/g, u?.displayName ?? u?.email ?? '')
      .replace(/\{clientName\}/g, p?.clientName ?? '')
      .replace(/\{projectName\}/g, p?.projectName ?? '')
      .replace(/\{eventType\}/g, p?.eventType ?? '')
      .replace(/\{location\}/g, location)
      .replace(/\{venueName\}/g, location)
      .replace(/\{eventDate\}/g, p?.eventDate ?? '')
      .replace(/\{guestCount\}/g, guests);
  }

  /** Drop ' · '-joined segments left empty by absent tokens (no leading /
   *  trailing / doubled separators), so a project missing a field still reads
   *  clean. Only removes empty segments — non-empty copy is untouched. */
  private tidySeparators(s: string): string {
    return s.split(' · ').map((seg) => seg.trim()).filter(Boolean).join(' · ');
  }

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
