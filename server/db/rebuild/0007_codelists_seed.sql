-- Rebuild migration 0007 — CODELIST SEED (canonical reference data).
-- GENERATED from the v2 data + the CODELISTS.md design changes (merge tier,
-- event_type->project_type, retire item_time_unit, add document_status/
-- subscription_status/install_unit). The seed OWNS these tables — it clears
-- then inserts, so it is re-runnable and deterministic. system lists are
-- design-time + synced; ballpark lists are the starting set (curatable).

delete from public.reference_codelist_consumers;
delete from public.reference_codelist_values;
delete from public.reference_codelists;

-- tier (ballpark) — 11 values
insert into public.reference_codelists (name, type, family, default_code) values ('tier', 'ballpark', null, 'standard');
insert into public.reference_codelist_values (codelist_id, code, label, symbol, sort_order, is_active) values
  ((select id from public.reference_codelists where name='tier'), 'starter', 'Starter', null, 1, true),
  ((select id from public.reference_codelists where name='tier'), 'professional', 'Professional', null, 2, true),
  ((select id from public.reference_codelists where name='tier'), 'premium', 'Premium', null, 2, true),
  ((select id from public.reference_codelists where name='tier'), 'unknown', 'Unknown', null, 4, true),
  ((select id from public.reference_codelists where name='tier'), 'budget', 'Budget', null, 0, true),
  ((select id from public.reference_codelists where name='tier'), 'standard', 'Standard', null, 1, true),
  ((select id from public.reference_codelists where name='tier'), 'luxury', 'Luxury', null, 3, true),
  ((select id from public.reference_codelists where name='tier'), 'aim_for_the_moon', 'Aim for the Moon', null, 4, true),
  ((select id from public.reference_codelists where name='tier'), 'bronze', 'Bronze', null, 5, true),
  ((select id from public.reference_codelists where name='tier'), 'silver', 'Silver', null, 6, true),
  ((select id from public.reference_codelists where name='tier'), 'gold', 'Gold', null, 7, true);
insert into public.reference_codelist_consumers (codelist_id, consumer_table, consumer_column) values ((select id from public.reference_codelists where name='tier'), 'items', 'tier');
insert into public.reference_codelist_consumers (codelist_id, consumer_table, consumer_column) values ((select id from public.reference_codelists where name='tier'), 'projects', 'tier');

-- category_status (system, family=status) — 9 values
insert into public.reference_codelists (name, type, family, default_code) values ('category_status', 'system', 'status', 'draft');
insert into public.reference_codelist_values (codelist_id, code, label, symbol, sort_order, is_active) values
  ((select id from public.reference_codelists where name='category_status'), 'draft', 'Draft', null, 1, true),
  ((select id from public.reference_codelists where name='category_status'), 'briefed', 'Briefed', null, 2, true),
  ((select id from public.reference_codelists where name='category_status'), 'need_supplier', 'Need Supplier', null, 3, true),
  ((select id from public.reference_codelists where name='category_status'), 'out_for_quote', 'Out for Quote', null, 4, true),
  ((select id from public.reference_codelists where name='category_status'), 'quoted', 'Quoted', null, 5, true),
  ((select id from public.reference_codelists where name='category_status'), 'confirmed', 'Confirmed', null, 6, true),
  ((select id from public.reference_codelists where name='category_status'), 'awaiting', 'Awaiting Client', null, 7, true),
  ((select id from public.reference_codelists where name='category_status'), 'client_managed', 'Client Managed', null, 8, true),
  ((select id from public.reference_codelists where name='category_status'), 'na', 'N/A', null, 9, true);

