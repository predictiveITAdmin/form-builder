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

module.exports = {
  getHomeDashboardData,
};
