import { MyOrg, OrgType, Role, SessionUser } from './auth.service';

/** What clicking a persona does: switch the CURRENT user's active org
 *  (stay yourself — Liam, 2026-06-12), or impersonate a seeded user when
 *  the current user has no membership of that org type. */
export type PersonaAction =
  | { kind: 'switch-org'; orgId: string }
  | { kind: 'impersonate'; userId: string };

/** A dev-switcher persona: one entry per experience. */
export interface DevPersona {
  label: string;
  role: Role;
  action: PersonaAction;
}

/** The three experiences the dev switcher offers (Liam, 2026-06-11 — role
 *  personas instead of the seeded-user list). Order = display order. */
const PERSONA_ROLES: { label: string; role: Role; orgType: OrgType }[] = [
  { label: 'Ballpark Admin', role: 'ballpark_admin', orgType: 'ballpark' },
  { label: 'Agent', role: 'agency_admin', orgType: 'agency' },
  { label: 'Supplier', role: 'supplier_admin', orgType: 'supplier' },
];

/** Build the persona list. PREFERENCE ORDER per experience (Liam,
 *  2026-06-12 — "I should always be liam"):
 *  1. the current user's OWN membership of that org type → switch-org
 *  2. the first seeded user with that role → impersonate
 *  Experiences with neither are absent. Pure — unit tested. */
export function devPersonas(
  seededUsers: readonly SessionUser[],
  myOrgs: readonly MyOrg[] = []
): DevPersona[] {
  return PERSONA_ROLES.flatMap(({ label, role, orgType }): DevPersona[] => {
    const own = myOrgs.find((o) => o.orgType === orgType);
    if (own) {
      return [{ label, role: own.role, action: { kind: 'switch-org' as const, orgId: own.orgId } }];
    }
    const seeded = seededUsers.find((u) => u.role === role);
    if (seeded) {
      return [{ label, role, action: { kind: 'impersonate' as const, userId: seeded.id } }];
    }
    return [];
  });
}
