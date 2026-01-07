const { getPool, query } = require("../../db/pool");

const getResponses = async () => {
  const sql = `SELECT r.response_id, CASE WHEN s.is_completed = TRUE THEN 'Submitted' ELSE 'Pending' END AS status, r.form_id, f.title, f.description, f.rpa_webhook_url, u.display_name, u.email, r.submitted_at, r.client_ip, r.user_agent, r.meta_json, r.session_id
	FROM public.responses r
	LEFT JOIN public.Forms f on f.form_id = r.form_id
	LEFT JOIN public.Users u on u.user_id = r.user_id
	LEFT JOIN public.formsessions s on s.session_id = r.session_id`;

  return await query(sql);
};

const getResponseById = async (response_id) => {
  const sql = `SELECT
    r.response_id,
    CASE WHEN s.is_completed = TRUE THEN 'Submitted' ELSE 'Pending' END AS status,

    -- Form info
    r.form_id,
    f.form_key,
    f.title,
    f.description,
    f.status              AS form_status,
    f.rpa_webhook_url,

    -- User info
    u.user_id,
    u.display_name,
    u.email,
    u.user_type,
    u.entra_object_id,

    -- Response info
    r.submitted_at,
    r.client_ip           AS response_client_ip,
    r.user_agent          AS response_user_agent,
    r.meta_json,
    r.session_id,

    -- Session info (useful for a details page / audit trail)
    s.created_at          AS session_started_at,
    s.updated_at          AS session_updated_at,
    s.completed_at,
    s.expires_at,
    s.current_step,
    s.total_steps,
    s.is_active,
    s.session_token,

    -- All response values as JSON keyed by field key_name (fallback to label / id)
    v.response_values


FROM public.responses r
LEFT JOIN public.forms f
    ON f.form_id = r.form_id
LEFT JOIN public.users u
    ON u.user_id = r.user_id
LEFT JOIN public.formsessions s
    ON s.session_id = r.session_id

LEFT JOIN LATERAL (
    SELECT
        jsonb_object_agg(
            COALESCE(ff.key_name, ff.label, ff.field_id::text),
            jsonb_strip_nulls(
                jsonb_build_object(
                    'form_field_id', ff.field_id,
                    'label',         ff.label,
                    'field_type',    ff.field_type,
                    'required',      ff.required,
                    'value_text',    rv.value_text,
                    'value_number',  rv.value_number,
                    'value_bool',    rv.value_bool,
                    'value_date',    rv.value_date,
                    'value_datetime',rv.value_datetime
                )
            )
        ) AS response_values
    FROM public.responsevalues rv
    JOIN public.formfields ff
        ON ff.field_id = rv.form_field_id
    WHERE rv.response_id = r.response_id
) v ON TRUE



WHERE r.response_id = $1;
`;

  return await query(sql, [response_id]);
};

module.exports = { getResponses, getResponseById };
