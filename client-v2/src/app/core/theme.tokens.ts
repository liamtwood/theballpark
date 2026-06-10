/**
 * Ballpark brand tokens — TypeScript mirror.
 *
 * The CANONICAL bridge lives in `src/styles.css` (CSS custom properties +
 * the PrimeNG / PrimeUIX Aura token mapping). This file exposes the same brand
 * palette as typed constants for the rare TS consumer (e.g. a chart colour).
 * Keep the two in sync — `styles.css` is the runtime source of truth.
 */
export const BRAND_TOKENS = {
  /** Primary accent — Ballpark pink. */
  accent: '#d63384',
  /** Foreground used on top of the accent. */
  accentContrast: '#ffffff',
  /** Page background — warm parchment. */
  bg: '#fbf7f4',
  /** Default body text. */
  text: '#1f2937',
} as const;

export type BrandTokenName = keyof typeof BRAND_TOKENS;
