const { getPool, query } = require("../../db/pool");

async function listPublishedForms() {
  return query(
    `SELECT f.form_id, f.title, f.description, f.status, f.owner_user_id, f.is_anonymous, f.created_at, f.updated_at, u.display_name AS owner_name
        FROM Forms f
        LEFT JOIN Users u ON f.owner_user_id = u.user_id
        WHERE f.status = 'Published'
        ORDER BY f.created_at DESC`
  );
}

async function getFormWithFields(
  formId,
  { includeOptions = false, sessionToken = null, userId = null } = {}
) {
  const forms = await query(
    `SELECT form_id, title, description, status, is_anonymous,
           created_at, updated_at, form_key, owner_user_id
      FROM Forms
     WHERE form_id = $1`,
    [Number(formId)]
  );

  if (forms.length === 0) return null;
  const form = forms[0];

  // Get form steps if they exist
  const steps = await query(
    `SELECT step_id, step_number, step_title, step_description, sort_order
      FROM FormSteps
     WHERE form_id = $1 AND is_active = TRUE
     ORDER BY sort_order ASC, step_number ASC`,
    [Number(formId)]
  );

  // Get fields with step information
  const fields = await query(
    `SELECT ff.field_id, ff.key_name, ff.label, ff.help_text, ff.field_type,
           ff.required, ff.sort_order, ff.config_json, ff.active, ff.form_step_id,
           fs.step_number, fs.step_title
      FROM FormFields ff
      LEFT JOIN FormSteps fs ON fs.step_id = ff.form_step_id
     WHERE ff.form_id = $1
     ORDER BY COALESCE(fs.sort_order, 0) ASC, ff.sort_order ASC, ff.field_id ASC`,
    [Number(formId)]
  );

  // Get existing session if provided
  let session = null;
  let savedData = null;
  let stepProgress = null;

  if (sessionToken || userId) {
    session = await getActiveSession(formId, { sessionToken, userId });

    if (session) {
      // Load saved draft data
      savedData = await getSessionDraftData(session.session_id);

      // Load step progress
      stepProgress = await query(
        `SELECT step_number, is_completed, is_validated, completed_at, validation_errors
          FROM SessionStepProgress
         WHERE session_id = $1
         ORDER BY step_number ASC`,
        [session.session_id]
      );
    }
  }

  if (!includeOptions || fields.length === 0) {
    return {
      form,
      steps: steps.length > 0 ? steps : null,
      fields,
      session,
      savedData,
      stepProgress,
    };
  }

  // Load field options
  const fieldIds = fields.map((f) => f.field_id);
  const placeholders = fieldIds.map((_, i) => `$${i + 1}`).join(", ");

  const options = await query(
    `SELECT form_field_id AS field_id, value, label, is_default, sort_order
      FROM FieldOptions
     WHERE form_field_id IN (${placeholders})
     ORDER BY sort_order ASC, option_id ASC`,
    fieldIds
  );

  const byField = new Map();
  for (const o of options) {
    const arr = byField.get(o.field_id) || [];
    arr.push({
      value: o.value,
      label: o.label,
      is_default: o.is_default,
      sort_order: o.sort_order,
    });
    byField.set(o.field_id, arr);
  }

  const fieldsWithOptions = fields.map((f) => ({
    ...f,
    options: byField.get(f.field_id) || [],
  }));

  return {
    form,
    steps: steps.length > 0 ? steps : null,
    fields: fieldsWithOptions,
    session,
    savedData,
    stepProgress,
  };
}

async function getActiveSession(
  formId,
  { sessionToken = null, userId = null }
) {
  let sessionQuery;
  let params;

  if (userId) {
    // Authenticated user - find by user_id
    sessionQuery = `
      SELECT session_id, form_id, user_id, session_token, current_step, 
             total_steps, is_completed, expires_at, created_at, updated_at
      FROM FormSessions
      WHERE form_id = $1 AND user_id = $2 AND is_completed = FALSE
        AND (expires_at IS NULL OR expires_at > NOW() AT TIME ZONE 'UTC')
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    params = [formId, userId];
  } else if (sessionToken) {
    // Anonymous user - find by session_token
    sessionQuery = `
      SELECT session_id, form_id, user_id, session_token, current_step, 
             total_steps, is_completed, expires_at, created_at, updated_at
      FROM FormSessions
      WHERE form_id = $1 AND session_token = $2 AND is_completed = FALSE
        AND (expires_at IS NULL OR expires_at > NOW() AT TIME ZONE 'UTC')
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    params = [formId, sessionToken];
  } else {
    return null;
  }

  const sessions = await query(sessionQuery, params);
  return sessions.length > 0 ? sessions[0] : null;
}

