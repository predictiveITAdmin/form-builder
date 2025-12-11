const { getPool, query } = require("../../db/pool");

async function ensureUser({ entraObjectId, email, displayName }) {
  const existing = await query(
    `SELECT user_id FROM Public.Users WHERE entra_object_id = $1`,
    [entraObjectId]
  );

  console.log(existing);

  if (existing.length > 0) {
    return existing[0].user_id;
  }

  const pool = await getPool();
  const insertResult = await pool.query(
    `
      INSERT INTO Public.Users (entra_object_id, email, display_name)
      VALUES ($1, $2, $3)
      RETURNING user_id
    `,
    [entraObjectId, email, displayName ?? null]
  );

  return insertResult.rows[0].user_id;
}

async function getUserByInviteToken(inviteToken) {
  const result = await query(
    `SELECT * FROM Public.Users WHERE invite_token = $1`,
    [inviteToken]
  );

  return result[0];
}

async function getUserByEmail(email) {
  const result = await query(`SELECT * FROM Public.Users WHERE email = $1`, [
    email,
  ]);
  console.log(result);
  return result[0];
}

async function updateUserCredentials(userId, { password_hash, password_salt }) {
  const pool = await getPool();
  await pool.query(
    `
      UPDATE Public.Users
      SET 
        password_hash = $1,
        password_salt = $2,
        invite_token = NULL,
        invite_token_expires_at = NULL
      WHERE user_id = $3
    `,
    [password_hash, password_salt, userId]
  );
}

async function createExternalUser({
  email,
  displayName,
  inviteToken,
  inviteTokenExpiresAt,
}) {
  const pool = await getPool();

  // We explicitly set user_type to 'External'
  const result = await pool.query(
    `
      INSERT INTO Public.Users (
        email, 
        display_name, 
        user_type, 
        invite_token, 
        invite_token_expires_at
      )
      VALUES ($1, $2, 'External', $3, $4)
      RETURNING user_id, email, invite_token
    `,
    [email, displayName, inviteToken, inviteTokenExpiresAt]
  );

  return result[0];
}

module.exports = {
  ensureUser,
  getUserByInviteToken,
  getUserByEmail,
  updateUserCredentials,
  createExternalUser,
};
