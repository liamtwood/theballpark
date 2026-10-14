# pV2-ORG-ADDRESSES-01 — ADDRESSES slice (v2dev rebuild, rebuild/org-slice)

**Shipped:** 2026-10-14, chip `[Dev v2] v2.741` (+ docs bump)
**Branch:** `rebuild/org-slice` · **DB:** v2dev (jwerngwvensmmhwrcgul); FR on shared (ixdcmicxlszcbrxvvzjz)
**Commits:**
- `a75b68b8` — public locality: `address_locality` definer + `orgs_public` join
- `81991a86` — un-null marketplace consumers (supplier city/country)
- `3688e45e` — fuller primary-address editor through the existing profile path (Option B)

## What landed
1. **Public locality (security core).** `public.address_locality(uuid)` — `SECURITY DEFINER`,
   `search_path = public, pg_temp` (pinned), returns **only** `city, country`, and **only** for a
   public supplier (`type='supplier' AND status='active'`). `EXECUTE` revoked from PUBLIC, granted
   `web_app_user`. `orgs_public` now `LEFT JOIN LATERAL`s it. The addresses RLS stays owner/admin-only;
   this is the single audited bypass, and it exposes nothing but locality. In
   `server/db/rebuild/0004_org_satellites.sql`, applied live.
2. **Un-nulled the marketplace consumers** that were stubbed during the address-satellite move:
   item list `supplier_city = o.city`, supplier list `o.city` (+ GROUP BY), supplier shopfront
   detail `city`/`country`. Street address (line1/postcode/region) stays out of every public response.
3. **Fuller primary-address editor — Option B** (parent call, confirmed): extend the ONE existing
   write path, no standalone CRUD service/routes/editor. Added `line2`, `region`, `postcode`, and an
   **address-type picker** (`address_type` codelist via `CodelistService`) to the inline Company
   Information block in **both** the owner (`profile.component`) and admin (`org-profile-edit`)
   surfaces. Writes flow through `OrganisationUpdateSchema → org-profile.service.updateOrgProfile →
   address.service.upsertPrimaryForOrg`; `org_id` is never read from the body (JWT for self, URL for
   admin). `latitude`/`longitude` kept out of the UI.
4. **Deferred to FR-00239** (shared, Settings area): standalone reusable address-editor component +
   full multi-address CRUD (registered/billing/site/shipping/venue) + `projects.venue_address_id`
   wiring — built when real consumers land.

## Files touched
| File | Notes |
|---|---|
| server/db/rebuild/0004_org_satellites.sql | `address_locality` definer + `orgs_public` lateral join |
| server/src/routes/marketplace.js | item list: `supplier_city = o.city` |
| server/src/routes/marketplace-suppliers.js | supplier list (`o.city` + GROUP BY) + detail (`city`/`country`) |
| server/src/schemas/organisation.schema.js | +line2/region/postcode (free text) + addressType (item_tier pattern) |
| server/src/services/org-profile.util.js | project + map line2/region/postcode/type |
| server/src/services/address.service.js | new line cols; `type` handled apart (NOT NULL; INSERT default 'registered', picked wins) |
| client-v2/.../core/organisation.service.ts | OrgProfile DTO +line2/region/postcode/addressType |
| client-v2/.../profile/profile-edit.service.ts | ProfileForm + toForm + save payload + addressTypeOptions |
| client-v2/.../profile/org-profile-edit.component.ts | admin editor address group + type picker |
| client-v2/.../profile/profile.component.ts | owner editor address group + type picker |

## Acceptance — verified
- Definer is `SECURITY DEFINER`, pinned `search_path`, returns `TABLE(city, country)`. ✓
- Non-public probes return nothing: ballpark org (type) → ∅; suspended supplier (status) → ∅. ✓
- Active supplier → `London/GB` (flip-tested, restored to suspended). ✓
- `orgs_public` projects `city`/`country`; all three marketplace queries run against the new view. ✓
- `ORG_PROFILE_SELECT` returns address/line2/city/region/postcode/country/address_type. ✓
- Backend boots clean on :3002; Angular bundle generation complete, no errors (:4202). ✓
- `organisation.schema.test.js` — 5/5 pass (new keys pass through; unknown keys still stripped). ✓

