export interface ThemePreset {
  name: string;
  /** Primary accent — solid-accent UI (hero, pills, tabs) AND the first
      stop of the derived --grad-accent gradient. */
  accent: string;
  /** Secondary accent — the second stop of --grad-accent. Predefined per
      theme so the pink→green-style gradient tracks the active theme with
      no separate setting. */
  accent2: string;
  bg: string;
  empty: string;
  text: string;
  border: string;
  /** p0003 — three-stop contrast set per preset.
      contrastSoft   → tab fill (light surface for active tab)
      contrast       → bold-mode hero orbs (mid-saturation accent)
      contrastStrong → active-tab text (dark variant for legibility) */
  contrastSoft: string;
  contrast: string;
  contrastStrong: string;
}

export interface PlatformConfig {
  platformName: string;
  tagline: string;
  projectLabel: string;
  creditLabel: string;
  themeName: string;
  /** p0003 — 'bold' is a third display mode alongside light/dark.
      Themed accent hero with orb + grain decoration. Panels and work
      surfaces use light-mode treatment. */
  mode: 'light' | 'dark' | 'bold' | 'system';
  heroAlign?: string;
  showUserName?: boolean;
  showLocation?: boolean;
  showOrg?: boolean;
  showUpcoming?: boolean;
  showStats?: boolean;
  /** p0018 — per-section visibility for the dashboard body. All default
      true (everything visible); toggled from the page-config drawer's
      SECTIONS group. Single-user / flat — no per-persona storage yet. */
  showQuickActions?: boolean;
  showCredits?: boolean;
  showSavedSuppliers?: boolean;
  showRecentActivity?: boolean;
  logoUrl?: string;
  navMode?: 'tabs' | 'sidenav';
  /** p0023 — hero title source on the home / agent surfaces.
      'org' = org name, 'user' = active persona name,
      'greeting' = "Welcome back, {firstName}". Default 'greeting'. */
  heroTitleMode?: 'org' | 'user' | 'greeting' | 'purpose';
  /** v1.66av — per-page hero overrides, keyed by route path (e.g.
      "/inbox"). Lets each page set its own title mode + subtitle from
      that page's settings tab, overriding the route defaults. */
  pageSettings?: Record<string, { heroTitleMode?: 'org' | 'user' | 'greeting' | 'purpose'; heroSub?: string; heroAlign?: 'left' | 'center' }>;
  /** p0023 — home / agent hero strip treatment. 'theme' = accent fill
      (--theme-accent), 'none' = calm parchment (--theme-bg, the stripped
      agent look). Default 'none'. */
  heroColor?: 'theme' | 'none';
  /** v1.66bb — hero separator (tab-band underline) width as a % of the
      content width. Default 100. General (global) setting. */
  separatorWidth?: number;
  /** Financial defaults — currency for headline money figures (project
      card totals, estimates). ISO 4217 code; default 'GBP'. Authored from
      the page-config drawer's General → Financial defaults group. */
  currency?: 'GBP' | 'USD' | 'EUR';
  fontPairing?: string;
  catalogueLabel?: string;
  feedbackLabel?: string;
  /** v1.23: home/dashboard page eyebrow ("PROJECTS" / "EVENTS" / etc).
      Cascades from the dashboard's admin settings strip. Other labels
      (projectLabel for "Active {Events}", creditLabel for "Balls") were
      already in PlatformConfig — this is the only one that was missing. */
  homePageLabel?: string;
}
