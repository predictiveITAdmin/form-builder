const { sql, getPool, query } = require("../../db/pool");
const saneParams = require("../../utils/saneParams");

async function listPublishedForms() {
  return query(
    `SELECT f.form_id, f.title, f.description, f.status, f.owner_user_id, f.is_anonymous, f.created_at, f.updated_at, u.display_name AS owner_name
        FROM Forms f
        LEFT JOIN Users u ON f.owner_user_id = u.user_id
        WHERE f.status = N'Published'
        ORDER BY f.created_at DESC;`
  );
}

async function getFormWithFields(formId, { includeOptions = false } = {}) {
  const [form] = await query(
    `
    SELECT form_id, title, description, status, is_anonymous,
           created_at, updated_at, form_key, owner_user_id
      FROM Forms
     WHERE form_id = @id
    `,
    saneParams({ id: Number(formId) })
  );
  if (!form) return null;

  const fields = await query(
    `
    SELECT field_id, key_name, label, help_text, field_type,
           required, sort_order, config_json, active
      FROM FormFields
     WHERE form_id = @id
     ORDER BY sort_order ASC, field_id ASC
    `,
    saneParams({ id: Number(formId) })
  );

  if (!includeOptions || fields.length === 0) {
    return { form, fields };
  }
  const fieldIds = fields.map((f) => f.field_id);
  // SQL Server IN list; keep it simple
  const placeholders = fieldIds.map((_, i) => `@p${i}`).join(", ");
  const params = {};
  fieldIds.forEach((id, i) => (params[`p${i}`] = id));

  const options = await query(
    `
    SELECT form_field_id AS field_id, value, label, is_default, sort_order
      FROM FieldOptions
     WHERE form_field_id IN (${placeholders})
     ORDER BY sort_order ASC, option_id ASC
    `,
    params
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

  return { form, fields: fieldsWithOptions };
}

async function fetchFormStatus(formId, tx = null) {
  const pool = tx ? tx : await getPool();
  const req = tx ? new sql.Request(tx) : pool.request();
  const { recordset } = await req
    .input("id", sql.Int, formId)
    .query(`SELECT status FROM Forms WHERE form_id = @id`);
  return recordset[0]?.status || null;
}

async function assertEditable(formId, tx = null) {
  const status = await fetchFormStatus(formId, tx);
  if (!status) throw new Error("Form not found");
  if (status === "Published")
    throw new Error("Form is published and cannot be edited");
}

async function listForms() {
  // full list for admins/editors
  return query(
    `SELECT f.form_id, f.title, f.description, f.status, f.owner_user_id, f.is_anonymous,
            f.form_key, f.created_at, f.updated_at, u.display_name AS owner_name
       FROM Forms f
       LEFT JOIN Users u ON f.owner_user_id = u.user_id
      ORDER BY f.created_at DESC;`
  );
}

async function createForm(data) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("title", sql.NVarChar(300), data.title)
    .input("description", sql.NVarChar(sql.MAX), data.description ?? null)
    .input("owner_user_id", sql.Int, data.owner_user_id ?? null)
    .input("is_anonymous", sql.Bit, !!data.is_anonymous)
    .input("form_key", sql.NVarChar(120), data.form_key ?? null).query(`
      INSERT INTO Forms (title, description, owner_user_id, is_anonymous, form_key)
      OUTPUT INSERTED.form_id
      VALUES (@title, @description, @owner_user_id, @is_anonymous, @form_key)
    `);
  return { form_id: r.recordset[0].form_id };
}

async function editForm(formId, changes) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await assertEditable(formId, tx);

    const req = new sql.Request(tx).input("id", sql.Int, formId);

    if (changes.title !== undefined)
      req.input("title", sql.NVarChar(300), changes.title);
    if (changes.description !== undefined)
      req.input(
        "description",
        sql.NVarChar(sql.MAX),
        changes.description ?? null
      );
    if (changes.is_anonymous !== undefined)
      req.input("is_anonymous", sql.Bit, !!changes.is_anonymous);
    if (changes.owner_user_id !== undefined)
      req.input("owner_user_id", sql.Int, changes.owner_user_id ?? null);
    if (changes.form_key !== undefined)
      req.input("form_key", sql.NVarChar(120), changes.form_key ?? null);
    // Optional: allow status transitions here if you want Draft -> Published
    if (changes.status !== undefined)
      req.input("status", sql.NVarChar(32), changes.status);

    const set = [
      changes.title !== undefined && "title = @title",
      changes.description !== undefined && "description = @description",
      changes.is_anonymous !== undefined && "is_anonymous = @is_anonymous",
      changes.owner_user_id !== undefined && "owner_user_id = @owner_user_id",
      changes.form_key !== undefined && "form_key = @form_key",
      changes.status !== undefined && "status = @status",
      "updated_at = SYSUTCDATETIME()",
    ]
      .filter(Boolean)
      .join(", ");

    if (!set) throw new Error("No valid fields to update");

    await req.query(`UPDATE Forms SET ${set} WHERE form_id = @id`);
    await tx.commit();
  } catch (e) {
    try {
      await tx.rollback();
    } catch {}
    throw e;
  }
}

