# pV2-IMPORT-ORG-01 — Fetch supplier org from website (deterministic)

**Type:** server + client-v2 · first slice of the website-as-load onboarding
**Owner:** CC implements + commits. Chat authored + validated against a live
vendor (yahire.com). Tracker: under the Items/Import epic (STORE-IMPORT arc).
**Depends on:** nothing hard; complements pV2-STORE-IMPORT-01 (Phase-0 codelists).
No overlap with the codelists slice (different files).

## Goal
Given a vendor **URL**, deterministically **pre-fill the supplier org profile**
from the site's structured data. **No new screen** — a **"Fetch from website"**
action on the **existing profile/shopfront**, driven by the existing
**`orgs.website`** field. This is the org half of the "give us your website, we
build your catalogue" onboarding; the item catalogue load is a later slice.

**Entry point = the existing profile, persona-agnostic (Liam, 2026-09-18).** There
is **no new intake/Add-supplier screen and no wizard.** The org is created via the
paths that already exist (supplier self-serve onboarding, or admin org tools); the
whole intake is the **URL + a load trigger on the existing profile**, and the same
trigger serves BOTH actors:
- **new supplier (self-serve)** — sets their own `website` → load;
- **admin in org context** — acting in the vendor org's context → sets `website`
  → load (concierge). This is exactly why the **target-org wiring** (Part C) is
  required — the profile action must operate on the org-in-context, not only the
  session org.

## Principles (hold)
- **Deterministic, NO AI.** The org block is a field-by-field coalesce from
  structured data. AI is reserved for the later *taxonomy* mapping, not here.
- **JSON-LD first, from the site ROOT.** The `Organization`/`LocalBusiness`
  JSON-LD node is site-level and stable on every page — fetch the homepage and
  read it there. og:/meta are fallbacks. NEVER trust a page's `meta description`
  except on the homepage (on a product page it describes the product).
- **Dependency-free.** Node 24 native `fetch`; extract `<script
  type="application/ld+json">`, `<meta>`, `og:` via regex + `JSON.parse`. Do NOT
  add cheerio/jsdom.
- **Reuse existing screens.** Pre-fill the existing profile form + save via
  `org.service.update`. No new UI beyond the one Fetch button.
- **Admin-gated + safe fetch.** v2 admin only. Fetch http(s) only; block
  private/loopback hosts (SSRF guard); timeout (~8s); cap body size; follow ≤3
  redirects. Consent is implicit (admin onboarding a known vendor) — this is not
  an open-web crawler.
- **Never fabricate — blank beats a wrong guess.** Every field carries a
  **confidence** (high | medium | low). There are **two review gates** — our
  admin at onboarding, then the **vendor themselves when we hand them the org** —
  so a blank is safe (someone fills it later). Rule: **high → fill silently;
  medium → fill + highlight ("auto-filled, please check"); low/none → leave
  blank.** Confidence by source: JSON-LD exact field = high; og:/meta or parsed
  PostalAddress = medium; footer-regex (company/VAT) or inferred (currency) =
  low.

## Part A — extractor service (server, pure-ish + testable)
`server/src/services/org-import.service.js` (new):
`extractOrg(url)` → fetch the ROOT of the host → parse → return a normalized org
map. Split the pure parse (`parseOrgFromHtml(html, {isHomepage})`) from the fetch
so it unit-tests without network.

**Field map (source priority, first non-empty wins):**
| our `orgs` field | source priority |
|---|---|
| name | JSON-LD `Organization.name` → og:site_name → `<title>` head |
| description | **JSON-LD `Organization.description`** → og:description → meta description (homepage only) |
| website | the input URL (normalized to origin) |
| logo_url | JSON-LD `Organization.logo` → og:image |
| cover_image_url | JSON-LD `Organization.image[0]` → og:image |
| address / city / country | JSON-LD `address` (PostalAddress: streetAddress / addressLocality / addressCountry) |
| phone | JSON-LD `telephone` → `a[href^=tel:]` |
| email | JSON-LD `email` → `a[href^=mailto:]` |
| default_currency | JSON-LD `priceRange`/currency hints → address country → GBP default |
| location_coverage (free text) | JSON-LD `areaServed` |
| company_number | footer regex `/company (?:number|no)\.?\s*[:#]?\s*(\d{6,8})/i` |
| vat_number / vat_registered | footer regex `/VAT (?:reg\w*)?\s*(?:number|no)?\.?\s*[:#]?\s*([\d\s]{9,})/i` → true |
| (socials — no column) | JSON-LD `sameAs[]` — ignore for now or stash in a note |