-- country (system) — 249 values
insert into public.reference_codelists (name, type, family, default_code) values ('country', 'system', null, 'GB');
insert into public.reference_codelist_values (codelist_id, code, label, symbol, sort_order, is_active) values
  ((select id from public.reference_codelists where name='country'), 'AD', 'Andorra', null, 1, true),
  ((select id from public.reference_codelists where name='country'), 'AE', 'United Arab Emirates', null, 2, true),
  ((select id from public.reference_codelists where name='country'), 'AF', 'Afghanistan', null, 3, true),
  ((select id from public.reference_codelists where name='country'), 'AG', 'Antigua & Barbuda', null, 4, true),
  ((select id from public.reference_codelists where name='country'), 'AI', 'Anguilla', null, 5, true),
  ((select id from public.reference_codelists where name='country'), 'AL', 'Albania', null, 6, true),
  ((select id from public.reference_codelists where name='country'), 'AM', 'Armenia', null, 7, true),
  ((select id from public.reference_codelists where name='country'), 'AO', 'Angola', null, 8, true),
  ((select id from public.reference_codelists where name='country'), 'AQ', 'Antarctica', null, 9, true),
  ((select id from public.reference_codelists where name='country'), 'AR', 'Argentina', null, 10, true),
  ((select id from public.reference_codelists where name='country'), 'AS', 'American Samoa', null, 11, true),
  ((select id from public.reference_codelists where name='country'), 'AT', 'Austria', null, 12, true),
  ((select id from public.reference_codelists where name='country'), 'AU', 'Australia', null, 13, true),
  ((select id from public.reference_codelists where name='country'), 'AW', 'Aruba', null, 14, true),
  ((select id from public.reference_codelists where name='country'), 'AX', 'Åland Islands', null, 15, true),
  ((select id from public.reference_codelists where name='country'), 'AZ', 'Azerbaijan', null, 16, true),
  ((select id from public.reference_codelists where name='country'), 'BA', 'Bosnia & Herzegovina', null, 17, true),
  ((select id from public.reference_codelists where name='country'), 'BB', 'Barbados', null, 18, true),
  ((select id from public.reference_codelists where name='country'), 'BD', 'Bangladesh', null, 19, true),
  ((select id from public.reference_codelists where name='country'), 'BE', 'Belgium', null, 20, true),
  ((select id from public.reference_codelists where name='country'), 'BF', 'Burkina Faso', null, 21, true),
  ((select id from public.reference_codelists where name='country'), 'BG', 'Bulgaria', null, 22, true),
  ((select id from public.reference_codelists where name='country'), 'BH', 'Bahrain', null, 23, true),
  ((select id from public.reference_codelists where name='country'), 'BI', 'Burundi', null, 24, true),
  ((select id from public.reference_codelists where name='country'), 'BJ', 'Benin', null, 25, true),
  ((select id from public.reference_codelists where name='country'), 'BL', 'St. Barthélemy', null, 26, true),
  ((select id from public.reference_codelists where name='country'), 'BM', 'Bermuda', null, 27, true),
  ((select id from public.reference_codelists where name='country'), 'BN', 'Brunei', null, 28, true),
  ((select id from public.reference_codelists where name='country'), 'BO', 'Bolivia', null, 29, true),
  ((select id from public.reference_codelists where name='country'), 'BQ', 'Caribbean Netherlands', null, 30, true),
  ((select id from public.reference_codelists where name='country'), 'BR', 'Brazil', null, 31, true),
  ((select id from public.reference_codelists where name='country'), 'BS', 'Bahamas', null, 32, true),
  ((select id from public.reference_codelists where name='country'), 'BT', 'Bhutan', null, 33, true),
  ((select id from public.reference_codelists where name='country'), 'BV', 'Bouvet Island', null, 34, true),
  ((select id from public.reference_codelists where name='country'), 'BW', 'Botswana', null, 35, true),
  ((select id from public.reference_codelists where name='country'), 'BY', 'Belarus', null, 36, true),
  ((select id from public.reference_codelists where name='country'), 'BZ', 'Belize', null, 37, true),
  ((select id from public.reference_codelists where name='country'), 'CA', 'Canada', null, 38, true),
  ((select id from public.reference_codelists where name='country'), 'CC', 'Cocos (Keeling) Islands', null, 39, true),
  ((select id from public.reference_codelists where name='country'), 'CD', 'Congo - Kinshasa', null, 40, true),
  ((select id from public.reference_codelists where name='country'), 'CF', 'Central African Republic', null, 41, true),
  ((select id from public.reference_codelists where name='country'), 'CG', 'Congo - Brazzaville', null, 42, true),
  ((select id from public.reference_codelists where name='country'), 'CH', 'Switzerland', null, 43, true),
  ((select id from public.reference_codelists where name='country'), 'CI', 'Côte d’Ivoire', null, 44, true),
  ((select id from public.reference_codelists where name='country'), 'CK', 'Cook Islands', null, 45, true),
  ((select id from public.reference_codelists where name='country'), 'CL', 'Chile', null, 46, true),
  ((select id from public.reference_codelists where name='country'), 'CM', 'Cameroon', null, 47, true),
  ((select id from public.reference_codelists where name='country'), 'CN', 'China', null, 48, true),
  ((select id from public.reference_codelists where name='country'), 'CO', 'Colombia', null, 49, true),
  ((select id from public.reference_codelists where name='country'), 'CR', 'Costa Rica', null, 50, true),
  ((select id from public.reference_codelists where name='country'), 'CU', 'Cuba', null, 51, true),
  ((select id from public.reference_codelists where name='country'), 'CV', 'Cape Verde', null, 52, true),
  ((select id from public.reference_codelists where name='country'), 'CW', 'Curaçao', null, 53, true),
  ((select id from public.reference_codelists where name='country'), 'CX', 'Christmas Island', null, 54, true),
  ((select id from public.reference_codelists where name='country'), 'CY', 'Cyprus', null, 55, true),
  ((select id from public.reference_codelists where name='country'), 'CZ', 'Czechia', null, 56, true),
  ((select id from public.reference_codelists where name='country'), 'DE', 'Germany', null, 57, true),
  ((select id from public.reference_codelists where name='country'), 'DJ', 'Djibouti', null, 58, true),
  ((select id from public.reference_codelists where name='country'), 'DK', 'Denmark', null, 59, true),
  ((select id from public.reference_codelists where name='country'), 'DM', 'Dominica', null, 60, true),
  ((select id from public.reference_codelists where name='country'), 'DO', 'Dominican Republic', null, 61, true),
  ((select id from public.reference_codelists where name='country'), 'DZ', 'Algeria', null, 62, true),
  ((select id from public.reference_codelists where name='country'), 'EC', 'Ecuador', null, 63, true),
  ((select id from public.reference_codelists where name='country'), 'EE', 'Estonia', null, 64, true),
  ((select id from public.reference_codelists where name='country'), 'EG', 'Egypt', null, 65, true),
  ((select id from public.reference_codelists where name='country'), 'EH', 'Western Sahara', null, 66, true),
  ((select id from public.reference_codelists where name='country'), 'ER', 'Eritrea', null, 67, true),
  ((select id from public.reference_codelists where name='country'), 'ES', 'Spain', null, 68, true),
  ((select id from public.reference_codelists where name='country'), 'ET', 'Ethiopia', null, 69, true),
  ((select id from public.reference_codelists where name='country'), 'FI', 'Finland', null, 70, true),
  ((select id from public.reference_codelists where name='country'), 'FJ', 'Fiji', null, 71, true),
  ((select id from public.reference_codelists where name='country'), 'FK', 'Falkland Islands', null, 72, true),
  ((select id from public.reference_codelists where name='country'), 'FM', 'Micronesia', null, 73, true),
  ((select id from public.reference_codelists where name='country'), 'FO', 'Faroe Islands', null, 74, true),
  ((select id from public.reference_codelists where name='country'), 'FR', 'France', null, 75, true),
  ((select id from public.reference_codelists where name='country'), 'GA', 'Gabon', null, 76, true),
  ((select id from public.reference_codelists where name='country'), 'GB', 'United Kingdom', null, 77, true),
  ((select id from public.reference_codelists where name='country'), 'GD', 'Grenada', null, 78, true),
  ((select id from public.reference_codelists where name='country'), 'GE', 'Georgia', null, 79, true),
  ((select id from public.reference_codelists where name='country'), 'GF', 'French Guiana', null, 80, true),
  ((select id from public.reference_codelists where name='country'), 'GG', 'Guernsey', null, 81, true),
  ((select id from public.reference_codelists where name='country'), 'GH', 'Ghana', null, 82, true),
  ((select id from public.reference_codelists where name='country'), 'GI', 'Gibraltar', null, 83, true),
  ((select id from public.reference_codelists where name='country'), 'GL', 'Greenland', null, 84, true),
  ((select id from public.reference_codelists where name='country'), 'GM', 'Gambia', null, 85, true),
  ((select id from public.reference_codelists where name='country'), 'GN', 'Guinea', null, 86, true),
  ((select id from public.reference_codelists where name='country'), 'GP', 'Guadeloupe', null, 87, true),
  ((select id from public.reference_codelists where name='country'), 'GQ', 'Equatorial Guinea', null, 88, true),
  ((select id from public.reference_codelists where name='country'), 'GR', 'Greece', null, 89, true),
  ((select id from public.reference_codelists where name='country'), 'GS', 'South Georgia & South Sandwich Islands', null, 90, true),
  ((select id from public.reference_codelists where name='country'), 'GT', 'Guatemala', null, 91, true),
  ((select id from public.reference_codelists where name='country'), 'GU', 'Guam', null, 92, true),
  ((select id from public.reference_codelists where name='country'), 'GW', 'Guinea-Bissau', null, 93, true),
  ((select id from public.reference_codelists where name='country'), 'GY', 'Guyana', null, 94, true),
  ((select id from public.reference_codelists where name='country'), 'HK', 'Hong Kong SAR China', null, 95, true),
  ((select id from public.reference_codelists where name='country'), 'HM', 'Heard & McDonald Islands', null, 96, true),
  ((select id from public.reference_codelists where name='country'), 'HN', 'Honduras', null, 97, true),
  ((select id from public.reference_codelists where name='country'), 'HR', 'Croatia', null, 98, true),
  ((select id from public.reference_codelists where name='country'), 'HT', 'Haiti', null, 99, true),
  ((select id from public.reference_codelists where name='country'), 'HU', 'Hungary', null, 100, true),
  ((select id from public.reference_codelists where name='country'), 'ID', 'Indonesia', null, 101, true),
  ((select id from public.reference_codelists where name='country'), 'IE', 'Ireland', null, 102, true),
  ((select id from public.reference_codelists where name='country'), 'IL', 'Israel', null, 103, true),
  ((select id from public.reference_codelists where name='country'), 'IM', 'Isle of Man', null, 104, true),
  ((select id from public.reference_codelists where name='country'), 'IN', 'India', null, 105, true),
  ((select id from public.reference_codelists where name='country'), 'IO', 'British Indian Ocean Territory', null, 106, true),
  ((select id from public.reference_codelists where name='country'), 'IQ', 'Iraq', null, 107, true),
  ((select id from public.reference_codelists where name='country'), 'IR', 'Iran', null, 108, true),
  ((select id from public.reference_codelists where name='country'), 'IS', 'Iceland', null, 109, true),
  ((select id from public.reference_codelists where name='country'), 'IT', 'Italy', null, 110, true),
  ((select id from public.reference_codelists where name='country'), 'JE', 'Jersey', null, 111, true),
  ((select id from public.reference_codelists where name='country'), 'JM', 'Jamaica', null, 112, true),
  ((select id from public.reference_codelists where name='country'), 'JO', 'Jordan', null, 113, true),
  ((select id from public.reference_codelists where name='country'), 'JP', 'Japan', null, 114, true),
  ((select id from public.reference_codelists where name='country'), 'KE', 'Kenya', null, 115, true),
  ((select id from public.reference_codelists where name='country'), 'KG', 'Kyrgyzstan', null, 116, true),
  ((select id from public.reference_codelists where name='country'), 'KH', 'Cambodia', null, 117, true),
  ((select id from public.reference_codelists where name='country'), 'KI', 'Kiribati', null, 118, true),
  ((select id from public.reference_codelists where name='country'), 'KM', 'Comoros', null, 119, true),
  ((select id from public.reference_codelists where name='country'), 'KN', 'St. Kitts & Nevis', null, 120, true),
  ((select id from public.reference_codelists where name='country'), 'KP', 'North Korea', null, 121, true),
  ((select id from public.reference_codelists where name='country'), 'KR', 'South Korea', null, 122, true),
  ((select id from public.reference_codelists where name='country'), 'KW', 'Kuwait', null, 123, true),
  ((select id from public.reference_codelists where name='country'), 'KY', 'Cayman Islands', null, 124, true),
  ((select id from public.reference_codelists where name='country'), 'KZ', 'Kazakhstan', null, 125, true),
  ((select id from public.reference_codelists where name='country'), 'LA', 'Laos', null, 126, true),
  ((select id from public.reference_codelists where name='country'), 'LB', 'Lebanon', null, 127, true),
  ((select id from public.reference_codelists where name='country'), 'LC', 'St. Lucia', null, 128, true),
  ((select id from public.reference_codelists where name='country'), 'LI', 'Liechtenstein', null, 129, true),
  ((select id from public.reference_codelists where name='country'), 'LK', 'Sri Lanka', null, 130, true),
  ((select id from public.reference_codelists where name='country'), 'LR', 'Liberia', null, 131, true),
  ((select id from public.reference_codelists where name='country'), 'LS', 'Lesotho', null, 132, true),
  ((select id from public.reference_codelists where name='country'), 'LT', 'Lithuania', null, 133, true),
  ((select id from public.reference_codelists where name='country'), 'LU', 'Luxembourg', null, 134, true),
  ((select id from public.reference_codelists where name='country'), 'LV', 'Latvia', null, 135, true),
  ((select id from public.reference_codelists where name='country'), 'LY', 'Libya', null, 136, true),
  ((select id from public.reference_codelists where name='country'), 'MA', 'Morocco', null, 137, true),
  ((select id from public.reference_codelists where name='country'), 'MC', 'Monaco', null, 138, true),
  ((select id from public.reference_codelists where name='country'), 'MD', 'Moldova', null, 139, true),
  ((select id from public.reference_codelists where name='country'), 'ME', 'Montenegro', null, 140, true),
  ((select id from public.reference_codelists where name='country'), 'MF', 'St. Martin', null, 141, true),
  ((select id from public.reference_codelists where name='country'), 'MG', 'Madagascar', null, 142, true),
  ((select id from public.reference_codelists where name='country'), 'MH', 'Marshall Islands', null, 143, true),
  ((select id from public.reference_codelists where name='country'), 'MK', 'North Macedonia', null, 144, true),
  ((select id from public.reference_codelists where name='country'), 'ML', 'Mali', null, 145, true),
  ((select id from public.reference_codelists where name='country'), 'MM', 'Myanmar (Burma)', null, 146, true),
  ((select id from public.reference_codelists where name='country'), 'MN', 'Mongolia', null, 147, true),
  ((select id from public.reference_codelists where name='country'), 'MO', 'Macao SAR China', null, 148, true),
  ((select id from public.reference_codelists where name='country'), 'MP', 'Northern Mariana Islands', null, 149, true),
  ((select id from public.reference_codelists where name='country'), 'MQ', 'Martinique', null, 150, true),
  ((select id from public.reference_codelists where name='country'), 'MR', 'Mauritania', null, 151, true),
  ((select id from public.reference_codelists where name='country'), 'MS', 'Montserrat', null, 152, true),
  ((select id from public.reference_codelists where name='country'), 'MT', 'Malta', null, 153, true),
  ((select id from public.reference_codelists where name='country'), 'MU', 'Mauritius', null, 154, true),
  ((select id from public.reference_codelists where name='country'), 'MV', 'Maldives', null, 155, true),
  ((select id from public.reference_codelists where name='country'), 'MW', 'Malawi', null, 156, true),
  ((select id from public.reference_codelists where name='country'), 'MX', 'Mexico', null, 157, true),
  ((select id from public.reference_codelists where name='country'), 'MY', 'Malaysia', null, 158, true),
  ((select id from public.reference_codelists where name='country'), 'MZ', 'Mozambique', null, 159, true),
  ((select id from public.reference_codelists where name='country'), 'NA', 'Namibia', null, 160, true),
  ((select id from public.reference_codelists where name='country'), 'NC', 'New Caledonia', null, 161, true),
  ((select id from public.reference_codelists where name='country'), 'NE', 'Niger', null, 162, true),
  ((select id from public.reference_codelists where name='country'), 'NF', 'Norfolk Island', null, 163, true),
  ((select id from public.reference_codelists where name='country'), 'NG', 'Nigeria', null, 164, true),
  ((select id from public.reference_codelists where name='country'), 'NI', 'Nicaragua', null, 165, true),
  ((select id from public.reference_codelists where name='country'), 'NL', 'Netherlands', null, 166, true),
  ((select id from public.reference_codelists where name='country'), 'NO', 'Norway', null, 167, true),
  ((select id from public.reference_codelists where name='country'), 'NP', 'Nepal', null, 168, true),
  ((select id from public.reference_codelists where name='country'), 'NR', 'Nauru', null, 169, true),
  ((select id from public.reference_codelists where name='country'), 'NU', 'Niue', null, 170, true),
  ((select id from public.reference_codelists where name='country'), 'NZ', 'New Zealand', null, 171, true),
  ((select id from public.reference_codelists where name='country'), 'OM', 'Oman', null, 172, true),
  ((select id from public.reference_codelists where name='country'), 'PA', 'Panama', null, 173, true),
  ((select id from public.reference_codelists where name='country'), 'PE', 'Peru', null, 174, true),
  ((select id from public.reference_codelists where name='country'), 'PF', 'French Polynesia', null, 175, true),
  ((select id from public.reference_codelists where name='country'), 'PG', 'Papua New Guinea', null, 176, true),
  ((select id from public.reference_codelists where name='country'), 'PH', 'Philippines', null, 177, true),
  ((select id from public.reference_codelists where name='country'), 'PK', 'Pakistan', null, 178, true),
  ((select id from public.reference_codelists where name='country'), 'PL', 'Poland', null, 179, true),
  ((select id from public.reference_codelists where name='country'), 'PM', 'St. Pierre & Miquelon', null, 180, true),
  ((select id from public.reference_codelists where name='country'), 'PN', 'Pitcairn Islands', null, 181, true),
  ((select id from public.reference_codelists where name='country'), 'PR', 'Puerto Rico', null, 182, true),
  ((select id from public.reference_codelists where name='country'), 'PS', 'Palestinian Territories', null, 183, true),
  ((select id from public.reference_codelists where name='country'), 'PT', 'Portugal', null, 184, true),
  ((select id from public.reference_codelists where name='country'), 'PW', 'Palau', null, 185, true),
  ((select id from public.reference_codelists where name='country'), 'PY', 'Paraguay', null, 186, true),
  ((select id from public.reference_codelists where name='country'), 'QA', 'Qatar', null, 187, true),
  ((select id from public.reference_codelists where name='country'), 'RE', 'Réunion', null, 188, true),
  ((select id from public.reference_codelists where name='country'), 'RO', 'Romania', null, 189, true),
  ((select id from public.reference_codelists where name='country'), 'RS', 'Serbia', null, 190, true),
  ((select id from public.reference_codelists where name='country'), 'RU', 'Russia', null, 191, true),
  ((select id from public.reference_codelists where name='country'), 'RW', 'Rwanda', null, 192, true),
  ((select id from public.reference_codelists where name='country'), 'SA', 'Saudi Arabia', null, 193, true),
  ((select id from public.reference_codelists where name='country'), 'SB', 'Solomon Islands', null, 194, true),
  ((select id from public.reference_codelists where name='country'), 'SC', 'Seychelles', null, 195, true),
  ((select id from public.reference_codelists where name='country'), 'SD', 'Sudan', null, 196, true),
  ((select id from public.reference_codelists where name='country'), 'SE', 'Sweden', null, 197, true),
  ((select id from public.reference_codelists where name='country'), 'SG', 'Singapore', null, 198, true),
  ((select id from public.reference_codelists where name='country'), 'SH', 'St. Helena', null, 199, true),
  ((select id from public.reference_codelists where name='country'), 'SI', 'Slovenia', null, 200, true),
  ((select id from public.reference_codelists where name='country'), 'SJ', 'Svalbard & Jan Mayen', null, 201, true),
  ((select id from public.reference_codelists where name='country'), 'SK', 'Slovakia', null, 202, true),
  ((select id from public.reference_codelists where name='country'), 'SL', 'Sierra Leone', null, 203, true),
  ((select id from public.reference_codelists where name='country'), 'SM', 'San Marino', null, 204, true),
  ((select id from public.reference_codelists where name='country'), 'SN', 'Senegal', null, 205, true),
  ((select id from public.reference_codelists where name='country'), 'SO', 'Somalia', null, 206, true),
  ((select id from public.reference_codelists where name='country'), 'SR', 'Suriname', null, 207, true),
  ((select id from public.reference_codelists where name='country'), 'SS', 'South Sudan', null, 208, true),
  ((select id from public.reference_codelists where name='country'), 'ST', 'São Tomé & Príncipe', null, 209, true),
  ((select id from public.reference_codelists where name='country'), 'SV', 'El Salvador', null, 210, true),
  ((select id from public.reference_codelists where name='country'), 'SX', 'Sint Maarten', null, 211, true),
  ((select id from public.reference_codelists where name='country'), 'SY', 'Syria', null, 212, true),
  ((select id from public.reference_codelists where name='country'), 'SZ', 'Eswatini', null, 213, true),
  ((select id from public.reference_codelists where name='country'), 'TC', 'Turks & Caicos Islands', null, 214, true),
  ((select id from public.reference_codelists where name='country'), 'TD', 'Chad', null, 215, true),
  ((select id from public.reference_codelists where name='country'), 'TF', 'French Southern Territories', null, 216, true),
  ((select id from public.reference_codelists where name='country'), 'TG', 'Togo', null, 217, true),
  ((select id from public.reference_codelists where name='country'), 'TH', 'Thailand', null, 218, true),
  ((select id from public.reference_codelists where name='country'), 'TJ', 'Tajikistan', null, 219, true),
  ((select id from public.reference_codelists where name='country'), 'TK', 'Tokelau', null, 220, true),
  ((select id from public.reference_codelists where name='country'), 'TL', 'Timor-Leste', null, 221, true),
  ((select id from public.reference_codelists where name='country'), 'TM', 'Turkmenistan', null, 222, true),
  ((select id from public.reference_codelists where name='country'), 'TN', 'Tunisia', null, 223, true),
  ((select id from public.reference_codelists where name='country'), 'TO', 'Tonga', null, 224, true),
  ((select id from public.reference_codelists where name='country'), 'TR', 'Türkiye', null, 225, true),
  ((select id from public.reference_codelists where name='country'), 'TT', 'Trinidad & Tobago', null, 226, true),
  ((select id from public.reference_codelists where name='country'), 'TV', 'Tuvalu', null, 227, true),
  ((select id from public.reference_codelists where name='country'), 'TW', 'Taiwan', null, 228, true),
  ((select id from public.reference_codelists where name='country'), 'TZ', 'Tanzania', null, 229, true),
  ((select id from public.reference_codelists where name='country'), 'UA', 'Ukraine', null, 230, true),
  ((select id from public.reference_codelists where name='country'), 'UG', 'Uganda', null, 231, true),
  ((select id from public.reference_codelists where name='country'), 'UM', 'U.S. Outlying Islands', null, 232, true),
  ((select id from public.reference_codelists where name='country'), 'US', 'United States', null, 233, true),
  ((select id from public.reference_codelists where name='country'), 'UY', 'Uruguay', null, 234, true),
  ((select id from public.reference_codelists where name='country'), 'UZ', 'Uzbekistan', null, 235, true),
  ((select id from public.reference_codelists where name='country'), 'VA', 'Vatican City', null, 236, true),
  ((select id from public.reference_codelists where name='country'), 'VC', 'St. Vincent & Grenadines', null, 237, true),
  ((select id from public.reference_codelists where name='country'), 'VE', 'Venezuela', null, 238, true),
  ((select id from public.reference_codelists where name='country'), 'VG', 'British Virgin Islands', null, 239, true),
  ((select id from public.reference_codelists where name='country'), 'VI', 'U.S. Virgin Islands', null, 240, true),
  ((select id from public.reference_codelists where name='country'), 'VN', 'Vietnam', null, 241, true),
  ((select id from public.reference_codelists where name='country'), 'VU', 'Vanuatu', null, 242, true),
  ((select id from public.reference_codelists where name='country'), 'WF', 'Wallis & Futuna', null, 243, true),
  ((select id from public.reference_codelists where name='country'), 'WS', 'Samoa', null, 244, true),
  ((select id from public.reference_codelists where name='country'), 'YE', 'Yemen', null, 245, true),
  ((select id from public.reference_codelists where name='country'), 'YT', 'Mayotte', null, 246, true),
  ((select id from public.reference_codelists where name='country'), 'ZA', 'South Africa', null, 247, true),
  ((select id from public.reference_codelists where name='country'), 'ZM', 'Zambia', null, 248, true),
  ((select id from public.reference_codelists where name='country'), 'ZW', 'Zimbabwe', null, 249, true);