async function deleteForm(formId) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).input("id", sql.Int, formId).query(`
        DELETE rv
          FROM ResponseValues rv
          JOIN Responses r ON r.response_id = rv.response_id
         WHERE r.form_id = @id
      `);

    await new sql.Request(tx)
      .input("id", sql.Int, formId)
      .query(`DELETE FROM Responses WHERE form_id = @id`);

    await new sql.Request(tx).input("id", sql.Int, formId).query(`
        DELETE fo
          FROM FieldOptions fo
          JOIN FormFields ff ON ff.field_id = fo.form_field_id
         WHERE ff.form_id = @id
      `);

    await new sql.Request(tx)
      .input("id", sql.Int, formId)
      .query(`DELETE FROM FormFields WHERE form_id = @id`);

    await new sql.Request(tx)
      .input("id", sql.Int, formId)
      .query(`DELETE FROM Forms WHERE form_id = @id`);

    await tx.commit();
  } catch (e) {
    try {
      await tx.rollback();
    } catch {}
    throw e;
  }
}

async function listFields(formId) {
  return query(
    `
    SELECT field_id, key_name, label, help_text, field_type,
           required, sort_order, config_json, active, created_at, updated_at
      FROM FormFields
     WHERE form_id = @id
     ORDER BY sort_order ASC, field_id ASC
    `,
    saneParams({ id: Number(formId) })
  );
}

async function createField(formId, field) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await assertEditable(formId, tx);

    const r = await new sql.Request(tx)
      .input("form_id", sql.Int, formId)
      .input("key_name", sql.NVarChar(100), field.key_name)
      .input("label", sql.NVarChar(300), field.label)
      .input("help_text", sql.NVarChar(1000), field.help_text ?? null)
      .input("field_type", sql.NVarChar(40), field.field_type)
      .input("required", sql.Bit, !!field.required)
      .input("sort_order", sql.Int, field.sort_order ?? 0)
      .input("config_json", sql.NVarChar(sql.MAX), field.config_json ?? null)
      .query(`
        INSERT INTO FormFields
          (form_id, key_name, label, help_text, field_type, required, sort_order, config_json)
        OUTPUT INSERTED.field_id
        VALUES
          (@form_id, @key_name, @label, @help_text, @field_type, @required, @sort_order, @config_json)
      `);

    await tx.commit();
    return { field_id: r.recordset[0].field_id };
  } catch (e) {
    try {
      await tx.rollback();
    } catch {}
    throw e;
  }
}

async function editField(formId, fieldId, changes) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await assertEditable(formId, tx);

    const req = new sql.Request(tx)
      .input("form_id", sql.Int, formId)
      .input("field_id", sql.Int, fieldId);

    if (changes.key_name !== undefined)
      req.input("key_name", sql.NVarChar(100), changes.key_name);
    if (changes.label !== undefined)
      req.input("label", sql.NVarChar(300), changes.label);
    if (changes.help_text !== undefined)
      req.input("help_text", sql.NVarChar(1000), changes.help_text ?? null);
    if (changes.field_type !== undefined)
      req.input("field_type", sql.NVarChar(40), changes.field_type);
    if (changes.required !== undefined)
      req.input("required", sql.Bit, !!changes.required);
    if (changes.sort_order !== undefined)
      req.input("sort_order", sql.Int, changes.sort_order);
    if (changes.config_json !== undefined)
      req.input(
        "config_json",
        sql.NVarChar(sql.MAX),
        changes.config_json ?? null
      );
    if (changes.active !== undefined)
      req.input("active", sql.Bit, !!changes.active);

    const set = [
      changes.key_name !== undefined && "key_name = @key_name",
      changes.label !== undefined && "label = @label",
      changes.help_text !== undefined && "help_text = @help_text",
      changes.field_type !== undefined && "field_type = @field_type",
      changes.required !== undefined && "required = @required",
      changes.sort_order !== undefined && "sort_order = @sort_order",
      changes.config_json !== undefined && "config_json = @config_json",
      changes.active !== undefined && "active = @active",
      "updated_at = SYSUTCDATETIME()",
    ]
      .filter(Boolean)
      .join(", ");

    if (!set) throw new Error("No valid fields to update");

    await req.query(`
      UPDATE FormFields SET ${set}
       WHERE form_id = @form_id AND field_id = @field_id
    `);

    await tx.commit();
  } catch (e) {
    try {
      await tx.rollback();
    } catch {}
    throw e;
  }
}

async function deleteField(formId, fieldId) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await assertEditable(formId, tx);

    // if responses exist for this field, soft-delete; else hard-delete + options
    const { recordset } = await new sql.Request(tx)
      .input("fid", sql.Int, fieldId)
      .query(
        `SELECT TOP 1 1 AS has_data FROM ResponseValues WHERE form_field_id = @fid`
      );
    const hasData = recordset.length > 0;

    if (hasData) {
      await new sql.Request(tx)
        .input("form_id", sql.Int, formId)
        .input("field_id", sql.Int, fieldId).query(`
          UPDATE FormFields
             SET active = 0, updated_at = SYSUTCDATETIME()
           WHERE form_id = @form_id AND field_id = @field_id
        `);
    } else {
      await new sql.Request(tx)
        .input("field_id", sql.Int, fieldId)
        .query(`DELETE FROM FieldOptions WHERE form_field_id = @field_id`);

      await new sql.Request(tx)
        .input("form_id", sql.Int, formId)
        .input("field_id", sql.Int, fieldId).query(`
          DELETE FROM FormFields
           WHERE form_id = @form_id AND field_id = @field_id
        `);
    }

    await tx.commit();
    return { softDeleted: hasData };
  } catch (e) {
    try {
      await tx.rollback();
    } catch {}
    throw e;
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
};