async function getSessionDraftData(sessionId) {
  const draftData = await query(
    `SELECT ssd.session_step_data_id, ssd.step_number, ssd.form_field_id,
            ssd.value_text, ssd.value_number, ssd.value_date, 
            ssd.value_datetime, ssd.value_bool,
            ff.key_name, ff.field_type
      FROM SessionStepData ssd
      JOIN FormFields ff ON ff.field_id = ssd.form_field_id
     WHERE ssd.session_id = $1
     ORDER BY ssd.step_number, ff.sort_order`,
    [sessionId]
  );

  if (draftData.length === 0) return {};

  // Load options for option-type fields
  const dataIds = draftData.map((d) => d.session_step_data_id);
  const placeholders = dataIds.map((_, i) => `$${i + 1}`).join(", ");

  const options = await query(
    `SELECT session_step_data_id, field_option_id, option_value, option_label
      FROM SessionStepOptions
     WHERE session_step_data_id IN (${placeholders})
     ORDER BY session_step_data_id, option_value`,
    dataIds
  );

  // Group options by session_step_data_id
  const optionsByData = new Map();
  for (const opt of options) {
    const arr = optionsByData.get(opt.session_step_data_id) || [];
    arr.push({
      field_option_id: opt.field_option_id,
      value: opt.option_value,
      label: opt.option_label,
    });
    optionsByData.set(opt.session_step_data_id, arr);
  }

  // Build result object keyed by field_id
  const result = {};
  for (const data of draftData) {
    const opts = optionsByData.get(data.session_step_data_id) || [];

    result[data.form_field_id] = {
      step_number: data.step_number,
      key_name: data.key_name,
      value:
        data.value_text ??
        data.value_number ??
        data.value_date ??
        data.value_datetime ??
        data.value_bool,
      options: opts,
    };
  }

  return result;
}

async function createOrUpdateSession({
  formId,
  sessionToken = null,
  userId = null,
  currentStep = 1,
  totalSteps = 1,
  clientIp = null,
  userAgent = null,
  expiresAt = null,
}) {
  // Check if session already exists
  const existing = await getActiveSession(formId, { sessionToken, userId });

  if (existing) {
    // Update existing session
    await query(
      `UPDATE FormSessions
       SET current_step = $1,
           total_steps = $2,
           updated_at = NOW() AT TIME ZONE 'UTC'
       WHERE session_id = $3`,
      [currentStep, totalSteps, existing.session_id]
    );
    return { session_id: existing.session_id, is_new: false };
  }

  // Create new session
  const crypto = require("crypto");
  const newToken = sessionToken || crypto.randomBytes(32).toString("hex");

  const result = await query(
    `INSERT INTO FormSessions 
      (form_id, user_id, session_token, current_step, total_steps, 
       client_ip, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING session_id, session_token`,
    [
      formId,
      userId,
      newToken,
      currentStep,
      totalSteps,
      clientIp,
      userAgent,
      expiresAt,
    ]
  );

  return {
    session_id: result[0].session_id,
    session_token: result[0].session_token,
    is_new: true,
  };
}

