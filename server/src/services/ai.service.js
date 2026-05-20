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

DETAIL STANDARD:
Each category oneLiner must be specific enough for a supplier to start quoting. Not "set build" but "Custom inflatable jelly structure with ball pit, approx 4m tall, Angel Delight branded, engineered for public interaction." Dimensions, quantities, brands, durations where mentioned.

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
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
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

  const responseText = message.content[0].text;

  try {
    return JSON.parse(responseText);
  } catch {
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    return { raw_response: responseText };
  }
}

module.exports = { parseBrief };
