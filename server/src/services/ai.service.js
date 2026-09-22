const SYSTEM_PROMPT = `You are a senior London event production planner with 15 years of agency experience. Read this brief and return ONLY valid JSON — no markdown, no explanation, no backticks.

You will receive briefs in many formats: casual emails, formal RFPs, creative decks, WhatsApp messages. Extract the signal from the noise — ignore procurement boilerplate, T&Cs, and submission instructions. Focus on what needs to be BUILT and DELIVERED.

SPLITTING RULES:
- Items that are separate costs MUST be separate categories. AV and lighting are always two items. Public catering and VIP catering are always two. Set build and set dressing are always two.

HARD RULES — non-negotiable, must be applied EVERY TIME the trigger fires:
- ANY mention of food, drink, meal, lunch, dinner, breakfast, brunch, canapés, refreshments, bar, drinks reception, hospitality, F&B, cocktails, wine, beer, coffee, tea → MUST include catering. No exceptions, even if the brief is short.
- ANY mention of comedian, band, DJ, performer, performance, entertainment, music, MC, host → MUST include entertainment.
- ANY mention of presentation, demo, screen, projection, AV, sound, mic, microphone, LED, speakers → MUST include av.
- ANY mention of photographer, video, content capture, social, KOL → MUST include photography.
- ANY mention of venue search, find venue, source venue, secure space → MUST include venues.

INFERENCE RULES — apply when context suggests:
- Outdoor or public location → add h-and-s (implied)
- Media, press, KOL, or launch → add photography (implied)
- Public-facing activation with guests → add staffing (implied)
- Festival or outdoor build → add set-build
- 50+ guests at 4+ hour event → add catering (implied)
- Product sampling → add catering for food safety (implied)
- Immersive/experiential → add av for sensory tech (implied)
- Retail/sales element → add furniture for display (implied)

DATE RESOLUTION RULE — always apply:
Resolve relative dates to actual dates. May Half Term = 25-30 May. Easter = lookup (Sun + Mon following Good Friday). Bank holidays = lookup. Christmas Eve / Christmas Day = 24/25 December. New Year's Eve = 31 December. If year not stated, assume next occurrence (i.e. the next date matching that description after today). Return the resolved date in the "dates" field; preserve the user's phrasing if helpful, e.g. "May Half Term — 25-30 May 2026".

DETAIL STANDARD:
Each category oneLiner must be specific enough for a supplier to start quoting. Not "set build" but "Custom inflatable jelly structure with ball pit, approx 4m tall, Angel Delight branded, engineered for public interaction." Dimensions, quantities, brands, durations where mentioned.

FORMATTING — applies to every oneLiner and the summary:
- Plain prose: one or two complete sentences, sentence case, ending with a full stop.
- NO bullet points, dashes, asterisks, numbering, markdown or line breaks inside a field.
- Specs (dimensions, quantities, brands) sit inline within the sentence, never as a list.

Return exactly:
{
  "projectName": "Client — Event Type",
  "client": "brand or company name",
  "eventType": "activation|exhibition|launch|festival|pop-up|conference|gala|experience",
  "location": "venue or area or TBC",
  "city": "city name",
  "dates": "dates or TBC",
  "durationDays": number or null,
  "guestCount": number or null,
  "budget": "£X,000 or Unknown",
  "budgetSignal": "Premium|Professional|Starter|Unknown",
  "summary": "One punchy sentence — specific not generic",
  "categories": [
    {
      "categoryId": "set-build|print|av|floral|venues|catering|photography|staffing|h-and-s|furniture|logistics|entertainment|lighting",
      "categoryLabel": "human readable label",
      "oneLiner": "Specific supplier-ready brief with dimensions, quantities, requirements.",
      "budgetEstimate": "£X,000–£Y,000 or null",
      "implied": false
    }
  ],
  "topQuestions": [
    "Max 3 questions — genuine blockers that stop suppliers quoting. Specific not vague."
  ]
}`;

