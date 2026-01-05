const { BlobServiceClient } = require("@azure/storage-blob");

const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
if (!connStr) {
  throw new Error("AZURE_STORAGE_CONNECTION_STRING is missing");
}

const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);

const containerName = process.env.AZURE_STORAGE_CONTAINER;
if (!containerName) {
  throw new Error("AZURE_STORAGE_CONTAINER is missing");
}

module.exports = {
  blobServiceClient,
  containerName,
};
