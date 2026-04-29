const pool = require('../db/pool');

const BASE_SELECT = `
  SELECT f.*,
         fc.name        AS category_name,
         fc.icon_name   AS category_icon_name,
         fc.icon_color  AS category_icon_color,
         fc.object_type AS category_object_type,
         ac.name        AS area_name,
         ac.icon_name   AS area_icon_name,
         ac.icon_color  AS area_icon_color
  FROM shared.feedback f
  LEFT JOIN shared.feedback_categories fc ON fc.id = f.feedback_category_id
  LEFT JOIN shared.feedback_categories ac ON ac.id = f.area_category_id
`;

async function getAll(filters) {
  // filters = { object_type?, priority?, target_version? }
  const where = [];
  const params = [];
  if (filters && typeof filters === 'object') {
    if (filters.object_type) {
      params.push(filters.object_type);
      where.push(`f.object_type = $${params.length}`);
    }
    if (filters.priority) {
      params.push(filters.priority);
      where.push(`f.priority = $${params.length}`);
    }
    if (filters.target_version) {
      params.push(filters.target_version);
      where.push(`f.target_version = $${params.length}`);
    }
  } else if (typeof filters === 'string') {
    // Backwards-compat — old call signature was getAll(objectType: string)
    params.push(filters);
    where.push(`f.object_type = $${params.length}`);
  }
  let query = BASE_SELECT;
  if (where.length) query += ' WHERE ' + where.join(' AND ');
  query += ' ORDER BY f.created_at DESC';
  const result = await pool.query(query, params);
  return result.rows;
}

async function getById(id) {
  const result = await pool.query(BASE_SELECT + ' WHERE f.id = $1', [id]);
  return result.rows[0] || null;
}

async function getFolders() {
  const result = await pool.query(
    BASE_SELECT + ` WHERE f.object_type = 'folder' ORDER BY f.event_date DESC NULLS LAST, f.created_at DESC`
  );
  return result.rows;
}

async function getIssues(folderId) {
  let query = BASE_SELECT + ` WHERE f.object_type = 'issue'`;
  const params = [];
  if (folderId) {
    params.push(folderId);
    query += ` AND f.parent_id = $1`;
  }
  query += ' ORDER BY f.created_at ASC';
  const result = await pool.query(query, params);
  return result.rows;
}

async function getToday() {
  const today = new Date().toISOString().split('T')[0];
  const result = await pool.query(
    `SELECT f.* FROM shared.feedback f WHERE f.event_date = $1 AND f.parent_id IS NULL AND f.object_type = 'folder' ORDER BY f.created_at DESC LIMIT 1`,
    [today]
  );
  if (result.rows.length) return result.rows[0];
  const ins = await pool.query(
    `INSERT INTO shared.feedback (title, event_date, agenda, object_type, type)
     VALUES ($1, $2, $3, 'folder', 'minutes') RETURNING *`,
    [new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' Meeting', today, ['Finding items demo', 'AI brief parser', 'Open discussion']]
  );
  return ins.rows[0];
}

async function getChildren(parentId) {
  const result = await pool.query(
    BASE_SELECT + ' WHERE f.parent_id = $1 ORDER BY f.created_at ASC',
    [parentId]
  );
  return result.rows;
}

async function create(data) {
  const {
    category_id, subcategory_id, feedback_category_id, area_category_id,
    title, notes, page_url, submitted_by, environment,
    owner, due_date, event_date, parent_id, agenda,
    type, meeting_time, description, object_type, tags, area
  } = data;
  const result = await pool.query(
    `INSERT INTO shared.feedback
       (category_id, subcategory_id, feedback_category_id, area_category_id,
        title, notes, page_url, submitted_by, environment,
        owner, due_date, event_date, parent_id, agenda,
        type, meeting_time, description, object_type, tags, area)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
     RETURNING *`,
    [
      category_id || null, subcategory_id || null, feedback_category_id || null, area_category_id || null,
      title, notes || null, page_url || null, submitted_by || null, environment || 'preview',
      owner || null, due_date || null, event_date || null, parent_id || null, agenda || [],
      type || null, meeting_time || null, description || null, object_type || 'issue', tags || [],
      area || null
    ]
  );
  return result.rows[0];
}

async function getCategories(namespace) {
  const result = await pool.query(
    `SELECT id, name, object_type, icon_name, icon_color,
            tagline, description, parent_id, sort_order, namespace, created_at
       FROM shared.feedback_categories
      WHERE ($1::text IS NULL OR namespace = $1)
      ORDER BY namespace ASC, sort_order ASC, name ASC`,
    [namespace || null]
  );
  return result.rows;
}

async function createCategory(data) {
  const {
    name, namespace, object_type, icon_name, icon_color,
    tagline, description, parent_id, sort_order
  } = data;
  const result = await pool.query(
    `INSERT INTO shared.feedback_categories
       (name, namespace, object_type, icon_name, icon_color,
        tagline, description, parent_id, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      name, namespace || 'area', object_type || null,
      icon_name || null, icon_color || 'var(--theme-bg)',
      tagline || null, description || null,
      parent_id || null, sort_order || 0
    ]
  );
  return result.rows[0];
}

async function patchCategory(id, data) {
  const fields = [];
  const values = [];
  let idx = 1;
  for (const [key, val] of Object.entries(data)) {
    if (['name', 'namespace', 'object_type', 'icon_name', 'icon_color',
         'tagline', 'description', 'parent_id', 'sort_order'].includes(key)) {
      fields.push(`${key} = $${idx}`);
      values.push(val);
      idx++;
    }
  }
  if (!fields.length) {
    const r = await pool.query(`SELECT * FROM shared.feedback_categories WHERE id = $1`, [id]);
    return r.rows[0] || null;
  }
  values.push(id);
  const result = await pool.query(
    `UPDATE shared.feedback_categories SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

async function removeCategory(id) {
  // Detach any feedback rows referencing this category before deleting.
  await pool.query(`UPDATE shared.feedback SET feedback_category_id = NULL WHERE feedback_category_id = $1`, [id]);
  await pool.query(`UPDATE shared.feedback SET area_category_id = NULL WHERE area_category_id = $1`, [id]);
  await pool.query(`DELETE FROM shared.feedback_categories WHERE id = $1`, [id]);
}

async function patch(id, data) {
  const fields = [];
  const values = [];
  let idx = 1;
  for (const [key, val] of Object.entries(data)) {
    if (['title', 'notes', 'owner', 'due_date', 'event_date', 'agenda', 'completed', 'type', 'meeting_time', 'description', 'status', 'object_type', 'feedback_category_id', 'area_category_id', 'tags', 'area', 'version', 'shipped_date', 'priority', 'target_version'].includes(key)) {
      fields.push(`${key} = $${idx}`);
      values.push(val);
      idx++;
    }
  }
  if (!fields.length) return getById(id);
  values.push(id);
  const result = await pool.query(
    `UPDATE shared.feedback SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

async function remove(id) {
  await pool.query('DELETE FROM shared.feedback WHERE parent_id = $1', [id]);
  await pool.query('DELETE FROM shared.feedback WHERE id = $1', [id]);
}

module.exports = {
  getAll, getById, getFolders, getIssues, getToday, getChildren,
  create, patch, remove,
  getCategories, createCategory, patchCategory, removeCategory
};
