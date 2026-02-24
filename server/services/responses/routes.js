const express = require("express");
const ctrl = require("./controller");

const { authMiddleware } = require("../../middlewares/authMiddleware");
const {
  hasPermissions,
  hasAnyPermission,
} = require("../../middlewares/permissionMiddleware");
const router = express.Router();

router.get(
  "/",
  authMiddleware,
  hasAnyPermission([
    "responses.read",
    "responses.update",
    "responses.create",
    "responses.delete",
  ]),
  ctrl.listResponses
);

router.get(
  "/:responseId",
  authMiddleware,
  hasAnyPermission([
    "responses.read",
    "responses.update",
    "responses.create",
    "responses.delete",
  ]),
  ctrl.getResponseGraph
);

router.delete(
  "/:responseId",
  authMiddleware,
  hasAnyPermission(["responses.delete", "responses.update"]),
  ctrl.deleteResponse
);

router.post(
  "/:responseId/email",
  authMiddleware,
  hasAnyPermission(["forms.create", "forms.update"]),
  ctrl.sendResponseEmail
);

router.post(
  "/:responseId/decrypt",
  authMiddleware,
  hasAnyPermission(["responses.read", "responses.update"]),
  ctrl.decryptResponseField
);

module.exports = router;
