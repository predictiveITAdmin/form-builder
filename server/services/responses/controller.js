const queries = require("./queries");
const { query } = require("../../db/pool");
const { generateSasUrl } = require("../integrations/blobClient");
const { sendCustomEmail } = require("../auth/utils");
const { decrypt } = require("../../utils/encryption");

module.exports = {
  listResponses: async (req, res) => {
    /*
      #swagger.tags = ['Responses']
      #swagger.summary = 'List all submissions/responses'
      #swagger.responses[200] = {
        description: 'Successfully fetched responses',
        schema: [{
          response_id: 1,
          status: 'Submitted',
          form_id: 10,
          title: 'IT Hardware Request',
          description: 'Request for a new laptop',
          rpa_webhook_url: 'https://...',
          display_name: 'John Doe',
          email: 'johndoe@example.com',
          submitted_at: '2026-02-23T12:00:00Z',
          client_ip: '192.168.1.1',
          user_agent: 'Mozilla/5.0...',
          meta_json: {},
          session_id: 5
        }]
      }
    */
    try {
      const result = await queries.getResponses();

      return res.status(200).json(result);
    } catch (err) {
      res.status(500).json(err);
    }
  },

  getResponseGraph: async (req, res) => {
    /*
      #swagger.tags = ['Responses']
      #swagger.summary = 'Get a specific response by ID including attached files'
      #swagger.responses[200] = {
        description: 'Successfully fetched single response details',
        schema: {
          response_id: 1,
          status: 'Pending',
          form_id: 10,
          form_key: 'it-hardware',
          title: 'IT Hardware Request',
          description: 'Request for new gear',
          form_status: 'Published',
          user_id: 3,
          display_name: 'John Doe',
          email: 'johndoe@example.com',
          user_type: 'internal',
          submitted_at: null,
          response_client_ip: '127.0.0.1',
          response_user_agent: 'Mozilla',
          session_id: 5,
          session_started_at: '2026-02-23T10:00:00Z',
          completed_at: null,
          current_step: 2,
          total_steps: 3,
          is_active: true,
          response_values: {
            "department": { label: "Department", value_text: "Sales" }
          },
          filesById: {
            "file-uuid": {
              file_id: "file-uuid",
              blob_name: "doc.pdf",
              original_name: "doc.pdf",
              mime_type: "application/pdf",
              size_bytes: 1024,
              blob_url: "https://..."
            }
          }
        }
      }
    */
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
    /*
      #swagger.tags = ['Responses']
      #swagger.summary = 'Delete a response'
      #swagger.responses[200] = {
        description: 'Successfully deleted response',
        schema: { message: "Response deleted successfully" }
      }
      #swagger.responses[404] = { description: 'Response not found' }
    */
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
    /*
      #swagger.tags = ['Responses']
      #swagger.summary = 'Send a custom email directly to the submitter of a response'
      #swagger.parameters['body'] = {
        in: 'body',
        description: 'Email details',
        schema: {
          to: 'submitter@example.com',
          from: 'support@example.com',
          subject: 'Your request update',
          salutation: 'Hello John,',
          message: 'Your laptop is ready.',
          regards: 'Best,\\nIT Team',
          cc: ['manager@example.com']
        }
      }
      #swagger.responses[200] = {
        description: 'Email sent successfully',
        schema: { message: "Email sent successfully" }
      }
    */
    const response_id = req.params.responseId;
    const { subject, salutation, message, regards, cc, to, from } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: "Subject and message are required" });
    }

    try {
      let toEmail = to;

      if (!toEmail) {
        // Fallback: Find the email of the person who submitted this response
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
        
        toEmail = result[0].email;
      }
      
      const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const responseLink = `${baseUrl}/responses/${response_id}`;

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          ${salutation ? `<p>${salutation}</p>` : ""}
          <div>${message}</div>
          ${regards ? `<p>${regards.replace(/\n/g, "<br>")}</p>` : ""}
          <br />
          <p>
            You can view your response directly <a href="${responseLink}">here</a>.
          </p>
        </div>
      `;

      await sendCustomEmail(toEmail, subject, htmlBody, cc, from);

      return res.status(200).json({ message: "Email sent successfully" });
    } catch (err) {
      console.error("[Responses] Error sending custom email:", err);
      res.status(500).json({ error: "Failed to send email" });
    }
  },

  decryptResponseField: async (req, res) => {
    /*
      #swagger.tags = ['Responses']
      #swagger.summary = 'Decrypt a specific password field for a response'
      #swagger.parameters['body'] = {
        in: 'body',
        schema: { field_id: 123 }
      }
    */
    const response_id = req.params.responseId;
    const { field_id } = req.body;

    if (!field_id) {
      return res.status(400).json({ error: "field_id is required" });
    }

    try {
      const result = await query(
        `SELECT rv.value_text, ff.field_type
         FROM public.responsevalues rv
         JOIN public.formfields ff ON ff.field_id = rv.form_field_id
         WHERE rv.response_id = $1 AND rv.form_field_id = $2`,
        [response_id, field_id]
      );

      if (result.length === 0) {
        return res.status(404).json({ error: "Value not found" });
      }

      const { value_text, field_type } = result[0];

      if (field_type !== "password") {
        return res.status(400).json({ error: "Field is not a password type" });
      }

      if (!value_text) {
        return res.status(200).json({ decryptedValue: "" });
      }

      const decrypted = decrypt(value_text);
      if (decrypted === null) {
        return res.status(500).json({ error: "Decryption failed. Invalid hash or missing master key." });
      }

      return res.status(200).json({ decryptedValue: decrypted });
    } catch (err) {
      console.error("[Responses] Error decrypting field:", err);
      res.status(500).json({ error: "Failed to decrypt field" });
    }
  },
};
