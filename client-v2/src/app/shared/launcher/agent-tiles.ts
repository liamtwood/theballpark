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

/** First tile whose href matches the given path (stub heroes). */
export function tileForPath(path: string): LauncherTile | undefined {
  return [...AGENT_TILES, ...BALLPARK_TILES].find((t) => t.href === path);
}
