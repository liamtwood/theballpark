// One-off migration: convert shared.feedback.priority from VARCHAR
// ('critical'/'high'/'medium'/'low') to INTEGER (1-5), and add a pages
// TEXT[] column.
//
// Idempotent — safely re-runnable. Detects current column type before
// converting; if priority is already INTEGER it just skips the conversion.
//
// Usage: node server/src/db/migrate-feedback-priority-int.js

const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const STR_TO_INT = `
  CASE priority
    WHEN 'critical' THEN 1
    WHEN 'high'     THEN 2
    WHEN 'medium'   THEN 3
    WHEN 'low'      THEN 4
    ELSE NULL
  END
`;

(async () => {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  try {
    // Inspect current type so we don't redo the conversion.
    const colInfo = await client.query(
      `SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'shared'
          AND table_name   = 'feedback'
          AND column_name  = 'priority'`
    );
    const dataType = colInfo.rows[0]?.data_type;
    console.log(`shared.feedback.priority current type: ${dataType || 'MISSING'}`);

    if (dataType === 'character varying' || dataType === 'text') {
      console.log('Converting priority: VARCHAR → INTEGER (1-5)...');
      // Drop the existing CHECK constraint (named or not). Use a DO block
      // to find the constraint by definition since Postgres auto-names it.
      await client.query(`
        DO $$
        DECLARE
          c_name TEXT;
        BEGIN
          SELECT con.conname INTO c_name
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_namespace ns ON ns.oid = rel.relnamespace
          WHERE ns.nspname = 'shared'
            AND rel.relname = 'feedback'
            AND con.contype = 'c'
            AND pg_get_constraintdef(con.oid) ILIKE '%priority%'
          LIMIT 1;
          IF c_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE shared.feedback DROP CONSTRAINT %I', c_name);
          END IF;
        END $$;
      `);
      // Drop default before changing type — old default was 'medium' string.
      await client.query(`ALTER TABLE shared.feedback ALTER COLUMN priority DROP DEFAULT`);
      await client.query(`
        ALTER TABLE shared.feedback
          ALTER COLUMN priority TYPE INTEGER USING (${STR_TO_INT})
      `);
      await client.query(`ALTER TABLE shared.feedback ALTER COLUMN priority SET DEFAULT 3`);
      await client.query(`
        ALTER TABLE shared.feedback
          ADD CONSTRAINT feedback_priority_range_chk
          CHECK (priority IS NULL OR (priority BETWEEN 1 AND 5))
      `);
      console.log('  priority converted.');
    } else if (dataType === 'integer') {
      console.log('  priority already INTEGER — skipping conversion.');
    } else {
      // Column missing entirely — create as INTEGER directly.
      await client.query(`
        ALTER TABLE shared.feedback
          ADD COLUMN priority INTEGER DEFAULT 3
          CHECK (priority IS NULL OR (priority BETWEEN 1 AND 5))
      `);
      console.log('  priority added as INTEGER.');
    }

    // target_version (already exists per migrate-schemas.js but make idempotent)
    await client.query(`
      ALTER TABLE shared.feedback
        ADD COLUMN IF NOT EXISTS target_version VARCHAR(10)
    `);

    // pages TEXT[] — new column for the per-issue page list
    await client.query(`
      ALTER TABLE shared.feedback
        ADD COLUMN IF NOT EXISTS pages TEXT[] DEFAULT '{}'
    `);
    console.log('  pages TEXT[] ensured.');

    // Sanity check distribution
    const r = await client.query(
      `SELECT priority, COUNT(*) FROM shared.feedback GROUP BY priority ORDER BY priority NULLS FIRST`
    );
    console.log('priority distribution after:', r.rows);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
