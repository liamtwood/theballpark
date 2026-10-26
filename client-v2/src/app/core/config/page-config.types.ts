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
  /** Home eyebrow above the greeting (supports tokens — default resolves to
   *  "<ORG TYPE> WORKSPACE"). */
  heroEyebrow?: string;

  creditLabel?: string;
  eventLabel?: string;
  clientLabel?: string;

  /** Per-page hero overrides (eyebrow / title / subtitle). Explicit page keys
   *  — a new configurable page adds its key here, not a free-form record. */
  pages?: Partial<Record<PageKey, PageHeroOverride>>;
}

/** The feature pages whose hero (eyebrow / title / subtitle) is admin-driven
 *  from /settings/pages. Home is separate (its title has modes). */
export type PageKey = 'newProject' | 'projects' | 'marketplace' | 'profile' | 'project';

/** Per-project token values fed into the resolver when rendering a PROJECT
 *  page (the project detail hero). The component resolves these from the loaded
 *  project (eventType already mapped to its project_type LABEL, not the code)
 *  and passes them to pageHero('project', ctx). All optional — an absent field
 *  resolves to an empty token and its subtitle segment is dropped. */
export interface ProjectTokenContext {
  clientName?: string | null;
  projectName?: string | null;
  /** The project_type LABEL (e.g. "Product launch"), not the code. */
  eventType?: string | null;
  /** venue_name for now; the venue CITY once venue_address_id is wired (FR-00239). */
  location?: string | null;
  eventDate?: string | null;
  guestCount?: number | null;
}

/** A page's configurable hero (defaults apply when unset). Strings may embed
 *  {tokens} — see TOKEN help in the service. */
export interface PageHeroOverride {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
}

/** Non-persisted defaults, applied at read time. */
export const CONFIG_DEFAULTS = {
  heroTitleMode: 'greeting',
  heroAlign: 'center', // fallback only; per-org alignment lives in org_type_config
  heroSubtitle: 'What opportunities are we working on today?',
  heroEyebrow: '{orgType} workspace', // uppercased by the eyebrow style
  creditLabel: 'Ball',
  eventLabel: 'Project',
  clientLabel: 'Client',
} as const;

/** Baseline per-page hero copy (overridable per role in /settings/pages).
 *  Subtitles may embed {tokens}: {email} {orgName} {orgType} {eventLabel}; the
 *  PROJECT page also has {clientName} {projectName} {eventType} {location}
 *  {venueName} {eventDate} {guestCount} (resolved from the current project —
 *  empty segments drop from the ' · '-joined subtitle). */
export const PAGE_HERO_DEFAULTS: Record<PageKey, Required<PageHeroOverride>> = {
  newProject: {
    eyebrow: 'New project',
    title: 'Turn a brief into a ballpark',
    subtitle:
      'Drop in the brief and any details you already know. Ballpark drafts a costed estimate with its assumptions shown, and you edit every line.',
  },
  projects: {
    eyebrow: 'Projects',
    title: 'Your project history',
    subtitle: "Every brief you've analysed, with the ballpark range and assumptions kept intact.",
  },
  marketplace: {
    eyebrow: 'Marketplace',
    title: 'Browse approved suppliers',
    subtitle:
      'Have a look around and get a feel for what things cost. Add anything you like to an existing project, or start a new one from it.',
  },
  profile: {
    eyebrow: 'Profile',
    title: 'Your details',
    subtitle: 'Signed in as {email} · {orgType} account',
  },
  // The project DETAIL hero (FR-00240): client name eyebrow / project name /
  // event-summary subtitle. Empty token segments drop from the ' · ' join.
  project: {
    eyebrow: '{clientName}',
    title: '{projectName}',
    subtitle: '{eventType} · {location} · {eventDate} · {guestCount}',
  },
};

/** Admin table metadata: the pages whose hero is editable, in display order. */
export const PAGE_META: readonly { key: PageKey; label: string }[] = [
  { key: 'newProject', label: 'New project' },
  { key: 'projects', label: 'Projects' },
  { key: 'project', label: 'Project (detail)' },
  { key: 'marketplace', label: 'Marketplace' },
  { key: 'profile', label: 'Profile' },
];

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
