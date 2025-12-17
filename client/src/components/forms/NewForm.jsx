import React from "react";
import { useState } from "react";

const NewForm = () => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "Draft",
    is_anonymous: false,
    rpa_webhook_url: "",
    rpa_secret: "",
    rpa_timeout_ms: 8000,
    rpa_retry_count: 3,
    form_key: "",
  });
  const [fields, setFields] = useState([]);
  const [currentField, setCurrentField] = useState({
    key_name: "",
    label: "",
    help_text: "",
    field_type: "text",
    required: false,
    sort_order: 0,
    config_json: "{}",
    active: true,
  });

  const fieldTypes = [
    "text",
    "textarea",
    "email",
    "number",
    "date",
    "select",
    "checkbox",
    "radio",
    "file",
    "url",
    "tel",
  ];

  const addField = () => {
    if (currentField.key_name && currentField.label) {
      setFields([...fields, { ...currentField, id: Date.now() }]);
      setCurrentField({
        key_name: "",
        label: "",
        help_text: "",
        field_type: "text",
        required: false,
        sort_order: fields.length + 1,
        config_json: "{}",
        active: true,
      });
    }
  };

  const removeField = (id) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  const handleSubmit = () => {
    console.log("Form Data:", formData);
    console.log("Fields:", fields);
    // Here you would send data to your backend
    alert("Form created successfully!");
  };
  return <div>NewForm</div>;
};

export default NewForm;
