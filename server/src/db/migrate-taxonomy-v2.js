/**
 * v1.42 — Taxonomy v2 migration (Part 1 of the taxonomy implementation).
 *
 * Source of truth: FINAL_TAXONOMY_v2.md (categories + subcategories) and
 * TAXONOMY_REVIEW.md Step 3 (tag dimensions).
 *
 * What this does, in safe order, on ONE schema:
 *   1. tag.dimension column + UNIQUE(category_id,dimension,label)
 *      (the old UNIQUE(category_id,label) breaks once values like
 *       "Both"/"Yes"/"No" recur across dimensions).
 *   2. Rename "Catering & Hospitality" → "Catering".
 *   3. Re-point items + project_categories off the 3 retiring parents
 *      (Construction & Build, Flooring, Set Build) → Stand Structure.
 *   4. NULL every items.subcategory_id (old child tree is about to go).
 *   5. Delete all child categories + the 3 retired parents.
 *   6. Insert the 131 v2 subcategories under the 15 parents.
 *   7. Wipe + reseed the tag table with dimensions + values, plus the
 *      shared event-type dimension duplicated across 12 categories.
 *
 * IDEMPOTENT GUARD: the destructive rebuild (steps 3-6) only runs while
 * the old taxonomy is still present (detected by the "Construction &
 * Build" parent). Once migrated, a re-run skips straight to the tag
 * reseed — so re-running after Part 3 (AI classification) will NOT wipe
 * items.subcategory_id.
 *
 * Usage:  node server/src/db/migrate-taxonomy-v2.js [schema]
 *         schema defaults to 'public'.
 */
require('dotenv').config({
  path: require('path').resolve(__dirname, '../../../.env'),
  override: true
});
const { Pool } = require('pg');

const SCHEMA = (process.argv[2] || 'public').replace(/[^a-z_]/gi, '');

// ── 15 parent categories (final v2). All already exist in the DB after
//    the Catering rename; listed here for the membership check. ──────────
const PARENTS = [
  'Stand Structure', 'Lighting', 'AV & Technology', 'Furniture & Fixtures',
  'Catering', 'Florals', 'Graphics & Signage', 'Staffing', 'Health & Safety',
  'Logistics & Transport', 'Entertainment', 'Photography',
  'Event Accessories', 'Venue', 'Other'
];