insert into public.reference_codelist_consumers (codelist_id, consumer_table, consumer_column) values ((select id from public.reference_codelists where name='country'), 'orgs', 'country');

-- currency (ballpark) — 10 values
insert into public.reference_codelists (name, type, family, default_code) values ('currency', 'ballpark', null, 'GBP');
insert into public.reference_codelist_values (codelist_id, code, label, symbol, sort_order, is_active) values
  ((select id from public.reference_codelists where name='currency'), 'GBP', 'GBP (£)', '£', 1, true),
  ((select id from public.reference_codelists where name='currency'), 'USD', 'USD ($)', '$', 2, true),
  ((select id from public.reference_codelists where name='currency'), 'EUR', 'EUR (€)', '€', 3, true),
  ((select id from public.reference_codelists where name='currency'), 'AED', 'AED (د.إ)', 'د.إ', 4, true),
  ((select id from public.reference_codelists where name='currency'), 'CHF', 'CHF (Fr)', 'Fr', 5, true),
  ((select id from public.reference_codelists where name='currency'), 'SEK', 'SEK (kr)', 'kr', 6, true),
  ((select id from public.reference_codelists where name='currency'), 'SGD', 'SGD (S$)', 'S$', 7, true),
  ((select id from public.reference_codelists where name='currency'), 'TST', 'TEST (*)', '*', 8, false),
  ((select id from public.reference_codelists where name='currency'), 'TST2', 'TEST (*)', '*', 9, false),
  ((select id from public.reference_codelists where name='currency'), 'TST3', 'Test (*)', '*', 10, false);
