const { getPool, query } = require("../../db/pool");

/**
 * Admin list - all forms
 */
async function listForms() {
  return query(
    `
    SELECT
      f.form_id,
      f.title,
      f.description,
      f.status,
      f.owner_user_id,
      f.is_anonymous,
      f.form_key,
      f.created_at,
      f.updated_at,
      u.display_name AS owner_name,
      f.rpa_webhook_url
    FROM Forms f
    LEFT JOIN Users u ON u.user_id = f.owner_user_id
    ORDER BY f.created_at DESC
    `
  );
}
/**
 * End-user list - published only
 */
async function listPublishedForms() {
  return query(
    `
    SELECT
      f.form_id,
      f.title,
      f.description,
      f.status,
      f.owner_user_id,
      f.is_anonymous,
      f.form_key,
      f.created_at,
      f.updated_at,
      u.display_name AS owner_name
    FROM Forms f
    LEFT JOIN Users u ON u.user_id = f.owner_user_id
    WHERE f.status = 'Published'
    ORDER BY f.created_at DESC
    `
  );
}

async function createForm(payload, { owner_user_id = null } = {}) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1) Insert Form
    const formRes = await client.query(
      `
      INSERT INTO Forms
        (title, description, status, owner_user_id, is_anonymous, form_key,
         rpa_webhook_url, rpa_header_key, rpa_secret, rpa_timeout_ms, rpa_retry_count)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, $11)
      RETURNING form_id
      `,
      [
        payload.title,
        payload.description ?? null,
        payload.status ?? "Draft",
        owner_user_id,
        !!payload.is_anonymous,
        payload.form_key ?? null,

        payload.rpa_webhook_url ?? null,
        payload.rpa_secret_method ?? "authorization",
        payload.rpa_secret ?? null,
        payload.rpa_timeout_ms ?? 8000,
        payload.rpa_retry_count ?? 0,
      ]
    );

    const formId = formRes.rows[0].form_id;

    // 2) Insert Steps
    const steps = Array.isArray(payload.steps) ? payload.steps : [];

    for (const step of steps) {
      const stepRes = await client.query(
        `
        INSERT INTO FormSteps
          (form_id, step_number, step_title, step_description, sort_order, is_active)
        VALUES
          ($1,$2,$3,$4,$5,$6)
        RETURNING step_id
        `,
        [
          formId,
          Number(step.step_number),
          step.step_title,
          step.step_description ?? null,
          step.sort_order ?? 0,
          step.is_active !== undefined ? !!step.is_active : true,
        ]
      );

      const stepId = stepRes.rows[0].step_id;

      // 3) Insert Fields for this Step
      const fields = Array.isArray(step.fields) ? step.fields : [];

      for (const field of fields) {
        const fieldRes = await client.query(
          `
          INSERT INTO FormFields
            (form_id, key_name, label, help_text, field_type,
             required, sort_order, config_json, active, form_step_id)
          VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          RETURNING field_id
          `,
          [
            formId,
            field.key_name,
            field.label,
            field.help_text ?? null,
            field.field_type,
            field.required !== undefined ? !!field.required : false,
            field.sort_order ?? 0,
            // store what frontend sends; it is already a string
            field.config_json ?? "{}",
            field.active !== undefined ? !!field.active : true,
            stepId,
          ]
        );

        const fieldId = fieldRes.rows[0].field_id;

        // 4) Insert FieldOptions from payload (static only)
        if (Array.isArray(field.options) && field.options.length) {
          const { sql, params } = buildBulkInsertFieldOptions(
            fieldId,
            field.options
          );
          await client.query(sql, params);
        }
      }
    }

    await client.query("COMMIT");
    return { form_id: formId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function updateFormByKey(
  formKey,
  payload,
  { owner_user_id = null } = {}
) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Resolve form_id
    const formRow = await client.query(
      `SELECT form_id FROM Forms WHERE form_key = $1 LIMIT 1`,
      [formKey]
    );
    const formId = formRow.rows[0]?.form_id;

    if (!formId) {
      await client.query("ROLLBACK");
      return { error: "Form not found" };
    }

    // 1) Update Forms (top-level)
    await client.query(
      `
      UPDATE Forms
      SET
        title = $1,
        description = $2,
        status = $3,
        owner_user_id = COALESCE($4, owner_user_id),
        is_anonymous = $5,
        rpa_webhook_url = $6,
        rpa_header_key = $7,
        rpa_secret = $8,
        rpa_timeout_ms = $9,
        rpa_retry_count = $10,
        updated_at = NOW()
      WHERE form_id = $11
      `,
      [
        payload.title,
        payload.description ?? null,
        payload.status ?? "Draft",
        owner_user_id,
        !!payload.is_anonymous,
        payload.rpa_webhook_url ?? null,
        payload.rpa_secret_method ?? "authorization",
        payload.rpa_secret ?? null,
        payload.rpa_timeout_ms ?? 8000,
        payload.rpa_retry_count ?? 0,
        formId,
      ]
    );

    // 2) Soft-deactivate everything (NO deletes, so FK is happy)
    await client.query(
      `UPDATE FormSteps SET is_active = false WHERE form_id = $1`,
      [formId]
    );
    await client.query(
      `UPDATE FormFields SET active = false WHERE form_id = $1`,
      [formId]
    );

    // 3) Upsert steps + fields
    const steps = Array.isArray(payload.steps) ? payload.steps : [];

    for (const step of steps) {
      // Upsert step via UNIQUE(form_id, step_number)
      const stepRes = await client.query(
        `
        INSERT INTO FormSteps
          (form_id, step_number, step_title, step_description, sort_order, is_active)
        VALUES
          ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (form_id, step_number)
        DO UPDATE SET
          step_title = EXCLUDED.step_title,
          step_description = EXCLUDED.step_description,
          sort_order = EXCLUDED.sort_order,
          is_active = EXCLUDED.is_active
        RETURNING step_id
        `,
        [
          formId,
          Number(step.step_number),
          step.step_title,
          step.step_description ?? null,
          step.sort_order ?? 0,
          step.is_active !== undefined ? !!step.is_active : true,
        ]
      );

      const stepId = stepRes.rows[0].step_id;

      const fields = Array.isArray(step.fields) ? step.fields : [];

      for (const field of fields) {
        // Upsert field via UNIQUE(form_id, key_name)
        const fieldRes = await client.query(
          `
          INSERT INTO FormFields
            (form_id, key_name, label, help_text, field_type,
             required, sort_order, config_json, active, form_step_id)
          VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT (form_id, key_name)
          DO UPDATE SET
            label = EXCLUDED.label,
            help_text = EXCLUDED.help_text,
            field_type = EXCLUDED.field_type,
            required = EXCLUDED.required,
            sort_order = EXCLUDED.sort_order,
            config_json = EXCLUDED.config_json,
            active = EXCLUDED.active,
            form_step_id = EXCLUDED.form_step_id
          RETURNING field_id
          `,
          [
            formId,
            field.key_name,
            field.label,
            field.help_text ?? null,
            field.field_type,
            field.required !== undefined ? !!field.required : false,
            field.sort_order ?? 0,
            field.config_json ?? "{}",
            field.active !== undefined ? !!field.active : true,
            stepId,
          ]
        );

        const fieldId = fieldRes.rows[0].field_id;

        // Replace options for THIS field only
        await client.query(
          `DELETE FROM FieldOptions WHERE form_field_id = $1`,
          [fieldId]
        );

        if (Array.isArray(field.options) && field.options.length) {
          const { sql, params } = buildBulkInsertFieldOptions(
            fieldId,
            field.options
          );
          await client.query(sql, params);
        }
      }
    }

    await client.query("COMMIT");
    return { form_id: formId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function getDynamicUrl(fieldId) {
  const result = await query(
    `
    SELECT config_json
    FROM FormFields
    WHERE field_id = $1
    `,
    [fieldId]
  );
  if (!result.length) {
    throw new Error(`Field with ID ${fieldId} not found`);
  }
  const configJson = result[0].config_json;
  let config;
  try {
    config =
      typeof configJson === "string" ? JSON.parse(configJson) : configJson;
  } catch (err) {
    throw new Error(`Invalid config_json for field ${fieldId}`);
  }

  // Check if dynamic options are enabled and URL exists
  if (config?.dynamicOptions?.enabled && config?.dynamicOptions?.url) {
    return config.dynamicOptions.url;
  }

  throw new Error(
    `Dynamic options not enabled or URL not found for field ${fieldId}`
  );
}

async function saveOptionsToDb(fieldId, options) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1) Delete all existing options for this field
    await client.query(
      `
      DELETE FROM FieldOptions
      WHERE form_field_id = $1
      `,
      [fieldId]
    );

    // 2) Insert new options
    if (Array.isArray(options) && options.length > 0) {
      const valuesWithSource = [];
      const placeholders = [];

      options.forEach((option, index) => {
        const offset = index * 6;
        placeholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${
            offset + 5
          }, $${offset + 6})`
        );
        valuesWithSource.push(
          fieldId,
          option.value,
          option.label,
          option.is_default ?? false,
          option.sort_order ?? index,
          "dynamic"
        );
      });

      const sql = `
        INSERT INTO FieldOptions
          (form_field_id, value, label, is_default, sort_order, source)
        VALUES ${placeholders.join(", ")}
      `;

      await client.query(sql, valuesWithSource);
    }

    await client.query("COMMIT");

    return {
      fieldId,
      optionsInserted: options.length,
      message: "Options saved successfully",
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Build a bulk INSERT for FieldOptions.
 * Expects field.options in shape:
 * [{ label, value, is_default, sort_order }]
 */
function buildBulkInsertFieldOptions(fieldId, options) {
  const rows = [];
  const params = [];

  options.forEach((opt, i) => {
    const base = i * 5;
    rows.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${
        base + 5
      }, 'static')`
    );

    params.push(
      fieldId,
      String(opt.value ?? ""),
      String(opt.label ?? ""),
      !!opt.is_default,
      opt.sort_order ?? i
    );
  });

  const sql = `
    INSERT INTO FieldOptions
      (form_field_id, value, label, is_default, sort_order, source)
    VALUES ${rows.join(", ")}
  `;

  return { sql, params };
}

