import React, { useState } from "react";
import {
  Box,
  Button,
  Field,
  Fieldset,
  Input,
  NativeSelect,
  Stack,
  Grid,
  GridItem,
  Heading,
  Card,
  Textarea,
  Text,
  Flex,
  RadioGroup,
  Badge,
  Switch,
  IconButton,
  Collapsible,
} from "@chakra-ui/react";
import {
  FaFont,
  FaAlignLeft,
  FaEnvelope,
  FaHashtag,
  FaCalendarAlt,
  FaListUl,
  FaCheckSquare,
  FaCircle,
  FaUpload,
  FaLink,
  FaPhone,
  FaTrash,
  FaGripVertical,
  FaChevronDown,
  FaChevronUp,
  FaPlus,
  FaTimes,
} from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import {
  createForm,
  selectCreateFormStatus,
  selectCreateFormError,
} from "../../features/forms/formsSlice";
import slugify from "@/utils/slug";
import { useNavigate } from "react-router";

const NewForm = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "Draft",
    is_anonymous: false,
    rpa_webhook_url: "",
    rpa_secret: "",
    rpa_secret_method: "",
    rpa_timeout_ms: 8000,
    rpa_retry_count: 3,
    form_key: "",
  });

  const [steps, setSteps] = useState([
    {
      step_id: 1,
      step_number: 1,
      step_title: "Step 1",
      step_description: "",
      sort_order: 0,
      is_active: true,
      fields: [],
    },
  ]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [isBasicInfoOpen, setIsBasicInfoOpen] = useState(true);

  const fieldTypeOptions = [
    { type: "text", label: "Text Input", icon: <FaFont /> },
    { type: "textarea", label: "Text Area", icon: <FaAlignLeft /> },
    { type: "email", label: "Email", icon: <FaEnvelope /> },
    { type: "number", label: "Number", icon: <FaHashtag /> },
    { type: "date", label: "Date", icon: <FaCalendarAlt /> },
    { type: "select", label: "Dropdown", icon: <FaListUl /> },
    { type: "checkbox", label: "Checkbox", icon: <FaCheckSquare /> },
    { type: "radio", label: "Radio Button", icon: <FaCircle /> },
    { type: "file", label: "File Upload", icon: <FaUpload /> },
    { type: "url", label: "URL", icon: <FaLink /> },
    { type: "tel", label: "Phone", icon: <FaPhone /> },
  ];

  const addStep = () => {
    const newStep = {
      step_id: Date.now(),
      step_number: steps.length + 1,
      step_title: `Step ${steps.length + 1}`,
      step_description: "",
      sort_order: steps.length,
      is_active: true,
      fields: [],
    };
    setSteps([...steps, newStep]);
    setCurrentStepIndex(steps.length);
  };

  const updateStep = (stepIndex, updates) => {
    const updatedSteps = [...steps];
    updatedSteps[stepIndex] = { ...updatedSteps[stepIndex], ...updates };
    setSteps(updatedSteps);
  };

  const removeStep = (stepIndex) => {
    if (steps.length === 1) {
      alert("You must have at least one step");
      return;
    }
    const updatedSteps = steps.filter((_, i) => i !== stepIndex);
    setSteps(updatedSteps);
    if (currentStepIndex >= updatedSteps.length) {
      setCurrentStepIndex(updatedSteps.length - 1);
    }
    setSelectedFieldId(null);
  };

  const addField = (fieldType) => {
    const newField = {
      id: Date.now(),
      key_name: `field_${Date.now()}`,
      label: `New ${fieldType} Field`,
      help_text: "",
      field_type: fieldType,
      required: false,
      sort_order: steps[currentStepIndex].fields.length,
      config_json:
        fieldType === "select" || fieldType === "radio"
          ? JSON.stringify({ options: ["Option 1", "Option 2", "Option 3"] })
          : "{}",
      active: true,
    };

    const updatedSteps = [...steps];
    updatedSteps[currentStepIndex].fields.push(newField);
    setSteps(updatedSteps);
    setSelectedFieldId(newField.id);
  };

  const updateField = (id, updates) => {
    const updatedSteps = [...steps];
    updatedSteps[currentStepIndex].fields = updatedSteps[
      currentStepIndex
    ].fields.map((f) => (f.id === id ? { ...f, ...updates } : f));
    setSteps(updatedSteps);
  };

  const removeField = (id) => {
    const updatedSteps = [...steps];
    updatedSteps[currentStepIndex].fields = updatedSteps[
      currentStepIndex
    ].fields.filter((f) => f.id !== id);
    setSteps(updatedSteps);
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  const currentFields = steps[currentStepIndex]?.fields || [];
  const selectedField = currentFields.find((f) => f.id === selectedFieldId);

  // Parse config for select/radio options

  const safeParseConfig = (field) => {
    try {
      return JSON.parse(field.config_json || "{}");
    } catch {
      return {};
    }
  };

  const updateFieldConfig = (fieldId, patch) => {
    const field = currentFields.find((f) => f.id === fieldId);
    const currentConfig = field ? safeParseConfig(field) : {};
    const nextConfig = { ...currentConfig, ...patch };
    updateField(fieldId, { config_json: JSON.stringify(nextConfig) });
  };

  const getDynamicUrl = (field) => {
    const cfg = safeParseConfig(field);
    return cfg?.dynamicOptions?.url || "";
  };

  const isDynamicEnabled = (field) => {
    const cfg = safeParseConfig(field);
    return !!cfg?.dynamicOptions?.enabled;
  };

  const getFieldOptions = (field) => {
    try {
      const config = JSON.parse(field.config_json);
      return config.options || [];
    } catch {
      return [];
    }
  };

  const updateFieldOptions = (fieldId, options) => {
    const field = currentFields.find((f) => f.id === fieldId);
    const currentConfig = field ? safeParseConfig(field) : {};

    const nextConfig = {
      ...currentConfig,
      options, // update options only
    };

    updateField(fieldId, { config_json: JSON.stringify(nextConfig) });
  };

  const safeJsonParse = (val) => {
    if (!val) return {};
    if (typeof val === "object") return val;
    try {
      return JSON.parse(val);
    } catch {
      return {};
    }
  };

  // Converts config_json.options into a normalized options array
  // Supports:
  // - ["Option 1", "Option 2"]
  // - [{ label, value, is_default, sort_order }]
  const configToFieldOptions = (config_json) => {
    const cfg = safeJsonParse(config_json);
    const raw = Array.isArray(cfg.options) ? cfg.options : [];

    return raw
      .map((opt, idx) => {
        // string option
        if (typeof opt === "string") {
          return {
            label: opt,
            value: opt,
            is_default: false,
            sort_order: idx,
          };
        }

        // object option
        if (opt && typeof opt === "object") {
          return {
            label: String(opt.label ?? opt.value ?? `Option ${idx + 1}`),
            value: String(opt.value ?? opt.label ?? `Option ${idx + 1}`),
            is_default: !!opt.is_default,
            sort_order: opt.sort_order ?? idx,
          };
        }

        return null;
      })
      .filter(Boolean);
  };

  const buildCleanConfigJsonForPayload = (field) => {
    const cfg = safeJsonParse(field.config_json);

    const dynamicEnabled = !!cfg?.dynamicOptions?.enabled;
    if (!dynamicEnabled) {
      return JSON.stringify(cfg); // keep as-is
    }

    // Dynamic enabled: strip static options
    const { options, ...rest } = cfg; // remove options key
    return JSON.stringify(rest);
  };

  const handleSubmit = async () => {
    const payload = {
      ...formData,
      form_key: slugify(formData.title),
      steps: steps.map((step) => ({
        step_number: step.step_number,
        step_title: step.step_title,
        step_description: step.step_description ?? "",
        sort_order: step.sort_order ?? 0,
        is_active: step.is_active !== undefined ? !!step.is_active : true,
        fields: (step.fields || []).map((f) => {
          const cfg = safeJsonParse(f.config_json);
          const dynamicEnabled = !!cfg?.dynamicOptions?.enabled;

          // If dynamic enabled: don't send static options (anywhere)
          const options =
            !dynamicEnabled &&
            (f.field_type === "select" || f.field_type === "radio")
              ? configToFieldOptions(f.config_json)
              : [];

          const cleanConfigJson = dynamicEnabled
            ? buildCleanConfigJsonForPayload(f)
            : f.config_json;

          return {
            key_name: f.key_name,
            label: f.label,
            help_text: f.help_text ?? "",
            field_type: f.field_type,
            required: !!f.required,
            sort_order: f.sort_order ?? 0,
            active: f.active !== undefined ? !!f.active : true,

            // Cleaned config_json (options removed if dynamic is enabled)
            config_json: cleanConfigJson,

            // Options array also cleared if dynamic enabled
            options,
          };
        }),
      })),
    };

    const { form_id } = await dispatch(createForm(payload)).unwrap();

    console.log("Payload:", JSON.stringify(payload));

    alert("Form created successfully!");
    navigate(`/forms/${form_id}`);
    // IMPORTANT: unwrap returns { form_id }, not { formid }
    // Also: returning <Link/> inside an event handler does nothing.
    // Use navigate instead (shown below).
  };
  return (
    <Box minH="100vh" bg="gray.50" p={6}>
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="lg">Form Builder</Heading>
        <Stack direction="row" gap={3}>
          <Button variant="outline">Cancel</Button>
          <Button colorScheme="blue" onClick={handleSubmit}>
            Save Form
          </Button>
        </Stack>
      </Flex>

      {/* Top Section - Basic Information */}
      <Card.Root mb={4}>
        <Collapsible.Root open={isBasicInfoOpen}>
          <Card.Header
            cursor="pointer"
            onClick={() => setIsBasicInfoOpen(!isBasicInfoOpen)}
            _hover={{ bg: "gray.50" }}
            transition="background 0.2s"
          >
            <Flex justify="space-between" align="center">
              <Box mb={2}>
                <Heading size="md">Basic Information</Heading>
                <Text fontSize="sm" color="gray.600">
                  Form details and configuration
                </Text>
              </Box>
              <Box color="gray.500">
                {isBasicInfoOpen ? (
                  <FaChevronUp size={20} />
                ) : (
                  <FaChevronDown size={20} />
                )}
              </Box>
            </Flex>
          </Card.Header>
          <Collapsible.Content>
            <Card.Body>
              <Fieldset.Root>
                <Grid templateColumns="repeat(3, 1fr)" gap={4}>
                  <Field.Root>
                    <Field.Label>Form Title</Field.Label>
                    <Input
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      placeholder="Enter form title"
                    />
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>Status</Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({ ...formData, status: e.target.value })
                        }
                      >
                        <option value="Published">Published</option>
                        <option value="Draft">Draft</option>
                        <option value="Active">Active</option>
                        <option value="Archived">Archived</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Field.Root>
                </Grid>

                <Field.Root mt={4}>
                  <Field.Label>Description</Field.Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        description: e.target.value,
                      })
                    }
                    placeholder="Describe your form"
                    rows={2}
                  />
                </Field.Root>

                <Box borderTop="1px" borderColor="gray.200" pt={4} mt={4}>
                  <Fieldset.Legend fontSize="md" fontWeight="bold" mb={3}>
                    RPA Integration (Optional)
                  </Fieldset.Legend>
                  <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                    <Field.Root>
                      <Field.Label>Webhook URL</Field.Label>
                      <Input
                        value={formData.rpa_webhook_url}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            rpa_webhook_url: e.target.value,
                          })
                        }
                        placeholder="https://api.example.com/webhook"
                      />
                    </Field.Root>

                    <Field.Root>
                      <Field.Label>Secret Key</Field.Label>
                      <Input
                        type="text"
                        value={formData.rpa_secret}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            rpa_secret: e.target.value,
                          })
                        }
                        placeholder="Enter secret"
                      />
                    </Field.Root>

                    <GridItem colSpan={2}>
                      <Field.Root>
                        <Field.Label>Send Secret as:</Field.Label>
                        <RadioGroup.Root
                          defaultValue="header"
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              rpa_secret_method: e.target.value,
                            })
                          }
                        >
                          <Stack direction="row" gap={6}>
                            <RadioGroup.Item value="header">
                              <RadioGroup.ItemHiddenInput />
                              <RadioGroup.ItemIndicator />
                              <RadioGroup.ItemText>
                                Authorization Header
                              </RadioGroup.ItemText>
                            </RadioGroup.Item>
                            <RadioGroup.Item value="param">
                              <RadioGroup.ItemHiddenInput />
                              <RadioGroup.ItemIndicator />
                              <RadioGroup.ItemText>
                                Token Parameter
                              </RadioGroup.ItemText>
                            </RadioGroup.Item>
                          </Stack>
                        </RadioGroup.Root>
                      </Field.Root>
                    </GridItem>
                  </Grid>
                </Box>
              </Fieldset.Root>
            </Card.Body>
          </Collapsible.Content>
        </Collapsible.Root>
      </Card.Root>

      {/* Step Tabs */}
      <Card.Root mb={4}>
        <Card.Body>
          <Flex gap={2} align="center" overflowX="auto">
            {steps.map((step, index) => (
              <Button
                key={step.step_id}
                size="sm"
                variant={currentStepIndex === index ? "solid" : "outline"}
                colorScheme={currentStepIndex === index ? "blue" : "gray"}
                onClick={() => {
                  setCurrentStepIndex(index);
                  setSelectedFieldId(null);
                }}
                position="relative"
              >
                {step.step_title}
                {steps.length > 1 && (
                  <IconButton
                    size="xs"
                    variant="ghost"
                    position="absolute"
                    top="-8px"
                    right="-8px"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeStep(index);
                    }}
                  >
                    <FaTimes size={10} />
                  </IconButton>
                )}
              </Button>
            ))}
            <Button
              size="sm"
              leftIcon={<FaPlus />}
              variant="outline"
              colorScheme="green"
              onClick={addStep}
            >
              <FaPlus />
              Add Step
            </Button>
          </Flex>
        </Card.Body>
      </Card.Root>

      {/* Bottom Section - 3 Column Layout */}
      <Grid templateColumns="280px 1fr 320px" gap={6} h="calc(100vh - 500px)">
        {/* Left Panel - Field Toolbar */}
        <GridItem>
          <Card.Root h="full">
            <Card.Header>
              <Heading size="sm">Field Types</Heading>
              <Text fontSize="xs" color="gray.600">
                Click to add to canvas
              </Text>
            </Card.Header>
            <Card.Body overflowY="auto">
              <Stack gap={2}>
                {fieldTypeOptions.map((option) => (
                  <Button
                    key={option.type}
                    variant="outline"
                    size="sm"
                    onClick={() => addField(option.type)}
                    justifyContent="flex-start"
                    leftIcon={option.icon}
                  >
                    {option.icon}
                    {option.label}
                  </Button>
                ))}
              </Stack>
            </Card.Body>
          </Card.Root>
        </GridItem>

        {/* Middle Panel - Canvas */}
        <GridItem>
          <Card.Root h="full">
            <Card.Header>
              <Flex justify="space-between" align="center">
                <Box>
                  <Heading size="md">
                    {steps[currentStepIndex].step_title}
                  </Heading>
                  <Text color="gray.600" fontSize="sm">
                    {currentFields.length} field(s) added
                  </Text>
                </Box>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const newTitle = prompt(
                      "Step Title:",
                      steps[currentStepIndex].step_title
                    );
                    if (newTitle) {
                      updateStep(currentStepIndex, { step_title: newTitle });
                    }
                  }}
                >
                  Edit Step
                </Button>
              </Flex>
            </Card.Header>
            <Card.Body overflowY="auto">
              {currentFields.length === 0 ? (
                <Flex
                  align="center"
                  justify="center"
                  h="full"
                  direction="column"
                  color="gray.400"
                >
                  <Box fontSize="4xl" mb={2}>
                    📝
                  </Box>
                  <Text>No fields yet. Add fields from the left panel.</Text>
                </Flex>
              ) : (
                <Stack gap={3}>
                  {currentFields.map((field) => (
                    <Card.Root
                      key={field.id}
                      variant={
                        selectedFieldId === field.id ? "elevated" : "outline"
                      }
                      borderColor={
                        selectedFieldId === field.id ? "blue.500" : "gray.200"
                      }
                      borderWidth={selectedFieldId === field.id ? 2 : 1}
                      cursor="pointer"
                      onClick={() => setSelectedFieldId(field.id)}
                      _hover={{ borderColor: "blue.300" }}
                      transition="all 0.2s"
                    >
                      <Card.Body>
                        <Flex align="start" gap={3}>
                          <Box color="gray.400" mt={1}>
                            <FaGripVertical size={20} />
                          </Box>
                          <Box flex={1}>
                            <Flex justify="space-between" mb={2}>
                              <Box>
                                <Text fontWeight="bold">{field.label}</Text>
                                {field.help_text && (
                                  <Text fontSize="sm" color="gray.600">
                                    {field.help_text}
                                  </Text>
                                )}
                              </Box>
                              <Stack direction="row" gap={2}>
                                <Badge colorScheme="purple">
                                  {field.field_type}
                                </Badge>
                                {field.required && (
                                  <Badge colorScheme="red">Required</Badge>
                                )}
                              </Stack>
                            </Flex>

                            {/* Field Preview */}
                            {field.field_type === "select" ? (
                              <NativeSelect.Root size="sm" disabled>
                                <NativeSelect.Field>
                                  {getFieldOptions(field).map((opt, idx) => (
                                    <option key={idx}>{opt}</option>
                                  ))}
                                </NativeSelect.Field>
                              </NativeSelect.Root>
                            ) : field.field_type === "textarea" ? (
                              <Textarea
                                placeholder="Sample textarea"
                                size="sm"
                                rows={2}
                                disabled
                              />
                            ) : field.field_type === "radio" ? (
                              <RadioGroup.Root size="sm" disabled>
                                {getFieldOptions(field).map((opt, idx) => (
                                  <RadioGroup.Item key={idx} value={opt}>
                                    <RadioGroup.ItemHiddenInput />
                                    <RadioGroup.ItemIndicator />
                                    <RadioGroup.ItemText>
                                      {opt}
                                    </RadioGroup.ItemText>
                                  </RadioGroup.Item>
                                ))}
                              </RadioGroup.Root>
                            ) : (
                              <Input
                                placeholder={`Sample ${field.field_type} input`}
                                size="sm"
                                type={field.field_type}
                                disabled
                              />
                            )}
                          </Box>
                          <IconButton
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeField(field.id);
                            }}
                          >
                            <FaTrash size={16} />
                          </IconButton>
                        </Flex>
                      </Card.Body>
                    </Card.Root>
                  ))}
                </Stack>
              )}
            </Card.Body>
          </Card.Root>
        </GridItem>

        {/* Right Panel - Field Properties */}
        <GridItem>
          {selectedField ? (
            <Card.Root h="full">
              <Card.Header>
                <Heading size="sm">Field Properties</Heading>
                <Text fontSize="xs" color="gray.600">
                  Edit selected field
                </Text>
              </Card.Header>
              <Card.Body overflowY="auto">
                <Stack gap={4}>
                  <Field.Root>
                    <Field.Label>Field Label</Field.Label>
                    <Input
                      value={selectedField.label}
                      onChange={(e) =>
                        updateField(selectedField.id, {
                          label: e.target.value,
                        })
                      }
                    />
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>Key Name</Field.Label>
                    <Input
                      value={selectedField.key_name}
                      onChange={(e) =>
                        updateField(selectedField.id, {
                          key_name: e.target.value,
                        })
                      }
                    />
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>Help Text</Field.Label>
                    <Textarea
                      value={selectedField.help_text}
                      onChange={(e) =>
                        updateField(selectedField.id, {
                          help_text: e.target.value,
                        })
                      }
                      rows={2}
                    />
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>Field Type</Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        value={selectedField.field_type}
                        onChange={(e) =>
                          updateField(selectedField.id, {
                            field_type: e.target.value,
                          })
                        }
                      >
                        {fieldTypeOptions.map((opt) => (
                          <option key={opt.type} value={opt.type}>
                            {opt.label}
                          </option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Field.Root>

                  {/* Options Configuration for Select/Radio */}
                  {(selectedField.field_type === "select" ||
                    selectedField.field_type === "radio") && (
                    <Field.Root>
                      <Field.Label>Options</Field.Label>

                      <Stack gap={3}>
                        {/* Dynamic Options Section */}
                        <Box
                          p={3}
                          borderWidth="1px"
                          borderColor="gray.200"
                          borderRadius="md"
                        >
                          <Text fontSize="sm" fontWeight="bold" mb={2}>
                            Dynamic Options
                          </Text>

                          <Switch.Root
                            variant="solid"
                            checked={isDynamicEnabled(selectedField)}
                            onCheckedChange={(e) => {
                              updateFieldConfig(selectedField.id, {
                                dynamicOptions: {
                                  ...(safeParseConfig(selectedField)
                                    .dynamicOptions || {}),
                                  enabled: e.checked,
                                  url: getDynamicUrl(selectedField), // preserve
                                },
                              });
                            }}
                          >
                            <Switch.HiddenInput />
                            <Switch.Control />
                            <Switch.Label>Enable dynamic options</Switch.Label>
                          </Switch.Root>

                          <Field.Root mt={3}>
                            <Field.Label fontSize="sm">
                              Dynamic Options URL
                            </Field.Label>
                            <Input
                              size="sm"
                              placeholder="https://your-rpa-webhook/options"
                              value={getDynamicUrl(selectedField)}
                              onChange={(e) => {
                                const nextUrl = e.target.value;

                                updateFieldConfig(selectedField.id, {
                                  dynamicOptions: {
                                    ...(safeParseConfig(selectedField)
                                      .dynamicOptions || {}),
                                    enabled: true, // if they type a URL, assume they want it enabled
                                    url: nextUrl,
                                  },
                                });
                              }}
                              disabled={
                                !isDynamicEnabled(selectedField) &&
                                !getDynamicUrl(selectedField)
                              }
                            />
                            <Text fontSize="xs" color="gray.600" mt={1}>
                              Backend will fetch the options when submitting the
                              response
                            </Text>
                          </Field.Root>
                        </Box>
                        {/* Static Options Section */}
                        {!isDynamicEnabled(selectedField) && (
                          <Box
                            p={3}
                            borderWidth="1px"
                            borderColor="gray.200"
                            borderRadius="md"
                          >
                            <Text fontSize="sm" fontWeight="bold" mb={2}>
                              Static Options
                            </Text>

                            <Stack gap={2}>
                              {getFieldOptions(selectedField).map(
                                (option, idx) => (
                                  <Flex key={idx} gap={2}>
                                    <Input
                                      value={option}
                                      size="sm"
                                      onChange={(e) => {
                                        const newOptions = [
                                          ...getFieldOptions(selectedField),
                                        ];
                                        newOptions[idx] = e.target.value;
                                        updateFieldOptions(
                                          selectedField.id,
                                          newOptions
                                        );
                                      }}
                                    />
                                    <IconButton
                                      size="sm"
                                      variant="ghost"
                                      colorScheme="red"
                                      onClick={() => {
                                        const newOptions = getFieldOptions(
                                          selectedField
                                        ).filter((_, i) => i !== idx);
                                        updateFieldOptions(
                                          selectedField.id,
                                          newOptions
                                        );
                                      }}
                                    >
                                      <FaTimes size={12} />
                                    </IconButton>
                                  </Flex>
                                )
                              )}

                              <Button
                                size="sm"
                                leftIcon={<FaPlus />}
                                variant="outline"
                                onClick={() => {
                                  const newOptions = [
                                    ...getFieldOptions(selectedField),
                                    `Option ${
                                      getFieldOptions(selectedField).length + 1
                                    }`,
                                  ];
                                  updateFieldOptions(
                                    selectedField.id,
                                    newOptions
                                  );
                                }}
                              >
                                Add Option
                              </Button>
                            </Stack>
                          </Box>
                        )}
                      </Stack>
                    </Field.Root>
                  )}

                  <Field.Root>
                    <Switch.Root
                      variant="solid"
                      checked={selectedField.required}
                      onCheckedChange={(e) =>
                        updateField(selectedField.id, {
                          required: e.checked,
                        })
                      }
                    >
                      <Switch.HiddenInput />
                      <Switch.Control />
                      <Switch.Label>Required Field</Switch.Label>
                    </Switch.Root>
                  </Field.Root>

                  <Button
                    colorScheme="red"
                    variant="outline"
                    size="sm"
                    onClick={() => removeField(selectedField.id)}
                  >
                    Delete Field
                  </Button>
                </Stack>
              </Card.Body>
            </Card.Root>
          ) : (
            <Card.Root h="full">
              <Card.Body>
                <Flex
                  align="center"
                  justify="center"
                  h="full"
                  direction="column"
                  color="gray.400"
                >
                  <Box fontSize="3xl" mb={2}>
                    ⚙️
                  </Box>
                  <Text textAlign="center">
                    Select a field from the canvas to edit its properties
                  </Text>
                </Flex>
              </Card.Body>
            </Card.Root>
          )}
        </GridItem>
      </Grid>
    </Box>
  );
};

export default NewForm;
