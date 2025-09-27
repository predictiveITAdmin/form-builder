const express = require("express");
const ctrl = require("./controller");
const { azureAuth } = require("../../middlewares/azureAuth");
const { requireAny } = require("../../middlewares/authorize");

const responseRouter = require("../response/routes");

const router = express.Router();

router.get("/published", azureAuth(), ctrl.listPublished);
router.get(
  "/",
  azureAuth(),
  requireAny("Admin", "Manager", "FormBuilder"),
  ctrl.listAll
);

router.get("/:id", azureAuth(), ctrl.get);

router.post("/", azureAuth(), requireAny("Admin", "FormBuilder"), ctrl.create);
router.patch(
  "/:id",
  azureAuth(),
  requireAny("Admin", "FormBuilder"),
  ctrl.update
);
router.delete("/:id", azureAuth(), requireAny("Admin"), ctrl.remove);

// Fields
router.get("/:id/fields", azureAuth(), ctrl.listFields);
router.post(
  "/:id/fields",
  azureAuth(),
  requireAny("Admin", "FormBuilder"),
  ctrl.createField
);
router.patch(
  "/:id/fields/:fieldId",
  azureAuth(),
  requireAny("Admin", "FormBuilder"),
  ctrl.updateField
);
router.delete(
  "/:id/fields/:fieldId",
  azureAuth(),
  requireAny("Admin", "FormBuilder"),
  ctrl.removeField
);

router.use("/:id/responses", responseRouter);

module.exports = router;
