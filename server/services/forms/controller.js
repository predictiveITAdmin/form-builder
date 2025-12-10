const repo = require("./queries");

function toHttp(err) {
  if (/Form is published and cannot be edited/i.test(err.message)) {
    return {
      code: 400,
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
    res.status(201).json({ status: true, response_id });
  } catch (e) {
    const code = /Authentication required/i.test(e.message) ? 401 : 500;
    res.status(code).json({ error: e.message });
  }
};

exports.update = async (req, res) => {
  try {
    await repo.editForm(Number(req.params.id), req.body || {});
    res.json({ status: true });
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
    res.status(201).json({ status: true, field_id });
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
    res.json({ status: true });
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
    res.json({ status: true, softDeleted });
  } catch (e) {
    const http = toHttp(e);
    res.status(http.code).json(http.body);
  }
};

exports.getActiveSessions = async (req, res, next) => {
  try {
    const formId = req.params.formId;
    const userId = req.params.userId;
    const sessionToken = req.params.sessionToken;

    const data = await repo.getActiveSession(formId, { sessionToken, userId });
    res.json({
      status: true,
      data,
    });
  } catch (error) {
    const http = toHttp(error);
    res.json(http.body).status(http.code);
  }
};

exports.getSessionDraftData = async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;

    const draftData = await repo.getSessionDraftData(sessionId);
    res.json({
      status: true,
      draftData,
    });
  } catch (error) {
    const http = toHttp(error);
    res.json(http.body).status(http.code);
  }
};

exports.createOrUpdateSession = async (req, res, next) => {
  try {
    const formId = req.params.formId;
    const sessionId = req.params.sessionId;
    const userId = req.params.userId;

    const { currentStep, totalSteps, clientIp, userAgent, expiresAt } =
      req.body;

    const created = await repo.createOrUpdateSession(
      formId,
      sessionId,
      userId,
      currentStep,
      totalSteps,
      clientIp,
      userAgent,
      expiresAt
    );

    res.json({
      status: true,
      created,
    });
  } catch (error) {
    const http = toHttp(error);
    res.json(http.body).status(http.code);
  }
};

exports.saveStepData = async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;

    const { stepNumber, fieldValues } = req.body;

    const saved = await repo.saveStepData(sessionId, stepNumber, fieldValues);

    res.json({
      status: true,
      saved,
    });
  } catch (error) {
    const http = toHttp(error);
    res.json(http.body).status(http.code);
  }
};

exports.updateStepProgress = async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;
    const { stepNumber, isCompleted, isValidated, validationErrors } = req.body;

    const updatedStep = await repo.updateStepProgress(
      sessionId,
      stepNumber,
      isCompleted,
      isValidated,
      validationErrors
    );

    res.json({
      success: true,
      updatedStep,
    });
  } catch (error) {
    const http = toHttp(error);
    res.json(http.body).status(http.code);
  }
};

exports.completeSession = async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;

    const completedSession = await repo.completeSession(sessionId);

    res.json({
      success: true,
      completedSession,
    });
  } catch (error) {
    const http = await toHttp(error);
    res.json(http.body).status(http.code);
  }
};

exports.deleteSession = async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;

    const deletedSession = await repo.deleteSession(sessionId);
    res.json({
      success: true,
      deletedSession,
    });
  } catch (error) {
    const http = toHttp(error);
    res.json(http.body).status(http.code);
  }
};

const getUserSessions = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const includeCompleted = req.params.completed;

    const result = await repo.getUserSessions(userId, { includeCompleted });

    res.json({
      success: true,
      getUserSessions,
    });
  } catch (error) {
    const http = toHttp(error);
    res.json(http.body).status(http.code);
  }
};
