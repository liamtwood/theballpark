/**
 * Email service — thin wrapper around Resend.
 *
 * RESEND_API_KEY must be set. Until DNS for theballpark.ai is verified
 * in Resend, we fall back to Resend's prebaked sender (onboarding@resend.dev)
 * which works without DNS but lands in spam more often.
 *
 * Set EMAIL_FROM in env once DNS is configured (e.g. "Ballpark <noreply@theballpark.ai>").
 */

const { Resend } = require('resend');

const apiKey  = process.env.RESEND_API_KEY;
const from    = process.env.EMAIL_FROM || 'Ballpark <onboarding@resend.dev>';
const resend  = apiKey ? new Resend(apiKey) : null;

async function sendEmail({ to, subject, text }) {
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — email NOT sent. To:', to, 'Subject:', subject);
    return { skipped: true };
  }
  const recipients = Array.isArray(to) ? to : [to];
  const { data, error } = await resend.emails.send({
    from,
    to: recipients,
    subject,
    text
  });
  if (error) {
    console.error('[email] Resend error:', error);
    throw new Error(error.message || 'Email send failed');
  }
  return { id: data?.id };
}

module.exports = { sendEmail };
