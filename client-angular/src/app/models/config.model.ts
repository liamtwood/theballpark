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
}
