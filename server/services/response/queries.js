// server/services/responses/queries.js
const { sql, getPool, query } = require("../../db/pool");

function isMulti(field) {
  if (!field?.config_json) return false;
  try {
    return !!JSON.parse(field.config_json)?.multi;
  } catch {
    return false;
  }
}

async function getFormFlags(tx, formId) {
  const { recordset } = await new sql.Request(tx)
    .input("id", sql.Int, formId)
    .query(`SELECT is_anonymous FROM Forms WHERE form_id = @id`);
  if (!recordset[0]) throw new Error("Form not found");
  return recordset[0];
}

async function getFieldMeta(tx, formId) {
  const r = await new sql.Request(tx).input("form_id", sql.Int, formId).query(`
      SELECT field_id, key_name, label, field_type, config_json
      FROM FormFields
      WHERE form_id = @form_id AND active = 1
      ORDER BY sort_order, field_id
    `);
  const map = new Map();
  for (const row of r.recordset) map.set(String(row.field_id), row);
  return map;
}

async function loadOptionLookup(tx, formId) {
  const r = await new sql.Request(tx).input("form_id", sql.Int, formId).query(`
      SELECT fo.option_id, fo.form_field_id, fo.value, fo.label
      FROM FieldOptions fo
      JOIN FormFields ff ON ff.field_id = fo.form_field_id
      WHERE ff.form_id = @form_id
    `);
  const byKey = new Map(); // `${field_id}::${value}` -> { option_id, label }
  for (const row of r.recordset) {
    byKey.set(`${row.form_field_id}::${String(row.value)}`, {
      option_id: row.option_id,
      label: row.label,
    });
  }
  return byKey;
}

async function submitResponse({
  formId,
  values,
  azureUser,
  clientIp,
  userAgent,
}) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();

  const formRowRes = await new sql.Request(tx).input("id", sql.Int, formId)
    .query(`
      SELECT form_id, form_key, title,
             rpa_webhook_url, rpa_secret, rpa_timeout_ms, rpa_retry_count,
             is_anonymous
      FROM Forms WHERE form_id = @id
    `);
  const formRow = formRowRes.recordset[0];
  if (!formRow) {
    await tx.rollback().catch(() => {});
    throw new Error("Form not found");
  }

  if (!formRow.is_anonymous && !azureUser) {
    await tx.rollback().catch(() => {});
    throw new Error("Authentication required");
  }

  try {
    const fieldMeta = await getFieldMeta(tx, formId);
    const optionLookup = await loadOptionLookup(tx, formId);

    const pairs = Array.isArray(values)
      ? values.map((v) => [String(v.field_id), v.value])
      : Object.entries(values).map(([k, v]) => [String(k), v]);

    const userSnapshot = azureUser
      ? {
          oid: azureUser.oid,
          email: azureUser.email,
          name: azureUser.name,
          roles: Array.from(azureUser.roles || []),
        }
      : null;

    const r1 = await new sql.Request(tx)
      .input("form_id", sql.Int, formId)
      .input("user_id", sql.Int, null) // stateless mode
      .input("client_ip", sql.NVarChar(64), clientIp ?? null)
      .input("user_agent", sql.NVarChar(512), userAgent ?? null)
      .input(
        "meta_json",
        sql.NVarChar(sql.MAX),
        JSON.stringify({ user: userSnapshot })
      ).query(`
        INSERT INTO Responses (form_id, user_id, client_ip, user_agent, meta_json)
        OUTPUT INSERTED.response_id, INSERTED.submitted_at
        VALUES (@form_id, @user_id, @client_ip, @user_agent, @meta_json)
      `);
    const responseId = r1.recordset[0].response_id;
    const submittedAt = r1.recordset[0].submitted_at;

    const valuesByKey = {};
    const selectionsByKey = {};

    for (const [fieldIdStr, raw] of pairs) {
      const meta = fieldMeta.get(fieldIdStr);
      if (!meta) continue;

      const fieldId = Number(fieldIdStr);
      const type = String(meta.field_type || "").toLowerCase();
      const multi = isMulti(meta);

      const rvReq = new sql.Request(tx)
        .input("response_id", sql.Int, responseId)
        .input("field_id", sql.Int, fieldId)
        .input("value_text", sql.NVarChar(sql.MAX), null)
        .input("value_number", sql.Decimal(38, 10), null)
        .input("value_date", sql.Date, null)
        .input("value_datetime", sql.DateTime2(3), null)
        .input("value_bool", sql.Bit, null);

      if (type !== "option") {
        switch (type) {
          case "number":
            rvReq.parameters.value_number.value = Number(raw);
            break;
          case "date":
            rvReq.parameters.value_date.value = raw || null;
            break;
          case "datetime":
            rvReq.parameters.value_datetime.value = raw || null;
            break;
          case "bool":
          case "boolean":
            rvReq.parameters.value_bool.value = raw == null ? null : !!raw;
            break;
          default:
            rvReq.parameters.value_text.value = raw == null ? "" : String(raw);
        }
        await rvReq.query(`
          INSERT INTO ResponseValues
            (response_id, form_field_id, value_text, value_number, value_date, value_datetime, value_bool)
          VALUES
            (@response_id, @field_id, @value_text, @value_number, @value_date, @value_datetime, @value_bool)
        `);

        valuesByKey[meta.key_name] =
          rvReq.parameters.value_text.value ??
          rvReq.parameters.value_number.value ??
          rvReq.parameters.value_date.value ??
          rvReq.parameters.value_datetime.value ??
          rvReq.parameters.value_bool.value;
        continue;
      }

      const arr = Array.isArray(raw) ? raw : [raw];
      rvReq.parameters.value_text.value = multi
        ? JSON.stringify(arr.map(String))
        : String(arr[0] ?? "");

      const rvIns = await rvReq.query(`
        INSERT INTO ResponseValues
          (response_id, form_field_id, value_text, value_number, value_date, value_datetime, value_bool)
        OUTPUT INSERTED.response_value_id
        VALUES
          (@response_id, @field_id, @value_text, @value_number, @value_date, @value_datetime, @value_bool)
      `);
      const responseValueId = rvIns.recordset[0].response_value_id;

      const resolved = [];
      for (const v of arr) {
        const key = `${fieldId}::${String(v)}`;
        const mapped = optionLookup.get(key);
        await new sql.Request(tx)
          .input("rvid", sql.Int, responseValueId)
          .input("fopt", sql.Int, mapped?.option_id ?? null)
          .input("oval", sql.NVarChar(400), String(v))
          .input("olab", sql.NVarChar(400), mapped?.label ?? null).query(`
            INSERT INTO ResponseValueOptions
              (response_value_id, field_option_id, option_value, option_label)
            VALUES
              (@rvid, @fopt, @oval, @olab)
          `);
        resolved.push({ value: String(v), label: mapped?.label ?? null });
      }

      valuesByKey[meta.key_name] = multi
        ? resolved.map((x) => x.value)
        : resolved[0]?.value ?? null;
      selectionsByKey[meta.key_name] = resolved;
    }

    await tx.commit();

    if (formRow.rpa_webhook_url) {
      const payload = {
        form: {
          id: formRow.form_id,
          key: formRow.form_key,
          title: formRow.title,
        },
        response: { id: responseId, submitted_at: submittedAt },
        user: userSnapshot,
        values: valuesByKey,
        selections: selectionsByKey,
      };

      setImmediate(() => {
        deliverWithRetry(
          {
            url: formRow.rpa_webhook_url,
            secret: formRow.rpa_secret,
            timeoutMs: Number(formRow.rpa_timeout_ms || 8000),
            retryCount: Number(formRow.rpa_retry_count || 3),
          },
          payload
        ).catch((err) => {
          console.error(
            `[webhook] delivery failed for form ${formRow.form_id}, response ${responseId}:`,
            err.message
          );
        });
      });
    }

    return { response_id: responseId };
  } catch (err) {
    try {
      await tx.rollback();
    } catch {}
    throw err;
  }
}

