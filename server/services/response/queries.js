// server/services/responses/queries.js
const { getPool, query } = require("../../db/pool");

function isMulti(field) {
  if (!field?.config_json) return false;
  try {
    return !!JSON.parse(field.config_json)?.multi;
  } catch {
    return false;
  }
}

async function getFormFlags(client, formId) {
  const result = await client.query(
    `SELECT is_anonymous FROM Forms WHERE form_id = $1`,
    [formId]
  );
  if (result.rows.length === 0) throw new Error("Form not found");
  return result.rows[0];
}

async function getFieldMeta(client, formId) {
  const result = await client.query(
    `SELECT field_id, key_name, label, field_type, config_json
     FROM FormFields
     WHERE form_id = $1 AND active = TRUE
     ORDER BY sort_order, field_id`,
    [formId]
  );
  const map = new Map();
  for (const row of result.rows) map.set(String(row.field_id), row);
  return map;
}

async function loadOptionLookup(client, formId) {
  const result = await client.query(
    `SELECT fo.option_id, fo.form_field_id, fo.value, fo.label
     FROM FieldOptions fo
     JOIN FormFields ff ON ff.field_id = fo.form_field_id
     WHERE ff.form_id = $1`,
    [formId]
  );
  const byKey = new Map(); // `${field_id}::${value}` -> { option_id, label }
  for (const row of result.rows) {
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
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const formRowRes = await client.query(
      `SELECT form_id, form_key, title,
              rpa_webhook_url, rpa_secret, rpa_timeout_ms, rpa_retry_count,
              is_anonymous
       FROM Forms WHERE form_id = $1`,
      [formId]
    );
    const formRow = formRowRes.rows[0];
    if (!formRow) {
      throw new Error("Form not found");
    }

    if (!formRow.is_anonymous && !azureUser) {
      throw new Error("Authentication required");
    }

    const fieldMeta = await getFieldMeta(client, formId);
    const optionLookup = await loadOptionLookup(client, formId);

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

    const r1 = await client.query(
      `INSERT INTO Responses (form_id, user_id, client_ip, user_agent, meta_json)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING response_id, submitted_at`,
      [
        formId,
        null, // stateless mode
        clientIp ?? null,
        userAgent ?? null,
        JSON.stringify({ user: userSnapshot }),
      ]
    );
    const responseId = r1.rows[0].response_id;
    const submittedAt = r1.rows[0].submitted_at;

    const valuesByKey = {};
    const selectionsByKey = {};

    for (const [fieldIdStr, raw] of pairs) {
      const meta = fieldMeta.get(fieldIdStr);
      if (!meta) continue;

      const fieldId = Number(fieldIdStr);
      const type = String(meta.field_type || "").toLowerCase();
      const multi = isMulti(meta);

      let valueText = null;
      let valueNumber = null;
      let valueDate = null;
      let valueDatetime = null;
      let valueBool = null;

      if (type !== "option") {
        switch (type) {
          case "number":
            valueNumber = Number(raw);
            break;
          case "date":
            valueDate = raw || null;
            break;
          case "datetime":
            valueDatetime = raw || null;
            break;
          case "bool":
          case "boolean":
            valueBool = raw == null ? null : !!raw;
            break;
          default:
            valueText = raw == null ? "" : String(raw);
        }
        await client.query(
          `INSERT INTO ResponseValues
            (response_id, form_field_id, value_text, value_number, value_date, value_datetime, value_bool)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            responseId,
            fieldId,
            valueText,
            valueNumber,
            valueDate,
            valueDatetime,
            valueBool,
          ]
        );

        valuesByKey[meta.key_name] =
          valueText ?? valueNumber ?? valueDate ?? valueDatetime ?? valueBool;
        continue;
      }

      // Handle option fields
      const arr = Array.isArray(raw) ? raw : [raw];
      valueText = multi
        ? JSON.stringify(arr.map(String))
        : String(arr[0] ?? "");

      const rvIns = await client.query(
        `INSERT INTO ResponseValues
          (response_id, form_field_id, value_text, value_number, value_date, value_datetime, value_bool)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING response_value_id`,
        [responseId, fieldId, valueText, null, null, null, null]
      );
      const responseValueId = rvIns.rows[0].response_value_id;

      const resolved = [];
      for (const v of arr) {
        const key = `${fieldId}::${String(v)}`;
        const mapped = optionLookup.get(key);
        await client.query(
          `INSERT INTO ResponseValueOptions
            (response_value_id, field_option_id, option_value, option_label)
           VALUES ($1, $2, $3, $4)`,
          [
            responseValueId,
            mapped?.option_id ?? null,
            String(v),
            mapped?.label ?? null,
          ]
        );
        resolved.push({ value: String(v), label: mapped?.label ?? null });
      }

      valuesByKey[meta.key_name] = multi
        ? resolved.map((x) => x.value)
        : resolved[0]?.value ?? null;
      selectionsByKey[meta.key_name] = resolved;
    }

    await client.query("COMMIT");

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
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function listResponses({ formId, offset = 0, limit = 50 }) {
  const pool = await getPool();
  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.min(200, Math.max(1, limit));

  const result = await pool.query(
    `SELECT r.response_id, r.form_id, r.user_id, r.submitted_at,
            u.email, u.display_name
     FROM Responses r
     LEFT JOIN Users u ON u.user_id = r.user_id
     WHERE r.form_id = $1
     ORDER BY r.submitted_at DESC
     LIMIT $2 OFFSET $3`,
    [formId, safeLimit, safeOffset]
  );
  return result.rows;
}

async function getResponse({ formId, responseId }) {
  const responses = await query(
    `SELECT r.response_id, r.form_id, r.user_id, r.submitted_at, r.client_ip, r.user_agent,
            u.email, u.display_name
     FROM Responses r
     LEFT JOIN Users u ON u.user_id = r.user_id
     WHERE r.form_id = $1 AND r.response_id = $2`,
    [Number(formId), Number(responseId)]
  );
  if (responses.length === 0) return null;
  const response = responses[0];

  const values = await query(
    `SELECT rv.response_value_id, rv.form_field_id AS field_id, rv.value_text, rv.value_number,
            rv.value_date, rv.value_datetime, rv.value_bool,
            ff.key_name, ff.label, ff.field_type
     FROM ResponseValues rv
     JOIN FormFields ff ON ff.field_id = rv.form_field_id
     WHERE rv.response_id = $1
     ORDER BY ff.sort_order, rv.response_value_id`,
    [Number(responseId)]
  );

  if (values.length === 0) return { response, values };

  const rvIds = values.map((v) => v.response_value_id);
  const placeholders = rvIds.map((_, i) => `$${i + 1}`).join(", ");

  const options = await query(
    `SELECT response_value_id, field_option_id, option_value, option_label
     FROM ResponseValueOptions
     WHERE response_value_id IN (${placeholders})
     ORDER BY response_value_id, option_value`,
    rvIds
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
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Delete ResponseValueOptions first (CASCADE should handle this, but being explicit)
    await client.query(
      `DELETE FROM ResponseValueOptions
       WHERE response_value_id IN (
         SELECT response_value_id FROM ResponseValues WHERE response_id = $1
       )`,
      [responseId]
    );

    await client.query(`DELETE FROM ResponseValues WHERE response_id = $1`, [
      responseId,
    ]);

    const result = await client.query(
      `DELETE FROM Responses WHERE response_id = $1 AND form_id = $2`,
      [responseId, formId]
    );

    await client.query("COMMIT");
    const rows = result.rowCount || 0;
    return { deleted: rows > 0 };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  submitResponse,
  listResponses,
  getResponse,
  deleteResponse,
};