insert into public.reference_codelist_consumers (codelist_id, consumer_table, consumer_column) values ((select id from public.reference_codelists where name='currency'), 'orgs', 'default_currency');

-- decline_reason_post_agreement (system) — 5 values
insert into public.reference_codelists (name, type, family, default_code) values ('decline_reason_post_agreement', 'system', null, null);
insert into public.reference_codelist_values (codelist_id, code, label, symbol, sort_order, is_active) values
  ((select id from public.reference_codelists where name='decline_reason_post_agreement'), 'event_cancelled', 'Event cancelled', null, 1, true),
  ((select id from public.reference_codelists where name='decline_reason_post_agreement'), 'item_no_longer_available', 'Item no longer available', null, 2, true),
  ((select id from public.reference_codelists where name='decline_reason_post_agreement'), 'price_changed', 'Price has changed', null, 3, true),
  ((select id from public.reference_codelists where name='decline_reason_post_agreement'), 'client_changed_mind', 'Plans changed', null, 4, true),
  ((select id from public.reference_codelists where name='decline_reason_post_agreement'), 'other', 'Other', null, 5, true);

-- decline_reason_pre_agreement (system) — 6 values
insert into public.reference_codelists (name, type, family, default_code) values ('decline_reason_pre_agreement', 'system', null, null);
insert into public.reference_codelist_values (codelist_id, code, label, symbol, sort_order, is_active) values
  ((select id from public.reference_codelists where name='decline_reason_pre_agreement'), 'dates_unavailable', 'Dates don''t work', null, 1, true),
  ((select id from public.reference_codelists where name='decline_reason_pre_agreement'), 'item_unavailable', 'Item not available', null, 2, true),
  ((select id from public.reference_codelists where name='decline_reason_pre_agreement'), 'price_too_high', 'Price too high', null, 3, true),
  ((select id from public.reference_codelists where name='decline_reason_pre_agreement'), 'spec_mismatch', 'Doesn''t meet requirements', null, 4, true),
  ((select id from public.reference_codelists where name='decline_reason_pre_agreement'), 'out_of_scope', 'Outside our service area', null, 5, true),
  ((select id from public.reference_codelists where name='decline_reason_pre_agreement'), 'other', 'Other', null, 6, true);

