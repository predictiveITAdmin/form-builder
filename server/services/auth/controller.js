const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const queries = require("./queries");
const { authConfig } = require("./authConfig");
const sendInviteEmail = require("./utils");

const hashPassword = (password) => {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(64);
    crypto.pbkdf2(password, salt, 100000, 64, "sha512", (err, derivedKey) => {
      if (err) reject(err);
      resolve({ salt, hash: derivedKey });
    });
  });
};

const verifyPassword = (password, storedHash, storedSalt) => {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      storedSalt,
      100000,
      64,
      "sha512",
      (err, derivedKey) => {
        if (err) reject(err);
        resolve(crypto.timingSafeEqual(storedHash, derivedKey));
      }
    );
  });
};

function badRequest(res, message, details = null) {
  return res.status(400).json({ ok: false, message, details });
}

function serverError(res, err) {
  return res.status(500).json({
    ok: false,
    message: "Server error",
    error: err?.message || String(err),
  });
}

// --- CONTROLLERS ---

module.exports = {
  createPassword: async (req, res) => {
    const { inviteToken, newPassword } = req.body;

    try {
      if (!inviteToken || !newPassword) {
        return res
          .status(400)
          .json({ message: "Token and password are required." });
      }

      const user = await queries.getUserByInviteToken(inviteToken);

      if (!user) {
        return res
          .status(404)
          .json({ message: "Invalid or expired invite token." });
      }

      if (new Date() > new Date(user.invite_token_expires_at)) {
        return res.status(400).json({ message: "Invite token has expired." });
      }

      const { salt, hash } = await hashPassword(newPassword);

      await queries.updateUserCredentials(user.user_id, {
        password_hash: hash,
        password_salt: salt,
        invite_token: null,
        invite_token_expires_at: null,
      });

      return res
        .status(200)
        .json({ message: "Password created successfully. You may now login." });
    } catch (error) {
      console.error("Create Password Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  login: async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password || email === "" || password === "") {
      return res.status(400).json({
        message: "Email and Password are required.",
      });
    }
    try {
      const user = await queries.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials." });
      }

      if (user.user_type === "Internal") {
        return res.status(403).json({
          message:
            "Please use the 'Login with Microsoft' button for this account.",
        });
      }

      if (!user.password_hash || !user.password_salt) {
        return res.status(401).json({
          message: "Account not fully set up. Please check your invite.",
        });
      }

      const isValid = await verifyPassword(
        password,
        user.password_hash,
        user.password_salt
      );

      console.log("Password Matched? " + isValid);

      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials." });
      }
      const token = jwt.sign(
        {
          userId: user.user_id,
          email: user.email,
          role: user.user_type,
          displayName: user.display_name,
        },
        process.env.JWT_SECRET,
        { expiresIn: "8h" }
      );

      return res.status(200).json({
        message: "Login successful",
        token: token,
        user: {
          id: user.user_id,
          email: user.email,
          displayName: user.display_name,
          password: user.password_hash,
          salt: user.password_salt,
        },
      });
    } catch (error) {
      console.error("Login Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  logout: (req, res) => {
    return res.status(200).json({ message: "Logged out successfully." });
  },

  createUser: async (req, res) => {
    const { email, displayName } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    try {
      const existingUser = await queries.getUserByEmail(email);

      if (existingUser) {
        return res
          .status(409)
          .json({ message: "User with this email already exists." });
      }

      const inviteToken = crypto.randomBytes(32).toString("hex");
      const inviteTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await queries.createExternalUser({
        email,
        displayName,
        inviteToken,
        inviteTokenExpiresAt,
      });

      const inviteLink = `${process.env.FRONTEND_URL}/create-password?token=${inviteToken}`;
      sendInviteEmail(email, inviteLink);
      return res
        .status(201)
        .json({ message: "User created and invite email sent." });
    } catch (error) {
      console.error("Create User Error:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  },

  editUser: async (req, res) => {
    try {
      const user_id = Number(req.params.user_id);
      const payload = req.body;

      if (!user_id) {
        return res
          .status(400)
          .json({ message: "User is required to update records" });
      }

      const assigned_by = req.user.userId;

      const result = await queries.editUserDetailsAndRoles(
        user_id,
        payload,
        assigned_by
      );

      return res.status(200).json({
        message: "User record updated successfully",
        ...result,
      });
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({
        message: err.message || "Internal Server Error",
        ...(err.details ? { details: err.details } : {}),
      });
    }
  },

  getMe: async (req, res) => {
    try {
      let user = null;

      if (req.user.type === "internal") {
        if (req.user.idTokenClaims.oid) {
          user = await queries.getUserByEntraObjectId(
            req.user.idTokenClaims.oid
          );
        }
        if (!user && req.user.email) {
          user = await queries.getUserByEmail(req.user.email);
        }

        if (!user) {
          return res.status(404).json({
            success: false,
            message:
              "User not found in database. Please contact administrator.",
          });
        }

        // Return Azure AD user data
        return res.status(200).json({
          success: true,
          data: {
            id: user.user_id,
            email: user.email,
            displayName: user.display_name,
            userType: user.user_type,
            entraObjectId: user.entra_object_id,
            createdAt: user.created_at,
          },
        });
      }

      // External user (JWT)
      if (req.user.type === "external") {
        user = await queries.getUserById(req.user.userId);

        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        // Return external user data
        return res.status(200).json({
          success: true,
          data: {
            id: user.user_id,
            email: user.email,
            displayName: user.display_name,
            userType: user.user_type,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
            lastLoginAt: user.last_login_at,
          },
        });
      }

      // Shouldn't reach here, but just in case
      return res.status(401).json({
        success: false,
        message: "Invalid user type",
      });
    } catch (error) {
      console.error("Error in getMe:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },

  logout: async (req, res) => {
    if (req.session) {
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.status(200).json({ success: true });
      });
    } else {
      res.clearCookie("connect.sid");
      res.status(200).json({ success: true });
    }
  },

  getUser: async (req, res) => {
    const userId = req.params.user_id;
    if (!userId) {
      return badRequest(res, "userId is a required Parameter");
    }
    try {
      const user = await queries.getUser(userId);
      return res.status(200).json(user[0]);
    } catch (err) {
      return serverError(res, err);
    }
  },

  getAllUsers: async (req, res) => {
    const users = await queries.getAllUsers();
    try {
      return res.status(200).json(users);
    } catch (err) {
      return serverError(res, err);
    }
  },

  createRole: async (req, res) => {
    try {
      const { role_name, role_code, description, is_system_role, is_active } =
        req.body;

      if (!role_name || !role_code) {
        return badRequest(res, "role_name and role_code are required");
      }

      const role = await queries.addRole({
        role_name,
        role_code,
        description,
        is_system_role,
        is_active,
      });
      return res.status(201).json(role);
    } catch (err) {
      return serverError(res, err);
    }
  },

  updateRole: async (req, res) => {
    try {
      const role_id = Number(req.params.roleId || req.body.role_id);
      if (!role_id)
        return badRequest(res, "roleId (param) or role_id (body) is required");

      const updated = await queries.editRole(role_id, req.body);
      if (!updated)
        return res
          .status(404)
          .json({ ok: false, message: "Role not found or nothing to update" });

      return res.json(updated);
    } catch (err) {
      return serverError(res, err);
    }
  },

  removeRole: async (req, res) => {
    try {
      const role_id = Number(req.params.roleId || req.body.role_id);
      if (!role_id)
        return badRequest(res, "roleId (param) or role_id (body) is required");

      const removed = await queries.deactivateRole(role_id);
      if (!removed) {
        return res.status(404).json({
          ok: false,
          message:
            "Role not found, or it is a system role (system roles cannot be removed)",
        });
      }

      return res.json(removed);
    } catch (err) {
      return serverError(res, err);
    }
  },

  getRoles: async (req, res) => {
    try {
      const includeInactive =
        String(req.query.includeInactive).toLowerCase() === "true";

      const result = await queries.allRoles({ includeInactive });
      return res.json(result);
    } catch (err) {
      return serverError(res, err);
    }
  },

  getUserRoles: async (req, res) => {
    try {
      const user_id = Number(req.params.userId);
      if (!user_id) return badRequest(res, "userId is required");

      const includeExpired =
        String(req.query.includeExpired).toLowerCase() === "true";
      const result = await queries.rolesForUser(user_id, { includeExpired });
      return res.json(result);
    } catch (err) {
      return serverError(res, err);
    }
  },

  assignUserRoles: async (req, res) => {
    try {
      const userId = req.user.userId;
      const { user_id, role_ids, expires_at = null } = req.body;

      if (!user_id) return badRequest(res, "user_id is required");
      if (!Array.isArray(role_ids))
        return badRequest(res, "role_ids must be an array");

      const rows = await queries.setUserRoles({
        user_id,
        role_ids,
        assigned_by: userId,
        expires_at,
      });
      return res.json(rows);
    } catch (err) {
      return serverError(res, err);
    }
  },

  createPermission: async (req, res) => {
    try {
      const {
        permission_name,
        permission_code,
        action,
        resource,
        description,
      } = req.body;

      if (!permission_name || !permission_code || !action || !resource) {
        return badRequest(
          res,
          "permission_name, permission_code, action, and resource are required"
        );
      }

      const created = await queries.addPermission({
        permission_name,
        permission_code,
        action,
        resource,
        description,
      });

      return res.status(201).json(created);
    } catch (err) {
      // if you have unique constraints, pg will throw 23505 on duplicates
      if (err?.code === "23505") {
        return res.status(409).json({
          ok: false,
          message: "Permission already exists",
          error: err.detail,
        });
      }
      return serverError(res, err);
    }
  },

  updatePermission: async (req, res) => {
    try {
      const permission_id = Number(req.params.permissionId);
      if (!permission_id)
        return badRequest(res, "permissionId param is required");

      const updated = await queries.editPermission(permission_id, req.body);
      if (!updated) {
        return res.status(404).json({
          ok: false,
          message: "Permission not found or nothing to update",
        });
      }

      return res.json(updated);
    } catch (err) {
      if (err?.code === "23505") {
        return res.status(409).json({
          ok: false,
          message: "Duplicate permission_code",
          error: err.detail,
        });
      }
      return serverError(res, err);
    }
  },

  deletePermission: async (req, res) => {
    try {
      const permission_id = Number(req.params.permissionId);
      if (!permission_id)
        return badRequest(res, "permissionId param is required");

      const removed = await queries.removePermission(permission_id);
      if (!removed)
        return res
          .status(404)
          .json({ ok: false, message: "Permission not found" });

      return res.json(removed);
    } catch (err) {
      return serverError(res, err);
    }
  },

  getPermission: async (req, res) => {
    try {
      // If :permissionId exists -> single; else -> list all
      const permissionIdParam = req.params.permissionId;

      if (permissionIdParam) {
        const permission_id = Number(permissionIdParam);
        if (!permission_id)
          return badRequest(res, "permissionId param must be a number");

        const result = await queries.getPermissionById(permissionIdParam);
        console.log(result);
        const row = result[0];
        if (!row)
          return res
            .status(404)
            .json({ ok: false, message: "Permission not found" });

        return res.json(row);
      }

      const result = await queries.allPermissions();
      return res.json(result);
    } catch (err) {
      return serverError(res, err);
    }
  },

  setPermissionsForRole: async (req, res) => {
    try {
      const { role_id, permission_ids } = req.body;
      const granted_by = req.user.userId;

      if (!role_id) return badRequest(res, "role_id is required");
      if (!Array.isArray(permission_ids))
        return badRequest(res, "permission_ids must be an array");

      // optional: validate array contents
      const cleaned = permission_ids.map(Number).filter(Boolean);

      const updated = await queries.setPermissionsForRole({
        role_id,
        permission_ids: cleaned,
        granted_by,
      });

      return res.status(200).json(updated);
    } catch (err) {
      if (err?.code === "23503") {
        return res.status(400).json({
          ok: false,
          message: "Invalid role_id or permission_id (FK violation)",
        });
      }
      return serverError(res, err);
    }
  },
};
