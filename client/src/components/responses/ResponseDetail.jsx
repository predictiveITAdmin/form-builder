// ResponseDetail.jsx
import React, { useEffect, useMemo } from "react";
import {
  VStack,
  HStack,
  Box,
  Text,
  Badge,
  Button,
  SimpleGrid,
  Stack,
  Icon,
  Tag,
  Link as ChakraLink,
  Code,
  Card,
} from "@chakra-ui/react";
import { Link, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import {
  FaRegClock,
  FaUser,
  FaWpforms,
  FaGlobe,
  FaFileAlt,
} from "react-icons/fa";
import {
  MdEmail,
  MdPhone,
  MdLink,
  MdCheckCircle,
  MdCancel,
} from "react-icons/md";

import AppError from "../ui/AppError";
import AppLoader from "../ui/AppLoader";

import {
  getResponseById,
  selectResponse,
  selectResponseStatus,
  selectResponseError,
} from "@/features/responses/responseSlice";

const formatBytes = (bytes) => {
  if (bytes === null || bytes === undefined || Number.isNaN(Number(bytes)))
    return "-";
  const units = ["B", "KB", "MB", "GB"];
  let v = Number(bytes);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const tryParseJson = (text) => {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};

// Handles multiselect arrays + select/radio odd formats
const normalizeValueText = (valueText) => {
  const parsed = tryParseJson(valueText);

  if (Array.isArray(parsed)) return parsed;

  if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.values)) return parsed.values;
    if (parsed.value !== undefined) return parsed.value;
    if (parsed.label !== undefined) return parsed.label;
    return parsed;
  }

  return valueText;
};

const getTypedValue = (fv) => {
  if (fv?.value_text !== null && fv?.value_text !== undefined)
    return fv.value_text;
  if (fv?.value_number !== null && fv?.value_number !== undefined)
    return fv.value_number;
  if (fv?.value_date) return fv.value_date;
  if (fv?.value_datetime) return fv.value_datetime;
  if (fv?.value_bool !== null && fv?.value_bool !== undefined)
    return fv.value_bool;
  return null;
};

const FieldTypeBadge = ({ type }) => {
  const t = String(type || "unknown").toLowerCase();

  const scheme =
    t === "file"
      ? "purple"
      : t === "multiselect"
        ? "blue"
        : t === "select"
          ? "cyan"
          : t === "checkbox"
            ? "green"
            : t === "radio"
              ? "orange"
              : t === "email" || t === "url" || t === "tel"
                ? "teal"
                : "gray";

  return (
    <Badge
      bgColor={scheme}
      color={"white"}
      variant="subtle"
      textTransform="capitalize"
    >
      {t.replaceAll("_", " ")}
    </Badge>
  );
};

const RequiredBadge = ({ required }) => {
  if (!required) return null;
  return (
    <Badge bgColor="red" color={"white"} variant="subtle">
      Required
    </Badge>
  );
};

const ValueChips = ({ values }) => {
  if (!values || (Array.isArray(values) && values.length === 0)) {
    return <Text color="gray.500">-</Text>;
  }

  if (values && typeof values === "object" && !Array.isArray(values)) {
    return (
      <Code whiteSpace="pre-wrap" display="block" width="full">
        {JSON.stringify(values, null, 2)}
      </Code>
    );
  }

  if (!Array.isArray(values)) {
    return (
      <Tag.Root size="md" variant="subtle" bgColor="gray.100">
        <Tag.Label>{String(values)}</Tag.Label>
      </Tag.Root>
    );
  }

  return (
    <HStack spacing={2} wrap="wrap">
      {values.map((v, idx) => (
        <Tag.Root
          key={`${String(v)}-${idx}`}
          size="md"
          variant="subtle"
          bgColor="gray.200"
        >
          <Tag.Label>{String(v)}</Tag.Label>
        </Tag.Root>
      ))}
    </HStack>
  );
};

