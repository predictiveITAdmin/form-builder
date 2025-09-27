// server/services/responses/controller.js
const repo = require("./queries");

// POST /api/forms/:id/responses  (alias: /api/forms/:id/submit if you like)
exports.create = async (req, res) => {
  try {
    const formId = Number(req.params.id);
    const values = req.body?.values || {};
    const user = req.user
      ? {
          user_id: req.user.user_id,
          oid: req.user.oid,
          email: req.user.email,
          name: req.user.name,
        }
      : null;

    const { response_id } = await repo.submitResponse({
      formId,
      values,
      user,
      clientIp: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(201).json({ status: "ok", response_id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// GET /api/forms/:id/responses
exports.list = async (req, res) => {
  try {
    const formId = Number(req.params.id);
    const offset = Number(req.query.offset || 0);
    const limit = Number(req.query.limit || 50);
    const rows = await repo.listResponses({ formId, offset, limit });
    res.json({ items: rows, offset, limit });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// GET /api/forms/:id/responses/:responseId
exports.get = async (req, res) => {
  try {
    const formId = Number(req.params.id);
    const responseId = Number(req.params.responseId);
    const data = await repo.getResponse({ formId, responseId });
    if (!data) return res.status(404).json({ error: "Response not found" });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// DELETE /api/forms/:id/responses/:responseId
exports.remove = async (req, res) => {
  try {
    const formId = Number(req.params.id);
    const responseId = Number(req.params.responseId);
    const { deleted } = await repo.deleteResponse({ formId, responseId });
    if (!deleted) return res.status(404).json({ error: "Response not found" });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
