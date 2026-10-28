// pV2-STORE-EXTRACT-01 — website catalogue extract routes, factored so the SAME
// handlers serve two mounts (no duplication / drift):
//   • admin cross-org : /api/admin/orgs/:orgId/extract/*  (orgId from the URL;
//                        gate = admin.cross_org_view, from the parent mount)
//   • self-serve own  : /api/organisation/extract/*        (orgId = active org;
//                        gate = org.manage_billing, from the parent mount)
// resolveOrgId(req) yields the TARGET org — never the body (same invariant as the
// item routes). Analyse is read-only; Pull creates PENDING items → Approvals, so
// moderation is unchanged whichever mount is used.

const express = require('express');
const { z } = require('zod');
const CatalogueExtract = require('../services/catalogue-extract.service');

const ExtractUrlBody = z.object({ url: z.string().trim().url('A valid URL is required') });
const ExtractPrepareBody = z.object({
  groups: z.array(z.object({ key: z.string().trim().min(1), sample: z.string().trim().optional() })).min(1).max(60),
});
const MappingRow = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  subcategoryId: z.string().uuid().nullable().optional(),
  subcategoryName: z.string().trim().optional(),
  isNew: z.boolean().optional(),
  newParentId: z.string().uuid().nullable().optional(), // parent for a new 3rd-level node (the L2)
});
const ExtractPullBody = z.object({
  // Allow a large selection — the service caps processing at MAX_PULL_URLS and
  // reports the overflow as 'dropped' rows (visible), rather than a hard 400.
  urls: z.array(z.string().trim().url()).min(1).max(500),
  mode: z.enum(['review', 'full']).optional(),
  mapping: z.record(z.string(), MappingRow).optional(),
});

/** Build the extract sub-router. `resolveOrgId(req)` returns the org to extract
 *  into; the caller's mount supplies authentication + the authorisation gate. */
function makeExtractRouter(resolveOrgId) {
  const router = express.Router({ mergeParams: true });

  // POST …/extract/analyse { url } → the read-only report. A HOMEPAGE (whole-site)
  // analyse fans out over every section as a BACKGROUND job (returns { jobId,
  // async:true } → poll the job route); a section/product URL stays a fast sync crawl.
  router.post('/analyse', async (req, res, next) => {
    const parsed = ExtractUrlBody.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'A valid url is required' });
    try {
      const url = parsed.data.url;
      // API-backed profiles (Woo / WordPress) → structured analyse (sync, fast), whatever
      // the path. Generic homepage → the fan-out job; generic section/product → sync crawl.
      const profile = await CatalogueExtract.detectProfile(url);
      if (profile === 'woo' || profile === 'wordpress') return res.json(await CatalogueExtract.analyse(url, profile));
      const isHome = (() => { try { return new URL(url).pathname.replace(/\/$/, '') === ''; } catch { return false; } })();
      res.json(isHome
        ? await CatalogueExtract.startAnalyseJob(resolveOrgId(req), url)
        : await CatalogueExtract.analyse(url, profile));
    } catch (err) { next(err); }
  });

  // POST …/extract/prepare { groups[] } → per-group cat/subcat suggestion + the
  // marketplace taxonomy tree (Liam's Prepare step).
  router.post('/prepare', async (req, res, next) => {
    const parsed = ExtractPrepareBody.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'groups (1-60) are required' });
    try { res.json(await CatalogueExtract.prepare(parsed.data.groups)); } catch (err) { next(err); }
  });

  // POST …/extract/prepare/apply { mapping } → CATEGORIES-ONLY: create the new
  // subcats/sub-subcats the Prepare mapping needs, WITHOUT pulling items. Idempotent.
  router.post('/prepare/apply', async (req, res, next) => {
    const mapping = req.body?.mapping;
    if (!mapping || typeof mapping !== 'object') return res.status(400).json({ error: 'mapping is required' });
    const parsed = z.record(z.string(), MappingRow).safeParse(mapping);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid mapping' });
    try { res.json(await CatalogueExtract.applyMapping(parsed.data)); } catch (err) { next(err); }
  });

  // POST …/extract/pull { urls[], mode?, mapping? } → START a background pull job
  // (a whole catalogue takes minutes). Returns the job id at once; the client polls
  // the job route below and can re-attach after leaving the page.
  router.post('/pull', async (req, res, next) => {
    const parsed = ExtractPullBody.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'urls (1-500 valid URLs) are required' });
    try {
      res.json(await CatalogueExtract.startPull(resolveOrgId(req), parsed.data.urls, { mode: parsed.data.mode, mapping: parsed.data.mapping }, req.user?.id || null));
    } catch (err) {
      if (err && err.code === 'pull_in_progress') return res.status(409).json({ error: err.message, jobId: err.jobId });
      next(err);
    }
  });

  // GET …/extract/job → the org's resumable job, or null — the panel calls this on
  // load to re-attach. Returns a LIVE job (running pull/analyse) OR, failing that, the
  // most recent COMPLETED analyse, so leave-and-return rehydrates the sections to pull.
  router.get('/job', async (req, res, next) => {
    try { res.json(await CatalogueExtract.resumableJobForOrg(resolveOrgId(req))); } catch (err) { next(err); }
  });

  // GET …/extract/job/:jobId → poll one job (status/progress/results).
  router.get('/job/:jobId', async (req, res, next) => {
    if (!z.string().uuid().safeParse(req.params.jobId).success) return res.status(400).json({ error: 'Invalid job id' });
    try {
      const job = await CatalogueExtract.getJob(req.params.jobId, resolveOrgId(req));
      if (!job) return res.status(404).json({ error: 'Job not found' });
      res.json(job);
    } catch (err) { next(err); }
  });

  // POST …/extract/job/:jobId/cancel → request cancel; the runner stops before the
  // next item. Items already created stay pending.
  router.post('/job/:jobId/cancel', async (req, res, next) => {
    if (!z.string().uuid().safeParse(req.params.jobId).success) return res.status(400).json({ error: 'Invalid job id' });
    try { res.json({ cancelling: await CatalogueExtract.cancelJob(req.params.jobId, resolveOrgId(req)) }); } catch (err) { next(err); }
  });

  return router;
}

module.exports = { makeExtractRouter };
