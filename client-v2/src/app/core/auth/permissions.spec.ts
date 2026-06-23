import { can } from './permissions';
import { Role } from './auth.service';

// pV2-AUDIT-02 fix 6 — the security-path pure function gets the first tests.
// One block per role asserting representative grants AND denials, so a matrix
// edit that widens or narrows a role fails here before it ships.

describe('can()', () => {
  it('denies everything for a null role (signed out)', () => {
    expect(can(null, 'org.invite_member')).toBe(false);
    expect(can(null, 'cart.checkout')).toBe(false);
    expect(can(null, 'admin.cross_org_view')).toBe(false);
  });

  describe('ballpark_admin', () => {
    it('grants cross-org view only', () => {
      expect(can('ballpark_admin', 'admin.cross_org_view')).toBe(true);
    });
    it('holds no org-level powers (operates across orgs, not within one)', () => {
      expect(can('ballpark_admin', 'org.invite_member')).toBe(false);
      expect(can('ballpark_admin', 'project.create')).toBe(false);
      expect(can('ballpark_admin', 'cart.checkout')).toBe(false);
    });
  });

  describe('agency_admin', () => {
    it('grants org management', () => {
      expect(can('agency_admin', 'org.invite_member')).toBe(true);
      expect(can('agency_admin', 'org.manage_billing')).toBe(true);
    });
    it('grants the full project/commerce surface', () => {
      expect(can('agency_admin', 'project.create')).toBe(true);
      expect(can('agency_admin', 'project.delete')).toBe(true);
      expect(can('agency_admin', 'cart.checkout')).toBe(true);
    });
    it('does not grant ballpark cross-org view', () => {
      expect(can('agency_admin', 'admin.cross_org_view')).toBe(false);
    });
  });

  describe('agency_member', () => {
    it('can create but not delete or manage the org', () => {
      expect(can('agency_member', 'project.create')).toBe(true);
      expect(can('agency_member', 'item.create')).toBe(true);
      expect(can('agency_member', 'project.delete')).toBe(false);
      expect(can('agency_member', 'item.delete')).toBe(false);
      expect(can('agency_member', 'org.invite_member')).toBe(false);
      expect(can('agency_member', 'org.manage_billing')).toBe(false);
    });
    it('can transact in the inbox and checkout', () => {
      expect(can('agency_member', 'inbox.reply')).toBe(true);
      expect(can('agency_member', 'inbox.adjust_cost')).toBe(true);
      expect(can('agency_member', 'cart.checkout')).toBe(true);
    });
  });

  describe('supplier_admin', () => {
    it('manages the org and catalogue but has no project/checkout surface', () => {
      expect(can('supplier_admin', 'org.invite_member')).toBe(true);
      expect(can('supplier_admin', 'item.create')).toBe(true);
      expect(can('supplier_admin', 'item.delete')).toBe(true);
      expect(can('supplier_admin', 'project.create')).toBe(false);
      expect(can('supplier_admin', 'cart.checkout')).toBe(false);
    });
  });

  describe('supplier_member', () => {
    it('works the catalogue and inbox, nothing administrative', () => {
      expect(can('supplier_member', 'item.create')).toBe(true);
      expect(can('supplier_member', 'inbox.reply')).toBe(true);
      expect(can('supplier_member', 'inbox.adjust_cost')).toBe(true);
      expect(can('supplier_member', 'item.delete')).toBe(false);
      expect(can('supplier_member', 'org.invite_member')).toBe(false);
      expect(can('supplier_member', 'cart.checkout')).toBe(false);
    });
  });

  it('admin roles strictly widen their member counterpart (no member-only perms)', () => {
    const pairs: [Role, Role][] = [
      ['agency_admin', 'agency_member'],
      ['supplier_admin', 'supplier_member'],
    ];
    const ALL_PERMS = [
      'org.invite_member', 'org.manage_billing', 'project.create', 'project.delete',
      'item.create', 'item.delete', 'inbox.reply', 'inbox.adjust_cost',
      'cart.checkout', 'admin.cross_org_view',
    ] as const;
    for (const [admin, member] of pairs) {
      for (const perm of ALL_PERMS) {
        if (can(member, perm)) {
          expect(can(admin, perm), `${admin} must include ${member}'s ${perm}`).toBe(true);
        }
      }
    }
  });
});
