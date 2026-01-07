const express = require("express");
const ctrl = require("./controller");

const { authMiddleware } = require("../../middlewares/authMiddleware");
const {
  hasPermissions,
  hasAnyPermission,
} = require("../../middlewares/permissionMiddleware");

const router = express.Router();

router.get("/home", authMiddleware, ctrl.getHomeDashboard);

router.get(
  "/admin",
  authMiddleware,
  hasAnyPermission(["users.read", "roles.read"]),
  ctrl.getAdminDashboard
);

module.exports = router;