// ── 131 subcategories, keyed by parent. Array order = sort_order. ───────
const SUBCATS = {
  'Stand Structure': [
    'Shell Scheme', 'Custom / Bespoke Build', 'Modular / Reusable',
    'Double-Decker / Two-Storey', 'Pop-Up / Activation', 'Inflatables',
    'Stage / Platform', 'Outdoor & Tensile Structure', 'Flooring',
    'Joinery & Carpentry', 'Metalwork & Fabrication', 'CNC / Digital Fabrication',
    'Spray & Paint Finish', 'Scenic Painting', 'Set Dressing & Theming',
    'Install & De-rig Labour'
  ],
  'Lighting': [
    'Architectural & Wash', 'Spot & Feature', 'Uplighting',
    'Moving Head / Intelligent', 'Festoon & Decorative', 'Neon & LED Effects',
    'Ambient & Mood'
  ],
  'AV & Technology': [
    'Sound & PA', 'LED Walls & Screens', 'TVs & Monitors',
    'Projection & Mapping', 'Interactive & Digital', 'Streaming & Broadcast',
    'Connectivity & WiFi', 'Rigging & Power Distribution'
  ],
  'Furniture & Fixtures': [
    'Seating', 'Tables', 'Lounge & Breakout', 'Bar & Counter Units',
    'Plinths & Pedestals', 'Shelving & Display Units', 'Reception / Registration',
    'Outdoor Furniture'
  ],
  'Catering': [
    'Canapés & Reception', 'Bowl Food & Sharing', 'Buffet & Grazing',
    'Sit-Down Dining', 'Street Food & Food Trucks', 'Live Cooking Stations',
    'Product Sampling', 'Daytime Catering', 'Desserts & Sweet', 'Bar Service',
    'Coffee & Hot Drinks'
  ],
  'Florals': [
    'Table Centrepieces', 'Entrance & Arch', 'Hanging & Suspended Installations',
    'Potted Plants & Greenery', 'Floral Feature Walls', 'Bouquets & Handheld'
  ],
  'Graphics & Signage': [
    'Banners & Flags', 'Signs & Wayfinding', 'Vinyl & Wraps',
    'Large-Format Print', 'Displays & Stands', 'Print & Stationery',
    'Stickers & Labels', 'Branded Merchandise'
  ],
  'Staffing': [
    'Event Manager / Producer', 'Brand Ambassador', 'Promotional Staff',
    'Registration / Front of House', 'Waiting Staff', 'Bar Staff',
    'Chefs & Kitchen', 'Technical Crew', 'Runners / General Staff',
    'Specialist Staff (DBS, First Aid, Security)', 'Interpreter / Multilingual'
  ],
  'Health & Safety': [
    'Risk Assessment / RAMS', 'Public Liability Insurance', 'Fire Safety / Marshal',
    'First Aid Cover', 'Crowd Management / Barriers', 'Food Safety / Hygiene',
    'Structural Certification', 'DBS / Safeguarding', 'Licensing / Permits'
  ],
  'Logistics & Transport': [
    'Transport & Delivery', 'Load-In / Load-Out Crew', 'Storage & Warehousing',
    'Generator / Temp Power', 'Water & Plumbing', 'Waste Management / Recycling',
    'Freight / International', 'Parking / Traffic'
  ],
  'Entertainment': [
    'Live Band / Musician', 'DJ', 'MC / Host', 'Comedian / Speaker',
    'Performance Act', 'Interactive Experience', "Children's Entertainment",
    'Roaming / Ambient Acts'
  ],
  'Photography': [
    'Event Photography', 'Videography & Film Crew', 'Drone / Aerial',
    'Content Creation (Social)', 'Photo Booth', '360° / VR / Immersive Capture'
  ],
  'Event Accessories': [
    'Red Carpet / Rope & Post', 'Gift Bags / Welcome Packs',
    'Lanyards / Badges / Wristbands', 'Table Dressing / Linen',
    'Glassware / Crockery Hire', 'Branded Uniforms / Workwear',
    'Balloons / Confetti / Pyro', 'Scent / Aroma Design'
  ],
  'Venue': [
    'Exhibition Centre', 'Hotel / Conference', 'Museum / Gallery',
    'Outdoor / Park / Garden', 'Warehouse / Industrial', 'Restaurant / Bar',
    'Unique / Non-Traditional', 'Festival Site / Field',
    'Retail Unit / Pop-Up Shop', 'Studio / Broadcast'
  ],
  'Other': [
    'Project Management Fee', 'Design & Creative Fee', 'Contingency',
    'Client Hospitality', 'Travel & Accommodation', 'Site Survey / Recce',
    'Miscellaneous'
  ]
};

