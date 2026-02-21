const { Client } = require("@microsoft/microsoft-graph-client");
const { ClientSecretCredential } = require("@azure/identity");
const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const TENANT_ID = process.env.AZURE_TENANT_ID;
const FROM_EMAIL = "predictiveITConsultationScheduling@predictiveit.com";

const credential = new ClientSecretCredential(
  TENANT_ID,
  CLIENT_ID,
  CLIENT_SECRET
);

const graphClient = Client.initWithMiddleware({
  authProvider: {
    getAccessToken: async () => {
      const token = await credential.getToken(
        "https://graph.microsoft.com/.default"
      );
      return token.token;
    },
  },
});

// utils.js

const buildHTML = (link, mode = "invite") => {
  const isReset = mode === "reset";

  const title = isReset ? "Reset your password" : "You're Invited!";
  const heading = isReset
    ? "Reset Predictive IT Automations Portal Password"
    : "Join Predictive IT Automations Portal";
  const buttonText = isReset ? "Reset Password →" : "Join Now →";
  const subject = isReset ? "Password Reset Request" : "You're Invited!";

  return {
    subject,
    html: `
      <html lang="en">
      <head>...</head>
      <body style="margin:0;padding:0;background:#ffffff;font-family:Segoe UI, Arial,sans-serif;">
        <img src="https://www.predictiveit.com/wp-content/uploads/2025/09/cropped-predictive_Logo_NoBackground.png"
             alt="Predictive IT" style="max-width:300px;height:auto;margin:auto;display:block;">
        <div style="max-width:600px;margin:10px auto;background:white;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.3);overflow:hidden;">
          <div style="background:#ffffff;padding:10px;text-align:center;">
            <h1 style="margin:0;color:#1a202c;font-size:28px;font-weight:700;">${title}</h1>
          </div>

          <div style="padding:10px;">
            <h2 style="margin:0 0 20px 0;text-align:center;color:#1a202c;font-size:24px;font-weight:600;">
              ${heading}
            </h2>

            <p style="margin:0 0 30px 0;color:#4a5568;font-size:16px;line-height:1.6;">
              ${
                isReset
                  ? "We received a request to reset your password. If you didn’t request this, you can ignore this email."
                  : "We're excited to have you on board! Click the button below to accept your invitation."
              }
            </p>

            <div style="text-align:center;margin:40px 0;">
              <a href="${link}" style="display:inline-block;background:#94ca5c;color:white;text-decoration:none;padding:16px 48px;border-radius:50px;font-size:16px;font-weight:600;">
                ${buttonText}
              </a>
            </div>

            <div style="margin:40px 0;border-top:1px solid #e2e8f0;"></div>

            <div style="background:#f7fafc;border-radius:8px;padding:20px;border-left:4px solid #2596be;">
              <p style="margin:0 0 10px 0;color:#4a5568;font-size:14px;font-weight:600;">Button not working?</p>
              <p style="margin:0 0 8px 0;color:#718096;font-size:13px;">Copy and paste this link into your browser:</p>
              <p style="margin:0;color:#2596be;font-size:13px;word-break:break-all;font-family:'Courier New', monospace;">${link}</p>
            </div>
          </div>

          <div style="background:#f7fafc;padding:30px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#a0aec0;font-size:13px;">© 2026 Predictive IT Automations Portal. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
};

const sendPortalEmail = async (toEmail, link, mode = "invite") => {
  const { subject, html } = buildHTML(link, mode);

  const message = {
    message: {
      subject,
      body: { contentType: "HTML", content: html },
      toRecipients: [{ emailAddress: { address: toEmail } }],
      from: { emailAddress: { address: FROM_EMAIL } },
    },
    saveToSentItems: "true",
  };

  await graphClient.api(`/users/${FROM_EMAIL}/sendMail`).post(message);
};

const sendCustomEmail = async (toEmail, subject, htmlBody) => {
  const message = {
    message: {
      subject,
      body: { contentType: "HTML", content: htmlBody },
      toRecipients: [{ emailAddress: { address: toEmail } }],
      from: { emailAddress: { address: FROM_EMAIL } },
    },
    saveToSentItems: "true",
  };

  await graphClient.api(`/users/${FROM_EMAIL}/sendMail`).post(message);
};

module.exports = { sendPortalEmail, sendCustomEmail };
