const router = require('express').Router();

// POST /parse-brief - Parse event brief using Claude
router.post('/parse-brief', async (req, res) => {
  try {
    const raw_brief_text = req.body.raw_brief_text || req.body.brief_text;

    if (!raw_brief_text) {
      return res.status(400).json({ error: 'raw_brief_text or brief_text is required' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });
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
${raw_brief_text}`,
        },
      ],
    });

    const responseText = message.content[0].text;

    // Try to parse as JSON
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      // Try extracting JSON from markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim());
      } else {
        parsed = { raw_response: responseText };
      }
    }

    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
