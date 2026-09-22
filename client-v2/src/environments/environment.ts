export const environment = {
  production: false,
  // Two-track versioning (pV2-RELEASE-VERSIONING-01): `build` is the internal
  // per-commit counter (bump every commit); `release` is the client-facing
  // version (dev has none). `versionChip` is the derived label the chip shows.
  release: 'dev',
  build: 'v2.533',
  versionChip: 'Dev v2.533',
  // Cloudflare Turnstile site key for the public /welcome signup form
  // (public — safe to commit). Ported from v1.
  turnstileSiteKey: '0x4AAAAAADdwdzIjm6NbpAXD',
};
