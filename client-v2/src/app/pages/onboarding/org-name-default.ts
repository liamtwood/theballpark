/** Pre-filled org name for the onboarding form (pV2-02b):
 *  - "Liam Wood" + agency        → "Liam's Agency"
 *  - "Liam" (no space)           → "Liam's Agency"
 *  - no displayName, email set   → "liam.wood's Agency" (local-part)
 *  - neither                     → "" (user fills in)
 *  Suffix follows the selected org type. Pure function — unit tested. */
export function defaultOrgName(
  displayName: string | null,
  email: string | null,
  orgType: 'agency' | 'supplier'
): string {
  const suffix = orgType === 'agency' ? 'Agency' : 'Supplier';
  const name = displayName?.trim();
  if (name) {
    const first = name.split(/\s+/)[0];
    return `${first}'s ${suffix}`;
  }
  const local = email?.split('@')[0]?.trim();
  if (local) {
    return `${local}'s ${suffix}`;
  }
  return '';
}
