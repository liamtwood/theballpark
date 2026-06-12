import { OrgType } from '../../core/auth/auth.service';
import { LauncherTile } from './launcher-tile.types';

/** The agent launcher tile set — Figma copy verbatim (pV2-04b2-qc). ONE
 *  definition: home-agent renders these as tiles AND the stub pages derive
 *  their hero title/subtitle from the same strings (Liam, 2026-06-11 —
 *  "use the title and subtitle strings from the action cards").
 *  NOTE: two tiles target /projects until the projects arc splits their
 *  destinations; the stub page for /projects uses the FIRST match. */
export const AGENT_TILES: readonly LauncherTile[] = [
  {
    icon: 'folder-plus',
    label: 'New Project',
    subtitle: 'Manage active projects and supplier conversations.',
    href: '/projects',
  },
  {
    icon: 'folder-open',
    label: 'Past Projects',
    subtitle: 'View completed and archived work.',
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
    href: '/projects',
  },
  {
    icon: 'inbox',
    label: 'Inbox',
    subtitle: 'View and respond to producer conversations.',
    href: '/inbox',
  },
  {
    icon: 'store',
    label: 'Marketplace Profile',
    subtitle:
      'Manage how your company appears in Ballpark Marketplace. Update categories, pricing, portfolio and company information.',
    href: '/marketplace-profile',
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
    [...AGENT_TILES, ...SUPPLIER_TILES, ...BALLPARK_TILES].find((t) => t.href === path)
  );
}
