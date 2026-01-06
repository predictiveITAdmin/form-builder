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

const buildHTML = (inviteLink) => {
  return `
    <html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You're Invited!</title>
</head>
<body style="margin: 0; padding: 0; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
<img src="https://www.predictiveit.com/wp-content/uploads/2025/09/cropped-predictive_Logo_NoBackground.png" alt="Predictive IT" style="max-width: 300px; height: auto; margin: auto; display: block;">
    <div style="max-width: 600px; margin: 10px auto; background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); overflow: hidden;">
        <!-- Header -->
        <div style="background: #ffffff; padding: 10px 10px; text-align: center;">
            <h1 style="margin: 0; color: #1a202c; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">You're Invited!</h1>
        </div>
        
        <!-- Content -->
        <div style="padding: 10px 10px;">
            <h2 style="margin: 0 0 20px 0; text-align: center; color: #1a202c; font-size: 24px; font-weight: 600; line-height: 1.3;">
                Join Predictive IT Automations Portal
            </h2>
            <p style="margin: 0 0 30px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                We're excited to have you on board! Click the button below to accept your invitation.
            </p>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 40px 0;">
                <a href="${inviteLink}" style="display: inline-block; background: #94ca5c; color: white; text-decoration: none; padding: 16px 48px; border-radius: 50px; font-size: 16px; font-weight: 600; box-shadow: 0 10px 25px rgba(148, 202, 92, 0.4); transition: transform 0.2s, box-shadow 0.2s;">
                    Join Now →
                </a>
            </div>
            
            <!-- Divider -->
            <div style="margin: 40px 0; border-top: 1px solid #e2e8f0;"></div>
            
            <!-- Alternative Link -->
            <div style="background: #f7fafc; border-radius: 8px; padding: 20px; border-left: 4px solid #2596be;">
                <p style="margin: 0 0 10px 0; color: #4a5568; font-size: 14px; font-weight: 600;">
                    Button not working?
                </p>
                <p style="margin: 0 0 8px 0; color: #718096; font-size: 13px;">
                    Copy and paste this link into your browser:
                </p>
                <p style="margin: 0; color: #2596be; font-size: 13px; word-break: break-all; font-family: 'Courier New', monospace;">
                    ${inviteLink}
                </p>
            </div>
        </div>
        
        <!-- Footer -->
        <div style="background: #f7fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; color: #a0aec0; font-size: 13px;">
                © 2026 Predictive IT Automations Portal. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>
  `;
};

const sendInviteEmail = async (toEmail, inviteLink) => {
  const html = buildHTML(inviteLink);

  const message = {
    message: {
      subject: "You're Invited!",
      body: {
        contentType: "HTML",
        content: html,
      },
      toRecipients: [{ emailAddress: { address: toEmail } }],
      from: { emailAddress: { address: FROM_EMAIL } },
    },
    saveToSentItems: "true",
  };

  try {
    await graphClient.api(`/users/${FROM_EMAIL}/sendMail`).post(message);
    console.log("Invite sent to:", toEmail);
  } catch (error) {
    console.error("Error sending invite:", error);
  }
};

module.exports = sendInviteEmail;