// ── shared guided-Haiku call ─────────────────────────────────────────────────
// One place for the Anthropic Haiku + JSON-out plumbing: guided SYSTEM prompt,
// maxRetries:8 (rides out transient 429/5xx/529 overloads), JSON.parse with a
// markdown-fence fallback, and the 503 mapping for overloads. Reused by the
// inbox brief parser AND the catalogue extract (analyse + pull). Returns
// { parsed, raw } — parsed is null when the model didn't return usable JSON.
async function callHaikuJson({ system, user, maxTokens = 2000 }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error('ANTHROPIC_API_KEY is not configured');
    err.status = 500;
    throw err;
  }
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 8 });

  let message;
  try {
    message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });
  } catch (e) {
    const status = e && e.status;
    const type = e && e.error && e.error.error && e.error.error.type;
    if (status === 429 || status === 529 || (status >= 500 && status < 600)
        || type === 'overloaded_error' || type === 'rate_limit_error') {
      const err = new Error('The AI service is busy right now — please try again in a moment.');
      err.status = 503;
      throw err;
    }
    throw e;
  }

  const raw = message.content[0].text;
  try {
    return { parsed: JSON.parse(raw), raw };
  } catch {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try { return { parsed: JSON.parse(jsonMatch[1].trim()), raw }; } catch { /* fall through */ }
    }
    return { parsed: null, raw };
  }
}

async function parseBrief(rawBriefText) {
  const { parsed, raw: responseText } = await callHaikuJson({
    system: SYSTEM_PROMPT,
    user: `Scope this event brief into production categories:\n\n${rawBriefText}`,
    maxTokens: 2000,
  });

  // v1.39d — log what Haiku returns so we can verify mapping
  // gaps against what hits the create payload. Truncated to keep
  // server logs readable; full body is in the API response.
  if (parsed) {

    // v1.51b — formatting cleanup: strip any bullet residue / stray line
    // breaks the model leaves in oneLiners + summary, so the brief reads
    // as clean prose everywhere downstream (Brief tab, outreach email).
    const tidy = (s) => typeof s === 'string'
      ? s.replace(/[\r\n]+/g, ' ')
          .replace(/^[\s•·\-–—*]+/, '')
          .replace(/\s{2,}/g, ' ')
          .trim()
      : s;
    if (Array.isArray(parsed.categories)) {
      for (const c of parsed.categories) {
        if (c && typeof c.oneLiner === 'string') c.oneLiner = tidy(c.oneLiner);
      }
    }
    if (parsed.summary) parsed.summary = tidy(parsed.summary);

    console.log('[ai.parseBrief] response',
      JSON.stringify({
        projectName:  parsed.projectName,
        client:       parsed.client,
        eventType:    parsed.eventType,
        dates:        parsed.dates,
        durationDays: parsed.durationDays,
        guestCount:   parsed.guestCount,
        budget:       parsed.budget,
        budgetSignal: parsed.budgetSignal,
        location:     parsed.location,
        city:         parsed.city,
        categoryCount: (parsed.categories || []).length,
        questionCount: (parsed.topQuestions || []).length,
        categories: (parsed.categories || []).map(c => ({
          id: c.categoryId, label: c.categoryLabel,
          oneLinerChars: (c.oneLiner || '').length,
          budget: c.budgetEstimate, implied: c.implied
        }))
      }, null, 2)
    );
    return parsed;
  }
  // callHaikuJson already tried the markdown-fence fallback; nothing usable.
  return { raw_response: responseText };
}

// ── pV2-STORE-EXTRACT-01 — website catalogue extract (Analyse → Pull) ─────────
// Two guided-Haiku steps over the visible text of ONE supplier page, reusing the
// callHaikuJson plumbing above. "Guided by our schema, honest about everything
// else": look for what Ballpark expects, MENTION whatever else is on the page.

