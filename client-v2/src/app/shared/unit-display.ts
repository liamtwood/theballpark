// ONE place that turns an item_unit code (+ its unit-driven size) into display
// text, so every surface — item preview, quick view, the SOW production table —
// reads the unit the same way the item edit card does. The codelist label is the
// source of truth ("platter" → "Package (serves N)"); we either fill the "N" or
// strip the "(…)" depending on whether the surface shows the size separately.

import { CodelistValue } from '../core/codelists/codelist.types';

/** The unit TYPE label — the codelist label with any "(serves N)" suffix removed,
 *  e.g. 'platter' → "Package". For table cells where the size sits in its own
 *  column. Falls back to the de-underscored code. */
export function unitTypeLabel(
  code: string | null | undefined,
  units: readonly CodelistValue[] | null | undefined,
): string {
  if (!code) return '';
  const label = units?.find((u) => u.code === code)?.label ?? code.replace(/_/g, ' ');
  return label.replace(/\s*\(.*\)\s*$/, '').trim() || code;
}

/** The full unit display with its size filled in, matching the item card:
 *  'platter' + 150 → "Package (serves 150)". Uses the codelist label's own "N"
 *  placeholder when it has one (so each unit's wording stays correct), else
 *  appends "(serves <n>)". Just the type when there's no size. */
export function unitServesLabel(
  code: string | null | undefined,
  size: number | string | null | undefined,
  units: readonly CodelistValue[] | null | undefined,
): string {
  if (!code) return '';
  const label = units?.find((u) => u.code === code)?.label ?? code.replace(/_/g, ' ');
  // The label owns the phrasing: fill its "N" placeholder with the size when we
  // have one (e.g. "Package (serves N)" → "Package (serves 150)"). No size, or a
  // label with no placeholder → the plain type (any stray "(…)" stripped).
  if (size != null && size !== '' && /\bN\b/.test(label)) return label.replace(/\bN\b/, String(size));
  return label.replace(/\s*\(.*\)\s*$/, '').trim() || code;
}