**Decision pattern (description shown; every field is this shape):**
```js
const firstNonEmpty = (xs) => xs.map(s => (s ?? '').toString().trim()).find(s => s) || null;
function pickOrgDescription(root, org) {
  return firstNonEmpty([
    org?.description,                                   // JSON-LD (Yahire hits here)
    root.meta['og:description'],
    root.isHomepage ? root.meta['description'] : null,  // page meta ONLY on homepage
  ]);
}
```
`findOrgNode`: flatten every JSON-LD block's `@graph`, pick the node whose
`@type` (string or array) includes `Organization` or `LocalBusiness`.

`type` is always **`'supplier'`** (we're onboarding a vendor). Commercial fields
(`subscription_tier`, `default_vat_pct`, margins) are NOT scraped — admin sets
them. Return only what was found (nulls omitted) so the form only overwrites
fields we actually parsed.

**Return per-field confidence.** Shape each field as `{ value, confidence }`
(high|medium|low) per the confidence rule above — the confidence maps directly
from which source in the priority list matched. Fields with no source are
omitted (→ blank in the form).

## Part B — API (server, gated)
`POST /api/v2/org-import/preview` (v2 admin) — body `{ url }` (zod: http(s) URL).
Returns `{ org: <normalized map>, source: { jsonLd: bool, og: bool } }`.
**Preview only — persists nothing.** The client pre-fills the form; the admin
saves through the existing profile save (`org.service.update` / create).

## Part C — client (reuse the profile screen)
- On the supplier profile, next to the existing `website` field, add a **"Fetch
  from website"** button → calls the preview API → fill the form per confidence:
  **high** patched silently; **medium** patched + a subtle **"auto-filled, please
  check"** highlight on the field; **low/none** left blank. Admin reviews → Save.
- The highlight is a light, dismissible field marker (clears on edit/confirm) —
  reuse existing form-field styling, don't invent a component. It's guidance for
  both our admin and the **vendor's own review on handover**.
- **Target-org wiring:** the profile screen today edits the session org; for
  onboarding, the admin edits the *vendor* org — allow the screen/service to take
  a target org id. (Small; the one real reuse-blocker flagged in design.)
- Empty/failed fetch → non-blocking toast ("couldn't read that site — fill
  manually"); the form still works.

## Acceptance
- [ ] `POST /api/v2/org-import/preview { url:"https://www.yahire.com" }` returns
      name=Yahire, **description = the JSON-LD one** (NOT the page meta), logo,
      address (Unit 13 Cranford Way / London), phone, email, company_number
      7602218, vat_number, currency GBP.
- [ ] Description sourced from JSON-LD; feeding a product-page URL still yields
      the ORG description (root-fetch + homepage-only meta guard), not product copy.
- [ ] No AI calls; no new npm dep; SSRF guard rejects localhost/private IPs.
- [ ] Profile "Fetch from website" pre-fills the form; admin edits + saves via
      the existing screen; works on a **second and third** vendor URL (test set).
- [ ] `parseOrgFromHtml` unit-tested from saved HTML fixtures (no network).

## Concerns / notes
- Sites without JSON-LD → og:/meta fallbacks; if still empty, fields stay null
  (admin fills). Build the fallbacks; don't assume JSON-LD everywhere.
- Currency inference is best-effort (priceRange/country) → GBP default; admin can
  correct.
- Keep the parser pure + fixture-tested so "test with more vendors → refine" is
  cheap: add a fixture per vendor, assert the map.
- Later slices (separate prompts): catalogue load + taxonomy auto-map (AI), the
  background job, image copy to media store.
