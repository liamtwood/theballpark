// Org-profile WRITE orchestration — shared by the self PUT (/api/organisation)
// and the admin cross-org PUT (/api/admin/orgs/:id) so the field-set + the
// orgs-row / addresses-satellite split lives in ONE place (extract-before-
// duplicate). The projection + update-builder stay in org-profile.util (pure).

const { withTransaction } = require('../db/with-transaction');
const { buildOrgUpdate } = require('./org-profile.util');
const { addressColumnsFrom, upsertPrimaryForOrg } = require('./address.service');

/**
 * Apply a parsed OrganisationUpdate to an org: the orgs-row columns plus the
 * address satellite (address/city/country → the primary address), atomically.
 * Returns true if anything was applied, false when the patch had no writable
 * fields (the caller then 400s). The caller re-selects + maps for the response.
 */
async function updateOrgProfile(orgId, parsed) {
  const { sets, vals } = buildOrgUpdate(parsed);     // orgs columns (never address)
  const addressCols = addressColumnsFrom(parsed);    // addresses satellite
  if (!sets.length && !Object.keys(addressCols).length) return false;

  await withTransaction(async (client) => {
    if (sets.length) {
      const v = [...vals, orgId];
      await client.query(
        `UPDATE orgs SET ${sets.join(', ')}, updated_at = NOW()
          WHERE id = $${v.length} AND deleted_at IS NULL`,
        v,
      );
    }
    if (Object.keys(addressCols).length) await upsertPrimaryForOrg(client, orgId, addressCols);
  });
  return true;
}

module.exports = { updateOrgProfile };
