const repo = require("./queries");

function toHttp(err) {
  if (/Form is published and cannot be edited/i.test(err.message)) {
    return {
      code: 409,
      body: { error: "Form is published and cannot be edited" },
    };
  }
  if (/Form not found/i.test(err.message)) {
    return { code: 404, body: { error: "Form not found" } };
  }
  return { code: 500, body: { error: err.message } };
}

exports.listPublished = async (req, res, next) => {
  try {
    res.json(await repo.listPublishedForms());
  } catch (e) {
    next(e);
  }
};

exports.listAll = async (req, res, next) => {
  try {
    res.json(await repo.listForms());
  } catch (e) {
    next(e);
  }
};

exports.get = async (req, res, next) => {
  try {
    const formId = Number(req.params.id);
    const includeOptions = req.query.includeOptions === "1";
    const data = await repo.getFormWithFields(formId, { includeOptions });
    if (!data) return res.status(404).json({ error: "Form not found" });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

exports.create = async (req, res) => {
  try {
    const formId = Number(req.params.id);
    const values = req.body?.values || {};
    const { response_id } = await repo.submitResponse({
      formId,
      values,
      azureUser: req.azureUser || null,
      clientIp: req.ip,
      userAgent: req.headers["user-agent"],
    });
    res.status(201).json({ status: "ok", response_id });
  } catch (e) {
    const code = /Authentication required/i.test(e.message) ? 401 : 500;
    res.status(code).json({ error: e.message });
  }
};

exports.update = async (req, res) => {
  try {
    await repo.editForm(Number(req.params.id), req.body || {});
    res.json({ status: "ok" });
  } catch (e) {
    const http = toHttp(e);
    res.status(http.code).json(http.body);
  }
};

exports.remove = async (req, res) => {
  try {
    await repo.deleteForm(Number(req.params.id));
    res.status(204).end();
  } catch (e) {
    const http = toHttp(e);
    res.status(http.code).json(http.body);
  }
};

exports.listFields = async (req, res, next) => {
  try {
    res.json(await repo.listFields(Number(req.params.id)));
  } catch (e) {
    next(e);
  }
};

exports.createField = async (req, res) => {
  try {
    const { field_id } = await repo.createField(
      Number(req.params.id),
      req.body || {}
    );
    res.status(201).json({ status: "ok", field_id });
  } catch (e) {
    const http = toHttp(e);
    res.status(http.code).json(http.body);
  }
};

exports.updateField = async (req, res) => {
  try {
    await repo.editField(
      Number(req.params.id),
      Number(req.params.fieldId),
      req.body || {}
    );
    res.json({ status: "ok" });
  } catch (e) {
    const http = toHttp(e);
    res.status(http.code).json(http.body);
  }
};

exports.removeField = async (req, res) => {
  try {
    const { softDeleted } = await repo.deleteField(
      Number(req.params.id),
      Number(req.params.fieldId)
    );
    res.json({ status: "ok", softDeleted });
  } catch (e) {
    const http = toHttp(e);
    res.status(http.code).json(http.body);
  }
};
