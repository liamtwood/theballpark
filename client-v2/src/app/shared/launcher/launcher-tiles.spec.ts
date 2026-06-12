import {
  AGENT_TILES,
  BALLPARK_TILES,
  PROJECTS_HUB_TILES,
  STOREFRONT_TILES,
  SUPPLIER_TILES,
  tileForPath,
  tilesForOrgType,
} from './launcher-tiles';

describe('tilesForOrgType', () => {
  it('keys the set on org type', () => {
    expect(tilesForOrgType('ballpark')).toBe(BALLPARK_TILES);
    expect(tilesForOrgType('supplier')).toBe(SUPPLIER_TILES);
    expect(tilesForOrgType('agency')).toBe(AGENT_TILES);
  });

  it('defaults to the agent set for null/undefined (orgless edge)', () => {
    expect(tilesForOrgType(null)).toBe(AGENT_TILES);
    expect(tilesForOrgType(undefined)).toBe(AGENT_TILES);
  });
});

describe('tileForPath', () => {
  it('prefers the viewer org type when sets share an href', () => {
    // /projects/new + /projects live in the agent set; an agent gets agent copy.
    expect(tileForPath('/projects/new', 'agency')?.label).toBe('New Project');
    expect(tileForPath('/projects', 'agency')?.subtitle).toContain('supplier conversations');
  });

  it('resolves hub bucket drills by DECLARED query params over plain matches', () => {
    expect(tileForPath('/projects', 'supplier', { bucket: 'quoting' })?.label).toBe('Quoting');
    expect(tileForPath('/projects', 'supplier', { bucket: 'live' })?.label).toBe('Live Projects');
    // No bucket → the plain list tile (agent fallback; supplier home now
    // points at /projects-hub, so the supplier set has no /projects tile).
    expect(tileForPath('/projects', 'supplier')?.label).toBe('Projects');
  });

  it('falls back across ALL sets when the preferred set misses', () => {
    // /store lives only in the storefront hub set; any viewer resolves it.
    expect(tileForPath('/store', 'agency')?.label).toBe('My Shop');
    // /settings/pages lives only in the ballpark set.
    expect(tileForPath('/settings/pages', 'supplier')?.label).toBe('Page Settings');
  });

  it('returns undefined for unknown paths', () => {
    expect(tileForPath('/nope', 'agency')).toBeUndefined();
  });
});

describe('registry invariants', () => {
  it('every tile href is an absolute app path', () => {
    const all = [
      ...AGENT_TILES,
      ...SUPPLIER_TILES,
      ...BALLPARK_TILES,
      ...PROJECTS_HUB_TILES,
      ...STOREFRONT_TILES,
    ];
    for (const t of all) {
      expect(t.href.startsWith('/')).toBe(true);
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.icon.length).toBeGreaterThan(0);
    }
  });

  it('no duplicate hrefs WITHIN a set (cross-set sharing is by design)', () => {
    for (const set of [AGENT_TILES, SUPPLIER_TILES, BALLPARK_TILES, STOREFRONT_TILES]) {
      const hrefs = set.map((t) => t.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
    }
    // PROJECTS_HUB_TILES deliberately shares /projects across buckets —
    // differentiated by query params instead.
    const buckets = PROJECTS_HUB_TILES.map((t) => t.query?.['bucket']);
    expect(new Set(buckets).size).toBe(PROJECTS_HUB_TILES.length);
  });
});
