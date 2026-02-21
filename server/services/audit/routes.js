const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../../middlewares/authMiddleware");
const { hasAnyPermission } = require("../../middlewares/permissionMiddleware");
const { query } = require("../../db/pool");

/**
 * Compares two JSONB snapshots and returns only what changed.
 * Handles: flat objects, nested objects, arrays, nulls (create/delete).
 */
function computeDiff(oldVal, newVal, method) {
  // If method is POST treat as full create
  if (method === "POST") {
    const changes = [];
    const keys = Object.keys(newVal || {});
    for (const key of keys) {
      if (["updated_at", "created_at", "__v"].includes(key)) continue;
      changes.push({ field: key, from: null, to: newVal[key] });
    }
    return { type: "create", changes };
  }

  // DELETE
  if (method === "DELETE" || (oldVal && !newVal)) {
    return { type: "delete", changes: [] };
  }

  // No data at all
  if (!oldVal && !newVal) {
    return { type: "unknown", changes: [] };
  }

  const allKeys = new Set([
    ...Object.keys(oldVal || {}),
    ...Object.keys(newVal  || {}),
  ]);

  const changes = [];

  for (const key of allKeys) {
    const from = oldVal?.[key] ?? null;
    const to   = newVal?.[key]  ?? null;

    // Skip internal/noisy fields
    if (["updated_at", "created_at", "__v"].includes(key)) continue;

    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes.push({ field: key, from, to });
    }
  }

  return {
    type: changes.length > 0 ? "update" : "no_change",
    changes,
  };
}

/**
 * GET /api/audit/:resourceType/:resourceId
 * Returns paginated audit history with old/new values computed via LAG()
 */
router.get(
  "/:resourceType/:resourceId",
  authMiddleware,
  // Assuming 'super_admin' or a suitable read permission acts as audit.read
  hasAnyPermission(["settings.read", "roles.read", "users.read", "super_admin"]),
  async (req, res, next) => {
    try {
      const { resourceType, resourceId } = req.params;
      const page  = Math.max(1, parseInt(req.query.page  || "1"));
      const limit = Math.min(100, parseInt(req.query.limit || "20"));
      const offset = (page - 1) * limit;

      const rows = await query(
        `SELECT
           id,
           timestamp,
           user_id,
           user_name,
           username,
           auth_source,
           http_method,
           route,
           response_status,
           request_body AS new_value,
           LAG(request_body) OVER (
             PARTITION BY resource_type, resource_id
             ORDER BY timestamp ASC
           ) AS old_value
         FROM audit_logs
         WHERE resource_type    = $1
           AND resource_id      = $2
           AND response_status BETWEEN 200 AND 299
         ORDER BY timestamp DESC
         LIMIT $3 OFFSET $4`,
        [resourceType, resourceId, limit, offset]
      );

      // Total count for pagination
      const rowsCount = await query(
        `SELECT COUNT(*) AS count
         FROM audit_logs
         WHERE resource_type = $1
           AND resource_id   = $2
           AND response_status BETWEEN 200 AND 299`,
        [resourceType, resourceId]
      );
      const count = rowsCount[0]?.count || 0;

      return res.json({
        success: true,
        data: rows.map((row) => ({
          ...row,
          diff: computeDiff(row.old_value, row.new_value, row.http_method),
        })),
        pagination: {
          page,
          limit,
          total: parseInt(count),
          totalPages: Math.ceil(count / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/audit/:resourceType
 * All recent activity across a resource type (e.g. all form changes)
 */
router.get(
  "/:resourceType",
  authMiddleware,
  hasAnyPermission(["settings.read", "roles.read", "users.read", "super_admin"]),
  async (req, res, next) => {
    try {
      const { resourceType } = req.params;
      const page   = Math.max(1, parseInt(req.query.page  || "1"));
      const limit  = Math.min(100, parseInt(req.query.limit || "20"));
      const offset = (page - 1) * limit;

      const rows = await query(
        `SELECT
           id,
           timestamp,
           user_id,
           user_name,
           username,
           resource_type,
           auth_source,
           http_method,
           resource_id,
           route,
           response_status,
           request_body AS new_value,
           LAG(request_body) OVER (
             PARTITION BY resource_type, resource_id
             ORDER BY timestamp ASC
           ) AS old_value
         FROM audit_logs
         WHERE resource_type    = $1
           AND response_status BETWEEN 200 AND 299
         ORDER BY timestamp DESC
         LIMIT $2 OFFSET $3`,
        [resourceType, limit, offset]
      );

      const rowsCount = await query(
        `SELECT COUNT(*) AS count FROM audit_logs
         WHERE resource_type = $1 AND response_status BETWEEN 200 AND 299`,
        [resourceType]
      );
      const count = rowsCount[0]?.count || 0;

      return res.json({
        success: true,
        data: rows.map((row) => ({
          ...row,
          diff: computeDiff(row.old_value, row.new_value, row.http_method),
        })),
        pagination: {
          page,
          limit,
          total: parseInt(count),
          totalPages: Math.ceil(count / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
