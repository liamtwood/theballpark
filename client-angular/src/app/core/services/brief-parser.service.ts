import { Injectable } from '@angular/core';

/**
 * Rule-based brief parser — v1.30.
 *
 * Pure string processing, no API calls. Lives client-side so the
 * intake modal can show a populated Brief tab on the very next
 * navigation (no waiting on an LLM round-trip). Runs in well under
 * 10ms for the typical 1-2 paragraph brief.
 *
 * The AI "✦ Parse brief" button on the existing Brief tab (which
 * still uses Anthropic later) is a DIFFERENT, additive analysis path.
 * Both coexist — this parser bootstraps the project; the AI deepens
 * the analysis on demand.
 *
 * Test fixtures live next to the EXAMPLE_BRIEFS constant at the
 * bottom of this file — they're also what the modal's "Try an
 * example:" pills paste in.
 */

export interface ParsedBrief {
  eventName?: string;
  client?: string;
  venue?: string;
  city?: string;
  eventDate?: string;
  durationDays?: number;
  guestCount?: number;
  budget?: number;
  /** One of 'starter' | 'professional' | 'premium' | 'unknown' —
      stored verbatim on projects.tier (codes match the budget_tier
      codelist seeded in v1.30). */
  budgetSignal?: string;
  eventType?: string;
  categories: ParsedCategory[];
}

export interface ParsedCategory {
  /** Lookup key — the parser doesn't know real UUIDs, callers
      resolve via CategoryService.getAll() name-matching. */
  categoryName: string;
  requirementBrief: string;
  /** Numeric mid-point of the suggested band, or null if no overall
      budget was detected. */
  budgetEstimate: number | null;
  /** True when the category wasn't keyword-matched but inferred from
      a rule (e.g. H&S for outdoor events). */
  implied: boolean;
}

