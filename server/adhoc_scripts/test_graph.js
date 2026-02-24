require("dotenv").config();
const { Client } = require("@microsoft/microsoft-graph-client");
const { ClientSecretCredential } = require("@azure/identity");

const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const TENANT_ID = process.env.AZURE_TENANT_ID;

async function testGraph() {
  const credential = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
  
  const graphClient = Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        // This requests a token using the fresh credential object
        const token = await credential.getToken("https://graph.microsoft.com/.default");
        console.log("Token acquired.");
        return token.token;
      },
    },
  });

  try {
    const response = await graphClient.api('/users')
      .select('displayName,mail,userPrincipalName')
      .top(10)
      .get();
    
    console.log("Success! Users fetched:", response.value.length);
  } catch (error) {
    console.error("Graph API Error:", error.message);
    if (error.body) {
        console.error("Details:", error.body);
    }
  }
}

testGraph();
