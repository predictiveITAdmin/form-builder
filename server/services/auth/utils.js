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
    <html>
      <body style="font-family: Arial, sans-serif;">
        <h2>You're Invited to join Predictive IT Automations Portal!</h2>
        <p>Click below to join:</p>
        <a href="${inviteLink}">
          Join Now
        </a>
        <p>Copy and paste the link if the button does not work.
        <span>${inviteLink}</span></p>
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
