-- =============================================================
-- Ballpark — Category & Tag Seed Data
-- Description: 16 categories + ~80 scoped tags
-- Run after: migration_category_tags.sql
-- Safe to re-run: uses INSERT ... ON CONFLICT DO NOTHING
-- =============================================================

-- -------------------------------------------------------------
-- CATEGORIES
-- (Upsert in case categories table already has rows)
-- -------------------------------------------------------------

insert into category (id, label, icon, bg_colour, sort_order, active) values
  ('venue',         'Venue',               '🏛️', '#EDE9FE', 1,  true),
  ('structure',     'Stand structure',     '🏗️', '#FEF3C7', 2,  true),
  ('setbuild',      'Set build',           '🎬', '#FEF3C7', 3,  true),
  ('flooring',      'Flooring',            '🪵', '#F3F4F6', 4,  true),
  ('lighting',      'Lighting',            '💡', '#FEF3C7', 5,  true),
  ('av',            'AV & screens',        '📺', '#DBEAFE', 6,  true),
  ('furniture',     'Furniture',           '🪑', '#D1FAE5', 7,  true),
  ('catering',      'Catering',            '🍽️', '#FEF3C7', 8,  true),
  ('floral',        'Florals',             '🌸', '#FCE7F3', 9,  true),
  ('security',      'Security',            '🔒', '#F3F4F6', 10, true),
  ('permits',       'Permits & logistics', '📋', '#F3F4F6', 11, true),
  ('entertainment', 'Entertainment',       '🎤', '#FEF3C7', 12, true),
  ('talent',        'Talent & staffing',   '⭐', '#D1FAE5', 13, true),
  ('accessories',   'Event accessories',   '🎪', '#F3F4F6', 14, true),
  ('graphics',      'Graphics & print',    '🖼️', '#FCE7F3', 15, true),
  ('other',         'Other',               '📦', '#F3F4F6', 16, true)
on conflict (id) do update set
  label      = excluded.label,
  icon       = excluded.icon,
  bg_colour  = excluded.bg_colour,
  sort_order = excluded.sort_order;

-- -------------------------------------------------------------
-- TAGS
-- Inserted per category. ON CONFLICT skips duplicates safely.
-- -------------------------------------------------------------

-- 🏛️ VENUE
insert into tag (category_id, label, sort_order) values
  ('venue', 'Exhibition Halls',              1),
  ('venue', 'Hotels & Conference Centres',   2),
  ('venue', 'Unique / Unusual Spaces',       3),
  ('venue', 'Private Members Clubs',         4),
  ('venue', 'Outdoor & Marquee Sites',       5),
  ('venue', 'Cinemas & Theatres',            6)
on conflict (category_id, label) do nothing;

-- 🏗️ STAND STRUCTURE
insert into tag (category_id, label, sort_order) values
  ('structure', 'Shell Scheme',                1),
  ('structure', 'Modular System Build',        2),
  ('structure', 'Custom Bespoke Build',        3),
  ('structure', 'Entrance Arches & Gateways',  4),
  ('structure', 'Towers & Feature Elements',   5),
  ('structure', 'Outdoor Structures',          6)
on conflict (category_id, label) do nothing;

-- 🎬 SET BUILD
insert into tag (category_id, label, sort_order) values
  ('setbuild', 'Stage & Podium',            1),
  ('setbuild', 'Scenic & Set Dressing',     2),
  ('setbuild', 'Wall & Surface Cladding',   3),
  ('setbuild', 'Feature Installations',     4),
  ('setbuild', 'Window & Retail Displays',  5)
on conflict (category_id, label) do nothing;

-- 🪵 FLOORING
insert into tag (category_id, label, sort_order) values
  ('flooring', 'Carpet',               1),
  ('flooring', 'Vinyl & LVT',          2),
  ('flooring', 'Raised Platform',      3),
  ('flooring', 'Artificial Grass',     4),
  ('flooring', 'Specialist Finishes',  5)
on conflict (category_id, label) do nothing;

-- 💡 LIGHTING
insert into tag (category_id, label, sort_order) values
  ('lighting', 'Wash & Ambient',          1),
  ('lighting', 'Spotlighting',            2),
  ('lighting', 'Moving Heads',            3),
  ('lighting', 'Neon & Signage Lighting', 4),
  ('lighting', 'Festoon & Decorative',    5),
  ('lighting', 'Rigging & Trussing',      6)
