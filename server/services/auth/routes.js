/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

var express = require("express");

const { azureAuth } = require("../../middlewares/azureAuth");
const { requireAny } = require("../../middlewares/authorize");

const authProvider = require("./AuthProvider");
const { REDIRECT_URI, POST_LOGOUT_REDIRECT_URI } = require("./authConfig");
const controller = require("./controller");

const router = express.Router();

router.get(
  "/signin",
  authProvider.login({
    scopes: [],
    redirectUri: REDIRECT_URI,
    successRedirect: "/",
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

router.post("/createUser", azureAuth(), controller.createUser);
router.post("/login", controller.login);
router.post("/createPassword", controller.createPassword);

module.exports = router;
