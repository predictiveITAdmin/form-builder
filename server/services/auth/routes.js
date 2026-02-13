var express = require("express");

const { authMiddleware } = require("../../middlewares/authMiddleware");
const authProvider = require("./AuthProvider");
const { REDIRECT_URI, POST_LOGOUT_REDIRECT_URI } = require("./authConfig");
const controller = require("./controller");
const {
  hasPermissions,
  hasAnyPermission,
} = require("../../middlewares/permissionMiddleware");

const router = express.Router();

router.get(
  "/signin",
  authProvider.login({
    scopes: [],
    redirectUri: REDIRECT_URI,
    successRedirect: process.env.FRONTEND_URL,
  }),
);

router.get(
  "/acquireToken",
  authProvider.acquireToken({
    scopes: ["User.Read"],
    redirectUri: REDIRECT_URI,
    successRedirect: "/users/profile",
  }),
);

router.post("/redirect", authProvider.handleRedirect());

router.get(
  "/signout",
  authProvider.logout({
    postLogoutRedirectUri: POST_LOGOUT_REDIRECT_URI,
  }),
);

router.post(
  "/createUser",
  authMiddleware,
  hasPermissions(["users.create"]),
  controller.createUser,
);

router.post("/forgotPassword", controller.forgotPassword);

router.post("/login", controller.login);
router.post("/createPassword", controller.createPassword);
router.get("/me", authMiddleware, controller.getMe);

router.put(
  "/roles/permissions",
  authMiddleware,
  hasAnyPermission(["roles.create", "roles.update"]),
  controller.setPermissionsForRole,
);

router.get(
  "/roles/permissions/:roleId",
  authMiddleware,
  hasAnyPermission(["roles.create", "roles.read", "roles.update"]),
  controller.getPermissionsForRole,
);

router.get(
  "/permissions",
  authMiddleware,
  hasAnyPermission(["roles.create", "roles.read", "roles.update"]),
  controller.getPermission,
);

router.post(
  "/roles",
  authMiddleware,
  hasAnyPermission(["roles.create", "roles.update"]),
  controller.createRole,
);
router.get(
  "/roles",
  authMiddleware,
  hasAnyPermission(["roles.create", "roles.read", "roles.update"]),
  controller.getRoles,
);
router.put(
  "/roles/:roleId",
  authMiddleware,
  hasAnyPermission(["roles.create", "roles.read", "roles.update"]),
  controller.updateRole,
);
router.delete(
  "/roles/:roleId",
  hasAnyPermission([
    "roles.create",
    "roles.read",
    "roles.update",
    "roles.delete",
  ]),
  authMiddleware,
  controller.removeRole,
);

router.get(
  "/users",
  authMiddleware,
  hasAnyPermission(["users.create", "users.read", "users.update"]),
  controller.getAllUsers,
);
router.get(
  "/users/:user_id",
  authMiddleware,
  hasAnyPermission(["users.create", "users.read", "users.update"]),
  controller.getUser,
);
router.put(
  "/users/:user_id",
  authMiddleware,
  hasAnyPermission(["users.create", "users.update"]),
  controller.editUser,
);

router.get(
  "/users/:userId/roles",
  authMiddleware,
  hasPermissions(["users.read", "roles.read", "roles.update"]),
  controller.getUserRoles,
);
router.post(
  "/users/:userId/roles",
  hasPermissions([
    "users.read",
    "users.update",
    "users.create",
    "roles.update",
    "roles.create",
  ]),
  authMiddleware,
  controller.assignUserRoles,
);

module.exports = router;
