import { GalleryImage } from '../media/media.types';

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
  /** Cover focal point (object-position %) + icon fallback + Unsplash
   *  attribution (pV2-MEDIA-01b). */
  coverFocalX: number;
  coverFocalY: number;
  iconName: string | null;
  iconColor: string | null;
  unsplashPhotographerName: string | null;
  unsplashPhotoUrl: string | null;
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
  /** pV2-CUSTOMS-01: a custom line has no catalogue backing / supplier. */
  isCustom: boolean;
  name: string | null;
  description: string | null;
  basePrice: number | null;
  /** Installed-price extras (from the catalogue item) — the Final Quote's
   *  Install / Deliverable toggle. */
  installCost: number | null;
  installDescription: string | null;
  /** How installCost applies: per_order | per_item | percentage (null = per_item). */
  installUnit: string | null;
  /** Persisted Install choice: null = default (on when there's an install
   *  cost), true/false = explicit. */
  installed: boolean | null;
  unit: string | null;
  imageUrl: string | null;
  quantity: number;
  /** Category (joined via the live item) — the Estimate tab groups by it;
   *  the cat card shows the cover image, else the Lucide icon. */
  categoryId: string | null;
  categoryName: string | null;
  categoryIconName: string | null;
  categoryCoverUrl: string | null;
  /** Supplier the item comes from (its catalogue owner) — the cart cat card
   *  groups "N items from <supplier>". */
  supplierId: string | null;
  supplierName: string | null;
  supplierCity: string | null;
  /** Coarse send-state (pV2-CART-01): to_send (in cart) → out_for_quote →
   *  quoted → booked / declined. Cart shows to_send; Final shows all + badge. */
  status: QuoteLineStatus;
  /** The ORIGINAL library item (the request) — the inbox brief renders this so
   *  it shows the library price/description, not the (revised) line. Null for
   *  custom lines (no catalogue backing). */
  libName?: string | null;
  libDescription?: string | null;
  libBasePrice?: number | null;
  libServices?: string | null;
  libImageUrl?: string | null;
  /** pV2-BUILDUP-03 — the catalogue item carries options (child items). */
  hasOptions?: boolean;
  /** pV2-BUILDUP-03 — set when this line is a picked option of another line;
   *  the Final Quote nests it under that parent + lists it in the item card. */
  optionOfLineId?: string | null;
  /** pV2-BUILDUP-04 — the line's extras (child component names), name-only. */
  extras?: string[];
  /** pV2-BUILDUP-04 — the line's Details free-text (markdown). */
  details?: string | null;
  /** pV2-BUILDUP-04 — the AGENT's client-facing description (what prints on the
   *  Quote document). Agent-owned on any line; null falls back to `description`
   *  (the supplier text). */
  quoteDescription?: string | null;
  /** The line's supplier default currency (ISO code) — e.g. 'GBP', 'USD'. */
  supplierCurrency?: string | null;
}

/** Per-item send-state — the single switch between the cart and final views. */
export type QuoteLineStatus = 'to_send' | 'out_for_quote' | 'quoted' | 'booked' | 'declined';

/** The server-computed estimate cascade (server: services/estimate.js →
 *  GET /:id/estimate). The Estimate tab renders this directly — the cascade
 *  math lives ONLY on the server so the tab and the project card can't drift. */
export interface EstimateBreakdown {
  /** Raw supplier hard costs (before the silent margin markup). */
  hardCosts: number;
  marginPct: number;
  /** Margin silently baked into projectCosts (= projectCosts − hardCosts). */
  marginAmount: number;
  /** Displayed Project Costs = hardCosts × (1 + margin%). */
  projectCosts: number;
  contingencyPct: number;
  contingency: number;
  /** >0 when insurance is a %, else 0 (a fixed £ amount, or none). */
  insurancePct: number;
  /** Resolved insurance amount (from the % or the fixed £). */
  insurance: number;
  /** contingency + insurance. */
  coverage: number;
  /** Σ the agent's own fee lines (uncategorised). */
  fees: number;
  /** projectCosts + coverage + fees (ex-VAT). */
  projectTotal: number;
  // Back-compat aliases.
  subtotal: number;
  clientTotal: number;
}

/** A quote's lines grouped by category. */
export interface QuoteGroup {
  id: string;
  name: string;
  items: QuoteLine[];
}

/** Group quote lines by category (snapshot id), in insertion order — the
 *  server returns them category-ordered. Shared by the Estimate tab and the
 *  cart rail (audit M6: was duplicated in both). */
export function groupByCategory(lines: QuoteLine[]): QuoteGroup[] {
  const byCat = new Map<string, QuoteGroup>();
  for (const l of lines) {
    const id = l.categoryId ?? '__none';
    const g = byCat.get(id) ?? { id, name: l.categoryName ?? 'Uncategorised', items: [] };
    g.items.push(l);
    byCat.set(id, g);
  }
  return [...byCat.values()];
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
  /** Financial defaults — the Estimate tab breakdown (v1 formula). */
  defaultMarginPct: number | null;
  defaultContingencyPct: number | null;
  /** Insurance: a % of project costs (like contingency; a flat cost is a Fee). */
  defaultInsurancePct: number | null;
  defaultVatPct: number | null;
  /** Quote document options (per project) — colour theme + footer text. */
  quoteThemeMode: 'default' | 'bw' | 'color' | null;
  quoteThemeColor: string | null;
  quoteFooter: string | null;
  quoteShowCreated: boolean | null;
  quoteShowVatNote: boolean | null;
  quoteShowPageNumbers: boolean | null;
  quoteShowItemDesc: boolean | null;
  quoteShowOverview: boolean | null;
  quoteShowSummary: boolean | null;
  /** Media (pV2-MEDIA-01b). */
  coverFocalX: number;
  coverFocalY: number;
  clientLogoUrl: string | null;
  cardColor: string | null;
  iconName: string | null;
  iconColor: string | null;
  unsplashPhotographerName: string | null;
  unsplashPhotoUrl: string | null;
  /** Gallery strip (pV2-MEDIA-01c) — ordered; primary lives in cover_* above. */
  images: GalleryImage[];
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
  clientName: string | null;
  projectBudget: number | null;
  currency: string;
  tier: 'starter' | 'professional' | 'premium' | null;
  status: 'draft' | 'active' | 'completed' | 'archived';
  defaultMarginPct: number | null;
  defaultContingencyPct: number | null;
  defaultInsurancePct: number | null;
  defaultVatPct: number | null;
  quoteThemeMode: 'default' | 'bw' | 'color' | null;
  quoteThemeColor: string | null;
  quoteFooter: string | null;
  quoteShowCreated: boolean | null;
  quoteShowVatNote: boolean | null;
  quoteShowPageNumbers: boolean | null;
  quoteShowItemDesc: boolean | null;
  quoteShowOverview: boolean | null;
  quoteShowSummary: boolean | null;
  coverImageUrl: string | null;
  clientLogoUrl: string | null;
  cardColor: string | null;
  iconName: string | null;
  iconColor: string | null;
  coverFocalX: number | null;
  coverFocalY: number | null;
  unsplashPhotographerName: string | null;
  unsplashPhotoUrl: string | null;
  images: GalleryImage[];
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
