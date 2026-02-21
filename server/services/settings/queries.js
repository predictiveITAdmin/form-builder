const { getPool, query } = require("../../db/pool");

async function getAllSettings() {
  return query(`SELECT property, value, meta, last_updated, updated_by FROM public.settings`);
}

async function updateSetting(property, value, meta, userId) {
  const pool = await getPool();
  const text = `
    INSERT INTO public.settings (property, value, meta, updated_by, last_updated)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (property)
    DO UPDATE SET 
      value = EXCLUDED.value,
      meta = EXCLUDED.meta,
      updated_by = EXCLUDED.updated_by,
      last_updated = NOW()
    RETURNING *;
  `;
  const res = await pool.query(text, [property, String(value), meta ? JSON.stringify(meta) : null, userId]);
  return res.rows[0];
}

async function executeRawSql(sqlString) {
  const pool = await getPool();
  // Using the pool directly to have access to the raw result
  const res = await pool.query(sqlString);
  return res; 
}

module.exports = {
  getAllSettings,
  updateSetting,
  executeRawSql
};