const renderFieldValue = ({ field, filesById }) => {
  const type = String(field.field_type || "unknown").toLowerCase();
  const raw = getTypedValue(field);

  if (raw === null || raw === undefined || raw === "") {
    return <Text color="gray.500">-</Text>;
  }

  if (type === "checkbox") {
    const yes = Boolean(field.value_bool);
    return (
      <HStack spacing={2}>
        <Icon
          as={yes ? MdCheckCircle : MdCancel}
          color={yes ? "green.400" : "red.400"}
        />
        <Text fontWeight="semibold">{yes ? "Checked" : "Unchecked"}</Text>
      </HStack>
    );
  }

  if (type === "date") {
    return <Text fontWeight="semibold">{String(field.value_date ?? raw)}</Text>;
  }

  if (type === "datetime") {
    const d = new Date(field.value_datetime ?? raw);
    return (
      <Text fontWeight="semibold">
        {Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleString()}
      </Text>
    );
  }

  if (type === "email") {
    return (
      <HStack spacing={2}>
        <Icon as={MdEmail} color="teal.500" />
        <ChakraLink
          href={`mailto:${String(raw)}`}
          color="teal.600"
          fontWeight="semibold"
        >
          {String(raw)}
        </ChakraLink>
      </HStack>
    );
  }

  if (type === "tel") {
    return (
      <HStack spacing={2}>
        <Icon as={MdPhone} color="teal.500" />
        <ChakraLink
          href={`tel:${String(raw)}`}
          color="teal.600"
          fontWeight="semibold"
        >
          {String(raw)}
        </ChakraLink>
      </HStack>
    );
  }

  if (type === "url") {
    const url = String(raw);
    return (
      <HStack spacing={2}>
        <Icon as={MdLink} color="teal.500" />
        <ChakraLink
          href={url}
          target="_blank"
          rel="noreferrer"
          color="teal.600"
          fontWeight="semibold"
        >
          {url}
        </ChakraLink>
      </HStack>
    );
  }

  // file upload: value_text = {"files":[...]}
  if (type === "file") {
    const parsed = typeof raw === "string" ? tryParseJson(raw) : raw;
    const files = parsed?.files || [];
    if (!Array.isArray(files) || files.length === 0)
      return <Text color="gray.500">-</Text>;

    return (
      <VStack align="stretch" spacing={3}>
        {files.map((f) => {
          // Backend may or may not send this yet: keep preview conditional
          const href = filesById?.[f.file_id]?.blob_url || null;

          return (
            <Card.Root key={f.file_id} variant="outline" borderRadius="xl">
              <Card.Body>
                <HStack justify="space-between" align="start">
                  <HStack spacing={3} align="start">
                    <Icon as={FaFileAlt} color="purple.500" mt={1} />
                    <VStack spacing={1} align="start">
                      <Text fontWeight="bold">{f.original_name}</Text>
                      <HStack gap={2} wrap="wrap">
                        <Badge variant="subtle">{f.mime_type}</Badge>
                        <Badge variant="outline">
                          {formatBytes(f.size_bytes)}
                        </Badge>
                        <Badge
                          variant="outline"
                          bgColor="purple"
                          color={"white"}
                        >
                          {f.file_id}
                        </Badge>
                      </HStack>
                    </VStack>
                  </HStack>

                  {href ? (
                    <Button
                      as={ChakraLink}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      size="sm"
                      bgColor="purple"
                    >
                      Preview
                    </Button>
                  ) : (
                    <Badge bgColor="gray" color={"white"} variant="subtle">
                      No preview
                    </Badge>
                  )}
                </HStack>
              </Card.Body>
            </Card.Root>
          );
        })}
      </VStack>
    );
  }

  // multiselect/select/radio stored in value_text (string or JSON)
  if (type === "multiselect" || type === "select" || type === "radio") {
    const normalized = typeof raw === "string" ? normalizeValueText(raw) : raw;
    return <ValueChips values={normalized} />;
  }

  if (type === "number") {
    return (
      <Text fontWeight="semibold">{String(field.value_number ?? raw)}</Text>
    );
  }

  if (typeof raw === "string" && raw.length > 180) {
    return (
      <Box bg="gray.50" borderWidth="1px" rounded="md" p={3}>
        <Text whiteSpace="pre-wrap">{raw}</Text>
      </Box>
    );
  }

  return <Text fontWeight="semibold">{String(raw)}</Text>;
};

const safeDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
};

const statusColor = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "completed" || s === "submitted") return "green";
  if (s === "pending") return "yellow";
  if (s === "expired" || s === "failed") return "red";
  return "gray";
};

