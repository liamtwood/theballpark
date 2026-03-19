async function parseBrief(rawBriefText) {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error('ANTHROPIC_API_KEY is not configured');
    err.status = 500;
    throw err;
  }

  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: 'You are an expert exhibition and event production planner. Extract structured data from event briefs. Respond with valid JSON only, no markdown formatting.',
    messages: [
      {
        role: 'user',
        content: `Extract structured data from this event brief. Return a JSON object with these fields:
- event_name (string)
- event_date (string, ISO format if possible)
- venue_name (string)
- venue_city (string)
- venue_address (string)
- guest_count (number or null)
- stand_size (one of: small, medium, large, xl, custom)
- stand_type (one of: shell_scheme, space_only)
- project_notes (string, any additional relevant notes)
- suggested_categories (array of category names from: Structures, Flooring, Furniture, AV & Lighting, Graphics & Signage, Electrics, Catering, Staffing, Transport & Logistics, Design & Management, Sustainability, Miscellaneous)
- ai_hints (string, any suggestions or recommendations for the project)
- missing_fields (array of strings, fields that could not be determined from the brief)

Event brief:
${rawBriefText}`,
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
