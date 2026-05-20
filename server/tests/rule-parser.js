// Node port of client-angular/src/app/core/services/brief-parser.service.ts.
// Used by parser-comparison.js to run the rule-based parser without the
// Angular app. Logic is copied verbatim — re-sync this file when the
// Angular parser changes. AUDIT/COMPARISON HARNESS ONLY.
//
// The comparison-driven keyword + inference upgrades live in this file
// AND the Angular service; both are bumped together so the rule parser
// only has one source of truth — the Angular file — and this Node file
// mirrors it.

const CATEGORY_KEYWORDS = {
  'Stand Structure': [
    'stand', 'build', 'shell', 'booth', 'exhibition', 'island',
    'space-only', 'modular', 'structure', 'custom build', 'pop-up',
    'pop up', 'activation structure', 'fabrication', 'set build',
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
    'soundscape', 'aroma', 'scent', 'sensory', 'content capture',
    'tiktok live', 'livestream', 'broadcast'
  ],
  'Graphics & Signage': [
    'print', 'signage', 'graphic', 'banner', 'branding', 'vinyl',
    'backdrop', 'step and repeat', 'step & repeat', 'foam', 'foamex',
    'poster', 'wayfinding', 'decal', 'wrap', 'fascia', 'hoarding', 'merch',
    'merchandise', 'collateral', 'evergreen branding', 'removable banner'
  ],
  'Furniture & Fixtures': [
    'furniture', 'chair', 'table', 'sofa', 'lounge', 'stool', 'bar',
    'counter', 'shelving', 'display unit', 'plinth', 'pedestal', 'rug',
    'carpet', 'seating',
    'retail', 'retail space', 'communal table', 'workstation',
    'cooking station', 'display'
  ],
  'Catering & Hospitality': [
    'catering', 'food', 'drink', 'canape', 'dinner', 'lunch', 'breakfast',
    'cocktail', 'coffee', 'tea', 'menu', 'chef', 'kitchen', 'grazing',
    'bowl food', 'buffet', 'sampling', 'tasting',
    'cookalong', 'cook along', 'cook-along', 'workshop', 'cookery',
    'food workshop', 'meal kit', 'recipe', 'free sample', 'sample'
  ],
  'Health & Safety': [
    'h&s', 'health and safety', 'rams', 'risk assessment', 'permit',
    'licence', 'license', 'fire', 'marshal', 'first aid', 'crowd',
    'barrier', 'stewarding',
    'public liability', 'compliance', 'food safety'
  ],
  'Photography': [
    'photo', 'photographer', 'photography', 'videographer', 'video',
    'filming', 'reel', 'press', 'content',
    'kol', 'influencer', 'creator', 'tastemaker',
    'picture moment', 'shareable', 'earned media', 'media coverage',
    'tier 1 media', 'coverage'
  ],
  'Staffing': [
    'staff', 'staffing', 'ambassador', 'crew', 'hostess', 'host',
    'event manager', 'registration', 'door', 'usher', 'steward',
    'runner', 'production staff',
    'brand ambassador', 'project manager', 'event team'
  ],
  'Entertainment': [
    'entertainment', 'band', 'musician', 'performer', 'act', 'mc',
    'comedian', 'talent',
    // 'speaker' removed — false positives from RFP boilerplate
    'hero talent', 'micro creator', 'macro creator'
  ],
  'Logistics & Transport': [
    'logistics', 'transport', 'delivery', 'storage', 'parking',
    'shuttle', 'load in', 'load out', 'freight', 'courier', 'van', 'truck',
    'de-rig', 'derig', 'dismantle', 'load-in', 'load-out', 'pitch'
  ],
  'Venue': [
    'venue', 'space', 'room', 'hall', 'location', 'hire', 'dry hire',
    'exclusive hire', 'private hire',
    'venue sourcing', 'institution'
  ]
};

