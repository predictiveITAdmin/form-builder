// server/services/responses/controller.js
const repo = require("./queries");

// POST /api/forms/:id/responses  (alias: /api/forms/:id/submit if you like)
exports.create = async (req, res) => {
  try {
    const formId = Number(req.params.id);
    const values = req.body?.values || {};
    const sessionId = req.body?.session_id || null;

    // Build user object supporting both Internal and External users
    const user = req.user
      ? {
          user_id: req.user.user_id,
          email: req.user.email,
          display_name: req.user.display_name || req.user.name,
          user_type: req.user.user_type,
          entra_object_id: req.user.entra_object_id || req.user.oid || null,
        }
      : null;

    const { response_id } = await repo.submitResponse({
      formId,
      values,
      user,
      clientIp: req.ip,
      userAgent: req.headers["user-agent"],
      sessionId,
    });

    res.status(201).json({ status: "ok", response_id });
  } catch (e) {
    console.error("[responses.create] Error:", e);
    res.status(500).json({ error: e.message });
  }
};

// POST /api/forms/:id/responses/from-session
// Submit response from saved session data
exports.createFromSession = async (req, res) => {
  try {
    const formId = Number(req.params.id);
    const sessionId = req.body?.session_id;

    if (!sessionId) {
      return res.status(400).json({ error: "session_id is required" });
    }

    // Build user object if authenticated
    const user = req.user
      ? {
          user_id: req.user.user_id,
          email: req.user.email,
          display_name: req.user.display_name || req.user.name,
          user_type: req.user.user_type,
          entra_object_id: req.user.entra_object_id || req.user.oid || null,
        }
      : null;

    const { response_id, session_id } = await repo.submitResponseFromSession({
      sessionId,
      user,
    });

    res.status(201).json({
      status: "ok",
      response_id,
      session_id,
    });
  } catch (e) {
    console.error("[responses.createFromSession] Error:", e);

    // Handle specific errors with appropriate status codes
    if (e.message === "Session not found") {
      return res.status(404).json({ error: e.message });
    }
    if (e.message === "Session already completed") {
      return res.status(409).json({ error: e.message });
    }
    if (e.message === "Authentication required to submit this form") {
      return res.status(401).json({ error: e.message });
    }
    if (e.message === "No data found in session") {
      return res.status(400).json({ error: e.message });
    }

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

    res.json({
      items: rows,
      offset,
      limit,
      total: rows.length,
    });
  } catch (e) {
    console.error("[responses.list] Error:", e);
    res.status(500).json({ error: e.message });
  }
};

// GET /api/forms/:id/responses/:responseId
exports.get = async (req, res) => {
  try {
    const formId = Number(req.params.id);
    const responseId = Number(req.params.responseId);

    const data = await repo.getResponse({ formId, responseId });

    if (!data) {
      return res.status(404).json({ error: "Response not found" });
    }

    res.json(data);
  } catch (e) {
    console.error("[responses.get] Error:", e);
    res.status(500).json({ error: e.message });
  }
};

// DELETE /api/forms/:id/responses/:responseId
exports.remove = async (req, res) => {
  try {
    const formId = Number(req.params.id);
    const responseId = Number(req.params.responseId);

    const { deleted } = await repo.deleteResponse({ formId, responseId });

    if (!deleted) {
      return res.status(404).json({ error: "Response not found" });
    }

    res.status(204).end();
  } catch (e) {
    console.error("[responses.remove] Error:", e);
    res.status(500).json({ error: e.message });
  }
};

// GET /api/forms/:id/responses/analytics
// Get session analytics for a form
exports.getAnalytics = async (req, res) => {
  try {
    const formId = Number(req.params.id);

    const analytics = await repo.getSessionAnalytics({ formId });

    res.json({
      form_id: formId,
      analytics: analytics[0] || {
        completed_sessions: 0,
        active_sessions: 0,
        expired_sessions: 0,
        avg_completion_time_seconds: null,
        avg_progress_percentage: null,
      },
    });
  } catch (e) {
    console.error("[responses.getAnalytics] Error:", e);
    res.status(500).json({ error: e.message });
  }
};

module.exports = exports;
