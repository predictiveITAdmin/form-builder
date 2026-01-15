const { getPool, query } = require("../../db/pool");

async function ensureUser({ entraObjectId, email, displayName }) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1) Find existing user by entra_object_id
    const existingRes = await client.query(
      `SELECT user_id FROM public.users WHERE entra_object_id = $1 LIMIT 1`,
      [entraObjectId]
    );

    if (existingRes.rows.length > 0) {
      await client.query("COMMIT");
      return existingRes.rows[0].user_id;
    }

    // 2) Insert user (new login)
    const insertRes = await client.query(
      `
        INSERT INTO public.users (entra_object_id, email, display_name)
        VALUES ($1, $2, $3)
        RETURNING user_id
      `,
      [entraObjectId, email, displayName ?? null]
    );

    const userId = insertRes.rows[0].user_id;

    // 3) If nobody has SUPER_ADMIN yet, give it to this first user
    //    This is safe + deterministic inside the transaction.
    const superRoleRes = await client.query(
      `SELECT role_id FROM public.roles WHERE role_code = 'SUPER_ADMIN' LIMIT 1`
    );

    if (superRoleRes.rows.length === 0) {
      // roles seed didn't run or role_code mismatch
      throw new Error("SUPER_ADMIN role not found. Ensure init seed ran.");
    }

    const superRoleId = superRoleRes.rows[0].role_id;

    const superAlreadyAssignedRes = await client.query(
      `
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON r.role_id = ur.role_id
        WHERE r.role_code = 'SUPER_ADMIN'
        LIMIT 1
      `
    );

    if (superAlreadyAssignedRes.rows.length === 0) {
      // Assign SUPER_ADMIN to this first user
      await client.query(
        `
          INSERT INTO public.user_roles (user_id, role_id, assigned_at, assigned_by, expires_at)
          VALUES ($1, $2, CURRENT_TIMESTAMP, NULL, NULL)
          ON CONFLICT DO NOTHING
        `,
        [userId, superRoleId]
      );
    } else {
      // Optional: assign USER role to everyone else (if you want default access)
      // If you already assign roles elsewhere, you can remove this block.
      const userRoleRes = await client.query(
        `SELECT role_id FROM public.roles WHERE role_code = 'USER' LIMIT 1`
      );

      if (userRoleRes.rows.length > 0) {
        await client.query(
          `
            INSERT INTO public.user_roles (user_id, role_id, assigned_at, assigned_by, expires_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP, NULL, NULL)
            ON CONFLICT DO NOTHING
          `,
          [userId, userRoleRes.rows[0].role_id]
        );
      }
    }

    await client.query("COMMIT");
    return userId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function setInviteTokenForUserEmail(
  email,
  { inviteToken, inviteTokenExpiresAt }
) {
  const pool = await getPool();

  const result = await pool.query(
    `
      UPDATE public.users
      SET
        invite_token = $1,
        invite_token_expires_at = $2
      WHERE email = $3
      RETURNING user_id, email, user_type
    `,
    [inviteToken, inviteTokenExpiresAt, email]
  );

  return result.rows[0] || null;
}

async function getUser(userId) {
  return query(
    `SELECT
  u.user_id,
  u.email,
  u.display_name,
  u.user_type,
  u.is_active,
  u.created_at,
  COALESCE(
    json_agg(
      json_build_object(
        'role_name', r.role_name,
		'role_code', r.role_code,
        'description', r.description
      )
    ) FILTER (WHERE r.role_id IS NOT NULL),
    '[]'
  ) AS roles
FROM Users u
LEFT JOIN user_roles ur ON ur.user_id = u.user_id
LEFT JOIN roles r ON r.role_id = ur.role_id
WHERE u.user_id = $1
GROUP BY u.user_id;`,
    [userId]
  );
}

async function getUserPermissionsByUserId(userId) {
  const sql = `
    SELECT DISTINCT
      p.permission_id,
      p.permission_name,
      p.permission_code,
      p.description,
      p.resource,
      p.action
    FROM user_roles ur
    JOIN role_permissions rp
      ON rp.role_id = ur.role_id
    JOIN permissions p
      ON p.permission_id = rp.permission_id
    WHERE ur.user_id = $1
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    ORDER BY p.resource NULLS FIRST, p.action NULLS FIRST, p.permission_code;
  `;
  return query(sql, [userId]);
}

async function getAllUsers() {
  return query(`SELECT
  u.user_id,
  u.email,
  u.display_name,
  u.user_type,
  u.is_active,
  u.created_at,
  COALESCE(
    json_agg(
      json_build_object(
        'role_name', r.role_name,
		'role_code', r.role_code,
        'description', r.description
      )
    ) FILTER (WHERE r.role_id IS NOT NULL),
    '[]'
  ) AS roles
FROM Users u
LEFT JOIN user_roles ur ON ur.user_id = u.user_id
LEFT JOIN roles r ON r.role_id = ur.role_id
GROUP BY u.user_id;`);
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

const editUserDetails = async (user_id, payload) => {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    const { display_name, is_active } = payload;

    const sql = `
      UPDATE public.users
      SET
        display_name = $1,
        is_active = $2
      WHERE user_id = $3
      RETURNING user_id, display_name, is_active;
    `;

    const { rows } = await client.query(sql, [
      display_name,
      is_active,
      user_id,
    ]);

    if (rows.length === 0) {
      throw new Error(`User not found: ${user_id}`);
    }

    return rows[0];
  } catch (error) {
    console.error("editUser failed:", error);
    throw error;
  } finally {
    client.release();
  }
};

