require("dotenv").config();
const { Client } = require("@microsoft/microsoft-graph-client");
const { ClientSecretCredential } = require("@azure/identity");

const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const TENANT_ID = process.env.AZURE_TENANT_ID;

async function testGraphSearch() {
  const credential = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
  
  const graphClient = Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const token = await credential.getToken("https://graph.microsoft.com/.default");
        return token.token;
      },
    },
  });

  try {
    const search = "predictive"; // hardcoded search
    console.log(`Searching for: ${search}`);

    let queryObj = graphClient.api('/users')
        .select('displayName,mail,userPrincipalName')
        .top(10);

    queryObj = queryObj.header('ConsistencyLevel', 'eventual')
                       .query({ $search: `"displayName:${search}" OR "mail:${search}" OR "userPrincipalName:${search}"` });
    
    const response = await queryObj.get();
    
    console.log("Success! Users fetched:", response.value.length);
    console.log(response.value);
  } catch (error) {
    console.error("Graph API Error:", error.message);
    if (error.body) {
        console.error("Details:", error.body);
    }
  }
}

testGraphSearch();
