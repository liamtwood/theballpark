import { Injectable } from '@angular/core';
import type { LucideIconData } from 'lucide-angular';

export interface LucideIconEntry {
  /** kebab name (storage + display). */
  name: string;
  /** raw icon node data — rendered via <lucide-icon [img]="data"> without
   *  needing the icon registered in the curated app.config set. */
  data: LucideIconData;
}

/** pV2-MEDIA-01b — lazy access to the FULL Lucide library. The set is
 *  dynamic-imported on first use so the ~1500 icons live in a separate chunk,
 *  not the main bundle (MEDIA.md lock §5). The curated app.config.pick set
 *  (eager, ~40 icons) still serves the always-on UI; this service powers the
 *  picker's "Use Icon" search AND rendering an arbitrary chosen icon on a
 *  consuming card (via <lucide-icon [img]>). */
@Injectable({ providedIn: 'root' })
export class LucideIconsService {
  private entries: LucideIconEntry[] | null = null;
  private byNameMap: Map<string, LucideIconData> | null = null;
  private loading: Promise<LucideIconEntry[]> | null = null;

  /** All icons (kebab-sorted). Loads + caches the lazy chunk on first call. */
  all(): Promise<LucideIconEntry[]> {
    if (this.entries) return Promise.resolve(this.entries);
    this.loading ??= this.load();
    return this.loading;
  }

  /** Resolve one icon's node data by kebab name (for rendering a stored icon). */
  async byName(name: string): Promise<LucideIconData | null> {
    if (!this.byNameMap) await this.all();
    return this.byNameMap?.get(name) ?? null;
  }

  private async load(): Promise<LucideIconEntry[]> {
    const mod = await import('lucide-angular'); // lazy chunk
    const entries: LucideIconEntry[] = [];
    const map = new Map<string, LucideIconData>();
    for (const [key, value] of Object.entries(mod as Record<string, unknown>)) {
      // Icon exports are PascalCase and their value is the icon-node data:
      // an array of [tag, attrs] tuples. Everything else (the module class,
      // the component, helpers) is filtered out.
      if (!/^[A-Z][A-Za-z0-9]*$/.test(key)) continue;
      if (!Array.isArray(value) || value.length === 0 || !Array.isArray(value[0])) continue;
      const name = toKebab(key);
      const data = value as unknown as LucideIconData;
      entries.push({ name, data });
      map.set(name, data);
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    this.entries = entries;
    this.byNameMap = map;
    return entries;
  }
}

/** PascalCase Lucide export → kebab name (matches Lucide's own naming). */
function toKebab(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-zA-Z])([0-9])/g, '$1-$2')
    .toLowerCase();
}