async function getRoleIdsByCodes(roleCodes = []) {
  const pool = await getPool();
  const { rows } = await pool.query(
    `SELECT role_id, role_code
     FROM roles
     WHERE role_code = ANY($1::text[]) AND is_active = true`,
    [roleCodes]
  );

  const map = new Map(rows.map((r) => [r.role_code, r.role_id]));
  return { map, rows };
}

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
      AND is_system_role = FALSE
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
        SELECT 
        r.role_id, 
        r.role_name, 
        r.role_code, 
        r.description, 
        r.is_system_role, 
        r.is_active, 
        r.created_at, 
        r.updated_at,
        COALESCE(u.user_count, 0) as role_to_users,
        COALESCE(p.permission_count, 0) as permission_to_roles
    FROM public.roles r
    LEFT JOIN (
        SELECT role_id, COUNT(*) as user_count
        FROM user_roles
        GROUP BY role_id
    ) u ON u.role_id = r.role_id
    LEFT JOIN (
        SELECT role_id, COUNT(*) as permission_count
        FROM role_permissions
        GROUP BY role_id
    ) p ON p.role_id = r.role_id
     WHERE ($1::boolean = TRUE OR is_active = TRUE)
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

const editUserDetailsAndRoles = async (
  user_id,
  payload,
  assigned_by = null
) => {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { display_name, is_active } = payload;

    const updateUserSql = `
      UPDATE public.users
      SET
        display_name = $1,
        is_active = $2
      WHERE user_id = $3
      RETURNING user_id, display_name, is_active;
    `;

    const userResult = await client.query(updateUserSql, [
      display_name,
      is_active,
      user_id,
    ]);

    if (userResult.rows.length === 0) {
      throw new Error(`User not found: ${user_id}`);
    }

    const updatedUser = userResult.rows[0];

    if (payload.roles !== undefined && !Array.isArray(payload.roles)) {
      const err = new Error("roles must be an array");
      err.statusCode = 400;
      throw err;
    }

    let updatedRoles = [];

    if (Array.isArray(payload.roles)) {
      const roleCodes = [
        ...new Set(
          payload.roles.map((r) => (r?.role_code || "").trim()).filter(Boolean)
        ),
      ];

      await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [
        user_id,
      ]);

      if (roleCodes.length > 0) {
        const roleLookup = await client.query(
          `
          SELECT role_id, role_code
          FROM roles
          WHERE role_code = ANY($1::text[])
            AND is_active = true
          `,
          [roleCodes]
        );

        const codeToId = new Map(
          roleLookup.rows.map((r) => [r.role_code, r.role_id])
        );
        const missing = roleCodes.filter((code) => !codeToId.has(code));

        if (missing.length > 0) {
          const err = new Error("Invalid or inactive role_code provided");
          err.statusCode = 400;
          err.details = { missing };
          throw err;
        }

        const role_ids = roleCodes.map((code) => codeToId.get(code));

        const expires_at = payload.expires_at ?? null;

        const values = [];
        const params = [];
        let idx = 1;

        role_ids.forEach((roleId) => {
          values.push(`($${idx++}, $${idx++}, NOW(), $${idx++}, $${idx++})`);
          params.push(user_id, roleId, assigned_by, expires_at);
        });

        await client.query(
          `
          INSERT INTO user_roles (user_id, role_id, assigned_at, assigned_by, expires_at)
          VALUES ${values.join(", ")}
          `,
          params
        );
      }

      const rolesResult = await client.query(
        `
        SELECT ur.*, r.role_name, r.role_code, r.description, r.is_system_role, r.is_active
        FROM user_roles ur
        JOIN roles r ON r.role_id = ur.role_id
        WHERE ur.user_id = $1
        ORDER BY r.role_name ASC
        `,
        [user_id]
      );

      updatedRoles = rolesResult.rows;
    }

    await client.query("COMMIT");

    return {
      user: updatedUser,
      roles: updatedRoles,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("editUserDetailsAndRoles failed:", error);
    throw error;
  } finally {
    client.release();
  }
};

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

function getPermissionsFromRole(role_id) {
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
  setInviteTokenForUserEmail,

  getUserByInviteToken,
  getUserByEmail,
  updateUserCredentials,
  createExternalUser,
  getUserById,
  getUserByEntraObjectId,
  getUserPermissionsByUserId,

  getAllUsers,
  getUser,
  editUserDetails,

  addRole,
  getRoleIdsByCodes,
  editRole,
  allRoles,
  deactivateRole,
  rolesForUser,
  editUserDetailsAndRoles,

  addPermission,
  editPermission,
  removePermission,
  getPermissionById,
  allPermissions,
  setPermissionsForRole,

  getPermissionsFromRole,
};
