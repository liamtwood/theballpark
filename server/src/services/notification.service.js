/**
 * v1.65cu (p0008) — outreach + reply-notification email templates.
 *
 * Two templates today, both HTML with a plain-text fallback. Inline
 * CSS only (no external stylesheets), max-width 600px, system font
 * stack, no images beyond a single logo (with alt fallback). Resend
 * sends `text` to plain-text clients and `html` to everything else.
 *
 * Public:
 *   outreachEmail(opts)         — sent from requestQuotes when a brief
 *                                 goes out to a supplier.
 *   replyNotificationEmail(opts) — sent when one side touches the thread
 *                                 (item state change or text reply).
 */

const { sendEmail } = require('./email.service');

const PUBLIC_BASE_URL =
  process.env.PUBLIC_APP_URL ||
  process.env.APP_URL ||
  'http://localhost:4200';

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtCurrency(value, currency) {
  const n = Number(value) || 0;
  const code = (currency || 'GBP').toUpperCase();
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency', currency: code, maximumFractionDigits: 0
    }).format(n);
  } catch {
    return `${code} ${n.toFixed(0)}`;
  }
}

/** Shared shell wrapping the body in a 600px-max-width container. */
function emailShell({ title, bodyHtml }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escHtml(title)}</title>
</head>
<body style="margin:0;padding:24px 16px;background:#f5f0e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"
         style="max-width:600px;width:100%;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:0.5px solid rgba(0,0,0,0.08);">
    <tr><td style="padding:24px 28px;">${bodyHtml}</td></tr>
  </table>
  <p style="text-align:center;font-size:11px;color:#a0a0a0;margin:18px 0 0;">
    Sent via Ballpark · <a href="${escHtml(PUBLIC_BASE_URL)}" style="color:#a0a0a0;text-decoration:underline;">theballpark.ai</a>
  </p>
</body>
</html>`;
}

function logoBlock({ name, logoUrl }) {
  const safeName = escHtml(name || 'Ballpark');
  if (logoUrl) {
    return `<img src="${escHtml(logoUrl)}" alt="${safeName}" width="48" height="48"
             style="display:block;border-radius:8px;border:0.5px solid rgba(0,0,0,0.08);"/>`;
  }
  // No image — letter block.
  const initial = (safeName.charAt(0) || 'B').toUpperCase();
  return `<div style="width:48px;height:48px;border-radius:8px;background:#fbeaf0;color:#993556;
                      display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:600;">
            ${initial}
          </div>`;
}

function ctaButton({ label, href }) {
  return `<a href="${escHtml(href)}" target="_blank"
            style="display:inline-block;background:#D97706;color:#ffffff;font-size:14px;font-weight:500;
                   padding:10px 22px;border-radius:8px;text-decoration:none;">
            ${escHtml(label)}
          </a>`;
}

/**
 * Outreach email — fired by requestQuotes for each supplier in the
 * outreach batch.
 *
 *  opts: {
 *    to:           supplier email,
 *    refCode:      'WA-001',
 *    categoryName: 'Walk-Around',
 *    agencyName:   'Wonder Agency',
 *    agencyLogoUrl:'…optional…',
 *    projectName:  'Pop-Up Activation',
 *    projectDate:  '2026-08-12T00:00:00Z' | null,
 *    items:        [ { name, description, price_ref, unit } ],
 *    currency:     'GBP',
 *    token:        public token,
 *  }
 */
async function outreachEmail(opts) {
  const {
    to, refCode, categoryName, agencyName, agencyLogoUrl,
    projectName, projectDate, items, currency, token,
  } = opts;
  const subject = `[${refCode}] ${categoryName} — brief from ${agencyName}`;
  const briefUrl = `${PUBLIC_BASE_URL}/brief/${token}`;

  const dateLine = projectDate
    ? new Date(projectDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const itemRowsHtml = (items || []).map(it => `
    <tr>
      <td style="padding:10px 12px;border-top:0.5px solid rgba(0,0,0,0.08);font-size:13px;">
        <div style="font-weight:600;color:#1a1a1a;">${escHtml(it.name)}</div>
        ${it.description ? `<div style="color:#6b6b6b;font-size:12px;margin-top:2px;">${escHtml(it.description)}</div>` : ''}
      </td>
      <td style="padding:10px 12px;border-top:0.5px solid rgba(0,0,0,0.08);font-size:13px;color:#1a1a1a;text-align:right;white-space:nowrap;">
        ${it.price_ref != null ? fmtCurrency(it.price_ref, currency) : '<span style="color:#a0a0a0;">—</span>'}
        ${it.unit ? `<div style="color:#a0a0a0;font-size:11px;">${escHtml(it.unit)}</div>` : ''}
      </td>
    </tr>
  `).join('');

  const bodyHtml = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
      ${logoBlock({ name: agencyName, logoUrl: agencyLogoUrl })}
      <div>
        <div style="font-size:11px;color:#D97706;letter-spacing:0.08em;font-weight:600;text-transform:uppercase;">BRIEF FROM ${escHtml(agencyName)}</div>
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#1a1a1a;margin-top:2px;">${escHtml(refCode)} · ${escHtml(categoryName)}</div>
      </div>
    </div>

    <p style="font-size:14px;color:#1a1a1a;line-height:1.5;margin:0 0 14px;">
      <strong>${escHtml(agencyName)}</strong> is putting together <strong>${escHtml(projectName)}</strong>
      ${dateLine ? `on <strong>${escHtml(dateLine)}</strong>` : ''}
      and would like to hear from you about ${escHtml(categoryName)}.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
           style="width:100%;border:0.5px solid rgba(0,0,0,0.08);border-radius:8px;border-collapse:separate;border-spacing:0;margin:14px 0 20px;">
      <thead>
        <tr>
          <th align="left"  style="padding:8px 12px;background:#faf6f7;font-size:10px;color:#6b6b6b;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;border-top-left-radius:8px;">Item</th>
          <th align="right" style="padding:8px 12px;background:#faf6f7;font-size:10px;color:#6b6b6b;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;border-top-right-radius:8px;">Reference</th>
        </tr>
      </thead>
      <tbody>${itemRowsHtml || `<tr><td colspan="2" style="padding:14px;font-size:13px;color:#a0a0a0;text-align:center;">No items listed.</td></tr>`}</tbody>
    </table>

    <p style="text-align:center;margin:20px 0 4px;">
      ${ctaButton({ label: 'View brief & reply', href: briefUrl })}
    </p>
    <p style="text-align:center;font-size:11px;color:#a0a0a0;margin:8px 0 0;">
      No login required — the link above is yours.
    </p>
  `;

  const text = [
    `Brief from ${agencyName}`,
    `Ref: ${refCode} · ${categoryName}`,
    '',
    `${agencyName} is putting together ${projectName}${dateLine ? ` on ${dateLine}` : ''} and would like to hear from you about ${categoryName}.`,
    '',
    'Items:',
    ...((items || []).map((it, i) =>
      `  ${i + 1}. ${it.name}${it.price_ref != null ? ` — ${fmtCurrency(it.price_ref, currency)}` : ''}${it.unit ? ` (${it.unit})` : ''}`
    )),
    '',
    `View brief & reply: ${briefUrl}`,
  ].join('\n');

  return sendEmail({ to, subject, text, html: emailShell({ title: subject, bodyHtml }) });
}