// ── Tag dimensions per category (TAXONOMY_REVIEW.md Step 3, with
//    Construction folded into Stand Structure; service-level/finish
//    Standard/Premium/Luxury dropped per rule 3 — items.tier covers it).
const DIMENSIONS = {
  'Stand Structure': {
    'stand-size':    ['Small (<20m²)', 'Medium (20–50m²)', 'Large (50–100m²)', 'XL (100m²+)'],
    'space-type':    ['Shell Scheme', 'Space Only', 'Either'],
    'floor-type':    ['Carpet', 'Vinyl', 'Raised Platform', 'Timber', 'Branded Graphic', 'None'],
    'setting':       ['Indoor', 'Outdoor', 'Both'],
    'reusable':      ['Yes', 'No (single-use)'],
    'install':       ['Supplier Install', 'Self-Build', 'Both'],
    'material':      ['Timber', 'Metal', 'MDF', 'Composite', 'Acrylic', 'Mixed'],
    'finish':        ['Painted', 'Spray Finish', 'Laminate', 'Veneer', 'Raw / Unfinished'],
    'service-scope': ['Fabrication Only', 'Install Only', 'Fabrication & Install', 'De-rig'],
    'lead-time':     ['Express (<1 wk)', 'Standard (1–3 wks)', 'Extended (3 wks+)']
  },
  'Lighting': {
    'control': ['Static', 'DMX', 'Wireless / App'],
    'colour':  ['Warm White', 'Cool White', 'Single Colour', 'RGB / Colour-Changing'],
    'power':   ['Battery', 'Mains', 'Both'],
    'setting': ['Indoor', 'Outdoor', 'Both'],
    'crewed':  ['Dry Hire', 'Operator Included']
  },
  'AV & Technology': {
    'capacity': ['Up to 150', 'Up to 500', 'Up to 1,000', '1,000+'],
    'service':  ['Dry Hire', 'Crewed Hire', 'Managed Production'],
    'setting':  ['Indoor', 'Outdoor', 'Both'],
    'hybrid':   ['Yes', 'No'],
    'control':  ['Self-Operated', 'Technician Included']
  },
  'Furniture & Fixtures': {
    'style':       ['Modern', 'Classic', 'Industrial', 'Rustic', 'Minimalist', 'Luxe'],
    'colour':      ['White', 'Black', 'Neutral', 'Wood', 'Bold / Colour', 'Metallic', 'Clear / Acrylic'],
    'material':    ['Wood', 'Metal', 'Upholstered', 'Acrylic', 'Rattan / Wicker', 'Plastic'],
    'setting':     ['Indoor', 'Outdoor', 'Both'],
    'illuminated': ['Yes', 'No'],
    'branded':     ['Yes', 'No', 'Customisable']
  },
  'Catering': {
    'cuisine':       ['British', 'Italian', 'Indian', 'Mexican', 'Japanese', 'Middle Eastern',
                      'Caribbean', 'American', 'Thai', 'Korean', 'African', 'Mediterranean',
                      'Pan-Asian', 'French'],
    'dietary':       ['Vegan', 'Vegetarian', 'Halal', 'Kosher', 'Gluten-Free', 'Nut-Free', 'Dairy-Free'],
    'service-style': ['Plated', 'Buffet', 'Self-Serve', 'Grazing', 'Food Stations', 'Drop-Off'],
    'occasion':      ['Breakfast', 'Lunch', 'Dinner', 'All-Day', 'Cocktail / Reception', 'Late Night'],
    'staffed':       ['Yes', 'No (drop-off only)']
  },
  'Florals': {
    'material':       ['Fresh', 'Dried', 'Artificial / Faux', 'Preserved', 'Mixed'],
    'scale':          ['Table', 'Feature', 'Large Installation', 'Suspended'],
    'style':          ['Wild / Natural', 'Structured / Formal', 'Modern', 'Tropical', 'Minimalist'],
    'colour-palette': ['White & Green', 'Pastel', 'Bold / Bright', 'Monochrome', 'Seasonal', 'Brand-Matched'],
    'sustainable':    ['Yes', 'No']
  },
  'Graphics & Signage': {
    'material':     ['Vinyl', 'Foamex', 'Fabric', 'Correx', 'Acrylic', 'Paper / Card', 'Aluminium'],
    'finish':       ['Matte', 'Gloss', 'Laminate', 'Satin'],
    'format':       ['Small Format', 'Large Format', 'Roll / Banner', 'Rigid Board'],
    'setting':      ['Indoor', 'Outdoor', 'Both'],
    'installation': ['Self-Apply', 'Supplier Install', 'Freestanding'],
    'branded':      ['Yes (always custom)', 'Stock / Generic']
  },
  'Staffing': {
    'seniority':   ['Junior', 'Staff', 'Supervisor', 'Manager'],
    'experience':  ['Entry', 'Experienced', 'Specialist'],
    'dbs-checked': ['Yes', 'No'],
    'uniform':     ['Supplier-Provided', 'Client-Provided', 'Black Tie / Smart', 'Branded'],
    'context':     ['Exhibition', 'Hospitality', 'Experiential', 'Corporate', 'Conference'],
    'languages':   ['English Only', 'Multilingual']
  },
  'Health & Safety': {
    'service-type':  ['Consultancy', 'On-Site Cover', 'Documentation', 'Certification', 'Training'],
    'event-scale':   ['Small', 'Medium', 'Large', 'Major / Mass'],
    'setting':       ['Indoor', 'Outdoor', 'Both'],
    'accreditation': ['IOSH', 'NEBOSH', 'First Aid (FAA)', 'SIA', 'Other']
  },
  'Logistics & Transport': {
    'coverage':       ['Local / London', 'UK-Wide', 'Europe', 'International'],
    'service':        ['Transport Only', 'Storage', 'On-Site Handling', 'Full Logistics'],
    'vehicle-type':   ['Van', '7.5t Truck', 'Artic / HGV', 'Specialist', 'N/A'],
    'crewed':         ['Driver Only', 'Crew Included'],
    'venue-approved': ['Yes', 'No']
  },
  'Entertainment': {
    'genre':    ['Pop', 'Jazz', 'Soul / Motown', 'Acoustic', 'Classical',
                 'Electronic / DJ', 'Folk', 'Function / Covers', 'N/A (non-musical)'],
    'act-size': ['Solo', 'Duo', 'Trio', 'Band (4+)', 'Troupe'],
    'format':   ['Stage / Set', 'Roaming / Walkabout', 'Interactive', 'Background / Ambient'],
    'audience': ['Corporate', 'Family-Friendly', 'Adult', 'All Ages'],
    'setting':  ['Indoor', 'Outdoor', 'Both']
  },
  'Photography': {
    'output':         ['Stills', 'Video', 'Both'],
    'turnaround':     ['Same-Day', 'Next-Day', '48 Hour', 'Standard (1 wk+)'],
    'style':          ['Documentary / Reportage', 'Editorial', 'Studio', 'Content / Social'],
    'crew':           ['Solo', 'Small Crew', 'Full Crew'],
    'usage-rights':   ['Full Buyout', 'Licensed', 'Social Only'],
    'drone-licensed': ['Yes', 'No']
  },
  'Event Accessories': {
    'supply-type': ['Hire', 'Purchase', 'Consumable'],
    'branded':     ['Yes', 'No', 'Customisable'],
    'colour':      ['White', 'Black', 'Neutral', 'Metallic', 'Bold / Colour', 'Clear'],
    'setting':     ['Indoor', 'Outdoor', 'Both']
  },
  'Venue': {
    'capacity':    ['Up to 50', 'Up to 150', 'Up to 300', 'Up to 500', '500–1,000', '1,000+'],
    'area':        ['Central London', 'East / City', 'West', 'North', 'South',
                    'Greater London', 'Outside London'],
    'catering':    ['In-House Only', 'Approved List', 'External Allowed'],
    'exclusivity': ['Exclusive Hire', 'Shared / Partial'],
    'space-type':  ['Blank Canvas', 'Furnished / Styled', 'Outdoor Space', 'Mixed'],
    'av-included': ['Yes', 'No']
  }
  // Other: no tag dimensions (internal line-items).
};