const normalizeResponseValuesToList = (responseValues) => {
  if (!responseValues) return [];

  // If backend returns an array: [{key, ...fieldProps}] or [{field_key, ...}]
  if (Array.isArray(responseValues)) {
    return responseValues
      .map((item, idx) => {
        const key = item?.key || item?.field_key || item?.id || `row_${idx}`;
        return { key, field: item };
      })
      .sort((a, b) => {
        const la = a.field?.label || "";
        const lb = b.field?.label || "";
        const byLabel = la.localeCompare(lb);
        if (byLabel !== 0) return byLabel;
        const ta = String(a.field?.field_type || "");
        const tb = String(b.field?.field_type || "");
        const byType = ta.localeCompare(tb);
        if (byType !== 0) return byType;
        return a.key.localeCompare(b.key);
      });
  }

  // If backend returns an object map: { field_key: { ...fieldProps } }
  if (typeof responseValues === "object") {
    return Object.entries(responseValues)
      .map(([key, field]) => ({ key, field }))
      .sort((a, b) => {
        const la = a.field?.label || "";
        const lb = b.field?.label || "";
        const byLabel = la.localeCompare(lb);
        if (byLabel !== 0) return byLabel;
        const ta = String(a.field?.field_type || "");
        const tb = String(b.field?.field_type || "");
        const byType = ta.localeCompare(tb);
        if (byType !== 0) return byType;
        return a.key.localeCompare(b.key);
      });
  }

  return [];
};

