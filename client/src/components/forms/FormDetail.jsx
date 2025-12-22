import React, { useEffect, useState } from "react";
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
  HStack,
} from "@chakra-ui/react";
import { useParams } from "react-router";

const FormDetail = () => {
  const { formKey } = useParams();
  const [formData, setFormData] = useState(null);
  useEffect(() => {
    setFormData(data);
  }, [formKey]);
  const data = {
    steps: [
      {
        fields: [
          {
            label: "Name",
            active: true,
            options: [],
            field_id: 36,
            key_name: "field_1766159552980",
            required: true,
            help_text: "Enter your Name",
            field_type: "text",
            sort_order: 0,
            config_json: "{}",
          },
          {
            label: "New radio Field",
            active: true,
            options: [],
            field_id: 37,
            key_name: "field_1766159583724",
            required: false,
            help_text: "",
            field_type: "radio",
            sort_order: 2,
            config_json:
              '{"dynamicOptions":{"enabled":true,"url":"engine.rewst.io/options"}}',
          },
          {
            label: "New select Field",
            active: true,
            options: [],
            field_id: 38,
            key_name: "field_1766159616255",
            required: false,
            help_text: "",
            field_type: "select",
            sort_order: 3,
            config_json: '{"dynamicOptions":{"enabled":true,"url":""}}',
          },
        ],
        step_id: 16,
        is_active: true,
        sort_order: 0,
        step_title: "Basic Information",
        step_number: 1,
        step_description: "",
      },
      {
        fields: [
          {
            label: "New email Field",
            active: true,
            options: [],
            field_id: 39,
            key_name: "field_1766159632573",
            required: false,
            help_text: "",
            field_type: "email",
            sort_order: 0,
            config_json: "{}",
          },
          {
            label: "New date Field",
            active: true,
            options: [],
            field_id: 40,
            key_name: "field_1766159633040",
            required: false,
            help_text: "",
            field_type: "date",
            sort_order: 1,
            config_json: "{}",
          },
          {
            label: "New checkbox Field",
            active: true,
            options: [],
            field_id: 41,
            key_name: "field_1766159633421",
            required: false,
            help_text: "",
            field_type: "checkbox",
            sort_order: 2,
            config_json: "{}",
          },
          {
            label: "New textarea Field",
            active: true,
            options: [],
            field_id: 42,
            key_name: "field_1766159633754",
            required: false,
            help_text: "",
            field_type: "textarea",
            sort_order: 3,
            config_json: "{}",
          },
          {
            label: "New text Field",
            active: true,
            options: [],
            field_id: 43,
            key_name: "field_1766159634582",
            required: false,
            help_text: "",
            field_type: "text",
            sort_order: 4,
            config_json: "{}",
          },
        ],
        step_id: 17,
        is_active: true,
        sort_order: 1,
        step_title: "MSP Information",
        step_number: 2,
        step_description: "",
      },
      {
        fields: [],
        step_id: 18,
        is_active: true,
        sort_order: 2,
        step_title: "Step 3",
        step_number: 3,
        step_description: "",
      },
    ],
    title: "Kabir's Form",
    status: "Archived",
    form_id: 10,
    form_key: "kabirs-form",
    created_at: "2025-12-19T15:54:20.646",
    owner_name: "Bruce",
    updated_at: "2025-12-19T15:54:20.646",
    description: "This form was develeoped by Kabir",
    is_anonymous: false,
    owner_user_id: 13,
    rpa_timeout_ms: 8000,
    rpa_retry_count: 3,
    rpa_webhook_url: "https://emgomr.rewst.io/dinner/wjem/webhook/12sd12e",
  };

  const [currentStep, setCurrentStep] = useState(0);
  const [formValues, setFormValues] = useState[{}];

  const handleInputChange = (keyName, value) => {
    setFormValues((prev) => ({
      ...prev,
      [keyName]: value,
    }));
  };

  const renderField = (field) => {
    const commonProps = {
      value: formValues[field.key_name] || "",
      onChange: (e) => handleInputChange(field.key_name, e.target.value),
    };

    switch (field.field_type) {
      case "text":
        return (
          <Field.Root key={field.field_id} required={field.required}>
            <Field.Label>{field.label}</Field.Label>
            <Input {...commonProps} />
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );
      case "email":
        return (
          <Field.Root key={field.field_id} required={field.required}>
            <Field.Label>{field.label}</Field.Label>
            <Input {...commonProps} type="email" />
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );

      case "date":
        return (
          <Field.Root key={field.field_id} required={field.required}>
            <Field.Label>{field.label}</Field.Label>
            <Input {...commonProps} type="date" />
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );

      case "textarea":
        return (
          <Field.Root key={field.field_id} required={field.required}>
            <Field.Label>{field.label}</Field.Label>
            <Textarea {...commonProps} rows={4} />
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );

      case "checkbox":
        return (
          <Field.Root key={field.field_id}>
            <Checkbox
              checked={formValues[field.key_name] || false}
              onChange={(e) =>
                handleInputChange(field.key_name, e.target.checked)
              }
            >
              {field.label}
            </Checkbox>
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );

      case "radio":
        return (
          <Field.Root key={field.field_id} required={field.required}>
            <Field.Label>{field.label}</Field.Label>
            <Stack direction="column" gap={2}>
              <RadioGroup.Root defaultValue="1">
                <HStack gap="6">
                  {items.map((item) => (
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
        return (
          <Field.Root key={field.field_id} required={field.required}>
            <Field.Label>{field.label}</Field.Label>
            <NativeSelect {...commonProps}>
              <option value="">Select an option</option>
              <option value="option1">Option 1</option>
              <option value="option2">Option 2</option>
              <option value="option3">Option 3</option>
            </NativeSelect>
            {field.help_text && (
              <Field.HelperText>{field.help_text}</Field.HelperText>
            )}
          </Field.Root>
        );

      default:
        return null;
    }
  };

  const currentStepData = formData.steps[currentStep];
  const isLastStep = currentStep === formData.steps.length - 1;
  const isFirstStep = currentStep === 0;

  if (!formData) return <div> Form Not Found </div>;

  return (
    <Box minH="100vh" bg="gray.50" py={8}>
      <Container maxW="4xl">
        <Card.Root mb={6}>
          <Card.Header>
            <Stack gap={3}>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="start"
              >
                <Heading size="2xl">{formData.title}</Heading>
                <Badge
                  colorPalette={
                    formData.status === "Archived" ? "gray" : "green"
                  }
                >
                  {formData.status}
                </Badge>
              </Box>
              <Text color="gray.600">{formData.description}</Text>
              <Box display="flex" gap={4} fontSize="sm" color="gray.500">
                <Text>Owner: {formData.owner_name}</Text>
                <Text>Form Key: {formData.form_key}</Text>
              </Box>
            </Stack>
          </Card.Header>
        </Card.Root>

        <Card.Root>
          <Card.Header>
            <Stack gap={2}>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
              >
                <Heading size="lg">{currentStepData.step_title}</Heading>
                <Badge>
                  Step {currentStepData.step_number} of {formData.steps.length}
                </Badge>
              </Box>
              {currentStepData.step_description && (
                <Text color="gray.600">{currentStepData.step_description}</Text>
              )}
            </Stack>
          </Card.Header>

          <Card.Body>
            <Stack gap={6}>
              {currentStepData.fields.length > 0 ? (
                currentStepData.fields
                  .sort((a, b) => a.sort_order - b.sort_order)
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
                colorPalette="blue"
                onClick={() => {
                  if (isLastStep) {
                    console.log("Form submitted:", formValues);
                    alert("Form submitted successfully!");
                  } else {
                    setCurrentStep((prev) => prev + 1);
                  }
                }}
              >
                {isLastStep ? "Submit" : "Next"}
              </Button>
            </Box>
          </Card.Footer>
        </Card.Root>

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
