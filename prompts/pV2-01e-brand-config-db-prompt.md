# pV2-01e — Brand config from DB (`bp_brand_config` table + ConfigService)

## Read first

1. `WORKING_STANDARDS.md`
2. `prompts/cc-onboarding.md`
3. `prompts/pV2-01b-shell-chrome-shipped.md` (the `--bp-*` tokens this builds on)
4. `prompts/pV2-01d-visual-tweaks-shipped.md`
5. This prompt

## Goal

Wire the `--bp-*` brand tokens to a real DB read, so the brand font, gradient,
and text color come from the database instead of being hardcoded in
`styles.css`. Proves the v2 → API → Postgres connection end-to-end and sets up
the runtime-configurable brand pattern.

After this lands: change a row in the `bp_brand_config` table, restart the
server, reload the client → the wordmark font changes. No code redeploy.

## What this builds

### 1. Schema — new `bp_brand_config` table

Add to `server/src/db/migrate-schemas.js` (mirrored to `public`, `preview`,
`master`):

```sql
CREATE TABLE IF NOT EXISTS public.bp_brand_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);
```

(No `deleted_at` — this is a config registry, rows never go away. Junctions
and registries skip soft-delete per WORKING_STANDARDS.)

Seed with the current default values so existing behaviour doesn't change:

```sql
INSERT INTO public.bp_brand_config (key, value) VALUES
  ('font_pair',  'Inter Tight'),
  ('gradient',   'linear-gradient(135deg, #fde7f0 0%, #e6f4ea 100%)'),
  ('text_color', '#1f2937')
ON CONFLICT (key) DO NOTHING;
```

Mirror identically to `preview.*` and `master.*` per the established pattern.

### 2. Server endpoint — `GET /api/brand`

New unauthenticated public endpoint at `server/src/routes/brand.js`:

```javascript
const router = require('express').Router();
const pool = require('../db/pool');

// GET /api/brand — returns all brand config as a flat key/value map.
// Public (no auth) so the login page can apply brand tokens before sign-in.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT key, value FROM bp_brand_config ORDER BY key'
    );
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json(map);
  } catch (err) { next(err); }
});

module.exports = router;
```

Mount it in `server/src/index.js` at `/api/brand`.

Response shape:
```json
{
  "font_pair": "Inter Tight",
  "gradient": "linear-gradient(135deg, #fde7f0 0%, #e6f4ea 100%)",
  "text_color": "#1f2937"
}
```

### 3. Client — `BrandConfigService`

New service at `client-v2/src/app/core/brand-config.service.ts`:

```typescript
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

interface BrandConfig {
  font_pair?: string;
  gradient?: string;
  text_color?: string;
}

const TOKEN_MAP: Record<keyof BrandConfig, string> = {
  font_pair:  '--bp-font',
  gradient:   '--bp-gradient',
  text_color: '--bp-text-color',
};

@Injectable({ providedIn: 'root' })
export class BrandConfigService {
  private api = inject(ApiService);
  private _config = signal<BrandConfig | null>(null);
  readonly config = this._config.asReadonly();

  async load(): Promise<void> {
    try {
      const cfg = await firstValueFrom(this.api.get<BrandConfig>('/brand'));
      this._config.set(cfg);
      this.applyToRoot(cfg);
    } catch (e) {
      console.warn('BrandConfig: failed to load, using styles.css defaults', e);
    }
  }

  private applyToRoot(cfg: BrandConfig): void {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(cfg)) {
      const token = TOKEN_MAP[key as keyof BrandConfig];
      if (token && value) {
        root.style.setProperty(token, value);
      }
    }
  }
}
```

### 4. Bootstrap order — load before render

In `main.ts`, load brand config FIRST (after runtime config, before bootstrap),
so the brand tokens are set on `:root` before the first paint. No font flash.

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { RuntimeConfigService } from './app/core/runtime-config.service';
import { BrandConfigService } from './app/core/brand-config.service';

(async () => {
  // 1. Runtime config (API URL etc.) — already from pV2-01
  // 2. Brand config (CSS tokens) — NEW
  // 3. Bootstrap Angular
  const ref = await bootstrapApplication(AppComponent, appConfig);
  await ref.injector.get(RuntimeConfigService).load();
  await ref.injector.get(BrandConfigService).load();
})();
```

If the order matters for first-paint reasons (it does — we want brand tokens
set before any component renders), CC's call on the cleanest implementation.
Possible alternatives: pre-bootstrap fetch via plain `fetch()` (no Angular DI
yet) that sets tokens on `<html>` element directly, then bootstrap proceeds.
Pick whichever delivers no FOUC (flash of unstyled content).

### 5. styles.css defaults stay as-is (fallback)

The hardcoded values in `styles.css` (Inter Tight, the gradient, etc.) stay as
fallbacks. If the API is down or the DB row is missing, the client still
renders with the same look. The DB just overrides at runtime.

## Acceptance criteria

1. `GET http://localhost:3001/api/brand` returns `{ font_pair, gradient, text_color }` from the DB.
2. Visiting `http://localhost:4201/` — wordmark + avatars render with the DB-sourced font/colors. Default values match what was in styles.css before (no visual change).
3. **The proof**: update the `bp_brand_config` row for `font_pair` to a different font (e.g., `'Georgia, serif'`), hard-refresh the client — wordmark + avatar initials render in Georgia. Restore the row to `'Inter Tight'`, refresh — back to Inter Tight.
4. Login page (pre-auth) renders with brand tokens applied — `BrandConfigService.load()` doesn't require auth.
5. If API is unreachable (stop the server temporarily, refresh client) — page still renders with styles.css defaults (no FOUC, no broken layout).
6. Schema migration applied to all three schemas (`public`, `preview`, `master`).
7. No FOUC: refreshing the page doesn't show a flash of default font then snap to DB font.
8. Old `client-angular/` on 4200 unchanged.
9. `ng build` clean, no `any` types, no `*ngIf` / `*ngFor`.
10. Bump version chip to `[Dev v2] v2.03a`.

## Out of scope

- Per-org brand overrides (multi-tenant white-label) — separate prompt
- UI for editing brand config (admin form) — separate prompt
- Caching, ETags, CDN headers on `/api/brand` — premature
- Other tokens beyond the three named — add as needed
- Touching `client-angular/`

## Why this matters

Three reasons we're doing it now instead of deferring:

1. **Proves the DB connection** — v2 ↔ API ↔ Postgres end-to-end. Until something
   reads from the DB, the v2 codebase is just static UI. This is the first
   real round-trip.
2. **Forward-compatible** — when we add per-org brand overrides later, the
   token apply mechanism is already in place. Just point `BrandConfigService`
   at a different endpoint that merges system + org overrides.
3. **Removes a hardcoded magic value** — `'Inter Tight'` was in `styles.css`
   as a placeholder. Now it's tracked, audited, changeable.

## Bump + ship

1. Version chip → `[Dev v2] v2.03a`
2. Commit messages — likely 3 small commits: schema migration, server route, client service + bootstrap wire
3. Ship report `prompts/pV2-01e-brand-config-db-shipped.md`
4. Flip backlog row to Done
5. **Include the proof in the ship report**: confirm step 3 of acceptance (change DB row → font changes on next load) was actually run

## Reply with

- Commit SHAs
- 10/10 acceptance criteria ticked
- Brief on how you avoided FOUC (which loading pattern you picked)
- Confirmation old app on 4200 still works
- The actual DB query you ran to verify step 3 of acceptance
