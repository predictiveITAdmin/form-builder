const express = require("express");
const ctrl = require("./controller");

const { authMiddleware } = require("../../middlewares/authMiddleware");
const {
  hasPermissions,
  hasAnyPermission,
} = require("../../middlewares/permissionMiddleware");

const router = express.Router();

router.get("/home", authMiddleware, ctrl.getHomeDashboard);

module.exports = router;
