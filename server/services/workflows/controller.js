const workflowQueries = require("./queries");

function getUserId(req) {
  return req.user?.userId ?? req.user?.id ?? null;
}

function slugifyKey(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function createWorkflow(req, res, next) {
  try {
    const userId = getUserId(req);
    const { title, workflow_key, description, status } = req.body || {};

    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: "title is required" });
    }

    const key =
      (workflow_key && String(workflow_key).trim()) || slugifyKey(title);
    if (!key)
      return res
        .status(400)
        .json({ message: "workflow_key could not be generated" });

    const created = await workflowQueries.createWorkflow({
      workflow_key: key,
      title: String(title).trim(),
      description: description ?? null,
      status: status ?? "Active",
      created_by: userId,
    });

    return res.status(201).json({ workflow: created });
  } catch (err) {
    return next(err);
  }
}

async function getWorkflow(req, res, next) {
  try {
    const workflowId = Number(req.params.workflowId);
    const wf = await workflowQueries.getWorkflowById(workflowId);

    if (!wf) return res.status(404).json({ message: "Workflow not found" });

    return res.status(200).json({ workflow: wf });
  } catch (err) {
    return next(err);
  }
}

async function listWorkflows(req, res, next) {
  try {
    const { status } = req.query || {};
    const rows = await workflowQueries.listWorkflows({
      status: status ?? null,
    });
    return res.status(200).json(rows);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /workflow-runs
 * Optional query:
 * - mine=true  -> filters to runs I'm involved in (assigned OR created_by)
 * - workflow_id=123
 * - status=in_progress
 */
async function listWorkflowRuns(req, res, next) {
  try {
    const userId = getUserId(req);
    const { mine, workflow_id, status } = req.query || {};

    const scopedUserId =
      String(mine).toLowerCase() === "true" || String(mine) === "1"
        ? userId
        : null;

    const rows = await workflowQueries.listWorkflowRuns({
      userId: scopedUserId,
      workflow_id: workflow_id ? Number(workflow_id) : null,
      status: status ?? null,
    });

    return res.status(200).json(rows);
  } catch (err) {
    return next(err);
  }
}

async function createWorkflowRun(req, res, next) {
  try {
    const userId = getUserId(req);
    const { workflow_id, display_name } = req.body || {};

    const result = await workflowQueries.createWorkflowRun({
      workflow_id,
      display_name,
      created_by: userId,
    });

    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
}

async function getWorkflowRunDashboard(req, res, next) {
  try {
    const runId = Number(req.params.runId);

    const dashboard = await workflowQueries.getWorkflowRunDashboard(runId);

    if (!dashboard)
      return res.status(404).json({ error: "Workflow run not found" });

    return res.status(200).json(dashboard);
  } catch (err) {
    return next(err);
  }
}

async function lockWorkflowRun(req, res, next) {
  try {
    const userId = getUserId(req);
    const runId = Number(req.params.runId);

    const result = await workflowQueries.lockWorkflowRun(runId, userId);

    if (!result)
      return res.status(404).json({ error: "Workflow run not found" });

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function cancelWorkflowRun(req, res, next) {
  try {
    const userId = getUserId(req);
    const runId = Number(req.params.runId);
    const { reason } = req.body || {};

    const result = await workflowQueries.cancelWorkflowRun(
      runId,
      userId,
      reason ?? null
    );

    if (!result)
      return res.status(404).json({ error: "Workflow run not found" });

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function assignWorkflowItem(req, res, next) {
  try {
    const itemId = Number(req.params.itemId);
    const { assigned_user_id } = req.body || {};

    const result = await workflowQueries.assignWorkflowItem(
      itemId,
      assigned_user_id
    );

    if (!result)
      return res.status(404).json({ error: "Workflow item not found" });

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function startWorkflowItem(req, res, next) {
  try {
    const userId = getUserId(req);
    const itemId = Number(req.params.itemId);

    const result = await workflowQueries.startWorkflowItem(itemId, userId);

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function skipWorkflowItem(req, res, next) {
  try {
    const userId = getUserId(req);
    const itemId = Number(req.params.itemId);
    const { reason } = req.body || {};

    const result = await workflowQueries.skipWorkflowItem(
      itemId,
      userId,
      reason
    );

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function addRepeatWorkflowItem(req, res, next) {
  try {
    const { runId, workflowFormId, fromItemId, assigned_user_id } =
      req.body || {};

    const result = await workflowQueries.addRepeatWorkflowItem({
      runId,
      workflowFormId,
      fromItemId,
      assigned_user_id,
    });

    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
}

async function markWorkflowItemSubmitted(req, res, next) {
  try {
    const { workflow_item_id, workflow_run_id } = req.body || {};

    const result = await workflowQueries.markWorkflowItemSubmitted({
      workflow_item_id,
      workflow_run_id,
    });

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getWorkflow,
  createWorkflow,
  listWorkflows,
  listWorkflowRuns,
  createWorkflowRun,
  getWorkflowRunDashboard,
  lockWorkflowRun,
  cancelWorkflowRun,

  assignWorkflowItem,
  startWorkflowItem,
  skipWorkflowItem,
  addRepeatWorkflowItem,

  markWorkflowItemSubmitted,
};
