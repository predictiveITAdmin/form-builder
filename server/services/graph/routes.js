const express = require("express");
const ctrl = require("./controller");
const { authMiddleware } = require("../../middlewares/authMiddleware");

const router = express.Router();

router.get("/mailboxes", authMiddleware, ctrl.getMailboxes);

module.exports = router;