const ANALYSE_SYSTEM = `You are a catalogue analyst for Ballpark, an event-production marketplace. You are given the visible text (and some link hrefs) of ONE web page from a supplier's website. Return ONLY valid JSON — no markdown, no backticks.

Ballpark holds SUPPLIERS with ITEMS. An item has: name, price (ex-VAT), description, category + subcategory, unit, optional volume price tiers, optional single-group options (e.g. colour/size choices), known attributes (e.g. dimensions), and a supplier item id / SKU. Categories are event-production areas (furniture, AV, catering, print, lighting, staffing, floral, venues, logistics, decor, ...).

Analyse this page, GUIDED BY that schema but HONEST about everything else:
1. Classify the page shape: "detail" (one product), "listing" (a category/collection linking to product pages), or "marketing" (no structured catalogue — homepage/solutions/portfolio).
2. Verdict: if pull-able, say roughly how many items and which categories; if not, "no catalogue — onboard manually" and why.
3. mapped: what MAPS to Ballpark — categories seen, item count, whether per-item price (ex-VAT) is present, whether volume tiers are present, whether options are present, which known attributes are present, whether a supplier item id / SKU is present, whether product images are present.
4. alsoFound: EVERYTHING else on the page that does NOT fit the schema above — every attribute, spec, feature or concept you notice (e.g. venue capacity, packages/bundles, multi-dimension variant matrices, delivery terms, certifications, minimum order). Nothing dropped — this is how we learn what to build next.
5. sample: ONE item fully parsed (name, price, short description, attributes{}, sku, images[] — the product photo URLs from the IMAGES ON PAGE list) so the reviewer can judge extraction quality AND see the photos that'll be pulled. Null if marketing.
6. productLinks: on a LISTING page, the product-detail URLs visible (absolute or relative), so they can be pulled. Empty otherwise.

Return exactly:
{ "pageShape":"detail|listing|marketing", "verdict":"one honest sentence", "pullable": true, "estimatedItems": 0, "mapped": { "categories":[], "itemCount": 0, "hasPrice": false, "hasVolumeTiers": false, "hasOptions": false, "hasSku": false, "hasImages": false, "knownAttributes":[] }, "alsoFound":[], "sample": null, "productLinks":[] }`;

const PULL_SYSTEM = `You are a catalogue extractor for Ballpark. Given the visible text (and link hrefs) of ONE product page, extract the product as JSON. Return ONLY valid JSON — no markdown, no backticks.

Rules:
- base_price is EX-VAT, a plain number (strip currency symbols/VAT). If a range or "from £X", use the lowest as base_price and note the rest in attributes.
- description: clean prose, 1-4 sentences, no bullets/markdown/line-breaks.
- attributes: route EVERY spec you find into ONE of these 5 groups BY MEANING (never invent). Each group is an array of {"label","value"}:
    • measurements — physical measures; INCLUDE the unit in the value (e.g. {"label":"Width","value":"39 cm"}, {"label":"Weight","value":"3.4 kg"}).
    • materials — what it's made of (Material, Composition, Band Material, Crystal…).
    • style — how it looks (Colour as info, Shape, Finish, Pattern…).
    • features — capabilities (Stackable, Water Resistant, Foldable, Movement Type…).
    • specifications — general specs AND the CATCH-ALL for anything that fits no other group (so nothing is lost).
  Omit a group or use [] when it has nothing.
- priceTiers: volume/quantity price breaks if present, ONE object per tier: [{ "min": 1, "max": 49, "price": 3.75 }, { "min": 50, "max": 99, "price": 3.40 }, { "min": 100, "max": null, "price": 2.99 }]. min = that tier's LOWER quantity threshold — DISTINCT per tier (1, then 50, then 100 — never 1 for all); max = its upper bound (null for the final open-ended tier); price = the ex-VAT unit price at that quantity. Empty if none.
- options: selectable priced CHOICES if the page has a variant/colour/size selector: [{ "name": "Medium Orange", "price": 0 }] — price is the ADDITIVE delta ex-VAT (0 when included). Empty if none. Flatten multiple groups into descriptive names (e.g. "Medium Orange", "Large Black").
- unit: how it's sold — 'each' | 'day' | 'hour' | 'head' (per guest) | 'm2' etc. Default 'each'.
- category: pick the SINGLE best-fit Ballpark category — use EXACTLY one of the category strings listed in the user message (verbatim); null only if none genuinely fit. (E.g. a chiavari chair → "Furniture & Fixtures".)
- Map to these REAL fields when present (else null): install_description (setup/delivery/installation services offered, prose), install_cost (number, ex-VAT), lead_time_days (number).
- images: from the IMAGES ON PAGE list, pick ALL photos of THIS product (every angle/variant/close-up shown — usually 1-4), hero photo FIRST. Exclude logos, icons, sprites, and thumbnails of OTHER products.
- Supplier identity (capture ALL that appear, else null): sku (product code/SKU), product_id (numeric/internal id, incl. in the URL), supplier_ref (any other stable reference).
- noHome: the HONEST GAP LIST — data clearly present on this page that does NOT fit anything above (so we would drop it). This is how we learn what to build. Include, one object each:
    • a NAMED SECTION whose heading isn't one of our 5 attribute groups (e.g. "Manufacturer", "Connectivity / In the box", "Downloads") — label = the section/field name, value = a short example, kind = "section".
    • a NON-key:value asset: a document/spec-sheet/user-guide/manual LINK (kind = "link" or "document"), value = the link text or URL.
    • a per-combination VARIANT MATRIX (each size×colour its own price/SKU) — kind = "variant-matrix".
    • commercial terms with no field: delivery zones, minimum order qty, hire/rental periods (kind = "terms").
  Shape: [{ "label":"Manufacturer", "value":"Sony", "kind":"section" }]. Empty [] when everything genuinely fit. Do NOT list things you already placed above.

Return exactly:
{ "name":"", "base_price": null, "description":"", "unit":"each", "category": null, "install_description": null, "install_cost": null, "lead_time_days": null, "attributes": { "specifications":[], "features":[], "style":[], "measurements":[], "materials":[] }, "priceTiers":[], "options":[], "images":[], "sku": null, "product_id": null, "supplier_ref": null, "noHome":[] }`;

