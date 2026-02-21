// services/fileService.js
const crypto = require("crypto");
const {
  blobServiceClient,
  containerName,
} = require("../integrations/blobClient");
const { query } = require("../../db/pool");

/**
 * Overwrite strategy (default):
 * For a given (session_token, form_field_id, uploaded_by), delete ALL active files,
 * then upload the new set.
 *
 * This prevents duplicate blobs when the user uploads repeatedly before saving draft.
 */
async function uploadFilesToBlob(
  files,
  { uploadedBy, formFieldId, sessionToken, formKey }
) {
  if (!uploadedBy) throw new Error("uploadedBy is required");
  if (!formFieldId) throw new Error("formFieldId is required");
  if (!sessionToken) throw new Error("sessionToken is required");

  const container = blobServiceClient.getContainerClient(containerName);
  await container.createIfNotExists(); // private by default

  const uploaded_by = Number(uploadedBy);
  // 1) Find existing active uploads for this field + session + user
  const existingRes = await query(
    `
    SELECT file_id, container, blob_name
    FROM public.file_uploads
    WHERE form_field_id = $1
      AND session_token = $2
      AND uploaded_by = $3
      AND status = 'active'
    `,
    [formFieldId, sessionToken, uploaded_by]
  );



  // 2) Delete blobs + mark DB rows deleted (best-effort)
  for (const old of existingRes) {
    try {
      const oldContainer = blobServiceClient.getContainerClient(old.container);
      const oldBlob = oldContainer.getBlockBlobClient(old.blob_name);
      await oldBlob.deleteIfExists();

      await query(
        `
        UPDATE public.file_uploads
        SET status = 'deleted', deleted_at = NOW()
        WHERE file_id = $1
        `,
        [old.file_id]
      );
    } catch (e) {
      // Don’t fail whole upload if cleanup fails. Log and continue.
      console.error("Failed to delete old blob:", old.file_id, e?.message || e);
    }
  }

  // 3) Upload new files
  const uploaded = [];

  for (const file of files) {
    const fileId = crypto.randomUUID();
    const safeName = String(file.originalname || "file").replace(
      /[^\w.\-() ]+/g,
      "_"
    );

    // put them under formKey/fieldId/sessionToken for sanity in portal
    const blobName = `forms/${formKey}/fields/${formFieldId}/sessions/${sessionToken}/${fileId}-${safeName}`;

    const blob = container.getBlockBlobClient(blobName);

    const result = await blob.uploadData(file.buffer, {
      blobHTTPHeaders: { blobContentType: file.mimetype },
    });

    await query(
      `
      INSERT INTO public.file_uploads
        (file_id, container, blob_name, original_name, mime_type, size_bytes, etag, uploaded_by, form_field_id, session_token, status)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active')
      `,
      [
        fileId,
        containerName,
        blobName,
        file.originalname,
        file.mimetype,
        file.size,
        result.etag,
        uploadedBy,
        formFieldId,
        sessionToken,
      ]
    );

    uploaded.push({
      file_id: fileId,
      original_name: file.originalname,
      mime_type: file.mimetype,
      size_bytes: file.size,
    });
  }

  return uploaded;
}

module.exports = { uploadFilesToBlob };
