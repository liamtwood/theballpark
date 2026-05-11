const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const seed = async () => {
  const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await client.query('BEGIN');
    console.log('Seeding database...');

    // ── Statuses ──────────────────────────────────────────────────────────
    const statusRows = [
      // Project statuses
      ['project', 'draft',       'Project is being drafted',         'Draft',       '#6B7280', 0],
      ['project', 'active',      'Project is actively being worked', 'Active',      '#3B82F6', 1],
      ['project', 'completed',   'Project has been completed',       'Completed',   '#10B981', 2],
      ['project', 'archived',    'Project has been archived',        'Archived',    '#9CA3AF', 3],
      // Estimate statuses
      ['estimate', 'draft',      'Estimate is being prepared',       'Draft',       '#6B7280', 0],
      ['estimate', 'sent',       'Estimate has been sent to client', 'Sent',        '#F59E0B', 1],
      ['estimate', 'accepted',   'Estimate accepted by client',      'Accepted',    '#10B981', 2],
      ['estimate', 'declined',   'Estimate declined by client',      'Declined',    '#EF4444', 3],
      // Message statuses
      ['message', 'unread',      'Message has not been read',        'Unread',      '#3B82F6', 0],
      ['message', 'read',        'Message has been read',            'Read',        '#6B7280', 1],
      ['message', 'replied',     'Message has been replied to',      'Replied',     '#10B981', 2],
      // Project-category statuses
      ['project_category', 'pending',     'Category awaiting quotes',     'Pending',     '#6B7280', 0],
      ['project_category', 'in_progress', 'Quotes being gathered',        'In Progress', '#F59E0B', 1],
      ['project_category', 'quoted',      'Quotes received',              'Quoted',      '#3B82F6', 2],
      ['project_category', 'confirmed',   'Category items confirmed',     'Confirmed',   '#10B981', 3],
    ];

    const statusIds = {};
    for (const [entity_type, name, description, label, color, sort_order] of statusRows) {
      const res = await client.query(
        `INSERT INTO statuses (entity_type, name, description, label, color, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [entity_type, name, description, label, color, sort_order]
      );
      statusIds[`${entity_type}_${name}`] = res.rows[0].id;
    }
    console.log('  Statuses seeded.');

    // ── Orgs ──────────────────────────────────────────────────────────────
    const agencyRes = await client.query(
      `INSERT INTO orgs (name, description, type, address, city, country, phone, email, website, subscription_tier, balls_balance, balls_monthly_allowance, default_vat_pct, vat_registered, vat_number, default_margin_pct, default_contingency_pct)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
      [
        'Apex Exhibitions',
        'Full-service exhibition design and management agency specialising in trade shows across the UK and Europe.',
        'agency',
        '14 Great Marlborough Street',
        'London',
        'United Kingdom',
        '+44 20 7946 0958',
        'hello@apexexhibitions.co.uk',
        'https://www.apexexhibitions.co.uk',
        'agency',
        25,
        10,
        20,
        true,
        'GB 123 4567 89',
        15,
        5,
      ]
    );
    const agencyId = agencyRes.rows[0].id;

    const supplierRes = await client.query(
      `INSERT INTO orgs (name, description, type, address, city, country, phone, email, website, subscription_tier, vat_registered, vat_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [
        'ProBuild Events',
        'Leading UK exhibition stand contractor providing design, build, and installation services for trade shows and events.',
        'supplier',
        '42 Industrial Park Road',
        'Birmingham',
        'United Kingdom',
        '+44 121 496 0321',
        'info@probuildevents.co.uk',
        'https://www.probuildevents.co.uk',
        'starter',
        true,
        'GB 987 6543 21',
      ]
    );
    const supplierId = supplierRes.rows[0].id;
    console.log('  Orgs seeded.');

    // ── Users ─────────────────────────────────────────────────────────────
    const adminRes = await client.query(
      `INSERT INTO users (org_id, name, description, email, role)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [agencyId, 'Sarah Mitchell', 'Senior Project Director at Apex Exhibitions', 'sarah@apexexhibitions.co.uk', 'admin']
    );
    const adminUserId = adminRes.rows[0].id;

    const memberRes = await client.query(
      `INSERT INTO users (org_id, name, description, email, role)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [agencyId, 'James Cooper', 'Project Coordinator at Apex Exhibitions', 'james@apexexhibitions.co.uk', 'member']
    );
    const memberUserId = memberRes.rows[0].id;
    console.log('  Users seeded.');

    // ── Clients ───────────────────────────────────────────────────────────
    const clientData = [
      ['TechVista Solutions', 'Enterprise SaaS company exhibiting at major tech events across Europe.', 'David Chen', 'david.chen@techvista.io', '+44 20 7123 4567', '88 Shoreditch High Street, London E1 6JJ'],
      ['GreenLeaf Organics', 'Organic food and drink brand appearing at food industry trade shows.', 'Emma Whitfield', 'emma@greenleaforganics.co.uk', '+44 117 946 2301', '5 Harbourside, Bristol BS1 5BA'],
      ['Meridian Pharma', 'Pharmaceutical company with regular presence at healthcare conferences and exhibitions.', 'Dr. Arun Patel', 'a.patel@meridianpharma.com', '+44 1223 556 789', '12 Science Park, Cambridge CB4 0FW'],
    ];
    const clientIds = [];
    for (const [name, description, contact_name, email, phone, address] of clientData) {
      const res = await client.query(
        `INSERT INTO clients (org_id, name, description, contact_name, email, phone, address)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [agencyId, name, description, contact_name, email, phone, address]
      );
      clientIds.push(res.rows[0].id);
    }
    console.log('  Clients seeded.');

    // ── Categories ────────────────────────────────────────────────────────
    const categoryData = [
      ['Stand Structure',        'Shell scheme, space-only builds, custom structures and architectural elements.',     'Warehouse',         0],
      ['Construction & Build',   'Fabrication, carpentry, painting, flooring and on-site installation labour.',        'Hammer',            1],
      ['Flooring',               'Raised flooring, carpet tiles, vinyl, laminate and bespoke floor finishes.',         'Grid3x3',           2],
      ['Lighting',               'Spot lights, LED strips, feature lighting, rigging and electrical distribution.',    'Lightbulb',         3],
      ['AV & Technology',        'Screens, projectors, interactive displays, WiFi, lead capture and app integration.','Monitor',           4],
      ['Furniture & Fixtures',   'Seating, tables, counters, display units, storage and custom joinery.',             'Armchair',          5],
      ['Graphics & Signage',     'Large-format print, vinyl wraps, fabric tension systems, 3D lettering and logos.',  'Image',             6],
      ['Catering & Hospitality', 'On-stand catering, barista services, drinks packages and hospitality staffing.',    'UtensilsCrossed',   7],
      ['Health & Safety',        'Risk assessments, fire marshals, first aid, accessibility and compliance checks.',  'Shield',            8],
      ['Entertainment',          'Live performers, DJs, product demos, VR experiences and interactive installations.','Music',             9],
      ['Logistics & Transport',  'Freight, shipping, storage, on-site handling and post-show de-rig transport.',      'Truck',            10],
      ['Staffing',               'Brand ambassadors, reception staff, translators, technical crew and security.',     'Users',            11],
    ];
    const categoryIds = [];
    for (const [name, description, icon, sort_order] of categoryData) {
      const res = await client.query(
        `INSERT INTO categories (name, description, icon, sort_order)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [name, description, icon, sort_order]
      );
      categoryIds.push(res.rows[0].id);
    }
    console.log('  Categories seeded.');

    // ── Items (5 per category) ────────────────────────────────────────────
    // [name, description, unit, time_unit, base_price, min_price, max_price, lead_time_days, coverage_area, tier]
    // unit / time_unit hold bare codelist codes (shared.codelists) — display
    // adds the "per " prefix at render time. time_unit is null for most items;
    // set for rental cadences (e.g. unit='pallet', time_unit='month').
    const itemsByCategory = [
      // 0 - Stand Structure (Warehouse)
      [
        ['Shell Scheme Panel Wall',       'Standard aluminium shell scheme walling panel (1m x 2.5m), white infill.',           'panel', null,  85,    65,    120,   5,   2.5,  'basic'],
        ['Space-Only Stand Build',        'Custom space-only stand build including walls, fascia and basic structure.',          'sqm', null,    195,   150,   280,   14,  1.0,  'mid'],
        ['Double-Deck Structure',         'Two-storey exhibition structure with staircase, upper meeting area and balustrade.', 'sqm', null,    450,   380,   600,   21,  1.0,  'premium'],
        ['Modular Re-usable System',      'Lightweight modular aluminium frame system, reconfigurable for multiple shows.',     'sqm', null,    160,   120,   220,   10,  1.0,  'mid'],
        ['Bespoke Architectural Feature', 'Custom CNC-cut or 3D-formed architectural feature element for stand centrepiece.',  'item', null,   2200,  1500,  4500,  21,  null, 'premium'],
      ],
      // 1 - Construction & Build (Hammer)
      [
        ['Basic Joinery Package',         'Standard MDF construction, painted finish, simple counter and storage unit.',        'sqm', null,    120,   90,    170,   10,  1.0,  'basic'],
        ['Custom Carpentry Build',        'Bespoke joinery including counters, shelving, display plinths and concealed storage.','sqm', null,   210,   160,   300,   14,  1.0,  'mid'],
        ['Premium Spray-Finish Build',    'High-end lacquer or automotive spray finish on all timber elements.',               'sqm', null,    320,   250,   450,   14,  1.0,  'premium'],
        ['On-Site Installation Labour',   'Skilled installation crew for build-up day including tools and site management.',    'day', null,    650,   480,   850,   3,   null, 'mid'],
        ['De-rig & Disposal',             'Post-show breakdown, waste removal and skip hire.',                                 'sqm', null,    45,    30,    75,    1,   1.0,  'basic'],
      ],
      // 2 - Flooring (Grid3x3)
      [
        ['Standard Carpet Tiles',         'Loop-pile carpet tiles in a choice of 12 colours, laid on double-sided tape.',       'sqm', null,    18,    12,    28,    5,   1.0,  'basic'],
        ['Raised Platform Floor',         'Raised access flooring system with adjustable pedestals, 150mm height.',            'sqm', null,    65,    48,    95,    7,   1.0,  'mid'],
        ['Luxury Vinyl Plank (LVP)',      'High-end wood-effect luxury vinyl plank, click-lock installation.',                 'sqm', null,    42,    32,    58,    7,   1.0,  'mid'],
        ['Resin Pour Floor',              'Seamless poured resin finish in custom colour, high-gloss or matte.',               'sqm', null,    95,    75,    140,   10,  1.0,  'premium'],
        ['Branded Floor Graphic',         'Full-colour digitally printed floor vinyl with anti-slip laminate.',                 'sqm', null,    55,    40,    80,    7,   1.0,  'mid'],
      ],
      // 3 - Lighting (Lightbulb)
      [
        ['LED Spotlight (Track)',         'Adjustable LED spotlight on track rail, warm white 3000K, 20W.',                     'unit', null,   35,    22,    55,    5,   null, 'basic'],
        ['LED Strip Lighting',            'Recessed or surface-mounted LED strip, RGB or tuneable white, per linear metre.',    'linear_m', null,      28,    18,    45,    5,   null, 'mid'],
        ['Feature Pendant Light',         'Designer pendant or suspended feature light for stand focal point.',                 'unit', null,   180,   120,   350,   10,  null, 'premium'],
        ['Backlit Fabric Lightbox',       'SEG fabric lightbox with internal LED array, single-sided, per sqm of face.',       'sqm', null,    145,   110,   200,   10,  1.0,  'mid'],
        ['Intelligent Lighting Rig',      'DMX-controlled moving heads, wash lights and programmed lighting show.',            'day', null,    850,   600,   1400,  14,  null, 'premium'],
      ],
      // 4 - AV & Technology (Monitor)
      [
        ['43" LCD Display',               '43-inch commercial-grade LCD screen with floor stand or wall bracket.',              'unit', null,   220,   160,   320,   5,   null, 'basic'],
        ['55" 4K LED Screen',             '55-inch 4K UHD commercial display with media player and content loading.',          'unit', null,   380,   280,   520,   5,   null, 'mid'],
        ['LED Video Wall',                'Seamless LED video wall (2.5mm pixel pitch), including processor and rigging.',      'sqm', null,    950,   750,   1400,  14,  1.0,  'premium'],
        ['Interactive Touch Screen',      '55" multi-touch display with custom interactive software or presentation.',         'unit', null,   650,   480,   900,   10,  null, 'mid'],
        ['iPad Kiosk with Lead Capture',  'Secure iPad stand with custom lead-capture app, badge scanner integration.',        'unit', null,   175,   120,   250,   7,   null, 'basic'],
      ],
      // 5 - Furniture & Fixtures (Armchair)
      [
        ['Folding Chair',                 'Padded folding chair in black or white, clean and event-ready.',                     'unit', null,   8,     5,     15,    3,   null, 'basic'],
        ['Lounge Sofa (3-seat)',          'Contemporary fabric or leather-look 3-seat sofa for meeting areas.',                'unit', null,   185,   130,   280,   5,   null, 'mid'],
        ['High Poseur Table & Stools',    'Poseur bar table (110cm) with two matching bar stools, white or black.',            'set', null,    95,    65,    140,   5,   null, 'mid'],
        ['Custom Reception Counter',      'Bespoke branded reception desk with internal storage and cable management.',        'unit', null,   850,   600,   1400,  14,  null, 'premium'],
        ['Display Plinth (Illuminated)',  'Acrylic or MDF display plinth with internal LED illumination, 400x400mm top.',     'unit', null,   120,   80,    200,   7,   null, 'mid'],
      ],
      // 6 - Graphics & Signage (Image)
      [
        ['Roller Banner (850mm)',         'Standard pull-up roller banner, single-sided, printed on anti-curl media.',          'unit', null,   65,    40,    95,    3,   null, 'basic'],
        ['Large-Format Wall Graphic',     'Digitally printed self-adhesive vinyl wall wrap, installed on-site.',               'sqm', null,    55,    38,    80,    5,   1.0,  'mid'],
        ['Fabric Tension Display',        'Dye-sublimation printed fabric on lightweight aluminium SEG frame.',                'sqm', null,    85,    60,    130,   7,   1.0,  'mid'],
        ['3D Fabricated Lettering',       'CNC-routed or laser-cut acrylic/timber 3D letters, painted or vinyl-faced.',        'letter', null, 45,    25,    120,   10,  null, 'premium'],
        ['Hanging Banner (Overhead)',     'Circular or rectangular suspended fabric banner with aluminium frame and rigging.',  'unit', null,   750,   500,   1200,  14,  null, 'premium'],
      ],
      // 7 - Catering & Hospitality (UtensilsCrossed)
      [
        ['Tea & Coffee Station',          'Self-serve tea, coffee and biscuit station for up to 50 guests per day.',           'day', null,    120,   80,    180,   3,   null, 'basic'],
        ['Barista Coffee Service',        'Professional barista with espresso machine, branded cups, unlimited servings.',     'day', null,    450,   350,   650,   7,   null, 'mid'],
        ['Canape & Drinks Reception',     'Evening canapé package with prosecco, beer and soft drinks for 50 guests.',        'event', null,  1800,  1200,  2800,  10,  null, 'premium'],
        ['Working Lunch Platters',        'Sandwich, wrap and salad platters delivered to stand, serves 10.',                  'platter', null, 95,   65,    140,   3,   null, 'mid'],
        ['Branded Water Bottles',         'Custom-labelled 500ml water bottles, minimum order 100.',                           'each', null,    85,    60,    130,   7,   null, 'basic'],
      ],
      // 8 - Health & Safety (Shield)
      [
        ['Risk Assessment & Method Statement', 'Full RAMS document preparation for venue submission.',                         'project', null, 350,  250,   500,   7,   null, 'mid'],
        ['Fire Marshal (Show Days)',       'Qualified fire marshal on-site during open show days.',                             'day', null,    280,   200,   400,   5,   null, 'mid'],
        ['First Aid Cover',               'Qualified first aider on-site with first aid kit and incident reporting.',          'day', null,    220,   160,   320,   5,   null, 'basic'],
        ['Structural Calculations',        'Structural engineer sign-off for double-deck or suspended elements.',              'project', null, 750,  500,   1200,  14,  null, 'premium'],
        ['Accessibility Compliance Audit', 'DDA/accessibility review of stand design with recommendations report.',            'project', null, 450,  300,   650,   10,  null, 'premium'],
      ],
      // 9 - Entertainment (Music)
      [
        ['Product Demo Presenter',        'Professional presenter to host live product demonstrations on stand.',               'day', null,    650,   450,   900,   7,   null, 'mid'],
        ['DJ & Sound System',             'DJ with professional PA system for stand atmosphere or party event.',                'day', null,    550,   380,   800,   7,   null, 'mid'],
        ['VR Experience Setup',           'Virtual reality headsets (x4) with custom branded VR experience content.',           'day', null,    1200,  850,   1800,  21,  null, 'premium'],
        ['Magician / Close-Up Entertainer','Professional close-up magician to draw and engage visitors on stand.',             'day', null,    480,   350,   700,   5,   null, 'mid'],
        ['Photo Booth (Branded)',         'Custom branded photo booth with instant prints, digital sharing and data capture.',  'day', null,    650,   450,   950,   10,  null, 'basic'],
      ],
      // 10 - Logistics & Transport (Truck)
      [
        ['UK Freight (Single Pallet)',    'Next-day UK pallet delivery to venue, including tail-lift.',                         'pallet', null, 85,    55,    130,   2,   null, 'basic'],
        ['Exhibition Freight (Full Load)','Dedicated vehicle for full stand freight, London to UK venue.',                      'load', null,   650,   450,   950,   3,   null, 'mid'],
        ['International Freight (EU)',    'Road freight to European venue including customs documentation.',                    'cbm', null,    120,   85,    200,   10,  null, 'mid'],
        ['Secure Storage (Monthly)',      'Climate-controlled secure warehouse storage for stand components.',                  'pallet', 'month', 45, 30,    70,    1,   null, 'basic'],
        ['On-Site Forklift & Handling',   'Forklift hire with operator for build-up and breakdown days.',                       'day', null,    380,   280,   550,   3,   null, 'premium'],
      ],
      // 11 - Staffing (Users)
      [
        ['Brand Ambassador',              'Experienced exhibition brand ambassador, briefed and branded.',                      'day', null,    220,   160,   320,   5,   null, 'basic'],
        ['Receptionist / Host',           'Professional front-of-stand receptionist for visitor welcome and registration.',     'day', null,    250,   180,   350,   5,   null, 'mid'],
        ['Multilingual Translator',       'On-stand translator fluent in two or more languages.',                              'day', null,    380,   280,   520,   7,   null, 'premium'],
        ['Technical Stand Crew',          'Skilled AV or technical crew member for on-stand equipment management.',             'day', null,    320,   240,   450,   5,   null, 'mid'],
        ['Security Officer (SIA)',        'SIA-licensed security officer for stand or event security.',                         'day', null,    260,   200,   380,   3,   null, 'basic'],
      ],
    ];

    const allItemIds = []; // allItemIds[catIndex][itemIndex]
    for (let ci = 0; ci < itemsByCategory.length; ci++) {
      const catItemIds = [];
      for (const [name, description, unit, time_unit, base_price, min_price, max_price, lead_time_days, coverage_area, tier] of itemsByCategory[ci]) {
        const res = await client.query(
          `INSERT INTO items (org_id, category_id, name, description, unit, time_unit, base_price, min_price, max_price, lead_time_days, coverage_area, tier)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
          [supplierId, categoryIds[ci], name, description, unit, time_unit, base_price, min_price, max_price, lead_time_days, coverage_area, tier]
        );
        catItemIds.push(res.rows[0].id);
      }
      allItemIds.push(catItemIds);
    }
    console.log('  Items seeded (60 total).');

    // ── Project 1 ─────────────────────────────────────────────────────────
    // TechVista at London Tech Week — large space-only stand
    const proj1Res = await client.query(
      `INSERT INTO projects (
        org_id, client_id, name, description, event_name, event_date,
        venue_name, venue_city, venue_address, guest_count,
        stand_size, stand_width_m, stand_depth_m, stand_type,
        project_notes, project_budget, share_budget_with_suppliers,
        default_margin_pct, default_contingency_pct, default_vat_pct,
        total_ballpark_cost, total_base_cost, total_client_cost,
        tier, status_id, created_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26
      ) RETURNING id`,
      [
        agencyId, clientIds[0],
        'TechVista London Tech Week 2026',
        'Major 72sqm island stand for TechVista at London Tech Week. Premium build with double-deck meeting area, LED video wall, barista station and full AV.',
        'London Tech Week', 'June 2026',
        'ExCeL London', 'London', 'Royal Victoria Dock, 1 Western Gateway, London E16 1XL',
        500,
        'large', 12, 6, 'space_only',
        'Client wants a bold, modern design with lots of technology. Meeting rooms on upper deck. Budget is firm.',
        85000, false,
        15, 5, 20,
        58750, 51087, 71820,
        'premium', statusIds['project_active'], adminUserId,
      ]
    );
    const proj1Id = proj1Res.rows[0].id;

    // Project 1 categories (6 categories with realistic costs)
    const proj1CatData = [
      // [catIndex, name, req_brief, ballpark, base, contingency_pct]
      [0, 'Stand Structure',      'Custom 72sqm space-only island build with double-deck upper level.', 14400, 14040],
      [3, 'Lighting',             'Full LED lighting scheme including feature pendants, track spots and backlit fabric walls.', 4200, 3880],
      [4, 'AV & Technology',      'LED video wall (6sqm), 4x 55" screens, 2x interactive touch screens, 3x iPad kiosks.', 10950, 9725],
      [6, 'Graphics & Signage',   'Full stand wrap, 3D fabricated logo, SEG fabric displays and overhead hanging banner.', 5850, 5420],
      [7, 'Catering & Hospitality','3-day barista service, working lunches and VIP evening reception.', 3600, 3150],
      [11,'Staffing',             '4 brand ambassadors, 1 receptionist and 2 technical crew for 3 show days.', 5750, 5160],
    ];

    const proj1CatIds = [];
    for (let i = 0; i < proj1CatData.length; i++) {
      const [catIdx, name, req_brief, ballpark, base] = proj1CatData[i];
      const contingencyPct = 5;
      const contingencyAmt = +(base * contingencyPct / 100).toFixed(2);
      const subtotal = +(base + contingencyAmt).toFixed(2);
      const marginPct = 15;
      const marginAmt = +(subtotal * marginPct / 100).toFixed(2);
      const net = +(subtotal + marginAmt).toFixed(2);
      const vatPct = 20;
      const vatAmt = +(net * vatPct / 100).toFixed(2);
      const clientCost = +(net + vatAmt).toFixed(2);

      const res = await client.query(
        `INSERT INTO project_categories (
          project_id, category_id, name, requirement_brief,
          ballpark_cost, base_cost, contingency_pct, contingency_amount,
          subtotal, margin_pct, margin_amount, net_cost,
          vat_pct, vat_amount, client_cost, sort_order, status_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
        [
          proj1Id, categoryIds[catIdx], name, req_brief,
          ballpark, base, contingencyPct, contingencyAmt,
          subtotal, marginPct, marginAmt, net,
          vatPct, vatAmt, clientCost, i, statusIds['project_category_quoted'],
        ]
      );
      proj1CatIds.push({ id: res.rows[0].id, catIdx });
    }

    // Estimate for project 1
    const est1Res = await client.query(
      `INSERT INTO estimates (project_id, name, description, version, total_value, balls_cost, status_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [proj1Id, 'TechVista LTW v1', 'Initial estimate for London Tech Week stand', 1, 51087, 3, statusIds['estimate_sent'], adminUserId]
    );
    const est1Id = est1Res.rows[0].id;

    // Estimate items for project 1 (pick realistic items from each category)
    const est1ItemData = [
      // [proj1CatIdx, itemCatIdx, itemIdx, qty, unit_price]
      [0, 0, 1, 72,  195],   // Space-Only Stand Build 72sqm
      [0, 0, 2, 18,  450],   // Double-Deck Structure 18sqm upper
      [1, 3, 0, 40,  35],    // LED Spotlights x40
      [1, 3, 1, 30,  28],    // LED Strips 30m
      [1, 3, 3, 12,  145],   // Backlit Fabric Lightbox 12sqm
      [2, 4, 2, 6,   950],   // LED Video Wall 6sqm
      [2, 4, 1, 4,   380],   // 55" 4K screens x4
      [2, 4, 3, 2,   650],   // Interactive Touch Screen x2
      [2, 4, 4, 3,   175],   // iPad Kiosks x3
      [3, 6, 1, 40,  55],    // Wall Graphics 40sqm
      [3, 6, 2, 24,  85],    // Fabric Tension 24sqm
      [3, 6, 3, 12,  45],    // 3D Lettering 12 letters
      [3, 6, 4, 1,   750],   // Hanging Banner
      [4, 7, 1, 3,   450],   // Barista 3 days
      [4, 7, 3, 6,   95],    // Lunch platters x6
      [4, 7, 2, 1,   1800],  // VIP Reception
      [5, 11, 0, 12, 220],   // Brand Ambassadors 4x3 days
      [5, 11, 1, 3,  250],   // Receptionist 3 days
      [5, 11, 3, 6,  320],   // Technical crew 2x3 days
    ];

    for (const [pcIdx, catIdx, itemIdx, qty, unit_price] of est1ItemData) {
      const total_price = +(qty * unit_price).toFixed(2);
      await client.query(
        `INSERT INTO estimate_items (estimate_id, project_category_id, item_id, name, description, quantity, unit_price, total_price, supplier_org_id, shortlisted, status_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          est1Id,
          proj1CatIds[pcIdx].id,
          allItemIds[catIdx][itemIdx],
          itemsByCategory[catIdx][itemIdx][0],
          itemsByCategory[catIdx][itemIdx][1],
          qty, unit_price, total_price,
          supplierId, true,
          statusIds['estimate_draft'],
        ]
      );
    }
    console.log('  Project 1 (TechVista) seeded with categories and estimate.');

    // ── Project 2 ─────────────────────────────────────────────────────────
    // GreenLeaf Organics at Food & Drink Expo — medium shell scheme
    const proj2Res = await client.query(
      `INSERT INTO projects (
        org_id, client_id, name, description, event_name, event_date,
        venue_name, venue_city, venue_address, guest_count,
        stand_size, stand_width_m, stand_depth_m, stand_type,
        project_notes, project_budget, share_budget_with_suppliers,
        default_margin_pct, default_contingency_pct, default_vat_pct,
        total_ballpark_cost, total_base_cost, total_client_cost,
        tier, status_id, created_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26
      ) RETURNING id`,
      [
        agencyId, clientIds[1],
        'GreenLeaf Food & Drink Expo 2026',
        'Shell scheme stand for GreenLeaf Organics at the Food & Drink Expo. Focus on product sampling, natural aesthetic with greenery.',
        'Food & Drink Expo', 'April 2026',
        'NEC Birmingham', 'Birmingham', 'North Avenue, Marston Green, Birmingham B40 1NT',
        200,
        'medium', 6, 4, 'shell_scheme',
        'Natural, eco-friendly look. Lots of product display space. Sampling counter is essential. Keep within budget.',
        18000, true,
        15, 5, 20,
        12400, 10783, 15160,
        'starter', statusIds['project_draft'], memberUserId,
      ]
    );
    const proj2Id = proj2Res.rows[0].id;

    const proj2CatData = [
      [0, 'Stand Structure',       'Shell scheme 24sqm with custom header and infill upgrades.',    2040, 2040],
      [2, 'Flooring',              'Wood-effect LVP flooring throughout 24sqm.',                    1008, 1008],
      [5, 'Furniture & Fixtures',  'Sampling counter, display shelving, 2 poseur tables and stools, product plinths.', 1600, 1465],
      [6, 'Graphics & Signage',    'Full back-wall fabric graphic, side panel wraps and roller banners.', 1850, 1680],
      [7, 'Catering & Hospitality','Product sampling setup and branded water bottles.',              800,  745],
    ];

    const proj2CatIds = [];
    for (let i = 0; i < proj2CatData.length; i++) {
      const [catIdx, name, req_brief, ballpark, base] = proj2CatData[i];
      const contingencyPct = 5;
      const contingencyAmt = +(base * contingencyPct / 100).toFixed(2);
      const subtotal = +(base + contingencyAmt).toFixed(2);
      const marginPct = 15;
      const marginAmt = +(subtotal * marginPct / 100).toFixed(2);
      const net = +(subtotal + marginAmt).toFixed(2);
      const vatPct = 20;
      const vatAmt = +(net * vatPct / 100).toFixed(2);
      const clientCost = +(net + vatAmt).toFixed(2);

      const res = await client.query(
        `INSERT INTO project_categories (
          project_id, category_id, name, requirement_brief,
          ballpark_cost, base_cost, contingency_pct, contingency_amount,
          subtotal, margin_pct, margin_amount, net_cost,
          vat_pct, vat_amount, client_cost, sort_order, status_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
        [
          proj2Id, categoryIds[catIdx], name, req_brief,
          ballpark, base, contingencyPct, contingencyAmt,
          subtotal, marginPct, marginAmt, net,
          vatPct, vatAmt, clientCost, i, statusIds['project_category_pending'],
        ]
      );
      proj2CatIds.push({ id: res.rows[0].id, catIdx });
    }

    // Estimate for project 2
    const est2Res = await client.query(
      `INSERT INTO estimates (project_id, name, description, version, total_value, balls_cost, status_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [proj2Id, 'GreenLeaf FDE v1', 'Initial estimate for Food & Drink Expo stand', 1, 10783, 1, statusIds['estimate_draft'], memberUserId]
    );
    const est2Id = est2Res.rows[0].id;

    const est2ItemData = [
      [0, 0, 0, 24, 85],     // Shell Scheme Panels 24
      [1, 2, 2, 24, 42],     // LVP Flooring 24sqm
      [2, 5, 4, 6,  120],    // Illuminated Plinths x6
      [2, 5, 2, 2,  95],     // Poseur Table & Stools x2
      [2, 5, 3, 1,  850],    // Custom Reception Counter
      [3, 6, 2, 12, 85],     // Fabric Tension 12sqm
      [3, 6, 1, 8,  55],     // Wall Graphics 8sqm
      [3, 6, 0, 2,  65],     // Roller Banners x2
      [4, 7, 0, 2,  120],    // Tea & Coffee 2 days
      [4, 7, 4, 2,  85],     // Branded Water Bottles 200
    ];

    for (const [pcIdx, catIdx, itemIdx, qty, unit_price] of est2ItemData) {
      const total_price = +(qty * unit_price).toFixed(2);
      await client.query(
        `INSERT INTO estimate_items (estimate_id, project_category_id, item_id, name, description, quantity, unit_price, total_price, supplier_org_id, shortlisted, status_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          est2Id,
          proj2CatIds[pcIdx].id,
          allItemIds[catIdx][itemIdx],
          itemsByCategory[catIdx][itemIdx][0],
          itemsByCategory[catIdx][itemIdx][1],
          qty, unit_price, total_price,
          supplierId, false,
          statusIds['estimate_draft'],
        ]
      );
    }
    console.log('  Project 2 (GreenLeaf) seeded with categories and estimate.');

    // ── Balls Transactions ────────────────────────────────────────────────
    await client.query(
      `INSERT INTO balls_transactions (org_id, user_id, amount, direction, reason, description)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [agencyId, adminUserId, 10, 'credit', 'subscription', 'Monthly subscription allowance - March 2026']
    );
    await client.query(
      `INSERT INTO balls_transactions (org_id, user_id, amount, direction, reason, description)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [agencyId, adminUserId, 5, 'credit', 'bonus', 'Welcome bonus for new agency account']
    );
    await client.query(
      `INSERT INTO balls_transactions (org_id, project_id, estimate_id, supplier_org_id, user_id, amount, direction, reason, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [agencyId, proj1Id, est1Id, supplierId, adminUserId, 3, 'debit', 'spend', 'Estimate request sent to ProBuild Events for TechVista LTW project']
    );
    console.log('  Balls transactions seeded.');

    // ── Messages ──────────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO messages (project_id, user_id, supplier_org_id, subject, body, direction, status_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        proj1Id, adminUserId, supplierId,
        'Quote Request: TechVista London Tech Week 2026',
        'Hi ProBuild,\n\nWe are putting together a 72sqm island stand for our client TechVista at London Tech Week in June. The stand includes a double-deck meeting area, LED video wall, and full AV setup.\n\nCould you please provide your best pricing for the structure, AV and lighting elements? I have attached the initial floor plan for reference.\n\nMany thanks,\nSarah',
        'outbound',
        statusIds['message_read'],
        adminUserId,
      ]
    );
    await client.query(
      `INSERT INTO messages (project_id, user_id, supplier_org_id, subject, body, direction, status_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        proj1Id, adminUserId, supplierId,
        'Re: Quote Request: TechVista London Tech Week 2026',
        'Hi Sarah,\n\nThanks for sending this over. The project looks great — we have availability in June and would love to be involved.\n\nI have reviewed the floor plan and will have detailed pricing back to you by end of week. A couple of quick questions:\n\n1. Do you have a preference for the double-deck staircase position (front or side)?\n2. Will the LED video wall need to be curved or flat?\n\nBest regards,\nMark Thompson\nProBuild Events',
        'inbound',
        statusIds['message_replied'],
        adminUserId,
      ]
    );
    console.log('  Messages seeded.');

    await client.query('COMMIT');
    console.log('Database seeded successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err.message);
    throw err;
  } finally {
    await client.end();
  }
};

seed().catch(() => process.exit(1));