/** Category name → keyword bag. Names match the seed in
    `categories` (catalogue namespace, level-0). Case-insensitive
    substring match on `\bkeyword\b` boundaries. */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Stand Structure': [
    'stand', 'build', 'shell', 'booth', 'exhibition', 'island',
    'space-only', 'modular', 'structure', 'custom build', 'pop-up',
    'pop up', 'activation structure', 'fabrication', 'set build',
    // v1.34 — from parser-comparison on real briefs (Angel Delight,
    // Creditspring, Lavazza). Inflatables / shop takeovers / immersive
    // installations were all missed by the v1.30 keyword set.
    'inflatable', 'ball pit', 'pop-up shop', 'pop up shop',
    'takeover', 'immersive', 'experiential', 'installation',
    'weatherproof', 'sheltered'
  ],
  'Florals': [
    'floral', 'flower', 'arrangement', 'arch', 'bouquet', 'foliage',
    'botanical', 'rose', 'centrepiece', 'garland', 'dried flower',
    'pampas', 'greenery', 'table runner'
  ],
  'Lighting': [
    'light', 'lighting', 'led', 'uplighting', 'wash', 'spot',
    'spotlight', 'dimmer', 'fixture', 'gobo', 'festoon', 'fairy light',
    'neon', 'ambient', 'programmatic'
  ],
  'AV & Technology': [
    'av', 'audio', 'visual', 'screen', 'speaker', 'sound', 'video wall',
    'led wall', 'projector', 'microphone', 'streaming', 'hybrid',
    'camera', 'pa', 'dj', 'mixing',
    // v1.34 — sensory + broadcast vocabulary surfaced by Lavazza + TikTok
    'soundscape', 'aroma', 'scent', 'sensory', 'content capture',
    'tiktok live', 'livestream', 'broadcast'
  ],
  'Graphics & Signage': [
    'print', 'signage', 'graphic', 'banner', 'branding', 'vinyl',
    'backdrop', 'step and repeat', 'step & repeat', 'foam', 'foamex',
    'poster', 'wayfinding', 'decal', 'wrap', 'fascia', 'hoarding', 'merch',
    // v1.34 — agency lexicon for branded collateral & touring banners
    'merchandise', 'collateral', 'evergreen branding', 'removable banner'
  ],
  'Furniture & Fixtures': [
    'furniture', 'chair', 'table', 'sofa', 'lounge', 'stool', 'bar',
    'counter', 'shelving', 'display unit', 'plinth', 'pedestal', 'rug',
    'carpet', 'seating',
    // v1.34 — retail / workshop seating language (HelloFresh, Lavazza,
    // Creditspring)
    'retail', 'retail space', 'communal table', 'workstation',
    'cooking station', 'display'
  ],
  'Catering & Hospitality': [
    'catering', 'food', 'drink', 'canape', 'dinner', 'lunch', 'breakfast',
    'cocktail', 'coffee', 'tea', 'menu', 'chef', 'kitchen', 'grazing',
    'bowl food', 'buffet', 'sampling', 'tasting',
    // v1.34 — workshop / cookalong + sampling vocabulary
    'cookalong', 'cook along', 'cook-along', 'workshop', 'cookery',
    'food workshop', 'meal kit', 'recipe', 'free sample', 'sample'
  ],
  'Health & Safety': [
    'h&s', 'health and safety', 'rams', 'risk assessment', 'permit',
    'licence', 'license', 'fire', 'marshal', 'first aid', 'crowd',
    'barrier', 'stewarding',
    // v1.34
    'public liability', 'compliance', 'food safety'
  ],
  'Photography': [
    'photo', 'photographer', 'photography', 'videographer', 'video',
    'filming', 'reel', 'press', 'content',
    // v1.34 — influencer / earned-media lexicon
    'kol', 'influencer', 'creator', 'tastemaker',
    'picture moment', 'shareable', 'earned media', 'media coverage',
    'tier 1 media', 'coverage'
  ],
  'Staffing': [
    'staff', 'staffing', 'ambassador', 'crew', 'hostess', 'host',
    'event manager', 'registration', 'door', 'usher', 'steward',
    'runner', 'production staff',
    // v1.34 — agency staffing patterns
    'brand ambassador', 'project manager', 'event team'
  ],
  'Entertainment': [
    'entertainment', 'band', 'musician', 'performer', 'act', 'mc',
    'comedian', 'talent',
    // 'speaker' removed in v1.34 — too many false positives from
    // RFP boilerplate ("no speaker contact unless directed"). Reintroduce
    // only behind tighter context detection.
    // v1.34 — TikTok-style creator hierarchy
    'hero talent', 'micro creator', 'macro creator'
  ],
  'Logistics & Transport': [
    'logistics', 'transport', 'delivery', 'storage', 'parking',
    'shuttle', 'load in', 'load out', 'freight', 'courier', 'van', 'truck',
    // v1.34 — install + de-rig phases of an activation
    'de-rig', 'derig', 'dismantle', 'load-in', 'load-out', 'pitch'
  ],
  'Venue': [
    'venue', 'space', 'room', 'hall', 'location', 'hire', 'dry hire',
    'exclusive hire', 'private hire',
    // v1.34
    'venue sourcing', 'institution'
  ]
};

/** Approximate share of total budget per category (mid of the band).
    Sums roughly to 100% — order doesn't matter, used only to
    distribute when an overall budget was detected. */
const BUDGET_SHARE: Record<string, number> = {
  'Stand Structure':        0.35,
  'AV & Technology':        0.17,
  'Catering & Hospitality': 0.17,
  'Florals':                0.07,
  'Graphics & Signage':     0.07,
  'Lighting':               0.07,
  'Staffing':               0.06,
  'Photography':            0.04,
  'Furniture & Fixtures':   0.05,
  'Health & Safety':        0.03,
  'Entertainment':          0.05,
  'Logistics & Transport':  0.03,
  'Venue':                  0.10
};