async function saveStepData({
  sessionId,
  stepNumber,
  fieldValues, // Array of { field_id, value, options? }
}) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Load field metadata to determine types
    const fieldIds = fieldValues.map((fv) => fv.field_id);
    const placeholders = fieldIds.map((_, i) => `$${i + 1}`).join(", ");

    const fields = await client.query(
      `SELECT field_id, field_type, config_json
       FROM FormFields
       WHERE field_id IN (${placeholders})`,
      fieldIds
    );

    const fieldMetaMap = new Map();
    for (const f of fields.rows) {
      fieldMetaMap.set(f.field_id, f);
    }

    // Load existing option lookup for this session
    const optionLookup = await loadOptionLookupForSession(client, sessionId);

    for (const fv of fieldValues) {
      const meta = fieldMetaMap.get(fv.field_id);
      if (!meta) continue;

      const fieldType = String(meta.field_type || "").toLowerCase();

      let valueText = null;
      let valueNumber = null;
      let valueDate = null;
      let valueDatetime = null;
      let valueBool = null;

      // Determine which column to use based on field type
      if (fieldType !== "option") {
        switch (fieldType) {
          case "number":
            valueNumber = fv.value != null ? Number(fv.value) : null;
            break;
          case "date":
            valueDate = fv.value || null;
            break;
          case "datetime":
            valueDatetime = fv.value || null;
            break;
          case "bool":
          case "boolean":
            valueBool = fv.value != null ? !!fv.value : null;
            break;
          default:
            valueText = fv.value != null ? String(fv.value) : null;
        }
      } else {
        // Option field - store as text (single or JSON array for multi)
        const isMulti = meta.config_json
          ? !!JSON.parse(meta.config_json)?.multi
          : false;

        const arr = Array.isArray(fv.value) ? fv.value : [fv.value];
        valueText = isMulti
          ? JSON.stringify(arr.map(String))
          : String(arr[0] ?? "");
      }

      // Upsert session step data
      const upsertResult = await client.query(
        `INSERT INTO SessionStepData 
          (session_id, step_number, form_field_id, value_text, value_number, 
           value_date, value_datetime, value_bool)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (session_id, form_field_id)
         DO UPDATE SET
           step_number = EXCLUDED.step_number,
           value_text = EXCLUDED.value_text,
           value_number = EXCLUDED.value_number,
           value_date = EXCLUDED.value_date,
           value_datetime = EXCLUDED.value_datetime,
           value_bool = EXCLUDED.value_bool,
           updated_at = NOW() AT TIME ZONE 'UTC'
         RETURNING session_step_data_id`,
        [
          sessionId,
          stepNumber,
          fv.field_id,
          valueText,
          valueNumber,
          valueDate,
          valueDatetime,
          valueBool,
        ]
      );

      const dataId = upsertResult.rows[0].session_step_data_id;

      // Handle options for option-type fields
      if (fieldType === "option" && fv.options) {
        // Delete existing options for this data
        await client.query(
          `DELETE FROM SessionStepOptions WHERE session_step_data_id = $1`,
          [dataId]
        );

        // Insert new options
        for (const opt of fv.options) {
          const optKey = `${fv.field_id}::${String(opt.value)}`;
          const mapped = optionLookup.get(optKey);

          await client.query(
            `INSERT INTO SessionStepOptions
              (session_step_data_id, field_option_id, option_value, option_label)
             VALUES ($1, $2, $3, $4)`,
            [
              dataId,
              mapped?.option_id ?? null,
              String(opt.value),
              mapped?.label ?? opt.label ?? null,
            ]
          );
        }
      }
    }

    // Update session's updated_at timestamp
    await client.query(
      `UPDATE FormSessions
       SET updated_at = NOW() AT TIME ZONE 'UTC'
       WHERE session_id = $1`,
      [sessionId]
    );

    await client.query("COMMIT");
    return { success: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function loadOptionLookupForSession(client, sessionId) {
  const result = await client.query(
    `SELECT fo.option_id, fo.form_field_id, fo.value, fo.label
     FROM FieldOptions fo
     JOIN FormFields ff ON ff.field_id = fo.form_field_id
     JOIN FormSessions fs ON fs.form_id = ff.form_id
     WHERE fs.session_id = $1`,
    [sessionId]
  );

  const byKey = new Map();
  for (const row of result.rows) {
    byKey.set(`${row.form_field_id}::${String(row.value)}`, {
      option_id: row.option_id,
      label: row.label,
    });
  }
  return byKey;
}

async function updateStepProgress({
  sessionId,
  stepNumber,
  isCompleted = false,
  isValidated = false,
  validationErrors = null,
}) {
  await query(
    `INSERT INTO SessionStepProgress
      (session_id, step_number, is_completed, is_validated, 
       completed_at, validation_errors)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (session_id, step_number)
     DO UPDATE SET
       is_completed = EXCLUDED.is_completed,
       is_validated = EXCLUDED.is_validated,
       completed_at = CASE 
         WHEN EXCLUDED.is_completed = TRUE AND SessionStepProgress.completed_at IS NULL
         THEN NOW() AT TIME ZONE 'UTC'
         ELSE SessionStepProgress.completed_at
       END,
       validation_errors = EXCLUDED.validation_errors,
       updated_at = NOW() AT TIME ZONE 'UTC'`,
    [
      sessionId,
      stepNumber,
      isCompleted,
      isValidated,
      isCompleted ? new Date().toISOString() : null,
      validationErrors ? JSON.stringify(validationErrors) : null,
    ]
  );

  return { success: true };
}

async function completeSession(sessionId) {
  await query(
    `UPDATE FormSessions
     SET is_completed = TRUE,
         completed_at = NOW() AT TIME ZONE 'UTC',
         updated_at = NOW() AT TIME ZONE 'UTC'
     WHERE session_id = $1`,
    [sessionId]
  );

  return { success: true };
}

async function deleteSession(sessionId) {
  // Cascade will handle related records
  await query(`DELETE FROM FormSessions WHERE session_id = $1`, [sessionId]);

  return { success: true };
}

async function getUserSessions(userId, { includeCompleted = false } = {}) {
  const whereClause = includeCompleted
    ? "user_id = $1"
    : "user_id = $1 AND is_completed = FALSE";

  return query(
    `SELECT fs.session_id, fs.form_id, fs.session_token, fs.current_step,
            fs.total_steps, fs.is_completed, fs.created_at, fs.updated_at,
            fs.expires_at, f.title AS form_title, f.description AS form_description
     FROM FormSessions fs
     JOIN Forms f ON f.form_id = fs.form_id
     WHERE ${whereClause}
     ORDER BY fs.updated_at DESC`,
    [userId]
  );
}

// Keep existing functions unchanged
async function fetchFormStatus(formId, client = null) {
  const executor = client || (await getPool());
  const result = await executor.query(
    `SELECT status FROM Forms WHERE form_id = $1`,
    [formId]
  );
  return result.rows[0]?.status || null;
}

async function assertEditable(formId, client = null) {
  const status = await fetchFormStatus(formId, client);
  if (!status) throw new Error("Form not found");
  if (status === "Published")
    throw new Error("Form is published and cannot be edited");
}

async function listForms() {
  return query(
    `SELECT f.form_id, f.title, f.description, f.status, f.owner_user_id, f.is_anonymous,
            f.form_key, f.created_at, f.updated_at, u.display_name AS owner_name
       FROM Forms f
       LEFT JOIN Users u ON f.owner_user_id = u.user_id
      ORDER BY f.created_at DESC`
  );
}

async function createForm(data) {
  const result = await query(
    `INSERT INTO Forms (title, description, owner_user_id, is_anonymous, form_key)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING form_id`,
    [
      data.title,
      data.description ?? null,
      data.owner_user_id ?? null,
      !!data.is_anonymous,
      data.form_key ?? null,
    ]
  );
  return { form_id: result[0].form_id };
}

async function editForm(formId, changes) {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertEditable(formId, client);

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (changes.title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(changes.title);
    }
    if (changes.description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(changes.description ?? null);
    }
    if (changes.is_anonymous !== undefined) {
      updates.push(`is_anonymous = $${paramCount++}`);
      values.push(!!changes.is_anonymous);
    }
    if (changes.owner_user_id !== undefined) {
      updates.push(`owner_user_id = $${paramCount++}`);
      values.push(changes.owner_user_id ?? null);
    }
    if (changes.form_key !== undefined) {
      updates.push(`form_key = $${paramCount++}`);
      values.push(changes.form_key ?? null);
    }
    if (changes.status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(changes.status);
    }

    updates.push(`updated_at = NOW() AT TIME ZONE 'UTC'`);

    if (updates.length === 1) throw new Error("No valid fields to update");

    values.push(formId);
    await client.query(
      `UPDATE Forms SET ${updates.join(", ")} WHERE form_id = $${paramCount}`,
      values
    );

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function deleteForm(formId) {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `DELETE FROM ResponseValueOptions
       WHERE response_value_id IN (
         SELECT rv.response_value_id
         FROM ResponseValues rv
         JOIN Responses r ON r.response_id = rv.response_id
         WHERE r.form_id = $1
       )`,
      [formId]
    );

    await client.query(
      `DELETE FROM ResponseValues
       WHERE response_id IN (
         SELECT response_id FROM Responses WHERE form_id = $1
       )`,
      [formId]
    );

    await client.query(`DELETE FROM Responses WHERE form_id = $1`, [formId]);

    await client.query(
      `DELETE FROM FieldOptions
       WHERE form_field_id IN (
         SELECT field_id FROM FormFields WHERE form_id = $1
       )`,
      [formId]
    );

    await client.query(`DELETE FROM FormFields WHERE form_id = $1`, [formId]);

    await client.query(`DELETE FROM Forms WHERE form_id = $1`, [formId]);

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function listFields(formId) {
  return query(
    `SELECT field_id, key_name, label, help_text, field_type,
           required, sort_order, config_json, active, created_at, updated_at, form_step_id
      FROM FormFields
     WHERE form_id = $1
     ORDER BY sort_order ASC, field_id ASC`,
    [Number(formId)]
  );
}

async function createField(formId, field) {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertEditable(formId, client);

    const result = await client.query(
      `INSERT INTO FormFields
        (form_id, key_name, label, help_text, field_type, required, sort_order, config_json, form_step_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING field_id`,
      [
        formId,
        field.key_name,
        field.label,
        field.help_text ?? null,
        field.field_type,
        !!field.required,
        field.sort_order ?? 0,
        field.config_json ?? null,
        field.form_step_id ?? null,
      ]
    );

    await client.query("COMMIT");
    return { field_id: result.rows[0].field_id };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function editField(formId, fieldId, changes) {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertEditable(formId, client);

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (changes.key_name !== undefined) {
      updates.push(`key_name = $${paramCount++}`);
      values.push(changes.key_name);
    }
    if (changes.label !== undefined) {
      updates.push(`label = $${paramCount++}`);
      values.push(changes.label);
    }
    if (changes.help_text !== undefined) {
      updates.push(`help_text = $${paramCount++}`);
      values.push(changes.help_text ?? null);
    }
    if (changes.field_type !== undefined) {
      updates.push(`field_type = $${paramCount++}`);
      values.push(changes.field_type);
    }
    if (changes.required !== undefined) {
      updates.push(`required = $${paramCount++}`);
      values.push(!!changes.required);
    }
    if (changes.sort_order !== undefined) {
      updates.push(`sort_order = $${paramCount++}`);
      values.push(changes.sort_order);
    }
    if (changes.config_json !== undefined) {
      updates.push(`config_json = $${paramCount++}`);
      values.push(changes.config_json ?? null);
    }
    if (changes.active !== undefined) {
      updates.push(`active = $${paramCount++}`);
      values.push(!!changes.active);
    }
    if (changes.form_step_id !== undefined) {
      updates.push(`form_step_id = $${paramCount++}`);
      values.push(changes.form_step_id ?? null);
    }

    updates.push(`updated_at = NOW() AT TIME ZONE 'UTC'`);

    if (updates.length === 1) throw new Error("No valid fields to update");

    values.push(formId, fieldId);
    await client.query(
      `UPDATE FormFields SET ${updates.join(", ")}
       WHERE form_id = $${paramCount++} AND field_id = $${paramCount}`,
      values
    );

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function deleteField(formId, fieldId) {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertEditable(formId, client);

    const result = await client.query(
      `SELECT 1 AS has_data FROM ResponseValues WHERE form_field_id = $1 LIMIT 1`,
      [fieldId]
    );
    const hasData = result.rows.length > 0;

    if (hasData) {
      await client.query(
        `UPDATE FormFields
         SET active = FALSE, updated_at = NOW() AT TIME ZONE 'UTC'
         WHERE form_id = $1 AND field_id = $2`,
        [formId, fieldId]
      );
    } else {
      await client.query(`DELETE FROM FieldOptions WHERE form_field_id = $1`, [
        fieldId,
      ]);

      await client.query(
        `DELETE FROM FormFields WHERE form_id = $1 AND field_id = $2`,
        [formId, fieldId]
      );
    }

    await client.query("COMMIT");
    return { softDeleted: hasData };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  listPublishedForms,
  getFormWithFields,
  listForms,
  createForm,
  editForm,
  deleteForm,
  listFields,
  createField,
  editField,
  deleteField,

  getActiveSession,
  createOrUpdateSession,
  saveStepData,
  updateStepProgress,
  completeSession,
  deleteSession,
  getUserSessions,
};
