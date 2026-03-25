/**
 * Ballpark — Catalogue Seed (new suppliers only)
 * Skips: Unique Venues of London, ProBuild Events (already in dev)
 * Skips: Venues sheet items (already seeded)
 *
 * Upserts orgs on name, items on (org_id, name) — safe to re-run
 *
 * Usage: node server/scripts/seed-catalogue.js
 * Requires: DATABASE_URL in .env, APP_SCHEMA=public (default)
 */

const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

// ── SUPPLIERS ─────────────────────────────────────────────────────────────────

const SUPPLIERS = [
  { name: 'Press Lane Studio',           city: 'London', type: 'supplier', description: 'Premium print and branded materials for events and activations.' },
  { name: 'Solopress London',            city: 'London', type: 'supplier', description: 'Fast-turnaround event print specialists. Menus, signage, stationery and more.' },
  { name: 'Construct & Co. London',      city: 'London', type: 'supplier', description: 'Bespoke exhibition stand and set build contractor for trade shows, activations and galas.' },
  { name: 'Illusion Design & Construct', city: 'London', type: 'supplier', description: 'High-end scenic build and immersive brand environments.' },
  { name: 'Volta AV London',             city: 'London', type: 'supplier', description: 'Full-service AV production — lighting, sound, screens and live streaming.' },
  { name: 'DAR Hire London',             city: 'London', type: 'supplier', description: 'AV equipment hire and installation for conferences, awards and corporate events.' },
  { name: 'Greenhouse London',           city: 'London', type: 'supplier', description: 'Lush, editorial florals for events. Arches, installations and table arrangements.' },
  { name: 'Into the Wild Florals',       city: 'London', type: 'supplier', description: 'Wild garden and dried floral specialists with a relaxed, organic style.' },
  { name: 'Rocket Food London',          city: 'London', type: 'supplier', description: 'Catering specialists for corporate events, galas and conferences.' },
  { name: 'The Food Crowd London',       city: 'London', type: 'supplier', description: 'Street food and informal dining for festivals, activations and parties.' },
];

// ── ITEMS ─────────────────────────────────────────────────────────────────────
// [supplierName, categoryName, name, description, basePrice, minPrice, maxPrice, unit, leadTimeDays, tags]

