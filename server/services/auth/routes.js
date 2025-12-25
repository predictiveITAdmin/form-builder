/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

var express = require("express");

const { azureAuth } = require("../../middlewares/azureAuth");

const { authMiddleware } = require("../../middlewares/authMiddleware");
const authProvider = require("./AuthProvider");
const { REDIRECT_URI, POST_LOGOUT_REDIRECT_URI } = require("./authConfig");
const controller = require("./controller");

const router = express.Router();

router.get(
  "/signin",
  authProvider.login({
    scopes: [],
    redirectUri: REDIRECT_URI,
    successRedirect: process.env.FRONTEND_URL,
  })
);

router.get(
  "/acquireToken",
  authProvider.acquireToken({
    scopes: ["User.Read"],
    redirectUri: REDIRECT_URI,
    successRedirect: "/users/profile",
  })
);

router.post("/redirect", authProvider.handleRedirect());

router.get(
  "/signout",
  authProvider.logout({
    postLogoutRedirectUri: POST_LOGOUT_REDIRECT_URI,
  })
);

router.post("/createUser", authMiddleware, controller.createUser);
router.post("/login", controller.login);
router.post("/createPassword", controller.createPassword);
router.get("/me", authMiddleware, controller.getMe);

router.put(
  "/roles/permissions",
  authMiddleware,
  controller.setPermissionsForRole
);

router.post("/permissions", authMiddleware, controller.createPermission);
router.get("/permissions", authMiddleware, controller.getPermission);
router.get(
  "/permissions/:permissionId",
  authMiddleware,
  controller.getPermission
);
router.put(
  "/permissions/:permissionId",
  authMiddleware,
  controller.updatePermission
);
router.delete(
  "/permissions/:permissionId",
  authMiddleware,
  controller.deletePermission
);

router.post("/roles", authMiddleware, controller.createRole);
router.get("/roles", authMiddleware, controller.getRoles);
router.put("/roles/:roleId", authMiddleware, controller.updateRole);
router.delete("/roles/:roleId", authMiddleware, controller.removeRole);

router.get("/users/:userId/roles", authMiddleware, controller.getUserRoles);
router.post("/users/:userId/roles", authMiddleware, controller.assignUserRoles);

module.exports = router;