-- project_type (ballpark) — 10 values
insert into public.reference_codelists (name, type, family, default_code) values ('project_type', 'ballpark', null, 'conference');
insert into public.reference_codelist_values (codelist_id, code, label, symbol, sort_order, is_active) values
  ((select id from public.reference_codelists where name='project_type'), 'conference', 'Conference', null, 1, true),
  ((select id from public.reference_codelists where name='project_type'), 'launch', 'Product launch', null, 2, true),
  ((select id from public.reference_codelists where name='project_type'), 'activation', 'Brand activation', null, 3, true),
  ((select id from public.reference_codelists where name='project_type'), 'exhibition', 'Exhibition', null, 4, true),
  ((select id from public.reference_codelists where name='project_type'), 'gala', 'Gala', null, 5, true),
  ((select id from public.reference_codelists where name='project_type'), 'awards', 'Awards', null, 6, true),
  ((select id from public.reference_codelists where name='project_type'), 'party', 'Party', null, 7, true),
  ((select id from public.reference_codelists where name='project_type'), 'pop-up', 'Pop-up', null, 8, true),
  ((select id from public.reference_codelists where name='project_type'), 'dinner', 'Dinner', null, 9, true),
  ((select id from public.reference_codelists where name='project_type'), 'other', 'Other', null, 10, true);
