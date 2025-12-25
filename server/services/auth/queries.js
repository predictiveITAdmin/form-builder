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

const getUserById = async (userId) => {
  // Replace with your actual database query
  const query = `
    SELECT 
      user_id,
      email,
      display_name,
      user_type,
      entra_object_id,
      created_at
    FROM users
    WHERE user_id = $1
  `;

  const pool = await getPool();

  const result = await pool.query(query, [userId]);
  return result.rows[0] || null;
};

const getUserByEntraObjectId = async (entraObjectId) => {
  const query = `
    SELECT 
      user_id,
      email,
      display_name,
      user_type,
      entra_object_id,
      created_at
    FROM users
    WHERE entra_object_id = $1
  `;

  const pool = await getPool();

  const result = await pool.query(query, [entraObjectId]);
  return result.rows[0] || null;
};

const getUserByEmail = async (email) => {
  const query = `
    SELECT 
      user_id,
      email,
      display_name,
      user_type,
      entra_object_id,
      created_at,
      password_hash,
      password_salt
    FROM users
    WHERE email = $1
  `;

  const pool = await getPool();

  const result = await pool.query(query, [email]);

  return result.rows[0] || null;
};

const addRole = async (payload) => {
  const pool = await getPool();
  const sql = `INSERT INTO roles (role_name, role_code, description, is_system_role, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *`;
  const params = [
    payload.role_name,
    payload.role_code,
    payload.description,
    payload.is_system_role,
    payload.is_active,
  ];
  const result = await pool.query(sql, params);

  return result.rows[0] || null;
};

const editRole = async (role_id, patch = {}) => {
  const pool = await getPool();
  const client = await pool.connect();
  const allowed = [
    "role_name",
    "role_code",
    "description",
    "is_system_role",
    "is_active",
  ];
  const set = [];
  const params = [];
  let idx = 1;

  allowed.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      set.push(`${key} = $${idx++}`);
      params.push(patch[key]);
    }
  });

  if (set.length === 0) return null;

  set.push(`updated_at = NOW()`);

  const sql = `
      UPDATE roles
      SET ${set.join(", ")}
      WHERE role_id = $${idx}
      RETURNING *
    `;
  params.push(role_id);

  const { rows } = await client.query(sql, params);
  return rows[0] || null;
};

async function deactivateRole(role_id) {
  // Soft remove. Because deleting RBAC entities is how you create haunted systems.
  const pool = await getPool();
  const client = await pool.connect();
  const sql = `
      UPDATE roles
      SET is_active = FALSE, updated_at = NOW()
      WHERE role_id = $1 AND is_system_role = FALSE
      RETURNING *
    `;
  const { rows } = await client.query(sql, [role_id]);
  return rows[0] || null;
}

function allRoles({ includeInactive = false } = {}) {
  const sql = `
    SELECT *
    FROM roles
    WHERE ($1::boolean = TRUE OR is_active = TRUE)
    ORDER BY role_name ASC
  `;
  return query(sql, [includeInactive]);
}

function rolesForUser(user_id, { includeExpired = false } = {}) {
  const sql = `
    SELECT
      ur.user_role_id,
      ur.user_id,
      ur.role_id,
      ur.assigned_at,
      ur.assigned_by,
      ur.expires_at,
      r.role_name,
      r.role_code,
      r.description,
      r.is_system_role,
      r.is_active
    FROM user_roles ur
    JOIN roles r ON r.role_id = ur.role_id
    WHERE ur.user_id = $1
      AND ($2::boolean = TRUE OR ur.expires_at IS NULL OR ur.expires_at > NOW())
    ORDER BY r.role_name ASC
  `;
  return query(sql, [user_id, includeExpired]);
}

async function setUserRoles({
  user_id,
  role_ids,
  assigned_by = null,
  expires_at = null,
}) {
  const pool = await getPool();
  const client = await pool.connect();

  await client.query("BEGIN");

  try {
    await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [user_id]);

    if (Array.isArray(role_ids) && role_ids.length > 0) {
      const values = [];
      const params = [];

      let idx = 1;

      role_ids.forEach((role) => {
        values.push(`($${idx++}, $${idx++}, NOW(), $${idx++}, $${idx++})`);
        params.push(user_id, role, assigned_by, expires_at);
      });

      console.log(values);
      console.log(params);

      const sql = `INSERT INTO user_roles (user_id, role_id, assigned_at, assigned_by, expires_at)
          VALUES ${values.join(", ")}
          RETURNING *`;
      await client.query(sql, params);
    }
    await client.query("COMMIT");

    const { rows } = await client.query(
      `SELECT ur.*, r.role_name, r.role_code, r.description, r.is_system_role, r.is_active
        FROM user_roles ur
        JOIN roles r ON r.role_id = ur.role_id
        WHERE ur.user_id = $1
        ORDER BY r.role_name ASC`,
      [user_id]
    );

    return rows;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  }
}

