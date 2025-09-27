// server/services/responses/routes.js
const express = require("express");
const ctrl = require("./controller");

const { azureAuth, optionalAzureAuth } = require("../../middlewares/azureAuth");
const { requireAny } = require("../../middlewares/authorize");

const router = express.Router({ mergeParams: true });

// nested under /api/forms/:id
router.post("/", optionalAzureAuth(), ctrl.create); // will enforce anon rules inside
router.get("/", azureAuth(), requireAny("Admin", "Manager"), ctrl.list);
router.get(
  "/:responseId",
  azureAuth(),
  requireAny("Admin", "Manager"),
  ctrl.get
);
router.delete("/:responseId", azureAuth(), requireAny("Admin"), ctrl.remove);

module.exports = router;
