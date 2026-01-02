const svc = require("./queries"); // same folder as controller.js
const axios = require("axios");
/**
 * GET /forms
 * Admin/Manager/FormBuilder
 */
async function listAll(req, res) {
  try {
    const forms = await svc.listForms();
    return res.json({ forms });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to list forms",
      details: String(err?.message || err),
    });
  }
}

/**
 * GET /forms/published
 * End users
 */
async function listPublished(req, res) {
  try {
    const forms = await svc.listPublishedForms();
    return res.json({ forms });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to list published forms",
      details: String(err?.message || err),
    });
  }
}

async function create(req, res) {
  try {
    const payload = req.body;

    const problems = validateCreatePayload(payload);
    if (problems.length) {
      return res.status(400).json({
        error: "Invalid payload",
        problems,
      });
    }

    const ownerUserId =
      req.user?.user_id ?? req.user?.id ?? req.user?.userId ?? null;

    const result = await svc.createForm(payload, {
      owner_user_id: ownerUserId,
    });

    return res.status(201).json(result);
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      return res.status(409).json({
        error: "Duplicate field key_name within the form",
        details: err.detail || String(err?.message || err),
      });
    }
    console.log(err);
    return res.status(500).json({
      error: "Failed to create form",
      details: String(err?.message || err),
    });
  }
}

async function updateForm(req, res) {
  try {
    const { formKey } = req.params;
    const payload = req.body;

    const problems = validateCreatePayload(payload); // reuse for now
    if (problems.length) {
      return res.status(400).json({ error: "Invalid payload", problems });
    }

    const ownerUserId =
      req.user?.user_id ?? req.user?.id ?? req.user?.userId ?? null;

    const result = await svc.updateFormByKey(formKey, payload, {
      owner_user_id: ownerUserId,
    });

    return res.status(200).json(result);
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      return res.status(409).json({
        error: "Duplicate field key_name within the form",
        details: err.detail || String(err?.message || err),
      });
    }
    return res.status(500).json({
      error: "Failed to update form",
      details: String(err?.message || err),
    });
  }
}

function validateCreatePayload(payload) {
  const issues = [];

  if (!payload || typeof payload !== "object") {
    issues.push("Body must be a JSON object");
    return issues;
  }

  if (!payload.title || typeof payload.title !== "string") {
    issues.push("title is required and must be a string");
  }

  if (payload.status && typeof payload.status !== "string") {
    issues.push("status must be a string");
  }

  if (payload.steps !== undefined && !Array.isArray(payload.steps)) {
    issues.push("steps must be an array");
  }

  // Very light step/field validation
  if (Array.isArray(payload.steps)) {
    payload.steps.forEach((s, si) => {
      if (typeof s.step_number !== "number") {
        issues.push(`steps[${si}].step_number must be a number`);
      }
      if (!s.step_title || typeof s.step_title !== "string") {
        issues.push(`steps[${si}].step_title is required`);
      }

      if (s.fields !== undefined && !Array.isArray(s.fields)) {
        issues.push(`steps[${si}].fields must be an array`);
      }

      if (Array.isArray(s.fields)) {
        s.fields.forEach((f, fi) => {
          if (!f.key_name || typeof f.key_name !== "string") {
            issues.push(`steps[${si}].fields[${fi}].key_name is required`);
          }
          if (!f.label || typeof f.label !== "string") {
            issues.push(`steps[${si}].fields[${fi}].label is required`);
          }
          if (!f.field_type || typeof f.field_type !== "string") {
            issues.push(`steps[${si}].fields[${fi}].field_type is required`);
          }

          // options should be array if present
          if (f.options !== undefined && !Array.isArray(f.options)) {
            issues.push(`steps[${si}].fields[${fi}].options must be an array`);
          }
        });
      }
    });
  }

  return issues;
}

function isPgUniqueViolation(err) {
  // Postgres unique_violation
  return err && (err.code === "23505" || err.constraint);
}

async function getFormForRender(req, res, next) {
  try {
    const { formKey } = req.params;
    const user = req.user;
    const user_id = user.userId;

    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized: missing user_id" });
    }

    if (!formKey || typeof formKey !== "string") {
      return res.status(400).json({ error: "Missing formKey" });
    }

    const result = await svc.getFormGraphByKey(formKey);
    if (!result.length || !result[0].form) {
      return res.status(404).json({ error: "Form not found" });
    }

    const form = result[0].form;
    const formId = form.form_id;
    if (!formId) {
      return res.status(500).json({ error: "Form graph missing form_id" });
    }
    const token = crypto.randomUUID();
    const session = await svc.getOrCreateOpenSession(user_id, formId, token);

    return res.json({
      ...form,
      session,
    });
  } catch (err) {
    console.log(err);
    return next(err);
  }
}

