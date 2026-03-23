const router = require('express').Router();
const multer = require('multer');
const StorageService = require('../services/storage.service');

const upload = multer({ storage: multer.memoryStorage() });

// POST /api/storage/upload
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { bucket, path } = req.body;
    if (!bucket || !path) {
      return res.status(400).json({ error: 'bucket and path are required' });
    }

    const url = await StorageService.uploadFile(
      bucket,
      path,
      req.file.buffer,
      req.file.mimetype
    );

    res.json({ url });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
