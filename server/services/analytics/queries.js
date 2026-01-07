const { getPool, query } = require("../../db/pool");

async function getHomeDashboardData(userId) {
  const pool = await getPool();

  const sessionsQuery = `
    SELECT
  fs.session_id::text AS id,
  f.form_key          AS "formCode",
  f.title             AS "formName",
  COALESCE(p.filled_fields, 0)::int AS "progressCurrent",
  COALESCE(t.total_fields, 0)::int  AS "progressTotal",
  fs.updated_at AT TIME ZONE 'UTC'  AS "updatedAt"
FROM formsessions fs
JOIN forms f ON f.form_id = fs.form_id

LEFT JOIN LATERAL (
  SELECT COUNT(*) AS total_fields
  FROM formfields ff
  WHERE ff.form_id = fs.form_id
    AND COALESCE(ff.active, true) = true
) t ON true

LEFT JOIN LATERAL (
  SELECT r.response_id
  FROM responses r
  WHERE r.session_id = fs.session_id
    AND r.user_id = fs.user_id
    AND r.form_id = fs.form_id
  ORDER BY r.response_id DESC
  LIMIT 1
) lr ON true

LEFT JOIN LATERAL (
  SELECT COUNT(DISTINCT rv.form_field_id) AS filled_fields
  FROM responsevalues rv
  JOIN formfields ff
    ON ff.field_id = rv.form_field_id
   AND ff.form_id = fs.form_id
   AND COALESCE(ff.active, true) = true
  WHERE rv.response_id = lr.response_id
    AND (
      (rv.value_text IS NOT NULL AND BTRIM(rv.value_text) <> '')
      OR rv.value_number IS NOT NULL
      OR rv.value_date IS NOT NULL
      OR rv.value_datetime IS NOT NULL
      OR rv.value_bool IS NOT NULL
    )
) p ON true

WHERE fs.user_id = $1
  AND COALESCE(fs.is_active, true) = true
  AND COALESCE(fs.is_completed, false) = false
ORDER BY fs.updated_at DESC
LIMIT 5;

  `;

  const availableFormsQuery = `
    SELECT
  f.form_key::text AS id,          -- if your frontend expects id
  f.form_key       AS "formCode",  -- explicit
  f.title          AS name,
  f.description    AS description,
  GREATEST(1, CEIL(COALESCE(ff.active_field_count, 0) / 3.0))::int AS "estMinutes"
FROM forms f
JOIN form_access fa
  ON fa.form_id = f.form_id
 AND fa.user_id = $1
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS active_field_count
  FROM formfields
  WHERE form_id = f.form_id
    AND COALESCE(active, true) = true
) ff ON true
WHERE COALESCE(f.status, '') NOT IN ('Archived', 'Deleted')
ORDER BY f.updated_at DESC, f.form_id DESC
LIMIT 10;
  `;

  const recentSubmissionsQuery = `
    SELECT
  r.response_id::text AS id,
  f.title AS "formName",
  r.submitted_at AT TIME ZONE 'UTC' AS "submittedAt"
FROM responses r
JOIN forms f ON f.form_id = r.form_id
LEFT JOIN formsessions fs ON fs.session_id = r.session_id
WHERE r.user_id = $1
  AND (
    r.session_id IS NULL
    OR COALESCE(fs.is_completed, false) = true
  )
ORDER BY r.submitted_at DESC NULLS LAST, r.response_id DESC
LIMIT 3;
  `;

  const [sessionsRes, availableFormsRes, recentSubsRes] = await Promise.all([
    pool.query(sessionsQuery, [userId]),
    pool.query(availableFormsQuery, [userId]),
    pool.query(recentSubmissionsQuery, [userId]),
  ]);

  return {
    sessions: (sessionsRes.rows || []).map((x) => ({
      ...x,
      updatedAt: x.updatedAt ? new Date(x.updatedAt).toISOString() : null,
    })),
    availableForms: availableFormsRes.rows || [],
    recentSubmissions: (recentSubsRes.rows || []).map((x) => ({
      ...x,
      submittedAt: x.submittedAt ? new Date(x.submittedAt).toISOString() : null,
    })),
  };
}