/** Known venues keyed to their city — first-pass venue+city detection. */
const KNOWN_VENUES: Record<string, string> = {
  'ExCeL':                    'London',
  'Olympia':                  'London',
  'NEC':                      'Birmingham',
  'ICC':                      'Birmingham',
  'QEII':                     'London',
  'O2':                       'London',
  'Wembley':                  'London',
  'Barbican':                 'London',
  'Science Museum':           'London',
  'Natural History Museum':   'London',
  'V&A':                      'London',
  'Tate Modern':              'London',
  'Globe':                    'London',
  "Shakespeare's Globe":      'London',
  'Royal Albert Hall':        'London',
  'Earls Court':              'London',
  'Alexandra Palace':         'London',
  'Old Truman Brewery':       'London',
  'Tobacco Dock':             'London',
  'Printworks':               'London',
  'Magazine London':          'London',
  'Battersea Power Station':  'London',
  'Coal Drops Yard':          'London',
  // v1.34 — added from parser-comparison briefs
  'Truman Brewery':           'London',
  'Soho':                     'London',
  'Latitude':                 'Henham Park',
  'Latitude Festival':        'Henham Park'
};

const KNOWN_CITIES = [
  'London', 'Birmingham', 'Manchester', 'Edinburgh', 'Glasgow',
  'Bristol', 'Leeds', 'Liverpool', 'Cardiff', 'Brighton'
];

@Injectable({ providedIn: 'root' })
export class BriefParserService {