async function getFormGraphByKey(form_key) {
  return query(
    `
    SELECT
      jsonb_build_object(
        'form_id', f.form_id,
        'title', f.title,
        'description', f.description,
        'status', f.status,
        'rpa_header_key', f.rpa_header_key,
        'owner_user_id', f.owner_user_id,
        'owner_name', u.display_name,
        'is_anonymous', f.is_anonymous,
        'form_key', f.form_key,
        'created_at', f.created_at,
        'updated_at', f.updated_at,
        'rpa_webhook_url', f.rpa_webhook_url,
        'rpa_timeout_ms', f.rpa_timeout_ms,
        'rpa_retry_count', f.rpa_retry_count,
        'steps', COALESCE(steps.steps_json, '[]'::jsonb)
      ) AS form
    FROM Forms f
    LEFT JOIN Users u ON u.user_id = f.owner_user_id
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object(
          'step_id', s.step_id,
          'step_number', s.step_number,
          'step_title', s.step_title,
          'step_description', s.step_description,
          'sort_order', s.sort_order,
          'is_active', s.is_active,
          'fields', COALESCE(fields.fields_json, '[]'::jsonb)
        )
        ORDER BY s.sort_order, s.step_number
      ) AS steps_json
      FROM FormSteps s
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'field_id', ff.field_id,
            'key_name', ff.key_name,
            'label', ff.label,
            'help_text', ff.help_text,
            'field_type', ff.field_type,
            'required', ff.required,
            'sort_order', ff.sort_order,
            'active', ff.active,
            'config_json', ff.config_json,
            'options', COALESCE(opts.options_json, '[]'::jsonb)
          )
          ORDER BY ff.sort_order, ff.field_id
        ) AS fields_json
        FROM FormFields ff
        LEFT JOIN LATERAL (
          SELECT jsonb_agg(
            jsonb_build_object(
              'option_id', fo.option_id,
              'value', fo.value,
              'label', fo.label,
              'is_default', fo.is_default,
              'sort_order', fo.sort_order,
              'source', fo.source,
              'updated_at', fo.updated_at
            )
            ORDER BY fo.sort_order, fo.option_id
          ) AS options_json
          FROM FieldOptions fo
          WHERE fo.form_field_id = ff.field_id
        ) opts ON TRUE
        WHERE ff.form_step_id = s.step_id
          AND ff.active = TRUE
      ) fields ON TRUE
      WHERE s.form_id = f.form_id
        AND s.is_active = TRUE
    ) steps ON TRUE
    WHERE f.form_key = $1
    LIMIT 1
    `,
    [form_key]
  );
}

