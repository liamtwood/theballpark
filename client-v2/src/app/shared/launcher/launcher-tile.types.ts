/** pV2-04b — one launcher tile as the consumer pages declare it. */
export interface LauncherTile {
  /** Lucide icon name (must be in app.config's global pick). */
  icon: string;
  label: string;
  /** Muted copy line under the title (v1 parity — pV2-04b1-qc). */
  subtitle?: string;
  href: string;
  /** Optional query params (v2.13a — the projects-hub stage tiles drill
   *  into one list pre-filtered: /projects?bucket=quoting). */
  query?: Record<string, string>;
}
