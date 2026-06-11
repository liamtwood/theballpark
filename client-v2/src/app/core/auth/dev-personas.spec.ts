import { devPersonas } from './dev-personas';
import { MyOrg, SessionUser } from './auth.service';

const u = (email: string, role: SessionUser['role']): SessionUser => ({
  id: email,
  email,
  displayName: email.split('@')[0],
  avatarUrl: null,
  activeOrgId: 'org',
  activeOrgName: 'Org',
  activeOrgType: 'agency',
  isAdmin: true,
  role,
});

const org = (orgId: string, orgType: MyOrg['orgType'], role: MyOrg['role']): MyOrg => ({
  orgId,
  orgName: orgId,
  orgType,
  role,
  isDefault: false,
});

describe('devPersonas', () => {
  it('maps one representative per role in display order (seeded fallback)', () => {
    const personas = devPersonas([
      u('alex@x', 'agency_member'),
      u('beth@x', 'ballpark_admin'),
      u('ryan@x', 'supplier_admin'),
      u('sarah@x', 'agency_admin'),
    ]);
    expect(personas.map((p) => p.label)).toEqual(['Ballpark Admin', 'Agent', 'Supplier']);
    expect(personas.map((p) => p.action)).toEqual([
      { kind: 'impersonate', userId: 'beth@x' },
      { kind: 'impersonate', userId: 'sarah@x' },
      { kind: 'impersonate', userId: 'ryan@x' },
    ]);
  });

  it('prefers the current user OWN membership over a seeded user', () => {
    const personas = devPersonas(
      [u('beth@x', 'ballpark_admin'), u('sarah@x', 'agency_admin')],
      [org('liams-ballpark', 'ballpark', 'ballpark_admin')]
    );
    expect(personas.map((p) => p.action)).toEqual([
      { kind: 'switch-org', orgId: 'liams-ballpark' }, // stay Liam
      { kind: 'impersonate', userId: 'sarah@x' }, // no own agency → seeded
    ]);
  });

  it('matches own memberships by org TYPE (member role still wins)', () => {
    const personas = devPersonas(
      [u('sarah@x', 'agency_admin')],
      [org('my-agency', 'agency', 'agency_member')]
    );
    expect(personas).toHaveLength(1);
    expect(personas[0].action).toEqual({ kind: 'switch-org', orgId: 'my-agency' });
    expect(personas[0].role).toBe('agency_member');
  });

  it('picks the FIRST matching seeded user per role', () => {
    const personas = devPersonas([u('a@x', 'agency_admin'), u('b@x', 'agency_admin')]);
    expect(personas).toHaveLength(1);
    expect(personas[0].action).toEqual({ kind: 'impersonate', userId: 'a@x' });
  });

  it('omits experiences with neither an own membership nor a seeded user', () => {
    expect(devPersonas([u('sarah@x', 'agency_admin')]).map((p) => p.label)).toEqual(['Agent']);
    expect(devPersonas([])).toEqual([]);
  });
});
