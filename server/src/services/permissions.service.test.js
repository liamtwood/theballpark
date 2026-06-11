// pV2-AUDIT-02 fix 6 — node:test suite for the security-path pure functions.
// Run via `npm test` (node --test discovers *.test.js).

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { effectiveRole, normalizeOrgType, can, MATRIX } = require('./permissions.service');

describe('normalizeOrgType', () => {
  test("maps legacy 'admin' to 'ballpark' (v1 data is not mutated)", () => {
    assert.equal(normalizeOrgType('admin'), 'ballpark');
  });

  test('passes v2 types through untouched', () => {
    assert.equal(normalizeOrgType('agency'), 'agency');
    assert.equal(normalizeOrgType('supplier'), 'supplier');
    assert.equal(normalizeOrgType('ballpark'), 'ballpark');
  });
});

describe('effectiveRole', () => {
  test('ballpark members are always admins, regardless of the flag', () => {
    assert.equal(effectiveRole('ballpark', true), 'ballpark_admin');
    assert.equal(effectiveRole('ballpark', false), 'ballpark_admin');
    assert.equal(effectiveRole('admin', false), 'ballpark_admin'); // legacy type
  });

  test('agency derives by is_admin', () => {
    assert.equal(effectiveRole('agency', true), 'agency_admin');
    assert.equal(effectiveRole('agency', false), 'agency_member');
  });

  test('supplier derives by is_admin', () => {
    assert.equal(effectiveRole('supplier', true), 'supplier_admin');
    assert.equal(effectiveRole('supplier', false), 'supplier_member');
  });

  test('throws on an unknown org type (fail closed, not open)', () => {
    assert.throws(() => effectiveRole('marketplace', true), /Unknown org type/);
  });
});

describe('can', () => {
  test('agency admin can invite; member cannot', () => {
    assert.equal(can('agency', true, 'org.invite_member'), true);
    assert.equal(can('agency', false, 'org.invite_member'), false);
  });

  test('supplier admin manages the catalogue but cannot checkout', () => {
    assert.equal(can('supplier', true, 'item.delete'), true);
    assert.equal(can('supplier', true, 'cart.checkout'), false);
  });

  test('only ballpark holds cross-org view', () => {
    assert.equal(can('ballpark', true, 'admin.cross_org_view'), true);
    assert.equal(can('agency', true, 'admin.cross_org_view'), false);
    assert.equal(can('supplier', true, 'admin.cross_org_view'), false);
  });

  test('members can transact in the inbox', () => {
    assert.equal(can('agency', false, 'inbox.reply'), true);
    assert.equal(can('agency', false, 'inbox.adjust_cost'), true);
    assert.equal(can('supplier', false, 'inbox.reply'), true);
  });

  test('unknown permission strings are simply not granted', () => {
    assert.equal(can('agency', true, 'org.summon_dragons'), false);
  });
});

describe('MATRIX shape', () => {
  test('covers exactly the five effective roles', () => {
    assert.deepEqual(
      Object.keys(MATRIX).sort(),
      ['agency_admin', 'agency_member', 'ballpark_admin', 'supplier_admin', 'supplier_member']
    );
  });

  test('admin roles strictly widen their member counterpart', () => {
    for (const [admin, member] of [['agency_admin', 'agency_member'], ['supplier_admin', 'supplier_member']]) {
      for (const perm of MATRIX[member]) {
        assert.ok(MATRIX[admin].includes(perm), `${admin} must include ${member}'s ${perm}`);
      }
    }
  });
});