async function addPermission({
  permission_name,
  permission_code,
  action,
  resource,
  description = null,
}) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    const sql = `
      INSERT INTO permissions
        (permission_name, permission_code, action, resource, description, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `;
    const params = [
      permission_name,
      permission_code,
      action,
      resource,
      description,
    ];
    const { rows } = await client.query(sql, params);
    return rows[0];
  } finally {
    client.release();
  }
}

async function editPermission(permission_id, patch = {}) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    const allowed = [
      "permission_name",
      "permission_code",
      "action",
      "resource",
      "description",
    ];
    const set = [];
    const params = [];
    let idx = 1;

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        set.push(`${key} = $${idx++}`);
        params.push(patch[key]);
      }
    }

    if (set.length === 0) return null; // nothing to update

    set.push(`updated_at = NOW()`);

    const sql = `
      UPDATE permissions
      SET ${set.join(", ")}
      WHERE permission_id = $${idx}
      RETURNING *
    `;
    params.push(permission_id);

    const { rows } = await client.query(sql, params);
    return rows[0] || null;
  } finally {
    client.release();
  }
}

async function removePermission(permission_id) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    const sql = `
      DELETE FROM permissions
      WHERE permission_id = $1
      RETURNING *
    `;
    const { rows } = await client.query(sql, [permission_id]);
    return rows[0] || null;
  } finally {
    client.release();
  }
}

// If you want "getPermission" to return either one or all,
// keep these separated and let controller decide which to call.

function getPermissionById(permission_id) {
  const sql = `
    SELECT *
    FROM permissions
    WHERE permission_id = $1
  `;
  console.log(permission_id);
  return query(sql, [permission_id]);
}

function allPermissions() {
  const sql = `
    SELECT *
    FROM permissions
    ORDER BY resource ASC, action ASC
  `;
  return query(sql);
}

// ---------------- ROLE <-> PERMISSION ----------------

async function setPermissionsForRole({
  role_id,
  permission_ids,
  granted_by = null,
}) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1) Remove existing mappings
    await client.query(`DELETE FROM role_permissions WHERE role_id = $1`, [
      role_id,
    ]);

    // 2) Insert new mappings (if any)
    if (Array.isArray(permission_ids) && permission_ids.length > 0) {
      const values = [];
      const params = [];
      let idx = 1;

      for (const pid of permission_ids) {
        // (role_id, permission_id, granted_at, granted_by)
        values.push(`($${idx++}, $${idx++}, NOW(), $${idx++})`);
        params.push(role_id, pid, granted_by);
      }

      const insertSql = `
        INSERT INTO role_permissions (role_id, permission_id, granted_at, granted_by)
        VALUES ${values.join(", ")}
        RETURNING role_permission_id, role_id, permission_id, granted_at, granted_by
      `;

      await client.query(insertSql, params);
    }

    await client.query("COMMIT");

    // 3) Return updated list with permission details
    const { rows } = await client.query(
      `
      SELECT
        rp.role_permission_id,
        rp.role_id,
        rp.permission_id,
        rp.granted_at,
        rp.granted_by,
        r.role_name,
        r.role_code,
        p.permission_name,
        p.permission_code,
        p.action,
        p.resource,
        p.description
      FROM role_permissions rp
      JOIN permissions p ON p.permission_id = rp.permission_id
      LEFT JOIN roles r ON r.role_id = rp.role_id
      WHERE rp.role_id = $1
      ORDER BY p.resource ASC, p.action ASC
      `,
      [role_id]
    );

    return rows;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function permissionsForRole(role_id) {
  const sql = `
    SELECT
      rp.role_permission_id,
      rp.role_id,
      rp.permission_id,
      rp.granted_at,
      rp.granted_by,
      p.permission_name,
      p.permission_code,
      p.action,
      p.resource,
      p.description
    FROM role_permissions rp
    JOIN permissions p ON p.permission_id = rp.permission_id
    WHERE rp.role_id = $1
    ORDER BY p.resource ASC, p.action ASC
  `;
  return query(sql, [role_id]);
}

module.exports = {
  ensureUser,
  getUserByInviteToken,
  getUserByEmail,
  updateUserCredentials,
  createExternalUser,
  getUserById,
  getUserByEntraObjectId,

  addRole,
  editRole,
  allRoles,
  deactivateRole,
  rolesForUser,
  setUserRoles,

  addPermission,
  editPermission,
  removePermission,
  getPermissionById,
  allPermissions,
  setPermissionsForRole,
  permissionsForRole,
};
