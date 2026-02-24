const formQueries = require("../forms/queries");
const workflowQueries = require("./queries");
const { query } = require("../../db/pool");
const { sendCustomEmail } = require("../auth/utils");

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
  /*
    #swagger.tags = ['Workflows']
    #swagger.summary = 'Create a new workflow template'
    #swagger.parameters['body'] = {
      in: 'body',
      description: 'Workflow details',
      schema: { title: 'Employee Onboarding', description: 'Steps for new hires' }
    }
    #swagger.responses[201] = {
      description: 'Workflow created',
      schema: { workflow: { workflow_id: 1, title: 'Employee Onboarding', status: 'Active' } }
    }
  */
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
  /*
    #swagger.tags = ['Workflows']
    #swagger.summary = 'List all workflow templates'
    #swagger.responses[200] = {
      description: 'Successfully fetched workflows',
      schema: [{ workflow_id: 1, title: 'Employee Onboarding', status: 'Active', created_at: '2026-02-23T12:00:00Z' }]
    }
  */
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

async function assignFormToWorkflow(req, res, next) {
  try {
    const workflow_id = req.params.workflowId;
    const { form_id, required, allow_multiple, sort_order, default_name } =
      req.body;

    const result = await workflowQueries.createWorkflowForm({
      workflow_id,
      form_id,
      required,
      allow_multiple,
      sort_order,
      default_name,
    });

    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function updateWorkflowForm(req, res, next) {
  try {
    const workflow_form_id = req.params.workflowFormId;
    const { required, allow_multiple, sort_order, default_name } = req.body;

    const result = await workflowQueries.updateWorkflowForm({
      workflow_form_id,
      required,
      allow_multiple,
      sort_order,
      default_name,
    });

    if (!result) {
      return res.status(404).json({ message: "Workflow Form not found" });
    }

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function removeFormFromWorkflow(req, res, next) {
  try {
    const workflow_form_id = req.params.workflowFormId;

    const result = await workflowQueries.removeWorkflowForm(workflow_form_id);

    // If your DELETE doesn't RETURNING anything (currently it doesn't),
    // result will be undefined. Still fine: 204 is appropriate.
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function getWorkflowForm(req, res, next) {
  try {
    const workflow_form_id = req.params.workflowFormId;

    const result = await workflowQueries.getWorkflowForm(workflow_form_id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function listWorkflowForms(req, res, next) {
  try {
    const result = await workflowQueries.listWorkflowForms();
    return res.status(200).json(result);
  } catch (err) {
    next(err);
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
  /*
    #swagger.tags = ['Workflows']
    #swagger.summary = 'List all instances (runs) of workflows'
    #swagger.responses[200] = {
      description: 'Fetched workflow runs',
      schema: [{ run_id: 10, workflow_id: 1, display_name: 'John Doe Onboarding', status: 'in_progress', creator_name: 'Admin' }]
    }
  */
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
  /*
    #swagger.tags = ['Workflows']
    #swagger.summary = 'Start a new workflow run from a template'
    #swagger.parameters['body'] = {
      in: 'body',
      schema: { workflow_id: 1, display_name: 'Jane Doe Onboarding' }
    }
    #swagger.responses[201] = {
      description: 'Workflow Run created',
      schema: { run_id: 11, workflow_id: 1, display_name: 'Jane Doe Onboarding', status: 'in_progress' }
    }
  */
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
      reason ?? null,
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
      assigned_user_id,
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

    const hasAccess = await formQueries.validateAccess();

    if (!hasAccess) {
      return res(401).json({
        message: "You do not have access to fill this form.",
      });
    }

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
      reason,
    );

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function addRepeatWorkflowItem(req, res, next) {
  try {
    const {
      runId,
      workflowFormId,
      fromItemId,
      assigned_user_id,
      display_name,
    } = req.body || {};

    const result = await workflowQueries.addRepeatWorkflowItem({
      runId,
      workflowFormId,
      fromItemId,
      assigned_user_id,
      display_name,
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

async function getTasks(req, res) {
  try {
    const user_id = getUserId(req);

    if (!user_id) {
      res.status(401).json({
        message: "You are not authorized to view the resource.",
      });
    }

    const result = await workflowQueries.getTasks(user_id);

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function changeItemDefaultName(req, res, next) {
  try {
    const itemId = req.params.itemId;
    const { display_name } = req.body;

    const result = await workflowQueries.changeItemDisplayName(
      display_name,
      itemId,
    );

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function sendWorkflowRunEmail(req, res, next) {
  try {
    const runId = req.params.runId;
    const { subject, salutation, message, regards, to } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: "Subject and message are required" });
    }

    let toEmail = to;

    if (!toEmail) {
      // Fallback: Find the email of the person who created this workflow run
      const result = await query(
        `SELECT u.email 
         FROM public.workflow_runs wr
         JOIN public.users u ON wr.created_by = u.user_id
         WHERE wr.workflow_run_id = $1`,
        [runId]
      );

      if (result.length === 0 || !result[0].email) {
        return res.status(404).json({ error: "Submitter email not found for this workflow run." });
      }
      
      toEmail = result[0].email;
    }

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        ${salutation ? `<p>${salutation}</p>` : ""}
        <div>${message}</div>
        ${regards ? `<p>${regards.replace(/\n/g, "<br>")}</p>` : ""}
      </div>
    `;

    await sendCustomEmail(toEmail, subject, htmlBody);

    return res.status(200).json({ message: "Email sent successfully" });
  } catch (err) {
    console.error("[Workflows] Error sending custom email:", err);
    res.status(500).json({ error: "Failed to send email" });
  }
}

async function deleteWorkflow(req, res, next) {
  try {
    const workflowId = Number(req.params.workflowId);
    await workflowQueries.deleteWorkflow(workflowId);
    return res.status(200).json({ message: "Workflow deleted successfully" });
  } catch (err) {
    return next(err);
  }
}

async function deleteWorkflowRun(req, res, next) {
  try {
    const runId = Number(req.params.runId);
    await workflowQueries.deleteWorkflowRun(runId);
    return res.status(200).json({ message: "Workflow run deleted successfully" });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getWorkflow,
  createWorkflow,
  listWorkflows,
  deleteWorkflow,

  assignFormToWorkflow,
  removeFormFromWorkflow,
  getWorkflowForm,
  listWorkflowForms,
  updateWorkflowForm,

  listWorkflowRuns,
  createWorkflowRun,
  getWorkflowRunDashboard,
  lockWorkflowRun,
  cancelWorkflowRun,
  deleteWorkflowRun,

  assignWorkflowItem,
  startWorkflowItem,
  skipWorkflowItem,
  addRepeatWorkflowItem,

  markWorkflowItemSubmitted,
  getTasks,
  changeItemDefaultName,
  sendWorkflowRunEmail,
};
