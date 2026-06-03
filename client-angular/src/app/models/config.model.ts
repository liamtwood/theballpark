export interface ThemePreset {
  name: string;
  accent: string;
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
  showUpcoming?: boolean;
  showStats?: boolean;
  /** p0018 — per-section visibility for the dashboard body. All default
      true (everything visible); toggled from the page-config drawer's
      SECTIONS group. Single-user / flat — no per-persona storage yet. */
  showQuickActions?: boolean;
  showActiveProjects?: boolean;
  showCredits?: boolean;
  showSavedSuppliers?: boolean;
  showRecentActivity?: boolean;
  logoUrl?: string;
  navMode?: 'tabs' | 'sidenav';
  fontPairing?: string;
  catalogueLabel?: string;
  feedbackLabel?: string;
  /** v1.23: home/dashboard page eyebrow ("PROJECTS" / "EVENTS" / etc).
      Cascades from the dashboard's admin settings strip. Other labels
      (projectLabel for "Active {Events}", creditLabel for "Balls") were
      already in PlatformConfig — this is the only one that was missing. */
  homePageLabel?: string;
}
