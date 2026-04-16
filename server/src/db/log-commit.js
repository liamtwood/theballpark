// Log a commit to internal.project_log.
// Usage: node server/src/db/log-commit.js [<commit-ref>]
// - If no arg, uses HEAD.
// - Idempotent per commit_ref (skip if already logged).
const { Pool } = require('pg');
const { execSync } = require('child_process');
require('dotenv').config({ path: 'C:/projects/ballpark/.env' });

function git(args, cwd) {
  return execSync(`git ${args}`, { cwd, encoding: 'utf8' }).trim();
}

(async () => {
  const cwd = process.cwd();
  const arg = process.argv[2] || 'HEAD';
  const sha = git(`rev-parse --short ${arg}`, cwd);
  const subject = git(`log -1 --format=%s ${sha}`, cwd);
  const body = git(`log -1 --format=%b ${sha}`, cwd);

  // Guess area from diff paths (broad buckets)
  let area = null;
  try {
    const files = git(`show --name-only --format= ${sha}`, cwd).split('\n').filter(Boolean);
    if (files.some(f => f.startsWith('client-angular/'))) area = 'frontend';
    if (files.some(f => f.startsWith('server/'))) area = area ? 'fullstack' : 'backend';
  } catch { /* ignore */ }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    const existing = await pool.query(
      `SELECT id FROM internal.project_log WHERE commit_ref = $1 LIMIT 1`,
      [sha]
    );
    if (existing.rowCount > 0) {
      console.log(`already logged: ${sha} → ${existing.rows[0].id}`);
      return;
    }
    const { rows } = await pool.query(
      `INSERT INTO internal.project_log (type, area, title, description, status, commit_ref)
       VALUES ('commit', $1, $2, $3, 'done', $4)
       RETURNING id, created_at`,
      [area, subject, body || null, sha]
    );
    console.log(`logged: ${sha} → ${rows[0].id} @ ${rows[0].created_at}`);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
