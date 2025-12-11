// server/services/responses/routes.js
const express = require("express");
const ctrl = require("./controller");

const { azureAuth, optionalAzureAuth } = require("../../middlewares/azureAuth");
const { requireAny } = require("../../middlewares/authorize");

const router = express.Router({ mergeParams: true });

// nested under /api/forms/:id
router.post("/api/forms/:id/responses", ctrl.create);
router.post("/api/forms/:id/responses/from-session", ctrl.createFromSession);
router.get("/api/forms/:id/responses", ctrl.list);
router.get("/api/forms/:id/responses/analytics", ctrl.getAnalytics);
router.get("/api/forms/:id/responses/:responseId", ctrl.get);
router.delete("/api/forms/:id/responses/:responseId", ctrl.remove);

module.exports = router;
