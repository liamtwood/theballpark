/** pV2-PROJECTS-01 — the project list-card contract (server:
 *  services/projects.service.js toCard). */
export interface ProjectCard {
  id: string;
  name: string;
  ref: string | null;
  /** project_status codelist code (draft/active/completed/archived). */
  status: string;
  /** Optional brand / event-type chip overlay (image 8 "Nike"). */
  eventType: string | null;
  venueCity: string | null;
  coverUrl: string | null;
  /** "£X Ballpark" — null when not yet estimated. */
  ballparkCost: number | null;
  currency: string;
  supplierCount: number;
  createdAt: string;
}

/** Which statuses land in the Completed tab; everything else is Current. */
export const COMPLETED_STATUSES = new Set(['completed', 'archived']);

/** Compact relative age for the card meta row ("3 days ago"). Pure. */
export function relativeAge(iso: string | null | undefined, now: number): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const days = Math.floor((now - then) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}
