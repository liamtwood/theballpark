/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    // REPLACE, not extend — Tailwind's default palette is GONE, per
    // WORKING_STANDARDS §"Tokens only — enforced at compile time".
    // text-slate-500 / bg-white / border-black/10 generate NO css (Tailwind
    // ignores unknown utilities), and `npm run lint` greps them as errors —
    // see scripts/check-raw-colors.js.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',

      // Brand
      accent: 'var(--theme-accent)',
      bp: 'var(--bp-text-color)',
      inverse: 'var(--bp-text-on-gradient)',

      // Surfaces / structure
      surface: 'var(--color-surface)',
      'surface-alt': 'var(--color-surface-alt)',
      fill: 'var(--color-fill)',
      bg: 'var(--theme-bg)',
      hairline: 'var(--color-border-hairline)',
      medium: 'var(--color-border-medium)',

      // Text
      text: 'var(--theme-text)',
      secondary: 'var(--color-text-secondary)',
      muted: 'var(--color-text-muted)',

      // Semantic states (defined in styles.css — do NOT recolour with theme)
      success: 'var(--color-success)',
      'success-soft': 'var(--color-success-soft)',
      warn: 'var(--color-warn)',
      'warn-soft': 'var(--color-warn-soft)',
      danger: 'var(--color-danger)',
      'danger-soft': 'var(--color-danger-soft)',
      info: 'var(--color-info)',
      'info-soft': 'var(--color-info-soft)',
      action: 'var(--color-action)',
      'action-soft': 'var(--color-action-soft)',
    },
    borderColor: ({ theme }) => ({
      ...theme('colors'),
      DEFAULT: 'var(--color-border-hairline)',
    }),
    extend: {
      // Spacing / radius / shadow extensions stay additive — only colors is replaced.
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
};
