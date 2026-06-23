# Shipped — pV2-01e — Brand config from DB (`bp_brand_config` + BrandConfigService)

**Version:** v2.03a (chip `[Dev v2] v2.03a`)
**Shipped:** see commit log (3 atomic commits: schema · server route · client wire)
**Prompt:** `pV2-01e-brand-config-db-prompt.md`

## What changed
- **Schema** — `bp_brand_config` (key/value registry, audit cols, **no `deleted_at`** per the registry exemption) added to `server/src/db/migrate-schemas.js`, mirrored to `public` / `preview` / `master`, seeded `ON CONFLICT DO NOTHING`. Migration run — table + seeds confirmed in all three schemas.
- **Server** — new public `GET /api/brand` (`server/src/routes/brand.js`, mounted in `index.js`): flat key/value map from `bp_brand_config`. Unauthenticated so the login page brands pre-sign-in.
- **Client** — `client-v2/src/app/core/brand-config.service.ts`: fetches `/api/brand`, holds a `signal<BrandConfig|null>`, applies values onto the `--bp-*` tokens on `:root` (`font_pair → --bp-font`, `gradient → --bp-gradient`, `text_color → --bp-text-color`). `load()` never throws — brand is cosmetic; failure keeps the styles.css fallbacks.
- **Bootstrap wire** — brand load chained after runtime-config inside the existing `provideAppInitializer` in `app.config.ts`.
- Env chips → `v2.03a`.

## FOUC avoidance — which pattern and why
**`provideAppInitializer` chain** (runtime-config → brand), not the prompt's post-bootstrap `main.ts` sketch. App initializers complete **before Angular's first render**, so the `--bp-*` inline tokens are on `:root` before any component paints — zero flash. (The prompt's sketch awaits `bootstrapApplication` first, which paints before the brand fetch lands — that's the FOUC case it warned about. The pre-bootstrap-plain-`fetch` alternative would work too but duplicates the API-base resolution that RuntimeConfigService already owns.)

## Seed values — deviation from the prompt's literal seeds (per Liam's instruction)
The prompt's example seeded `'Inter Tight'` + the **pastel** gradient — drafted before pV2-01f made the gradient vivid. Liam's instruction said "seeded with the **vivid values from pV2-01f**", and acceptance 2 requires "no visual change" — the prompt's own seeds would have regressed pV2-01f (pastel avatar) and broken font fallback (`Inter Tight` isn't a loaded webfont). Seeded instead with the current styles.css values: the system-sans stack / vivid `#d63384 → #16a34a` gradient / `#1f2937`.

## The proof (acceptance 3 — actually run)
```sql
UPDATE public.bp_brand_config SET value='Georgia, serif', updated_at=NOW() WHERE key='font_pair';
-- reload http://localhost:4201 → wordmark + avatar initials computed font-family = "Georgia, serif" ✓ (no server restart needed)
UPDATE public.bp_brand_config SET value='ui-sans-serif, system-ui, -apple-system, ''Segoe UI'', Roboto, sans-serif', updated_at=NOW() WHERE key='font_pair';
-- reload → back to the system stack ✓
```
Verified via computed styles on both elements after each reload.

## Verify — 10/10
1. ✓ `GET /api/brand` → `{font_pair, gradient, text_color}` from the DB.
2. ✓ `/` renders from DB-sourced tokens (inline on `:root`, set by the service) — visuals identical to pre-pV2-01e.
3. ✓ **The proof** — DB row → Georgia on reload; restored → system stack (transcript above).
4. ✓ `/login` (pre-auth) has brand tokens applied (endpoint is public).
5. ✓ API stopped + reload → page renders on styles.css fallbacks (no inline token, no FOUC, no broken layout; avatar still vivid). Server restarted after.
6. ✓ Migration mirrored to `public` / `preview` / `master` (run output: "all schemas").
7. ✓ No FOUC — initializer chain sets tokens pre-first-paint.
8. ✓ Old `client-angular/` on 4200 unchanged (`[Dev] v1.70a`).
9. ✓ `ng build` + `ng lint` clean; no `any` / `*ngIf` / `*ngFor`.
10. ✓ Chip `[Dev v2] v2.03a`.

pV2-01e flipped to `Done` in `prompts/backlog.md`. First real v2 ↔ API ↔ Postgres round-trip is live; per-org brand overrides later just repoint the endpoint.