async function getAdminDashboardData() {
  const pool = await getPool();

  // ---- FORMS ----
  const formsByStatusQuery = `
    SELECT
      COALESCE(status, 'Draft') AS status,
      COUNT(*)::int AS count
    FROM forms
    WHERE COALESCE(status, '') NOT IN ('Archived', 'Deleted')
    GROUP BY 1
    ORDER BY 1;
  `;

  const formsAccessSummaryQuery = `
    SELECT
      f.form_id::int AS "formId",
      f.title         AS title,
      COALESCE(f.status, 'Draft') AS status,
      COUNT(fa.user_id)::int AS "usersWithAccess"
    FROM forms f
    LEFT JOIN form_access fa ON fa.form_id = f.form_id
    WHERE COALESCE(f.status, '') NOT IN ('Archived', 'Deleted')
    GROUP BY f.form_id, f.title, f.status
    ORDER BY "usersWithAccess" DESC, f.updated_at DESC
    LIMIT 25;
  `;

  // ---- RESPONSES ----
  const responsesByWeekQuery = `
    SELECT
      date_trunc('week', r.submitted_at)::date::text AS "bucketStart",
      COUNT(*)::int AS "responsesSubmitted"
    FROM responses r
    WHERE r.submitted_at >= (now() - interval '12 weeks')
    GROUP BY 1
    ORDER BY 1;
  `;

  const responsesByMonthQuery = `
    SELECT
      date_trunc('month', r.submitted_at)::date::text AS "bucketStart",
      COUNT(*)::int AS "responsesSubmitted"
    FROM responses r
    WHERE r.submitted_at >= (now() - interval '12 months')
    GROUP BY 1
    ORDER BY 1;
  `;

  const sessionsVsResponsesByWeekQuery = `
    WITH sessions AS (
      SELECT
        date_trunc('week', created_at)::date::text AS "bucketStart",
        COUNT(*)::int AS "sessionsStarted"
      FROM formsessions
      WHERE created_at >= (now() - interval '12 weeks')
      GROUP BY 1
    ),
    resp AS (
      SELECT
        date_trunc('week', submitted_at)::date::text AS "bucketStart",
        COUNT(*)::int AS "responsesSubmitted"
      FROM responses
      WHERE submitted_at >= (now() - interval '12 weeks')
      GROUP BY 1
    )
    SELECT
      COALESCE(s."bucketStart", r."bucketStart") AS "bucketStart",
      COALESCE(s."sessionsStarted", 0)::int AS "sessionsStarted",
      COALESCE(r."responsesSubmitted", 0)::int AS "responsesSubmitted"
    FROM sessions s
    FULL OUTER JOIN resp r USING ("bucketStart")
    ORDER BY 1;
  `;

  const completionRateByWeekQuery = `
    SELECT
      date_trunc('week', fs.created_at)::date::text AS "bucketStart",
      COUNT(*)::int AS "sessionsStarted",
      COUNT(*) FILTER (WHERE COALESCE(fs.is_completed,false)=true)::int AS "sessionsCompleted",
      ROUND(
        (COUNT(*) FILTER (WHERE COALESCE(fs.is_completed,false)=true))::numeric
        / NULLIF(COUNT(*), 0) * 100, 2
      )::float8 AS "completionRatePercent"
    FROM formsessions fs
    WHERE fs.created_at >= (now() - interval '12 weeks')
    GROUP BY 1
    ORDER BY 1;
  `;

  // ---- FILES ----
  const filesByWeekQuery = `
    SELECT
      date_trunc('week', fu.created_at)::date::text AS "bucketStart",
      COUNT(*)::int AS "filesUploaded",
      ROUND(SUM(COALESCE(fu.size_bytes, 0)) / 1024.0 / 1024.0, 2)::float8 AS "totalMB"
    FROM file_uploads fu
    WHERE fu.created_at >= (now() - interval '12 weeks')
      AND fu.deleted_at IS NULL
    GROUP BY 1
    ORDER BY 1;
  `;

  const filesByStatusQuery = `
    SELECT
      COALESCE(status, 'unknown') AS status,
      COUNT(*)::int AS count
    FROM file_uploads
    WHERE created_at >= (now() - interval '30 days')
      AND deleted_at IS NULL
    GROUP BY 1
    ORDER BY count DESC, status;
  `;

  const topFormsBySizeQuery = `
    SELECT
      f.form_id::int AS "formId",
      f.title         AS title,
      COUNT(fu.file_id)::int AS "fileCount",
      ROUND(SUM(COALESCE(fu.size_bytes, 0)) / 1024.0 / 1024.0, 2)::float8 AS "totalMB"
    FROM file_uploads fu
    JOIN responses r ON r.response_id = fu.response_id
    JOIN forms f ON f.form_id = r.form_id
    WHERE fu.created_at >= (now() - interval '30 days')
      AND fu.deleted_at IS NULL
    GROUP BY f.form_id, f.title
    ORDER BY "totalMB" DESC, "fileCount" DESC
    LIMIT 10;
  `;

  // ---- USERS / ROLES / PERMISSIONS ----
  const usersActiveInactiveQuery = `
    SELECT
      COALESCE(is_active, true) AS "isActive",
      COUNT(*)::int AS count
    FROM users
    GROUP BY 1
    ORDER BY "isActive" DESC;
  `;

  const usersByRoleQuery = `
    SELECT
      r.role_id::int AS "roleId",
      r.role_name     AS "roleName",
      r.role_code     AS "roleCode",
      COUNT(ur.user_id) FILTER (
        WHERE ur.expires_at IS NULL OR ur.expires_at > now()
      )::int AS "usersInRole"
    FROM roles r
    LEFT JOIN user_roles ur ON ur.role_id = r.role_id
    GROUP BY r.role_id, r.role_name, r.role_code
    ORDER BY "usersInRole" DESC, r.role_name;
  `;

  const rolesByPermissionCountQuery = `
    SELECT
      r.role_id::int AS "roleId",
      r.role_name     AS "roleName",
      COUNT(rp.permission_id)::int AS "permissionCount"
    FROM roles r
    LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
    GROUP BY r.role_id, r.role_name
    ORDER BY "permissionCount" DESC, r.role_name;
  `;

  const topUsersByPermissionCountQuery = `
    WITH user_perm AS (
      SELECT
        ur.user_id,
        COUNT(DISTINCT rp.permission_id)::int AS permission_count
      FROM user_roles ur
      JOIN role_permissions rp ON rp.role_id = ur.role_id
      WHERE ur.expires_at IS NULL OR ur.expires_at > now()
      GROUP BY ur.user_id
    )
    SELECT
      u.user_id::int AS "userId",
      u.display_name AS "displayName",
      u.email         AS email,
      COALESCE(u.is_active, true) AS "isActive",
      COALESCE(up.permission_count, 0)::int AS "permissionCount"
    FROM users u
    LEFT JOIN user_perm up ON up.user_id = u.user_id
    ORDER BY "permissionCount" DESC, "isActive" DESC
    LIMIT 20;
  `;

  const [
    formsByStatus,
    formsAccessSummary,
    responsesByWeek,
    responsesByMonth,
    sessionsVsResponsesByWeek,
    completionRateByWeek,
    filesByWeek,
    filesByStatus,
    topFormsBySize,
    usersActiveInactive,
    usersByRole,
    rolesByPermissionCount,
    topUsersByPermissionCount,
  ] = await Promise.all([
    pool.query(formsByStatusQuery),
    pool.query(formsAccessSummaryQuery),
    pool.query(responsesByWeekQuery),
    pool.query(responsesByMonthQuery),
    pool.query(sessionsVsResponsesByWeekQuery),
    pool.query(completionRateByWeekQuery),
    pool.query(filesByWeekQuery),
    pool.query(filesByStatusQuery),
    pool.query(topFormsBySizeQuery),
    pool.query(usersActiveInactiveQuery),
    pool.query(usersByRoleQuery),
    pool.query(rolesByPermissionCountQuery),
    pool.query(topUsersByPermissionCountQuery),
  ]);

  // Access hover: you can keep it simple for now (counts only) and lazy-load the user list later
  const accessHover = {};
  for (const row of formsAccessSummary.rows || []) {
    accessHover[row.formId] = { usersWithAccess: row.usersWithAccess };
  }

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      range: {
        from: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90)
          .toISOString()
          .slice(0, 10), // ~90d
        to: new Date().toISOString().slice(0, 10),
      },
    },
    forms: {
      byStatus: formsByStatus.rows || [],
      accessSummary: formsAccessSummary.rows || [],
      accessHover,
    },
    responses: {
      byWeek: responsesByWeek.rows || [],
      byMonth: responsesByMonth.rows || [],
      sessionsVsResponsesByWeek: sessionsVsResponsesByWeek.rows || [],
      completionRateByWeek: completionRateByWeek.rows || [],
    },
    files: {
      byWeek: filesByWeek.rows || [],
      byStatus: filesByStatus.rows || [],
      topFormsBySize: topFormsBySize.rows || [],
    },
    users: {
      activeInactive: usersActiveInactive.rows || [],
      byRole: usersByRole.rows || [],
      rolesByPermissionCount: rolesByPermissionCount.rows || [],
      topUsersByPermissionCount: topUsersByPermissionCount.rows || [],
    },
  };
}

module.exports = {
  getHomeDashboardData,
  getAdminDashboardData,
};