insert into public.reference_codelist_consumers (codelist_id, consumer_table, consumer_column) values ((select id from public.reference_codelists where name='project_type'), 'projects', 'project_type');

-- hero_align (system) — 2 values
insert into public.reference_codelists (name, type, family, default_code) values ('hero_align', 'system', null, 'center');
insert into public.reference_codelist_values (codelist_id, code, label, symbol, sort_order, is_active) values
  ((select id from public.reference_codelists where name='hero_align'), 'center', 'Center', null, 1, true),
  ((select id from public.reference_codelists where name='hero_align'), 'left', 'Left', null, 2, true);

-- item_approval_status (system, family=status) — 4 values
insert into public.reference_codelists (name, type, family, default_code) values ('item_approval_status', 'system', 'status', 'pending');
insert into public.reference_codelist_values (codelist_id, code, label, symbol, sort_order, is_active) values
  ((select id from public.reference_codelists where name='item_approval_status'), 'draft', 'Draft', null, 0, true),
  ((select id from public.reference_codelists where name='item_approval_status'), 'pending', 'Pending', null, 1, true),
  ((select id from public.reference_codelists where name='item_approval_status'), 'approved', 'Approved', null, 2, true),
  ((select id from public.reference_codelists where name='item_approval_status'), 'rejected', 'Rejected', null, 3, true);
insert into public.reference_codelist_consumers (codelist_id, consumer_table, consumer_column) values ((select id from public.reference_codelists where name='item_approval_status'), 'items', 'approval_status');

