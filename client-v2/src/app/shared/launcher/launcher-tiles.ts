import { OrgType } from '../../core/auth/auth.service';
import { LauncherTile } from './launcher-tile.types';

/** The agent launcher tile set — Figma copy verbatim (pV2-04b2-qc). ONE
 *  definition: home-agent renders these as tiles AND the stub pages derive
 *  their hero title/subtitle from the same strings (Liam, 2026-06-11 —
 *  "use the title and subtitle strings from the action cards").
 *  Destinations split in v2.12g: New Project → /projects/new (create flow),
 *  Projects → /projects (the list). */
export const AGENT_TILES: readonly LauncherTile[] = [
  // v2.12g (Liam QC): the two project tiles had the SAME target. New Project
  // now opens the create flow's stub; "Past Projects" became plain Projects
  // and keeps the /projects list. Subtitles realigned to match.
  {
    icon: 'folder-plus',
    label: 'New Project',
    subtitle: 'Start a new project.',
    href: '/projects/new',
  },
  {
    icon: 'folder-open',
    label: 'Projects',
    subtitle: 'Manage active projects and supplier conversations.',
    href: '/projects',
  },
  { icon: 'inbox', label: 'Inbox', subtitle: 'Messages, supplier responses and updates.', href: '/inbox' },
  { icon: 'store', label: 'Marketplace', subtitle: 'Browse suppliers, ideas and ballpark costs.', href: '/marketplace' },
  { icon: 'circle-user', label: 'Profile', subtitle: 'Manage your portfolio, pricing and account.', href: '/settings/profile' },
];

/** The supplier launcher tile set (v2.12f — the port of v1.68w's supplier
 *  home, Liam's reference screenshot): leaner than the agent's five — a
 *  supplier manages incoming work, conversations, and their storefront.
 *  v1's Inbox unread badge is deferred until a v2 unread-count endpoint
 *  exists (v1 counted client-side off the full message list). */
export const SUPPLIER_TILES: readonly LauncherTile[] = [
  {
    icon: 'folder-open',
    label: 'Projects',
    subtitle: 'Manage active opportunities, confirmed projects and ongoing work.',
    // v2.13a — lands on the Projects hub (stage tiles), which drills into
    // the /projects list. Was /projects directly (v1.68t parity).
    href: '/projects-hub',
  },
  {
    icon: 'inbox',
    label: 'Inbox',
    subtitle: 'View and respond to producer conversations.',
    href: '/inbox',
  },
  {
    // v2.13b — "Marketplace Profile" read as one thing; it's a hub of three.
    // §14 vocabulary: storefront = the public-face hub.
    icon: 'store',
    label: 'Storefront',
    subtitle:
      'Manage how your company appears in Ballpark Marketplace. Update categories, pricing, portfolio and company information.',
    href: '/storefront',
  },
];

/** The ballpark-admin launcher tile set (Liam, 2026-06-12): platform admins
 *  get just the two real admin surfaces — no agent project chrome. */
export const BALLPARK_TILES: readonly LauncherTile[] = [
  {
    icon: 'circle-user',
    label: 'Profile',
    subtitle: 'Manage company information, team members and business details.',
    href: '/settings/profile',
  },
  {
    icon: 'settings',
    label: 'Page Settings',
    subtitle: 'Edit page heroes and labels per customer role.',
    href: '/settings/pages',
  },
];

/** The supplier Projects hub (v2.13a — v1.68t port): three stage buckets
 *  drilling into the one /projects list pre-filtered. Live counts in the
 *  tile footers are DEFERRED until a v2 projects count endpoint exists
 *  (v1 fetched every project and bucketed client-side). */
export const PROJECTS_HUB_TILES: readonly LauncherTile[] = [
  {
    icon: 'file-text',
    label: 'Quoting',
    subtitle: 'Projects currently progressing through the approval workflow.',
    href: '/projects',
    query: { bucket: 'quoting' },
  },
  {
    icon: 'zap',
    label: 'Live Projects',
    subtitle: 'Active projects currently in production.',
    href: '/projects',
    query: { bucket: 'live' },
  },
  {
    icon: 'circle-check',
    label: 'Completed Projects',
    subtitle: 'Finished projects and delivery history.',
    href: '/projects',
    query: { bucket: 'completed' },
  },
];

/** The supplier Storefront hub (v2.13a as "Marketplace Profile", renamed
 *  v2.13b per §14: storefront = the public-face hub). The Profile tile
 *  lands on the REAL /settings/profile; the rest stub until their arcs.
 *  "My Shop" is UI copy over the §14 internal /store route (store =
 *  catalogue) — never hard-code customer labels as routes. */
export const STOREFRONT_TILES: readonly LauncherTile[] = [
  {
    icon: 'store',
    label: 'Marketplace',
    subtitle: 'Browse the Ballpark Marketplace, explore suppliers and discover opportunities.',
    href: '/marketplace',
  },
  {
    icon: 'package',
    label: 'My Shop',
    subtitle:
      'Manage how your company appears within Ballpark Marketplace. Update your storefront, branding and profile.',
    href: '/store',
  },
  {
    icon: 'building-2',
    label: 'Profile',
    subtitle: 'Manage company information, payment details, team members and account settings.',
    href: '/settings/profile',
  },
];

/** The launcher set for an org type (home-launcher + stub heroes). */
export function tilesForOrgType(orgType: OrgType | null | undefined): readonly LauncherTile[] {
  if (orgType === 'ballpark') return BALLPARK_TILES;
  if (orgType === 'supplier') return SUPPLIER_TILES;
  return AGENT_TILES;
}

/** First tile whose href matches the given path (stub heroes). The viewer's
 *  org type wins when sets share an href (/projects, /inbox carry different
 *  copy for agents vs suppliers); other sets are the fallback. */
export function tileForPath(path: string, orgType?: OrgType | null): LauncherTile | undefined {
  const preferred = tilesForOrgType(orgType);
  return (
    preferred.find((t) => t.href === path) ??
    [
      ...AGENT_TILES,
      ...SUPPLIER_TILES,
      ...BALLPARK_TILES,
      ...PROJECTS_HUB_TILES,
      ...STOREFRONT_TILES,
    ].find((t) => t.href === path)
  );
}
