const { uploadFilesToBlob } = require("./fileService");
const { deliverWithRetry } = require("../integrations/webhook");
const svc = require("./queries"); // same folder as controller.js
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const { randomUUID } = require("crypto");
/**
 * GET /forms
 * Admin/Manager/FormBuilder
 */
async function listAll(req, res) {
  /*
    #swagger.tags = ['Forms']
    #swagger.summary = 'List all forms in the system (Admin)'
    #swagger.responses[200] = {
      description: 'Fetched all forms',
      schema: { forms: [{ form_id: 1, form_key: 'it-request', title: 'IT Request', status: 'Published' }] }
    }
  */
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
  /*
    #swagger.tags = ['Forms']
    #swagger.summary = 'List all published forms available to the current user'
    #swagger.responses[200] = {
      description: 'Fetched published forms',
      schema: { forms: [{ form_id: 1, form_key: 'it-request', title: 'IT Request', status: 'Published' }] }
    }
  */
  const user_id = req.user?.userId;
  if (!user_id) {
    res.status(401).json({ message: "User is not authenticated!" });
  }
  try {
    const forms = await svc.listPublishedForms(user_id);
    return res.json({ forms });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to list published forms",
      details: String(err?.message || err),
    });
  }
}

async function listWorkflowForms(req, res) {
  const user_id = req.user?.userId;
  if (!user_id) {
    res.status(401).json({ message: "User is not authenticated!" });
  }
  try {
    const forms = await svc.listWorkFlowForms();
    return res.json(forms);
  } catch (err) {
    return res.status(500).json({
      error: "Failed to list published forms",
      details: String(err?.message || err),
    });
  }
}