on conflict (category_id, label) do nothing;

-- 📺 AV & SCREENS
insert into tag (category_id, label, sort_order) values
  ('av', 'PA & Sound System',       1),
  ('av', 'Microphones',             2),
  ('av', 'Mixing & Playback',       3),
  ('av', 'LED Wall & Screens',      4),
  ('av', 'TV & Monitors',           5),
  ('av', 'Projection',              6),
  ('av', 'Streaming & Recording',   7),
  ('av', 'Control & Infrastructure',8)
on conflict (category_id, label) do nothing;

-- 🪑 FURNITURE
insert into tag (category_id, label, sort_order) values
  ('furniture', 'Seating',                 1),
  ('furniture', 'Tables',                  2),
  ('furniture', 'Bar & Counter Units',     3),
  ('furniture', 'Shelving & Display Units',4),
  ('furniture', 'Outdoor Furniture',       5),
  ('furniture', 'Lounge & Breakout Sets',  6)
on conflict (category_id, label) do nothing;

-- 🍽️ CATERING
insert into tag (category_id, label, sort_order) values
  ('catering', 'Catering Company / Chef',    1),
  ('catering', 'Drinks & Mixology',          2),
  ('catering', 'Coffee & Hot Drinks',        3),
  ('catering', 'Afternoon Tea & Canapés',    4),
  ('catering', 'Catering Equipment Hire',    5),
  ('catering', 'Staffing (F&B)',             6)
on conflict (category_id, label) do nothing;

-- 🌸 FLORALS
insert into tag (category_id, label, sort_order) values
  ('floral', 'Table Centrepieces',           1),
  ('floral', 'Entrance & Arch Florals',      2),
  ('floral', 'Hanging Installations',        3),
  ('floral', 'Potted Plants & Greenery',     4),
  ('floral', 'Dried & Artificial Botanicals',5)
on conflict (category_id, label) do nothing;

-- 🔒 SECURITY
insert into tag (category_id, label, sort_order) values
  ('security', 'Door & Access Control',  1),
  ('security', 'Event Security',         2),
  ('security', 'CCTV & Monitoring',      3),
  ('security', 'Bag Search & Screening', 4)
on conflict (category_id, label) do nothing;

-- 📋 PERMITS & LOGISTICS
insert into tag (category_id, label, sort_order) values
  ('permits', 'Event Licences & Permits', 1),
  ('permits', 'Transport & Haulage',      2),
  ('permits', 'Waste Management',         3),
  ('permits', 'Storage',                  4),
  ('permits', 'Insurance',                5)
on conflict (category_id, label) do nothing;

-- 🎤 ENTERTAINMENT
insert into tag (category_id, label, sort_order) values
  ('entertainment', 'Live Music',               1),
  ('entertainment', 'DJs',                      2),
  ('entertainment', 'Speakers & Hosts',         3),
  ('entertainment', 'Performers & Acts',        4),
  ('entertainment', 'Interactive Experiences',  5)
on conflict (category_id, label) do nothing;

-- ⭐ TALENT & STAFFING
insert into tag (category_id, label, sort_order) values
  ('talent', 'Event Managers & Producers',      1),
  ('talent', 'Brand Ambassadors',               2),
  ('talent', 'Registration & Front of House',   3),
  ('talent', 'Models & Demonstrators',          4),
  ('talent', 'Interpreters & Translators',      5)
on conflict (category_id, label) do nothing;

-- 🎪 EVENT ACCESSORIES
insert into tag (category_id, label, sort_order) values
  ('accessories', 'Signage & Wayfinding',       1),
  ('accessories', 'Branded Merchandise & Gifts',2),
  ('accessories', 'Tableware & Dressing',       3),
  ('accessories', 'Barriers & Crowd Control',   4),
  ('accessories', 'Power & Generators',         5),
  ('accessories', 'Heating & Cooling',          6)
on conflict (category_id, label) do nothing;

-- 🖼️ GRAPHICS & PRINT
insert into tag (category_id, label, sort_order) values
  ('graphics', 'Large Format Print',          1),
  ('graphics', 'Step & Repeat',               2),
  ('graphics', 'Rigid Signage',               3),
  ('graphics', 'Wayfinding Print',            4),
  ('graphics', 'Branded Merchandise Print',   5),
  ('graphics', 'Digital & Screen Content',    6)
on conflict (category_id, label) do nothing;

-- 📦 OTHER — no tags (catch-all, admin-only)
