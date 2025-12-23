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
// routes.js
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

// router.get("/published", authMiddleware, ctrl.listPublished);
// router.get(
//   "/",
//   authMiddleware,
//   requireAny("Admin", "Manager", "FormBuilder"),
//   ctrl.listAll
// );

// router.post(
//   "/",
//   authMiddleware,
//   requireAny("Admin", "FormBuilder"),
//   ctrl.create
// );
// router.patch(
//   "/:id",
//   authMiddleware,
//   requireAny("Admin", "FormBuilder"),
//   ctrl.update
// );
// router.delete("/:id", authMiddleware, requireAny("Admin"), ctrl.remove);

// // Fields
// router.get("/:id/fields", authMiddleware, ctrl.listFields);
// router.post(
//   "/:id/fields",
//   authMiddleware,
//   requireAny("Admin", "FormBuilder"),
//   ctrl.createField
// );
// router.patch(
//   "/:id/fields/:fieldId",
//   authMiddleware,
//   requireAny("Admin", "FormBuilder"),
//   ctrl.updateField
// );
// router.delete(
//   "/:id/fields/:fieldId",
//   authMiddleware,
//   requireAny("Admin", "FormBuilder"),
//   ctrl.removeField
// );

router.use("/:id/responses", responseRouter);

module.exports = router;
