const router = require('express').Router();
const AiService = require('../services/ai.service');

router.post('/parse-brief', async (req, res, next) => {
  try {
    const rawBriefText = req.body.raw_brief_text || req.body.brief_text;
    if (!rawBriefText) return res.status(400).json({ error: 'raw_brief_text or brief_text is required' });
    res.json(await AiService.parseBrief(rawBriefText));
  } catch (err) { next(err); }
});

module.exports = router;