-- item_attribute (ballpark) — 1 values
insert into public.reference_codelists (name, type, family, default_code) values ('item_attribute', 'ballpark', null, null);
insert into public.reference_codelist_values (codelist_id, code, label, symbol, sort_order, is_active) values
  ((select id from public.reference_codelists where name='item_attribute'), 'size', 'Size', null, 1, true);

-- item_unit (ballpark, family=unit) — 25 values
insert into public.reference_codelists (name, type, family, default_code) values ('item_unit', 'ballpark', 'unit', 'each');
insert into public.reference_codelist_values (codelist_id, code, label, symbol, sort_order, is_active) values
  ((select id from public.reference_codelists where name='item_unit'), 'head', 'Head', null, 1, false),
  ((select id from public.reference_codelists where name='item_unit'), 'unit', 'Units', null, 1, false),
  ((select id from public.reference_codelists where name='item_unit'), 'cover', 'Covers', null, 2, false),
  ((select id from public.reference_codelists where name='item_unit'), 'day', 'Day', null, 2, false),
  ((select id from public.reference_codelists where name='item_unit'), 'event', 'Event', null, 3, false),
  ((select id from public.reference_codelists where name='item_unit'), 'hour', 'Hour', null, 4, false),
  ((select id from public.reference_codelists where name='item_unit'), 'each', 'Each', 'ea', 5, true),
  ((select id from public.reference_codelists where name='item_unit'), 'sqft', 'Square Feet', 'ft²', 5, false),
  ((select id from public.reference_codelists where name='item_unit'), 'linear_m', 'Linear Metres', 'm', 6, false),
  ((select id from public.reference_codelists where name='item_unit'), 'sqm', 'Square Metres', 'm²', 6, false),
  ((select id from public.reference_codelists where name='item_unit'), 'package', 'Package', null, 8, false),
  ((select id from public.reference_codelists where name='item_unit'), 'set', 'Set', null, 9, false),
  ((select id from public.reference_codelists where name='item_unit'), 'per_guest', 'Per Guest', null, 10, true),
  ((select id from public.reference_codelists where name='item_unit'), 'project', 'Project', null, 10, false),
  ((select id from public.reference_codelists where name='item_unit'), 'item', 'Item', null, 11, false),
  ((select id from public.reference_codelists where name='item_unit'), 'time', 'Time', null, 11, true),
  ((select id from public.reference_codelists where name='item_unit'), 'pair', 'Pair', null, 12, false),
  ((select id from public.reference_codelists where name='item_unit'), 'size', 'Size', null, 12, true),
  ((select id from public.reference_codelists where name='item_unit'), 'panel', 'Panel', null, 13, false),
  ((select id from public.reference_codelists where name='item_unit'), 'platter', 'Platter', null, 14, true),
  ((select id from public.reference_codelists where name='item_unit'), 'letter', 'Letter', null, 15, false),
  ((select id from public.reference_codelists where name='item_unit'), 'load', 'Load', null, 16, false),
  ((select id from public.reference_codelists where name='item_unit'), 'pallet', 'Pallet', null, 17, false),
  ((select id from public.reference_codelists where name='item_unit'), 'cbm', 'Cubic Metres', 'm³', 18, false),
  ((select id from public.reference_codelists where name='item_unit'), 'table', 'Table', null, 19, false);
insert into public.reference_codelist_consumers (codelist_id, consumer_table, consumer_column) values ((select id from public.reference_codelists where name='item_unit'), 'items', 'unit');

-- membership_status (system, family=status) — 3 values
insert into public.reference_codelists (name, type, family, default_code) values ('membership_status', 'system', 'status', 'active');
insert into public.reference_codelist_values (codelist_id, code, label, symbol, sort_order, is_active) values
  ((select id from public.reference_codelists where name='membership_status'), 'active', 'Active', null, 1, true),
  ((select id from public.reference_codelists where name='membership_status'), 'invited', 'Invited', null, 2, true),
  ((select id from public.reference_codelists where name='membership_status'), 'suspended', 'Suspended', null, 3, true);
insert into public.reference_codelist_consumers (codelist_id, consumer_table, consumer_column) values ((select id from public.reference_codelists where name='membership_status'), 'user_orgs', 'status');

-- message_item_status (system, family=status) — 9 values
insert into public.reference_codelists (name, type, family, default_code) values ('message_item_status', 'system', 'status', null);
insert into public.reference_codelist_values (codelist_id, code, label, symbol, sort_order, is_active) values
  ((select id from public.reference_codelists where name='message_item_status'), 'brief_sent', 'Brief Sent', null, 1, true),
  ((select id from public.reference_codelists where name='message_item_status'), 'holding', 'Holding', null, 2, true),
  ((select id from public.reference_codelists where name='message_item_status'), 'quoted', 'Quoted', null, 3, true),
  ((select id from public.reference_codelists where name='message_item_status'), 'adjusted_by_supplier', 'Adjusted', null, 4, true),
  ((select id from public.reference_codelists where name='message_item_status'), 'adjusted_by_agent', 'Adjusted', null, 5, true),
  ((select id from public.reference_codelists where name='message_item_status'), 'accepted', 'Accepted', null, 6, true),
  ((select id from public.reference_codelists where name='message_item_status'), 'booked', 'Booked', null, 7, true),
  ((select id from public.reference_codelists where name='message_item_status'), 'declined_by_supplier', 'Declined', null, 8, true),
  ((select id from public.reference_codelists where name='message_item_status'), 'declined_by_agent', 'Cancelled', null, 9, true);

-- message_status (system, family=status) — 4 values
insert into public.reference_codelists (name, type, family, default_code) values ('message_status', 'system', 'status', 'draft');
insert into public.reference_codelist_values (codelist_id, code, label, symbol, sort_order, is_active) values
  ((select id from public.reference_codelists where name='message_status'), 'draft', 'Draft', null, 1, true),
  ((select id from public.reference_codelists where name='message_status'), 'sent', 'Sent', null, 2, true),
  ((select id from public.reference_codelists where name='message_status'), 'read', 'Read', null, 3, true),
  ((select id from public.reference_codelists where name='message_status'), 'deleted', 'Deleted', null, 4, true);

