// pV2-INTENT-01 — parse a typed inbox message into suggested, confirm-first
// actions on the SELECTED line. Mirrors ai.service's Haiku call + JSON discipline.
// This service ONLY interprets; the client applies each action (after the user
// confirms) through the existing authenticated endpoints, which re-check
// permissions. Never auto-executes anything.

const ACTION_TYPES = new Set([
  // supplier applies these to their own line
  'set_base_cost', 'set_base_description', 'upsert_extra',
  // negotiation moves (either side, where valid)
  'accept_cost', 'decline', 'suggest_cost',
  // agent asks — the assistant drafts a message to send to the supplier
  'draft_message',
]);

function buildSystemPrompt(ctx) {
  const comps = (ctx.componentNames || []).length ? (ctx.componentNames || []).join(', ') : '(none yet)';
  const sym = ctx.currencySymbol || '£';
  const role = ctx.role === 'agent' ? 'agent (the buyer)' : ctx.role === 'supplier' ? 'supplier (the seller)' : 'user';
  return `You are a helpful assistant inside an event-planning app, talking to the ${role} about ONE quote line. Read their message and return ONLY valid JSON — no markdown, no prose outside the JSON, no backticks.

The line being discussed:
- Item: ${ctx.itemName || 'this item'}
- Base cost: ${ctx.baseCost == null ? 'unknown' : sym + ctx.baseCost} per ${ctx.unit || 'unit'} (× qty ${ctx.quantity ?? 1})
- Existing add-on/extra components: ${comps}

Return exactly this shape:
{"reply":"<one short, friendly sentence back to the user>","actions":[ ... ],"suggestions":["<short next-step chip>", ...]}

ACTIONS — include one ONLY when the message clearly calls for it (else []):
Supplier edits (the supplier changes their own line):
- {"type":"set_base_cost","amount":<number>} — "set/change the base to X", "should be X a head".
- {"type":"set_base_description","text":"<string>"} — "update the description to ...".
- {"type":"upsert_extra","name":"<string>","cost":<number|null>,"qty":<number|null>,"unit":"<string|null>"} — add or update an add-on/extra. Match an existing component name to UPDATE, else create. "add insurance at X", "a project manager for 2 days at X/day", "bump the wine to Y".
Negotiation (either side):
- {"type":"accept_cost"} — "accept", "that works", "agreed".
- {"type":"decline"} — "decline", "no thanks", "pass".
- {"type":"suggest_cost","amount":<number>} — propose a specific new TOTAL price for the line (a counter-offer). Use when a concrete number is given or derivable (e.g. "10% off" applied to the known total).
Agent asks (the agent wants to REQUEST something from the supplier — draft the message, do NOT edit the line):
- {"type":"draft_message","text":"<a polished, friendly request to the supplier>"} — "ask for a fridge", "can we get wine pairing", "ask for a discount", "request a 10% reduction". Write the actual message the agent could send.

SUGGESTIONS — 0-3 very short next-step prompts the user might tap next (e.g. "Ask for a discount", "Add wine pairing", "Accept the cost"). Tailor to the role and what was just said. Omit if none fit.

Rules:
- Money like "£200", "200", "2k" → numeric (2000 for 2k). Strip symbols.
- "for 2 days" → qty 2, unit "day". "per head"/"a head" → unit "head". Unstated unit → null.
- A one-off with no unit (e.g. insurance) → qty 1, unit null.
- Never invent values not in the message (null for unknown cost/qty/unit).
- If it's just chit-chat, return actions [] but still give a brief friendly reply.`;
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
    } else if (a.type === 'suggest_cost') {
      const amount = coerceNum(a.amount);
      if (amount != null && amount >= 0) out.push({ type: 'suggest_cost', amount });
    } else if (a.type === 'draft_message') {
      const text = typeof a.text === 'string' ? a.text.trim() : '';
      if (text) out.push({ type: 'draft_message', text: text.slice(0, 2000) });
    }
  }
  return out.slice(0, 6); // a single message shouldn't yield a flood of actions
}

/** Keep the assistant's short reply + up to 3 tidy suggestion chips. */
function sanitizeStrings(arr, cap, max) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((s) => typeof s === 'string' && s.trim())
    .map((s) => s.trim().slice(0, cap))
    .slice(0, max);
}

async function parseIntent(message, context) {
  const text = String(message || '').trim();
  if (!text) return { reply: '', actions: [], suggestions: [] };
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
  const reply = parsed && typeof parsed.reply === 'string' ? parsed.reply.trim().slice(0, 500) : '';
  return {
    reply,
    actions: sanitize(parsed && parsed.actions),
    suggestions: sanitizeStrings(parsed && parsed.suggestions, 60, 3),
  };
}

module.exports = { parseIntent };
