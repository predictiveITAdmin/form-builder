require('dotenv').config({ path: '../.env' });
const { getPool } = require('../db/pool');

(async () => {
  try {
    const pool = await getPool();
    await pool.query(`
      INSERT INTO public.settings (property, value, meta) VALUES 
        ('log_retention', '30', null),
        ('session_retention', '30', null),
        ('responses_retention', '30', null)
      ON CONFLICT DO NOTHING;
    `);
    console.log('Successfully seeded settings.');
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();