async function upsertDraftWithValues({ response, response_values }) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      form_id,
      user_id,
      session_token,
      total_steps,
      submitted_at,
      client_ip,
      user_agent,
      meta_json,
    } = response;

    const current_step = meta_json?.current_step ?? null;

    const sessionSql = `
      INSERT INTO public.formsessions
        (form_id, user_id, session_token, current_step, total_steps, is_completed, expires_at, client_ip, user_agent, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, FALSE, (NOW() + INTERVAL '3 months'), $6, $7, NOW(), NOW())
      ON CONFLICT (session_token)
      DO UPDATE SET
        form_id = EXCLUDED.form_id,
        user_id = EXCLUDED.user_id,
        current_step = COALESCE(EXCLUDED.current_step, public.formsessions.current_step),
        total_steps = COALESCE(EXCLUDED.total_steps, public.formsessions.total_steps),
        is_completed = FALSE,
        client_ip = COALESCE(EXCLUDED.client_ip, public.formsessions.client_ip),
        user_agent = COALESCE(EXCLUDED.user_agent, public.formsessions.user_agent),
        updated_at = NOW(),
        expires_at = COALESCE(public.formsessions.expires_at, EXCLUDED.expires_at)
      RETURNING session_id, expires_at, current_step, total_steps, is_completed, session_token;
    `;

    const sessionResult = await client.query(sessionSql, [
      form_id,
      user_id,
      session_token,
      current_step,
      total_steps,
      client_ip,
      user_agent,
    ]);

    const session_id = sessionResult.rows[0].session_id;
    console.log(sessionResult.rows[0].session_id);
    // 2) Upsert response by DB session_id
    // Requires UNIQUE on responses(session_id)
    const responseSql = `
      INSERT INTO public.responses
        (form_id, user_id, submitted_at, client_ip, user_agent, meta_json, session_id)
      VALUES
        ($1, $2, $3, $4, $5, $6::jsonb, $7)
      ON CONFLICT (session_id)
      DO UPDATE SET
        form_id = EXCLUDED.form_id,
        user_id = EXCLUDED.user_id,
        submitted_at = EXCLUDED.submitted_at,
        client_ip = COALESCE(EXCLUDED.client_ip, public.responses.client_ip),
        user_agent = COALESCE(EXCLUDED.user_agent, public.responses.user_agent),
        meta_json = EXCLUDED.meta_json
      RETURNING response_id;
    `;

    const responseResult = await client.query(responseSql, [
      form_id,
      user_id,
      submitted_at,
      client_ip,
      user_agent,
      JSON.stringify(meta_json ?? {}),
      session_id,
    ]);

    const response_id = responseResult.rows[0].response_id;

    // 3) Upsert response values
    // Requires UNIQUE(response_id, form_field_id)
    const valueSql = `
      INSERT INTO public.responsevalues
        (response_id, form_field_id, value_text, value_number, value_date, value_datetime, value_bool, created_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (response_id, form_field_id)
      DO UPDATE SET
        value_text = EXCLUDED.value_text,
        value_number = EXCLUDED.value_number,
        value_date = EXCLUDED.value_date,
        value_datetime = EXCLUDED.value_datetime,
        value_bool = EXCLUDED.value_bool
    `;

    for (const v of response_values) {
      await client.query(valueSql, [
        response_id,
        v.form_field_id,
        v.value_text,
        v.value_number,
        v.value_date,
        v.value_datetime,
        v.value_bool,
      ]);
    }

    await client.query("COMMIT");

    return {
      ok: true,
      session: sessionResult.rows[0],
      session_id, // DB PK (for debugging / internal)
      session_token, // frontend token
      response_id,
      saved_values: response_values.length,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function getDraftSessionsbyUser(user_id) {
  return query(
    `SELECT
    r.response_id,
    r.form_id,
    r.user_id,
    r.submitted_at,
    r.client_ip,
    r.user_agent,
    r.meta_json,
    r.session_id,
    fs.session_token,
    fs.current_step,
    fs.total_steps,
    fs.expires_at,
  fs.session_id,
  fs.is_completed,
    fs.updated_at AS session_updated_at
  FROM public.responses r
  JOIN public.formsessions fs
    ON fs.session_id = r.session_id
  WHERE fs.user_id = $1
    AND fs.is_completed = FALSE
    AND fs.expires_at > NOW()
  ORDER BY fs.updated_at DESC, r.submitted_at DESC NULLS LAST;`,
    user_id
  );
}

async function getSessionData(user_id, session_token) {
  return query(
    `WITH resolved AS (
  SELECT
      ff.key_name,
      COALESCE(
          rv.value_text,
          rv.value_number::text,
          rv.value_date::text,
          rv.value_datetime::text,
          rv.value_bool::text
      ) AS value
  FROM public.responsevalues rv
  JOIN public.formfields ff
      ON ff.field_id = rv.form_field_id
  JOIN public.responses r
  	  ON r.response_id = rv.response_id
  JOIN public.formsessions se
  	  ON se.session_id = r.session_id
  WHERE r.user_id = $1 AND se.session_token = $2
)
SELECT jsonb_object_agg(key_name, value) AS response_data
FROM resolved
WHERE value IS NOT NULL;

`,
    [user_id, session_token]
  );
}

async function selectTotalSteps(formId) {
  const sql = `
    SELECT COUNT(*)::int AS total_steps
    FROM public.formsteps
    WHERE form_id = $1;
  `;
  const result = await query(sql, [formId]);
  return result[0]?.total_steps ?? 0;
}

async function selectFormIdByKey(formKey) {
  const sql = `
    SELECT form_id
    FROM public.forms
    WHERE form_key = $1
    LIMIT 1;
  `;
  const result = await query(sql, [formKey]);
  return result.rows[0]?.form_id ?? null;
}

async function getOrCreateOpenSession(userId, formId, sessionToken) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
      UPDATE public.formsessions
      SET is_completed = TRUE,
          completed_at = NOW(),
          updated_at = NOW()
      WHERE user_id = $1
        AND form_id = $2
        AND is_completed = FALSE
        AND expires_at <= NOW();
      `,
      [userId, formId]
    );

    const totalSteps = await selectTotalSteps(formId);

    if (totalSteps < 0) {
      throw new Error("Form has no steps. Cannot start a session.");
    }

    const sessionSql = `
      INSERT INTO public.formsessions
        (form_id, user_id, session_token, current_step, total_steps, is_completed, expires_at, client_ip, user_agent, created_at, updated_at)
      VALUES
        ($1, $2, $3, 1, $4, FALSE, (NOW() + INTERVAL '3 months'), NULL, NULL, NOW(), NOW())
      ON CONFLICT (user_id, form_id) WHERE (is_completed = FALSE)
      DO UPDATE SET
        is_completed = FALSE,
        total_steps = EXCLUDED.total_steps,
        updated_at = NOW(),
        expires_at = COALESCE(public.formsessions.expires_at, EXCLUDED.expires_at)
      WHERE public.formsessions.is_completed = FALSE
      RETURNING session_id, session_token, current_step, total_steps, expires_at, is_completed, created_at;
    `;

    const token = sessionToken;

    const sessionResult = await client.query(sessionSql, [
      formId,
      userId,
      token,
      totalSteps,
    ]);

    await client.query("COMMIT");

    return sessionResult.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listForms,
  listPublishedForms,
  createForm,
  getFormGraphByKey,
  getDynamicUrl,
  saveOptionsToDb,
  getDraftSessionsbyUser,
  upsertDraftWithValues,
  getSessionData,
  selectFormIdByKey,
  selectTotalSteps,
  getOrCreateOpenSession,
  updateFormByKey,
};
