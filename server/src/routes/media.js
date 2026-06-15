// pV2-MEDIA-01b — gated media upload. The image-picker's "My File" tab posts
// here; the server picks the Supabase bucket from the scope (the client never
// hardcodes env bucket names) and scopes the path to the caller's org. Mounted
// on the v2 router, so it inherits authenticate + requireActiveMembership.
const router = require('express').Router();
const multer = require('multer');
const StorageService = require('../services/storage.service');

// 10MB cap (MEDIA.md picker spec), memory storage → buffer → Supabase.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const PROJECTS_BUCKET = process.env.STORAGE_BUCKET_PROJECTS || 'dev-project-assets';
const SUPPLIERS_BUCKET = process.env.STORAGE_BUCKET_SUPPLIERS || 'dev-supplier-assets';
const SCOPE_BUCKET = {
  project: PROJECTS_BUCKET,
  item: SUPPLIERS_BUCKET,
  supplier: SUPPLIERS_BUCKET,
  profile: SUPPLIERS_BUCKET,
};

// POST /api/media/upload — multipart { file, scope }. org from JWT.
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    if (!req.file.mimetype || !req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Images only' });
    }
    const scope = String(req.body.scope || '');
    const bucket = SCOPE_BUCKET[scope];
    if (!bucket) return res.status(400).json({ error: 'Invalid scope' });

    // Org-scoped path; StorageService cache-busts + appends a timestamp.
    const path = `${scope}/${req.user.org_id}/cover`;
    const url = await StorageService.uploadFile(bucket, path, req.file.buffer, req.file.mimetype);
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
