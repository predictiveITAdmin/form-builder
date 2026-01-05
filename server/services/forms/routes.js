const express = require("express");
const ctrl = require("./controller");

const { authMiddleware } = require("../../middlewares/authMiddleware");
const {
  hasPermissions,
  hasAnyPermission,
} = require("../../middlewares/permissionMiddleware");

const router = express.Router();
const upload = require("../../middlewares/uploadMiddleware");

router.get(
  "/published",
  authMiddleware,
  hasAnyPermission(["forms.read"]),
  ctrl.listPublished
);
router.get(
  "/",
  authMiddleware,
  hasAnyPermission(["forms.read", "forms.update"]),
  ctrl.listAll
);

router.post(
  "/",
  authMiddleware,
  hasAnyPermission(["forms.create", "forms.update"]),
  ctrl.create
);

router.put(
  "/:formId/assignUsers",
  authMiddleware,
  hasPermissions(["forms.create", "forms.update", "users.read"]),
  ctrl.setUsersForForm
);
router.get(
  "/:formId/getUsers",
  authMiddleware,
  hasPermissions(["forms.create", "forms.update", "users.read"]),
  ctrl.getUsersForForm
);

router.get(
  "/:formKey",
  authMiddleware,
  hasAnyPermission(["forms.read"]),
  ctrl.getFormForRender
);
router.put(
  "/:formKey",
  authMiddleware,
  hasPermissions(["forms.create", "forms.update"]),
  ctrl.updateForm
);

router.get(
  "/:formKey/:sessionToken",
  authMiddleware,
  hasPermissions(["forms.read"]),
  ctrl.getSessionDataByUser
);

router.post(
  "/:formKey/fields/:fieldId/files",
  authMiddleware,
  upload.array("files", 10),
  ctrl.uploadFiles
);

router.post(
  "/:formKey/fields/:fieldId/options",
  authMiddleware,
  ctrl.triggerOptionsProcessing
);
router.post(
  "/webhooks/options-callback",
  authMiddleware,
  ctrl.handleOptionsCallback
);

router.post(
  "/draft",
  authMiddleware,
  hasPermissions(["responses.create", "responses.update"]),
  ctrl.handleSaveDraft
);

module.exports = router;
