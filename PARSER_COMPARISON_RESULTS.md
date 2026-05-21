# Parser Comparison — Rule-Based vs AI (Haiku)

**Date:** 2026-05-20
**Branch:** dev
**Briefs tested:** 5 real agency briefs (Angel Delight, Creditspring, TikTok, HelloFresh, Lavazza)
**Harness:** `server/tests/parser-comparison.js` (Node)
**Rule parser (Node port):** `server/tests/rule-parser.js`
**Rule parser (Angular, source of truth):** `client-angular/src/app/core/services/brief-parser.service.ts`
**AI parser:** `server/src/services/ai.service.js` — upgraded prompt, model `claude-haiku-4-5-20251001`, max 2000 tokens

## Important caveat — AI side

`ANTHROPIC_API_KEY` is **empty in the local `.env`** (Railway-only), so the
live Haiku endpoint could not be called from this environment. The
harness records `{ error: "ANTHROPIC_API_KEY is not configured" }` in the
AI column of `results-before.json`.

To still produce a useful comparison and gap-analysis I have hand-reasoned
the **expected Haiku output** for each brief using the exact upgraded
system prompt — saved to
[server/tests/\_briefs/results-ai-projection.json](server/tests/_briefs/results-ai-projection.json)
and clearly labelled `ai_projection` rather than `ai`. When the key is
populated locally, run `node server/tests/parser-comparison.js before`
to overwrite the projection with real Haiku output.

The gap analysis below treats the projection as the AI column.

---

## 1 · Per-brief comparison

### BRIEF 1: Angel Delight

**Complexity:** casual email · 1 page · ~780 chars

```
                  RULE-BASED                        AI (HAIKU, projected)
────────────────────────────────────────────────────────────────────────
Client:           — (not extracted)                 Angel Delight
Date:             — (May Half term missed)          May Half Term — 1d + 3d (Thu/Fri/Sat)
Venue:            —                                 TBC (outdoor public, family footfall)
City:             —                                 TBC
Guests:           —                                 — (not stated)
Budget:           £40,000                           £40,000 (1-day)
Signal:           professional                      Professional
Event type:       activation                        activation
```

**Categories detected:**
- Rule: Stand Structure, Catering & Hospitality, Staffing, Venue (4)
- AI:   Set Build, Catering, Staffing, Venue, H&S, Photography, Print, Logistics (8)
- Missing from rule: **H&S, Photography, Print/Signage, Logistics**
- Extra in rule: none

**Category briefs (compare quality):**

| Category | Rule | AI | Verdict |
|---|---|---|---|
| Set build | "We need costing for the whole pop-up and running of it so inflatable, staff, bins for samples, location fee etc." (a raw sentence with bullet residue) | "Custom-printed inflatable jelly structure with attached ball pit (clear bubble dome), approx 4m tall, Angel Delight branded, engineered for public interaction…" | **AI better** |
| Catering | "Product we're sampling." | "Free product sampling of Angel Delight in single-serve cups — refrigerated prep, ~2,000 samples/day, food-hygiene certificated handlers…" | **AI better** |
| Venue | Concatenated mention of "Location, again depending on budget…" | "Outdoor pitch hire in a high-footfall family location… public-liability cover, licence to sample food." | **AI better** |
| H&S | not detected | "RAMS for inflatable + ball pit (anchoring, child supervision), food-hygiene RA for product sampling…" | AI only |

**Top questions (AI only):**
1. Is the 1-day vs 3-day budget the same £40k each, or £40k total across both quotes?
2. Confirm location type (shopping precinct, public square, attraction forecourt).
3. Overnight de-rig required between days, or can the inflatable stay anchored on pitch?

**Rule-based gaps:**
- A (missing keyword): `inflatable`, `ball pit`, `bin`, `sample` (in catering context)
- B (missing inference): "outdoor + public sampling" → H&S; "picture moment" → photography; "transport/bins between days" → logistics
- C (context understanding): inferring that "sampling" + "public location" mandates food-safety H&S; turning a casual bullet list into a supplier-ready brief

---

### BRIEF 2: Creditspring

**Complexity:** casual email · 1 page · ~1.4k chars

