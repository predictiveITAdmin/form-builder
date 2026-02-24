import React, { useEffect, useMemo, useState } from "react";
import {
  Flex,
  VStack,
  HStack,
  Input,
  Text,
  Badge,
  IconButton,
  ButtonGroup,
  Pagination,
  InputGroup,
  Button,
  Dialog,
  Textarea,
  Field,
} from "@chakra-ui/react";
import { FaSearch, FaTrashAlt, FaEnvelope } from "react-icons/fa";
import { FaEye } from "react-icons/fa6";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import DataTable from "../DataTable";
import { usePagination } from "@/utils/pagination";
import AppLoader from "../ui/AppLoader";
import AppError from "../ui/AppError";
import { Can } from "@/auth/Can";
import { notify } from "../ui/notifyStore";
import { http } from "@/api/http";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { selectUser } from "@/features/auth/authSlice";

import {
  getResponses,
  selectResponseList,
  selectResponseListStatus,
  selectResponseListError,
  deleteResponse,
} from "@/features/responses/responseSlice";

const SendEmailDialog = ({ responseId, submitterName, senderName, defaultToEmail }) => {
  const [to, setTo] = useState(defaultToEmail || "");
  const [subject, setSubject] = useState("");
  const [salutation, setSalutation] = useState(
    submitterName ? `Dear ${submitterName},` : "Dear,"
  );
  const [message, setMessage] = useState("");
  const [regards, setRegards] = useState(
    `Best regards,\n${senderName || "Admin"}`
  );
  const [isSending, setIsSending] = useState(false);
  const [open, setOpen] = useState(false);

  // Sync state if defaultToEmail changes
  useEffect(() => {
    if (defaultToEmail && !to) {
      setTo(defaultToEmail);
    }
  }, [defaultToEmail]);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim() || !to.trim()) {
      notify({ type: "error", message: "To, Subject, and message are required." });
      return;
    }

    try {
      setIsSending(true);
      await http.post(`/api/responses/${responseId}/email`, {
        to,
        subject,
        salutation,
        message,
        regards,
      });
      notify({ type: "success", message: "Email dispatched successfully" });
      setOpen(false);
      setTo(defaultToEmail || "");
      setSubject("");
      setSalutation(submitterName ? `Dear ${submitterName},` : "Dear,");
      setMessage("");
      setRegards(`Best regards,\n${senderName || "Admin"}`);
    } catch (err) {
      notify({
        type: "error",
        message: err.response?.data?.error || "Failed to send email",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(e) => setOpen(e.open)}>
      <Dialog.Trigger asChild>
        <IconButton
          size="sm"
          aria-label="Send email"
          variant="ghost"
          color="blue.500"
        >
          <FaEnvelope size={16} />
        </IconButton>
      </Dialog.Trigger>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.CloseTrigger />
          <Dialog.Header>
            <Dialog.Title>Send Custom Email</Dialog.Title>
          </Dialog.Header>
           <Dialog.Body>
                      <VStack spacing={4} align="stretch" mt={2}>
                        <Text fontSize="sm" color="gray.600">
                          Send an email regarding this response.
                        </Text>
                        
                        <Field.Root>
                          <Field.Label>To</Field.Label>
                          <Input
                            placeholder="To (e.g. submitter@example.com)"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                          />
                        </Field.Root>

                        <Field.Root>
                          <Field.Label>Subject</Field.Label>
                          <Input
                            placeholder="Subject line..."
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                          />
                        </Field.Root>

                        <Field.Root>
                          <Field.Label>Salutation</Field.Label>
                          <Input
                            placeholder="Salutation (e.g. Dear John,)"
                            value={salutation}
                            onChange={(e) => setSalutation(e.target.value)}
                          />
                        </Field.Root>

                        <Field.Root>
                          <Field.Label>Message</Field.Label>
                          <ReactQuill
                            theme="snow"
                            value={message}
                            onChange={setMessage}
                            placeholder="Type your message here..."
                            style={{ height: "150px", marginBottom: "40px", width: "100%" }}
                          />
                        </Field.Root>

                        <Field.Root>
                          <Field.Label>Regards</Field.Label>
                          <Textarea
                            rows={3}
                            placeholder="Regards (e.g. Best regards, Admin)"
                            value={regards}
                            onChange={(e) => setRegards(e.target.value)}
                            p={2}
                          />
                        </Field.Root>
                      </VStack>
                    </Dialog.Body>
                    <Dialog.Footer>
                      <Dialog.CloseTrigger asChild>
                      </Dialog.CloseTrigger>
                      <Button
                        bgColor={"#2596be"}
                        onClick={handleSend}
                        loading={isSending}
                      >
                        Send Email
                      </Button>
                    </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};

const Responses = () => {
  const navigate = useNavigate();

  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const responseList = useSelector(selectResponseList);
  const responseListStatus = useSelector(selectResponseListStatus);
  const responseListError = useSelector(selectResponseListError);

  const handleDelete = async (responseId) => {
    try {
      await dispatch(deleteResponse(responseId)).unwrap();
      notify({ type: "success", message: "Response deleted successfully" });
      dispatch(getResponses());
    } catch (err) {
      notify({
        type: "error",
        message: err?.message || err?.error || "Failed to delete response",
      });
    }
  };

  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (responseListStatus === "idle") dispatch(getResponses());
  }, [dispatch, responseListStatus]);

  // The API might return { responses: [...] } or a raw array.
  const responses = useMemo(() => {
    if (!responseList) return [];
    if (Array.isArray(responseList)) return responseList;
    if (Array.isArray(responseList.responses)) return responseList.responses;
    return [];
  }, [responseList]);

  const filteredResponses = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return responses;

    return (responses || []).filter((r) => {
      const hay = [
        r.response_id,
        r.title,
        r.form_id,
        r.display_name,
        r.client_ip,
      ]
        .map((x) => String(x ?? "").toLowerCase())
        .join(" | ");
      return hay.includes(term);
    });
  }, [responses, searchTerm]);

  const columns = [
    { key: "title", label: "Form", sortable: true },
    {
      key: "display_name",
      label: "User",
      sortable: true,
      render: (v) => (v ? `${v}` : "-"),
    },
    {
      key: "submitted_at",
      label: "Submitted",
      sortable: true,
      render: (value) => (value ? new Date(value).toLocaleString() : "-"),
    },
    {
      key: "client_ip",
      label: "IP",
      sortable: true,
      render: (v) => (v ? v : "-"),
    },
    {
      key: "status",
      label: "Status",
      sortable: false,
      render: (_, row) => (
        <Badge
          bgColor={row.status === "Submitted" ? "green" : "gray"}
          color={"white"}
        >
          <Text>{row.status}</Text>
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, row) => (
        <HStack spacing={0} width={12}>
          <IconButton
            size="sm"
            aria-label="View response"
            variant="ghost"
            color={"green"}
            onClick={() => navigate(`/responses/${row.response_id}`)}
          >
            <FaEye size={16} />
          </IconButton>
          <Can any={["forms.create", "forms.update"]}>
            <SendEmailDialog
              responseId={row.response_id}
              submitterName={row.display_name}
              senderName={user?.display_name}
              defaultToEmail={row.email}
            />
          </Can>
          <Can any={["responses.delete"]}>
            <Dialog.Root>
              <Dialog.Trigger asChild>
                <IconButton
                  size="sm"
                  aria-label="Delete response"
                  variant="ghost"
                  color={"red"}
                >
                  <FaTrashAlt size={16} />
                </IconButton>
              </Dialog.Trigger>
              <Dialog.Backdrop />
              <Dialog.Positioner>
                <Dialog.Content>
                  <Dialog.CloseTrigger />
                  <Dialog.Header>
                    <Dialog.Title>Delete Response</Dialog.Title>
                  </Dialog.Header>
                  <Dialog.Body>
                    Are you sure you want to delete response #{row.response_id}?
                    <br />
                    <Text marginTop={4} fontSize="sm" color="red.700" fontWeight="medium">
                      This action will permanently delete this submission. This cannot be reversed.
                    </Text>
                  </Dialog.Body>
                  <Dialog.Footer>
                    <Dialog.CloseTrigger asChild>
                      <Button variant="outline" size="sm">Cancel</Button>
                    </Dialog.CloseTrigger>
                    <Button
                      size="sm"
                      bgColor="red"
                      color="white"
                      onClick={() => handleDelete(row.response_id)}
                    >
                      Delete Response
                    </Button>
                  </Dialog.Footer>
                </Dialog.Content>
              </Dialog.Positioner>
            </Dialog.Root>
          </Can>
        </HStack>
      ),
    },
  ];

  const { page, setPage, pageSize, totalItems, pageData } = usePagination(
    filteredResponses,
    8
  );

  if (responseListStatus === "loading") return <AppLoader />;
  if (responseListStatus === "failed")
    return <AppError message={responseListError || "Something broke"} />;

  return (
    <VStack spacing={6} align="stretch">

      <HStack>
        <Flex justify="space-between" align="center" gap={2} width="full">
          <Flex justify="space-around" align="center" gap={4}>
            <InputGroup startElement={<FaSearch />}>
              <Input
                placeholder="Search by response id, form, user, IP..."
                value={searchTerm}
                width={96}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </InputGroup>
          </Flex>
        </Flex>
      </HStack>

      {responseListStatus === "succeeded" && (pageData?.length ?? 0) === 0 && (
        <Text>No responses found.</Text>
      )}

      <DataTable columns={columns} data={pageData ?? []} />

      <Pagination.Root
        count={totalItems}
        pageSize={pageSize}
        page={page}
        onPageChange={(e) => setPage(e.page)}
      >
        <ButtonGroup
          variant="ghost"
          size="sm"
          justifyContent="flex-end"
          w="full"
          mt={3}
        >
          <Pagination.PrevTrigger asChild>
            <IconButton aria-label="Previous page">
              <HiChevronLeft />
            </IconButton>
          </Pagination.PrevTrigger>

          <Pagination.Items
            render={(p) => (
              <IconButton
                aria-label={`Page ${p.value}`}
                variant={p.value === page ? "outline" : "ghost"}
              >
                {p.value}
              </IconButton>
            )}
          />

          <Pagination.NextTrigger asChild>
            <IconButton aria-label="Next page">
              <HiChevronRight />
            </IconButton>
          </Pagination.NextTrigger>
        </ButtonGroup>
      </Pagination.Root>
    </VStack>
  );
};

export default Responses;