const ITEMS = [

  // ── PRINT — Press Lane Studio ──────────────────────────────────────────────
  ['Press Lane Studio', 'Graphics & Signage', '100 Premium Printed Invitations',
    'Thick textured card, premium matte or gloss finish. Envelopes included. Optional foil stamp or embossed logo. RSVP inserts available. 350gsm board, matte laminate or soft-touch finish.',
    320, 280, 480, 'per 100', 7, ['Gala', 'Conference', 'Product Launch', 'Corporate Party']],

  ['Press Lane Studio', 'Graphics & Signage', '50 VIP Invitation Box Sets',
    'Printed invite + branded rigid box + tissue wrap + branded sticker seal + insert card. Luxury unboxing experience. Rigid gift box, 400gsm invite, tissue paper, foil sticker.',
    680, 580, 900, 'per 50', 14, ['Gala', 'Premiere', 'Product Launch', 'VIP Events']],

  ['Press Lane Studio', 'Graphics & Signage', '150 Branded Lanyards & Name Badges',
    'Full colour printed lanyards with name card inserts and plastic badge holders. Safety clip breakaway option. Polyester lanyard, PVC badge holder, 300gsm card insert.',
    290, 250, 420, 'per 150', 7, ['Conference', 'Exhibition', 'Corporate Events']],

  ['Press Lane Studio', 'Graphics & Signage', 'Welcome Signage Package',
    '1x A0 Foamex welcome board + 2x A1 directional signs. Easel add-on available. Same-day install option. 5mm Foamex, full colour print, eyelets or easel mount.',
    195, 150, 320, 'per package', 7, ['All Events']],

  ['Press Lane Studio', 'Graphics & Signage', 'Table Print Package (100 guests)',
    '10x table number cards + 100x place cards + 100x printed menus. Consistent branded set. 350gsm board, matte laminate, bespoke sizing.',
    380, 320, 520, 'per 100 guests', 7, ['Gala', 'Dinner', 'Wedding', 'Corporate Party']],

  ['Press Lane Studio', 'Graphics & Signage', 'Event Programme Booklet (100 copies)',
    '8-12 page saddle-stitched booklet, branded cover, full colour inside. Print-ready artwork supplied by client. 130gsm silk inner pages, 350gsm cover, saddle stitched.',
    420, 360, 580, 'per 100', 14, ['Gala', 'Conference', 'Premiere', 'Awards']],

  ['Press Lane Studio', 'Graphics & Signage', 'Step & Repeat Branding Package',
    '3m x 2m printed backdrop on tension frame. Matte anti-glare finish. Install and removal included. Dye-sub fabric print, aluminium snap frame.',
    850, 750, 1200, 'per event', 7, ['Premiere', 'Product Launch', 'Press Events', 'Activation']],

  ['Press Lane Studio', 'Graphics & Signage', 'Stage Branding Package',
    'Stage fascia print + podium wrap + 2x side wing panels. Coordinated branded set for speaker stages. PVC banner material, velcro-mount fascia, printed panels.',
    1100, 900, 1600, 'per event', 14, ['Conference', 'Awards', 'Product Launch']],

  ['Press Lane Studio', 'Graphics & Signage', '200 Branded Stickers (Die-Cut)',
    'Custom shape die-cut stickers in matte or gloss finish. Ideal giveaway or envelope seal. Vinyl, matte or gloss laminate, kiss cut on sheet.',
    95, 80, 160, 'per 200', 7, ['All Events']],

  ['Press Lane Studio', 'Graphics & Signage', 'Foamex Display Package',
    '3x printed 1sqm Foamex boards. Delivery or wall-mounted install. Great for wayfinding or brand moments. 5mm Foamex, full colour UV print.',
    280, 220, 420, 'per package', 7, ['Exhibition', 'Conference', 'Activation']],

  ['Press Lane Studio', 'Graphics & Signage', 'Hanging Banner Package',
    '2x 1m x 3m double-sided hanging banners with rigging hardware. Install by our team or venue crew. PVC or fabric banner, metal hanging bar, rigging wire.',
    360, 300, 520, 'per package', 7, ['Conference', 'Exhibition', 'Arena Events']],

  ['Press Lane Studio', 'Graphics & Signage', 'Pop-Up Retail Graphics Pack',
    '3x 1m window vinyl + wall decals + 1x hero printed board + floor stickers. Complete retail moment. Cast vinyl, removable adhesive, anti-slip floor print.',
    620, 520, 880, 'per package', 7, ['Activation', 'Retail Pop-Up', 'Product Launch']],

  // ── PRINT — Solopress London ───────────────────────────────────────────────
  ['Solopress London', 'Graphics & Signage', '50 A5 Printed Menus (Premium Card)',
    'Luxury single-sheet or folded menus on heavyweight card. Delivered flat or pre-folded, ready to place. 400gsm silk card, soft-touch laminate option.',
    140, 110, 220, 'per 50', 7, ['Gala', 'Dinner', 'Wedding', 'Restaurant Launch']],

  ['Solopress London', 'Graphics & Signage', '100 Thank You Cards',
    'Printed both sides, optional handwriting lines. Supplied with or without envelopes. 350gsm board, matte finish, C6 envelope option.',
    160, 130, 240, 'per 100', 7, ['All Events']],

  ['Solopress London', 'Graphics & Signage', 'Branded Wall / Panel Wrap Package',
    '5m printed vinyl wrap. Install and removal by our team. Transforms any wall into a brand moment. Cast vinyl, bubble-free adhesive, removable.',
    780, 650, 1100, 'per package', 14, ['Activation', 'Product Launch', 'Retail Pop-Up']],

  ['Solopress London', 'Graphics & Signage', '50 Table Talkers / Tent Cards',
    'Folded A6 double-sided tent cards. Ideal for table menus, sponsor messages or event info. 350gsm, scored fold, matte or gloss finish.',
    115, 90, 180, 'per 50', 7, ['Conference', 'Gala', 'Corporate Dinner']],

  // ── SET BUILD — Construct & Co. London ────────────────────────────────────
  ['Construct & Co. London', 'Stand Structure', 'The Showstopper Booth',
    '3m x 3m branded exhibition shell with statement header, integrated lighting feature and built-in product display moment. Designed to dominate a trade floor. MDF frame, stretch fabric panels, LED strip lighting, vinyl graphics.',
    6200, 5200, 8500, 'per event', 28, ['Exhibition', 'Trade Show', 'Product Launch']],

  ['Construct & Co. London', 'Stand Structure', 'The Instagrammable Pop-Up Shop',
    '5m x 2m immersive retail shell with textured walls, shelving, hero archway and a built-in photo moment. Perfect for brand activations. Timber frame, plywood shelving, feature arch, printed vinyl.',
    7200, 6000, 10000, 'per event', 28, ['Activation', 'Retail Pop-Up', 'Product Launch']],

  ['Construct & Co. London', 'Stand Structure', 'The Walk-Through Wow Entrance Tunnel',
    'Branded tunnel structure with internal LED lighting and full-wrap printed graphics. Transforms any arrival into a brand moment. Steel frame, stretch fabric print, LED interior strip lighting.',
    8500, 7000, 12000, 'per event', 28, ['Premiere', 'Gala', 'Corporate Party', 'Activation']],

  ['Construct & Co. London', 'Stand Structure', 'The Luxury Dinner Set Build',
    'Bespoke backdrop wall with layered scenic panels, arch feature and integrated signage. The hero moment behind the top table. MDF panels, plywood arch, painted or vinyl finish, LED accents.',
    6800, 5500, 9500, 'per event', 28, ['Gala', 'Awards', 'Corporate Dinner', 'Premiere']],

  ['Construct & Co. London', 'Stand Structure', 'The Branded Arch Moment',
    'Freestanding arch feature for entrances, photo moments or stage backdrops. Hollow structure with vinyl or fabric branding option. MDF or foam, painted or vinyl wrapped, freestanding base.',
    2800, 2200, 4200, 'per event', 21, ['All Events']],

  ['Construct & Co. London', 'Stand Structure', 'The Selfie Spotlight Wall',
    'Textured backdrop panel with mounted logo cutout and subtle uplighting feature. Built purely for content creation. Timber frame, textured plaster or timber cladding, logo mount.',
    2200, 1800, 3200, 'per event', 21, ['Activation', 'Product Launch', 'Corporate Party']],

  ['Construct & Co. London', 'Stand Structure', 'The Statement Bar Front',
    'Custom bar fascia with layered branding, optional illuminated logo or textured finish. Slides over any standard bar. MDF fascia, vinyl or fabric branding, optional LED logo box.',
    2600, 2000, 3800, 'per event', 21, ['Gala', 'Corporate Party', 'Festival', 'Activation']],

  ['Construct & Co. London', 'Stand Structure', 'The Hero Product Plinth Set (x5)',
    'Set of 5 plinths with custom heights and branded vinyl or painted finish. For product launches and retail moments. MDF box construction, painted or vinyl wrapped, non-slip base.',
    1900, 1500, 2800, 'per set', 14, ['Product Launch', 'Exhibition', 'Retail']],

  ['Construct & Co. London', 'Stand Structure', 'The Hanging Brand Halo',
    'Circular suspended branding feature to sit above a booth or activation area. Branded both sides, rigging hardware included. Aluminium ring frame, printed fabric, rigging hardware.',
    2200, 1800, 3200, 'per event', 21, ['Exhibition', 'Activation', 'Conference']],

  ['Construct & Co. London', 'Stand Structure', 'The Modular Signage Totems (x4)',
    '4x freestanding branded wayfinding towers with interchangeable printed panels. Lightweight, quick to install. Aluminium extrusion frames, printed card inserts, weighted base.',
    1600, 1200, 2400, 'per set', 14, ['Conference', 'Exhibition', 'Festival', 'Corporate Events']],

  // ── SET BUILD — Illusion Design & Construct ───────────────────────────────
  ['Illusion Design & Construct', 'Stand Structure', 'The Immersive Brand Room',
    'Full scenic wall build transforming a blank venue into a total branded environment. Textured panels, feature wall and focal display moment. Scenic MDF panels, texture coats, feature lighting, full paint finish.',
    14000, 11000, 20000, 'per event', 42, ['Product Launch', 'Premiere', 'Brand Activation', 'Gala']],

  ['Illusion Design & Construct', 'Stand Structure', 'The Content Creator Studio',
    'Modular backdrop system with interchangeable panels, lighting rig provision and multiple photo angles built into one clean structure. Modular aluminium frame, printed fabric panels, lighting rail.',
    5400, 4400, 7500, 'per event', 28, ['Activation', 'Product Launch', 'Influencer Event']],

  ['Illusion Design & Construct', 'Stand Structure', 'The Festival Activation Pod',
    'Open-sided branded structure with canopy roof, bar/serving hatch option and bold front-facing branding. Festival or outdoor ready. Steel frame, PVC canopy, timber serving hatch, vinyl branding.',
    9200, 7500, 13000, 'per event', 35, ['Festival', 'Outdoor Event', 'Activation']],

  ['Illusion Design & Construct', 'Stand Structure', 'The Spin-to-Win Game Build',
    'Fully branded spinning wheel with custom base and interactive signage. Crowd favourite for activations and exhibitions. Timber wheel, MDF base, vinyl graphics, branded surround panel.',
    1400, 1100, 2000, 'per event', 14, ['Exhibition', 'Activation', 'Corporate Party']],

  ['Illusion Design & Construct', 'Stand Structure', 'The Branded DJ Booth Glow-Up',
    'Custom DJ booth with branded front panel, optional LED-lit logo and removable side wings. Fits Pioneer/Allen & Heath standard setup. MDF front panel, LED logo box, magnetic side panels, vinyl finish.',
    1950, 1600, 2800, 'per event', 14, ['Corporate Party', 'Gala', 'Festival', 'Product Launch']],

  // ── AV — Volta AV London ──────────────────────────────────────────────────
  ['Volta AV London', 'AV & Technology', 'Red Carpet Uplighting Package (x20)',
    '20x LED uplighters in custom colour. Includes programming and a lighting desk operator for the full event window. Chauvet or Martin LED pars, DMX desk, custom colour programming.',
    6200, 4800, 8500, 'per event', 21, ['Premiere', 'Gala', 'Corporate Party', 'Awards']],

  ['Volta AV London', 'AV & Technology', 'Conference AV Package (up to 200 pax)',
    '2x projectors + screens, confidence monitor, 1x wireless lapel mic + 2x handheld, mixing desk, 4x speakers. Panasonic PT-RZ Series, Da-Lite screens, Shure wireless, QSC K12.',
    6800, 5500, 9500, 'per event', 21, ['Conference', 'AGM', 'Awards', 'Product Launch']],

  ['Volta AV London', 'AV & Technology', 'DJ Booth & Festival Sound (up to 500 pax)',
    'Pioneer CDJ3000 setup + DJM mixer, 4x QSC K12 speakers, 1x KS118 sub, full cabling, no DJ included. Pioneer CDJ3000, DJM-V10, QSC K12.2, KS118 subwoofer.',
    3600, 2800, 5200, 'per event', 21, ['Corporate Party', 'Gala', 'Festival', 'Activation']],

  ['Volta AV London', 'AV & Technology', 'Premium LED Screen Wall (4m x 2.5m)',
    '4m x 2.5m modular LED panel wall, P3.9 pixel pitch. Includes content playback server and technician. Absen P3.9 LED panels, NovaStar processor, steel rigging frame.',
    8500, 7000, 12000, 'per event', 28, ['Conference', 'Product Launch', 'Arena', 'Gala']],

  ['Volta AV London', 'AV & Technology', 'Room Wash & Ambience Package',
    'Full perimeter LED wash, 4x moving head fixtures for dynamic look, DMX operator for the event. Chauvet Rogue movers, LED pars, DMX console, full cabling.',
    3800, 3000, 5500, 'per event', 14, ['Gala', 'Corporate Party', 'Dinner', 'Awards']],

  ['Volta AV London', 'AV & Technology', 'Outdoor Event PA (up to 1,000 pax)',
    'Line array PA system suitable for outdoor use. 4x main cabinets, 2x subs, engineer on site. dB Technologies ViO L210 line array, subs, touring grade cabling.',
    7200, 5800, 10000, 'per event', 28, ['Festival', 'Outdoor Event', 'Product Launch']],

  ['Volta AV London', 'AV & Technology', 'Hybrid Event Streaming Kit',
    'Blackmagic ATEM switcher, 2x PTZ cameras, graphics overlay system, live stream to any platform. Blackmagic ATEM Mini Extreme, PTZ cameras, streaming encoder.',
    4200, 3400, 6000, 'per event', 21, ['Conference', 'AGM', 'Product Launch', 'Webinar']],

  ['Volta AV London', 'AV & Technology', 'Wireless Microphone Package (x6)',
    '6x Shure wireless handhelds or lavs, 2-channel bodypack option, rack-mounted receiver. Shure ULXD, rack-mounted receivers, Pelican case transport.',
    950, 750, 1400, 'per event', 7, ['Conference', 'Awards', 'Panel Event', 'Corporate']],

  // ── AV — DAR Hire London ──────────────────────────────────────────────────
  ['DAR Hire London', 'AV & Technology', 'Awards Ceremony AV Package',
    'Full AV for awards nights: LED screen, lectern mic, playback system for winner videos, table mics for judging. LED screen, Shure lectern mic, Resolume playback, table mics.',
    8200, 6500, 11500, 'per event', 28, ['Awards', 'Gala', 'Corporate Dinner']],

  ['DAR Hire London', 'AV & Technology', 'Breakout Room AV Pack',
    'Standalone AV for a single breakout room: 75in display, 1x wireless mic, 4x speakers, HDMI connectivity. Samsung 75in display, Shure wireless, QSC CP8 speakers.',
    750, 580, 1100, 'per event', 7, ['Conference', 'Training', 'Workshop']],

  ['DAR Hire London', 'AV & Technology', 'Follow Spot Package (x2)',
    '2x follow spotlights with trained operators. Ideal for award winners, performers or speaker entrances. Robert Juliat or Lycian follow spots, trained operators.',
    1400, 1100, 2000, 'per event', 14, ['Awards', 'Gala', 'Theatre', 'Premiere']],

  ['DAR Hire London', 'AV & Technology', 'Portable PA (up to 150 pax)',
    '2x QSC K12 tops + sub, mixer, 2x wireless mics. Self-contained and quick to install. QSC K12.2 tops, KSub, Yamaha MG mixer, Shure wireless.',
    680, 520, 980, 'per event', 7, ['Conference', 'AGM', 'Corporate Event']],

  ['DAR Hire London', 'AV & Technology', 'Outdoor LED Lighting Tower (x4)',
    '4x 6m lighting towers with LED fixtures. Generator power option. Ideal for outdoor spaces without rigging. 6m truss towers, LED wash fixtures, generator available.',
    2800, 2200, 4000, 'per event', 21, ['Festival', 'Outdoor', 'Product Launch']],

  ['DAR Hire London', 'AV & Technology', 'Confidence Monitor & Prompter Setup',
    'Speaker confidence monitor (42in display) + PromptSmart tablet prompter on lectern. Full setup and testing. 42in monitor, PromptSmart Pro, lectern mount, cabling.',
    520, 400, 750, 'per event', 7, ['Conference', 'Press Event', 'Launch']],

  // ── FLORAL — Greenhouse London ────────────────────────────────────────────
  ['Greenhouse London', 'Florals', 'Statement Entrance Floral Arch',
    '2.4m x 2.4m steel circular frame densely covered in garden roses, ranunculus and trailing eucalyptus. Organic, editorial style. Fresh cut roses, ranunculus, eucalyptus, steel frame.',
    2200, 1800, 3400, 'per event', 21, ['Premiere', 'Gala', 'Wedding', 'Product Launch']],

  ['Greenhouse London', 'Florals', 'Long Table Florals (per 10m)',
    'Lush low garden-style table runner with seasonal blooms, trailing foliage and scattered votives. Per 10m of table. Seasonal blooms, foliage, floral foam or grid, votives.',
    1800, 1400, 2600, 'per 10m', 14, ['Gala', 'Wedding', 'Corporate Dinner', 'Awards']],

  ['Greenhouse London', 'Florals', 'Floral Ceiling Cloud Installation',
    'Suspended floral cloud over a dining or arrival area. Greenery-led with bloom accents. Rigging by our team. Chicken wire frame, fresh foliage, roses, ranunculus, rigging.',
    3200, 2600, 5200, 'per event', 28, ['Gala', 'Wedding', 'Product Launch', 'Brand Activation']],

  ['Greenhouse London', 'Florals', 'Welcome Floral Pedestal (x2)',
    'Two statement floor pedestals with large-scale seasonal arrangements. Ideal flanking entrance doors or a stage. Tall vases or column stands, seasonal blooms, foliage.',
    980, 780, 1400, 'per pair', 14, ['Gala', 'Conference', 'Wedding', 'Awards']],

  ['Greenhouse London', 'Florals', 'Bar Top Florals (per 3m)',
    'Low seasonal arrangements running the length of a bar. Per 3m section, coordinated to brand palette. Seasonal blooms, low vessels, foliage, candles optional.',
    640, 500, 920, 'per 3m', 14, ['Corporate Party', 'Gala', 'Product Launch']],

  ['Greenhouse London', 'Florals', 'Suspended Floral Chandelier',
    'Single large hanging floral chandelier. 1m diameter, densely dressed with blooms and trailing ivy. Metal ring frame, fresh flowers, trailing foliage, rigging hardware.',
    1400, 1100, 2200, 'per event', 21, ['Gala', 'Wedding', 'Dinner', 'Brand Event']],

  ['Greenhouse London', 'Florals', 'Photo Moment Foliage Wall (2m x 2m)',
    'Lush artificial or fresh foliage wall panel with neon or acrylic sign option. The go-to content moment. Fresh or artificial foliage, timber frame, optional sign mount.',
    1100, 880, 1800, 'per event', 14, ['Activation', 'Corporate Party', 'Product Launch', 'Wedding']],

  ['Greenhouse London', 'Florals', 'Stage / Altar Floral Arrangement',
    'Grand centrepiece arrangement for a stage, altar or head table. Statement scale, coordinated palette. Mixed seasonal blooms, large vessel, foliage, floral foam.',
    850, 680, 1300, 'per event', 14, ['Gala', 'Awards', 'Wedding', 'Conference']],

  // ── FLORAL — Into the Wild Florals ────────────────────────────────────────
  ['Into the Wild Florals', 'Florals', 'Wild Garden Table Centrepieces (x10)',
    '10x low wild-garden style arrangements in bud vases or ceramic vessels. Meadow feel, organic and relaxed. Seasonal wildflowers, dried grasses, foliage, ceramic vessels.',
    720, 560, 1050, 'per 10 tables', 14, ['Corporate Dinner', 'Wedding', 'Brand Lunch']],

  ['Into the Wild Florals', 'Florals', 'Dried Flower Hanging Installation',
    'Suspended cloud of dried pampas, bunny tails and bleached botanicals. Long-lasting and no watering required. Dried pampas, bunny tails, lunaria, rigging cord, timber dowel.',
    980, 780, 1600, 'per event', 21, ['Activation', 'Product Launch', 'Pop-Up', 'Event']],

  ['Into the Wild Florals', 'Florals', 'Mini Bud Vase Place Settings (x100)',
    '100x individual bud vases with a single bloom or sprig. Doubles as a guest takeaway. Mini glass vases, single stems, foliage accent.',
    480, 380, 700, 'per 100', 7, ['Gala', 'Wedding', 'Corporate Lunch', 'Awards']],

  ['Into the Wild Florals', 'Florals', 'Pampas & Neon Feature Moment',
    'Dried pampas arrangement with neon sign mount on a timber frame. Ideal hero content moment. Dried pampas, eucalyptus, custom neon sign (client-supplied or sourced), timber A-frame.',
    860, 680, 1400, 'per event', 21, ['Activation', 'Corporate Party', 'Product Launch', 'Pop-Up']],

  ['Into the Wild Florals', 'Florals', 'Botanical Room Fragrance Package',
    'Diffuser units + refills placed throughout the event space. Coordinated scent to brand brief. Commercial diffusers, bespoke fragrance blend, refills.',
    380, 300, 580, 'per event', 7, ['Gala', 'Product Launch', 'Luxury Brand Event']],

  // ── CATERING — Rocket Food London ────────────────────────────────────────
  ['Rocket Food London', 'Catering', 'Canape Package (100 guests, 6 pieces)',
    '6 canapes per person from our events menu. Chef and service staff included. Hot and cold selection. Seasonal produce, mixed dietary, staff and crockery included.',
    2800, 2200, 4000, 'per 100 guests', 21, ['Drinks Reception', 'Gala', 'Product Launch', 'Corporate']],

  ['Rocket Food London', 'Catering', 'Bowl Food Dinner (100 guests)',
    '3 bowl food options per person, passed by service team. Seasonal menu, full dietary coverage. Seasonal bowl menu, service staff, crockery and linen.',
    4200, 3400, 6000, 'per 100 guests', 21, ['Corporate Dinner', 'Gala', 'Standing Dinner']],

  ['Rocket Food London', 'Catering', 'Sit-Down Dinner (100 guests, 3 course)',
    'Plated 3-course dinner for 100 guests. Chef team, full service staff, linen and tableware. Set menu, seasonal produce, full staffing and equipment.',
    8500, 7000, 12000, 'per 100 guests', 28, ['Gala', 'Awards', 'Wedding', 'Corporate Dinner']],

  ['Rocket Food London', 'Catering', 'Breakfast & Coffee (50 guests)',
    'Continental breakfast plus barista coffee station. Pastries, fruit, yoghurt, filter and espresso. Pastries, seasonal fruit, barista equipment and consumables.',
    980, 780, 1400, 'per 50 guests', 7, ['Conference', 'AGM', 'Corporate Morning']],

  ['Rocket Food London', 'Catering', 'Working Lunch (80 guests)',
    'Fork lunch for up to 80 guests. 3 salad options + protein station + bread. Served and cleared. Seasonal salads, protein options, bread, disposable or crockery.',
    2200, 1800, 3200, 'per 80 guests', 14, ['Conference', 'Corporate Event', 'Daytime Event']],

  ['Rocket Food London', 'Catering', 'Mobile Cocktail Bar Package (100 guests)',
    'Bartenders, premium spirits, soft drinks and garnish for 100 guests over 3 hours. Full equipment. Premium spirits, mixers, glassware, bartenders, bar equipment.',
    3200, 2600, 4600, 'per event', 14, ['Corporate Party', 'Gala', 'Product Launch', 'Activation']],

  ['Rocket Food London', 'Catering', 'Dessert Table Package',
    'Statement dessert display with 8 options for up to 150 guests. Staffed service and full setup. Mini desserts, statement display, service staff.',
    1800, 1400, 2600, 'per event', 14, ['Gala', 'Wedding', 'Corporate Party', 'Product Launch']],

  // ── CATERING — The Food Crowd London ─────────────────────────────────────
  ['The Food Crowd London', 'Catering', 'Street Food Station Package (x3 stations)',
    '3 themed street food stations for up to 200 guests. Chefs on site, disposable packaging. 3 cuisine themes, chefs and service, disposables.',
    4800, 3800, 6800, 'per event', 28, ['Festival', 'Activation', 'Corporate Party', 'Product Launch']],

  ['The Food Crowd London', 'Catering', 'Late Night Snack Package (150 guests)',
    'Comfort food service for late evening: mini burgers, fries, mac and cheese bites. Staffed. Comfort food menu, service team, disposables.',
    1600, 1200, 2300, 'per event', 14, ['Corporate Party', 'Gala', 'Festival', 'Late Night Event']],

  ['The Food Crowd London', 'Catering', 'Grazing Table (80 guests)',
    'Abundant grazing table with cheeses, charcuterie, breads, dips, fruit and sweet bites. Artisan cheese and charcuterie, breads, fruit, styled setup.',
    1400, 1100, 2000, 'per event', 14, ['Drinks Reception', 'Product Launch', 'Corporate Lunch']],
];