async function listResponses({ formId, offset = 0, limit = 50 }) {
  // keep it simple: order by most recent
  const pool = await getPool();
  const r = await pool
    .request()
    .input("form_id", sql.Int, formId)
    .input("offset", sql.Int, Math.max(0, offset))
    .input("limit", sql.Int, Math.min(200, Math.max(1, limit))).query(`
      SELECT r.response_id, r.form_id, r.user_id, r.submitted_at,
             u.email, u.display_name
      FROM Responses r
      LEFT JOIN Users u ON u.user_id = r.user_id
      WHERE r.form_id = @form_id
      ORDER BY r.submitted_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
  return r.recordset;
}

async function getResponse({ formId, responseId }) {
  const [response] = await query(
    `
    SELECT r.response_id, r.form_id, r.user_id, r.submitted_at, r.client_ip, r.user_agent,
           u.email, u.display_name
    FROM Responses r
    LEFT JOIN Users u ON u.user_id = r.user_id
    WHERE r.form_id = @form_id AND r.response_id = @response_id
    `,
    { form_id: Number(formId), response_id: Number(responseId) }
  );
  if (!response) return null;

  const values = await query(
    `
    SELECT rv.response_value_id, rv.form_field_id AS field_id, rv.value_text, rv.value_number,
           rv.value_date, rv.value_datetime, rv.value_bool,
           ff.key_name, ff.label, ff.field_type
    FROM ResponseValues rv
    JOIN FormFields ff ON ff.field_id = rv.form_field_id
    WHERE rv.response_id = @rid
    ORDER BY ff.sort_order, rv.response_value_id
    `,
    { rid: Number(responseId) }
  );

  if (values.length === 0) return { response, values };

  const rvIds = values.map((v) => v.response_value_id);
  const placeholders = rvIds.map((_, i) => `@p${i}`).join(", ");
  const params = {};
  rvIds.forEach((id, i) => (params[`p${i}`] = id));

  const options = await query(
    `
    SELECT response_value_id, field_option_id, option_value, option_label
    FROM ResponseValueOptions
    WHERE response_value_id IN (${placeholders})
    ORDER BY response_value_id, option_value
    `,
    params
  );

  const optByRv = new Map();
  for (const o of options) {
    const arr = optByRv.get(o.response_value_id) || [];
    arr.push({
      field_option_id: o.field_option_id,
      value: o.option_value,
      label: o.option_label,
    });
    optByRv.set(o.response_value_id, arr);
  }

  const decorated = values.map((v) => ({
    ...v,
    options: optByRv.get(v.response_value_id) || [],
  }));

  return { response, values: decorated };
}

async function deleteResponse({ formId, responseId }) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx)
      .input("rid", sql.Int, responseId)
      .query(`DELETE FROM ResponseValues WHERE response_id = @rid`);

    const result = await new sql.Request(tx)
      .input("rid", sql.Int, responseId)
      .input("fid", sql.Int, formId)
      .query(
        `DELETE FROM Responses WHERE response_id = @rid AND form_id = @fid`
      );

    await tx.commit();
    const rows = result.rowsAffected?.[0] || 0;
    return { deleted: rows > 0 };
  } catch (e) {
    try {
      await tx.rollback();
    } catch {}
    throw e;
  }
}

module.exports = {
  submitResponse,
  listResponses,
  getResponse,
  deleteResponse,
};
