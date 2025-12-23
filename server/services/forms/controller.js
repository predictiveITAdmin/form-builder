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

/**
 * POST /forms
 * Admin/FormBuilder
 *
 * Body (payload):
 * {
 *  title, description, status, is_anonymous,
 *  rpa_webhook_url, rpa_secret, rpa_secret_method, rpa_timeout_ms, rpa_retry_count,
 *  form_key,
 *  steps: [...]
 * }
 */
async function create(req, res) {
  try {
    const payload = req.body;

    // Minimal validation (don’t overthink it yet)
    const problems = validateCreatePayload(payload);
    if (problems.length) {
      return res.status(400).json({
        error: "Invalid payload",
        problems,
      });
    }

    // owner_user_id comes from auth (server-side source of truth)
    const ownerUserId =
      req.user?.user_id ?? req.user?.id ?? req.user?.userId ?? null;

    const result = await svc.createForm(payload, {
      owner_user_id: ownerUserId,
    });

    return res.status(201).json(result);
  } catch (err) {
    // Duplicate key_name per form will throw due to UQ constraint
    if (isPgUniqueViolation(err)) {
      return res.status(409).json({
        error: "Duplicate field key_name within the form",
        details: err.detail || String(err?.message || err),
      });
    }

    return res.status(500).json({
      error: "Failed to create form",
      details: String(err?.message || err),
    });
  }
}

/** ---------- Helpers ---------- */

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

    if (!formKey || typeof formKey !== "string") {
      return res.status(400).json({ error: "Missing formKey" });
    }

    const result = await svc.getFormGraphByKey(formKey);
    console.log(result);
    if (!result.length || !result[0].form) {
      return res.status(404).json({ error: "Form not found" });
    }

    const form = result[0].form;

    return res.json(form);
  } catch (err) {
    console.log(err);
    return next(err);
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
module.exports = {
  listAll,
  listPublished,
  create,
  getFormForRender,
  triggerOptionsProcessing,
  handleOptionsCallback,
};
