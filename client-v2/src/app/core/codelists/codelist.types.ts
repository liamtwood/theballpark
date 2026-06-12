/** pV2-CODELISTS-01 — codelist contracts (docs/CODELISTS.md). */

/** One parent list (RC) as the admin master sees it. */
export interface Codelist {
  listName: string;
  description: string | null;
  isActive: boolean;
  defaultCode: string | null;
  type: 'system' | 'ballpark';
  application: string;
  consumerTable: string | null;
  consumerColumn: string | null;
  valueCount: number;
  activeCount: number;
}

/** The rich-meta convention for STATUS codelists. Color values are either
 *  token refs ('--color-info' — wrap in var()) or v1-era hex (#RRGGBB,
 *  until CODELISTS-02 migrates those consumers). */
export interface StatusMeta {
  color?: string;
  color_soft?: string;
  icon?: string;
  is_terminal?: boolean;
  allowed_next_codes?: string[];
  required_permission?: string;
}

/** One value (RCV). */
export interface CodelistValue {
  code: string;
  label: string;
  symbol: string | null;
  description: string | null;
  sortOrder: number | null;
  isActive: boolean;
  isDefault: boolean;
  meta: StatusMeta & Record<string, unknown>;
}

/** Curation payloads. */
export interface CodelistValueCreate {
  code: string;
  label: string;
  symbol?: string;
  description?: string;
  sortOrder?: number;
}

export interface CodelistValuePatch {
  label?: string;
  symbol?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

/** Resolve a meta color to CSS: token refs wrap in var(); anything else
 *  (v1 hex) passes through. Pure — unit tested. */
export function metaColor(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.startsWith('--') ? `var(${value})` : value;
}