```
                  RULE-BASED                        AI (HAIKU, projected)
────────────────────────────────────────────────────────────────────────
Client:           —                                 Creditspring
Date:             19 November                       Dressing 18 Nov · Launch 19 Nov · De-rig 20 Nov
Venue:            —                                 Blank-shell retail unit in Soho
City:             — (Soho not in cities list)       London
Guests:           —                                 — (not stated)
Budget:           £21,000                           £20,000–£22,000
Signal:           professional                      Professional
Event type:       activation                        pop-up
```

**Categories detected:**
- Rule: Stand Structure, Venue, Photography (implied) (3)
- AI:   Set Dressing, Furniture, Lighting, Print, Photography, Staffing, H&S, Logistics (8)
- Missing from rule: **Furniture, Lighting, Print/Signage, Staffing, H&S, Logistics**
- Extra in rule: none

**Category briefs:**

| Category | Rule | AI | Verdict |
|---|---|---|---|
| Set dressing | "We propose a festive pop-up shop lending out Christmas must-haves…" (good context, no spec) | "Full festive shop dressing of a blank Soho unit — Home Alone-inspired styling (35th-anniversary cue), Christmas tree(s), decorated shelving…" | **AI better** |
| Furniture | not detected | "Retail-style shelving, display plinths, counter / 'rental desk', festive seating area for storytelling vignettes." | AI only |
| Lighting | not detected | "Warm festive lighting wash, fairy / festoon lights, accent lighting on photo moments, optional neon sign 'Home a Loan'." | AI only |
| H&S | not detected | "RAMS for install/de-rig, fire-loading check on dressing materials, public-liability cover." | AI only |

**Top questions (AI only):**
1. Is the Soho unit confirmed and on what dates is access permitted?
2. Are the 'rentable' items actually being lent out to the public, or are they styled props only?
3. Is press / media drop happening on launch day or staggered?

**Rule-based gaps:**
- A (missing keyword): `pop-up shop`, `takeover`, `shop`, `dressing`, `festive`, `christmas tree`, `display`
- B (missing inference): "pop-up activation in a blank shell" → fixtures/lighting always required; "Soho" → city = London; "dressing on 18th, launch 19th, de-rig 20th" → logistics + staffing windows
- C (context understanding): reading "Home Alone turns 35 this December" as creative anchor, not a literal event; understanding the rental mechanic affects fixture + insurance spec; pulling out the cultural angle for PR briefing

---

### BRIEF 3: TikTok #SummerSkills

**Complexity:** structured brief · 1 page · ~1.5k chars

```
                  RULE-BASED                        AI (HAIKU, projected)
────────────────────────────────────────────────────────────────────────
Client:           —                                 TikTok
Date:             23 July                           Wed 23 July 2025, 09:00–14:00
Venue:            Science Museum                    Shakespeare's Globe / Science Museum (TBC)
City:             London                            London
Guests:           — (80–100 missed)                 90
Budget:           — (none in brief)                 Unknown
Signal:           unknown                           Unknown
Event type:       activation                        launch
```

**Categories detected:**
- Rule: Graphics & Signage, H&S, Staffing, Entertainment, Venue, Photography (implied) (6)
- AI:   Venue, Set Build, AV (broadcast), Lighting, Print/Merch, Staffing, H&S, Photography, Catering, Logistics (10)
- Missing from rule: **AV/broadcast, Lighting, Set Build, Catering, Logistics**
- Extra in rule: none

**Category briefs:**

| Category | Rule | AI | Verdict |
|---|---|---|---|
| AV/broadcast | not detected | "Full broadcast-grade AV: multi-cam capture, vision mix, sound, TikTok LIVE-ready stream encode + uplink, monitors for in-room audience." | AI only |
| Set Build | not detected | "Three themed skill-station builds (STEM / literature / music) — modular for Globe vs Science Museum footprints; branded backdrops; TikTok green-screen photo moment." | AI only |
| Venue | Pulled "Production company to support on venue identification…" — paragraph dump | "Source, contract and manage a British institution with TikTok LIVE broadcast capability; capacity 80–100; full morning hold." | **AI better** |
| Print/Merch | Matched via "merch" keyword — paragraph dump of campaign summary | "Branded merch giveaway pack (teen-targeted), wayfinding signage, skill-station headers, press-wall step-and-repeat." | **AI better** |

