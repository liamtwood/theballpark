import { devPersonas } from './dev-personas';
import { SessionUser } from './auth.service';

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

describe('devPersonas', () => {
  it('maps one representative per role in display order', () => {
    const personas = devPersonas([
      u('alex@x', 'agency_member'),
      u('beth@x', 'ballpark_admin'),
      u('ryan@x', 'supplier_admin'),
      u('sarah@x', 'agency_admin'),
    ]);
    expect(personas.map((p) => p.label)).toEqual(['Ballpark Admin', 'Agent', 'Supplier']);
    expect(personas.map((p) => p.user.email)).toEqual(['beth@x', 'sarah@x', 'ryan@x']);
  });

  it('picks the FIRST matching user per role', () => {
    const personas = devPersonas([u('a@x', 'agency_admin'), u('b@x', 'agency_admin')]);
    expect(personas).toHaveLength(1);
    expect(personas[0].user.email).toBe('a@x');
  });

  it('omits roles with no seeded user', () => {
    expect(devPersonas([u('sarah@x', 'agency_admin')]).map((p) => p.label)).toEqual(['Agent']);
    expect(devPersonas([])).toEqual([]);
  });
});