const BUDGET_SHARE = {
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

const KNOWN_VENUES = {
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
  'Truman Brewery':           'London',
  'Soho':                     'London',
  'Latitude':                 'Henham Park',
  'Latitude Festival':        'Henham Park'
};

const KNOWN_CITIES = [
  'London', 'Birmingham', 'Manchester', 'Edinburgh', 'Glasgow',
  'Bristol', 'Leeds', 'Liverpool', 'Cardiff', 'Brighton'
];

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function wordMatch(haystack, needle) {
  if (/[\s&\-]/.test(needle)) return haystack.includes(needle.toLowerCase());
  const re = new RegExp(`\\b${escapeRe(needle)}\\b`, 'i');
  return re.test(haystack);
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function cleanBrief(s) {
  let out = s.trim().replace(/\s+/g, ' ');
  if (out.length > 0) out = out.charAt(0).toUpperCase() + out.slice(1);
  if (out.length > 320) out = out.slice(0, 317).trim() + '…';
  return out;
}

function titleCase(s) { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }

function extractDate(text) {
  const rangeRe = /(\d{1,2})\s*[-–to]+\s*(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{4})?/i;
  const rm = text.match(rangeRe);
  if (rm) {
    const d1 = parseInt(rm[1], 10);
    const d2 = parseInt(rm[2], 10);
    const dur = Math.max(d2 - d1 + 1, 1);
    const label = `${rm[1]}–${rm[2]} ${titleCase(rm[3])}${rm[4] ? ' ' + rm[4] : ''}`;
    return { label, durationDays: dur };
  }
  const singleRe = /(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{4})?/i;
  const sm = text.match(singleRe);
  if (sm) return { label: `${sm[1]} ${titleCase(sm[2])}${sm[3] ? ' ' + sm[3] : ''}` };
  const isoRe = /(\d{4})-(\d{2})-(\d{2})/;
  const im = text.match(isoRe);
  if (im) return { label: im[0] };
  const slashRe = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
  const lm = text.match(slashRe);
  if (lm) return { label: lm[0] };
  const approxRe = /(late|early|mid[-\s]?|w\/c|week commencing)\s+([a-z]+)/i;
  const am = text.match(approxRe);
  if (am) return { label: `${am[1]} ${titleCase(am[2])}` };
  const myRe = /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{4})/i;
  const ym = text.match(myRe);
  if (ym) return { label: `${titleCase(ym[1])} ${ym[2]}` };
  if (/\btbc\b|\btba\b/i.test(text)) return { label: 'TBC' };
  return null;
}

function extractGuestCount(lc) {
  const keys = '(?:guests?|pax|attendees?|people|capacity|covers?|delegates?|visitors?|audience)';
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

function extractBudget(text) {
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

function tierFromBudget(amount) {
  if (amount > 50000) return 'premium';
  if (amount >= 15000) return 'professional';
  return 'starter';
}

function extractVenue(text) {
  for (const name of Object.keys(KNOWN_VENUES)) {
    const re = new RegExp(`\\b${escapeRe(name)}\\b`, 'i');
    if (re.test(text)) return { name, city: KNOWN_VENUES[name] };
  }
  const re = /(?:venue\s*[:\-]?\s*|at\s+|location\s*[:\-]?\s*|held at\s+|taking place at\s+)([A-Z][A-Za-z0-9 '&]+?)(?:\.|,|\n|$)/;
  const m = text.match(re);
  if (m) {
    const name = m[1].trim();
    if (name.length >= 3 && name.length <= 60 && /[A-Z]/.test(name)) {
      return { name };
    }
  }
  return null;
}

function extractCity(text) {
  for (const c of KNOWN_CITIES) {
    const re = new RegExp(`\\b${c}\\b`, 'i');
    if (re.test(text)) return c;
  }
  return null;
}

function inferEventType(lc) {
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

function applyImpliedCategories(lc, out) {
  const has = (name) => out.categories.some(c => c.categoryName === name);

  if (!has('Health & Safety') &&
      /\b(outdoor|public|park|festival)\b/.test(lc)) {
    out.categories.push({
      categoryName: 'Health & Safety',
      requirementBrief: 'H&S assessment required for outdoor / public event.',
      budgetEstimate: null,
      implied: true
    });
  }

  if (!has('Photography') &&
      /\b(media|press|launch|pr|kol|influencer|creator|tastemaker|earned media|tier 1|picture moment|social)\b/.test(lc)) {
    out.categories.push({
      categoryName: 'Photography',
      requirementBrief: 'Press and content photography for launch event.',
      budgetEstimate: null,
      implied: true
    });
  }

  if (!has('Staffing') && out.guestCount && out.guestCount > 50) {
    out.categories.push({
      categoryName: 'Staffing',
      requirementBrief: `Event staffing for ${out.guestCount} guests.`,
      budgetEstimate: null,
      implied: true
    });
  }

  // v1.34
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

  if (!has('Staffing') &&
      /\b(activation|pop[\s-]?up|public|shop|launch)\b/.test(lc)) {
    out.categories.push({
      categoryName: 'Staffing',
      requirementBrief: 'Hosts / brand ambassadors for public-facing activation.',
      budgetEstimate: null,
      implied: true
    });
  }

  if (!has('AV & Technology') &&
      /\b(immersive|experiential|sensory)\b/.test(lc)) {
    out.categories.push({
      categoryName: 'AV & Technology',
      requirementBrief: 'AV / sensory technology for immersive experience.',
      budgetEstimate: null,
      implied: true
    });
  }

  if (!has('Furniture & Fixtures') &&
      /\b(retail|sales|merchandise|pre-order|purchase)\b/.test(lc)) {
    out.categories.push({
      categoryName: 'Furniture & Fixtures',
      requirementBrief: 'Display fixtures and retail furniture for sales area.',
      budgetEstimate: null,
      implied: true
    });
  }

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

  if (!has('Catering & Hospitality') && out.guestCount && out.guestCount >= 50) {
    out.categories.push({
      categoryName: 'Catering & Hospitality',
      requirementBrief: `Catering for ${out.guestCount} guests across event duration.`,
      budgetEstimate: null,
      implied: true
    });
  }
}

function parseBrief(text) {
  const out = { categories: [] };
  if (!text || !text.trim()) return out;
  const lc = text.toLowerCase();

  const dateMatch = extractDate(text);
  if (dateMatch) {
    out.eventDate = dateMatch.label;
    if (dateMatch.durationDays) out.durationDays = dateMatch.durationDays;
  }

  const guests = extractGuestCount(lc);
  if (guests) out.guestCount = guests;

  const budget = extractBudget(text);
  if (budget) {
    out.budget = budget;
    out.budgetSignal = tierFromBudget(budget);
  } else {
    out.budgetSignal = 'unknown';
  }

  const venue = extractVenue(text);
  if (venue) {
    out.venue = venue.name;
    if (venue.city) out.city = venue.city;
  }
  if (!out.city) {
    const city = extractCity(text);
    if (city) out.city = city;
  }

  out.eventType = inferEventType(lc);

  const sentences = splitSentences(text);
  const matched = new Map();
  for (const cat of Object.keys(CATEGORY_KEYWORDS)) {
    const keywords = CATEGORY_KEYWORDS[cat];
    for (const sentence of sentences) {
      const slc = sentence.toLowerCase();
      if (keywords.some(k => wordMatch(slc, k))) {
        if (!matched.has(cat)) matched.set(cat, []);
        matched.get(cat).push(sentence.trim());
      }
    }
  }
  for (const [cat, sents] of matched.entries()) {
    out.categories.push({
      categoryName: cat,
      requirementBrief: cleanBrief(sents.join(' ')),
      budgetEstimate: null,
      implied: false
    });
  }

  applyImpliedCategories(lc, out);

  if (out.budget) {
    for (const c of out.categories) {
      const share = BUDGET_SHARE[c.categoryName] ?? 0.04;
      c.budgetEstimate = Math.round(out.budget * share);
    }
  }

  return out;
}

module.exports = { parseBrief };
