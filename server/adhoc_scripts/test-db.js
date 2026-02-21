require('dotenv').config();
const { getPool } = require('./db/pool');

async function test() {
  try {
    const pool = await getPool();
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
  } catch(err) {
    console.error(err);
    process.exit(1);
  }
}
test();
