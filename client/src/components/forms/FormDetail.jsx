import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Heading,
  Text,
  Badge,
  Stack,
  Card,
  Input,
  Textarea,
  Button,
  Field,
  RadioGroup,
  Checkbox,
  VStack,
  HStack,
  Container,
  Select,
  Portal,
  createListCollection,
  FileUpload,
} from "@chakra-ui/react";
import { useNavigate, useParams } from "react-router";
import { FaArrowRotateRight } from "react-icons/fa6";

import { SlRefresh } from "react-icons/sl";
import { useSelector, useDispatch } from "react-redux";
import { notify } from "../ui/notifyStore";
import { HiUpload } from "react-icons/hi";
import {
  getUserSessionData,
  saveDraft,
  selectCurrentForm,
  selectCurrentFormError,
  selectCurrentFormStatus,
  selectDraftSaveError,
  selectDraftSaveStatus,
  selectSessionData,
  selectSessionDataError,
  selectSessionDataStatus,
  uploadFile,
  submitFinal,
  selectFinalSubmitStatus,
  selectFinalSubmitError,
  triggerOptionsProcessing,
  getOptionsJobStatus,
} from "@/features/forms/formsSlice";
import { getForm } from "@/features/forms/formsSlice";
import { selectUser } from "@/features/auth/authSlice";
import { validateWholeForm } from "@/utils/validation";
import AppLoader from "../ui/AppLoader";
import AppError from "../ui/AppError";

const formatBytes = (bytes) => {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
};

