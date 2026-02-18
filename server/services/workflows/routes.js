// Workflows/routes.js
const express = require("express");
const router = express.Router();

const controller = require("./controller");

// Replace these with your real middleware imports
const { authMiddleware } = require("../../middlewares/authMiddleware"); // or require("../../middleware/auth")
const { hasAnyPermission } = require("../../middlewares/permissionMiddleware");
// Example signature: hasAnyPermission("workflows.run.create")

/**
 * Workflow Runs
 * Base path suggestion: /api/workflows
 *
 * Runs are "instances":
 * - create a run from a workflow template
 * - view dashboard
 * - lock / cancel
 */

router.get(
  "/workflows",
  authMiddleware,
  hasAnyPermission(["workflows.read"]),
  controller.listWorkflows,
);

router.post(
  "/workflows",
  authMiddleware,
  hasAnyPermission(["workflows.create"]),
  controller.createWorkflow,
);

router.get(
  "/workflows/:workflowId",
  authMiddleware,
  hasAnyPermission(["workflows.read"]),
  controller.getWorkflow,
);

router.get(
  "/workflow-forms",
  authMiddleware,
  hasAnyPermission(["workflows.read"]),
  controller.listWorkflowForms,
);

// Get one workflow form by id
router.get(
  "/workflow-forms/:workflowFormId",
  authMiddleware,
  hasAnyPermission(["workflows.read"]),
  controller.getWorkflowForm,
);

router.delete(
  "/workflows/:workflowId/forms/:workflowFormId",
  authMiddleware,
  hasAnyPermission(["workflows.create"]),
  controller.removeFormFromWorkflow,
);

router.put(
  "/workflow-forms/:workflowFormId",
  authMiddleware,
  hasAnyPermission(["workflows.create"]),
  controller.updateWorkflowForm,
);

// Assign a form to a workflow (create workflow_form row)
router.post(
  "/workflows/:workflowId/forms",
  authMiddleware,
  hasAnyPermission(["workflows.create"]),
  controller.assignFormToWorkflow,
);

// Remove workflow_form link by id
router.delete(
  "/workflow-forms/:workflowFormId",
  authMiddleware,
  hasAnyPermission(["workflows.create"]),
  controller.removeFormFromWorkflow,
);

router.get(
  "/workflow-runs",
  authMiddleware,
  hasAnyPermission(["workflows.run.list"]),
  controller.listWorkflowRuns,
);

router.post(
  "/workflow-runs",
  authMiddleware,
  hasAnyPermission(["workflows.run.create"]),
  controller.createWorkflowRun,
);

router.get(
  "/workflow-runs/:runId",
  authMiddleware,
  hasAnyPermission(["workflows.run.view"]),
  controller.getWorkflowRunDashboard,
);

router.post(
  "/workflow-runs/:runId/lock",
  authMiddleware,
  hasAnyPermission(["workflows.run.lock"]),
  controller.lockWorkflowRun,
);

router.post(
  "/workflow-runs/:runId/cancel",
  authMiddleware,
  hasAnyPermission(["workflows.run.cancel"]),
  controller.cancelWorkflowRun,
);

router.post(
  "/workflow-items/:itemId/changeName",
  authMiddleware,
  hasAnyPermission(["workflows.item.assign"]),
  controller.changeItemDefaultName,
);

/**
 * Workflow Items
 * Items are the actionable task rows inside a run.
 */
router.post(
  "/workflow-items/:itemId/assign",
  authMiddleware,
  hasAnyPermission(["workflows.item.assign"]),
  controller.assignWorkflowItem,
);

router.post(
  "/workflow-items/:itemId/start",
  authMiddleware,
  hasAnyPermission(["workflows.item.start"]),
  controller.startWorkflowItem,
);

router.post(
  "/workflow-items/:itemId/skip",
  authMiddleware,
  hasAnyPermission(["workflows.item.skip"]),
  controller.skipWorkflowItem,
);

// Add another (repeatable) item instance
router.post(
  "/workflow-items/add",
  authMiddleware,
  hasAnyPermission(["workflows.item.add"]),
  controller.addRepeatWorkflowItem,
);

/**
 * Optional internal endpoint:
 * In practice, you’ll call markWorkflowItemSubmitted from your existing
 * form submission pipeline rather than exposing it publicly.
 * If you DO expose it, lock it down hard.
 */
router.post(
  "/workflow-items/mark-submitted",
  authMiddleware,
  hasAnyPermission(["workflows.item.markSubmitted"]),
  controller.markWorkflowItemSubmitted,
);

router.get(
  "/mytasks",
  authMiddleware,
  hasAnyPermission(["forms.read"]),
  controller.getTasks,
);

module.exports = router;