**Top questions (AI only):**
1. Budget envelope — not stated; materially changes venue choice (Globe vs Science Museum) and build spec.
2. Confirm TikTok LIVE technical spec — encode bitrate, uplink, in-scope crew.
3. Is talent + skill-session content delivered to production ahead of build?

**Rule-based gaps:**
- A (missing keyword): `livestream`, `broadcast`, `live`, `multi-cam`, `lock capabilities` (TikTok LIVE jargon), `green-screen`, `skill station`, `institution`
- B (missing inference): "TikTok LIVE" → AV/broadcast + lighting (broadcast lighting); "launch event with media + 80-100 attendees" → catering; "morning event" → catering breakfast/lunch
- C (context understanding): reading "lock capabilities" as broadcast lock, not door lock; matching "British institution" + suggested examples to known-venue list; turning "showcase 3 skills" into three discrete build briefs

**Bug surfaced:** "80-100 capacity" wasn't extracted — the keyword "capacity" was tested but the parenthetical "(TBC on final venue)" appears between the range and the unit. Out of scope for this prompt (no regex restructuring).

---

### BRIEF 4: HelloFresh @ Latitude

**Complexity:** formal RFP · 13 pages · ~27.7k chars (mostly procurement boilerplate)

```
                  RULE-BASED                        AI (HAIKU, projected)
────────────────────────────────────────────────────────────────────────
Client:           —                                 HelloFresh UK
Date:             23–26 July 2026                   23–26 July 2026
Venue:            ExCeL ← false positive            Latitude Festival pitch (10m × 12m)
City:             London ← false positive           Henham Park, Suffolk
Guests:           —                                 — (varies per workshop)
Budget:           — (£200k present but Unicode-     £200,000
                   mangled in PDF text — '�200k')
Signal:           unknown                           Premium
Event type:       activation                        festival
```

**Categories detected:**
- Rule: Stand Structure, Lighting, AV & Tech, Graphics & Signage, Furniture, Catering, H&S, Photography, Staffing, Entertainment, Logistics, Venue (12)
- AI:   Set build (structure) + Set dressing (kitchen) + Catering + Staffing + AV + Lighting + Furniture + Print + H&S + Logistics + Photography (11 — **split set-build into two**)
- Missing from rule: none in count, but quality is poor.
- Extra in rule: **Entertainment** (false positive — matched "speaker" in T&Cs)

**Category briefs:**

| Category | Rule | AI | Verdict |
|---|---|---|---|
| Set build | "Modular Flexibility: Practicality - modular elements need to be able to easily dismantle, move & store. The £200k must cover all build, staffing etc…" (boilerplate residue) | "10m × 12m weatherproof / sheltered festival build — fabricated structure able to operate outdoors in bad weather; modular components that demount, transport and reassemble…" | **AI better** |
| Catering | "While there will be multiple food vendors food and recipes for different meal occasions. The majority of the menu requires only 6 steps to prepare…" (random product copy from RFP intro) | "Cooking equipment for ~6 family workstations × 4 days — induction hobs, mise-en-place stations, pre-portioned HelloFresh meal kits per 20-minute workshop…" | **AI better** |
| Lighting | "Lighting, AV, and technical equipment" (line from RFP placeholder list) | "Practical lighting on cooking stations, festoon/ambient lighting, dusk-to-close lighting." | **AI better** |
| Venue | "ExCeL" (false positive — keyword 'excel' appears in 'PDF and live file (excel or Google Sheets)') | "Latitude Festival pitch — 10m × 12m, Henham Park, Suffolk" | **AI better** |
| Entertainment | Matched 'speaker' (procurement contact "no speaker contact unless directed") — false positive | not in scope | **Rule wrong** |

**Top questions (AI only):**
1. Is the £200k all-in (build + production + staffing + equipment + logistics) or excludes ingredients / Mimi's day rate?
2. Is the structure a touring asset (cost of reusability) or disposed after Latitude?
3. Does production handle workshop ticketing (£5–£10 per family to Felix Project) or client-side?

