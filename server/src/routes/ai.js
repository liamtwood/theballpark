const router = require('express').Router();
const multer = require('multer');
const AiService = require('../services/ai.service');

// In-memory multer — files never touch disk; we extract text and
// throw the buffer away. 10 MB cap is more than enough for the
// typical 1-2 page PDF/DOCX brief.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.post('/parse-brief', async (req, res, next) => {
  try {
    const rawBriefText = req.body.raw_brief_text || req.body.brief_text;
    if (!rawBriefText) return res.status(400).json({ error: 'raw_brief_text or brief_text is required' });
    res.json(await AiService.parseBrief(rawBriefText));
  } catch (err) { next(err); }
});

/**
 * v1.39a — extract plain text from an uploaded file so the create-project
 * modal can populate its textarea automatically. Pure text extraction —
 * does NOT call the AI. The client decides whether to forward the result
 * to /parse-brief next.
 *
 * Supports:
 *   - .pdf  → pdf-parse
 *   - .docx → mammoth.extractRawText
 *   - .txt  → utf8 buffer toString
 *   - .eml  → utf8 buffer toString (good enough for plain-text emails)
 *
 * Image / .doc (binary) returns 415 with a helpful message so the UI
 * can prompt the user to paste instead.
 */
router.post('/extract-text', upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const name = (file.originalname || '').toLowerCase();
    const mime = file.mimetype || '';
    const buf  = file.buffer;

    let text = '';

    if (name.endsWith('.pdf') || mime === 'application/pdf') {
      // pdf-parse v2 — class-based API: new PDFParse({ data }).getText().
      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse({ data: buf });
      const out = await parser.getText();
      text = (out.text || '').trim();
    } else if (name.endsWith('.docx') || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const mammoth = require('mammoth');
      const out = await mammoth.extractRawText({ buffer: buf });
      text = (out.value || '').trim();
    } else if (name.endsWith('.txt') || mime === 'text/plain') {
      text = buf.toString('utf8').trim();
    } else if (name.endsWith('.eml') || mime === 'message/rfc822') {
      // Strip the headers if present — anything before the first blank
      // line is RFC 822 metadata. Keep the body verbatim.
      const raw = buf.toString('utf8');
      const bodyStart = raw.indexOf('\r\n\r\n') >= 0
        ? raw.indexOf('\r\n\r\n') + 4
        : (raw.indexOf('\n\n') >= 0 ? raw.indexOf('\n\n') + 2 : 0);
      text = raw.slice(bodyStart).trim();
    } else if (mime.startsWith('image/')) {
      return res.status(415).json({
        error: 'Image OCR is not yet supported — please paste the brief text below.',
        suggestion: 'paste'
      });
    } else if (name.endsWith('.doc')) {
      return res.status(415).json({
        error: 'Legacy .doc (binary) is not supported — save as .docx or paste the text.',
        suggestion: 'paste'
      });
    } else {
      return res.status(415).json({
        error: `Unsupported file type (${mime || name}). Paste the text below.`,
        suggestion: 'paste'
      });
    }

    if (!text) {
      return res.status(422).json({
        error: 'Could not extract any text from this file — paste the text below.',
        suggestion: 'paste'
      });
    }

    res.json({ text, filename: file.originalname, length: text.length });
  } catch (err) { next(err); }
});

module.exports = router;
