// pV2-INTENT-01 — parse a typed inbox message into suggested, confirm-first
// actions on the SELECTED line. Mirrors ai.service's Haiku call + JSON discipline.
// This service ONLY interprets; the client applies each action (after the user
// confirms) through the existing authenticated endpoints, which re-check
// permissions. Never auto-executes anything.

const ACTION_TYPES = new Set(['set_base_cost', 'set_base_description', 'upsert_extra', 'accept_cost', 'decline']);

function buildSystemPrompt(ctx) {
  const comps = (ctx.componentNames || []).length ? (ctx.componentNames || []).join(', ') : '(none yet)';
  const sym = ctx.currencySymbol || '£';
  return `You turn a supplier or agent's short message about ONE quote line into structured actions. Return ONLY valid JSON — no markdown, no prose, no backticks.

The line being discussed:
- Item: ${ctx.itemName || 'this item'}
- Base cost: ${ctx.baseCost == null ? 'unknown' : sym + ctx.baseCost} per ${ctx.unit || 'unit'} (× qty ${ctx.quantity ?? 1})
- Existing add-on/extra components: ${comps}

Available actions (include an action ONLY when the message clearly asks for it):
- {"type":"set_base_cost","amount":<number>} — change the item's own base cost (per unit). Use for "set/change the base to X", "the dinner should be X a head".
- {"type":"set_base_description","text":"<string>"} — change the item description. Use for "update the description to ...", "describe it as ...".
- {"type":"upsert_extra","name":"<string>","cost":<number|null>,"qty":<number|null>,"unit":"<string|null>"} — add or update an add-on/extra as a component. Match an existing component name to UPDATE it, else create. Use for "add insurance at X", "add a project manager for 2 days at X/day", "bump the wine to Y".
- {"type":"accept_cost"} — accept the current quoted cost. Use for "accept", "that works", "agreed", "approved".
- {"type":"decline"} — decline. Use for "decline", "no thanks", "pass", "reject".

Rules:
- Money like "£200", "200", "2k" → the numeric amount (2000 for 2k). Strip currency symbols.
- "for 2 days" → qty 2, unit "day". "per head" / "a head" → unit "head". Leave unit null when not stated.
- A one-off with no unit (e.g. insurance) → qty 1, unit null.
- If the message is normal conversation with no clear action, return {"actions":[]}.
- Do NOT invent values the message doesn't contain (use null for unknown cost/qty/unit).

Return exactly: {"actions":[ ... ]}`;
}

function coerceNum(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Whitelist + coerce the model's actions so only well-formed, known actions
 *  survive (defence-in-depth — the model output is never trusted verbatim). */
function sanitize(actions) {
  if (!Array.isArray(actions)) return [];
  const out = [];
  for (const a of actions) {
    if (!a || typeof a !== 'object' || !ACTION_TYPES.has(a.type)) continue;
    if (a.type === 'set_base_cost') {
      const amount = coerceNum(a.amount);
      if (amount != null && amount >= 0) out.push({ type: 'set_base_cost', amount });
    } else if (a.type === 'set_base_description') {
      const text = typeof a.text === 'string' ? a.text.trim() : '';
      if (text) out.push({ type: 'set_base_description', text: text.slice(0, 4000) });
    } else if (a.type === 'upsert_extra') {
      const name = typeof a.name === 'string' ? a.name.trim() : '';
      if (name) out.push({
        type: 'upsert_extra',
        name: name.slice(0, 200),
        cost: coerceNum(a.cost),
        qty: coerceNum(a.qty),
        unit: typeof a.unit === 'string' && a.unit.trim() ? a.unit.trim().slice(0, 40) : null,
      });
    } else if (a.type === 'accept_cost') {
      out.push({ type: 'accept_cost' });
    } else if (a.type === 'decline') {
      out.push({ type: 'decline' });
    }
  }
  return out.slice(0, 6); // a single message shouldn't yield a flood of actions
}

async function parseIntent(message, context) {
  const text = String(message || '').trim();
  if (!text) return { actions: [] };
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error('ANTHROPIC_API_KEY is not configured');
    err.status = 500;
    throw err;
  }

  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 6 });

  let msg;
  try {
    msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: buildSystemPrompt(context || {}),
      messages: [{ role: 'user', content: text }],
    });
  } catch (e) {
    const status = e && e.status;
    const type = e && e.error && e.error.error && e.error.error.type;
    if (status === 429 || status === 529 || (status >= 500 && status < 600)
        || type === 'overloaded_error' || type === 'rate_limit_error') {
      const err = new Error('The assistant is busy right now — please try again in a moment.');
      err.status = 503;
      throw err;
    }
    throw e;
  }

  const raw = (msg.content[0] && msg.content[0].text) || '';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
    try { parsed = m ? JSON.parse(m[1]) : { actions: [] }; } catch { parsed = { actions: [] }; }
  }
  return { actions: sanitize(parsed && parsed.actions) };
}

module.exports = { parseIntent };