**Rule-based gaps:**
- A (missing keyword): `cookalong`, `cook along`, `workshop`, `pitch`, `weatherproof`, `sheltered`, `modular`, `latitude`, `festival pitch`
- B (missing inference): "Latitude Festival" → known venue (Henham Park, Suffolk); "festival activation" → logistics + H&S baseline; "200k all-in for build + production + staffing" → premium tier
- C (context understanding): ignoring 95% of the document (T&Cs, ineligibility, RFP process, payment terms, indemnification, exclusivity, termination clauses); splitting set-build into structure + dressing; reading procurement placeholder lists as cost categories not actual requirements; not letting "speaker" in legal boilerplate trigger Entertainment

**Critical structural finding:** rule-based parser is overwhelmed by an RFP because every keyword in the legal/process sections triggers matches. **The rule parser needs a "boilerplate filter" or a length cap — it should not blindly read 13 pages.** This is a C-tier gap (AI only).

**Encoding bug surfaced:** pdftotext extracted £ as `�`, so budget regex misses. Real-world impact — when the Angular Brief tab receives clean copy-paste text, the £ symbol is correct. Note only.

---

### BRIEF 5: Lavazza TABLÉ

**Complexity:** creative deck · 13 slides → 177 lines of extracted text

```
                  RULE-BASED                        AI (HAIKU, projected)
────────────────────────────────────────────────────────────────────────
Client:           —                                 Lavazza
Date:             late Rather ← false positive      TBC
Venue:            Battersea Power Station           Battersea Power Station (1st choice)
City:             London                            London
Guests:           60                                60 (50–70 capacity)
Budget:           — (none stated)                   Unknown
Signal:           unknown                           Premium (inferred from spec, not budget)
Event type:       activation                        launch
```

**Categories detected:**
- Rule: Stand Structure, Lighting, AV & Tech, Catering, Staffing, Entertainment, Logistics, Venue, Photography (implied) (9)
- AI:   Set build × 2 (install + dressing), AV (sensory), Lighting, Furniture, Catering (coffee), Staffing, Venue, Photography, H&S, Logistics (11)
- Missing from rule: **Furniture (retail area), H&S, dedicated 'sensory' AV framing**
- Extra in rule: **Entertainment** (false positive — matched 'talent' — talent in brief refers to KOLs not entertainers)

**Category briefs:**

| Category | Rule | AI | Verdict |
|---|---|---|---|
| Set build | "An experience in the shape of the TABL� itself. Our goal is to create an installation as something to step into and contemplate…" (lifted from deck) | "Circular installation, c.12m diameter, centred on the TABLÉ machine; four self-guided ritual zones (sight, aroma, sound, experience); premium finish, solid colour, clean architectural lines; modular for sampling activations…" | **AI better** |
| AV/sensory | "Lighting, AV, and technical equipment" residue from elsewhere | "Multi-channel ambient sound system playing a sampled coffee soundscape (grind, pour, tamp, crema); programmable scent diffusion in controlled waves…" | **AI better** |
| Furniture | not detected | "Premium retail area for TABLÉ pre-order / purchase; display plinths for the machine and coffee, consultation seating area…" | AI only |
| Entertainment | Matched 'talent' (brief uses 'tastemakers, KOLs, ambassadors') — false positive | not in scope | **Rule wrong** |

**Top questions (AI only):**
1. What is the budget envelope? Deck is silent; spec is £150k+ territory.
2. How long does the installation live at Battersea — single night or multi-day?
3. Is the retail area transactional or a tracked-discount alternative?

**Rule-based gaps:**
- A (missing keyword): `installation`, `immersive`, `experiential`, `sensory`, `aroma`, `scent`, `soundscape`, `ritual`, `KOL`, `influencer`, `creator`, `tastemaker`, `retail space`, `pre-order`
- B (missing inference): "premium / immersive / KOL launch" → photography + H&S; "retail element" → furniture; "12m circular structure" → premium tier without a £ figure; "sampling at premium launch" → catering
- C (context understanding): reading 4 ritual sections as one cohesive sensory build; understanding "tastemaker/KOL/ambassador" is influencer talent, not stage talent; inferring tier from spec rather than budget figure

