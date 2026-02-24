require('dotenv').config({ path: '../.env' });
const { getPool } = require('../db/pool');

(async () => {
  try {
    const pool = await getPool();
    await pool.query(`
      INSERT INTO public.settings (property, value, meta) VALUES 
        ('log_retention', '30', null),
        ('session_retention', '30', null),
        ('responses_retention', '30', null),
        ('default_from_email', 'noreply@example.com', null),
        ('maintenance_mode', 'false', null),
        ('enable_email_notifications', 'true', null),
        ('pending_session_reminder_days', '7', null),
        ('max_login_attempts', '5', null),
        ('dashboard_announcement', '', null)
      ON CONFLICT DO NOTHING;
    `);
    console.log('Successfully seeded settings.');
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();
