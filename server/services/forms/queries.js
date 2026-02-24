const { getPool, query } = require("../../db/pool");

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
      f.usage_mode,
      f.created_at,
      f.updated_at,
      u.display_name AS owner_name,
      f.rpa_webhook_url,
      COUNT(fa.user_id) AS assigned_user_count
    FROM Forms f
    LEFT JOIN Users u
      ON u.user_id = f.owner_user_id
    LEFT JOIN form_access fa
      ON fa.form_id = f.form_id
    GROUP BY
      f.form_id,
      f.title,
      f.description,
      f.status,
      f.usage_mode, 
      f.owner_user_id,
      f.is_anonymous,
      f.form_key,
      f.created_at,
      f.updated_at,
      u.display_name,
      f.rpa_webhook_url
    ORDER BY f.created_at DESC;`,
  );
}
/**
 * End-user list - published only
 */
async function listPublishedForms(userId) {
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
    INNER JOIN form_access fa
      ON fa.form_id = f.form_id
    INNER JOIN Users u
      ON u.user_id = f.owner_user_id
    WHERE
      f.status ILIKE 'published'
      AND fa.user_id = $1
      AND COALESCE(f.usage_mode, 'standalone') IN ('standalone', 'both')
    ORDER BY f.created_at DESC;`,
    [userId],
  );
}