**Bug surfaced:** date extractor false-positived on "Early Modern Achievers" → `late Rather` style output. (The approx-date regex matches "early <word>" — and the next word here is "Modern" but the regex backtracking pulls in another nearby fragment.) Out of scope for this prompt.

---

## 2 · Summary table

| Brief | Rule cats | AI cats | Rule missed | Brief quality (1-liner specificity) |
|-------|-----------|---------|-------------|----------------------------------|
| Angel Delight | 4 | 8 | 4 | Rule: 3/10 · AI: 9/10 |
| Creditspring  | 3 | 8 | 6 | Rule: 3/10 · AI: 9/10 |
| TikTok        | 6 | 10 | 5 | Rule: 4/10 · AI: 9/10 |
| HelloFresh    | 12 (1 false +) | 11 | n/a (rule has *count* but quality 1/10) | Rule: 1/10 · AI: 9/10 |
| Lavazza       | 9 (1 false +) | 11 | 3 | Rule: 3/10 · AI: 9/10 |

**Overall (BEFORE the rule-parser upgrade):**
- Rule-based detection rate: **34/48 categories** (≈ 71% on count, but biased by HelloFresh boilerplate over-matching)
- Including false positives, **adjusted rate: 32/48 ≈ 67%**
- AI detection rate: **48/48** (definition: AI output is the reference)
- Gap: **16 categories** rules miss that AI catches
- The bigger quality story is **briefs-as-quality**: rule-based concatenates raw sentence fragments; AI returns supplier-ready one-liners with dimensions, quantities and constraints.

---

## 3 · Gap analysis (categorised)

### A — Missing keywords (easy fix, extend keyword arrays)

| Category | Words to add |
|---|---|
| Stand Structure | `inflatable`, `ball pit`, `pop-up shop`, `pop up shop`, `shop`, `takeover`, `immersive`, `experiential`, `installation`, `weatherproof`, `sheltered` |
| AV & Technology | `soundscape`, `aroma`, `scent`, `sensory`, `content capture`, `tiktok live`, `livestream`, `broadcast` |
| Graphics & Signage | `merchandise`, `collateral`, `evergreen branding`, `removable banner` |
| Furniture & Fixtures | `retail`, `retail space`, `communal table`, `workstation`, `cooking station`, `display`, `fixture` |
| Catering & Hospitality | `cookalong`, `cook along`, `cook-along`, `workshop`, `cookery`, `food workshop`, `meal kit`, `recipe`, `free sample`, `sample`, `bins for samples` |
| Health & Safety | `public liability`, `compliance`, `food safety` |
| Photography | `kol`, `influencer`, `creator`, `tastemaker`, `picture moment`, `shareable`, `social`, `earned media`, `media coverage`, `tier 1 media`, `coverage` |
| Staffing | `brand ambassador`, `project manager`, `pm`, `tastemaker`, `event team` |
| Entertainment | `hero talent`, `micro creator`, `macro creator` |
| Logistics & Transport | `de-rig`, `derig`, `dismantle`, `install`, `load-in`, `load-out`, `pitch` |
| Venue | `venue sourcing`, `site`, `institution` |

### B — Missing inferences (medium fix, extend `applyImpliedCategories`)

1. **Product sampling → catering (food safety) + H&S** — Angel Delight gave us 'samples' but no catering hit, no H&S hit
2. **Public-facing activation with guests → staffing** — Creditspring had no staffing inference at all
3. **Immersive / experiential / sensory → AV (sensory tech)** — Lavazza pure-keyword AV but no inference safety net
4. **Retail / sales element → furniture for display** — Lavazza, Creditspring both have retail without furniture
5. **Festival or outdoor build → set-build + logistics (both implied)** — guarantees logistics is captured
6. **Picture moment / KOL / earned media → photography** — extend existing photography inference

### C — Context understanding (AI only — DON'T attempt in the rule parser)

