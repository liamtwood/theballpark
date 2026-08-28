// pV2-MEDIA-01b — gated media upload. The image-picker's "My File" tab posts
// here; the server picks the Supabase bucket from the scope (the client never
// hardcodes env bucket names) and scopes the path to the caller's org. Mounted
// on the v2 router, so it inherits authenticate + requireActiveMembership.
const router = require('express').Router();
const multer = require('multer');
const StorageService = require('../services/storage.service');

// 10MB cap (MEDIA.md picker spec), memory storage → buffer → Supabase.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Audit F-2 — allow-list the real image types StorageService can extension
// (png/jpeg/webp). Trusting `image/*` let a spoofed Content-Type through and an
// unknown mimetype produced an extensionless object.
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

const PROJECTS_BUCKET = process.env.STORAGE_BUCKET_PROJECTS || 'dev-project-assets';
const SUPPLIERS_BUCKET = process.env.STORAGE_BUCKET_SUPPLIERS || 'dev-supplier-assets';
const SCOPE_BUCKET = {
  project: PROJECTS_BUCKET,
  item: SUPPLIERS_BUCKET,
  supplier: SUPPLIERS_BUCKET,
  profile: SUPPLIERS_BUCKET,
  // pV2-BUILDUP-04 — the agency's standard Terms & Conditions PDF (org-level).
  terms: SUPPLIERS_BUCKET,
};

// POST /api/media/upload — multipart { file, scope }. org from JWT.
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const scope = String(req.body.scope || '');
    const bucket = SCOPE_BUCKET[scope];
    if (!bucket) return res.status(400).json({ error: 'Invalid scope' });

    // The `terms` scope carries a PDF; all others are cover images.
    if (scope === 'terms') {
      if (req.file.mimetype !== 'application/pdf') {
        return res.status(400).json({ error: 'Only a PDF is allowed for Terms & Conditions' });
      }
    } else if (!ALLOWED_MIME.has(req.file.mimetype)) {
      return res.status(400).json({ error: 'Only PNG, JPEG, or WebP images are allowed' });
    }

    // Org-scoped path; StorageService cache-busts + appends a timestamp.
    const path = scope === 'terms'
      ? `terms/${req.user.org_id}/standard`
      : `${scope}/${req.user.org_id}/cover`;
    const url = await StorageService.uploadFile(bucket, path, req.file.buffer, req.file.mimetype);
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
