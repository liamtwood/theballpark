// FR-00211 — mask email addresses before they hit logs. PII (email) must not be
// written in plaintext to server logs. Keeps the first local char + full domain
// so logs stay useful for debugging ("i***@yahire.com") without exposing the
// address. Pass-through for null/undefined; arrays are masked element-wise.
function maskEmail(v) {
  if (Array.isArray(v)) return v.map(maskEmail);
  if (v == null) return v;
  if (typeof v !== 'string' || !v.includes('@')) return '[redacted]';
  const at = v.lastIndexOf('@');
  const local = v.slice(0, at);
  const domain = v.slice(at + 1);
  return `${local.slice(0, 1)}***@${domain}`;
}

module.exports = { maskEmail };
