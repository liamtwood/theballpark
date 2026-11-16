/* SUPERSEDED by 0040_document_cluster_supplier_direction.test.js (2026-11-16).
 *
 * 0040 reworked the SOW cluster into the BIDIRECTIONAL model: the separate
 * `document_confirm` step was dropped, the mid status `supplier_signed` →
 * `counterparty_signed`, and the three `*_provider_read` policies were replaced by the
 * unified counterparty-read. The agency-direction assertions this file used to make
 * (confirm → ready_to_sign → supplier_signed → executed) no longer describe the machine
 * and would fail against the applied schema. The 0040 gate covers the agency direction
 * too (aDoc) PLUS the supplier-authored direction, so this file is retired.
 *
 * Run the current gate instead:
 *   NODE_PATH=<server>/node_modules node server/db/rebuild/tests/0040_document_cluster_supplier_direction.test.js
 */
console.log('0039 SOW test superseded by 0040_document_cluster_supplier_direction.test.js — run that instead.');
process.exit(0);
