// Re-link orphaned Supabase storage files to current preview.orgs rows.
//
// Problem: seed-preview.js drops+reinserts preview rows with new UUIDs, but
// storage files still live under the old UUIDs. This script matches files
// by content hash against dev's supplier images — same image uploaded to
// both envs should hash identically — and rewrites preview URLs.
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: 'C:/projects/ballpark/.env' });

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const DEV_BUCKET = 'dev-supplier-assets';
const PREVIEW_BUCKET = 'preview-supplier-assets';

async function hashFromUrl(url) {
  const r = await fetch(url);
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  return { hash: crypto.createHash('sha256').update(buf).digest('hex'), size: buf.length };
}

async function hashFromBucket(bucket, path) {
  const { data, error } = await sb.storage.from(bucket).download(path);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  return { hash: crypto.createHash('sha256').update(buf).digest('hex'), size: buf.length };
}

async function listSupplierFolders(bucket) {
  const { data, error } = await sb.storage.from(bucket).list('suppliers', { limit: 200 });
  if (error) throw error;
  const result = [];
  for (const folder of data) {
    if (folder.metadata) continue; // skip files at the root
    const { data: files, error: e2 } = await sb.storage.from(bucket).list('suppliers/' + folder.name, { limit: 20 });
    if (e2) continue;
    for (const f of files) {
      if (!f.metadata) continue;
      result.push({ folderId: folder.name, path: 'suppliers/' + folder.name + '/' + f.name, size: f.metadata.size, updatedAt: f.updated_at });
    }
  }
  return result;
}

(async () => {
  try {
    console.log('Step 1 — hashing dev supplier covers (source of truth for name↔image)');
    const devOrgs = await pool.query(
      `SELECT id, name, cover_image_url FROM public.orgs WHERE type='supplier' AND cover_image_url IS NOT NULL`
    );
    const devByHash = new Map();
    for (const o of devOrgs.rows) {
      const h = await hashFromUrl(o.cover_image_url);
      if (h) {
        devByHash.set(h.hash, { name: o.name, size: h.size, url: o.cover_image_url });
        console.log(`  ${o.name.padEnd(32)} ${h.hash.slice(0,12)}  ${h.size} bytes`);
      } else {
        console.log(`  ${o.name.padEnd(32)} (failed to fetch)`);
      }
    }

    console.log('\nStep 2 — hashing orphaned preview storage files');
    const files = await listSupplierFolders(PREVIEW_BUCKET);
    // Keep the most recently updated file per folder (dedupe)
    const latest = new Map();
    for (const f of files) {
      const prev = latest.get(f.folderId);
      if (!prev || f.updatedAt > prev.updatedAt) latest.set(f.folderId, f);
    }
    const previewFiles = [...latest.values()];
    console.log(`  ${previewFiles.length} folders with latest file each`);

    console.log('\nStep 3 — matching by hash');
    const matches = [];
    for (const f of previewFiles) {
      const h = await hashFromBucket(PREVIEW_BUCKET, f.path);
      if (!h) { console.log(`  ${f.folderId.slice(0,8)}  (download failed)`); continue; }
      const dev = devByHash.get(h.hash);
      if (dev) {
        matches.push({ supplierName: dev.name, previewPath: f.path });
        console.log(`  ${f.folderId.slice(0,8)}  → MATCH "${dev.name}"  ${h.hash.slice(0,12)}`);
      } else {
        // Try match by file size as a weaker hint
        const sizeMatch = [...devByHash.values()].find(d => d.size === h.size);
        console.log(`  ${f.folderId.slice(0,8)}  no hash match (size ${h.size}${sizeMatch ? ', sizeCand: '+sizeMatch.name : ''})`);
      }
    }

    console.log(`\nStep 4 — writing URLs to preview.orgs`);
    const previewOrgs = await pool.query(`SELECT id, name FROM preview.orgs WHERE type='supplier'`);
    const previewByName = new Map(previewOrgs.rows.map(o => [o.name.toLowerCase(), o]));
    let updated = 0;
    for (const m of matches) {
      const org = previewByName.get(m.supplierName.toLowerCase());
      if (!org) { console.log(`  no preview supplier named "${m.supplierName}" — skipped`); continue; }
      const { data } = sb.storage.from(PREVIEW_BUCKET).getPublicUrl(m.previewPath);
      const url = data.publicUrl;
      await pool.query(`UPDATE preview.orgs SET cover_image_url = $1, updated_at = NOW() WHERE id = $2`, [url, org.id]);
      console.log(`  ✓ ${m.supplierName} (${org.id.slice(0,8)}) → ${m.previewPath}`);
      updated++;
    }
    console.log(`\nDone — updated ${updated} preview.orgs.cover_image_url`);
  } catch (err) {
    console.error('ERR:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
