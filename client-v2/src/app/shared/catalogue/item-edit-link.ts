import { SessionUser } from '../../core/auth/auth.service';

/** The edit destination for a catalogue item from a browse / moderation surface,
 *  gated to the viewer's rights:
 *    - the item's OWNER (active org == supplier) → their own store editor;
 *    - a platform (ballpark) admin on another org's item → the org-scoped
 *      editor / approve page;
 *    - anyone else → null (no Edit affordance).
 *  ONE definition shared by the Quick View dialog and the item card's moderation
 *  actions (extract-before-duplicate — docs/ENGINEERING.md). Returns a RouterLink
 *  commands array, or null when the viewer can't edit. */
export function itemEditLink(
  user: SessionUser | null | undefined,
  item: { id: string; bpin?: string | null; supplierId: string } | null | undefined,
): string[] | null {
  if (!user || !item) return null;
  // Public/store route uses the human BPIN (pV2-BPIN-01), falling back to the UUID;
  // the admin route stays UUID-keyed (Liam 2026-11-20).
  if (user.activeOrgId === item.supplierId) return ['/store/items', item.bpin ?? item.id];
  if (user.activeOrgType === 'ballpark') return ['/admin/orgs', item.supplierId, 'items', item.id];
  return null;
}