async function listWorkFlowForms() {
  const sql = `SELECT
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
          LEFT JOIN Users u
            ON u.user_id = f.owner_user_id
          WHERE
            f.status ILIKE 'published'
            AND f.usage_mode = 'workflow_only'
          ORDER BY f.created_at DESC`;
  return await query(sql);
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
        usage_mode, rpa_webhook_url, rpa_header_key, rpa_secret, rpa_timeout_ms, rpa_retry_count)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING form_id
      `,
      [
        payload.title,
        payload.description ?? null,
        payload.status ?? "Draft",
        owner_user_id,
        !!payload.is_anonymous,
        payload.form_key ?? null,
        payload.usage_mode ?? "standalone",
        payload.rpa_webhook_url ?? null,
        payload.rpa_secret_method ?? "authorization",
        payload.rpa_secret ?? null,
        payload.rpa_timeout_ms ?? 8000,
        payload.rpa_retry_count ?? 0,
      ],
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
        ],
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
            field.config_json ?? "{}",
            field.active !== undefined ? !!field.active : true,
            stepId,
          ],
        );

        const fieldId = fieldRes.rows[0].field_id;

        if (Array.isArray(field.options) && field.options.length) {
          const { sql, params } = buildBulkInsertFieldOptions(
            fieldId,
            field.options,
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
  { owner_user_id = null } = {},
) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Resolve form_id
    const formRow = await client.query(
      `SELECT form_id FROM Forms WHERE form_key = $1 LIMIT 1`,
      [formKey],
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
        usage_mode = $12,
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
        payload.rpa_secret_method == ""
          ? "authorization"
          : payload.rpa_secret_method,
        payload.rpa_secret ?? null,
        payload.rpa_timeout_ms ?? 8000,
        payload.rpa_retry_count ?? 0,
        formId,
        payload.usage_mode ?? "standalone",
      ],
    );

    // 2) Soft-deactivate everything (NO deletes, so FK is happy)
    await client.query(
      `UPDATE FormSteps SET is_active = false WHERE form_id = $1`,
      [formId],
    );
    await client.query(
      `UPDATE FormFields SET active = false WHERE form_id = $1`,
      [formId],
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
        ],
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
          ],
        );

        const fieldId = fieldRes.rows[0].field_id;

        // Replace options for THIS field only
        await client.query(
          `DELETE FROM FieldOptions WHERE form_field_id = $1`,
          [fieldId],
        );

        if (Array.isArray(field.options) && field.options.length) {
          const { sql, params } = buildBulkInsertFieldOptions(
            fieldId,
            field.options,
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
    SELECT key_name,label,help_text, config_json
    FROM FormFields
    WHERE field_id = $1
    `,
    [fieldId],
  );

  const sql = await query(
    `SELECT key_name,label,help_text
    FROM FormFields
    WHERE field_id = $1`,
    [fieldId],
  );
  if (!result.length || !sql.length) {
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
    return { url: config.dynamicOptions.url, data: sql[0] };
  }

  throw new Error(
    `Dynamic options not enabled or URL not found for field ${fieldId}`,
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
      [fieldId],
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
          }, $${offset + 6})`,
        );
        valuesWithSource.push(
          fieldId,
          option.value,
          option.label,
          option.is_default ?? false,
          option.sort_order ?? index,
          "dynamic",
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
      }, 'static')`,
    );

    params.push(
      fieldId,
      String(opt.value ?? ""),
      String(opt.label ?? ""),
      !!opt.is_default,
      opt.sort_order ?? i,
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
        'usage_mode', f.usage_mode,
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
    [form_key],
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

    const fieldIds = response_values.map(v => v.form_field_id);
    let fieldTypes = {};
    if (fieldIds.length > 0) {
      const fieldsSql = `SELECT field_id, field_type FROM public.formfields WHERE field_id = ANY($1::int[])`;
      const fieldsRes = await client.query(fieldsSql, [fieldIds]);
      fieldsRes.rows.forEach(r => { fieldTypes[r.field_id] = r.field_type; });
    }

    const { encrypt } = require("../../utils/encryption");

    for (const v of response_values) {
      let finalValueText = v.value_text;
      if (fieldTypes[v.form_field_id] === 'password' && finalValueText) {
         // Prevent re-encrypting if it somehow already looks like our encrypted hash (very unlikely edge case, but safe to check)
         if (!finalValueText.includes(':') || finalValueText.split(':').length !== 3) {
             finalValueText = encrypt(finalValueText);
         }
      }

      await client.query(valueSql, [
        response_id,
        v.form_field_id,
        finalValueText,
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
    user_id,
  );
}

async function validateAccess(user_id, formKey) {
  const res = await query(
    `
    SELECT 1
    FROM form_access fa
    JOIN forms f ON f.form_id = fa.form_id
    WHERE fa.user_id = $1
      AND f.form_key = $2
    LIMIT 1
    `,
    [user_id, formKey],
  );

  const itemAccess = await query(
    `SELECT 1
      FROM workflow_items wi
      JOIN workflow_forms wf ON wf.workflow_form_id = wi.workflow_form_id
      JOIN forms f ON f.form_id = wf.form_id
      WHERE wi.assigned_user_id = $1
        AND f.form_key = $2
      LIMIT 1;`,
    [user_id, formKey],
  );

  return res.length > 0 || itemAccess.length > 0;
}

async function getSessionData(user_id, session_token) {
  const res = await query(
    `
  SELECT
      ff.key_name,
      ff.field_type,
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
  AND COALESCE(
          rv.value_text,
          rv.value_number::text,
          rv.value_date::text,
          rv.value_datetime::text,
          rv.value_bool::text
      ) IS NOT NULL;
`,
    [user_id, session_token],
  );

  const { decrypt } = require("../../utils/encryption");
  const response_data = {};
  
  for (const row of res) {
    if (row.field_type === 'password' && row.value) {
      response_data[row.key_name] = decrypt(row.value) || "";
    } else {
      response_data[row.key_name] = row.value;
    }
  }

  return [{ response_data }];
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
  return result[0]?.form_id ?? null;
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
      [userId, formId],
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

async function fetchFormUsers(formId) {
  const sql = `
  SELECT fa.user_id, fa.form_id, u.display_name, u.is_active, f.title, f.form_key from Forms f
LEFT JOIN form_access fa ON fa.form_id = f.form_id
LEFT JOIN Users u on u.user_id = fa.user_id WHERE fa.form_id = $1`;

  return query(sql, [formId]);
}

async function setFormUsers(formId, userIds, grantedBy) {
  const pool = await getPool();
  if (!Array.isArray(userIds)) {
    throw new Error("setFormUsers: userIds must be an array");
  }

  const cleanUserIds = [...new Set(userIds)]
    .filter(
      (x) => Number.isInteger(x) || (typeof x === "string" && x.trim() !== ""),
    )
    .map((x) => Number(x))
    .filter((x) => Number.isInteger(x));

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const delRes = await client.query(
      `DELETE FROM form_access WHERE form_id = $1`,
      [formId],
    );

    if (cleanUserIds.length === 0) {
      await client.query("COMMIT");
      return { deleted: delRes.rowCount ?? 0, inserted: 0 };
    }

    const insRes = await client.query(
      `
      INSERT INTO form_access (form_id, user_id, granted_at, granted_by)
      SELECT $1, u.user_id, NOW(), $2
      FROM UNNEST($3::int[]) AS u(user_id)
      `,
      [formId, grantedBy, cleanUserIds],
    );

    await client.query("COMMIT");
    return {
      deleted: delRes.rowCount ?? 0,
      inserted: insRes.rowCount ?? cleanUserIds.length,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function deleteForm(form_id) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const sql = `DELETE FROM forms where form_id = $1 RETURNING title, form_id, form_key `;
    const result = await client.query(sql, [form_id]);
    await client.query("COMMIT");
    return {
      result,
      message: "Form Deleted Successfully",
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function getRpaSubmissionBundleByResponseId(responseId) {
  // 1) Base response + session + form (includes RPA settings)
  const base = await query(
    `
    SELECT
      r.response_id,
      r.form_id,
      r.user_id,
      u.display_name,
      u.email,

      r.submitted_at,
      r.client_ip,
      r.user_agent,
      r.meta_json,
      r.session_id,

      s.session_token,
      s.current_step,
      s.total_steps,
      s.is_completed AS session_is_completed,
      s.expires_at,
      s.created_at AS session_created_at,
      s.updated_at AS session_updated_at,
      s.completed_at AS session_completed_at,
      s.is_active AS session_is_active,
      s.workflow_run_id AS session_workflow_run_id,
      s.workflow_item_id AS session_workflow_item_id,

      f.form_key,
      f.title AS form_title,
      f.description AS form_description,
      f.status AS form_status,
      f.usage_mode AS form_usage_mode,
      f.owner_user_id AS form_owner_user_id,

      f.rpa_webhook_url,
      f.rpa_secret,
      f.rpa_timeout_ms,
      f.rpa_retry_count,
      f.rpa_header_key
    FROM public.responses r
    JOIN public.formsessions s ON s.session_id = r.session_id
    JOIN public.forms f ON f.form_id = r.form_id
    JOIN public.users u on u.user_id = r.user_id
    WHERE r.response_id = $1
    LIMIT 1;
    `,
    [responseId],
  );

  const head = base?.[0];
  if (!head) return null;

  // 2) Values + selected options + field metadata
  const valueRows = await query(
    `
    SELECT
  rv.response_value_id,
  rv.response_id,
  rv.form_field_id,

  ff.key_name,
  ff.label,
  ff.field_type,
  ff.required,
  ff.sort_order,
  ff.config_json,

  rv.value_text,
  rv.value_number,
  rv.value_date,
  rv.value_datetime,
  rv.value_bool,

  COALESCE(opt.selected_options, '[]'::jsonb) AS selected_options

FROM public.responsevalues rv
JOIN public.formfields ff
  ON ff.field_id = rv.form_field_id

LEFT JOIN LATERAL (
  SELECT
    COALESCE(
      jsonb_agg(t.obj ORDER BY t.sort_order, t.option_id),
      '[]'::jsonb
    ) AS selected_options
  FROM (
    SELECT DISTINCT
      fo.option_id,
      fo.sort_order,
      jsonb_build_object(
        'option_id', fo.option_id,
        'option_value', fo.value,
        'option_label', fo.label,
        'is_default', fo.is_default,
        'sort_order', fo.sort_order,
        'source', fo.source
      ) AS obj
    FROM public.fieldoptions fo
    WHERE fo.form_field_id = ff.field_id
      AND rv.value_text IS NOT NULL
      AND btrim(rv.value_text) <> ''
      AND (
        -- Case A: value_text is a single selection (ex: "US" or "12")
        (
          left(btrim(rv.value_text), 1) <> '['
          AND (fo.value = rv.value_text OR fo.option_id::text = rv.value_text)
        )

        OR

        -- Case B: value_text is a JSON array string (ex: ["US","CA"] or ["12","14"])
        (
          left(btrim(rv.value_text), 1) = '['
          AND (
            fo.value IN (
              SELECT jsonb_array_elements_text(rv.value_text::jsonb)
            )
            OR fo.option_id::text IN (
              SELECT jsonb_array_elements_text(rv.value_text::jsonb)
            )
          )
        )
      )
  ) t
) opt ON TRUE

WHERE rv.response_id = $1
ORDER BY ff.sort_order, ff.field_id;
    `,
    [responseId],
  );

  // 3) File uploads linked to this response (and optionally by form_field_id)
  const files = await query(
    `
    WITH file_field_ids AS (
      SELECT DISTINCT rv.form_field_id
      FROM public.responsevalues rv
      JOIN public.formfields ff
        ON ff.field_id = rv.form_field_id
      WHERE rv.response_id = $1
        AND ff.field_type = 'file'
    ),
    response_session AS (
      SELECT s.session_token
      FROM public.responses r
      JOIN public.formsessions s ON s.session_id = r.session_id
      WHERE r.response_id = $1
      LIMIT 1
    )
    SELECT
      fu.file_id,
      fu.container,
      fu.blob_name,
      fu.original_name,
      fu.mime_type,
      fu.size_bytes,
      fu.sha256,
      fu.etag,
      fu.status,
      fu.created_at,
      fu.uploaded_by,
      fu.session_token,
      fu.response_id,
      fu.form_field_id
    FROM public.file_uploads fu
    WHERE fu.status = 'active'
      AND fu.form_field_id IN (SELECT form_field_id FROM file_field_ids)
      AND (
        -- match this response's session when possible (prevents cross-session collisions)
        fu.session_token IS NULL
        OR fu.session_token = (SELECT session_token FROM response_session)
      )
    ORDER BY fu.created_at ASC;
    `,
    [responseId],
  );

  // 4) Optional workflow context (only if tied)
  let workflow = null;

  const workflowItemId = head.session_workflow_item_id;
  const workflowRunId = head.session_workflow_run_id;

  if (workflowItemId || workflowRunId) {
    // Resolve by item if available, else run
    const wfHeadRows = await query(
      `
      SELECT
        w.workflow_id,
        w.workflow_key,
        w.title AS workflow_title,
        w.description AS workflow_description,
        w.status AS workflow_status,

        wr.workflow_run_id,
        wr.display_name AS workflow_run_display_name,
        wr.status AS workflow_run_status,
        wr.locked_at,
        wr.locked_by,
        wr.created_by AS workflow_run_created_by,
        wr.cancelled_at,
        wr.cancelled_reason,
        wr.created_at AS workflow_run_created_at,
        wr.updated_at AS workflow_run_updated_at,

        wi.workflow_item_id,
        wi.sequence_num,
        wi.status AS workflow_item_status,
        wi.assigned_user_id,
        wi.skipped_reason,
        wi.display_name as item_display_name,
        wi.completed_at AS workflow_item_completed_at,
        wi.created_at AS workflow_item_created_at,
        wi.updated_at AS workflow_item_updated_at,

        wf.workflow_form_id,
        wf.required AS workflow_form_required,
        wf.allow_multiple AS workflow_form_allow_multiple,
        wf.sort_order AS workflow_form_sort_order,

        f2.form_id AS workflow_form_form_id,
        f2.form_key AS workflow_form_form_key,
        f2.title AS workflow_form_title
      FROM public.workflow_runs wr
      JOIN public.workflows w ON w.workflow_id = wr.workflow_id
      LEFT JOIN public.workflow_items wi
        ON wi.workflow_run_id = wr.workflow_run_id
        AND ($1::int IS NOT NULL AND wi.workflow_item_id = $1 OR $1::int IS NULL)
      LEFT JOIN public.workflow_forms wf
        ON wf.workflow_form_id = wi.workflow_form_id
      LEFT JOIN public.forms f2
        ON f2.form_id = wf.form_id
      WHERE wr.workflow_run_id = COALESCE($2::int, wr.workflow_run_id)
        AND (
          ($1::int IS NOT NULL AND wi.workflow_item_id = $1)
          OR ($1::int IS NULL AND wr.workflow_run_id = $2)
        )
      LIMIT 1;
      `,
      [workflowItemId ?? null, workflowRunId ?? null],
    );

    const wfHead = wfHeadRows?.[0] ?? null;

    // Also include run items list (useful for orchestration UIs / RPA decisions)
    let runItems = [];
    if (wfHead?.workflow_run_id) {
      runItems = await query(
        `
        SELECT
          wi.workflow_item_id,
          wi.sequence_num,
          wi.status,
          wi.assigned_user_id,
          wi.skipped_reason,
          wi.completed_at,
          wi.created_at,
          wi.updated_at,
          wf.workflow_form_id,
          wf.required,
          wf.allow_multiple,
          wf.sort_order,
          f.form_id,
          f.form_key,
          f.title AS form_title
        FROM public.workflow_items wi
        JOIN public.workflow_forms wf ON wf.workflow_form_id = wi.workflow_form_id
        JOIN public.forms f ON f.form_id = wf.form_id
        WHERE wi.workflow_run_id = $1
        ORDER BY wf.sort_order, wi.sequence_num, wi.workflow_item_id;
        `,
        [wfHead.workflow_run_id],
      );
    }

    workflow = wfHead
      ? {
          workflow: {
            id: wfHead.workflow_id,
            key: wfHead.workflow_key,
            title: wfHead.workflow_title,
            description: wfHead.workflow_description,
            status: wfHead.workflow_status,
          },
          run: {
            id: wfHead.workflow_run_id,
            display_name: wfHead.workflow_run_display_name,
            status: wfHead.workflow_run_status,
            locked_at: wfHead.locked_at,
            locked_by: wfHead.locked_by,
            created_by: wfHead.workflow_run_created_by,
            cancelled_at: wfHead.cancelled_at,
            cancelled_reason: wfHead.cancelled_reason,
            created_at: wfHead.workflow_run_created_at,
            updated_at: wfHead.workflow_run_updated_at,
          },
          item: wfHead.workflow_item_id
            ? {
                id: wfHead.workflow_item_id,
                sequence_num: wfHead.sequence_num,
                status: wfHead.workflow_item_status,
                assigned_user_id: wfHead.assigned_user_id,
                skipped_reason: wfHead.skipped_reason,
                completed_at: wfHead.workflow_item_completed_at,
                created_at: wfHead.workflow_item_created_at,
                updated_at: wfHead.workflow_item_updated_at,
              }
            : null,
          workflow_form: wfHead.workflow_form_id
            ? {
                id: wfHead.workflow_form_id,
                required: wfHead.workflow_form_required,
                allow_multiple: wfHead.workflow_form_allow_multiple,
                sort_order: wfHead.workflow_form_sort_order,
                form: wfHead.workflow_form_form_id
                  ? {
                      id: wfHead.workflow_form_form_id,
                      key: wfHead.workflow_form_form_key,
                      title: wfHead.workflow_form_title,
                    }
                  : null,
              }
            : null,
          run_items: runItems,
        }
      : null;
  }

  // Build values + maps
  const values = [];
  const value_map = {};

  for (const row of valueRows) {
    const typedValue =
      row.value_text ??
      row.value_number ??
      row.value_date ??
      row.value_datetime ??
      row.value_bool ??
      null;

    const vObj = {
      response_value_id: row.response_value_id,
      form_field_id: row.form_field_id,
      key_name: row.key_name,
      label: row.label,
      field_type: row.field_type,
      required: row.required,
      sort_order: row.sort_order,
      config_json: row.config_json,
      value: typedValue,
      selected_options: row.selected_options, // [] if none
      files: files.filter((f) => f.form_field_id === row.form_field_id),
    };

    values.push(vObj);
    value_map[row.key_name] = typedValue;
  }

  return {
    form: {
      id: head.form_id,
      key: head.form_key,
      title: head.form_title,
      description: head.form_description,
      status: head.form_status,
      usage_mode: head.form_usage_mode,
      owner_user_id: head.form_owner_user_id,
      rpa: {
        webhook_url: head.rpa_webhook_url,
        header_key: head.rpa_header_key,
        secret: head.rpa_secret,
        timeout_ms: head.rpa_timeout_ms,
        retry_count: head.rpa_retry_count,
      },
    },
    session: {
      id: head.session_id,
      token: head.session_token,
      current_step: head.current_step,
      total_steps: head.total_steps,
      is_completed: head.session_is_completed,
      is_active: head.session_is_active,
      expires_at: head.expires_at,
      created_at: head.session_created_at,
      updated_at: head.session_updated_at,
      completed_at: head.session_completed_at,
      workflow_run_id: head.session_workflow_run_id,
      workflow_item_id: head.session_workflow_item_id,
    },
    response: {
      id: head.response_id,
      form_id: head.form_id,
      user_id: head.user_id,
      submitted_at: head.submitted_at,
      client_ip: head.client_ip,
      user_agent: head.user_agent,
      meta_json: head.meta_json,
      session_id: head.session_id,
    },
    values,
    value_map,
    files, // all files on the response (field-linked and general)
    workflow, // null if standalone
  };
}

async function markWorkflowItemSubmitted(workflowItemId) {
  const res = await query(
    `
    UPDATE public.workflow_items
    SET
      status = 'submitted',
      completed_at = COALESCE(completed_at, NOW()),
      updated_at = NOW()
    WHERE workflow_item_id = $1
    RETURNING workflow_item_id, status, completed_at;
    `,
    [workflowItemId],
  );
  return res?.[0] ?? null;
}

// queries.js
async function completeOpenSessionByFormAndUser(formId, userId) {
  const res = await query(
    `
    UPDATE public.formsessions
    SET
      is_completed = TRUE,
      completed_at = NOW(),
      updated_at = NOW(),
      is_active = FALSE
    WHERE form_id = $1
      AND user_id = $2
      AND is_completed = FALSE
    RETURNING session_id, session_token, form_id, user_id, completed_at;
    `,
    [formId, userId],
  );

  return res?.[0] ?? null;
}

async function createOptionsJob(job) {
  await query(
    `
    INSERT INTO options_jobs
      (job_id, form_key, field_id, requester_user_id, requester_email, requester_type, callback_token, status)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,'pending')
    `,
    [
      job.job_id,
      job.form_key,
      job.field_id,
      job.requester_user_id,
      job.requester_email,
      job.requester_type,
      job.callback_token,
    ],
  );
}

async function getOptionsJob(jobId) {
  const rows = await query(`SELECT * FROM options_jobs WHERE job_id = $1`, [
    jobId,
  ]);
  return rows[0] || null;
}

async function completeOptionsJob(jobId) {
  await query(
    `
    UPDATE options_jobs
    SET status='completed', completed_at=(now() AT TIME ZONE 'UTC')
    WHERE job_id = $1 AND status='pending'
    `,
    [jobId],
  );
}

module.exports = {
  createOptionsJob,
  getOptionsJob,
  completeOptionsJob,
  listForms,
  listPublishedForms,
  createForm,
  getFormGraphByKey,
  markWorkflowItemSubmitted,
  getRpaSubmissionBundleByResponseId,
  getDynamicUrl,
  saveOptionsToDb,
  getDraftSessionsbyUser,
  upsertDraftWithValues,
  getSessionData,
  selectFormIdByKey,
  selectTotalSteps,
  getOrCreateOpenSession,
  updateFormByKey,
  fetchFormUsers,
  setFormUsers,
  listWorkFlowForms,
  validateAccess,
  completeOpenSessionByFormAndUser,
  deleteForm,
};