/**
 * Reply notification — fired when the other side touches the thread.
 *
 *  opts: {
 *    to:             recipient email,
 *    refCode:        'WA-001',
 *    senderName:     'Greenhouse London' | 'Wonder Agency',
 *    summaryLine:    'sent a message' | 'quoted 3 items' | 'accepted 2 items',
 *    changes:        [ { name, fromLabel, toLabel } ] (up to 3 shown),
 *    threadUrl:      where to land (supplier: /brief/:token, agent: /projects/:id/messages),
 *    agencyLogoUrl?: optional,
 *  }
 */
async function replyNotificationEmail(opts) {
  const {
    to, refCode, senderName, summaryLine, changes,
    threadUrl, agencyLogoUrl,
  } = opts;
  const subject = `[${refCode}] ${senderName} replied`;

  const changeRowsHtml = (changes || []).slice(0, 3).map(c => `
    <tr>
      <td style="padding:8px 12px;border-top:0.5px solid rgba(0,0,0,0.08);font-size:13px;">${escHtml(c.name)}</td>
      <td style="padding:8px 12px;border-top:0.5px solid rgba(0,0,0,0.08);font-size:12px;color:#6b6b6b;text-align:right;">
        ${escHtml(c.fromLabel || '')} → <strong style="color:#1a1a1a;">${escHtml(c.toLabel || '')}</strong>
      </td>
    </tr>
  `).join('');

  const bodyHtml = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
      ${logoBlock({ name: senderName, logoUrl: agencyLogoUrl })}
      <div>
        <div style="font-size:11px;color:#D97706;letter-spacing:0.08em;font-weight:600;text-transform:uppercase;">REF ${escHtml(refCode)}</div>
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#1a1a1a;margin-top:2px;">${escHtml(senderName)} ${escHtml(summaryLine)}</div>
      </div>
    </div>

    ${changeRowsHtml ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
           style="width:100%;border:0.5px solid rgba(0,0,0,0.08);border-radius:8px;border-collapse:separate;border-spacing:0;margin:8px 0 20px;">
      <tbody>${changeRowsHtml}</tbody>
    </table>` : ''}

    <p style="text-align:center;margin:20px 0 4px;">
      ${ctaButton({ label: 'View thread', href: threadUrl })}
    </p>
  `;

  const text = [
    `${senderName} ${summaryLine} — Ref ${refCode}`,
    '',
    ...((changes || []).slice(0, 3).map(c =>
      `  • ${c.name}: ${c.fromLabel || ''} → ${c.toLabel || ''}`
    )),
    '',
    `View thread: ${threadUrl}`,
  ].join('\n');

  return sendEmail({ to, subject, text, html: emailShell({ title: subject, bodyHtml }) });
}

module.exports = { outreachEmail, replyNotificationEmail };
