const express = require("express");
const ctrl = require("./controller");
const { requireAny } = require("../../middlewares/authorize");
const { authMiddleware } = require("../../middlewares/authMiddleware");
const responseRouter = require("../response/routes");

const router = express.Router();

router.get("/published", authMiddleware, ctrl.listPublished);
router.get("/", authMiddleware, ctrl.listAll);

// Create form
router.post("/", authMiddleware, ctrl.create);

router.get("/:formKey", authMiddleware, ctrl.getFormForRender);

router.get(
  "/:formKey/:sessionToken",
  authMiddleware,
  ctrl.getSessionDataByUser
);

router.post(
  "/:formKey/fields/:fieldId/options",
  authMiddleware,
  ctrl.triggerOptionsProcessing
);
router.post(
  "/webhooks/options-callback",
  authMiddleware,
  ctrl.handleOptionsCallback
);

router.post("/draft", authMiddleware, ctrl.handleSaveDraft);

router.use("/:id/responses", responseRouter);

module.exports = router;
