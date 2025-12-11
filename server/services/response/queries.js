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
  user, // Changed from azureUser to user (supports both Internal and External)
  clientIp,
  userAgent,
  sessionId = null,
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

    // NEW: Check authentication - require user for non-anonymous forms
    if (!formRow.is_anonymous && !user) {
      throw new Error("Authentication required");
    }

    // NEW: Validate session if provided
    if (sessionId) {
      const sessionCheck = await client.query(
        `SELECT session_id, form_id, is_completed
         FROM FormSessions
         WHERE session_id = $1 AND form_id = $2`,
        [sessionId, formId]
      );

      if (sessionCheck.rows.length === 0) {
        throw new Error("Invalid session");
      }

      if (sessionCheck.rows[0].is_completed) {
        throw new Error("Session already completed");
      }
    }

    const fieldMeta = await getFieldMeta(client, formId);
    const optionLookup = await loadOptionLookup(client, formId);

    const pairs = Array.isArray(values)
      ? values.map((v) => [String(v.field_id), v.value])
      : Object.entries(values).map(([k, v]) => [String(k), v]);

    // NEW: Build user snapshot supporting both Internal and External users
    const userSnapshot = user
      ? {
          user_id: user.user_id,
          email: user.email,
          display_name: user.display_name,
          user_type: user.user_type, // 'Internal' or 'External'
          // For Internal (Azure AD) users
          entra_object_id: user.entra_object_id || null,
          // For backward compatibility with old code
          oid: user.entra_object_id || null,
          name: user.display_name,
        }
      : null;

    // NEW: Include user_id in response (not just in meta_json)
    const r1 = await client.query(
      `INSERT INTO Responses (form_id, user_id, client_ip, user_agent, meta_json, session_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING response_id, submitted_at`,
      [
        formId,
        user?.user_id ?? null, // Changed: now store actual user_id
        clientIp ?? null,
        userAgent ?? null,
        JSON.stringify({ user: userSnapshot }),
        sessionId ?? null,
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

    // Mark session as completed if provided
    if (sessionId) {
      await client.query(
        `UPDATE FormSessions
         SET is_completed = TRUE,
             completed_at = NOW() AT TIME ZONE 'UTC',
             updated_at = NOW() AT TIME ZONE 'UTC'
         WHERE session_id = $1`,
        [sessionId]
      );
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

// Submit response from saved session data
async function submitResponseFromSession({ sessionId, user = null }) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get session details
    const sessionRes = await client.query(
      `SELECT fs.session_id, fs.form_id, fs.user_id, fs.is_completed,
              fs.client_ip, fs.user_agent,
              f.form_key, f.title, f.rpa_webhook_url, f.rpa_secret,
              f.rpa_timeout_ms, f.rpa_retry_count, f.is_anonymous
       FROM FormSessions fs
       JOIN Forms f ON f.form_id = fs.form_id
       WHERE fs.session_id = $1`,
      [sessionId]
    );

    if (sessionRes.rows.length === 0) {
      throw new Error("Session not found");
    }

    const session = sessionRes.rows[0];

    if (session.is_completed) {
      throw new Error("Session already completed");
    }

    // NEW: Verify authentication for non-anonymous forms
    if (!session.is_anonymous && !user && !session.user_id) {
      throw new Error("Authentication required to submit this form");
    }

    // Get field metadata
    const fieldMeta = await getFieldMeta(client, session.form_id);
    const optionLookup = await loadOptionLookup(client, session.form_id);

    // Load all saved session data
    const sessionData = await client.query(
      `SELECT ssd.form_field_id, ssd.value_text, ssd.value_number,
              ssd.value_date, ssd.value_datetime, ssd.value_bool,
              ff.key_name, ff.field_type, ff.config_json
       FROM SessionStepData ssd
       JOIN FormFields ff ON ff.field_id = ssd.form_field_id
       WHERE ssd.session_id = $1`,
      [sessionId]
    );

    if (sessionData.rows.length === 0) {
      throw new Error("No data found in session");
    }

    // NEW: Get user info if user_id exists in session
    let userSnapshot = null;
    const effectiveUserId = user?.user_id ?? session.user_id;

    if (effectiveUserId) {
      const userRes = await client.query(
        `SELECT user_id, email, display_name, user_type, entra_object_id
         FROM Users
         WHERE user_id = $1`,
        [effectiveUserId]
      );

      if (userRes.rows.length > 0) {
        const u = userRes.rows[0];
        userSnapshot = {
          user_id: u.user_id,
          email: u.email,
          display_name: u.display_name,
          user_type: u.user_type,
          entra_object_id: u.entra_object_id || null,
          oid: u.entra_object_id || null,
          name: u.display_name,
        };
      }
    }

    // Create the response
    const responseRes = await client.query(
      `INSERT INTO Responses (form_id, user_id, client_ip, user_agent, meta_json, session_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING response_id, submitted_at`,
      [
        session.form_id,
        effectiveUserId,
        session.client_ip,
        session.user_agent,
        JSON.stringify({ user: userSnapshot }),
        sessionId,
      ]
    );

    const responseId = responseRes.rows[0].response_id;
    const submittedAt = responseRes.rows[0].submitted_at;

    const valuesByKey = {};
    const selectionsByKey = {};

    // Convert session data to response values
    for (const data of sessionData.rows) {
      const fieldId = data.form_field_id;
      const meta = fieldMeta.get(String(fieldId));
      if (!meta) continue;

      const type = String(data.field_type || "").toLowerCase();
      const multi = isMulti(meta);

      if (type !== "option") {
        // Non-option field: direct copy
        await client.query(
          `INSERT INTO ResponseValues
            (response_id, form_field_id, value_text, value_number, value_date, value_datetime, value_bool)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            responseId,
            fieldId,
            data.value_text,
            data.value_number,
            data.value_date,
            data.value_datetime,
            data.value_bool,
          ]
        );

        valuesByKey[data.key_name] =
          data.value_text ??
          data.value_number ??
          data.value_date ??
          data.value_datetime ??
          data.value_bool;
      } else {
        // Option field: copy value and recreate options
        const rvIns = await client.query(
          `INSERT INTO ResponseValues
            (response_id, form_field_id, value_text, value_number, value_date, value_datetime, value_bool)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING response_value_id`,
          [responseId, fieldId, data.value_text, null, null, null, null]
        );
        const responseValueId = rvIns.rows[0].response_value_id;

        // Get saved options from session
        const savedOptions = await client.query(
          `SELECT sso.option_value, sso.option_label, sso.field_option_id
           FROM SessionStepOptions sso
           JOIN SessionStepData ssd ON ssd.session_step_data_id = sso.session_step_data_id
           WHERE ssd.session_id = $1 AND ssd.form_field_id = $2`,
          [sessionId, fieldId]
        );

        const resolved = [];
        for (const opt of savedOptions.rows) {
          await client.query(
            `INSERT INTO ResponseValueOptions
              (response_value_id, field_option_id, option_value, option_label)
             VALUES ($1, $2, $3, $4)`,
            [
              responseValueId,
              opt.field_option_id,
              opt.option_value,
              opt.option_label,
            ]
          );
          resolved.push({
            value: opt.option_value,
            label: opt.option_label,
          });
        }

        valuesByKey[data.key_name] = multi
          ? resolved.map((x) => x.value)
          : resolved[0]?.value ?? null;
        selectionsByKey[data.key_name] = resolved;
      }
    }

    // Mark session as completed
    await client.query(
      `UPDATE FormSessions
       SET is_completed = TRUE,
           completed_at = NOW() AT TIME ZONE 'UTC',
           updated_at = NOW() AT TIME ZONE 'UTC'
       WHERE session_id = $1`,
      [sessionId]
    );

    await client.query("COMMIT");

    // Trigger webhook if configured
    if (session.rpa_webhook_url) {
      const payload = {
        form: {
          id: session.form_id,
          key: session.form_key,
          title: session.title,
        },
        response: { id: responseId, submitted_at: submittedAt },
        user: userSnapshot,
        values: valuesByKey,
        selections: selectionsByKey,
      };

      setImmediate(() => {
        deliverWithRetry(
          {
            url: session.rpa_webhook_url,
            secret: session.rpa_secret,
            timeoutMs: Number(session.rpa_timeout_ms || 8000),
            retryCount: Number(session.rpa_retry_count || 3),
          },
          payload
        ).catch((err) => {
          console.error(
            `[webhook] delivery failed for form ${session.form_id}, response ${responseId}:`,
            err.message
          );
        });
      });
    }

    return { response_id: responseId, session_id: sessionId };
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
    `SELECT r.response_id, r.form_id, r.user_id, r.submitted_at, r.session_id,
            u.email, u.display_name, u.user_type, u.entra_object_id,
            fs.session_token, fs.created_at AS session_created_at
     FROM Responses r
     LEFT JOIN Users u ON u.user_id = r.user_id
     LEFT JOIN FormSessions fs ON fs.session_id = r.session_id
     WHERE r.form_id = $1
     ORDER BY r.submitted_at DESC
     LIMIT $2 OFFSET $3`,
    [formId, safeLimit, safeOffset]
  );
  return result.rows;
}

async function getResponse({ formId, responseId }) {
  const responses = await query(
    `SELECT r.response_id, r.form_id, r.user_id, r.submitted_at, r.client_ip, 
            r.user_agent, r.session_id, r.meta_json,
            u.email, u.display_name, u.user_type, u.entra_object_id,
            fs.session_token, fs.created_at AS session_created_at,
            fs.completed_at AS session_completed_at
     FROM Responses r
     LEFT JOIN Users u ON u.user_id = r.user_id
     LEFT JOIN FormSessions fs ON fs.session_id = r.session_id
     WHERE r.form_id = $1 AND r.response_id = $2`,
    [Number(formId), Number(responseId)]
  );
  if (responses.length === 0) return null;
  const response = responses[0];

  const values = await query(
    `SELECT rv.response_value_id, rv.form_field_id AS field_id, rv.value_text, rv.value_number,
            rv.value_date, rv.value_datetime, rv.value_bool,
            ff.key_name, ff.label, ff.field_type, ff.form_step_id,
            fs.step_number, fs.step_title
     FROM ResponseValues rv
     JOIN FormFields ff ON ff.field_id = rv.form_field_id
     LEFT JOIN FormSteps fs ON fs.step_id = ff.form_step_id
     WHERE rv.response_id = $1
     ORDER BY COALESCE(fs.sort_order, 0), ff.sort_order, rv.response_value_id`,
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

    // Get session_id if exists
    const sessionCheck = await client.query(
      `SELECT session_id FROM Responses WHERE response_id = $1`,
      [responseId]
    );

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

    // Optionally mark session as incomplete (allows user to resubmit)
    if (sessionCheck.rows.length > 0 && sessionCheck.rows[0].session_id) {
      const sessionId = sessionCheck.rows[0].session_id;

      await client.query(
        `UPDATE FormSessions
         SET is_completed = FALSE,
             completed_at = NULL,
             updated_at = NOW() AT TIME ZONE 'UTC'
         WHERE session_id = $1`,
        [sessionId]
      );
    }

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

// Get session summary for analytics
async function getSessionAnalytics({ formId }) {
  return query(
    `SELECT 
       COUNT(*) FILTER (WHERE is_completed = TRUE) AS completed_sessions,
       COUNT(*) FILTER (WHERE is_completed = FALSE) AS active_sessions,
       COUNT(*) FILTER (WHERE is_completed = FALSE AND expires_at < NOW() AT TIME ZONE 'UTC') AS expired_sessions,
       AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) FILTER (WHERE is_completed = TRUE) AS avg_completion_time_seconds,
       AVG(current_step::NUMERIC / NULLIF(total_steps, 0) * 100) FILTER (WHERE is_completed = FALSE) AS avg_progress_percentage
     FROM FormSessions
     WHERE form_id = $1`,
    [formId]
  );
}

module.exports = {
  submitResponse,
  submitResponseFromSession,
  listResponses,
  getResponse,
  deleteResponse,
  getSessionAnalytics,
};
