import { createRequire } from 'node:module';
import { MATRIX as clientMatrix } from './permissions';

// pV2-AUDIT-02 fix 6 — enforced cross-boundary duplication (WORKING_STANDARDS
// §"Cross-boundary duplication must be enforced, not commented"). The client
// matrix (TS) and server matrix (CJS) are intentional twins; this spec turns
// the "keep the two in sync" comment into a failing test.
//
// The server module is CommonJS, loaded via createRequire — vitest runs these
// specs in Node, so reaching across the repo boundary is fine here (and ONLY
// here; app code never imports server code).

const require = createRequire(import.meta.url);
// client-v2/src/app/core/auth → repo root is five levels up.
const serverPermissions = require('../../../../../server/src/services/permissions.service.js') as {
  MATRIX: Record<string, string[]>;
};

describe('permissions matrix parity (client ↔ server)', () => {
  it('declares the same role set', () => {
    expect(Object.keys(clientMatrix).sort()).toEqual(Object.keys(serverPermissions.MATRIX).sort());
  });

  it('grants identical permissions per role', () => {
    for (const role of Object.keys(clientMatrix) as (keyof typeof clientMatrix)[]) {
      expect([...clientMatrix[role]].sort(), `role ${role} diverges`).toEqual(
        [...serverPermissions.MATRIX[role]].sort()
      );
    }
  });
});