async function create(req, res) {
  /*
    #swagger.tags = ['Forms']
    #swagger.summary = 'Create a new form definition'
    #swagger.parameters['body'] = {
      in: 'body',
      description: 'Form schema definition',
      schema: { title: 'New Form', status: 'Draft', steps: [] }
    }
    #swagger.responses[201] = {
      description: 'Successfully created form',
      schema: { form_key: 'new-form', version: 1 }
    }
  */
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
    const isEdit = req.query.isEdit === "true";
    const user = req.user;
    const user_id = user.userId;
    if (!user_id) {
      return res.status(401).json({ error: "Unauthorized: missing user_id" });
    }

    if (!formKey || typeof formKey !== "string") {
      return res.status(400).json({ error: "Missing formKey" });
    }
    const permissions =
      user?.permissions instanceof Set ? user.permissions : new Set();

    if (isEdit) {
      const canEdit =
        permissions.has("forms.update") || permissions.has("forms.create");
      if (!canEdit) {
        return res.status(403).json({
          message:
            "Forbidden: admin permissions required (forms.update/forms.create)",
        });
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

      return res.json({ ...form, session });
    }
    const hasAccess = await svc.validateAccess(user_id, formKey);

    if (!hasAccess) {
      return res.status(403).json({
        message: "You do not have access to this form",
      });
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

async function uploadFiles(req, res) {
  try {
    if (!req.files?.length) {
      return res.status(400).json({ error: "No Files Uploaded" });
    }

    const uploader = req.user?.userId;
    if (!uploader) {
      return res.status(401).json({ message: "User is not Authenticated." });
    }

    const { formKey, fieldId } = req.params;
    const sessionToken = req.query.sessionToken;

    const formFieldId = Number(fieldId);
    if (!formKey || !formFieldId || !sessionToken) {
      return res.status(400).json({
        error: "Missing required params. Need formKey, fieldId, sessionToken.",
      });
    }

    const files = await uploadFilesToBlob(req.files, {
      uploadedBy: String(uploader),
      formFieldId,
      sessionToken: String(sessionToken),
      formKey: String(formKey),
    });

    return res.status(201).json({ files });
  } catch (e) {
    console.error("uploadFiles error:", e);
    return res.status(500).json({
      error: "Upload failed",
      details: String(e?.message || e),
    });
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

    const field = await svc.getDynamicUrl(fieldId);

    // Create job
    const jobId = randomUUID();
    const callbackToken = crypto.randomBytes(32).toString("hex");

    await svc.createOptionsJob({
      job_id: jobId,
      form_key: formKey,
      field_id: Number(fieldId),
      requester_user_id: req.user?.userId ?? null,
      requester_email: req.user?.email ?? null,
      requester_type: req.user?.type ?? null,
      callback_token: callbackToken,
    });

    // Fire RPA
    await axios.post(field.url, {
      formKey,
      fieldId,
      jobId,
      callbackUrl: `${process.env.APP_BASE_URL}/api/forms/webhooks/options-callback`,
      callbackAuth: {
        jobId,
        callbackToken,
        headers: {
          "X-Job-Id": jobId,
          "X-Callback-Token": callbackToken,
        },
      },
      data: field.data,
      userContext: {
        userId: req.user?.userId ?? null,
        email: req.user?.email ?? null,
        type: req.user?.type ?? null,
      },
      message:
        "POST back to callbackUrl with headers X-Job-Id and X-Callback-Token and JSON body { formKey, fieldId, options:[...] }",
    });

    return res.status(202).json({
      message: "Processing queued successfully",
      formKey,
      fieldId,
      jobId,
      status: "pending",
    });
  } catch (e) {
    console.error("triggerOptionsProcessing error:", e);
    return res.status(500).json({ message: e?.message || String(e) });
  }
}

async function optionsPolling(req, res) {

  const job = await svc.getOptionsJob(req.params.jobId);
  if (!job)
    return res.status(404).json({ success: false, message: "Job not found" });
  res.status(200).json({
    success: true,
    ...job,
  });
}

async function handleOptionsCallback(req, res, next) {
  try {
    const { job } = req.webhook; // set by webhookAuthMiddleware
    const { formKey, fieldId, options } = req.body;

    if (!formKey || !fieldId || !options) {
      return res
        .status(400)
        .json({ message: "Bad Request. Missing required fields." });
    }

    // Optional: sanity check matches job
    if (
      String(formKey) !== String(job.form_key) ||
      Number(fieldId) !== Number(job.field_id)
    ) {
      return res
        .status(409)
        .json({ message: "Callback payload does not match job context" });
    }

    await svc.saveOptionsToDb(fieldId, options);
    await svc.completeOptionsJob(job.job_id);

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

async function handleFinalSubmit(req, res, next) {
  /*
    #swagger.tags = ['Forms']
    #swagger.summary = 'Submit a completed form response'
    #swagger.parameters['body'] = {
      in: 'body',
      schema: { 
        response: { session_id: 'abc-123', total_steps: 2 },
        response_values: [{ form_field_id: 1, value_text: 'Laptop' }]
      }
    }
    #swagger.responses[200] = {
      description: 'Form submitted successfully',
      schema: { message: "Form submitted successfully", response_id: 10, session_completed: true }
    }
  */
  try {
    const { formKey } = req.params;
    const { response, response_values } = req.body || {};

    const user_id = req.user?.userId;
    if (!user_id) {
      return res.status(401).json({ message: "User is not authenticated!" });
    }

    if (!formKey || typeof formKey !== "string") {
      return res.status(400).json({ message: "Missing formKey" });
    }

    if (!response || typeof response !== "object") {
      return res
        .status(400)
        .json({ message: "Bad Request. Missing response object." });
    }

    if (!Array.isArray(response_values)) {
      return res.status(400).json({
        message: "Bad Request. response_values must be an array.",
      });
    }

    // Resolve form_id server-side (don’t trust the browser)
    const form_id = await svc.selectFormIdByKey(formKey);
    if (!form_id) {
      return res.status(404).json({ message: "Form not found" });
    }

    // Optional: validate access (keeps behaviour consistent with GET form)
    const hasAccess = await svc.validateAccess(user_id, formKey);
    if (!hasAccess) {
      return res
        .status(403)
        .json({ message: "You do not have access to fill this form" });
    }

    // We store the session_token in response.session_id in the frontend (yes, naming is cursed).
    const sessionToken = response.session_id;
    if (!sessionToken) {
      return res.status(400).json({
        message:
          "Bad Request. Missing required field: response.session_id (session token).",
      });
    }

    // Normalize payload
    const normalized = {
      response: {
        session_token: sessionToken,
        form_id,
        user_id,
        total_steps: response.total_steps,
        submitted_at: response.submitted_at ?? new Date().toISOString(),
        client_ip: response.client_ip ?? req.ip ?? null,
        user_agent: response.user_agent ?? req.headers["user-agent"] ?? null,
        meta_json: response.meta_json ?? {},
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

    // 1) Upsert draft + values
    const upserted = await svc.upsertDraftWithValues(normalized);

    // 2) Build aggregated payload (includes workflow context if present)
    const bundle = await svc.getRpaSubmissionBundleByResponseId(
      upserted.response_id,
    );
    if (!bundle) {
      return res
        .status(500)
        .json({ message: "Failed to build submission payload" });
    }

    // 3) Trigger webhook (if configured)
    const rpa = bundle.form?.rpa || {};
    const webhookUrl = rpa.webhook_url;
    const rpaSecret = rpa.secret;
    const headerKey = (rpa.header_key || "").trim();
    const timeoutMs = Number(rpa.timeout_ms ?? 8000);
    const retryCount = Number(rpa.retry_count ?? 0);

    if (webhookUrl) {
      let finalHeaderKey = headerKey || null;
      let finalHeaderValue = null;

      if (finalHeaderKey) {
        if (finalHeaderKey.toLowerCase() === "authorization") {
          finalHeaderValue = `Bearer ${rpaSecret || ""}`;
        } else {
          finalHeaderValue = rpaSecret || "";
        }
      }

      await deliverWithRetry(
        {
          url: webhookUrl,
          secret: rpaSecret,
          timeoutMs,
          retryCount,
          headerKey: finalHeaderKey,
          headerValue: finalHeaderValue,
        },
        bundle,
      );
    }

    // 4) Mark session complete (validators: form_id + user_id)
    const completedSession = await svc.completeOpenSessionByFormAndUser(
      form_id,
      user_id,
    );

    return res.status(200).json({
      message: "Form submitted successfully",
      response_id: upserted.response_id,
      session_completed: !!completedSession,
      completed_session: completedSession ?? null,
    });
  } catch (e) {
    console.error("Error final submitting form:", e);
    return next
      ? next(e)
      : res.status(500).json({ message: String(e?.message || e) });
  }
}

async function removeForm(req, res, next) {
  const formId = req.params.formId;
  try {
    const result = await svc.deleteForm(formId);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAll,
  listPublished,
  create,
  getFormForRender,
  triggerOptionsProcessing,
  handleOptionsCallback,
  optionsPolling,
  handleSaveDraft,
  allDraftSessionsByUser,
  getSessionDataByUser,
  updateForm,
  getUsersForForm,
  setUsersForForm,
  uploadFiles,
  listWorkflowForms,
  handleFinalSubmit,
  removeForm,
};
