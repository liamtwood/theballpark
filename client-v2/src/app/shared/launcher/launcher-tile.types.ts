/** pV2-04b — one launcher tile as the consumer pages declare it. */
export interface LauncherTile {
  /** Lucide icon name (must be in app.config's global pick). */
  icon: string;
  label: string;
  href: string;
  /** Vivid gradient treatment for the primary CTA tile. */
  primary?: boolean;
}
