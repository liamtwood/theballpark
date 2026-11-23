import { SessionUser } from '../../core/auth/auth.service';

/** The edit destination for a catalogue item from a browse / moderation surface,
 *  gated to the viewer's rights:
 *    - the item's OWNER (active org == supplier) → their own store editor;
 *    - anyone else → null (no Edit affordance).
 *  Seat-scoped model (Liam 2026-11-23): a ballpark admin edits another org's items
 *  only by holding a seat and using admin → Orgs "Switch to" (then active org == the
 *  supplier → the owner branch applies). Without a seat they get VIEW + Approve/Reject
 *  (moderation), never an Edit link — so this no longer hands admins a blanket
 *  cross-org edit. ONE definition shared by the Quick View dialog and the item card's
 *  moderation actions. Returns a RouterLink commands array, or null. */
export function itemEditLink(
  user: SessionUser | null | undefined,
  item: { id: string; bpin?: string | null; supplierId: string } | null | undefined,
): string[] | null {
  if (!user || !item) return null;
  // Public/store route uses the human BPIN (pV2-BPIN-01), falling back to the UUID.
  if (user.activeOrgId === item.supplierId) return ['/store/items', item.bpin ?? item.id];
  return null;
}
