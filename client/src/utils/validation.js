const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const urlRegex =
  /^(https?:\/\/)([\w-]+\.)+[\w-]+(\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?$/i;
const telRegex = /^[+]?[\d\s().-]{7,}$/;

const isEmptyVal = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof File !== "undefined" && v instanceof File) return false;
  if (typeof FileList !== "undefined" && v instanceof FileList)
    return v.length === 0;
  return false;
};

// Chakra Select: value is ALWAYS an array
const getSingleFromArray = (v) => (Array.isArray(v) ? v[0] : v);

export const validateFieldValue = (field, rawValue) => {
  const type = field.field_type;
  const value = rawValue;

  // REQUIRED rules (array-aware for select/radio)
  if (field.required) {
    switch (type) {
      case "checkbox":
        if (value !== true)
          return { valid: false, error: `${field.label} is required.` };
        break;

      case "radio":
        if (isEmptyVal(value))
          return { valid: false, error: `${field.label} is required.` };
        break;

      case "select":
      case "multiselect": {
        console.log(field, value);
        // Chakra Select: [] or ["x"]
        if (!Array.isArray(value) || value.length === 0)
          return { valid: false, error: `${field.label} is required.` };
        break;
      }

      case "file":
        if (isEmptyVal(value))
          return { valid: false, error: `${field.label} is required.` };
        break;

      default:
        if (isEmptyVal(value))
          return { valid: false, error: `${field.label} is required.` };
    }
  } else {
    // OPTIONAL + empty => valid, skip type checks
    // For select/radio: empty means [].
    if (type === "select" || type === "radio" || type === "multiselect") {
      if (!Array.isArray(value) || value.length === 0) return { valid: true };
    } else if (type !== "checkbox" && isEmptyVal(value)) {
      return { valid: true };
    }
  }

  // Type checks for provided values
  switch (type) {
    case "email": {
      const v = String(value || "").trim();
      if (!emailRegex.test(v))
        return { valid: false, error: "Enter a valid email address." };
      return { valid: true };
    }

    case "url": {
      const v = String(value || "").trim();
      if (!urlRegex.test(v))
        return {
          valid: false,
          error: "Enter a valid URL (must start with http/https).",
        };
      return { valid: true };
    }

    case "tel": {
      const v = String(value || "").trim();
      if (!telRegex.test(v))
        return { valid: false, error: "Enter a valid phone number." };
      return { valid: true };
    }

    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(n))
        return { valid: false, error: "Enter a valid number." };
      if (field.min != null && n < field.min)
        return { valid: false, error: `Must be ≥ ${field.min}.` };
      if (field.max != null && n > field.max)
        return { valid: false, error: `Must be ≤ ${field.max}.` };
      return { valid: true };
    }

    case "date": {
      const d = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(d.getTime()))
        return { valid: false, error: "Enter a valid date." };
      return { valid: true };
    }

    case "radio": {
      if (field.required && isEmptyVal(value))
        return { valid: false, error: `${field.label} is required.` };
      return { valid: true };
    }

    case "select": {
      // array of 1 selection
      if (!Array.isArray(value))
        return { valid: false, error: "Invalid selection." };
      const selected = getSingleFromArray(value);
      if (field.required && isEmptyVal(selected))
        return { valid: false, error: `${field.label} is required.` };
      return { valid: true };
    }

    case "multiselect": {
      if (!Array.isArray(value))
        return { valid: false, error: "Invalid selection." };
      // required already checked
      return { valid: true };
    }

    case "checkbox": {
      if (value !== undefined && typeof value !== "boolean")
        return { valid: false, error: "Invalid checkbox value." };
      return { valid: true };
    }

    case "text":
    case "textarea":
    default:
      return { valid: true };
  }
};

export const validateWholeForm = (formData, formValues) => {
  if (!formData?.steps?.length) return { isValid: false, errors: {} };

  const errors = {};
  const fields = formData.steps
    .flatMap((s) => s.fields || [])
    .filter((f) => f.active);

  for (const field of fields) {
    const value = formValues[field.key_name];
    const res = validateFieldValue(field, value);
    if (!res.valid) errors[field.key_name] = res.error || "Invalid value.";
  }

  return { isValid: Object.keys(errors).length === 0, errors };
};
