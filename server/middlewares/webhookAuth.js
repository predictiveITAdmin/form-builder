const svc = require("../services/forms/queries"); // adjust path if needed

async function webhookAuthMiddleware(req, res, next) {
  try {
    const jobId = req.header("X-Job-Id");
    const callbackToken = req.header("X-Callback-Token");

    if (!jobId || !callbackToken) {
      return res.status(401).json({
        success: false,
        message: "Missing webhook auth headers (X-Job-Id, X-Callback-Token)",
      });
    }

    const job = await svc.getOptionsJob(jobId);
    if (!job) {
      return res.status(401).json({ success: false, message: "Unknown job" });
    }

    if (job.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: `Job not pending (status=${job.status})`,
      });
    }

    if (job.callback_token !== callbackToken) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid callback token" });
    }

    req.webhook = { jobId, job };
    return next();
  } catch (e) {
    console.error("webhookAuthMiddleware error:", e);
    return res
      .status(500)
      .json({ success: false, message: "Webhook authentication failed" });
  }
}

module.exports = { webhookAuthMiddleware };
