/** pV2-PROJECTS-01 — the project list-card contract (server:
 *  services/projects.service.js toCard). */
export interface ProjectCard {
  id: string;
  /** v1 card title = event_name || name (resolved server-side). */
  name: string;
  ref: string | null;
  /** project_status codelist code (draft/active/completed/archived). */
  status: string;
  coverUrl: string | null;
  /** Client name → the cover chip (v1 "Nike"); logo overlays the cover. */
  clientName: string | null;
  clientLogoUrl: string | null;
  /** Headline "£X Ballpark" (v1 = total_client_cost) — null when unestimated. */
  ballparkCost: number | null;
  currency: string;
  supplierCount: number;
  /** Relative-time source (v1 uses updated_at). */
  updatedAt: string;
}

/** Which statuses land in the Completed tab; everything else is Current. */
export const COMPLETED_STATUSES = new Set(['completed', 'archived']);

/** One line in a project's quote (server: project_items snapshot). */
export interface QuoteLine {
  id: string;
  itemId: string;
  name: string | null;
  basePrice: number | null;
  unit: string | null;
  imageUrl: string | null;
  quantity: number;
}

/** Full project detail (PROJECTS-02 — the inside-project view). */
export interface ProjectDetail {
  id: string;
  ref: string | null;
  name: string;
  status: string;
  description: string | null;
  eventType: string | null;
  eventDate: string | null;
  venueName: string | null;
  venueCity: string | null;
  venueAddress: string | null;
  guestCount: number | null;
  durationDays: number | null;
  projectBudget: number | null;
  currency: string;
  tier: string | null;
  /** Read-only display (joined from clients) — v1 Event details parity. */
  clientName: string | null;
  coverUrl: string | null;
  totalBallparkCost: number | null;
  createdAt: string;
}

/** Partial update body for the Project Details tab (server: ProjectUpdateSchema). */
export type ProjectUpdate = Partial<{
  name: string;
  description: string | null;
  eventType: string | null;
  eventDate: string | null;
  venueName: string | null;
  venueCity: string | null;
  venueAddress: string | null;
  guestCount: number | null;
  durationDays: number | null;
  projectBudget: number | null;
  currency: string;
  tier: 'starter' | 'professional' | 'premium' | null;
  status: 'draft' | 'active' | 'completed' | 'archived';
}>;

/** The create body the gated POST /api/projects-v2 accepts (server:
 *  ProjectCreateSchema). org_id is NOT here — the server uses the JWT. */
export interface ProjectCreatePayload {
  name?: string;
  description?: string;
  eventType?: string;
  eventDate?: string;
  venueName?: string;
  venueCity?: string;
  guestCount?: number | null;
  durationDays?: number | null;
  tier?: 'starter' | 'professional' | 'premium';
  currency?: string;
  rawBriefText?: string;
  parsedBrief?: unknown;
}

const VALID_TIERS = new Set(['starter', 'professional', 'premium']);

/** Map a parsed brief (+ the raw text) to the create payload. The parser's
 *  capitalised budgetSignal lowercases to the tier enum; 'Unknown' (and
 *  anything off-enum) drops to undefined (the tier CHECK has no 'unknown').
 *  Accepts `parsed` loosely-typed to avoid a hard import cycle with AiService. */
export function parsedBriefToCreate(
  parsed: {
    projectName?: string;
    summary?: string;
    eventType?: string;
    dates?: string;
    location?: string;
    city?: string;
    guestCount?: number | null;
    durationDays?: number | null;
    budgetSignal?: string;
  },
  rawBriefText: string
): ProjectCreatePayload {
  const tier = (parsed.budgetSignal ?? '').toLowerCase();
  return {
    name: parsed.projectName?.trim() || undefined,
    description: parsed.summary?.trim() || undefined,
    eventType: parsed.eventType?.trim() || undefined,
    eventDate: parsed.dates?.trim() || undefined,
    venueName: parsed.location?.trim() || undefined,
    venueCity: parsed.city?.trim() || undefined,
    guestCount: parsed.guestCount ?? undefined,
    durationDays: parsed.durationDays ?? undefined,
    tier: VALID_TIERS.has(tier) ? (tier as ProjectCreatePayload['tier']) : undefined,
    rawBriefText: rawBriefText.trim() || undefined,
    parsedBrief: parsed,
  };
}

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
