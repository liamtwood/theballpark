import { Role, SessionUser } from './auth.service';

/** A dev-switcher persona: one representative seeded user per experience. */
export interface DevPersona {
  label: string;
  role: Role;
  user: SessionUser;
}

/** The three experiences the dev switcher offers (Liam, 2026-06-11 — role
 *  personas instead of the seeded-user list). Order = display order. */
const PERSONA_ROLES: { label: string; role: Role }[] = [
  { label: 'Ballpark Admin', role: 'ballpark_admin' },
  { label: 'Agent', role: 'agency_admin' },
  { label: 'Supplier', role: 'supplier_admin' },
];

/** Map the seeded dev users to one persona per role (first match wins).
 *  Roles with no seeded user are simply absent. Pure — unit tested. */
export function devPersonas(users: readonly SessionUser[]): DevPersona[] {
  return PERSONA_ROLES.flatMap(({ label, role }) => {
    const user = users.find((u) => u.role === role);
    return user ? [{ label, role, user }] : [];
  });
}