async function handleSaveDraft(req, res, next) {
  try {
    const { response, response_values } = req.body || {};

    if (!response) {
      return res
        .status(400)
        .json({ message: "Bad Request. Missing response object." });
    }

    const {
      session_id,
      form_id,
      user_id,
      total_steps,
      submitted_at,
      client_ip,
      user_agent,
      meta_json,
    } = response;

    if (!session_id || !form_id) {
      return res.status(400).json({
        message: "Bad Request. Missing required fields: session_id, form_id.",
      });
    }

    if (!Array.isArray(response_values)) {
      return res.status(400).json({
        message: "Bad Request. response_values must be an array.",
      });
    }

    // Normalize a few things (don’t trust the frontend, it’s a browser)
    const normalized = {
      response: {
        session_token: session_id,
        form_id,
        user_id: user_id ?? "unknown-user",
        total_steps,
        submitted_at: submitted_at ?? new Date().toISOString(),
        client_ip: client_ip ?? req.ip ?? null,
        user_agent: user_agent ?? req.headers["user-agent"] ?? null,
        meta_json: meta_json ?? {},
      },
      response_values: response_values
        .filter((v) => v && v.form_field_id)
        .map((v) => ({
          form_field_id: v.form_field_id,
          value_text: v.value_text ?? null,
          value_number: v.value_number ?? null,
          value_date: v.value_date ?? null,
          value_datetime: v.value_datetime ?? null,
          value_bool: v.value_bool ?? null,
        })),
    };

    const result = await svc.upsertDraftWithValues(normalized);

    return res.status(200).json({
      message: "Draft saved successfully",
      ...result,
    });
  } catch (e) {
    console.error("Error saving draft:", e);
    return next(e);
  }
}

async function triggerOptionsProcessing(req, res, next) {
  try {
    const { formKey, fieldId } = req.params;
    if (!formKey || !fieldId) {
      return res
        .status(400)
        .json({ message: "Bad Request. Form Key or Field Id is required." });
    }

    const fieldURL = await svc.getDynamicUrl(fieldId);

    // Trigger the RPA process (fire and forget)
    await axios.post(fieldURL, {
      formKey: formKey,
      fieldId: fieldId,
      callbackUrl: `${process.env.APP_BASE_URL}/api/webhooks/options-callback`, // Your webhook endpoint
    });

    return res.status(202).json({
      message: "Processing queued successfully",
      formKey,
      fieldId,
    });
  } catch (e) {
    console.log(e);
    return next(e);
  }
}

async function handleOptionsCallback(req, res, next) {
  try {
    const { formKey, fieldId, options } = req.body;

    if (!formKey || !fieldId || !options) {
      return res
        .status(400)
        .json({ message: "Bad Request. Missing required fields." });
    }

    // Insert options into database
    await svc.saveOptionsToDb(fieldId, options);

    return res.status(200).json({
      message: "Options received and saved successfully",
      count: options.length,
    });
  } catch (e) {
    console.error("Error processing options callback:", e);
    return next(e);
  }
}

async function allDraftSessionsByUser(req, res, next) {
  try {
    const user = req.user;

    if (!user) {
      return res
        .status(400)
        .json({ message: "Failed to Get Sessions, User is Required." });
    }

    const sessions = await svc.getDraftSessionsbyUser(user.id);
    return res.status(200).json(sessions);
  } catch (err) {
    return res.status(500).json({ message: "Failed to get Sessions. " + err });
  }
}

async function getSessionDataByUser(req, res, next) {
  try {
    const user = req.user;

    if (!user.userId) {
      return res.status(401).json({ message: "Unauthorized: missing user_id" });
    }

    const { sessionToken } = req.params;
    if (!sessionToken) {
      return res
        .status(400)
        .json({ message: "Bad Request: missing sessionToken" });
    }
    const payload = await svc.getSessionData(user.userId, sessionToken);

    if (!payload) {
      return res
        .status(404)
        .json({ message: "Session not found (or expired)." });
    }

    return res.status(200).json(payload[0].response_data);
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Unable to complete the request. " + err });
  }
}

async function getUsersForForm(req, res) {
  const formId = req.params.formId;

  if (!formId) {
    return res.status(400).json({ message: "formId is required." });
  }
  try {
    const result = await svc.fetchFormUsers(formId);

    res.status(200).json(result);
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Unable to complete the request " + err });
  }
}

async function setUsersForForm(req, res) {
  const formId = req.params.formId;
  const userIds = req.body.userIds;
  const grantedBy = req.user.userId;

  if (!grantedBy) {
    return res.status(400).json({ message: "User is not Authenticated." });
  }
  if (!formId) {
    return res.status(400).json({ message: "formId is required." });
  }
  try {
    const result = await svc.setFormUsers(formId, userIds, grantedBy);

    res.status(200).json(result);
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Unable to complete the request " + err });
  }
}

module.exports = {
  listAll,
  listPublished,
  create,
  getFormForRender,
  triggerOptionsProcessing,
  handleOptionsCallback,
  handleSaveDraft,
  allDraftSessionsByUser,
  getSessionDataByUser,
  updateForm,
  getUsersForForm,
  setUsersForForm,
};
