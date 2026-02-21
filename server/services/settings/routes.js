const express = require("express");
const ctrl = require("./controller");

const { authMiddleware } = require("../../middlewares/authMiddleware");
const { hasAnyPermission, hasPermissions } = require("../../middlewares/permissionMiddleware");

const router = express.Router();

// Allow anyone who can view settings to read them
router.get(
  "/", 
  authMiddleware, 
  hasAnyPermission(["settings.read"]), 
  ctrl.getSettings
);

// Allow update for those who can configure settings
router.post(
  "/", 
  authMiddleware, 
  hasAnyPermission(["settings.update"]), 
  ctrl.updateSettings
);

// High-security endpoint for Raw SQL: 
router.post(
  "/query", 
  authMiddleware, 
  hasAnyPermission(["settings.query"]), 
  ctrl.runRawSql
);

module.exports = router;
