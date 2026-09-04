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
  const convo = Array.isArray(ctx.conversation) && ctx.conversation.length
    ? ctx.conversation.map((m) => `${m.who}: ${m.text}`).join('\n')
    : '(no messages yet)';
  return `You are a helpful assistant inside an event-planning app, talking to the ${role} about ONE quote line. Read their message and return ONLY valid JSON — no markdown, no prose outside the JSON, no backticks.

The line being discussed:
- Item: ${ctx.itemName || 'this item'}
- Base cost: ${ctx.baseCost == null ? 'unknown' : sym + ctx.baseCost} per ${ctx.unit || 'unit'} (× qty ${ctx.quantity ?? 1})
- Existing add-on/extra components: ${comps}
- Current description: ${ctx.currentDescription ? JSON.stringify(ctx.currentDescription) : '(none)'}

CONVERSATION SO FAR on this line (oldest first; "Agent" = the buyer, "Supplier" = the seller):
${convo}

Use the CONVERSATION to answer questions about status or "any questions from the agent/supplier?" — base such answers ONLY on what's actually there. NEVER claim there are no questions/requests if the conversation shows one. If the counterparty has an unanswered request or question (e.g. the agent asked to add flags, or asked a question), SAY SO plainly in the reply and, when it's actionable for this ${role}, propose the matching action or suggestion. Do not invent messages that aren't shown.

Return exactly this shape:
{"reply":"<one short, friendly sentence back to the user>","actions":[ ... ],"suggestions":["<short next-step chip>", ...]}

ACTIONS — include one ONLY when the message clearly calls for it (else []):
- {"type":"upsert_extra","name":"<string>","cost":<number|null>,"qty":<number|null>,"unit":"<string|null>","description":"<string|null>"} — ADD / GET / INCLUDE something on the line ("add insurance at X", "can we add 2 flags with our logo", "a project manager for 2 days"). Works for BOTH sides:
  • SUPPLIER → a priced add-on/extra (fill cost when given). Match an existing component name to UPDATE, else create.
  • AGENT → a QUESTION (a request the supplier will price): ALWAYS leave "cost": null, and set "description" to a short "Requested — …" note capturing the ask (e.g. "Requested — 2× 6ft×4ft flags, white, iPuck logo, top of tunnel"). Extract name (a concise item name, e.g. "Flag (with iPuck logo)"), qty, unit.
  Return MULTIPLE upsert_extra when the message names more than one — e.g. "two insurance levels: weather cover £500 and cancellation £2000" → TWO ("Weather cover" £500, "Cancellation" £2000).
Supplier edits (the supplier changes their own line):
- {"type":"set_base_cost","amount":<number>} — "set/change the base to X", "should be X a head".
- {"type":"set_base_description","text":"<the FULL new description>"} — change or ADD TO the description. Return the COMPLETE updated description (keep existing content, weave in the change).
Negotiation (either side):
- {"type":"accept_cost"} — "accept", "that works", "agreed".
- {"type":"decline"} — "decline", "no thanks", "pass".
- {"type":"suggest_cost","amount":<number>} — propose a specific new TOTAL price for the line (a counter-offer). Use when a concrete number is given or derivable (e.g. "10% off" applied to the known total).
Agent asks (only when NOT adding an item — e.g. a discount or a general question):
- {"type":"draft_message","text":"<a polished, friendly request>"} — "ask for a discount", "request a 10% reduction", "what's the lead time?". Short, on-topic, one ask. Do NOT use draft_message to ADD an item — use upsert_extra (a question) for that.

SUGGESTIONS — 0-3 very short next-step prompts that each map to a CONCRETE action (add an extra, suggest a price, accept, decline) — e.g. "Add wine pairing", "Suggest a lower price", "Accept the cost". NEVER meta prompts like "Review…", "Share…", "Edit…", "Keep…", or anything that just asks a question back. Omit entirely if none fit.

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
        // A short "Requested — …" note capturing the ask (used as the question
        // component's description / audit line when the AGENT adds it).
        description: typeof a.description === 'string' && a.description.trim() ? a.description.trim().slice(0, 500) : null,
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

// A suggestion chip must map to a CONCRETE next action the user can tap — not a
// meta-prompt that just asks THEM to do something ("Describe your branding idea",
// "Tell me more", "What size?"). Those loop (tapping them re-asks) and there's no
// input tied to them. Drop questions + these instruction-to-the-user openers, dedupe.
const META_SUGGESTION = /^(describe|tell|let me know|share|what|which|how|why|review|edit|keep|consider|think|provide|explain|specify|clarify|choose|decide|give)\b/i;
function sanitizeSuggestions(arr) {
  const seen = new Set();
  return sanitizeStrings(arr, 60, 8)
    .filter((s) => !s.endsWith('?') && !META_SUGGESTION.test(s))
    .filter((s) => { const k = s.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 3);
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
    suggestions: sanitizeSuggestions(parsed && parsed.suggestions),
  };
}

module.exports = { parseIntent };
