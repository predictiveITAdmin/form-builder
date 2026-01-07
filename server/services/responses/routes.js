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

module.exports = router;
