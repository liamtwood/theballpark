import { Role } from './auth.service';

// RBAC permissions matrix (client side). MIRRORED in
// server/src/services/permissions.service.js — keep the two in sync.

export type Permission =
  | 'org.invite_member'
  | 'org.manage_billing'
  | 'project.create'
  | 'project.delete'
  | 'item.create'
  | 'item.delete'
  | 'inbox.reply'
  | 'inbox.adjust_cost'
  | 'cart.checkout'
  | 'admin.cross_org_view';

const MATRIX: Record<Role, Permission[]> = {
  ballpark_admin: ['admin.cross_org_view'],
  agency_admin: ['org.invite_member', 'org.manage_billing', 'project.create', 'project.delete', 'item.create', 'item.delete', 'inbox.reply', 'inbox.adjust_cost', 'cart.checkout'],
  agency_member: ['project.create', 'item.create', 'inbox.reply', 'inbox.adjust_cost', 'cart.checkout'],
  supplier_admin: ['org.invite_member', 'org.manage_billing', 'item.create', 'item.delete', 'inbox.reply', 'inbox.adjust_cost'],
  supplier_member: ['item.create', 'inbox.reply', 'inbox.adjust_cost'],
};

/** True when the role grants the permission. Null role (signed out) → false. */
export function can(role: Role | null, perm: Permission): boolean {
  if (!role) return false;
  return MATRIX[role].includes(perm);
}
