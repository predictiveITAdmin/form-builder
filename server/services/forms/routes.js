const express = require("express");
const ctrl = require("./controller");

const { authMiddleware } = require("../../middlewares/authMiddleware");

const router = express.Router();

router.get("/published", authMiddleware, ctrl.listPublished);
router.get("/", authMiddleware, ctrl.listAll);

router.post("/", authMiddleware, ctrl.create);

router.get("/:formKey", authMiddleware, ctrl.getFormForRender);
router.put("/:formKey", authMiddleware, ctrl.updateForm);

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

module.exports = router;
