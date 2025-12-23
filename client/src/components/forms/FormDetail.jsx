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
} from "@chakra-ui/react";
import { useNavigate, useParams } from "react-router";
import { SlRefresh } from "react-icons/sl";
import { useSelector, useDispatch } from "react-redux";
import { notify } from "../ui/notifyStore";
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
} from "@/features/forms/formsSlice";
import { getForm } from "@/features/forms/formsSlice";
import { selectUser } from "@/features/auth/authSlice";
import { GiConsoleController } from "react-icons/gi";
import AppLoader from "../ui/AppLoader";
import AppError from "../ui/AppError";

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
      dispatch(getForm(formKey));
    }
  }, [formKey, dispatch]);

  useEffect(() => {
    const sessionToken = formData?.session?.session_token;
    console.log(sessionToken);
    if (sessionToken) {
      dispatch(getUserSessionData({ formKey, sessionToken: sessionToken }));
      notify({
        type: "info",
        title: "Continue where you left.",
        message: "You already have a saved session.",
      });
    }
  }, [formData, dispatch]);

  useEffect(() => {
    if (formKey && sessionData) {
      const normalized = normalizeSessionValues(sessionData, formData);
      console.log(normalized);
      setFormValues(normalized);
    }
  }, [formKey, sessionData, formData]);

  const [currentStep, setCurrentStep] = useState(0);
  const [formValues, setFormValues] = useState({});
  const [isRotating, setIsRotating] = useState(false);

  const handleRefresh = () => {
    setIsRotating(true);

    setTimeout(() => {
      setIsRotating(false);
    }, 1005);
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
    setFormValues((prev) => ({
      ...prev,
      [keyName]: value,
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

      console.log("Save draft result:", result);
    } catch (err) {
      console.error("Save draft failed:", err);

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
  const renderField = (field) => {
    const commonProps = {
      value: formValues[field.key_name] || "",
      onChange: (e) => handleInputChange(field.key_name, e.target.value),
      required: field.required,
    };

    switch (field.field_type) {
      case "text":
        return (
          <Field.Root key={field.field_id} required={field.required}>
            <RequiredLabel label={field.label} required={field.required} />
            <Input {...commonProps} />
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );
      case "email":
        return (
          <Field.Root key={field.field_id} required={field.required}>
            <RequiredLabel label={field.label} required={field.required} />
            <Input {...commonProps} type="email" />
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );

      case "date":
        return (
          <Field.Root key={field.field_id} required={field.required}>
            <RequiredLabel label={field.label} required={field.required} />
            <Input {...commonProps} type="date" />
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );

      case "textarea":
        return (
          <Field.Root key={field.field_id} required={field.required}>
            <RequiredLabel label={field.label} required={field.required} />
            <Textarea {...commonProps} rows={4} />
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );

      case "checkbox":
        return (
          <Field.Root key={field.field_id}>
            <Checkbox.Root
              key={field.field_id}
              checked={!!formValues[field.key_name]}
              variant={"outline"}
              onChange={(e) =>
                handleInputChange(field.key_name, e.target.checked)
              }
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label>{field.label}</Checkbox.Label>
              {field.required && (
                <Text color={"red.500"} fontSize={18} fontWeight={"900"}>
                  *
                </Text>
              )}
            </Checkbox.Root>
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );

      case "radio":
        return (
          <Field.Root key={field.field_id} required={field.required}>
            <Field.Label>{field.label}</Field.Label>
            {field.required && (
              <Text color={"red.500"} fontSize={18} fontWeight={"900"}>
                *
              </Text>
            )}
            <Stack direction="column" gap={2} key={field.field_id}>
              <RadioGroup.Root
                key={field.field_id}
                required={field.required}
                value={formValues[field.key_name] || ""}
                onValueChange={(e) =>
                  handleInputChange(field.key_name, e.value)
                }
              >
                <HStack gap="6">
                  {field.options.map((item) => (
                    <RadioGroup.Item key={item.value} value={item.value}>
                      <RadioGroup.ItemHiddenInput />
                      <RadioGroup.ItemIndicator />
                      <RadioGroup.ItemText>{item.label}</RadioGroup.ItemText>
                    </RadioGroup.Item>
                  ))}
                </HStack>
              </RadioGroup.Root>
            </Stack>
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );

      case "select":
        const optionCollection = createListCollection({
          items: field.options,
        });
        return (
          <Select.Root
            collection={optionCollection}
            key={field.field_id}
            required={field.required}
            value={formValues[field.key_name]}
            onValueChange={(e) => handleInputChange(field.key_name, e.value)}
          >
            <Select.Label>{field.label}</Select.Label>
            {field.required && (
              <Text color={"red.500"} fontSize={18} fontWeight={"900"}>
                *
              </Text>
            )}
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
            {field.help_text && (
              <Select.HelperText>{field.help_text}</Select.HelperText>
            )}
          </Select.Root>
        );
      case "multiselect":
        const multiCollection = createListCollection({
          items: field.options,
        });
        return (
          <Select.Root
            collection={multiCollection}
            key={field.field_id}
            required={field.required}
            value={formValues[field.key_name] || []}
            onValueChange={(e) => handleInputChange(field.key_name, e.value)}
            multiple
          >
            <Select.Label>{field.label}</Select.Label>
            {field.required && (
              <Text color={"red.500"} fontSize={18} fontWeight={"900"}>
                *
              </Text>
            )}
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
            {field.help_text && (
              <Select.HelperText>{field.help_text}</Select.HelperText>
            )}
          </Select.Root>
        );

      default:
        return null;
    }
  };
  if (!formData) return <div> Form Not Found </div>;

  const currentStepData = formData.steps[currentStep];
  const isLastStep = currentStep === formData.steps.length - 1;
  const isFirstStep = currentStep === 0;
  return (
    <Box>
      <Container width="80vw">
        <HStack justifyContent={"space-between"} width={"65%"}>
          <Heading size="4xl" textAlign={"left"} mb={2}>
            {formData.title}
          </Heading>
          <Button variant={"surface"} onClick={() => navigate("/forms")}>
            Back
          </Button>
        </HStack>
        <HStack
          width={"full"}
          justifyContent={"start"}
          alignItems={"flex-start"}
          maxHeight={"60vh"}
          overflowY={"auto"}
        >
          <Card.Root
            minWidth={"65%"}
            minHeight="60vh"
            maxHeight={"60vh"}
            overflowY={"scroll"}
          >
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
                    Step {currentStepData.step_number} of{" "}
                    {formData.steps.length}
                  </Badge>
                </Box>
                {currentStepData.step_description && (
                  <Text color={"gray.500"} fontSize={16}>
                    {currentStepData.step_description}
                  </Text>
                )}
              </Stack>
            </Card.Header>

            <Card.Body>
              <Stack gap={6}>
                {currentStepData.fields.length > 0 ? (
                  [...currentStepData.fields] // clone so we don’t mutate Redux state
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
                <Button
                  variant={"outline"}
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
              </Card.Body>
            </Card.Root>
            <Card.Root>
              <Card.Header mt={-2} fontWeight="bold" letterSpacing="wide">
                Actions
              </Card.Header>

              <Card.Body gap={2}>
                <HStack>
                  <Button
                    variant="outline"
                    color={"white"}
                    bgColor={"#94ca5c"}
                    size="sm"
                    borderRadius="md"
                    onClick={handleSaveDraft}
                    disabled={draftStatus === "loading"}
                  >
                    {draftStatus === "loading" ? "Saving" : "Save as Draft"}
                  </Button>

                  <Button
                    variant="solid"
                    size="sm"
                    borderRadius="md"
                    fontWeight="semibold"
                    bgColor={"#2596be"}
                    disabled={!isComplete}
                  >
                    Submit Final Response
                  </Button>
                </HStack>
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
