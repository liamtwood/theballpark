const SYSTEM_PROMPT = `You are a senior London event production planner with 15 years of agency experience. Read this brief and return ONLY valid JSON — no markdown, no explanation, no backticks.

You will receive briefs in many formats: casual emails, formal RFPs, creative decks, WhatsApp messages. Extract the signal from the noise — ignore procurement boilerplate, T&Cs, and submission instructions. Focus on what needs to be BUILT and DELIVERED.

SPLITTING RULES:
- Items that are separate costs MUST be separate categories. AV and lighting are always two items. Public catering and VIP catering are always two. Set build and set dressing are always two.

INFERENCE RULES — always apply:
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

async function parseBrief(rawBriefText) {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error('ANTHROPIC_API_KEY is not configured');
    err.status = 500;
    throw err;
  }

  const Anthropic = require('@anthropic-ai/sdk');
  // v1.49f — maxRetries 8 (was 4): rides out transient 429 / 5xx / 529
  // overloads with exponential backoff. 4 wasn't always enough to
  // outlast an Anthropic overload window before the call failed.
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 8 });

  let message;
  try {
    message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Scope this event brief into production categories:\n\n${rawBriefText}`,
        },
      ],
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

  const responseText = message.content[0].text;

  // v1.39d — log what Haiku returns so we can verify mapping
  // gaps against what hits the create payload. Truncated to keep
  // server logs readable; full body is in the API response.
  try {
    const parsed = JSON.parse(responseText);

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
  } catch {
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    return { raw_response: responseText };
  }
}

module.exports = { parseBrief };