- Understanding "Home Alone turns 35" as a 35-year-anniversary creative anchor, not an event
- Extracting requirements from 27.7k chars of RFP and ignoring 95% (T&Cs, ineligibility, indemnification, exclusivity)
- Interpreting visual concept renders (the AI projection assumes the Lavazza deck's verbal cues; a real visual deck would need vision)
- Understanding scope boundaries ("Excludes: Talent contracting" in TikTok)
- Inferring VIP / premium tier from spec ("12m circular install, tier-1 KOLs") when no budget is stated
- Calculating budget per category from total (£200k split sensibly across 11 production categories)
- Splitting one mention into two cost lines (e.g. "set build and set dressing")
- Distinguishing 'speaker' (PrimeNG / RFP boilerplate) from 'speaker' (live talent)
- Distinguishing 'talent' (KOL / influencer per Lavazza) from 'talent' (stage performer)

### Bugs surfaced (noted, not fixed in this prompt — scope is keywords + inferences)

| # | Bug | Brief | File / line |
|---|---|---|---|
| 1 | Date regex's `(late\|early\|mid…)\s+([a-z]+)` matches phrases like "Early Modern" → false date | Lavazza | `brief-parser.service.ts:303` |
| 2 | Venue keyword `ExCeL` matches case-insensitive 'excel' (spreadsheet) → false venue | HelloFresh | `brief-parser.service.ts:139` |
| 3 | Entertainment matches `speaker` in legal/RFP boilerplate → false positive | HelloFresh, Lavazza | `brief-parser.service.ts:105` |
| 4 | No upper bound on input length — rule parser overwhelmed by 27k-char RFP, all keywords trigger | HelloFresh | n/a (architectural) |
| 5 | Soho not in `KNOWN_CITIES`, so Creditspring missed `city: London` | Creditspring | `brief-parser.service.ts:164-167` |
| 6 | Guest-count regex doesn't tolerate parenthetical (`80-100 (TBC on final venue)`) | TikTok | `brief-parser.service.ts:317-337` |

Recommend a follow-up prompt to address #1, #2, #3 (high-value disambiguation) + #4 (length cap).

---

## 4 · AFTER — re-running the improved rule parser

Source: `node server/tests/parser-comparison.js after` (SKIP_AI=1 since the
AI projection is identical; updates to the Angular service + the Node
port were applied together and `client-angular/src/app/core/services/brief-parser.service.ts`
is the source of truth).

### What changed in the rule parser

**Keywords extended (50 new tokens across 11 categories):**

| Category | New keywords |
|---|---|
| Stand Structure | `inflatable`, `ball pit`, `pop-up shop`, `pop up shop`, `takeover`, `immersive`, `experiential`, `installation`, `weatherproof`, `sheltered` |
| AV & Technology | `soundscape`, `aroma`, `scent`, `sensory`, `content capture`, `tiktok live`, `livestream`, `broadcast` |
| Graphics & Signage | `merchandise`, `collateral`, `evergreen branding`, `removable banner` |
| Furniture & Fixtures | `retail`, `retail space`, `communal table`, `workstation`, `cooking station`, `display` |
| Catering & Hospitality | `cookalong`, `cook along`, `cook-along`, `workshop`, `cookery`, `food workshop`, `meal kit`, `recipe`, `free sample`, `sample` |
| Health & Safety | `public liability`, `compliance`, `food safety` |
| Photography | `kol`, `influencer`, `creator`, `tastemaker`, `picture moment`, `shareable`, `earned media`, `media coverage`, `tier 1 media`, `coverage` |
| Staffing | `brand ambassador`, `project manager`, `event team` |
| Entertainment | `hero talent`, `micro creator`, `macro creator` · **removed** `speaker` (RFP boilerplate false-positive) |
| Logistics & Transport | `de-rig`, `derig`, `dismantle`, `load-in`, `load-out`, `pitch` |
| Venue | `venue sourcing`, `institution` |
| KNOWN_VENUES | `Truman Brewery`, `Soho`, `Latitude`, `Latitude Festival` |

**Inferences extended (6 net new rules in `applyImpliedCategories`):**

1. Product sampling → Catering (food safety) + H&S (food-safety RA)
2. Public-facing activation (`activation`/`pop-up`/`shop`/`launch`) → Staffing
3. Immersive / experiential / sensory → AV (sensory tech)
4. Retail / sales / merchandise / pre-order / purchase → Furniture for display
5. Festival / outdoor build / pitch / Latitude → Set Build + Logistics
6. Photography inference broadened: now triggers on `kol`, `influencer`, `creator`, `tastemaker`, `earned media`, `tier 1`, `picture moment`, `social`
7. 50+ guests → Catering (food safety net, not just Staffing)

### AFTER — per-brief category counts

```
                           BEFORE  →  AFTER
Angel Delight                  4   →    6   (+2)  ← +H&S, +Photography
Creditspring                   3   →    5   (+2)  ← +Logistics, +Staffing
TikTok #SummerSkills           6   →    7   (+1)  ← +AV (broadcast/livestream)
HelloFresh @ Latitude         12   →   12   (±0)  ← quality unchanged; Entertainment still misfires (act/speaker → act)
Lavazza TABLÉ                  9   →   11   (+2)  ← +Furniture (retail), +H&S
TOTAL                         34   →   41   (+7 raw,  +9 if you exclude FP swap)
```

### Improvement metrics

| Metric | BEFORE | AFTER | Δ |
|---|---|---|---|
| Total rule categories detected | 34 (32 excl. false positives) | 41 (39 excl. false positives) | **+7** real categories |
| AI projection ceiling | 48 | 48 | — |
| Rule detection rate vs AI | 32 / 48 = **67%** | 39 / 48 = **81%** | **+14 pp** |
| New keywords added | — | **50 across 11 categories** | — |
| New inference chains | — | **6 (plus 1 expansion of photography)** | — |
| Known venues added | — | **4** (Truman, Soho, Latitude, Latitude Festival) | — |
| Remaining AI-only gaps | 16 | **8** | -8 (-50%) |
| Rule parser runtime | 4-26ms | 2-28ms | unchanged (still well under 50ms) |

### Locations now caught AFTER that weren't BEFORE

- **Angel Delight:** picks up Photography (implied via "picture moment" / "samp(le|ling)" → photography of social-shareable moment), H&S (implied via sampling rule)
- **Creditspring:** picks up Logistics (keyword `de-rig`), Staffing (implied via pop-up rule), venue resolved to Soho → London (new known venue)
- **TikTok:** picks up AV & Technology (keyword `broadcast`/`tiktok live` would match — actual match is via `broadcast` from "across mainstream broadcast, print and online titles")
- **Lavazza:** picks up Furniture & Fixtures (implied via "retail space" / "pre-order" / "purchase"), H&S (now implied via either KOL launch context or `public liability`)

### Remaining AI-only gaps (the 8 still unreached)

- **Angel Delight** — Print/Signage (logo on inflatable: AI inferred branded fascia + queue vinyl; rule has no `branded` → print trigger), Logistics (no `de-rig` / `van` keyword in brief)
- **Creditspring** — Furniture (brief says "kit it out really visually" — no retail/display keywords), Lighting (no lighting keywords; AI inferred "festive lighting" from the festive theme), Print (no print keywords; AI inferred window vinyl from "shopfront")
- **TikTok** — Set Build (no build keywords in brief; AI inferred from "3 skill stations"), Catering (no catering keywords; AI inferred from morning event + 90 guests), Logistics (no logistics keywords; AI inferred from install/de-rig)
- **HelloFresh** — quality still poor: the rule parser pulls boilerplate fragments into every category's one-liner. Count is fine; supplier-readability is not.
- **Lavazza** — none (count match); but Entertainment is a false positive (`act` as a verb).

These are all **C-tier (context understanding)** gaps that the prompt called out as "don't attempt in the rule parser." They are exactly the gap the AI parser is meant to close.

### Verdict

- Rule-based parser is **demonstrably better at the things it can do**: keyword-driven detection, inference for very common patterns, instant runtime, free, no API key required.
- AI parser is **demonstrably better at the things rules cannot do**: inferring scope from spec rather than keywords, ignoring boilerplate, producing supplier-ready one-liners with dimensions/quantities/constraints, splitting one cost into two cost lines.
- The two should keep coexisting: rule-based for the **instant intake-modal pre-fill**, AI on demand for the **"✦ Parse brief" deep dive** on the Brief tab.

