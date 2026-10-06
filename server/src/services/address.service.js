// Addresses satellite (v2dev). An org's postal addresses live here, not on the
// orgs row — the org points at its primary via orgs.primary_address_id. The
// profile editor surfaces ONE address (line1 + city + country); this service
// upserts that primary 'registered' address. Writes take a transaction client
// (from withTransaction) so the orgs update + the address write are atomic and
// share the request's RLS/GUC context.

// Profile form field -> addresses column. The editor's single "Address" line
// maps to line1; postcode/region aren't in the form yet (satellite supports them).
const FIELD_TO_COLUMN = { address: 'line1', city: 'city', country: 'country' };

/** The address columns present in a parsed profile patch ('' clears → null).
 *  Returns {} when the patch carries no address fields. */
function addressColumnsFrom(parsed) {
  const cols = {};
  for (const [field, column] of Object.entries(FIELD_TO_COLUMN)) {
    if (parsed[field] !== undefined) cols[column] = parsed[field] === '' ? null : parsed[field];
  }
  return cols;
}

/** Upsert the org's PRIMARY address from the given columns, inside a txn client.
 *  Updates the linked primary if one exists, else inserts a 'registered' address
 *  and links it via orgs.primary_address_id. created_by/updated_by are stamped
 *  from the request GUC (no audit trigger on v2dev yet). No-op for an empty set. */
async function upsertPrimaryForOrg(client, orgId, cols) {
  const entries = Object.entries(cols);
  if (!entries.length) return null;

  const existing = await client.query('SELECT primary_address_id FROM orgs WHERE id = $1', [orgId]);
  const primaryId = existing.rows[0] && existing.rows[0].primary_address_id;

  if (primaryId) {
    const sets = entries.map(([c], i) => `${c} = $${i + 2}`);
    await client.query(
      `UPDATE addresses SET ${sets.join(', ')}, updated_at = NOW(), updated_by = app_current_user_id()
        WHERE id = $1 AND deleted_at IS NULL`,
      [primaryId, ...entries.map(([, v]) => v)]
    );
    return primaryId;
  }

  const colNames = entries.map(([c]) => c);
  const placeholders = entries.map((_, i) => `$${i + 2}`);
  const inserted = await client.query(
    `INSERT INTO addresses (org_id, type, ${colNames.join(', ')}, created_by, updated_by)
     VALUES ($1, 'registered', ${placeholders.join(', ')}, app_current_user_id(), app_current_user_id())
     RETURNING id`,
    [orgId, ...entries.map(([, v]) => v)]
  );
  const newId = inserted.rows[0].id;
  await client.query('UPDATE orgs SET primary_address_id = $2, updated_at = NOW() WHERE id = $1', [orgId, newId]);
  return newId;
}

module.exports = { addressColumnsFrom, upsertPrimaryForOrg };