const ResponseDetail = () => {
  const { responseId } = useParams();
  const rid = Number(responseId);

  const dispatch = useDispatch();
  const payload = useSelector(selectResponse);
  const status = useSelector(selectResponseStatus);
  const error = useSelector(selectResponseError);

  useEffect(() => {
    if (!Number.isFinite(rid)) return;
    dispatch(getResponseById(rid));
  }, [dispatch, rid]);

  const metaObj = useMemo(() => {
    if (!payload?.meta_json) return null;
    if (typeof payload.meta_json === "object") return payload.meta_json;
    const parsed = tryParseJson(payload.meta_json);
    return parsed ?? payload.meta_json;
  }, [payload?.meta_json]);

  const responseValuesList = useMemo(() => {
    return normalizeResponseValuesToList(payload?.response_values);
  }, [payload?.response_values]);

  // IMPORTANT: keep this empty unless backend provides it.
  // This is what your Preview button keys off of.
  const filesById = useMemo(() => {
    return (
      payload?.filesById ||
      payload?.files_by_id ||
      payload?.files_by_id_map ||
      {}
    );
  }, [payload]);

  if (!Number.isFinite(rid)) {
    return <AppError message={`Invalid response id: ${responseId}`} />;
  }

  if (status === "loading" || status === "idle") return <AppLoader />;

  if (status === "failed") {
    return <AppError message={error || `Response #${responseId} not found`} />;
  }

  if (!payload || payload.response_id !== rid) {
    return <AppError message={`Response #${responseId} not found`} />;
  }

  return (
    <VStack spacing={5} align="stretch">
      {/* Header */}
      <HStack justify="space-between" align="start">
        <VStack spacing={1} align="start">
          <HStack spacing={3} wrap="wrap">
            <Text fontSize="2xl" fontWeight="bold">
              Response #{payload.response_id}
            </Text>

            <Badge
              bgColor={statusColor(payload.status)}
              color={"white"}
              variant="subtle"
            >
              {payload.status || "Unknown"}
            </Badge>

            <Badge
              bgColor={payload.is_active ? "green" : "gray"}
              color={"white"}
              variant="outline"
            >
              {payload.is_active ? "Active" : "Inactive"}
            </Badge>
          </HStack>

          <HStack spacing={3} wrap="wrap" color="gray.600">
            <HStack spacing={2}>
              <Icon as={FaWpforms} />
              <Text>
                {payload.title || "-"}{" "}
                <Text as="span" color="gray.400">
                  ({payload.form_key || `form_${payload.form_id}`})
                </Text>
              </Text>
            </HStack>

            <HStack spacing={2}>
              <Icon as={FaUser} />
              <Text>
                {payload.display_name || "-"}{" "}
                <Text as="span" color="gray.400">
                  (#{payload.user_id || "-"} · {payload.user_type || "-"})
                </Text>
              </Text>
            </HStack>

            <HStack spacing={2}>
              <Icon as={FaRegClock} />
              <Text>{safeDate(payload.submitted_at)}</Text>
            </HStack>
          </HStack>
        </VStack>

        <Button as={Link} to="/responses" variant="outline">
          Back
        </Button>
      </HStack>

      {/* Summary cards */}
      <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
        <Card.Root variant="outline" borderRadius="2xl">
          <Card.Header pb={0}>
            <HStack spacing={2}>
              <Icon as={FaGlobe} />
              <Text fontWeight="bold">Request</Text>
            </HStack>
          </Card.Header>
          <Card.Body>
            <VStack align="start" spacing={1}>
              <Text>
                <b>IP:</b> {payload.response_client_ip || "-"}
              </Text>
              <Text noOfLines={2}>
                <b>User Agent:</b> {payload.response_user_agent || "-"}
              </Text>
              <Text>
                <b>Status:</b> {payload.status || "-"}
              </Text>
            </VStack>
          </Card.Body>
        </Card.Root>

        <Card.Root variant="outline" borderRadius="2xl">
          <Card.Header pb={0}>
            <Text fontWeight="bold">Session</Text>
          </Card.Header>
          <Card.Body>
            <VStack align="start" spacing={1}>
              <Text>
                <b>Session ID:</b> {payload.session_id ?? "-"}
              </Text>
              <Text>
                <b>Progress:</b> {payload.current_step ?? "-"} /{" "}
                {payload.total_steps ?? "-"}
              </Text>
              <Text>
                <b>Started:</b> {safeDate(payload.session_started_at)}
              </Text>
              <Text>
                <b>Updated:</b> {safeDate(payload.session_updated_at)}
              </Text>
              <Text>
                <b>Expires:</b> {safeDate(payload.expires_at)}
              </Text>
            </VStack>
          </Card.Body>
        </Card.Root>

        <Card.Root variant="outline" borderRadius="2xl">
          <Card.Header pb={0}>
            <Text fontWeight="bold">Meta</Text>
          </Card.Header>
          <Card.Body>
            {metaObj ? (
              <Code whiteSpace="pre-wrap" display="block" width="full">
                {typeof metaObj === "string"
                  ? metaObj
                  : JSON.stringify(metaObj, null, 2)}
              </Code>
            ) : (
              <Text color="gray.500">-</Text>
            )}

            {payload.rpa_webhook_url ? (
              <Box mt={3}>
                <Text fontSize="sm" color="gray.600">
                  <b>RPA Webhook</b>
                </Text>

                <Text maxWidth={"100%"} truncate color={"teal.600"}>
                  {payload.rpa_webhook_url && "Enabled"}
                </Text>
              </Box>
            ) : null}
          </Card.Body>
        </Card.Root>
      </SimpleGrid>

      {/* Values */}
      <Card.Root variant="outline" borderRadius="2xl">
        <Card.Header>
          <Text fontSize="lg" fontWeight="bold">
            Response Values
          </Text>
          <Text color="gray.600" fontSize="sm">
            {payload.description}
          </Text>
        </Card.Header>

        <Card.Body>
          <Stack
            spacing={4}
            divider={<Box borderBottomWidth="1px" borderColor="gray.100" />}
          >
            {responseValuesList.map(({ key, field }) => {
              const label = field?.label || key;
              const type = field?.field_type || "unknown";
              const required = Boolean(field?.required);

              return (
                <HStack
                  key={key}
                  justify="space-between"
                  align="start"
                  spacing={6}
                >
                  <VStack
                    align="start"
                    spacing={2}
                    minW={{ base: "40%", md: "30%" }}
                  >
                    <HStack spacing={2} wrap="wrap">
                      <Text fontWeight="bold">{label}</Text>
                      <RequiredBadge required={required} />
                    </HStack>

                    <HStack spacing={2} wrap="wrap">
                      <FieldTypeBadge type={type} />
                      {field?.form_field_id ? (
                        <Badge variant="outline">
                          Field ID: {field.form_field_id}
                        </Badge>
                      ) : null}
                    </HStack>
                  </VStack>

                  <Box flex="1">{renderFieldValue({ field, filesById })}</Box>
                </HStack>
              );
            })}
          </Stack>
        </Card.Body>
      </Card.Root>
    </VStack>
  );
};

export default ResponseDetail;