/** ANALYSE (read-only): a structured report on ONE page's catalogue-worthiness. */
async function analyseCatalogue(pageText, url) {
  const { parsed, raw } = await callHaikuJson({
    system: ANALYSE_SYSTEM,
    user: `Source URL: ${url}\n\nPage content:\n${pageText}`,
    maxTokens: 2000,
  });
  return parsed || { pageShape: 'marketing', verdict: 'Could not analyse this page automatically.', pullable: false, mapped: {}, alsoFound: [], sample: null, productLinks: [], raw_response: raw };
}

/** PULL: extract ONE product from a detail page into the item shape.
 *  `categoryNames` is Ballpark's controlled category vocabulary — passed so the
 *  model maps to OUR categories (e.g. "Chair Hire" → "Furniture & Fixtures")
 *  instead of echoing the supplier's own wording. */
async function extractProduct(pageText, url, categoryNames = []) {
  const catLine = categoryNames.length
    ? `\n\nBallpark categories — choose ONE exact string for "category" (or null if none fit):\n${categoryNames.join(', ')}`
    : '';
  const { parsed, raw } = await callHaikuJson({
    system: PULL_SYSTEM,
    user: `Source URL: ${url}${catLine}\n\nProduct page content:\n${pageText}`,
    maxTokens: 2000,
  });
  return parsed || { raw_response: raw };
}

const CLASSIFY_GROUP_SYSTEM = `You map a SUPPLIER's own product category onto Ballpark's taxonomy. Return ONLY valid JSON — no markdown.

You are given: the supplier's category label (how THEY group these items), a sample product name, and Ballpark's categories each with their existing subcategories. The supplier grouped these deliberately — respect that grouping.

Decide, for the WHOLE group:
1. category: the single best-fit Ballpark category — EXACTLY one "category" string from the list (never invent a category).
2. subcategory: the best existing subcategory UNDER that category (exact string from its list) IF one clearly fits or is close (e.g. supplier "Gazebo Hire" ≈ existing "Outdoor & Tensile Structure"? only if genuinely close).
   If NONE is close, propose a NEW subcategory: set subcategory to a clean, house-style name derived from the supplier label — Title Case, NO "Hire"/"Rental" suffix, prefer a short plural noun (e.g. "Gazebo Hire" → "Gazebos", "Chair Hire" → "Chairs"), and set isNew true.
3. confidence: 0..1 for the category pick.

Return exactly: { "category":"", "subcategory":"", "isNew": false, "confidence": 0 }`;

/** PREPARE: map ONE supplier group (their category) → Ballpark category + subcategory.
 *  `tree` = [{ name, subcats:[name…] }] (the real marketplace taxonomy). One cheap
 *  call per SELECTED group — we only AI what we're about to load. Returns
 *  { category, subcategory, isNew, confidence }. */
async function classifyGroup(supplierLabel, sampleName, tree = []) {
  const catBlock = tree
    .map((c) => `- ${c.name}: ${(c.subcats || []).join(', ') || '(no subcategories yet)'}`)
    .join('\n');
  const { parsed } = await callHaikuJson({
    system: CLASSIFY_GROUP_SYSTEM,
    user: `Supplier category label: "${supplierLabel}"\nSample product: "${sampleName || ''}"\n\nBallpark categories and their subcategories:\n${catBlock}`,
    maxTokens: 400,
  });
  return parsed || { category: null, subcategory: null, isNew: false, confidence: 0 };
}

module.exports = { parseBrief, callHaikuJson, analyseCatalogue, extractProduct, classifyGroup };
