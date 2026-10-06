-- Rebuild migration 0009 — CATEGORIES SEED (marketplace taxonomy).
-- GENERATED from the v2 catalogue tree (namespace='catalogue', junk excluded),
-- ids + parent_id PRESERVED so items.category_id aligns. Two-phase: rows first
-- (parent-less), then parent links. Re-runnable (clears first).

delete from public.categories;

-- phase 1: rows (no parent yet)
insert into public.categories (id, ref, name, description, sort_order, icon_name, icon_color, tagline, org_id, status) values
  ('06927bcd-eb48-46b7-b1f6-bb1e8f352001', 'architectural-and-wash', 'Architectural & Wash', null, 1, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('f14499aa-f4d1-4ae0-9457-1686ad3e77d5', 'banners-and-flags', 'Banners & Flags', null, 1, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('12c1b6c4-57fa-4b92-94f3-3a4321bc50e8', 'event-manager-producer', 'Event Manager / Producer', null, 1, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('4e430952-a909-49ee-91fd-fb340e9505fd', 'event-photography', 'Event Photography', null, 1, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('24cbf03f-0e12-4f35-98c9-270128a83f66', 'exhibition-centre', 'Exhibition Centre', null, 1, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('d01d7661-7582-4443-abb5-f51ca678d23c', 'live-band-musician', 'Live Band / Musician', null, 1, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('bfe7052d-668c-40c4-b0f7-81ff453e30de', 'project-management-fee', 'Project Management Fee', null, 1, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('2f9b813e-0bcf-4865-8363-a1c7b192b0bd', 'red-carpet-rope-and-post', 'Red Carpet / Rope & Post', null, 1, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('dc859ae4-b377-4b7e-adf1-8d91623d0abd', 'risk-assessment-rams', 'Risk Assessment / RAMS', null, 1, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('b33d81be-ef99-48f2-b6a7-22c236e34db4', 'shell-scheme', 'Shell Scheme', null, 1, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('1a098468-1290-45ce-bcd7-b429903c3603', 'sound-and-pa', 'Sound & PA', null, 1, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('b3716efc-172a-47da-8bee-66792b65529d', 'table-centrepieces', 'Table Centrepieces', null, 1, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('cf436788-d6e6-488e-82ff-feb3a266d1cc', 'transport-and-delivery', 'Transport & Delivery', null, 1, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('70999efa-efa5-4b18-99d6-88d1ce2776de', 'venue', 'Venue', 'Spaces to hire — exhibition centres, hotels, museums, outdoor sites, warehouses, restaurants and unique venues.', 1, 'building-2', 'var(--theme-bg)', 'Where to host the event', '00000000-0000-0000-0000-000000000001', 'active'),
  ('9675aadc-8134-4f7a-b09d-1a08c36b4407', 'brand-ambassador', 'Brand Ambassador', null, 2, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('10489bf3-17c4-42d6-9489-838c1ced0fc6', 'custom-bespoke-build', 'Custom / Bespoke Build', null, 2, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('a4c6129e-5ef4-4568-abd6-956634521358', 'design-and-creative-fee', 'Design & Creative Fee', null, 2, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('38655bef-d44b-48a0-ba14-f52c9fb3c88d', 'dj', 'DJ', null, 2, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('0f797453-57a1-4369-b12f-7e3b4703ccfe', 'entrance-and-arch', 'Entrance & Arch', null, 2, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('98447598-f9bc-4c54-acd1-56a63cb2d7a3', 'gift-bags-welcome-packs', 'Gift Bags / Welcome Packs', null, 2, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('35d2f653-f1fe-42df-b562-4aec74fb82e2', 'hotel-conference', 'Hotel / Conference', null, 2, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('ba7f40f4-df12-4d9e-9d88-cff459a92289', 'led-walls-and-screens', 'LED Walls & Screens', null, 2, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('c750aa8a-2804-4e01-b15c-3790551ab23f', 'load-in-load-out-crew', 'Load-In / Load-Out Crew', null, 2, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('f12c0808-0c01-4de6-bbe5-b9b43d29dcc0', 'public-liability-insurance', 'Public Liability Insurance', null, 2, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('3fed9629-297a-41b8-a67d-158a239e64e8', 'signs-and-wayfinding', 'Signs & Wayfinding', null, 2, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('e39716aa-3420-4789-9764-7916d88b5c36', 'spot-and-feature', 'Spot & Feature', null, 2, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('ed00b389-d8a1-4609-acb3-cd5c71fb697a', 'stand-structure', 'Stand Structure', 'Exhibition stands, custom builds and the trades behind them — joinery, metalwork, scenic finishes, flooring and install.', 2, 'store', 'var(--theme-bg)', 'Stand tall', '00000000-0000-0000-0000-000000000001', 'active'),
  ('4d7be96c-b389-4e76-9dcb-5ecac9b6fca2', 'videography-and-film-crew', 'Videography & Film Crew', null, 2, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('a21b3493-cd1b-4a34-89dc-7cd3550e692b', 'contingency', 'Contingency', null, 3, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('9b7bd517-d999-4390-a092-a3c69d28f4e6', 'drone-aerial', 'Drone / Aerial', null, 3, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('d7334867-3d09-4985-9fb0-68e62d94719b', 'fire-safety-marshal', 'Fire Safety / Marshal', null, 3, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('d2a0e5b7-888d-476f-9a84-74bffdf0a919', 'florals', 'Florals', 'Event floristry and botanical installations — centrepieces, arches, hanging features, feature walls, greenery and bouquets.', 3, 'flower-2', 'var(--theme-bg)', 'Flower brighten the mood', '00000000-0000-0000-0000-000000000001', 'active'),
  ('ed0ab7f1-9ca9-4075-a767-f2fc1093e4d1', 'hanging-and-suspended-installations', 'Hanging & Suspended Installations', null, 3, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('5471dc02-e371-4042-91d3-a07d9c575246', 'lanyards-badges-wristbands', 'Lanyards / Badges / Wristbands', null, 3, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('a022be67-9ff8-45a0-9039-24de02b4e395', 'lighting', 'Lighting', 'Lighting design and fixtures — architectural wash, feature spots, uplighting, moving heads, festoon, neon and ambient effects.', 3, 'spotlight', 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('94faeb15-3f58-4f82-b3ac-391206220113', 'mc-host', 'MC / Host', null, 3, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('6339cdee-f9f6-43f5-a598-3850fda2b298', 'modular-reusable', 'Modular / Reusable', null, 3, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('197b9311-22f7-4cd4-a49b-2f7405ba6d0f', 'museum-gallery', 'Museum / Gallery', null, 3, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('8f0762d7-576a-46cf-a6b1-6ae578b25a5c', 'promotional-staff', 'Promotional Staff', null, 3, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('eaf26a42-93ab-4086-b7ef-773a7e94dad4', 'storage-and-warehousing', 'Storage & Warehousing', null, 3, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('9c5dd652-94e4-4a7a-9c06-e6cc26acc443', 'tvs-and-monitors', 'TVs & Monitors', null, 3, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('f112aaab-5b44-4452-a459-589138eb477b', 'uplighting', 'Uplighting', null, 3, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('017d1f5e-b8fe-4e32-99ab-349bb173df99', 'vinyl-and-wraps', 'Vinyl & Wraps', null, 3, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('96ac449f-4822-40ab-a7d0-1efa576141fa', 'av-and-technology', 'AV & Technology', 'Sound, screens and show technology — PA, LED walls, projection, interactive, streaming, connectivity, rigging and power.', 4, 'tv', 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('f15c7de9-4ca0-4864-ac55-7882e4febf6a', 'client-hospitality', 'Client Hospitality', null, 4, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('6224ed1a-6f21-4639-96d6-2ca1f2098712', 'comedian-speaker', 'Comedian / Speaker', null, 4, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('19d30e94-29a6-4f02-9f64-f1fc98068a5a', 'content-creation-social', 'Content Creation (Social)', null, 4, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('43f59236-1772-431a-8a19-7022073047db', 'double-decker-two-storey', 'Double-Decker / Two-Storey', null, 4, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('2fffc4ba-debf-4fe5-9d14-05bd18e75a57', 'first-aid-cover', 'First Aid Cover', null, 4, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('268a85c5-99d3-4148-85c0-dfee1756c95e', 'generator-temp-power', 'Generator / Temp Power', null, 4, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('5d094515-ffd1-4541-8002-df7f34f24acf', 'large-format-print', 'Large-Format Print', null, 4, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('2fe56f6b-88fd-4eab-97b0-05672ae22e7e', 'moving-head-intelligent', 'Moving Head / Intelligent', null, 4, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('d9e539a9-c934-4ffa-8fd2-0eeaa8f47f63', 'outdoor-park-garden', 'Outdoor / Park / Garden', null, 4, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('7eac4d49-1d65-42df-8a13-330ee22c6877', 'potted-plants-and-greenery', 'Potted Plants & Greenery', null, 4, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('72ebe456-197f-4110-9136-de51128d1bf0', 'projection-and-mapping', 'Projection & Mapping', null, 4, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('545eaf54-ca8f-4262-817d-f03cc2b87bdf', 'registration-front-of-house', 'Registration / Front of House', null, 4, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('d2423f1e-8cd0-4a24-b4b2-2f2c84786f74', 'crowd-management-barriers', 'Crowd Management / Barriers', null, 5, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('eb175801-136c-44fd-b38a-c368382dc361', 'displays-and-stands', 'Displays & Stands', null, 5, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('a37cd38b-1c83-4bcf-90b5-0cbf12a35e90', 'festoon-and-decorative', 'Festoon & Decorative', null, 5, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('20e5addc-dcc2-44ab-baf9-2ef4254fa168', 'floral-feature-walls', 'Floral Feature Walls', null, 5, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('530d0bcb-b74d-4064-ae26-61a730599899', 'furniture-and-fixtures', 'Furniture & Fixtures', 'Event furniture hire — seating, chairs, stools, benches, sofas, tables, bar and counter units, outdoor furniture, lounge sets, plinths, shelving and storage.', 5, 'table', 'var(--theme-bg)', 'Seating, tables and furniture for any event.', '00000000-0000-0000-0000-000000000001', 'active'),
  ('2c4424fa-f66e-4d22-a7aa-b2e8887d2be6', 'interactive-and-digital', 'Interactive & Digital', null, 5, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('1e8a272e-46e3-4bff-a168-3298701f8cbe', 'performance-act', 'Performance Act', null, 5, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('1ccec10f-3fc0-4aaa-9fd6-1ad11ade4e99', 'photo-booth', 'Photo Booth', null, 5, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('fe71ee23-5ffd-4a1e-8fed-71342e87dc4b', 'pop-up-activation', 'Pop-Up / Activation', null, 5, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('19475b12-9f68-48f7-a711-cc60b44b0b7c', 'travel-and-accommodation', 'Travel & Accommodation', null, 5, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('7c7e248c-8ef1-4dca-99be-89afe6fb284c', 'waiting-staff', 'Waiting Staff', null, 5, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('d88e8f0c-7d1b-44c3-a416-ecc9873a4d53', 'warehouse-industrial', 'Warehouse / Industrial', null, 5, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('9ede1018-6488-48f4-9895-3b6ae0acc146', 'water-and-plumbing', 'Water & Plumbing', null, 5, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('032375ed-457e-4664-89db-8f7e3fb03d96', '360-vr-immersive-capture', '360° / VR / Immersive Capture', null, 6, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('8daacaef-1b76-44a2-8ec3-616dee8c1750', 'bar-staff', 'Bar Staff', null, 6, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('93b39a9a-940e-4d27-af02-4d6fc225a73d', 'bouquets-and-handheld', 'Bouquets & Handheld', null, 6, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('99ea21cc-0dce-4de2-ac4f-0e5eb12904d6', 'branded-uniforms-workwear', 'Branded Uniforms / Workwear', null, 6, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('eff9d2a8-3428-40fd-8d91-684648257953', 'food-safety-hygiene', 'Food Safety / Hygiene', null, 6, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('30c6fe4c-82f3-4f7b-b800-ec477396ea66', 'graphics-and-signage', 'Graphics & Signage', 'Printed and branded materials — banners, wayfinding, vinyl, large-format print, portable displays, stationery and merchandise.', 6, 'message-square', 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('d8acb7db-d2ae-49c5-893c-c5564c10d66c', 'inflatables', 'Inflatables', null, 6, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('08304d29-4102-47db-96cd-478a74a5890b', 'interactive-experience', 'Interactive Experience', null, 6, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('28c2eb5f-9d65-4a7e-b9e5-172ba8608bfc', 'neon-and-led-effects', 'Neon & LED Effects', null, 6, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('0e3163a9-1d47-4ac0-851d-2b3b485b3123', 'print-and-stationery', 'Print & Stationery', null, 6, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('d16b81f7-61c8-4212-821d-3374ff19a67e', 'restaurant-bar', 'Restaurant / Bar', null, 6, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('7485b8bd-9e53-4941-aa9f-5ea6c0c08a85', 'site-survey-recce', 'Site Survey / Recce', null, 6, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('250440f5-b599-4c56-b245-666da1ea3c11', 'streaming-and-broadcast', 'Streaming & Broadcast', null, 6, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('e44e6b56-0d82-4188-888f-f40ff6c866b0', 'waste-management-recycling', 'Waste Management / Recycling', null, 6, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('a6a306c0-cc82-42ce-b308-e45d7e11666c', 'ambient-and-mood', 'Ambient & Mood', null, 7, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('41cc4fca-6fde-4ffa-8fa8-3d3370d36fc2', 'balloons-confetti-pyro', 'Balloons / Confetti / Pyro', null, 7, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('8c7848d5-4419-4004-b3a4-b5b1e6dd650c', 'catering', 'Catering', 'Food and drink — canapés, bowl food, buffets, street food, live stations, sampling, desserts, bars and coffee.', 7, 'utensils', 'var(--theme-bg)', 'Food, Drink and catering supplies', '00000000-0000-0000-0000-000000000001', 'active'),
  ('51bfc7b9-9b1b-494e-b8b9-1406e1d20e23', 'chefs-and-kitchen', 'Chefs & Kitchen', null, 7, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('12d54251-8f6e-4d94-a985-959b9eee5bf7', 'children-s-entertainment', 'Children''s Entertainment', null, 7, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('97c83f0b-5e5c-4636-a295-d345a63d91f3', 'connectivity-and-wifi', 'Connectivity & WiFi', null, 7, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('3fee21cc-9621-426d-b9db-fe80781007a4', 'freight-international', 'Freight / International', null, 7, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('51c80ecb-ec53-497c-840c-bd3d220da7da', 'miscellaneous', 'Miscellaneous', null, 7, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('c495f212-6781-4c87-8c76-fe8cf6ef5a7b', 'stage-platform', 'Stage / Platform', null, 7, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('7c1150ab-d529-44f5-83f3-74df72952715', 'stickers-and-labels', 'Stickers & Labels', null, 7, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('2d1c70f2-d9d2-46f1-8af7-7ad6e45f2fd8', 'structural-certification', 'Structural Certification', null, 7, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('93925b0b-cc57-4cf1-8247-5560e772d0b1', 'unique-non-traditional', 'Unique / Non-Traditional', null, 7, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('4ce6168b-e621-495d-b203-294c26b11c6b', 'branded-merchandise', 'Branded Merchandise', null, 8, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('77fb3e85-81d9-481c-9c6d-291d8c34f5dd', 'catering-supplies', 'Catering Supplies', 'Catering hire and supplies — glassware, crockery, cutlery, tableware, serveware, appliances, refrigeration and kitchen equipment for events.', 8, null, 'var(--theme-bg)', 'Everything to serve and dress the table.', '00000000-0000-0000-0000-000000000001', 'active'),
  ('bae5cabe-8a14-49b8-942a-f6fb98f2b06c', 'dbs-safeguarding', 'DBS / Safeguarding', null, 8, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('1952caad-ffae-4e07-9323-2506233e3902', 'festival-site-field', 'Festival Site / Field', null, 8, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('069efb78-c36b-44f1-8972-aefbbf733ccb', 'outdoor-and-tensile-structure', 'Outdoor & Tensile Structure', null, 8, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('a5c63756-3118-40c9-a484-6655e0734b4d', 'parking-traffic', 'Parking / Traffic', null, 8, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('4cd10f8c-5706-49a9-944c-a1214e8de7b3', 'rigging-and-power-distribution', 'Rigging & Power Distribution', null, 8, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('0246b663-5b3a-41b6-83fc-f2f2c9aceedf', 'roaming-ambient-acts', 'Roaming / Ambient Acts', null, 8, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('62f16752-4426-44a2-a810-3e42380cf38a', 'scent-aroma-design', 'Scent / Aroma Design', null, 8, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('d6e07634-4c1c-4bcd-9298-006802954fac', 'technical-crew', 'Technical Crew', null, 8, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('22fa1d46-02d8-4fc2-a929-28008883b5f9', 'flooring', 'Flooring', null, 9, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('ca5e1b53-f381-4a6e-8bfe-d7cab930aeea', 'health-and-safety', 'Health & Safety', 'Risk, compliance and safety services — RAMS, insurance, fire and first-aid cover, crowd management, certification and permits.', 9, 'circle-alert', 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('8f3ef82a-1b5c-44a6-aaa5-91f08baccb58', 'licensing-permits', 'Licensing / Permits', null, 9, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('630b0c39-0c9b-4c70-9e85-dcf1cb358738', 'retail-unit-pop-up-shop', 'Retail Unit / Pop-Up Shop', null, 9, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('54a77a47-0615-48fe-ad32-ac435a0f2408', 'runners-general-staff', 'Runners / General Staff', null, 9, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('bf6d0cee-6189-42e9-ad47-a4c9fb247cec', 'entertainment', 'Entertainment', 'Live performance and hosted experiences — bands, DJs, hosts, speakers, performers, interactive and roaming acts.', 10, 'music', 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('edd2c7de-e1fb-4f51-9c0b-f091426ee866', 'joinery-and-carpentry', 'Joinery & Carpentry', null, 10, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('52d65e32-c8c6-4830-a160-10d7e901c3ed', 'specialist-staff-dbs-first-aid-security', 'Specialist Staff (DBS, First Aid, Security)', null, 10, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('ea13d59f-8f96-4e16-88b2-c04daeb44821', 'studio-broadcast', 'Studio / Broadcast', null, 10, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('bb00afbf-4f1a-4d53-8c51-57a97c8868de', 'interpreter-multilingual', 'Interpreter / Multilingual', null, 11, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('728f4a6c-4efa-43de-9b31-2d1f4f6b73b9', 'logistics-and-transport', 'Logistics & Transport', 'Moving and supporting the event — transport, crew, storage, temporary power, water, waste, freight and traffic.', 11, 'car', 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('69dec4b0-aeb8-4538-aa94-510a8cb9f270', 'metalwork-and-fabrication', 'Metalwork & Fabrication', null, 11, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('dbd39023-a6bf-4fd7-ac4d-dba5d75d4b48', 'cnc-digital-fabrication', 'CNC / Digital Fabrication', null, 12, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('e6961d4c-3491-4d32-974f-da71dad72a1e', 'staffing', 'Staffing', 'Event crew and talent — producers, brand ambassadors, hospitality, technical crew, specialists and multilingual staff.', 12, 'user', 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('f921c151-07f4-4e5b-a915-72e0bd3e10ca', 'spray-and-paint-finish', 'Spray & Paint Finish', null, 13, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('350f59a2-7d33-4283-8658-e75fc3e608ea', 'other', 'Other', 'Agency line items — project management and design fees, contingency, client hospitality, travel and site surveys.', 14, 'circle-dashed', 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('a4cbfbd5-53a7-416f-acf5-1da4dcefe54b', 'photography', 'Photography', 'Capture and content — event photography, videography, drone, social content, photo booths and immersive capture.', 14, 'camera', 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('d9c5fe4a-a676-43ce-9aab-e589cbf8b853', 'scenic-painting', 'Scenic Painting', null, 14, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('ce4886be-3f4e-4ba4-becf-4d646d2ef39c', 'event-accessories', 'Event Accessories', 'The finishing touches — red carpet, gift bags, lanyards, linen, glassware hire, branded uniforms, pyro and scent.', 15, 'shopping-bag', 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('bda096c5-b8cf-4bcb-b9b8-1aabd5e3b871', 'set-dressing-and-theming', 'Set Dressing & Theming', null, 15, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('cac90a41-e269-43c6-8d42-9dbc86c82d9c', 'install-and-de-rig-labour', 'Install & De-rig Labour', null, 16, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('49f74b92-d25f-49ee-b372-97130604b307', 'styling-and-d-cor', 'Styling & Décor', 'Styling and décor hire — table linen, tablecloths, runners, napkins, overlays, cushions, centrepieces, vases, candles and decorative dressing.', 999, null, 'var(--theme-bg)', 'Dress the tables and style the space.', '00000000-0000-0000-0000-000000000001', 'active'),
  ('67bc55b7-d18a-4570-8136-c6961e0bdb2a', 'food-and-dining', 'Food & Dining', null, 1, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('8faf6fea-d270-4fe4-a256-09d3da461b4b', 'glassware', 'Glassware', 'Glasses, flutes, tumblers, wine glasses, champagne flutes, coupes, highballs, drinkware, reusable and polycarbonate glasses.', 1, null, 'var(--theme-bg)', 'Glasses and drinkware.', '00000000-0000-0000-0000-000000000001', 'active'),
  ('9a453c8a-849f-4218-ba76-546aa612eadd', 'seating', 'Seating', 'Seating, chairs, armchairs, bar stools, benches, sofas, tub chairs, Chiavari chairs, cross back chairs, Eames chairs, folding chairs and rattan sets.', 1, null, 'var(--theme-bg)', 'Chairs, stools and sofas.', '00000000-0000-0000-0000-000000000001', 'active'),
  ('cb98043c-e6fe-4a78-be40-44d98d45dd76', 'sit-down-dining', 'Sit-Down Dining', null, 1, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('4e603325-1534-4f4f-b625-bdd30b27a5a8', 'crockery', 'Crockery', 'Plates, bowls, saucers, dinnerware, china, charger plates, side plates and serving dishes.', 2, null, 'var(--theme-bg)', 'Plates, bowls and dinnerware.', '00000000-0000-0000-0000-000000000001', 'active'),
  ('71760b9f-5968-4519-b101-5f4b4c0507ac', 'drinks-and-bar', 'Drinks & Bar', null, 2, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('76b1b82c-b2b4-4af3-a39c-bcfe65e384d2', 'tables', 'Tables', 'Tables, coffee tables, poseur tables, round tables, trestle tables, dining and banqueting tables.', 2, null, 'var(--theme-bg)', 'Tables for dining and display.', '00000000-0000-0000-0000-000000000001', 'active'),
  ('04957f1a-01c2-4242-8dd6-97bd0444186d', 'cutlery', 'Cutlery', 'Knives, forks, spoons, cutlery, silverware, flatware, serving cutlery and steak knives.', 3, null, 'var(--theme-bg)', 'Knives, forks and spoons.', '00000000-0000-0000-0000-000000000001', 'active'),
  ('fce49cfe-ca60-4b22-98db-5ccb2e8733ca', 'dining-experiences', 'Dining Experiences', null, 3, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('23c7580c-126d-4087-81dc-6823c87f3c18', 'lounge-and-breakout', 'Lounge & Breakout', 'Lounge furniture, breakout seating, sofas, armchairs, coffee tables, soft seating, ottomans and poufs.', 3, null, 'var(--theme-bg)', 'Relaxed lounge seating.', '00000000-0000-0000-0000-000000000001', 'active'),
  ('9c3810f8-e494-46bc-abbd-91a473584c5e', 'bar-and-counter-units', 'Bar & Counter Units', 'Mobile bars, bar units, counters, back bars, serving counters and drinks stations.', 4, null, 'var(--theme-bg)', 'Bars and counters.', '00000000-0000-0000-0000-000000000001', 'active'),
  ('4f048aba-df94-41b3-89ac-09371a439b39', 'tableware', 'Tableware', 'Serving platters, trays, food display, presentation ware, table settings, non-slip trays and serveware.', 4, null, 'var(--theme-bg)', 'Serving and presentation pieces.', '00000000-0000-0000-0000-000000000001', 'active'),
  ('b7a3d2d6-af54-413d-9919-91dae1b442c6', 'plinths-and-pedestals', 'Plinths & Pedestals', 'Plinths, pedestals, display columns, product display stands and riser blocks.', 5, null, 'var(--theme-bg)', 'Display plinths and pedestals.', '00000000-0000-0000-0000-000000000001', 'active'),
  ('89c8576c-3d4e-4c08-b9f5-536c8569d3c3', 'table-dressing', 'Table Dressing', 'Table linen, tablecloths, table runners, napkins, overlays, poseur, round and trestle table linen, damask, jacquard and table dressing.', 5, null, 'var(--theme-bg)', 'Linen, cloths and table styling.', '00000000-0000-0000-0000-000000000001', 'active'),
  ('28796e4a-0d4b-4030-ab04-be73b24fe1c2', 'appliances', 'Appliances', 'Fridges, freezers, refrigeration, ovens, urns, water boilers, coffee machines and powered catering appliances.', 6, null, 'var(--theme-bg)', 'Powered catering appliances.', '00000000-0000-0000-0000-000000000001', 'active'),
  ('72f18874-a224-4226-a365-dc9e81cc7616', 'shelving-and-display-units', 'Shelving & Display Units', 'Shelving, display units, gondolas, display cabinets, retail shelving and bookcases.', 6, null, 'var(--theme-bg)', 'Shelving and display.', '00000000-0000-0000-0000-000000000001', 'active'),
  ('041d682c-8c2b-421d-8b88-c5c4e2211cbc', 'equipment', 'Equipment', 'Kitchen equipment, utensils, chafing dishes, food warmers, prep gear, kitchenware, serviceware and polycarbonates.', 7, null, 'var(--theme-bg)', 'Kitchen and prep equipment.', '00000000-0000-0000-0000-000000000001', 'active'),
  ('45f260ab-1d6a-465a-b0c1-6b75a2d583ab', 'reception-and-registration', 'Reception & Registration', 'Reception desks, registration counters, welcome desks, check-in furniture and sign-in stations.', 7, null, 'var(--theme-bg)', 'Reception and check-in furniture.', '00000000-0000-0000-0000-000000000001', 'active'),
  ('f8aeebf0-17cc-4a90-88aa-b1cb612f1d18', 'outdoor-furniture', 'Outdoor Furniture', 'Outdoor and garden furniture, gazebos, parasols, outdoor seating and outdoor tables.', 8, null, 'var(--theme-bg)', 'Furniture for outside.', '00000000-0000-0000-0000-000000000001', 'active'),
  ('253e9074-1945-4890-a633-b84b49c339f8', 'cushions', 'Cushions', 'Cushions, scatter cushions, seat pads, bolsters, throws and soft furnishings.', 999, null, 'var(--theme-bg)', 'Cushions and soft touches.', '00000000-0000-0000-0000-000000000001', 'active'),
  ('e92b75bc-4fa1-4b64-9163-a57911c26e5c', 'lecterns-and-podiums', 'Lecterns & Podiums', 'Lecterns, podiums, speaker stands, presentation stands and pulpits.', 999, null, 'var(--theme-bg)', 'Lecterns and podiums.', '00000000-0000-0000-0000-000000000001', 'active'),
  ('92351db7-ab35-4d8b-a928-6dff9952cec1', 'retail-fixtures', 'Retail Fixtures', 'Retail fixtures, clothing and garment rails, mannequins, slatwall, display tables and pop-up shop fittings.', 999, null, 'var(--theme-bg)', 'Retail and pop-up fixtures.', '00000000-0000-0000-0000-000000000001', 'active'),
  ('2ef33ca0-b4f4-4994-bf36-029ef749a111', 'screens', 'Screens', 'Screens, room dividers, partitions, freestanding and privacy screens.', 999, null, 'var(--theme-bg)', 'Screens and dividers.', '00000000-0000-0000-0000-000000000001', 'active'),
  ('e9c2541e-7bcf-4f41-88b4-fcff53599b71', 'storage-and-containers', 'Storage & Containers', 'Storage units, crates, trunks, boxes, containers, cabinets and lockable storage.', 999, null, 'var(--theme-bg)', 'Storage and containers.', '00000000-0000-0000-0000-000000000001', 'active'),
  ('0ca47353-a7d8-4555-980e-817ccf58a416', 'folding-chair', 'Folding Chair', null, 1, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('fe0d2ffe-0061-43c2-a025-8356440a8dbb', 'chiavari-chair', 'Chiavari Chair', null, 2, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('e4ac94bc-32bf-4a22-a29d-4f0e31a5d7d4', 'live-cooking-stations', 'Live Cooking Stations', null, 2, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('bd889a3f-a10f-461f-9eb5-5c0b8fa5566d', 'daytime-catering', 'Daytime Catering', null, 4, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('357a3395-991c-4f93-aac9-324f5874cf5a', 'buffet-and-grazing', 'Buffet & Grazing', null, 5, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('97e9bb83-6a1a-4f7c-9954-1ca4dbe46653', 'canap-s-and-reception', 'Canapés & Reception', null, 6, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('5d1aa012-2c42-4aa5-ac29-73062f5669cc', 'bowl-food-and-sharing', 'Bowl Food & Sharing', null, 7, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('c47808bb-cf39-4a14-8c7f-9c52e94105c0', 'desserts-and-sweets', 'Desserts & Sweets', null, 8, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('6aedb953-4a08-4fcf-a110-8eee93d7502b', 'refrigeration', 'Refrigeration', 'Fridges, freezers, chillers, refrigeration units, cold storage, bottle coolers.', 10, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('6a162c57-3d43-4f24-af04-aba677f8b0b0', 'street-food-and-food-trucks', 'Street Food & Food Trucks', null, 21, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('38c9c3f0-61e1-4b02-af61-8e073228a5e5', 'product-sampling', 'Product Sampling', null, 23, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('ad16e4ff-59f2-49bf-8a7e-1719ccc9f586', 'bar-service', 'Bar Service', null, 31, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('61c2d284-8a06-4809-8aee-1ab097fd13de', 'coffee-and-hot-drinks', 'Coffee & Hot Drinks', null, 32, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('b0f629db-41f3-489c-9de9-6805c6e96a8e', 'armchairs', 'Armchairs', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('2f455251-7350-42cd-91a6-61695e341ee9', 'bar-stools', 'Bar Stools', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('fbe1ea31-fe4c-4bb8-89da-ced5e114afe8', 'benches', 'Benches', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('f28de6a0-b4ff-4116-b43d-be161af3c1b4', 'coffee-tables', 'Coffee Tables', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('cfacb8fa-ad72-4d39-9a53-0fe13275c3fc', 'cross-back-chair', 'Cross Back Chair', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('f275b388-5d01-4a87-a894-1383486f7865', 'damask-linen', 'Damask Linen', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('27c71f6a-27b2-4a5e-a7e8-6044189d445e', 'eames-chair', 'Eames Chair', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('ee71d4e1-488e-4350-9806-da1139b3e590', 'gazebos', 'Gazebos', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('1cf6af4d-1357-46e8-b4cd-9d7579ae988b', 'ice-chair', 'Ice Chair', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('8707ce5a-4bad-49ae-ba2c-b999826251ea', 'kitchenwares', 'Kitchenwares', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('94f23ea4-75a1-487a-b06c-afc0024fe8cf', 'napkins', 'Napkins', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('0c828fe3-51d2-4e73-9eec-6046ab5cb258', 'non-slip-trays', 'Non Slip Trays', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('ee68be24-54a1-48e7-aae2-d5a2db7d2d6a', 'polycarbonates', 'Polycarbonates', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('c11011c3-59b0-4230-94fa-916ad445fada', 'poseur-table-linen', 'Poseur Table Linen', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('b87a865d-59d9-4261-bff8-55d46c2f09b7', 'poseur-tables', 'Poseur Tables', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('b6d705f5-5026-4883-8c0b-faded78fde7f', 'rattan-sets', 'Rattan Sets', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('c4b9de5a-873c-4c4c-9e79-b7d2e15d6412', 'regency-jacquard-linen', 'Regency Jacquard Linen', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('9dd0db2c-5cdf-40ef-b8f3-60a1e8972874', 'rope-posts', 'Rope Posts', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('ba137379-2490-4890-9196-4e4dede5c74a', 'round-table-linen', 'Round Table Linen', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('e828b9b2-ea2e-4306-9208-7bb12438b6b6', 'round-tables', 'Round Tables', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('b76ff8e7-ee3a-42c7-91ae-1f15c2882e1e', 'servicewares', 'Servicewares', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('4c0fdae8-1ef8-4453-bb75-1079eaccbbe9', 'simplicity-wire-chairs', 'Simplicity Wire Chairs', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('68d37c16-4a79-45c6-8f43-401672479ac2', 'sofas', 'Sofas', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('681df868-e5c8-4368-bec4-9eeef292e960', 'table-overlays', 'Table Overlays', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('b7c193f2-28b8-4d62-b98b-31fd70885c54', 'table-runners', 'Table Runners', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('f3a07df9-d2c2-4a67-a193-908b060866ef', 'tensa-barriers', 'Tensa Barriers', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('57f49d6e-3416-4721-b9d1-cbe583ae072b', 'trestle-table-linen', 'Trestle Table Linen', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('1c60df99-289d-4940-bdfa-c32ce719fdee', 'trestle-tables', 'Trestle Tables', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active'),
  ('2370cbf8-aeef-4d99-a206-dfabe284d55c', 'tub-chair', 'Tub Chair', null, 999, null, 'var(--theme-bg)', null, '00000000-0000-0000-0000-000000000001', 'active');

-- phase 2: parent links
update public.categories set parent_id = 'a022be67-9ff8-45a0-9039-24de02b4e395' where id = '06927bcd-eb48-46b7-b1f6-bb1e8f352001';
update public.categories set parent_id = '30c6fe4c-82f3-4f7b-b800-ec477396ea66' where id = 'f14499aa-f4d1-4ae0-9457-1686ad3e77d5';
update public.categories set parent_id = 'e6961d4c-3491-4d32-974f-da71dad72a1e' where id = '12c1b6c4-57fa-4b92-94f3-3a4321bc50e8';
update public.categories set parent_id = 'a4cbfbd5-53a7-416f-acf5-1da4dcefe54b' where id = '4e430952-a909-49ee-91fd-fb340e9505fd';
update public.categories set parent_id = '70999efa-efa5-4b18-99d6-88d1ce2776de' where id = '24cbf03f-0e12-4f35-98c9-270128a83f66';
update public.categories set parent_id = 'bf6d0cee-6189-42e9-ad47-a4c9fb247cec' where id = 'd01d7661-7582-4443-abb5-f51ca678d23c';
update public.categories set parent_id = '350f59a2-7d33-4283-8658-e75fc3e608ea' where id = 'bfe7052d-668c-40c4-b0f7-81ff453e30de';
update public.categories set parent_id = 'ce4886be-3f4e-4ba4-becf-4d646d2ef39c' where id = '2f9b813e-0bcf-4865-8363-a1c7b192b0bd';
update public.categories set parent_id = 'ca5e1b53-f381-4a6e-8bfe-d7cab930aeea' where id = 'dc859ae4-b377-4b7e-adf1-8d91623d0abd';
update public.categories set parent_id = 'ed00b389-d8a1-4609-acb3-cd5c71fb697a' where id = 'b33d81be-ef99-48f2-b6a7-22c236e34db4';
update public.categories set parent_id = '96ac449f-4822-40ab-a7d0-1efa576141fa' where id = '1a098468-1290-45ce-bcd7-b429903c3603';
update public.categories set parent_id = 'd2a0e5b7-888d-476f-9a84-74bffdf0a919' where id = 'b3716efc-172a-47da-8bee-66792b65529d';
update public.categories set parent_id = '728f4a6c-4efa-43de-9b31-2d1f4f6b73b9' where id = 'cf436788-d6e6-488e-82ff-feb3a266d1cc';
update public.categories set parent_id = 'e6961d4c-3491-4d32-974f-da71dad72a1e' where id = '9675aadc-8134-4f7a-b09d-1a08c36b4407';
update public.categories set parent_id = 'ed00b389-d8a1-4609-acb3-cd5c71fb697a' where id = '10489bf3-17c4-42d6-9489-838c1ced0fc6';
update public.categories set parent_id = '350f59a2-7d33-4283-8658-e75fc3e608ea' where id = 'a4c6129e-5ef4-4568-abd6-956634521358';
update public.categories set parent_id = 'bf6d0cee-6189-42e9-ad47-a4c9fb247cec' where id = '38655bef-d44b-48a0-ba14-f52c9fb3c88d';
update public.categories set parent_id = 'd2a0e5b7-888d-476f-9a84-74bffdf0a919' where id = '0f797453-57a1-4369-b12f-7e3b4703ccfe';
update public.categories set parent_id = 'ce4886be-3f4e-4ba4-becf-4d646d2ef39c' where id = '98447598-f9bc-4c54-acd1-56a63cb2d7a3';
update public.categories set parent_id = '70999efa-efa5-4b18-99d6-88d1ce2776de' where id = '35d2f653-f1fe-42df-b562-4aec74fb82e2';
update public.categories set parent_id = '96ac449f-4822-40ab-a7d0-1efa576141fa' where id = 'ba7f40f4-df12-4d9e-9d88-cff459a92289';
update public.categories set parent_id = '728f4a6c-4efa-43de-9b31-2d1f4f6b73b9' where id = 'c750aa8a-2804-4e01-b15c-3790551ab23f';
update public.categories set parent_id = 'ca5e1b53-f381-4a6e-8bfe-d7cab930aeea' where id = 'f12c0808-0c01-4de6-bbe5-b9b43d29dcc0';
update public.categories set parent_id = '30c6fe4c-82f3-4f7b-b800-ec477396ea66' where id = '3fed9629-297a-41b8-a67d-158a239e64e8';
update public.categories set parent_id = 'a022be67-9ff8-45a0-9039-24de02b4e395' where id = 'e39716aa-3420-4789-9764-7916d88b5c36';
update public.categories set parent_id = 'a4cbfbd5-53a7-416f-acf5-1da4dcefe54b' where id = '4d7be96c-b389-4e76-9dcb-5ecac9b6fca2';
update public.categories set parent_id = '350f59a2-7d33-4283-8658-e75fc3e608ea' where id = 'a21b3493-cd1b-4a34-89dc-7cd3550e692b';
update public.categories set parent_id = 'a4cbfbd5-53a7-416f-acf5-1da4dcefe54b' where id = '9b7bd517-d999-4390-a092-a3c69d28f4e6';
update public.categories set parent_id = 'ca5e1b53-f381-4a6e-8bfe-d7cab930aeea' where id = 'd7334867-3d09-4985-9fb0-68e62d94719b';
update public.categories set parent_id = 'd2a0e5b7-888d-476f-9a84-74bffdf0a919' where id = 'ed0ab7f1-9ca9-4075-a767-f2fc1093e4d1';
update public.categories set parent_id = 'ce4886be-3f4e-4ba4-becf-4d646d2ef39c' where id = '5471dc02-e371-4042-91d3-a07d9c575246';
update public.categories set parent_id = 'bf6d0cee-6189-42e9-ad47-a4c9fb247cec' where id = '94faeb15-3f58-4f82-b3ac-391206220113';
update public.categories set parent_id = 'ed00b389-d8a1-4609-acb3-cd5c71fb697a' where id = '6339cdee-f9f6-43f5-a598-3850fda2b298';
update public.categories set parent_id = '70999efa-efa5-4b18-99d6-88d1ce2776de' where id = '197b9311-22f7-4cd4-a49b-2f7405ba6d0f';
update public.categories set parent_id = 'e6961d4c-3491-4d32-974f-da71dad72a1e' where id = '8f0762d7-576a-46cf-a6b1-6ae578b25a5c';
update public.categories set parent_id = '728f4a6c-4efa-43de-9b31-2d1f4f6b73b9' where id = 'eaf26a42-93ab-4086-b7ef-773a7e94dad4';
update public.categories set parent_id = '96ac449f-4822-40ab-a7d0-1efa576141fa' where id = '9c5dd652-94e4-4a7a-9c06-e6cc26acc443';
update public.categories set parent_id = 'a022be67-9ff8-45a0-9039-24de02b4e395' where id = 'f112aaab-5b44-4452-a459-589138eb477b';
update public.categories set parent_id = '30c6fe4c-82f3-4f7b-b800-ec477396ea66' where id = '017d1f5e-b8fe-4e32-99ab-349bb173df99';
update public.categories set parent_id = '350f59a2-7d33-4283-8658-e75fc3e608ea' where id = 'f15c7de9-4ca0-4864-ac55-7882e4febf6a';
update public.categories set parent_id = 'bf6d0cee-6189-42e9-ad47-a4c9fb247cec' where id = '6224ed1a-6f21-4639-96d6-2ca1f2098712';
update public.categories set parent_id = 'a4cbfbd5-53a7-416f-acf5-1da4dcefe54b' where id = '19d30e94-29a6-4f02-9f64-f1fc98068a5a';
update public.categories set parent_id = 'ed00b389-d8a1-4609-acb3-cd5c71fb697a' where id = '43f59236-1772-431a-8a19-7022073047db';
update public.categories set parent_id = 'ca5e1b53-f381-4a6e-8bfe-d7cab930aeea' where id = '2fffc4ba-debf-4fe5-9d14-05bd18e75a57';
update public.categories set parent_id = '728f4a6c-4efa-43de-9b31-2d1f4f6b73b9' where id = '268a85c5-99d3-4148-85c0-dfee1756c95e';
update public.categories set parent_id = '30c6fe4c-82f3-4f7b-b800-ec477396ea66' where id = '5d094515-ffd1-4541-8002-df7f34f24acf';
update public.categories set parent_id = 'a022be67-9ff8-45a0-9039-24de02b4e395' where id = '2fe56f6b-88fd-4eab-97b0-05672ae22e7e';
update public.categories set parent_id = '70999efa-efa5-4b18-99d6-88d1ce2776de' where id = 'd9e539a9-c934-4ffa-8fd2-0eeaa8f47f63';
update public.categories set parent_id = 'd2a0e5b7-888d-476f-9a84-74bffdf0a919' where id = '7eac4d49-1d65-42df-8a13-330ee22c6877';
update public.categories set parent_id = '96ac449f-4822-40ab-a7d0-1efa576141fa' where id = '72ebe456-197f-4110-9136-de51128d1bf0';
update public.categories set parent_id = 'e6961d4c-3491-4d32-974f-da71dad72a1e' where id = '545eaf54-ca8f-4262-817d-f03cc2b87bdf';
update public.categories set parent_id = 'ca5e1b53-f381-4a6e-8bfe-d7cab930aeea' where id = 'd2423f1e-8cd0-4a24-b4b2-2f2c84786f74';
update public.categories set parent_id = '30c6fe4c-82f3-4f7b-b800-ec477396ea66' where id = 'eb175801-136c-44fd-b38a-c368382dc361';
update public.categories set parent_id = 'a022be67-9ff8-45a0-9039-24de02b4e395' where id = 'a37cd38b-1c83-4bcf-90b5-0cbf12a35e90';
update public.categories set parent_id = 'd2a0e5b7-888d-476f-9a84-74bffdf0a919' where id = '20e5addc-dcc2-44ab-baf9-2ef4254fa168';
update public.categories set parent_id = '96ac449f-4822-40ab-a7d0-1efa576141fa' where id = '2c4424fa-f66e-4d22-a7aa-b2e8887d2be6';
update public.categories set parent_id = 'bf6d0cee-6189-42e9-ad47-a4c9fb247cec' where id = '1e8a272e-46e3-4bff-a168-3298701f8cbe';
update public.categories set parent_id = 'a4cbfbd5-53a7-416f-acf5-1da4dcefe54b' where id = '1ccec10f-3fc0-4aaa-9fd6-1ad11ade4e99';
update public.categories set parent_id = 'ed00b389-d8a1-4609-acb3-cd5c71fb697a' where id = 'fe71ee23-5ffd-4a1e-8fed-71342e87dc4b';
update public.categories set parent_id = '350f59a2-7d33-4283-8658-e75fc3e608ea' where id = '19475b12-9f68-48f7-a711-cc60b44b0b7c';
update public.categories set parent_id = 'e6961d4c-3491-4d32-974f-da71dad72a1e' where id = '7c7e248c-8ef1-4dca-99be-89afe6fb284c';
update public.categories set parent_id = '70999efa-efa5-4b18-99d6-88d1ce2776de' where id = 'd88e8f0c-7d1b-44c3-a416-ecc9873a4d53';
update public.categories set parent_id = '728f4a6c-4efa-43de-9b31-2d1f4f6b73b9' where id = '9ede1018-6488-48f4-9895-3b6ae0acc146';
update public.categories set parent_id = 'a4cbfbd5-53a7-416f-acf5-1da4dcefe54b' where id = '032375ed-457e-4664-89db-8f7e3fb03d96';
update public.categories set parent_id = 'e6961d4c-3491-4d32-974f-da71dad72a1e' where id = '8daacaef-1b76-44a2-8ec3-616dee8c1750';
update public.categories set parent_id = 'd2a0e5b7-888d-476f-9a84-74bffdf0a919' where id = '93b39a9a-940e-4d27-af02-4d6fc225a73d';
update public.categories set parent_id = 'ce4886be-3f4e-4ba4-becf-4d646d2ef39c' where id = '99ea21cc-0dce-4de2-ac4f-0e5eb12904d6';
update public.categories set parent_id = 'ca5e1b53-f381-4a6e-8bfe-d7cab930aeea' where id = 'eff9d2a8-3428-40fd-8d91-684648257953';
update public.categories set parent_id = 'ed00b389-d8a1-4609-acb3-cd5c71fb697a' where id = 'd8acb7db-d2ae-49c5-893c-c5564c10d66c';
update public.categories set parent_id = 'bf6d0cee-6189-42e9-ad47-a4c9fb247cec' where id = '08304d29-4102-47db-96cd-478a74a5890b';
update public.categories set parent_id = 'a022be67-9ff8-45a0-9039-24de02b4e395' where id = '28c2eb5f-9d65-4a7e-b9e5-172ba8608bfc';
update public.categories set parent_id = '30c6fe4c-82f3-4f7b-b800-ec477396ea66' where id = '0e3163a9-1d47-4ac0-851d-2b3b485b3123';
update public.categories set parent_id = '70999efa-efa5-4b18-99d6-88d1ce2776de' where id = 'd16b81f7-61c8-4212-821d-3374ff19a67e';
update public.categories set parent_id = '350f59a2-7d33-4283-8658-e75fc3e608ea' where id = '7485b8bd-9e53-4941-aa9f-5ea6c0c08a85';
update public.categories set parent_id = '96ac449f-4822-40ab-a7d0-1efa576141fa' where id = '250440f5-b599-4c56-b245-666da1ea3c11';
update public.categories set parent_id = '728f4a6c-4efa-43de-9b31-2d1f4f6b73b9' where id = 'e44e6b56-0d82-4188-888f-f40ff6c866b0';
update public.categories set parent_id = 'a022be67-9ff8-45a0-9039-24de02b4e395' where id = 'a6a306c0-cc82-42ce-b308-e45d7e11666c';
update public.categories set parent_id = 'ce4886be-3f4e-4ba4-becf-4d646d2ef39c' where id = '41cc4fca-6fde-4ffa-8fa8-3d3370d36fc2';
update public.categories set parent_id = 'e6961d4c-3491-4d32-974f-da71dad72a1e' where id = '51bfc7b9-9b1b-494e-b8b9-1406e1d20e23';
update public.categories set parent_id = 'bf6d0cee-6189-42e9-ad47-a4c9fb247cec' where id = '12d54251-8f6e-4d94-a985-959b9eee5bf7';
update public.categories set parent_id = '96ac449f-4822-40ab-a7d0-1efa576141fa' where id = '97c83f0b-5e5c-4636-a295-d345a63d91f3';
update public.categories set parent_id = '728f4a6c-4efa-43de-9b31-2d1f4f6b73b9' where id = '3fee21cc-9621-426d-b9db-fe80781007a4';
update public.categories set parent_id = '350f59a2-7d33-4283-8658-e75fc3e608ea' where id = '51c80ecb-ec53-497c-840c-bd3d220da7da';
update public.categories set parent_id = 'ed00b389-d8a1-4609-acb3-cd5c71fb697a' where id = 'c495f212-6781-4c87-8c76-fe8cf6ef5a7b';
update public.categories set parent_id = '30c6fe4c-82f3-4f7b-b800-ec477396ea66' where id = '7c1150ab-d529-44f5-83f3-74df72952715';
update public.categories set parent_id = 'ca5e1b53-f381-4a6e-8bfe-d7cab930aeea' where id = '2d1c70f2-d9d2-46f1-8af7-7ad6e45f2fd8';
update public.categories set parent_id = '70999efa-efa5-4b18-99d6-88d1ce2776de' where id = '93925b0b-cc57-4cf1-8247-5560e772d0b1';
update public.categories set parent_id = '30c6fe4c-82f3-4f7b-b800-ec477396ea66' where id = '4ce6168b-e621-495d-b203-294c26b11c6b';
update public.categories set parent_id = 'ca5e1b53-f381-4a6e-8bfe-d7cab930aeea' where id = 'bae5cabe-8a14-49b8-942a-f6fb98f2b06c';
update public.categories set parent_id = '70999efa-efa5-4b18-99d6-88d1ce2776de' where id = '1952caad-ffae-4e07-9323-2506233e3902';
update public.categories set parent_id = 'ed00b389-d8a1-4609-acb3-cd5c71fb697a' where id = '069efb78-c36b-44f1-8972-aefbbf733ccb';
update public.categories set parent_id = '728f4a6c-4efa-43de-9b31-2d1f4f6b73b9' where id = 'a5c63756-3118-40c9-a484-6655e0734b4d';
update public.categories set parent_id = '96ac449f-4822-40ab-a7d0-1efa576141fa' where id = '4cd10f8c-5706-49a9-944c-a1214e8de7b3';
update public.categories set parent_id = 'bf6d0cee-6189-42e9-ad47-a4c9fb247cec' where id = '0246b663-5b3a-41b6-83fc-f2f2c9aceedf';
update public.categories set parent_id = 'ce4886be-3f4e-4ba4-becf-4d646d2ef39c' where id = '62f16752-4426-44a2-a810-3e42380cf38a';
update public.categories set parent_id = 'e6961d4c-3491-4d32-974f-da71dad72a1e' where id = 'd6e07634-4c1c-4bcd-9298-006802954fac';
update public.categories set parent_id = 'ed00b389-d8a1-4609-acb3-cd5c71fb697a' where id = '22fa1d46-02d8-4fc2-a929-28008883b5f9';
update public.categories set parent_id = 'ca5e1b53-f381-4a6e-8bfe-d7cab930aeea' where id = '8f3ef82a-1b5c-44a6-aaa5-91f08baccb58';
update public.categories set parent_id = '70999efa-efa5-4b18-99d6-88d1ce2776de' where id = '630b0c39-0c9b-4c70-9e85-dcf1cb358738';
update public.categories set parent_id = 'e6961d4c-3491-4d32-974f-da71dad72a1e' where id = '54a77a47-0615-48fe-ad32-ac435a0f2408';
update public.categories set parent_id = 'ed00b389-d8a1-4609-acb3-cd5c71fb697a' where id = 'edd2c7de-e1fb-4f51-9c0b-f091426ee866';
update public.categories set parent_id = 'e6961d4c-3491-4d32-974f-da71dad72a1e' where id = '52d65e32-c8c6-4830-a160-10d7e901c3ed';
update public.categories set parent_id = '70999efa-efa5-4b18-99d6-88d1ce2776de' where id = 'ea13d59f-8f96-4e16-88b2-c04daeb44821';
update public.categories set parent_id = 'e6961d4c-3491-4d32-974f-da71dad72a1e' where id = 'bb00afbf-4f1a-4d53-8c51-57a97c8868de';
update public.categories set parent_id = 'ed00b389-d8a1-4609-acb3-cd5c71fb697a' where id = '69dec4b0-aeb8-4538-aa94-510a8cb9f270';
update public.categories set parent_id = 'ed00b389-d8a1-4609-acb3-cd5c71fb697a' where id = 'dbd39023-a6bf-4fd7-ac4d-dba5d75d4b48';
update public.categories set parent_id = 'ed00b389-d8a1-4609-acb3-cd5c71fb697a' where id = 'f921c151-07f4-4e5b-a915-72e0bd3e10ca';
update public.categories set parent_id = 'ed00b389-d8a1-4609-acb3-cd5c71fb697a' where id = 'd9c5fe4a-a676-43ce-9aab-e589cbf8b853';
update public.categories set parent_id = 'ed00b389-d8a1-4609-acb3-cd5c71fb697a' where id = 'bda096c5-b8cf-4bcb-b9b8-1aabd5e3b871';
update public.categories set parent_id = 'ed00b389-d8a1-4609-acb3-cd5c71fb697a' where id = 'cac90a41-e269-43c6-8d42-9dbc86c82d9c';
update public.categories set parent_id = '8c7848d5-4419-4004-b3a4-b5b1e6dd650c' where id = '67bc55b7-d18a-4570-8136-c6961e0bdb2a';
update public.categories set parent_id = '77fb3e85-81d9-481c-9c6d-291d8c34f5dd' where id = '8faf6fea-d270-4fe4-a256-09d3da461b4b';
update public.categories set parent_id = '530d0bcb-b74d-4064-ae26-61a730599899' where id = '9a453c8a-849f-4218-ba76-546aa612eadd';
update public.categories set parent_id = '8c7848d5-4419-4004-b3a4-b5b1e6dd650c' where id = 'cb98043c-e6fe-4a78-be40-44d98d45dd76';
update public.categories set parent_id = '77fb3e85-81d9-481c-9c6d-291d8c34f5dd' where id = '4e603325-1534-4f4f-b625-bdd30b27a5a8';
update public.categories set parent_id = '8c7848d5-4419-4004-b3a4-b5b1e6dd650c' where id = '71760b9f-5968-4519-b101-5f4b4c0507ac';
update public.categories set parent_id = '530d0bcb-b74d-4064-ae26-61a730599899' where id = '76b1b82c-b2b4-4af3-a39c-bcfe65e384d2';
update public.categories set parent_id = '77fb3e85-81d9-481c-9c6d-291d8c34f5dd' where id = '04957f1a-01c2-4242-8dd6-97bd0444186d';
update public.categories set parent_id = '8c7848d5-4419-4004-b3a4-b5b1e6dd650c' where id = 'fce49cfe-ca60-4b22-98db-5ccb2e8733ca';
update public.categories set parent_id = '530d0bcb-b74d-4064-ae26-61a730599899' where id = '23c7580c-126d-4087-81dc-6823c87f3c18';
update public.categories set parent_id = '530d0bcb-b74d-4064-ae26-61a730599899' where id = '9c3810f8-e494-46bc-abbd-91a473584c5e';
update public.categories set parent_id = '77fb3e85-81d9-481c-9c6d-291d8c34f5dd' where id = '4f048aba-df94-41b3-89ac-09371a439b39';
update public.categories set parent_id = '530d0bcb-b74d-4064-ae26-61a730599899' where id = 'b7a3d2d6-af54-413d-9919-91dae1b442c6';
update public.categories set parent_id = '49f74b92-d25f-49ee-b372-97130604b307' where id = '89c8576c-3d4e-4c08-b9f5-536c8569d3c3';
update public.categories set parent_id = '77fb3e85-81d9-481c-9c6d-291d8c34f5dd' where id = '28796e4a-0d4b-4030-ab04-be73b24fe1c2';
update public.categories set parent_id = '530d0bcb-b74d-4064-ae26-61a730599899' where id = '72f18874-a224-4226-a365-dc9e81cc7616';
update public.categories set parent_id = '77fb3e85-81d9-481c-9c6d-291d8c34f5dd' where id = '041d682c-8c2b-421d-8b88-c5c4e2211cbc';
update public.categories set parent_id = '530d0bcb-b74d-4064-ae26-61a730599899' where id = '45f260ab-1d6a-465a-b0c1-6b75a2d583ab';
update public.categories set parent_id = '530d0bcb-b74d-4064-ae26-61a730599899' where id = 'f8aeebf0-17cc-4a90-88aa-b1cb612f1d18';
update public.categories set parent_id = '49f74b92-d25f-49ee-b372-97130604b307' where id = '253e9074-1945-4890-a633-b84b49c339f8';
update public.categories set parent_id = '530d0bcb-b74d-4064-ae26-61a730599899' where id = 'e92b75bc-4fa1-4b64-9163-a57911c26e5c';
update public.categories set parent_id = '530d0bcb-b74d-4064-ae26-61a730599899' where id = '92351db7-ab35-4d8b-a928-6dff9952cec1';
update public.categories set parent_id = '530d0bcb-b74d-4064-ae26-61a730599899' where id = '2ef33ca0-b4f4-4994-bf36-029ef749a111';
update public.categories set parent_id = '530d0bcb-b74d-4064-ae26-61a730599899' where id = 'e9c2541e-7bcf-4f41-88b4-fcff53599b71';
update public.categories set parent_id = '9a453c8a-849f-4218-ba76-546aa612eadd' where id = '0ca47353-a7d8-4555-980e-817ccf58a416';
update public.categories set parent_id = '9a453c8a-849f-4218-ba76-546aa612eadd' where id = 'fe0d2ffe-0061-43c2-a025-8356440a8dbb';
update public.categories set parent_id = '67bc55b7-d18a-4570-8136-c6961e0bdb2a' where id = 'e4ac94bc-32bf-4a22-a29d-4f0e31a5d7d4';
update public.categories set parent_id = '67bc55b7-d18a-4570-8136-c6961e0bdb2a' where id = 'bd889a3f-a10f-461f-9eb5-5c0b8fa5566d';
update public.categories set parent_id = '67bc55b7-d18a-4570-8136-c6961e0bdb2a' where id = '357a3395-991c-4f93-aac9-324f5874cf5a';
update public.categories set parent_id = '67bc55b7-d18a-4570-8136-c6961e0bdb2a' where id = '97e9bb83-6a1a-4f7c-9954-1ca4dbe46653';
update public.categories set parent_id = '67bc55b7-d18a-4570-8136-c6961e0bdb2a' where id = '5d1aa012-2c42-4aa5-ac29-73062f5669cc';
update public.categories set parent_id = '67bc55b7-d18a-4570-8136-c6961e0bdb2a' where id = 'c47808bb-cf39-4a14-8c7f-9c52e94105c0';
update public.categories set parent_id = '28796e4a-0d4b-4030-ab04-be73b24fe1c2' where id = '6aedb953-4a08-4fcf-a110-8eee93d7502b';
update public.categories set parent_id = 'fce49cfe-ca60-4b22-98db-5ccb2e8733ca' where id = '6a162c57-3d43-4f24-af04-aba677f8b0b0';
update public.categories set parent_id = 'fce49cfe-ca60-4b22-98db-5ccb2e8733ca' where id = '38c9c3f0-61e1-4b02-af61-8e073228a5e5';
update public.categories set parent_id = '71760b9f-5968-4519-b101-5f4b4c0507ac' where id = 'ad16e4ff-59f2-49bf-8a7e-1719ccc9f586';
update public.categories set parent_id = '71760b9f-5968-4519-b101-5f4b4c0507ac' where id = '61c2d284-8a06-4809-8aee-1ab097fd13de';
update public.categories set parent_id = '9a453c8a-849f-4218-ba76-546aa612eadd' where id = 'b0f629db-41f3-489c-9de9-6805c6e96a8e';
update public.categories set parent_id = '9a453c8a-849f-4218-ba76-546aa612eadd' where id = '2f455251-7350-42cd-91a6-61695e341ee9';
update public.categories set parent_id = '9a453c8a-849f-4218-ba76-546aa612eadd' where id = 'fbe1ea31-fe4c-4bb8-89da-ced5e114afe8';
update public.categories set parent_id = '76b1b82c-b2b4-4af3-a39c-bcfe65e384d2' where id = 'f28de6a0-b4ff-4116-b43d-be161af3c1b4';
update public.categories set parent_id = '9a453c8a-849f-4218-ba76-546aa612eadd' where id = 'cfacb8fa-ad72-4d39-9a53-0fe13275c3fc';
update public.categories set parent_id = '89c8576c-3d4e-4c08-b9f5-536c8569d3c3' where id = 'f275b388-5d01-4a87-a894-1383486f7865';
update public.categories set parent_id = '9a453c8a-849f-4218-ba76-546aa612eadd' where id = '27c71f6a-27b2-4a5e-a7e8-6044189d445e';
update public.categories set parent_id = 'f8aeebf0-17cc-4a90-88aa-b1cb612f1d18' where id = 'ee71d4e1-488e-4350-9806-da1139b3e590';
update public.categories set parent_id = '9a453c8a-849f-4218-ba76-546aa612eadd' where id = '1cf6af4d-1357-46e8-b4cd-9d7579ae988b';
update public.categories set parent_id = '041d682c-8c2b-421d-8b88-c5c4e2211cbc' where id = '8707ce5a-4bad-49ae-ba2c-b999826251ea';
update public.categories set parent_id = '89c8576c-3d4e-4c08-b9f5-536c8569d3c3' where id = '94f23ea4-75a1-487a-b06c-afc0024fe8cf';
update public.categories set parent_id = '4f048aba-df94-41b3-89ac-09371a439b39' where id = '0c828fe3-51d2-4e73-9eec-6046ab5cb258';
update public.categories set parent_id = '041d682c-8c2b-421d-8b88-c5c4e2211cbc' where id = 'ee68be24-54a1-48e7-aae2-d5a2db7d2d6a';
update public.categories set parent_id = '89c8576c-3d4e-4c08-b9f5-536c8569d3c3' where id = 'c11011c3-59b0-4230-94fa-916ad445fada';
update public.categories set parent_id = '76b1b82c-b2b4-4af3-a39c-bcfe65e384d2' where id = 'b87a865d-59d9-4261-bff8-55d46c2f09b7';
update public.categories set parent_id = '9a453c8a-849f-4218-ba76-546aa612eadd' where id = 'b6d705f5-5026-4883-8c0b-faded78fde7f';
update public.categories set parent_id = '89c8576c-3d4e-4c08-b9f5-536c8569d3c3' where id = 'c4b9de5a-873c-4c4c-9e79-b7d2e15d6412';
update public.categories set parent_id = '2f9b813e-0bcf-4865-8363-a1c7b192b0bd' where id = '9dd0db2c-5cdf-40ef-b8f3-60a1e8972874';
update public.categories set parent_id = '89c8576c-3d4e-4c08-b9f5-536c8569d3c3' where id = 'ba137379-2490-4890-9196-4e4dede5c74a';
update public.categories set parent_id = '76b1b82c-b2b4-4af3-a39c-bcfe65e384d2' where id = 'e828b9b2-ea2e-4306-9208-7bb12438b6b6';
update public.categories set parent_id = '041d682c-8c2b-421d-8b88-c5c4e2211cbc' where id = 'b76ff8e7-ee3a-42c7-91ae-1f15c2882e1e';
update public.categories set parent_id = '9a453c8a-849f-4218-ba76-546aa612eadd' where id = '4c0fdae8-1ef8-4453-bb75-1079eaccbbe9';
update public.categories set parent_id = '9a453c8a-849f-4218-ba76-546aa612eadd' where id = '68d37c16-4a79-45c6-8f43-401672479ac2';
update public.categories set parent_id = '89c8576c-3d4e-4c08-b9f5-536c8569d3c3' where id = '681df868-e5c8-4368-bec4-9eeef292e960';
update public.categories set parent_id = '89c8576c-3d4e-4c08-b9f5-536c8569d3c3' where id = 'b7c193f2-28b8-4d62-b98b-31fd70885c54';
update public.categories set parent_id = 'd2423f1e-8cd0-4a24-b4b2-2f2c84786f74' where id = 'f3a07df9-d2c2-4a67-a193-908b060866ef';
update public.categories set parent_id = '89c8576c-3d4e-4c08-b9f5-536c8569d3c3' where id = '57f49d6e-3416-4721-b9d1-cbe583ae072b';
update public.categories set parent_id = '76b1b82c-b2b4-4af3-a39c-bcfe65e384d2' where id = '1c60df99-289d-4940-bdfa-c32ce719fdee';
update public.categories set parent_id = '9a453c8a-849f-4218-ba76-546aa612eadd' where id = '2370cbf8-aeef-4d99-a206-dfabe284d55c';
