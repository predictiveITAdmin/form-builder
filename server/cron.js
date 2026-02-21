const cron = require("node-cron");
const { query } = require("./db/pool");
const { sendCustomEmail } = require("./services/auth/utils");
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

/**
 * Cleanup old records based on the configured retention period.
 * Targets: audit_logs, formsessions, responses.
 */
async function cleanupOldData() {
  console.log("[cron] Starting old data cleanup job...");
  try {
    // Read the log_retention_days setting
    const settingsRes = await query(`
      SELECT value 
      FROM public.settings 
      WHERE property = 'log_retention_days'
    `);
    
    // Default to 180 days if not set or invalid
    let retentionDays = 180; 
    if (settingsRes.length > 0) {
      const parsed = parseInt(settingsRes[0].value, 10);
      if (!isNaN(parsed) && parsed > 0) {
        retentionDays = parsed;
      }
    }

    console.log(`[cron] Log retention configured for ${retentionDays} days.`);

    // 1. Delete Audit Logs
    await query(
      `DELETE FROM public.audit_logs WHERE timestamp < NOW() - INTERVAL '${retentionDays} days'`
    );
    console.log(`[cron] Successfully removed old audit logs.`);

    // 2. Delete Form Sessions
    await query(
      `DELETE FROM public.formsessions WHERE updated_at < NOW() - INTERVAL '${retentionDays} days' AND expires_at < NOW()`
    );
    console.log(`[cron] Successfully removed old form sessions.`);

    // 3. Delete Responses
    await query(
      `DELETE FROM public.responses WHERE submitted_at < NOW() - INTERVAL '${retentionDays} days'`
    );
    console.log(`[cron] Successfully removed old responses.`);

    // 4. Delete File Uploads (soft-deleted > 90 days ago)
    await query(
      `DELETE FROM public.file_uploads WHERE status = 'deleted' AND deleted_at < NOW() - INTERVAL '90 days'`
    );
    console.log(`[cron] Successfully removed old deleted file records.`);

  } catch (err) {
    console.error("[cron] Error cleaning up old data:", err);
  }
}

/**
 * Dispatch email reminders for formsessions that are about to expire.
 */
async function sendSessionReminders() {
  console.log("[cron] Starting Session Reminders job...");
  try {
    // Find sessions expiring in the next 3 days that haven't been reminded yet
    const expiringSessions = await query(`
      SELECT fs.session_token, fs.expires_at, fs.form_id, u.email, u.display_name, f.title as form_title
      FROM public.formsessions fs
      JOIN public.users u ON fs.user_id = u.user_id
      JOIN public.forms f ON fs.form_id = f.form_id
      WHERE fs.is_active = true 
        AND fs.is_completed = false
        AND fs.reminder_sent_at IS NULL
        AND fs.expires_at > NOW() 
        AND fs.expires_at <= NOW() + INTERVAL '3 days'
    `);

    if (expiringSessions.length === 0) {
      console.log("[cron] No expiring sessions need reminders today.");
      return;
    }

    console.log(`[cron] Found ${expiringSessions.length} sessions requiring reminders.`);

    for (const session of expiringSessions) {
      try {
        const link = `${FRONTEND_URL}/f/${session.session_token}`;
        const subject = `Action Required: Your session for "${session.form_title}" is expiring soon`;
        const htmlBody = `
          <p>Hi ${session.display_name || 'there'},</p>
          <p>Your session for the form <b>"${session.form_title}"</b> is set to expire on ${new Date(session.expires_at).toLocaleDateString()}.</p>
          <p>Please click the link below to resume and complete your submission:</p>
          <p><a href="${link}" style="display:inline-block;background:#2596be;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Resume Session</a></p>
          <p>Thank you!</p>
        `;

        // Send Email via Graph API
        await sendCustomEmail(session.email, subject, htmlBody);

        // Mark as reminded so we don't spam them tomorrow if they don't complete it
        await query(
          `UPDATE public.formsessions SET reminder_sent_at = NOW() WHERE session_token = $1`,
          [session.session_token]
        );

        console.log(`[cron] Sent reminder to ${session.email} for session ${session.session_token}`);
      } catch (err) {
        console.error(`[cron] Failed to send reminder to ${session.email}:`, err.message);
      }
    }
  } catch (err) {
    console.error("[cron] Error dispatching session reminders:", err);
  }
}

/**
 * Initializes all system CRON jobs.
 */
function initCronJobs() {
  console.log("[cron] Registering Scheduled Tasks...");

  // Run at 2:00 AM every day
  cron.schedule("0 2 * * *", () => {
    cleanupOldData();
  });

  // Run at 9:00 AM every day
  cron.schedule("0 9 * * *", () => {
    sendSessionReminders();
  });
}

module.exports = {
  initCronJobs,
  cleanupOldData,
  sendSessionReminders // Exported for manual testing if needed
};
