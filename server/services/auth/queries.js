const { sql, getPool, query } = require("../../db/pool");

async function ensureUser({ entraObjectId, email, displayName }) {
  // Try find first
  const [u] = await query(
    `
    SELECT user_id FROM Users WHERE entra_object_id = @oid
    `,
    saneParams({ oid: entraObjectId })
  );
  if (u) return u.user_id;

  // Insert
  const pool = await getPool();
  const r = await pool
    .request()
    .input("oid", entraObjectId)
    .input("email", email)
    .input("name", displayName ?? null).query(`
      INSERT INTO Users (entra_object_id, email, display_name)
      OUTPUT INSERTED.user_id
      VALUES (@oid, @email, @name)
    `);
  return r.recordset[0].user_id;
}

module.exports = { ensureUser };
