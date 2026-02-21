const {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential
} = require("@azure/storage-blob");

const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
if (!connStr) {
  throw new Error("AZURE_STORAGE_CONNECTION_STRING is missing");
}

const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);

const containerName = process.env.AZURE_STORAGE_CONTAINER;
if (!containerName) {
  throw new Error("AZURE_STORAGE_CONTAINER is missing");
}


// Assuming connection string format: DefaultEndpointsProtocol=https;AccountName=xxx;AccountKey=yyy;EndpointSuffix=core.windows.net
const accountName = connStr.match(/AccountName=([^;]+)/)?.[1];
const accountKey = connStr.match(/AccountKey=([^;]+)/)?.[1];
let sharedKeyCredential = null;
if (accountName && accountKey) {
  sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
}

function generateSasUrl(blobName, expiresInHours = 1) {
  if (!sharedKeyCredential) {
    throw new Error("SharedKeyCredential not available for generating SAS tokens.");
  }
  
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobName);

  const sasOptions = {
    containerName,
    blobName,
    permissions: BlobSASPermissions.parse("r"),
    startsOn: new Date(),
    expiresOn: new Date(new Date().valueOf() + expiresInHours * 60 * 60 * 1000),
  };

  const sasToken = generateBlobSASQueryParameters(
    sasOptions,
    sharedKeyCredential
  ).toString();

  return `${blobClient.url}?${sasToken}`;
}

module.exports = {
  blobServiceClient,
  containerName,
  generateSasUrl,
};