  parseBrief(text: string): ParsedBrief {
    const out: ParsedBrief = { categories: [] };
    if (!text || !text.trim()) return out;

    const lc = text.toLowerCase();

    // ── Date + duration ────────────────────────────────────────────
    const dateMatch = this.extractDate(text);
    if (dateMatch) {
      out.eventDate = dateMatch.label;
      if (dateMatch.durationDays) out.durationDays = dateMatch.durationDays;
    }

    // ── Guest count ────────────────────────────────────────────────
    const guests = this.extractGuestCount(lc);
    if (guests) out.guestCount = guests;

    // ── Budget + tier signal ───────────────────────────────────────
    const budget = this.extractBudget(text);
    if (budget) {
      out.budget = budget;
      out.budgetSignal = this.tierFromBudget(budget);
    } else {
      out.budgetSignal = 'unknown';
    }

    // ── Venue + city ───────────────────────────────────────────────
    const venue = this.extractVenue(text);
    if (venue) {
      out.venue = venue.name;
      if (venue.city) out.city = venue.city;
    }
    if (!out.city) {
      const city = this.extractCity(text);
      if (city) out.city = city;
    }

    // ── Event type (cheap heuristic) ───────────────────────────────
    out.eventType = this.inferEventType(lc);

    // ── Category detection from keywords ───────────────────────────
    const sentences = this.splitSentences(text);
    const matched = new Map<string, string[]>(); // category → sentences

    for (const cat of Object.keys(CATEGORY_KEYWORDS)) {
      const keywords = CATEGORY_KEYWORDS[cat];
      for (const sentence of sentences) {
        const slc = sentence.toLowerCase();
        if (keywords.some(k => this.wordMatch(slc, k))) {
          if (!matched.has(cat)) matched.set(cat, []);
          matched.get(cat)!.push(sentence.trim());
        }
      }
    }

    // Build categories from direct matches
    for (const [cat, sents] of matched.entries()) {
      out.categories.push({
        categoryName: cat,
        requirementBrief: this.cleanBrief(sents.join(' ')),
        budgetEstimate: null,
        implied: false
      });
    }

    // ── Implied categories ─────────────────────────────────────────
    this.applyImpliedCategories(lc, out);

    // ── Distribute budget across detected categories ───────────────
    if (out.budget) {
      for (const c of out.categories) {
        const share = BUDGET_SHARE[c.categoryName] ?? 0.04;
        c.budgetEstimate = Math.round(out.budget * share);
      }
    }

    return out;
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private wordMatch(haystack: string, needle: string): boolean {
    // For multi-word needles or those with special chars, fall back
    // to plain includes() rather than a word-boundary regex.
    if (/[\s&\-]/.test(needle)) return haystack.includes(needle);
    const re = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i');
    return re.test(haystack);
  }

  private splitSentences(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+|\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  private cleanBrief(s: string): string {
    let out = s.trim().replace(/\s+/g, ' ');
    if (out.length > 0) out = out.charAt(0).toUpperCase() + out.slice(1);
    // Soft length cap — beyond ~300 chars the brief becomes a wall.
    if (out.length > 320) out = out.slice(0, 317).trim() + '…';
    return out;
  }

  // ── Date ─────────────────────────────────────────────────────────

  private extractDate(text: string): { label: string; durationDays?: number } | null {
    // Day-range with month + optional year, e.g. "2-4 June 2026"
    const rangeRe = /(\d{1,2})\s*[-–to]+\s*(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{4})?/i;
    const rm = text.match(rangeRe);
    if (rm) {
      const d1 = parseInt(rm[1], 10);
      const d2 = parseInt(rm[2], 10);
      const dur = Math.max(d2 - d1 + 1, 1);
      const label = `${rm[1]}–${rm[2]} ${this.titleCase(rm[3])}${rm[4] ? ' ' + rm[4] : ''}`;
      return { label, durationDays: dur };
    }
    // Single date: "2 June 2026" / "June 2 2026" / "2nd June"
    const singleRe = /(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{4})?/i;
    const sm = text.match(singleRe);
    if (sm) {
      return { label: `${sm[1]} ${this.titleCase(sm[2])}${sm[3] ? ' ' + sm[3] : ''}` };
    }
    // ISO / slash dates
    const isoRe = /(\d{4})-(\d{2})-(\d{2})/;
    const im = text.match(isoRe);
    if (im) return { label: im[0] };
    const slashRe = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
    const lm = text.match(slashRe);
    if (lm) return { label: lm[0] };
    // Approximate
    const approxRe = /(late|early|mid[-\s]?|w\/c|week commencing)\s+([a-z]+)/i;
    const am = text.match(approxRe);
    if (am) return { label: `${am[1]} ${this.titleCase(am[2])}` };
    // Month + year
    const myRe = /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{4})/i;
    const ym = text.match(myRe);
    if (ym) return { label: `${this.titleCase(ym[1])} ${ym[2]}` };
    // TBC
    if (/\btbc\b|\btba\b/i.test(text)) return { label: 'TBC' };
    return null;
  }

  // ── Guest count ──────────────────────────────────────────────────

  private extractGuestCount(lc: string): number | null {
    const keys = '(?:guests?|pax|attendees?|people|capacity|covers?|delegates?|visitors?|audience)';
    // "up to 200 guests" / "200-250 guests" / "audience of 80"
    const ranges = [
      new RegExp(`(\\d{2,5})\\s*[\\-–]\\s*(\\d{2,5})\\s+${keys}`, 'i'),
      new RegExp(`up to\\s+(\\d{2,5})\\s+${keys}`, 'i'),
      new RegExp(`${keys}\\s+of\\s+(\\d{2,5})`, 'i'),
      new RegExp(`${keys}\\s*[:\\-]?\\s*(\\d{2,5})`, 'i'),
      new RegExp(`(\\d{2,5})\\s+${keys}`, 'i'),
      new RegExp(`capacity\\s+(\\d{2,5})`, 'i')
    ];
    for (const re of ranges) {
      const m = lc.match(re);
      if (m) {
        const a = parseInt(m[1], 10);
        const b = m[2] ? parseInt(m[2], 10) : null;
        return b ? Math.round((a + b) / 2) : a;
      }
    }
    return null;
  }

  // ── Budget ───────────────────────────────────────────────────────

  private extractBudget(text: string): number | null {
    // £20-22k, £25,000, £25k, $50,000, €30,000
    const rangeK = /([£$€])\s*(\d{1,3})\s*[\-–]\s*(\d{1,3})\s*[kK]\b/;
    const m1 = text.match(rangeK);
    if (m1) {
      const a = parseInt(m1[2], 10) * 1000;
      const b = parseInt(m1[3], 10) * 1000;
      return Math.round((a + b) / 2);
    }
    const singleK = /([£$€])\s*(\d{1,3})\s*[kK]\b/;
    const m2 = text.match(singleK);
    if (m2) return parseInt(m2[2], 10) * 1000;
    const fullNum = /([£$€])\s*(\d{1,3}(?:,\d{3})+|\d{4,8})/;
    const m3 = text.match(fullNum);
    if (m3) return parseInt(m3[2].replace(/,/g, ''), 10);
    return null;
  }

  private tierFromBudget(amount: number): string {
    if (amount > 50000) return 'premium';
    if (amount >= 15000) return 'professional';
    return 'starter';
  }

  // ── Venue + city ─────────────────────────────────────────────────

  private extractVenue(text: string): { name: string; city?: string } | null {
    for (const name of Object.keys(KNOWN_VENUES)) {
      const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i');
      if (re.test(text)) return { name, city: KNOWN_VENUES[name] };
    }
    // After "at "/"venue:"/"location:"
    const re = /(?:venue\s*[:\-]?\s*|at\s+|location\s*[:\-]?\s*|held at\s+|taking place at\s+)([A-Z][A-Za-z0-9 '&]+?)(?:\.|,|\n|$)/;
    const m = text.match(re);
    if (m) {
      const name = m[1].trim();
      // Only accept if 3–60 chars and has at least one capital — avoids false hits
      if (name.length >= 3 && name.length <= 60 && /[A-Z]/.test(name)) {
        return { name };
      }
    }
    return null;
  }

  private extractCity(text: string): string | null {
    for (const c of KNOWN_CITIES) {
      const re = new RegExp(`\\b${c}\\b`, 'i');
      if (re.test(text)) return c;
    }
    return null;
  }

  // ── Event type heuristic ─────────────────────────────────────────

  private inferEventType(lc: string): string | undefined {
    if (/\bactivation\b|\bpop[\s-]?up\b/.test(lc)) return 'activation';
    if (/\bexhibition\b|\btradeshow\b|\bexpo\b/.test(lc)) return 'exhibition';
    if (/\bconference\b|\bsummit\b/.test(lc)) return 'conference';
    if (/\blaunch\b/.test(lc)) return 'activation';
    if (/\bgala\b/.test(lc)) return 'gala';
    if (/\bsummer party\b/.test(lc)) return 'summer_party';
    if (/\baward(s)?\b/.test(lc)) return 'awards';
    if (/\bcorporate\b/.test(lc)) return 'corporate';
    if (/\bprivate\b/.test(lc)) return 'private';
    return undefined;
  }

  // ── Implied categories ───────────────────────────────────────────

  private applyImpliedCategories(lc: string, out: ParsedBrief) {
    const has = (name: string) => out.categories.some(c => c.categoryName === name);

    // Outdoor / public / festival → H&S
    if (!has('Health & Safety') &&
        /\b(outdoor|public|park|festival)\b/.test(lc)) {
      out.categories.push({
        categoryName: 'Health & Safety',
        requirementBrief: 'H&S assessment required for outdoor / public event.',
        budgetEstimate: null,
        implied: true
      });
    }

    // Media / press / launch / PR / KOL / influencer / earned media → Photography
    if (!has('Photography') &&
        /\b(media|press|launch|pr|kol|influencer|creator|tastemaker|earned media|tier 1|picture moment|social)\b/.test(lc)) {
      out.categories.push({
        categoryName: 'Photography',
        requirementBrief: 'Press and content photography for launch event.',
        budgetEstimate: null,
        implied: true
      });
    }

    // > 50 guests → Staffing
    if (!has('Staffing') && out.guestCount && out.guestCount > 50) {
      out.categories.push({
        categoryName: 'Staffing',
        requirementBrief: `Event staffing for ${out.guestCount} guests.`,
        budgetEstimate: null,
        implied: true
      });
    }

    // v1.34 — Product sampling in public → Catering + H&S (food safety)
    if (/\b(sampl(?:e|ing)|free sample|product sampling)\b/.test(lc)) {
      if (!has('Catering & Hospitality')) {
        out.categories.push({
          categoryName: 'Catering & Hospitality',
          requirementBrief: 'Sample handling, food safety and food hygiene compliance.',
          budgetEstimate: null,
          implied: true
        });
      }
      if (!has('Health & Safety')) {
        out.categories.push({
          categoryName: 'Health & Safety',
          requirementBrief: 'Food-safety risk assessment for product sampling.',
          budgetEstimate: null,
          implied: true
        });
      }
    }

    // v1.34 — Public-facing activation → Staffing
    if (!has('Staffing') &&
        /\b(activation|pop[\s-]?up|public|shop|launch)\b/.test(lc)) {
      out.categories.push({
        categoryName: 'Staffing',
        requirementBrief: 'Hosts / brand ambassadors for public-facing activation.',
        budgetEstimate: null,
        implied: true
      });
    }

    // v1.34 — Immersive / experiential / sensory → AV (sensory tech)
    if (!has('AV & Technology') &&
        /\b(immersive|experiential|sensory)\b/.test(lc)) {
      out.categories.push({
        categoryName: 'AV & Technology',
        requirementBrief: 'AV / sensory technology for immersive experience.',
        budgetEstimate: null,
        implied: true
      });
    }

    // v1.34 — Retail / sales element → Furniture for display
    if (!has('Furniture & Fixtures') &&
        /\b(retail|sales|merchandise|pre-order|purchase)\b/.test(lc)) {
      out.categories.push({
        categoryName: 'Furniture & Fixtures',
        requirementBrief: 'Display fixtures and retail furniture for sales area.',
        budgetEstimate: null,
        implied: true
      });
    }

    // v1.34 — Festival / outdoor build → Set build + Logistics
    if (/\b(festival|outdoor build|pitch|latitude)\b/.test(lc)) {
      if (!has('Stand Structure')) {
        out.categories.push({
          categoryName: 'Stand Structure',
          requirementBrief: 'Festival / outdoor build — fabricated structure for site delivery.',
          budgetEstimate: null,
          implied: true
        });
      }
      if (!has('Logistics & Transport')) {
        out.categories.push({
          categoryName: 'Logistics & Transport',
          requirementBrief: 'Festival logistics — install, transport, de-rig, on-site storage.',
          budgetEstimate: null,
          implied: true
        });
      }
    }

    // v1.34 — 50+ guests → Catering (food safety net even if not keyword-matched)
    if (!has('Catering & Hospitality') && out.guestCount && out.guestCount >= 50) {
      out.categories.push({
        categoryName: 'Catering & Hospitality',
        requirementBrief: `Catering for ${out.guestCount} guests across event duration.`,
        budgetEstimate: null,
        implied: true
      });
    }
  }

  private titleCase(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }
}

/** Three hardcoded examples for the modal's "Try an example:" pills.
    Drawn from the v14 prototype intake EXAMPLES list. */
export const EXAMPLE_BRIEFS: Array<{ key: string; label: string; projectName: string; client: string; text: string }> = [
  {
    key: 'angel-delight',
    label: 'Angel Delight',
    projectName: 'Angel Delight Activation',
    client: 'Angel Delight',
    text:
`Inflatable Jelly with a ball pit attached to it. Size depending on budget! People can go inside to grab a free sample and into the ball pit for a picture moment. Location somewhere where families with tweens visit. Timings: May Half term — budget for 1 day and 3 days (Thursday, Friday, Saturday). We need costing for the whole pop-up and running of it so inflatable, staff, bins for samples, location fee etc. Budget for 1 day: £40,000`
  },
  {
    key: 'creditspring',
    label: 'Creditspring',
    projectName: 'Creditspring Pop-up',
    client: 'Creditspring',
    text:
`Home Alone turns 35 this December. We propose a festive pop-up shop lending out Christmas must-haves (call it Home a Loan) in November helping families create magical moments without financial strain. Location: Soho — blank space already being sourced. Dates: Launch 19th November. Dressing on 18th, de-rig 20th. Budget: £20-22k`
  },
  {
    key: 'tiktok',
    label: 'TikTok Launch',
    projectName: 'TikTok SummerSkills Launch',
    client: 'TikTok',
    text:
`TikTok SummerSkills Launch Event. Create a launch event focused on 3 skills (STEM, literature, music), incorporating hero talent, media, teen attendees and broader stakeholders. Where: British institution in London (e.g. Shakespeare's Globe, Science Museum). When: Wednesday 23 July, approx 09:00-14:00. Attendees: 80-100. Includes: Venue sourcing, end-to-end production including merch, H&S/RAMS.`
  }
];