const FormDetail = () => {
  const [isComplete, setisComplete] = useState(false);
  const { formKey } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const formData = useSelector(selectCurrentForm);
  const status = useSelector(selectCurrentFormStatus);
  const user = useSelector(selectUser);
  const draftStatus = useSelector(selectDraftSaveStatus);
  const draftError = useSelector(selectDraftSaveError);
  const error = useSelector(selectCurrentFormError);
  const sessionData = useSelector(selectSessionData);
  const sessionStatus = useSelector(selectSessionDataStatus);
  const sessionError = useSelector(selectSessionDataError);
  const [uploading, setUploading] = useState({});
  const [stagedFiles, setStagedFiles] = useState({});

  const finalSubmitStatus = useSelector(selectFinalSubmitStatus);
  const finalSubmitError = useSelector(selectFinalSubmitError);

  const isFieldInvalid = (field) =>
    touchedFields[field.key_name] && fieldErrors[field.key_name];

  const normalizeSessionValues = (sessionData, formData) => {
    if (!sessionData || !formData) return {};

    const normalized = {};

    const allFields = formData.steps
      .flatMap((s) => s.fields)
      .filter((f) => f.active);

    for (const field of allFields) {
      const raw = sessionData[field.key_name];

      if (raw == null) continue;

      switch (field.field_type) {
        case "multiselect":
          try {
            normalized[field.key_name] = Array.isArray(raw)
              ? raw
              : JSON.parse(raw);
          } catch {
            normalized[field.key_name] = [];
          }
          break;

        case "select":
          normalized[field.key_name] = Array.isArray(raw)
            ? raw
            : raw
              ? [raw]
              : [];
          break;

        case "checkbox":
          normalized[field.key_name] = Boolean(raw);
          break;

        case "date":
          normalized[field.key_name] = raw; // YYYY-MM-DD is fine
          break;

        default:
          normalized[field.key_name] = raw;
      }
    }

    return normalized;
  };

  useEffect(() => {
    if (formKey) {
      dispatch(getForm({ formKey }));
    }
  }, [formKey, dispatch]);

  useEffect(() => {
    const sessionToken = formData?.session?.session_token;
    if (sessionToken) {
      dispatch(getUserSessionData({ formKey, sessionToken: sessionToken }));
      const createdAt = formData.session.created_at;
      const now = Date.now();
      const oneMin = 60 * 1000;

      const t = new Date(createdAt).getTime();

      const inWindow = t >= now - oneMin && t <= now + oneMin;
      if (inWindow) {
        notify({
          type: "success",
          title: "New Session has been created",
          message:
            "We created a session for you. You can save as draft and come back to it later.",
        });
      } else {
        notify({
          type: "info",
          title: "Continue where you left.",
          message: "You already have a saved session.",
        });
      }
    }
  }, [formData, dispatch]);

  useEffect(() => {
    if (formKey && sessionData) {
      const normalized = normalizeSessionValues(sessionData, formData);
      setFormValues(normalized);
    }
  }, [formKey, sessionData, formData]);

  const [currentStep, setCurrentStep] = useState(0);
  const [formValues, setFormValues] = useState({});
  const [isRotating, setIsRotating] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});
  const [fieldLoader, setFieldLoader] = useState({});

  const validationResult = useMemo(() => {
    return validateWholeForm(formData, formValues);
  }, [formData, formValues]);

  const { isValid: isFormValid, errors } = validationResult;

  const { isValid: formIsValid } = useMemo(() => {
    return validateWholeForm(formData, formValues);
  }, [formData, formValues]);

  useEffect(() => {
    setisComplete(formIsValid);
  }, [formIsValid]);

  const handleFileUpload = async (field, file) => {
    if (!file) return;

    const sessionToken = formData?.session?.session_token;
    if (!sessionToken) {
      notify({
        type: "error",
        title: "No session",
        message: "Session token missing. Refresh the form and try again.",
      });
      return;
    }

    try {
      setUploading((prev) => ({ ...prev, [field.key_name]: true }));

      const result = await dispatch(
        uploadFile({
          formKey,
          fieldId: field.field_id,
          files: file,
          sessionToken,
        }),
      ).unwrap();

      const uploadedFiles = result?.files || [];
      if (!uploadedFiles.length)
        throw new Error("Upload succeeded but no file metadata returned.");

      const value = JSON.stringify({ files: uploadedFiles });

      handleInputChange(field.key_name, value);

      notify({
        type: "success",
        title: "File uploaded",
        message: "Your file is ready.",
      });
    } catch (err) {
      notify({
        type: "error",
        title: "Upload failed",
        message:
          typeof err === "string" ? err : "Could not upload file. Try again.",
      });
    } finally {
      setUploading((prev) => ({ ...prev, [field.key_name]: false }));
    }
  };

  if (status === "loading" || sessionStatus === "loading") {
    return <AppLoader />;
  }

  if (status === "failed" || sessionStatus === "failed") {
    const resolvedError =
      draftError ?? error ?? sessionError ?? "Something Went Wrong";
    return <AppError message={resolvedError} />;
  }

  if (!formData) {
    return <AppError message={"No Form Found"} />;
  }

  const handleInputChange = (keyName, value) => {
    console.log(value);
    setFormValues((prev) => ({
      ...prev,
      [keyName]: value,
    }));

    setTouchedFields((prev) => ({
      ...prev,
      [keyName]: true,
    }));

    setFieldErrors((prev) => ({
      ...prev,
      [keyName]: "",
    }));
  };

  const toISO = (d) =>
    d instanceof Date ? d.toISOString() : new Date(d).toISOString();

  const getSessionId = () => {
    const formId = formData?.form_id;
    const sessionToken = formData?.session?.session_token;

    if (!formId || !sessionToken) return null;

    const key = `fh_session_${formId}`;
    sessionStorage.setItem(key, sessionToken);

    return sessionToken;
  };
  // Decide which typed column gets populated
  const mapFieldValueToTypedCols = (fieldType, raw) => {
    // Normalize empty values
    const isEmpty =
      raw === undefined ||
      raw === null ||
      raw === "" ||
      (Array.isArray(raw) && raw.length === 0);

    if (isEmpty) {
      return {
        value_text: null,
        value_number: null,
        value_date: null,
        value_datetime: null,
        value_bool: null,
      };
    }

    switch (fieldType) {
      case "checkbox":
        return {
          value_text: null,
          value_number: null,
          value_date: null,
          value_datetime: null,
          value_bool: Boolean(raw),
        };

      case "date":
        // Expect "YYYY-MM-DD"
        return {
          value_text: null,
          value_number: null,
          value_date: String(raw),
          value_datetime: null,
          value_bool: null,
        };

      case "datetime":
        // If you add a datetime field later
        return {
          value_text: null,
          value_number: null,
          value_date: null,
          value_datetime: toISO(raw),
          value_bool: null,
        };

      case "number":
        // If you add numeric fields later
        return {
          value_text: null,
          value_number: Number(raw),
          value_date: null,
          value_datetime: null,
          value_bool: null,
        };

      case "multiselect":
        const arr = Array.isArray(raw)
          ? raw
          : typeof raw === "string"
            ? raw
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : [];

        return {
          value_text: JSON.stringify(arr),
          value_number: null,
          value_date: null,
          value_datetime: null,
          value_bool: null,
        };
      // text, email, textarea, select, radio -> store as text
      default:
        return {
          value_text: String(raw),
          value_number: null,
          value_date: null,
          value_datetime: null,
          value_bool: null,
        };
    }
  };

  const buildResponsePayload = () => {
    // You’ll replace this later with your real auth user id
    const userId = user?.id || 1;

    // Form must expose form_id for DB inserts; if you only have form_key today,
    // put it into meta_json too.
    const formId = formData.form_id ?? null;
    const totalSteps = formData.steps.length;
    const sessionId = getSessionId();

    // Flatten all fields across all steps (so payload includes whole form, not just current step)
    const allFields = (formData.steps ?? [])
      .flatMap((s) => s.fields ?? [])
      .filter((f) => f.active);

    const responseValues = allFields.map((field) => {
      const rawValue = formValues[field.key_name];

      return {
        form_field_id: field.field_id,
        ...mapFieldValueToTypedCols(field.field_type, rawValue),
      };
    });

    return {
      response: {
        form_id: formId,
        user_id: userId,
        total_steps: totalSteps,
        submitted_at: new Date().toISOString(),
        client_ip: null, // backend will fill (never trust frontend for IP)
        user_agent: navigator.userAgent,
        meta_json: {
          form_key: formData.form_key,
          form_title: formData.title,
          current_step:
            formData.steps?.[currentStep]?.step_number ?? currentStep + 1,
          source: "web",
        },
        session_id: sessionId,
      },
      response_values: responseValues,
    };
  };

  const handleSaveDraft = async () => {
    try {
      const payload = buildResponsePayload();
      console.log("Draft payload:", payload);

      const result = await dispatch(saveDraft(payload)).unwrap();

      notify({
        type: "success",
        title: "Draft saved",
        message:
          "Your progress has been saved. You can safely come back later.",
      });
    } catch (err) {
      notify({
        type: "error",
        title: "Could not save draft",
        message:
          typeof err === "string"
            ? err
            : "The draft could not be saved. Please try again.",
      });
    }
  };

  const handleFinalSubmit = async () => {
    const { isValid, errors } = validateWholeForm(formData, formValues);

    if (!isValid) {
      const touched = {};
      Object.keys(errors).forEach((key) => {
        touched[key] = true;
      });

      setTouchedFields((prev) => ({ ...prev, ...touched }));
      setFieldErrors(errors);

      notify({
        type: "error",
        title: "Form incomplete",
        message: "Please fix the highlighted fields before submitting.",
      });

      return;
    }

    try {
      const payload = buildResponsePayload();

      await dispatch(
        submitFinal({
          formKey,
          response: payload.response,
          response_values: payload.response_values,
        }),
      ).unwrap();

      notify({
        type: "success",
        title: "Form submitted",
        message: "Your response has been successfully submitted.",
      });
      navigate(-1);
    } catch (err) {
      notify({
        type: "error",
        title: "Submission failed",
        message:
          typeof err === "string"
            ? err
            : "Something went wrong while submitting the form.",
      });
    }
  };

  const getUploadedFilesForField = (keyName) => {
    const raw = formValues?.[keyName];
    if (!raw) return [];
    try {
      const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Array.isArray(obj?.files) ? obj.files : [];
    } catch {
      return [];
    }
  };

  const RequiredLabel = ({ label, required }) => (
    <Field.Label>
      {label}
      {required && (
        <Text color={"red.500"} fontSize={18} fontWeight={"900"}>
          *
        </Text>
      )}
    </Field.Label>
  );

  function parseFieldConfig(configText) {
    if (!configText || typeof configText !== "string") return null;

    try {
      const obj = JSON.parse(configText);
      if (obj && typeof obj === "object") return obj;
    } catch (_) {}

    const fixed = configText.replace(/""/g, '"');

    try {
      const obj = JSON.parse(fixed);
      if (obj && typeof obj === "object") return obj;
    } catch (_) {}

    const stripped = fixed.replace(/^"+|"+$/g, "");

    try {
      const obj = JSON.parse(stripped);
      if (obj && typeof obj === "object") return obj;
    } catch (_) {}

    return null;
  }
  const renderField = (field) => {
    const value = formValues[field.key_name];
    const isThisFieldLoading = !!fieldLoader?.[field.key_name];

    const commonProps = {
      value: value ?? "",
      onChange: (e) => handleInputChange(field.key_name, e.target.value),
      required: field.required,
      name: field.key_name, // helpful for scroll-to-error later if you want
      disabled: isThisFieldLoading,
    };

    const cfg = parseFieldConfig(field.config_json); // adjust key name
    const hasDynamicOptions = !!(
      cfg?.dynamicOptions?.enabled && cfg?.dynamicOptions?.url
    );

    switch (field.field_type) {
      case "text":
        return (
          <Field.Root
            key={field.field_id}
            required={field.required}
            invalid={isFieldInvalid(field)}
          >
            <RequiredLabel label={field.label} required={field.required} />
            <Input {...commonProps} />
            {isFieldInvalid(field) && (
              <Field.ErrorText>{fieldErrors[field.key_name]}</Field.ErrorText>
            )}
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );

      case "textarea":
        return (
          <Field.Root
            key={field.field_id}
            required={field.required}
            invalid={isFieldInvalid(field)}
          >
            <RequiredLabel label={field.label} required={field.required} />
            <Textarea {...commonProps} rows={4} />
            {isFieldInvalid(field) && (
              <Field.ErrorText>{fieldErrors[field.key_name]}</Field.ErrorText>
            )}
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );

      case "email":
        return (
          <Field.Root
            key={field.field_id}
            required={field.required}
            invalid={isFieldInvalid(field)}
          >
            <RequiredLabel label={field.label} required={field.required} />
            <Input {...commonProps} type="email" />
            {isFieldInvalid(field) && (
              <Field.ErrorText>{fieldErrors[field.key_name]}</Field.ErrorText>
            )}
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );

      case "number":
        return (
          <Field.Root
            key={field.field_id}
            required={field.required}
            invalid={isFieldInvalid(field)}
          >
            <RequiredLabel label={field.label} required={field.required} />
            <Input
              {...commonProps}
              type="number"
              inputMode="numeric"
              // optional: min/max if you store them on field
              min={field.min ?? undefined}
              max={field.max ?? undefined}
            />
            {isFieldInvalid(field) && (
              <Field.ErrorText>{fieldErrors[field.key_name]}</Field.ErrorText>
            )}
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );

      case "date":
        return (
          <Field.Root
            key={field.field_id}
            required={field.required}
            invalid={isFieldInvalid(field)}
          >
            <RequiredLabel label={field.label} required={field.required} />
            <Input {...commonProps} type="date" />
            {isFieldInvalid(field) && (
              <Field.ErrorText>{fieldErrors[field.key_name]}</Field.ErrorText>
            )}
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );

      case "url":
        return (
          <Field.Root
            key={field.field_id}
            required={field.required}
            invalid={isFieldInvalid(field)}
          >
            <RequiredLabel label={field.label} required={field.required} />
            <Input
              {...commonProps}
              type="url"
              placeholder="https://example.com"
            />
            {isFieldInvalid(field) && (
              <Field.ErrorText>{fieldErrors[field.key_name]}</Field.ErrorText>
            )}
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );

      case "tel":
        return (
          <Field.Root
            key={field.field_id}
            required={field.required}
            invalid={isFieldInvalid(field)}
          >
            <RequiredLabel label={field.label} required={field.required} />
            <Input {...commonProps} type="tel" placeholder="+1 555 123 4567" />
            {isFieldInvalid(field) && (
              <Field.ErrorText>{fieldErrors[field.key_name]}</Field.ErrorText>
            )}
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );

      case "checkbox":
        return (
          <Field.Root key={field.field_id} invalid={isFieldInvalid(field)}>
            <Checkbox.Root
              checked={!!value}
              variant={"outline"}
              onChange={(e) =>
                handleInputChange(field.key_name, e.target.checked)
              }
            >
              <Checkbox.HiddenInput name={field.key_name} />
              <Checkbox.Control />
              <Checkbox.Label>{field.label}</Checkbox.Label>
              {field.required && (
                <Text color={"red.500"} fontSize={18} fontWeight={"900"}>
                  *
                </Text>
              )}
            </Checkbox.Root>

            {isFieldInvalid(field) && (
              <Field.ErrorText>{fieldErrors[field.key_name]}</Field.ErrorText>
            )}
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );

      case "radio":
        return (
          <Field.Root
            key={field.field_id}
            required={field.required}
            invalid={isFieldInvalid(field)}
          >
            <HStack alignItems="center" gap={2}>
              <Field.Label>{field.label}</Field.Label>
              {field.required && (
                <Text color={"red.500"} fontSize={18} fontWeight={"900"}>
                  *
                </Text>
              )}
              {hasDynamicOptions && (
                <Button
                  size="xs"
                  bgColor="#2596be"
                  color="white"
                  borderRadius="full"
                  padding={1}
                  minW="unset"
                  onClick={() => handleRefreshForField(field)}
                  disabled={isThisFieldLoading}
                >
                  <FaArrowRotateRight
                    style={{
                      animation: isThisFieldLoading
                        ? "spin 1s linear infinite"
                        : "none",
                    }}
                  />
                </Button>
              )}
            </HStack>

            <Stack direction="column" gap={2}>
              <RadioGroup.Root
                required={field.required}
                value={value ?? ""}
                onValueChange={(e) =>
                  handleInputChange(field.key_name, e.value)
                }
                disabled={isThisFieldLoading}
              >
                <HStack gap="6" wrap="wrap">
                  {field.options.map((item) => (
                    <RadioGroup.Item key={item.value} value={item.value}>
                      <RadioGroup.ItemHiddenInput name={field.key_name} />
                      <RadioGroup.ItemIndicator />
                      <RadioGroup.ItemText>{item.label}</RadioGroup.ItemText>
                    </RadioGroup.Item>
                  ))}
                </HStack>
              </RadioGroup.Root>
            </Stack>

            {isFieldInvalid(field) && (
              <Field.ErrorText>{fieldErrors[field.key_name]}</Field.ErrorText>
            )}
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );

      case "select": {
        const optionCollection = createListCollection({ items: field.options });
        return (
          <Field.Root
            key={field.field_id}
            invalid={isFieldInvalid(field)}
            required={field.required}
          >
            <Select.Root
              collection={optionCollection}
              required={field.required}
              value={value || []} // Chakra expects array
              onValueChange={(e) => handleInputChange(field.key_name, e.value)}
              disabled={isThisFieldLoading}
            >
              <HStack alignItems="center" gap={2}>
                <Select.Label width={"fit-content"}>{field.label}</Select.Label>
                {field.required && (
                  <Text
                    width={"fit-content"}
                    color={"red.500"}
                    fontSize={18}
                    fontWeight={"900"}
                  >
                    *
                  </Text>
                )}
                {hasDynamicOptions && (
                  <Button
                    size="xs"
                    bgColor="#2596be"
                    color="white"
                    borderRadius="full"
                    padding={1}
                    minW="unset"
                    onClick={() => handleRefreshForField(field)}
                    disabled={isThisFieldLoading}
                  >
                    <FaArrowRotateRight
                      style={{
                        animation: isThisFieldLoading
                          ? "spin 1s linear infinite"
                          : "none",
                      }}
                    />
                  </Button>
                )}
              </HStack>
              <Select.Control>
                <Select.Trigger>
                  <Select.ValueText placeholder="Select Option" />
                </Select.Trigger>
                <Select.IndicatorGroup>
                  <Select.Indicator />
                </Select.IndicatorGroup>
              </Select.Control>
              <Portal>
                <Select.Positioner>
                  <Select.Content>
                    {optionCollection.items.map((item) => (
                      <Select.Item item={item} key={item.value}>
                        {item.label}
                        <Select.ItemIndicator />
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Positioner>
              </Portal>
            </Select.Root>

            {isFieldInvalid(field) && (
              <Field.ErrorText>{fieldErrors[field.key_name]}</Field.ErrorText>
            )}
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );
      }

      case "multiselect": {
        const multiCollection = createListCollection({ items: field.options });
        return (
          <Field.Root
            key={field.field_id}
            invalid={isFieldInvalid(field)}
            required={field.required}
          >
            <Select.Root
              collection={multiCollection}
              required={field.required}
              value={value || []}
              onValueChange={(e) => handleInputChange(field.key_name, e.value)}
              multiple
              disabled={isThisFieldLoading}
            >
              <HStack alignItems="center" gap={2}>
                <Select.Label width={"fit-content"}>{field.label}</Select.Label>
                {field.required && (
                  <Text
                    width={"fit-content"}
                    color={"red.500"}
                    fontSize={18}
                    fontWeight={"900"}
                  >
                    *
                  </Text>
                )}
                {hasDynamicOptions && (
                  <Button
                    size="xs"
                    bgColor="#2596be"
                    color="white"
                    borderRadius="full"
                    padding={1}
                    minW="unset"
                    onClick={() => handleRefreshForField(field)}
                    disabled={isThisFieldLoading}
                  >
                    <FaArrowRotateRight
                      style={{
                        animation: isThisFieldLoading
                          ? "spin 1s linear infinite"
                          : "none",
                      }}
                    />
                  </Button>
                )}
              </HStack>
              <Select.Control>
                <Select.Trigger>
                  <Select.ValueText placeholder="Select Option" />
                </Select.Trigger>
                <Select.IndicatorGroup>
                  <Select.Indicator />
                </Select.IndicatorGroup>
              </Select.Control>

              <Portal>
                <Select.Positioner>
                  <Select.Content>
                    {multiCollection.items.map((item) => (
                      <Select.Item item={item} key={item.value}>
                        {item.label}
                        <Select.ItemIndicator />
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Positioner>
              </Portal>
            </Select.Root>

            {isFieldInvalid(field) && (
              <Field.ErrorText>{fieldErrors[field.key_name]}</Field.ErrorText>
            )}
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );
      }

      case "file": {
        const uploadedFiles = getUploadedFilesForField(field.key_name);
        const staged = stagedFiles[field.key_name] || [];
        const isUploadingThis = !!uploading[field.key_name];

        return (
          <Field.Root
            key={field.field_id}
            required={field.required}
            invalid={isFieldInvalid(field)}
          >
            <RequiredLabel label={field.label} required={field.required} />

            {/* Permanent helper text */}
            <Text fontSize="sm" color="red.600">
              Max files: 10
              <br /> Max size: 30 MB/file.
            </Text>

            <Stack gap={2}>
              {/* If files already uploaded, show read-only list */}
              {uploadedFiles.length > 0 ? (
                <Box borderWidth="1px" borderRadius="md" p={3} bg="gray.50">
                  <Text fontWeight="600" mb={2}>
                    Uploaded file{uploadedFiles.length > 1 ? "s" : ""}:
                  </Text>

                  <Stack gap={1}>
                    {uploadedFiles.map((f, idx) => (
                      <HStack
                        key={`${f.file_id || idx}`}
                        justify="space-between"
                      >
                        <Text fontSize="sm" noOfLines={1}>
                          {f.original_name || "Unnamed file"}
                        </Text>
                        <Text fontSize="sm" color="gray.600">
                          {formatBytes(f.size_bytes)}
                        </Text>
                      </HStack>
                    ))}
                  </Stack>

                  {/* Optional: “Replace” button just clears current value so they can upload again */}
                  <Button
                    mt={3}
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      // Clear stored uploaded file metadata
                      handleInputChange(field.key_name, null);
                      // Also clear staged files
                      setStagedFiles((prev) => ({
                        ...prev,
                        [field.key_name]: [],
                      }));
                    }}
                  >
                    Replace upload
                  </Button>
                </Box>
              ) : (
                <>
                  {/* No uploaded files yet: show picker + list + upload button */}
                  <FileUpload.Root
                    name={field.key_name}
                    onChange={(e) => {
                      const list = e?.target?.files;
                      const arr = list ? Array.from(list) : [];
                      // Optional: enforce max files client-side
                      setStagedFiles((prev) => ({
                        ...prev,
                        [field.key_name]: arr.slice(0, 10),
                      }));
                    }}
                  >
                    <FileUpload.HiddenInput multiple />
                    <FileUpload.Trigger asChild>
                      <Button variant="outline" size="sm">
                        <HiUpload /> Choose file(s)
                      </Button>
                    </FileUpload.Trigger>

                    <FileUpload.List showSize clearable />
                  </FileUpload.Root>

                  {staged.length > 0 && (
                    <Button
                      size="sm"
                      bgColor="#2596be"
                      color="white"
                      isLoading={isUploadingThis}
                      loadingText="Uploading..."
                      onClick={async () => {
                        await handleFileUpload(field, staged);
                        // Clear staged after successful upload
                        setStagedFiles((prev) => ({
                          ...prev,
                          [field.key_name]: [],
                        }));
                      }}
                    >
                      Upload {staged.length} file{staged.length > 1 ? "s" : ""}
                    </Button>
                  )}
                </>
              )}
            </Stack>

            {isFieldInvalid(field) && (
              <Field.ErrorText>{fieldErrors[field.key_name]}</Field.ErrorText>
            )}
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );
      }

      default:
        return null;
    }
  };

  if (!formData) return <div> Form Not Found </div>;

  const currentStepData = formData.steps[currentStep];
  const isLastStep = currentStep === formData.steps.length - 1;
  const isFirstStep = currentStep === 0;

  const getDynamicOptionFields = (form) => {
    if (!form?.steps?.length) return [];

    return form.steps.flatMap((step) =>
      (step.fields || []).filter((field) => {
        if (!field?.config_json) return false;

        try {
          const cfg = JSON.parse(field.config_json);

          return !!(cfg?.dynamicOptions?.enabled && cfg?.dynamicOptions?.url);
        } catch {
          return false;
        }
      }),
    );
  };

  const dynamicFields = getDynamicOptionFields(formData);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const waitForJob = async (
    jobId,
    { timeoutMs = 60000, intervalMs = 1500 } = {},
  ) => {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      const s = await dispatch(getOptionsJobStatus({ jobId })).unwrap();

      if (s?.status === "completed") return true;
      if (s?.status === "failed")
        throw new Error(`Options job failed (jobId=${jobId})`);

      await sleep(intervalMs);
    }

    throw new Error(`Timed out waiting for options job (jobId=${jobId})`);
  };

  const handleRefreshForField = async (field) => {
    setFieldLoader((prev) => ({ ...prev, [field.key_name]: true }));
    try {
      const data = await dispatch(
        triggerOptionsProcessing({
          formKey,
          fieldId: field.field_id,
        }),
      ).unwrap();

      notify({
        type: "info",
        title: "Dynamic Options Processing",
        message: `Fetching Dynamic Options for ${field.label}.`,
      });
      console.log(data);
      if (data?.jobId) {
        const jobId = data.jobId;
        await waitForJob(jobId, { timeoutMs: 120000, intervalMs: 1500 });
        await dispatch(getForm({ formKey })).unwrap();

        notify({
          type: "success",
          title: "Options Updated",
          message: `Dynamic options refreshed successfully for ${field.label}.`,
        });
      }
    } catch (err) {
      const msg =
        typeof err === "string"
          ? err
          : err?.message
            ? err.message
            : JSON.stringify(err);

      notify({ type: "error", title: "Refresh failed", message: msg });
    } finally {
      setFieldLoader((prev) => ({ ...prev, [field.key_name]: false }));
    }
  };

  const handleRefresh = async () => {
    setIsRotating(true);

    try {
      const jobIds = [];

      for (let i = 0; i < dynamicFields.length; i++) {
        const data = await dispatch(
          triggerOptionsProcessing({
            formKey,
            fieldId: dynamicFields[i].field_id,
          }),
        ).unwrap();

        // Expect backend to return { jobId }
        if (data?.jobId) jobIds.push(data.jobId);

        notify({
          type: "info",
          title: "Dynamic Options Processing",
          message: `Request queued for Dynamic Options on ${dynamicFields[i].label}`,
        });
      }

      // Wait for all jobs to complete
      for (const jobId of jobIds) {
        await waitForJob(jobId, { timeoutMs: 120000, intervalMs: 1500 });
      }

      // Refresh the form once options are updated
      await dispatch(getForm({ formKey })).unwrap();

      notify({
        type: "success",
        title: "Options Updated",
        message: "Dynamic options refreshed successfully.",
      });
    } catch (err) {
      const msg =
        typeof err === "string"
          ? err
          : err?.message
            ? err.message
            : JSON.stringify(err);

      notify({ type: "error", title: "Refresh failed", message: msg });
    } finally {
      setIsRotating(false);
    }
  };

  const hasAnyStagedFiles = Object.values(stagedFiles || {}).some(
    (arr) => Array.isArray(arr) && arr.length > 0,
  );
  return (
    <Box>
      <Container width="80vw">
        <HStack
          width={"full"}
          justifyContent={"start"}
          alignItems={"flex-start"}
        >
          <Card.Root minWidth={"65%"} minHeight="60vh">
            <Card.Header>
              <Stack gap={2}>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  pt={0}
                >
                  <Heading size="lg">{currentStepData.step_title}</Heading>
                  <Badge>
                    Step {currentStep + 1} of {formData.steps.length}
                  </Badge>
                </Box>
                {currentStepData.step_description && (
                  <Text color={"gray.500"} fontSize={16}>
                    {currentStepData.step_description}
                  </Text>
                )}
              </Stack>
            </Card.Header>

            <Card.Body maxHeight={"50vh"} overflowY={"scroll"}>
              <Stack gap={6}>
                {currentStepData.fields.length > 0 ? (
                  [...currentStepData.fields]
                    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                    .filter((field) => field.active)
                    .map((field) => renderField(field))
                ) : (
                  <Text color="gray.500" textAlign="center" py={8}>
                    No fields in this step
                  </Text>
                )}
              </Stack>
            </Card.Body>

            <Card.Footer>
              <Box display="flex" justifyContent="space-between" width="100%">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep((prev) => prev - 1)}
                  disabled={isFirstStep}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  bgColor={"#2596be"}
                  minWidth={24}
                  color={"white"}
                  onClick={() => setCurrentStep((next) => next + 1)}
                  disabled={isLastStep}
                >
                  Next
                </Button>
              </Box>
            </Card.Footer>
          </Card.Root>
          <VStack
            gap={2}
            justifyContent={"space-between"}
            alignItems={"stretch"}
          >
            <Card.Root
              mb={2}
              minHeight={36}
              maxHeight={"50vh"}
              overflowY={"clip"}
            >
              <Card.Header>
                <Stack>
                  <Heading size="2xl" textAlign={"left"} mb={2}>
                    {formData.title}
                  </Heading>

                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Text color="gray.600" overflowY={"auto"} maxHeight={28}>
                      {formData.description}
                    </Text>
                  </Box>

                  <Box
                    display="flex"
                    gap={2}
                    mb={4}
                    fontSize="sm"
                    color="gray.500"
                  >
                    <Text>Owner: {formData.owner_name}</Text>
                    <Badge
                      ml={4}
                      colorPalette={
                        formData.status === "Archived" ? "gray" : "green"
                      }
                    >
                      {formData.status}
                    </Badge>
                  </Box>
                </Stack>
              </Card.Header>
              <Card.Body>
                <HStack>
                  <Button
                    variant={"outline"}
                    size={"sm"}
                    color={"blue.600"}
                    borderColor={"blue.500"}
                    onClick={handleRefresh}
                    disabled={isRotating}
                  >
                    <SlRefresh
                      style={{
                        animation: isRotating
                          ? "spin 1s linear infinite"
                          : "none",
                      }}
                    />
                    <Text>Refresh Dynamic Options</Text>
                  </Button>
                </HStack>
              </Card.Body>
            </Card.Root>
            <Card.Root>
              <Card.Header mt={-2} fontWeight="bold" letterSpacing="wide">
                Actions
              </Card.Header>

              <Card.Body gap={2}>
                <HStack>
                  <Button
                    variant={"surface"}
                    size="sm"
                    onClick={() => navigate("/forms")}
                  >
                    Back
                  </Button>
                  <Button
                    variant="outline"
                    color={"white"}
                    bgColor={"#94ca5c"}
                    size="sm"
                    borderRadius="md"
                    onClick={handleSaveDraft}
                    disabled={draftStatus === "loading" || hasAnyStagedFiles}
                  >
                    {draftStatus === "loading" ? "Saving" : "Save as Draft"}
                  </Button>

                  <Button
                    variant="solid"
                    size="sm"
                    borderRadius="md"
                    fontWeight="semibold"
                    bgColor={"#2596be"}
                    onClick={handleFinalSubmit}
                    disabled={hasAnyStagedFiles}
                  >
                    Submit Final Response
                  </Button>
                </HStack>
                {hasAnyStagedFiles && (
                  <Text fontSize="sm" color="red.500" mt={2}>
                    Files selected but not uploaded. Upload them or clear the
                    selection before saving.
                  </Text>
                )}
              </Card.Body>
            </Card.Root>
          </VStack>
        </HStack>

        <Box mt={6}>
          <Box display="flex" gap={2} justifyContent="center">
            {formData.steps.map((step, index) => (
              <Box
                key={step.step_id}
                w={`${100 / formData.steps.length}%`}
                h={2}
                bg={index <= currentStep ? "blue.500" : "gray.300"}
                borderRadius="full"
                cursor="pointer"
                onClick={() => setCurrentStep(index)}
              />
            ))}
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default FormDetail;
