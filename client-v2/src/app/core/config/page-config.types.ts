/** pV2-04b — the v2 home page-settings payload, as persisted in
 *  org_type_config.payload.v2Home (server: schemas/page-config.schema.js is
 *  the validating twin). General-tab fields only — the launcher-only home
 *  has no section flags and no hero band (so no heroColor). All fields
 *  optional: partial payloads are valid; defaults apply in the service. */
export interface PageConfigPayload {
  heroTitleMode?: 'greeting' | 'username' | 'orgName' | 'fixed';
  heroTitleFixed?: string;
  heroSubtitle?: string;
  heroAlign?: 'left' | 'center';

  creditLabel?: string;
  eventLabel?: string;
  clientLabel?: string;
}

/** Non-persisted defaults, applied at read time. */
export const CONFIG_DEFAULTS = {
  heroTitleMode: 'greeting',
  heroAlign: 'center', // v1's launcher is centred by default
  heroSubtitle: 'What opportunities are we working on today?',
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
