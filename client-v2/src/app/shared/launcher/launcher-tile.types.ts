/** pV2-04b — one launcher tile as the consumer pages declare it. */
export interface LauncherTile {
  /** Lucide icon name (must be in app.config's global pick). */
  icon: string;
  label: string;
  /** Muted copy line under the title (v1 parity — pV2-04b1-qc). */
  subtitle?: string;
  href: string;
  /** Vivid gradient treatment for the primary CTA tile. */
  primary?: boolean;
}