// ── SEED ──────────────────────────────────────────────────────────────────────

async function run() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    await client.query('BEGIN');
    console.log('\n🌱  Ballpark catalogue seed\n');

    // ── 1. Upsert supplier orgs ────────────────────────────────────────────
    console.log('  Seeding supplier orgs...');
    const orgIdMap = {};
    for (const s of SUPPLIERS) {
      const res = await client.query(`
        INSERT INTO orgs (name, description, type, city, is_active)
        VALUES ($1, $2, 'supplier', $3, true)
        ON CONFLICT (name) DO UPDATE SET
          description = EXCLUDED.description,
          city        = EXCLUDED.city,
          updated_at  = NOW()
        RETURNING id
      `, [s.name, s.description, s.city]);
      orgIdMap[s.name] = res.rows[0].id;
      console.log(`    ✓ ${s.name}`);
    }

    // ── 2. Load category IDs ───────────────────────────────────────────────
    console.log('\n  Loading categories...');
    const catRes = await client.query(`SELECT id, name FROM categories WHERE is_active = true`);
    const catMap = {};
    for (const row of catRes.rows) catMap[row.name] = row.id;
    console.log(`    Found: ${Object.keys(catMap).join(', ')}`);

    // ── 3. Upsert items ────────────────────────────────────────────────────
    console.log('\n  Seeding items...');
    let seeded = 0, skipped = 0;
    for (const [supplierName, categoryName, name, description, basePrice, minPrice, maxPrice, unit, leadTimeDays, tags] of ITEMS) {
      const orgId = orgIdMap[supplierName];
      const categoryId = catMap[categoryName];

      if (!orgId)       { console.log(`    ⚠ No org found for "${supplierName}" — skipping "${name}"`); skipped++; continue; }
      if (!categoryId)  { console.log(`    ⚠ No category "${categoryName}" — skipping "${name}"`); skipped++; continue; }

      await client.query(`
        INSERT INTO items
          (org_id, category_id, name, description, unit, base_price,
           min_price, max_price, lead_time_days, tier, tags, is_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'mid',$10,true)
        ON CONFLICT (org_id, name) DO UPDATE SET
          description    = EXCLUDED.description,
          unit           = EXCLUDED.unit,
          base_price     = EXCLUDED.base_price,
          min_price      = EXCLUDED.min_price,
          max_price      = EXCLUDED.max_price,
          lead_time_days = EXCLUDED.lead_time_days,
          tags           = EXCLUDED.tags,
          updated_at     = NOW()
      `, [orgId, categoryId, name, description, unit, basePrice, minPrice, maxPrice, leadTimeDays, tags]);
      seeded++;
    }

    await client.query('COMMIT');
    console.log(`\n  ✓ ${seeded} items seeded, ${skipped} skipped`);
    console.log('\n✅  Catalogue seed complete\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌  Seed failed — rolled back:', err.message);
    throw err;
  } finally {
    await client.end();
  }
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
