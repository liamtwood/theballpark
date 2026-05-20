export interface ThemePreset {
  name: string;
  accent: string;
  bg: string;
  empty: string;
  text: string;
  border: string;
}

export interface PlatformConfig {
  platformName: string;
  tagline: string;
  projectLabel: string;
  creditLabel: string;
  themeName: string;
  mode: 'light' | 'dark' | 'system';
  heroAlign?: string;
  showUserName?: boolean;
  showLocation?: boolean;
  showUpcoming?: boolean;
  showStats?: boolean;
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
