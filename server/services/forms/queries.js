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

/**
 * Create full form graph in one transaction.
 *
 * Expected payload:
 * {
 *  title, description, status, is_anonymous,
 *  rpa_webhook_url, rpa_secret, rpa_secret_method, rpa_timeout_ms, rpa_retry_count,
 *  form_key,
 *  steps: [
 *    {
 *      step_number, step_title, step_description, sort_order, is_active,
 *      fields: [
 *        { key_name, label, help_text, field_type, required, sort_order, active, config_json, options: [] }
 *      ]
 *    }
 *  ]
 * }
 */
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
         rpa_webhook_url, rpa_secret, rpa_timeout_ms, rpa_retry_count)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
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

module.exports = {
  listForms,
  listPublishedForms,
  createForm,
};
