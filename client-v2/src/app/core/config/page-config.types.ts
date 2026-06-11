/** pV2-04 — the v2 home page-settings payload, as persisted in
 *  org_type_config.payload.v2Home (server: schemas/page-config.schema.js is
 *  the validating twin — enforced loosely by shape, strictly by the drawer
 *  only emitting these keys). All fields optional: partial payloads are
 *  valid and defaults apply via the helpers below. */
export interface PageConfigPayload {
  // Hero
  heroTitleMode?: 'greeting' | 'username' | 'orgName' | 'fixed';
  heroTitleFixed?: string;
  heroSubtitle?: string;
  heroColor?: 'theme' | 'none';
  heroAlign?: 'left' | 'center';

  // Section toggles
  showStats?: boolean;
  showUpcoming?: boolean;
  showQuickActions?: boolean;
  showRecentActivity?: boolean;
  showCredits?: boolean;
  showSavedSuppliers?: boolean;

  // Labels
  creditLabel?: string;
  eventLabel?: string;
  clientLabel?: string;
}

/** The section-toggle keys — used to type sectionVisible / the drawer rows. */
export type SectionFlag =
  | 'showStats'
  | 'showUpcoming'
  | 'showQuickActions'
  | 'showRecentActivity'
  | 'showCredits'
  | 'showSavedSuppliers';

/** Non-toggle defaults, applied at read time (never persisted). */
export const CONFIG_DEFAULTS = {
  heroTitleMode: 'greeting',
  heroColor: 'theme',
  heroAlign: 'left',
  creditLabel: 'Ball',
  eventLabel: 'Project',
  clientLabel: 'Client',
} as const;

/** Merge a drawer change into the current payload. Pure — unit tested.
 *  Patch keys win; explicit undefined in the patch DELETES the key (lets the
 *  drawer reset a field to default). */
export function mergeConfig(
  base: PageConfigPayload | null,
  patch: Partial<PageConfigPayload>
): PageConfigPayload {
  const next: Record<string, unknown> = { ...(base ?? {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) {
      delete next[k];
    } else {
      next[k] = v;
    }
  }
  return next as PageConfigPayload;
}

/** Section visibility with default-on fallback. Pure — unit tested. */
export function sectionVisible(cfg: PageConfigPayload | null, flag: SectionFlag): boolean {
  return cfg?.[flag] ?? true;
}