-- mood (ballpark) — 5 values
insert into public.reference_codelists (name, type, family, default_code) values ('mood', 'ballpark', null, null);
insert into public.reference_codelist_values (codelist_id, code, label, symbol, sort_order, is_active) values
  ((select id from public.reference_codelists where name='mood'), 'relaxed', 'Relaxed', null, 1, true),
  ((select id from public.reference_codelists where name='mood'), 'celebratory', 'Celebratory', null, 2, true),
  ((select id from public.reference_codelists where name='mood'), 'impressive', 'Impressive', null, 3, true),
  ((select id from public.reference_codelists where name='mood'), 'sophisticated', 'Sophisticated', null, 4, true),
  ((select id from public.reference_codelists where name='mood'), 'intimate', 'Intimate', null, 5, true);

-- page_title_mode (system) — 4 values
insert into public.reference_codelists (name, type, family, default_code) values ('page_title_mode', 'system', null, 'greeting');
insert into public.reference_codelist_values (codelist_id, code, label, symbol, sort_order, is_active) values
  ((select id from public.reference_codelists where name='page_title_mode'), 'greeting', 'Greeting', null, 1, true),
  ((select id from public.reference_codelists where name='page_title_mode'), 'username', 'Username', null, 2, true),
  ((select id from public.reference_codelists where name='page_title_mode'), 'orgName', 'Org name', null, 3, true),
  ((select id from public.reference_codelists where name='page_title_mode'), 'fixed', 'Fixed text', null, 4, true);

-- project_status (system, family=status) — 4 values
insert into public.reference_codelists (name, type, family, default_code) values ('project_status', 'system', 'status', 'draft');
insert into public.reference_codelist_values (codelist_id, code, label, symbol, sort_order, is_active) values
  ((select id from public.reference_codelists where name='project_status'), 'draft', 'Draft', null, 1, true),
  ((select id from public.reference_codelists where name='project_status'), 'active', 'Active', null, 2, true),
  ((select id from public.reference_codelists where name='project_status'), 'completed', 'Completed', null, 3, true),
  ((select id from public.reference_codelists where name='project_status'), 'archived', 'Archived', null, 4, true);
insert into public.reference_codelist_consumers (codelist_id, consumer_table, consumer_column) values ((select id from public.reference_codelists where name='project_status'), 'projects', 'status');

-- quick_reply_templates (system) — 8 values
insert into public.reference_codelists (name, type, family, default_code) values ('quick_reply_templates', 'system', null, null);
insert into public.reference_codelist_values (codelist_id, code, label, symbol, sort_order, is_active) values
  ((select id from public.reference_codelists where name='quick_reply_templates'), 'sup_received', 'Thanks, received', null, 1, true),
  ((select id from public.reference_codelists where name='quick_reply_templates'), 'agent_thanks', 'Thanks!', null, 1, true),
  ((select id from public.reference_codelists where name='quick_reply_templates'), 'agent_confirm', 'Can you confirm?', null, 2, true),
  ((select id from public.reference_codelists where name='quick_reply_templates'), 'sup_working', 'Working on it', null, 2, true),
  ((select id from public.reference_codelists where name='quick_reply_templates'), 'sup_confirmed', 'Confirmed as-is', null, 3, true),
  ((select id from public.reference_codelists where name='quick_reply_templates'), 'agent_reviewing', 'We''ll review', null, 3, true),
  ((select id from public.reference_codelists where name='quick_reply_templates'), 'agent_other_path', 'Going with another option', null, 4, true),
  ((select id from public.reference_codelists where name='quick_reply_templates'), 'sup_need_detail', 'Need a bit more detail', null, 4, true);

-- document_status (system, family=status) — 6 values
insert into public.reference_codelists (name, type, family, default_code) values ('document_status', 'system', 'status', 'draft');
insert into public.reference_codelist_values (codelist_id, code, label, symbol, sort_order, is_active) values
  ((select id from public.reference_codelists where name='document_status'), 'draft', 'Draft', null, 0, true),
  ((select id from public.reference_codelists where name='document_status'), 'sent', 'Sent', null, 1, true),
  ((select id from public.reference_codelists where name='document_status'), 'viewed', 'Viewed', null, 2, true),
  ((select id from public.reference_codelists where name='document_status'), 'accepted', 'Accepted', null, 3, true),
  ((select id from public.reference_codelists where name='document_status'), 'declined', 'Declined', null, 4, true),
  ((select id from public.reference_codelists where name='document_status'), 'expired', 'Expired', null, 5, true);

-- subscription_status (system, family=status) — 5 values
insert into public.reference_codelists (name, type, family, default_code) values ('subscription_status', 'system', 'status', 'active');
insert into public.reference_codelist_values (codelist_id, code, label, symbol, sort_order, is_active) values
  ((select id from public.reference_codelists where name='subscription_status'), 'trialing', 'Trialing', null, 0, true),
  ((select id from public.reference_codelists where name='subscription_status'), 'active', 'Active', null, 1, true),
  ((select id from public.reference_codelists where name='subscription_status'), 'past_due', 'Past due', null, 2, true),
  ((select id from public.reference_codelists where name='subscription_status'), 'canceled', 'Canceled', null, 3, true),
  ((select id from public.reference_codelists where name='subscription_status'), 'suspended', 'Suspended', null, 4, true);

-- install_unit (ballpark, family=unit) — 4 values
insert into public.reference_codelists (name, type, family, default_code) values ('install_unit', 'ballpark', 'unit', 'flat');
insert into public.reference_codelist_values (codelist_id, code, label, symbol, sort_order, is_active) values
  ((select id from public.reference_codelists where name='install_unit'), 'flat', 'Flat fee', null, 0, true),
  ((select id from public.reference_codelists where name='install_unit'), 'per_item', 'Per item', null, 1, true),
  ((select id from public.reference_codelists where name='install_unit'), 'per_hour', 'Per hour', null, 2, true),
  ((select id from public.reference_codelists where name='install_unit'), 'per_day', 'Per day', null, 3, true);

