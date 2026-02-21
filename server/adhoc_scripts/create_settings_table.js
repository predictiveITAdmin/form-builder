require('dotenv').config();
const { getPool } = require('./db/pool');

async function createSettingsTable() {
  const pool = await getPool();
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.settings (
        property VARCHAR(100) PRIMARY KEY,
        value TEXT,
        meta JSONB,
        last_updated TIMESTAMPTZ DEFAULT NOW(),
        updated_by INTEGER REFERENCES public.users(user_id) ON DELETE SET NULL
      );
    `);
    console.log("Settings table created successfully.");
  } catch (err) {
    console.error("Error creating settings table:", err);
  } finally {
    process.exit(0);
  }
}

createSettingsTable();
