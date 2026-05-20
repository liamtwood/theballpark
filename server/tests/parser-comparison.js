// Parser comparison harness — v1.34.
//
// Runs the rule-based parser (Node port at ./rule-parser.js) AND the AI
// parser (server/src/services/ai.service.js) over each .txt brief in
// ./_briefs/, then writes a JSON dump of every result to
// ./_briefs/results-{stage}.json.
//
// Usage:
//   node server/tests/parser-comparison.js before   # snapshot before improvements
//   node server/tests/parser-comparison.js after    # snapshot after improvements
//
// Idempotent — re-running overwrites the corresponding results file.
//
// Set BRIEF (e.g. BRIEF=angel-delight) to test a single brief.
// Set SKIP_AI=1 to skip the API calls (useful for the AFTER rule-only re-run).

require('dotenv').config({ path: 'C:/projects/ballpark/.env' });
const fs = require('fs');
const path = require('path');

const rule = require('./rule-parser');
const ai   = require('../src/services/ai.service');

const BRIEFS_DIR = path.join(__dirname, '_briefs');
const stage = (process.argv[2] || 'before').toLowerCase();
if (!['before', 'after'].includes(stage)) {
  console.error('Stage must be "before" or "after"');
  process.exit(2);
}

const briefs = [
  { key: 'angel-delight', name: 'Angel Delight',          complexity: 'casual email' },
  { key: 'creditspring',  name: 'Creditspring',           complexity: 'casual email' },
  { key: 'tiktok',        name: 'TikTok #SummerSkills',   complexity: 'structured brief' },
  { key: 'hellofresh',    name: 'HelloFresh @ Latitude',  complexity: 'formal RFP' },
  { key: 'lavazza',       name: 'Lavazza TABLÉ',          complexity: 'creative deck' }
].filter(b => !process.env.BRIEF || process.env.BRIEF === b.key);

(async () => {
  const results = [];
  for (const brief of briefs) {
    const file = path.join(BRIEFS_DIR, `${brief.key}.txt`);
    if (!fs.existsSync(file)) {
      console.error(`Missing brief file: ${file}`);
      continue;
    }
    const text = fs.readFileSync(file, 'utf8');

    console.log(`\n── ${brief.name} ─────────────────────────`);
    console.log(`Stage: ${stage} · Complexity: ${brief.complexity}`);

    const ruleStart = Date.now();
    const ruleOut = rule.parseBrief(text);
    const ruleMs = Date.now() - ruleStart;
    console.log(`Rule-based: ${ruleOut.categories.length} categories (${ruleMs}ms)`);

    let aiOut = null;
    let aiMs = 0;
    if (!process.env.SKIP_AI) {
      try {
        const aiStart = Date.now();
        aiOut = await ai.parseBrief(text);
        aiMs = Date.now() - aiStart;
        const catCount = Array.isArray(aiOut.categories) ? aiOut.categories.length : '?';
        console.log(`AI (haiku): ${catCount} categories (${aiMs}ms)`);
      } catch (err) {
        console.error(`AI failed: ${err.message}`);
        aiOut = { error: err.message };
      }
    } else {
      console.log('AI: skipped (SKIP_AI=1)');
    }

    results.push({
      key:        brief.key,
      name:       brief.name,
      complexity: brief.complexity,
      textLength: text.length,
      rule:       { output: ruleOut, ms: ruleMs },
      ai:         process.env.SKIP_AI ? null : { output: aiOut, ms: aiMs }
    });
  }

  const out = path.join(BRIEFS_DIR, `results-${stage}.json`);
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${out}`);
})().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
