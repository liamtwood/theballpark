/**
 * QuoteRequestService — competitive quote outreach (RFQ).
 *
 * Extracted from taxonomy.service.js in the BE-00112 decomposition (Layer 1).
 * Sends Brief-tab requirement(s) to suppliers: resolves each requirement to a
 * concrete items row, creates one outbound message + message_items per
 * supplier, quote_requests tracker rows, and (optionally) the outreach emails —
 * all in one transaction on the OWNER pool (BE-00115 cross-org privileged path;
 * ownership is asserted at the route).
 */
const pool = require('../db/pool');
const ownerPool = require('../db/owner-pool'); // BE-00115 — privileged RFQ path (see requestQuotes)
const { maskEmail } = require('../lib/mask-email'); // FR-00211 — no plaintext emails in logs
const { sendEmail } = require('./email.service');
const { outreachEmail } = require('./notification.service');

function httpErr(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

/** v1.65cu (p0008) — short ref prefix derived from a category name.
    "Walk-Around" → "WA"; falls back to "REQ" for empty input. */
function categoryRefPrefix(name) {
  const parts = (name || '').trim().split(/[\s\-_/&]+/).filter(Boolean);
  if (!parts.length) return 'REQ';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Next per-project sequence for a ref prefix. Looks at existing
    messages.ref_code values on the project that share the prefix and
    returns prefix-NNN with the next zero-padded integer. */
async function nextRefCode(executor, projectId, categoryName) {
  const prefix = categoryRefPrefix(categoryName);
  const r = await executor.query(
    `SELECT ref_code FROM messages
       WHERE project_id = $1 AND ref_code LIKE $2 || '-%'`,
    [projectId, prefix]
  );
  let max = 0;
  for (const row of r.rows) {
    const m = String(row.ref_code || '').match(/-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

const QUOTE_REQUEST_EMAILS_ENABLED = process.env.QUOTE_REQUEST_EMAILS_ENABLED === 'true';

/**
 * Best-effort email nudge to each supplier in a quote outreach. Reuses
 * the existing EmailService (Resend) — no new notification service. The
 * on-platform supplier inbox (Phase 2) is the real surface; this email
 * only says "log in to view and respond". Never throws — a failed or
 * disabled send must not affect the outreach itself.
 */
async function notifyQuoteRequestSuppliers(
  { agencyName, projectName, categoryName, briefExcerpt, suppliers }
) {
  const subject = `New quote request from ${agencyName}`;
  const briefLine = briefExcerpt
    ? `Brief:\n${briefExcerpt}`
    : 'Brief: see the request for full details.';
  for (const s of suppliers || []) {
    const text =
`${agencyName} has sent you a quote request on Ballpark.

Project:   ${projectName}
Category:  ${categoryName}

${briefLine}

Log in to Ballpark to view the full request and respond with your quote.

— Ballpark`;
    if (!QUOTE_REQUEST_EMAILS_ENABLED) {
      console.log(`[quote-email] disabled — would notify ${s.name || s.id} <${maskEmail(s.email) || 'no email'}>`);
      continue;
    }
    if (!s.email) {
      console.warn(`[quote-email] supplier ${s.name || s.id} has no email on file — skipped`);
      continue;
    }
    try {
      await sendEmail({ to: s.email, subject, text });
      console.log(`[quote-email] sent to ${maskEmail(s.email)}`);
    } catch (e) {
      console.error(`[quote-email] send failed for ${maskEmail(s.email)}:`, e.message);
    }
  }
}

/**
 * Send Brief-tab requirement(s) out to suppliers for competitive quotes.
 *
 * quote_requests is a STATUS TRACKER on top of existing infrastructure —
 * it does not replace it:
 *   • the Ball spend     → balls_transactions — ONE 'debit' per outreach
 *     (project-level, shared by every quote_request in the batch).
 *   • the conversation   → messages — one outbound anchor per supplier.
 *   • the quote lines    → message_items — one per requirement per message.
 *   • quote_requests     → one row per (requirement × supplier) holding
 *     status + links to the message thread and the Ball transaction.
 *
 * All writes run inside a single DB transaction so a failure leaves no
 * half-sent outreach (and no spent Ball).
 *
 * body: {
 *   project_id, project_category_id?, category_id,
 *   requirements: [ { kind:'matched', item_id } |
 *                   { kind:'new', name, description?, estimated_price? } ],
 *   supplier_ids: [ orgId, ... ],
 *   subject?, body?   — the agency-composed email (the user edits it before
 *                       sending). Stored verbatim on each supplier message;
 *                       falls back to generated copy when omitted.
 *   user_id?
 * }
 */
async function requestQuotes(body) {
  // BE-00115 — RFQ is a privileged, agency-initiated, CROSS-ORG operation: it
  // reads the invited suppliers' contact emails (other orgs), creates the brief
  // items/messages/quote_requests, and debits the Balls ledger. Its own
  // pool.connect() carries no request GUCs, and the ledger has no web_app_user
  // write policy, so under RLS the whole flow would be denied. The caller's
  // ownership of the project is already asserted at the route
  // (assertOwnedByActiveOrg('projects', ...) — BE-00108), so this runs on the
  // OWNER pool (bypasses RLS) for the whole function. Shadow the module `pool`.
  const pool = ownerPool;
  const {
    project_id, project_category_id, category_id,
    requirements, supplier_ids, user_id,
    subject: composedSubject, body: composedBody,
    // pV2-INBOX-02: the gated v2 inbox send passes skip_balls — v2 has no
    // Balls economy yet, so the outreach must not debit / gate on Balls.
    skip_balls = false,
  } = body || {};

  if (!project_id)  throw httpErr('project_id is required', 400);
  if (!category_id) throw httpErr('category_id is required', 400);
  const reqs = Array.isArray(requirements) ? requirements : [];
  const supplierIds = Array.isArray(supplier_ids)
    ? [...new Set(supplier_ids.filter(Boolean))] : [];
  if (!reqs.length)        throw httpErr('at least one requirement is required', 400);
  if (!supplierIds.length) throw httpErr('select at least one supplier', 400);

  // Project → agency org + name; category name + brief for the message
  // copy and the supplier email.
  const proj = await pool.query(
    `SELECT p.org_id, p.name AS project_name, ag.name AS agency_name,
            c.name AS category_name, pc.requirement_brief
       FROM projects p
       JOIN orgs ag ON ag.id = p.org_id
       LEFT JOIN categories c ON c.id = $2
       LEFT JOIN project_categories pc ON pc.id = $3
      WHERE p.id = $1`,
    [project_id, category_id, project_category_id || null]
  );
  if (!proj.rows.length) throw httpErr('project not found', 404);
  const agencyOrgId  = proj.rows[0].org_id;
  const agencyName   = proj.rows[0].agency_name || 'An agency';
  const projectName  = proj.rows[0].project_name || 'this project';
  const categoryName = proj.rows[0].category_name || 'this category';
  const briefExcerpt = (proj.rows[0].requirement_brief || '').trim().slice(0, 280);

  // v1.65cu (p0008) — pull the agency's logo + the project's event
  // date + currency for the outreach email shell.
  // v1.65cw — currency lives only on projects (added v1.29b), not on
  // orgs; the original query referenced orgs.currency which doesn't
  // exist and crashed the send.
  const agencyMeta = await pool.query(
    `SELECT logo_url FROM orgs WHERE id = $1`, [agencyOrgId]
  );
  const agencyLogoUrl = agencyMeta.rows[0]?.logo_url || null;
  const projDateRow = await pool.query(
    `SELECT event_date, currency FROM projects WHERE id = $1`, [project_id]
  );
  const projectDate = projDateRow.rows[0]?.event_date || null;
  const projectCurrency = projDateRow.rows[0]?.currency || 'GBP';

  // One Ball per outreach — verify the agency can afford it.
  const bal = await pool.query('SELECT balls_balance FROM orgs WHERE id = $1', [agencyOrgId]);
  const balance = bal.rows.length ? Number(bal.rows[0].balls_balance) || 0 : 0;
  if (!skip_balls && balance < 1) {
    throw httpErr('Not enough Balls to send this outreach — top up to continue.', 402);
  }

  const supRes = await pool.query(
    'SELECT id, name, email FROM orgs WHERE id = ANY($1::uuid[])', [supplierIds]
  );
  const supName  = new Map(supRes.rows.map(s => [s.id, s.name]));
  const supEmail = new Map(supRes.rows.map(s => [s.id, s.email]));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve each requirement to a concrete items row + a display spec.
    //  • matched → an existing catalogue item.
    //  • new     → create an agency-owned item, is_active = false +
    //    approval_status = 'pending' so it never enters the catalogue on
    //    its own; it only goes live if a supplier wins the quote.
    const resolved = [];
    for (const r of reqs) {
      if (r && r.project_item_id) {
        // pV2-CUSTOMS-01: a cart line passed by id — its data (name/price/
        // item_id, possibly NULL for a custom line) already lives on the
        // project_items row; no catalogue lookup needed.
        resolved.push({
          project_item_id: r.project_item_id,
          item_id: r.item_id || null,
          name: r.name,
          description: r.description || '',
          price: Number(r.price) || 0,
        });
      } else if (r && r.kind === 'new') {
        if (!r.name) throw httpErr('a new requirement needs a name', 400);
        const price = Math.max(0, Number(r.estimated_price) || 0);
        // v1.51f — items has a UNIQUE(org_id, name) index; re-sending a
        // brief for the same new requirement must reuse + refresh that
        // row, not error. ON CONFLICT keeps the outreach idempotent.
        const ins = await client.query(
          `INSERT INTO items (org_id, category_id, name, description, base_price,
                              is_active, approval_status)
           VALUES ($1, $2, $3, $4, $5, false, 'pending')
           ON CONFLICT (org_id, name) DO UPDATE SET
             category_id = EXCLUDED.category_id,
             description = EXCLUDED.description,
             base_price  = EXCLUDED.base_price,
             updated_at  = NOW()
           RETURNING id, name, description, base_price`,
          [agencyOrgId, category_id, r.name, r.description || '', price]
        );
        const it = ins.rows[0];
        resolved.push({
          item_id: it.id, name: it.name,
          description: it.description, price: it.base_price
        });
      } else {
        const itemId = r && r.item_id;
        if (!itemId) throw httpErr('a matched requirement needs an item_id', 400);
        // v1.65fB — pin the agent's project_items SNAPSHOT into the
        // brief at send-time. If the agent tweaked "Sit-Down Dinner"
        // to £80 for THIS project, the brief sent to the supplier
        // carries £80 — not the catalogue's £85. LEFT JOIN so an
        // item never added to the cart (rare; only happens if a
        // brief is fired before a cart add) still resolves to the
        // catalogue master.
        const got = await client.query(
          `SELECT i.id,
                  COALESCE(pi.name,        i.name)        AS name,
                  COALESCE(pi.description, i.description) AS description,
                  COALESCE(pi.base_price,  i.base_price)  AS base_price
             FROM items i
        LEFT JOIN project_items pi
               ON pi.item_id = i.id AND pi.project_id = $2
            WHERE i.id = $1`,
          [itemId, project_id]
        );
        if (!got.rows.length) throw httpErr(`item ${itemId} not found`, 404);
        const it = got.rows[0];
        // v1.65fP — coalesce price to 0. Ad-hoc cart adds land with
        // base_price=null until the agent fills it in; message_items.
        // price has a NOT NULL constraint so a null here used to
        // explode the whole send. 0 == "TBC / quote me" which is the
        // right semantic for an unpriced ad-hoc ask.
        resolved.push({
          item_id: it.id, name: it.name,
          description: it.description,
          price: Number(it.base_price) || 0
        });
      }
    }

    // pV2-UNIFY-01a: the canonical (pre-send) row per briefed line — status
    // NULL, supplier_org_id NULL, logical_line_id = its own id. The send loop
    // claims it for the first supplier and clones it (same logical_line_id) for
    // each additional supplier, so competing quotes each get their own row.
    const canonIds = resolved.map((r) => r.project_item_id).filter(Boolean);
    const canonRes = canonIds.length
      ? await client.query(
          `SELECT id, logical_line_id FROM project_items
            WHERE id = ANY($1::uuid[]) AND status IS NULL AND deleted_at IS NULL`,
          [canonIds]
        )
      : { rows: [] };
    const canonById = new Map(
      canonRes.rows.map((r) => [r.id, { id: r.id, logicalLineId: r.logical_line_id, claimed: false }])
    );

    // ONE Ball debit for the whole outreach (project-level). Skipped by the
    // gated v2 inbox send (skip_balls) — no Balls economy in v2 yet.
    let ballTxId = null;
    if (!skip_balls) {
      const ballTx = await client.query(
        `INSERT INTO balls_transactions
           (org_id, project_id, supplier_org_id, user_id, amount, direction, reason, description)
         VALUES ($1, $2, NULL, $3, 1, 'debit', 'spend', $4)
         RETURNING id`,
        [agencyOrgId, project_id, user_id || null,
         `Quote outreach — ${categoryName}: ${supplierIds.length} supplier(s)`]
      );
      ballTxId = ballTx.rows[0].id;
      await client.query(
        'UPDATE orgs SET balls_balance = balls_balance - 1, updated_at = NOW() WHERE id = $1',
        [agencyOrgId]
      );
    }

    // Per supplier: one outbound message (the conversation anchor), its
    // line items, and a quote_requests row per requirement.
    //
    // v1.65cu (p0008) — every message now carries a token (used by the
    // public /brief/:token route) and a ref_code (e.g. "WA-001"); every
    // message_items row is initialised with status='brief_sent' and gets
    // a matching message_item_events audit row.
    const refCode = await nextRefCode(client, project_id, categoryName);
    const createdIds = [];
    const createdMessages = [];
    for (const sid of supplierIds) {
      // NB: messages.category_id is a FK to project_categories(id) — the
      // project's scoped category row, NOT the catalogue category.
      const msg = await client.query(
        `INSERT INTO messages
           (project_id, user_id, supplier_org_id, category_id, category_name,
            supplier_name, subject, body, direction, msg_status, read,
            token, ref_code, contact_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'outbound', 'sent', false,
                 replace(gen_random_uuid()::text, '-', ''), $9, $10)
         RETURNING id, token`,
        [project_id, user_id || null, sid, project_category_id || null, categoryName,
         supName.get(sid) || null,
         // The agency edits the email before sending — store it verbatim.
         (composedSubject && composedSubject.trim())
           || `[${refCode}] ${categoryName} — brief from ${agencyName}`,
         (composedBody && composedBody.trim())
           || (`We'd like a quote for the following on "${projectName}" (${categoryName}). ` +
               `Please review the item(s) below and reply with your price and lead time.`),
         refCode,
         // contact_name is set to the supplier's primary contact when
         // we have one — falls back to NULL and the inbox shows nothing.
         null]
      );
      const msgId    = msg.rows[0].id;
      const msgToken = msg.rows[0].token;
      createdMessages.push({ id: msgId, supplier_id: sid, token: msgToken });

      const supplierItems = [];
      for (const rq of resolved) {
        // pV2-UNIFY-01a: fan out a per-supplier row per line. The FIRST supplier
        // claims the canonical (pre-send) row; each additional supplier gets a
        // CLONE sharing the same logical_line_id (so competing quotes hold their
        // own price_current). The row's own supplier_org_id is the source of
        // truth for who was asked. message_items tags THIS supplier's row.
        const canon = canonById.get(rq.project_item_id);
        let piId = null;
        if (canon) {
          if (!canon.claimed) {
            await client.query(
              `UPDATE project_items
                  SET supplier_org_id = $2, status = 'brief_sent',
                      price_ref = $3, price_current = $3, updated_at = NOW()
                WHERE id = $1`,
              [canon.id, sid, rq.price]
            );
            piId = canon.id;
            canon.claimed = true;
          } else {
            const clone = await client.query(
              `INSERT INTO project_items
                 (project_id, item_id, is_custom, project_category_id, category_id, selection_type,
                  source, name, description, base_price, unit, image_url, quantity,
                  installed, install_cost, install_unit, logical_line_id,
                  supplier_org_id, status, price_ref, price_current)
               SELECT project_id, item_id, is_custom, project_category_id, category_id, selection_type,
                  source, name, description, base_price, unit, image_url, quantity,
                  installed, install_cost, install_unit, logical_line_id,
                  $2, 'brief_sent', $3, $3
                 FROM project_items WHERE id = $1
               RETURNING id`,
              [canon.id, sid, rq.price]
            );
            piId = clone.rows[0].id;
          }
          await client.query(
            `INSERT INTO message_items (message_id, project_item_id) VALUES ($1, $2)`,
            [msgId, piId]
          );
          await client.query(
            `INSERT INTO message_item_events
               (project_item_id, from_status, to_status, actor_type, actor_id, price_after)
             VALUES ($1, NULL, 'brief_sent', 'agent', $2, $3)`,
            [piId, user_id || null, rq.price]
          );
        }
        supplierItems.push({
          name: rq.name, description: rq.description,
          price_ref: rq.price, unit: null
        });

        // quote_requests is v1 catalogue-item tracking (v2 inbox doesn't read
        // it) — skip for custom lines, which have no catalogue item_id.
        if (rq.item_id) {
          const qr = await client.query(
            `INSERT INTO quote_requests
               (project_id, project_category_id, category_id, item_id,
                supplier_org_id, status, message_thread_id, ball_transaction_id)
             VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
             RETURNING id`,
            [project_id, project_category_id || null, category_id, rq.item_id,
             sid, msgId, ballTxId]
          );
          createdIds.push(qr.rows[0].id);
        }
      }

      // Stash items on the created entry so the post-commit email send
      // doesn't need to re-query.
      createdMessages[createdMessages.length - 1].items = supplierItems;
    }

    // v1.53 — sending a category out for competitive quotes moves it to
    // "Out for Quote" automatically (Brief-tab category status). A
    // category the agency has already marked Confirmed is not regressed.
    // The reverse rule — flip to "Quoted" once every quote_request for
    // the category is quoted/declined — belongs in the Phase 2 supplier
    // quote-response handler (no quote_requests status ever changes
    // today, so there is nothing to react to yet).
    await client.query(
      `UPDATE project_categories
          SET status_code = 'out_for_quote', updated_at = NOW()
        WHERE project_id = $1 AND category_id = $2 AND is_active = true
          AND status_code IS DISTINCT FROM 'confirmed'`,
      [project_id, category_id]
    );

    await client.query('COMMIT');

    // v1.65cu (p0008) — HTML outreach email per supplier with their
    // unique /brief/:token URL. Fire-and-forget; a failed or disabled
    // send never affects the outreach itself.
    if (QUOTE_REQUEST_EMAILS_ENABLED) {
      for (const m of createdMessages) {
        const email = supEmail.get(m.supplier_id);
        if (!email) {
          console.warn(`[outreach] supplier ${m.supplier_id} has no email — skipped`);
          continue;
        }
        outreachEmail({
          to: email,
          refCode,
          categoryName,
          agencyName,
          agencyLogoUrl,
          projectName,
          projectDate,
          items: m.items,
          currency: projectCurrency,
          token: m.token,
        }).catch(e => console.error(`[outreach] send failed for ${maskEmail(email)}:`, e.message));
      }
    } else {
      console.log(`[outreach] QUOTE_REQUEST_EMAILS_ENABLED=false — ${createdMessages.length} email(s) suppressed`);
    }

    return {
      ok: true,
      quote_request_ids: createdIds,
      messages: createdMessages.map(m => ({ id: m.id, token: m.token, supplier_id: m.supplier_id })),
      ref_code: refCode,
      suppliers: supplierIds.length,
      requirements: resolved.length,
      ball_transaction_id: ballTxId,
      balls_balance: skip_balls ? null : balance - 1
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Quote-request status for a project — lets the Brief tab show which
    requirements are already out for quote. */
async function listProjectQuoteRequests(projectId) {
  if (!projectId) throw httpErr('projectId is required', 400);
  const r = await pool.query(
    `SELECT qr.id, qr.item_id, qr.category_id, qr.project_category_id,
            qr.supplier_org_id, qr.status, qr.created_at,
            o.name AS supplier_name
       FROM quote_requests qr
       LEFT JOIN orgs o ON o.id = qr.supplier_org_id
      WHERE qr.project_id = $1
      ORDER BY qr.created_at DESC`,
    [projectId]
  );
  return r.rows;
}

module.exports = {
  requestQuotes,
  listProjectQuoteRequests,
  nextRefCode,
  categoryRefPrefix,
  notifyQuoteRequestSuppliers,
};
