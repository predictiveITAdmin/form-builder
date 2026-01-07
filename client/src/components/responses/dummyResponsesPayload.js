export const dummyResponsesPayload = {
  responses: [
    {
      response_id: 43,
      form_id: 7,
      form_title: "DB Audit Intake",
      user_id: 101,
      submitted_at: "2025-12-24T15:48:39.404Z",
      client_ip: "10.10.2.14",
      user_agent: "Mozilla/5.0",
      meta_json: { source: "web" },
    },
    {
      response_id: 44,
      form_id: 7,
      form_title: "DB Audit Intake",
      user_id: 102,
      submitted_at: "2025-12-26T09:11:10.120Z",
      client_ip: "10.10.2.77",
      user_agent: "Mozilla/5.0",
      meta_json: { source: "web" },
    },
  ],

  formFieldsById: {
    86: {
      field_id: 86,
      label: "Upload CSV Evidence",
      key_name: "evidence_files",
      field_type: "file_upload",
    },
    87: {
      field_id: 87,
      label: "Database Name",
      key_name: "db_name",
      field_type: "text",
    },
    88: {
      field_id: 88,
      label: "Row Count",
      key_name: "row_count",
      field_type: "number",
    },
    89: {
      field_id: 89,
      label: "Approved",
      key_name: "approved",
      field_type: "boolean",
    },
    90: {
      field_id: 90,
      label: "Audit Date",
      key_name: "audit_date",
      field_type: "date",
    },
  },

  responseValuesByResponseId: {
    43: [
      {
        response_value_id: 552,
        response_id: 43,
        form_field_id: 86,
        value_text:
          '{"files":[{"file_id":"13e6ab0f-aed6-4654-91bc-fbe2ab5a37e7","original_name":"Indexes.csv","mime_type":"text/csv","size_bytes":18563},{"file_id":"38a9a54c-f623-4c48-9516-3727579d74a8","original_name":"Foreign Keys.csv","mime_type":"text/csv","size_bytes":2783},{"file_id":"57544f7f-d987-40fb-81e2-e59574448e4a","original_name":"Constraints.csv","mime_type":"text/csv","size_bytes":4675}]}',
        value_number: null,
        value_date: null,
        value_datetime: null,
        value_bool: null,
        created_at: "2025-12-24T15:48:39.404Z",
      },
      {
        response_value_id: 553,
        response_id: 43,
        form_field_id: 87,
        value_text: "prod-db-01",
        created_at: "2025-12-24T15:48:39.404Z",
      },
      {
        response_value_id: 554,
        response_id: 43,
        form_field_id: 88,
        value_number: 194233,
        created_at: "2025-12-24T15:48:39.404Z",
      },
      {
        response_value_id: 555,
        response_id: 43,
        form_field_id: 89,
        value_bool: true,
        created_at: "2025-12-24T15:48:39.404Z",
      },
      {
        response_value_id: 556,
        response_id: 43,
        form_field_id: 90,
        value_date: "2025-12-24",
        created_at: "2025-12-24T15:48:39.404Z",
      },
    ],

    44: [
      {
        response_value_id: 560,
        response_id: 44,
        form_field_id: 87,
        value_text: "staging-db-02",
        created_at: "2025-12-26T09:11:10.120Z",
      },
      {
        response_value_id: 561,
        response_id: 44,
        form_field_id: 88,
        value_number: 1200,
        created_at: "2025-12-26T09:11:10.120Z",
      },
      {
        response_value_id: 562,
        response_id: 44,
        form_field_id: 89,
        value_bool: false,
        created_at: "2025-12-26T09:11:10.120Z",
      },
    ],
  },

  // This is what you'd get by joining file_id -> file_uploads -> blob URL
  filesById: {
    "13e6ab0f-aed6-4654-91bc-fbe2ab5a37e7": {
      file_id: "13e6ab0f-aed6-4654-91bc-fbe2ab5a37e7",
      original_name: "Indexes.csv",
      mime_type: "text/csv",
      size_bytes: 18563,
      blob_url:
        "https://example.blob.core.windows.net/forms/13e6ab0f-aed6-4654-91bc-fbe2ab5a37e7",
    },
    "38a9a54c-f623-4c48-9516-3727579d74a8": {
      file_id: "38a9a54c-f623-4c48-9516-3727579d74a8",
      original_name: "Foreign Keys.csv",
      mime_type: "text/csv",
      size_bytes: 2783,
      blob_url:
        "https://example.blob.core.windows.net/forms/38a9a54c-f623-4c48-9516-3727579d74a8",
    },
    "57544f7f-d987-40fb-81e2-e59574448e4a": {
      file_id: "57544f7f-d987-40fb-81e2-e59574448e4a",
      original_name: "Constraints.csv",
      mime_type: "text/csv",
      size_bytes: 4675,
      blob_url:
        "https://example.blob.core.windows.net/forms/57544f7f-d987-40fb-81e2-e59574448e4a",
    },
  },
};
