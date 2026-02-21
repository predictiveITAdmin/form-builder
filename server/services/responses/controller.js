const queries = require("./queries");
const { query } = require("../../db/pool");
const { generateSasUrl } = require("../integrations/blobClient");
const { sendCustomEmail } = require("../auth/utils");

module.exports = {
  listResponses: async (req, res) => {
    try {
      const result = await queries.getResponses();

      return res.status(200).json(result);
    } catch (err) {
      res.status(500).json(err);
    }
  },

  getResponseGraph: async (req, res) => {
    const response_id = req.params.responseId;

    try {
      const result = await queries.getResponseById(response_id);
      const row = result[0];

      if (!row) return res.status(404).json({ message: "Not found" });

      // Build out filesById using the session token to pull from file_uploads
      let filesById = {};
      if (row.session_token) {
        const fileRes = await query(
          `SELECT file_id, blob_name, original_name, mime_type, size_bytes 
           FROM public.file_uploads 
           WHERE session_token = $1 AND status = 'active'`,
          [row.session_token]
        );

        for (const file of fileRes) {
          filesById[file.file_id] = {
            ...file,
            blob_url: generateSasUrl(file.blob_name, 1),
          };
        }
      }

      row.filesById = filesById;
      return res.status(200).json(row);
    } catch (err) {
      console.error(err);
      res.status(500).json(err);
    }
  },

  deleteResponse: async (req, res) => {
    const response_id = req.params.responseId;

    try {
      const result = await queries.removeResponse(response_id);
      
      if (result.length === 0) {
        return res.status(404).json({ message: "Response not found" });
      }

      return res.status(200).json({ message: "Response deleted successfully" });
    } catch (err) {
      res.status(500).json(err);
    }
  },

  sendResponseEmail: async (req, res) => {
    const response_id = req.params.responseId;
    const { subject, salutation, message, regards } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: "Subject and message are required" });
    }

    try {
      // Find the email of the person who submitted this response
      const result = await query(
        `SELECT u.email 
         FROM public.responses r
         JOIN public.users u ON r.user_id = u.user_id
         WHERE r.response_id = $1`,
        [response_id]
      );

      if (result.length === 0 || !result[0].email) {
        return res.status(404).json({ error: "Submitter email not found" });
      }

      const toEmail = result[0].email;
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          ${salutation ? `<p>${salutation}</p>` : ""}
          <div>${message}</div>
          ${regards ? `<p>${regards.replace(/\n/g, "<br>")}</p>` : ""}
        </div>
      `;

      await sendCustomEmail(toEmail, subject, htmlBody);

      return res.status(200).json({ message: "Email sent successfully" });
    } catch (err) {
      console.error("[Responses] Error sending custom email:", err);
      res.status(500).json({ error: "Failed to send email" });
    }
  },
};