// ── Shared event-type dimension. 16 values, applied to all categories
//    EXCEPT Health & Safety, Logistics & Transport, and Other.
//    (FINAL_TAXONOMY_v2.md: Other has "Tags: none". The "13" figure in
//    the brief counted Other; flagged for review — 12 used here.)
const EVENT_TYPE_VALUES = [
  'Brand Activation', 'Product Launch', 'Exhibition / Trade Show', 'Conference',
  'AGM / Panel', 'Gala', 'Awards Ceremony', 'Corporate Party', 'Corporate Dining',
  'Drinks Reception', 'Press / Influencer Event', 'Pop-Up / Retail', 'Festival',
  'Premiere / Screening', 'Wedding', 'Summer Party'
];
const EVENT_TYPE_CATEGORIES = PARENTS.filter(
  p => !['Health & Safety', 'Logistics & Transport', 'Other'].includes(p)
);

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  const q = (sql, params) => pool.query(sql, params);
  const log = (...a) => console.log('  ', ...a);

  try {
    console.log(`\n=== Taxonomy v2 migration — schema: ${SCHEMA} ===`);

    // ── STEP 1 — schema: tag.dimension + new unique constraint ──────────
    await q(`ALTER TABLE ${SCHEMA}.tag ADD COLUMN IF NOT EXISTS dimension VARCHAR(50)`);
    // Old uniqueness was (category_id,label); with dimensions, values like
    // "Both"/"Yes" recur across dimensions. Move to (category_id,dimension,label).
    await q(`ALTER TABLE ${SCHEMA}.tag DROP CONSTRAINT IF EXISTS tag_category_id_label_key`);
    await q(`DROP INDEX IF EXISTS ${SCHEMA}.${SCHEMA}_tag_category_id_label_key`);
    await q(`DROP INDEX IF EXISTS ${SCHEMA}.tag_category_id_label_key`);
    await q(`CREATE UNIQUE INDEX IF NOT EXISTS ${SCHEMA}_tag_cat_dim_label_key
             ON ${SCHEMA}.tag (category_id, dimension, label)`);
    log('Step 1: tag.dimension column + UNIQUE(category_id,dimension,label).');

    // ── STEP 2 — rename Catering & Hospitality → Catering ───────────────
    await q(`UPDATE ${SCHEMA}.categories SET name='Catering'
             WHERE name='Catering & Hospitality' AND parent_id IS NULL`);
    log('Step 2: "Catering & Hospitality" → "Catering" (if present).');

    // ── Resolve parent ids ──────────────────────────────────────────────
    const parentRows = await q(
      `SELECT id, name FROM ${SCHEMA}.categories
        WHERE parent_id IS NULL AND namespace='catalogue' AND name = ANY($1)`,
      [PARENTS]
    );
    const parentId = {};
    parentRows.rows.forEach(r => { parentId[r.name] = r.id; });
    const missing = PARENTS.filter(p => !parentId[p]);
    if (missing.length) throw new Error('Missing parent categories: ' + missing.join(', '));
    const standStructureId = parentId['Stand Structure'];

    // ── IDEMPOTENCY GUARD ───────────────────────────────────────────────
    // The destructive rebuild (steps 3-6) runs only while the old
    // taxonomy is still present. Detected by the retired "Construction &
    // Build" parent. After migration, a re-run skips to the tag reseed
    // and will NOT wipe items.subcategory_id set by Part 3.
    const retired = await q(
      `SELECT id, name FROM ${SCHEMA}.categories
        WHERE parent_id IS NULL AND name IN ('Construction & Build','Flooring','Set Build')`
    );
    const firstRun = retired.rows.length > 0;

    if (firstRun) {
      const retiredIds = retired.rows.map(r => r.id);

      // STEP 3 — re-point items + project_categories off retiring parents.
      const movedItems = await q(
        `UPDATE ${SCHEMA}.items SET category_id=$1, subcategory_id=NULL
          WHERE category_id = ANY($2)`,
        [standStructureId, retiredIds]
      );
      const movedPC = await q(
        `UPDATE ${SCHEMA}.project_categories SET category_id=$1
          WHERE category_id = ANY($2)`,
        [standStructureId, retiredIds]
      );
      log(`Step 3: re-pointed ${movedItems.rowCount} items + ${movedPC.rowCount} project_categories off retiring parents → Stand Structure.`);

      // STEP 4 — NULL all remaining subcategory_id (old child tree dies).
      const cleared = await q(
        `UPDATE ${SCHEMA}.items SET subcategory_id=NULL WHERE subcategory_id IS NOT NULL`
      );
      log(`Step 4: cleared subcategory_id on ${cleared.rowCount} items.`);

      // STEP 5 — delete all child categories, then the 3 retired parents.
      const delChildren = await q(
        `DELETE FROM ${SCHEMA}.categories WHERE parent_id IS NOT NULL AND namespace='catalogue'`
      );
      const delParents = await q(
        `DELETE FROM ${SCHEMA}.categories WHERE id = ANY($1)`,
        [retiredIds]
      );
      log(`Step 5: deleted ${delChildren.rowCount} old children + ${delParents.rowCount} retired parents.`);
    } else {
      log('Steps 3-5: skipped — taxonomy already migrated (no retired parents).');
    }

    // ── STEP 6 — insert the 131 v2 subcategories ────────────────────────
    let childCount = 0;
    for (const [parent, subs] of Object.entries(SUBCATS)) {
      const pid = parentId[parent];
      for (let i = 0; i < subs.length; i++) {
        const r = await q(
          `INSERT INTO ${SCHEMA}.categories (name, parent_id, sort_order, namespace, icon, icon_name)
           SELECT $1::varchar, $2::uuid, $3::int, 'catalogue', NULL, NULL
            WHERE NOT EXISTS (
              SELECT 1 FROM ${SCHEMA}.categories
               WHERE name = $1::varchar AND parent_id = $2::uuid
            )`,
          [subs[i], pid, i + 1]
        );
        childCount += r.rowCount;
      }
    }
    log(`Step 6: inserted ${childCount} subcategories (131 expected on first run).`);

    // ── STEP 7 — wipe + reseed the tag table ────────────────────────────
    await q(`DELETE FROM ${SCHEMA}.tag`);
    let tagRows = 0, evtRows = 0;

    for (const [parent, dims] of Object.entries(DIMENSIONS)) {
      const pid = parentId[parent];
      for (const [dim, values] of Object.entries(dims)) {
        for (let i = 0; i < values.length; i++) {
          await q(
            `INSERT INTO ${SCHEMA}.tag (category_id, dimension, label, sort_order)
             VALUES ($1,$2,$3,$4)`,
            [pid, dim, values[i], i + 1]
          );
          tagRows++;
        }
      }
    }
    // Shared event-type — one copy per applicable category (Option A:
    // duplication keeps trg_check_item_tag_category satisfied).
    for (const cat of EVENT_TYPE_CATEGORIES) {
      const pid = parentId[cat];
      for (let i = 0; i < EVENT_TYPE_VALUES.length; i++) {
        await q(
          `INSERT INTO ${SCHEMA}.tag (category_id, dimension, label, sort_order)
           VALUES ($1,'event-type',$2,$3)`,
          [pid, EVENT_TYPE_VALUES[i], i + 1]
        );
        evtRows++;
      }
    }
    log(`Step 7: seeded ${tagRows} category-specific tag values + ${evtRows} event-type values (${EVENT_TYPE_CATEGORIES.length} categories × ${EVENT_TYPE_VALUES.length}).`);

    // ── Verification ────────────────────────────────────────────────────
    const vp = await q(`SELECT COUNT(*)::int n FROM ${SCHEMA}.categories WHERE parent_id IS NULL AND namespace='catalogue'`);
    const vc = await q(`SELECT COUNT(*)::int n FROM ${SCHEMA}.categories WHERE parent_id IS NOT NULL AND namespace='catalogue'`);
    const vt = await q(`SELECT COUNT(*)::int n FROM ${SCHEMA}.tag`);
    const vd = await q(`SELECT COUNT(DISTINCT dimension)::int n FROM ${SCHEMA}.tag`);
    console.log('\n  --- Verification ---');
    console.log(`  parent categories:  ${vp.rows[0].n}  (expect 15)`);
    console.log(`  child categories:   ${vc.rows[0].n}  (expect 131)`);
    console.log(`  tag rows:           ${vt.rows[0].n}`);
    console.log(`  distinct dimensions:${vd.rows[0].n}`);
    console.log(`\n✅ Taxonomy v2 migration complete on ${SCHEMA}.\n`);
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