## API audit checklist (Rule 10)
#### `PUT /api/organisation` (self) & `PUT /api/admin/orgs/:id` (admin mirror) — routes unchanged; request contract widened
- HTTP semantics: PUT, partial patch. ✓
- Input validation: `OrganisationUpdateSchema` (Zod) — new fields bounded; `.strip()` drops unknowns. ✓
- Authorization: self = `req.user.org_id` (JWT, never body); admin = `:id` from URL + RLS (orgs/addresses
  UPDATE member-only post-FR-00215; admin edit gated to active-org membership client + DB). ✓
- Status codes: 400 invalid / 400 no-op / 404 missing / 200 fresh. ✓
- Response shape: camelCase `OrgProfile` incl. the new fields. ✓
- Information disclosure: line1/line2/region/postcode never enter any public projection (only city/country). ✓
- Idempotency: PUT is idempotent (upsert of the one primary). ✓
- Atomicity: orgs row + address write share `withTransaction`. ✓
#### `GET /api/marketplace/items`, `GET /api/marketplace/suppliers`, `GET /api/marketplace/suppliers/:id`
- Projection-only change (added `city`/`country` from `orgs_public`). No new input/authz surface. Still
  reads the `orgs_public` view (RLS-safe cross-org). ✓

## Concerns not in spec
### Address type not server-asserted against the codelist
**Where:** server/src/schemas/organisation.schema.js (`addressType`), server/src/services/address.service.js
**What:** Per the parent's instruction, `addressType` follows the `items.tier` pattern — a trimmed free
string, codelist-governed by the UI, not value-checked server-side (the DB CHECK was deliberately dropped,
"register don't FK-enforce"). An API client could persist an off-codelist type. Consistent with `items.tier`.
**Suggested fix:** optional — a shared codelist-assert helper for both consumers; captured in FR-00239.
**Severity:** LOW
### Address fields duplicated across the two editor templates
**Where:** profile.component.ts + org-profile-edit.component.ts (Company Information block)
**What:** The address inputs are duplicated inline (the established "share the service, duplicate the
template" pattern for these two surfaces — the owner page interleaves owner-only fields). Adding 4 fields
widened it. Not extracted now because the standalone component is explicitly deferred (FR-00239).
**Suggested fix:** extract the standalone address-editor under FR-00239 when multi-address ships.
**Severity:** LOW

## Iteration — v2.743 (2026-10-14)
**Triggered by designer review (via parent):** on a single primary address a type
picker is friction for no value; and the type default disagreed (DDL 'site' vs
writer 'registered').
**Commit:** `6ba7ab48`
**Changes:**
- Removed the Address type `<app-select>` from BOTH editor blocks (owner + admin).
  Fields kept: line1/line2/city/postcode/region/country.
- `upsertPrimaryForOrg` now defaults the primary to `'site'` (matches the DDL;
  locality the marketplace shows). Existing v2dev primary rows re-set to `'site'`.
- `addressType` stays in the server schema (optional) for FR-00239; client no
  longer surfaces or sends it. Removed the now-dead client form plumbing
  (ProfileForm/toForm/payload/addressTypeOptions); `OrgProfile.addressType` kept
  as a read-only contract field.
- Re-confirmed the single write path: `PUT /api/organisation` (self, JWT org_id)
  and `PUT /api/admin/orgs/:id` (admin, URL id) both → `org-profile.service
  .updateOrgProfile` → `address.service.upsertPrimaryForOrg`. No parallel path.
Backend rebooted clean on :3002; Angular HMR recompiled clean (:4202).
This supersedes the type-picker line in "What landed" §3 and resolves Concern #1's
UI portion (no picker now; server still follows the items.tier non-assert pattern).

## QC notes
(Liam fills this in)

## Chat audit
(chat fills this in)
