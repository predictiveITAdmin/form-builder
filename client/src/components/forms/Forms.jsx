import React, { useEffect, useMemo, useState } from "react";
import {
  Flex,
  VStack,
  HStack,
  Input,
  Text,
  Badge,
  IconButton,
  Button,
  ButtonGroup,
  Pagination,
  InputGroup,
  Dialog,
} from "@chakra-ui/react";
import DataTable from "../DataTable";
import { FaRegEye, FaSearch, FaRegEdit, FaTrashAlt } from "react-icons/fa";
import { FaDeleteLeft, FaEye, FaPlus } from "react-icons/fa6";
import { Link, useNavigate } from "react-router-dom";
import { usePagination } from "@/utils/pagination";
import { useDispatch, useSelector } from "react-redux";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi";
import {
  fetchForms,
  selectForms,
  selectFormsStatus,
  selectFormsError,
  removeForm,
} from "../../features/forms/formsSlice";
import { Can } from "@/auth/Can";

import { selectUser } from "@/features/auth/authSlice";
import AppLoader from "../ui/AppLoader";
import AppError from "../ui/AppError";
import { notify } from "../ui/notifyStore";

const Forms = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const forms = useSelector(selectForms);
  const status = useSelector(selectFormsStatus);
  const error = useSelector(selectFormsError);
  const user = useSelector(selectUser);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!user) return;

    const hasNonReadPermission = user.permissions?.some(
      (p) => p.action !== "read" && p.resource === "forms",
    );

    setIsAdmin(!!hasNonReadPermission);
    dispatch(fetchForms(hasNonReadPermission));
  }, [dispatch, user]);

  const filteredForms = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return forms;
    return (forms || []).filter((form) =>
      String(form.title || "")
        .toLowerCase()
        .includes(term),
    );
  }, [forms, searchTerm]);

  const handleDelete = async (form_id) => {
    try {
      await dispatch(removeForm(form_id)).unwrap();
      notify({ type: "success", message: "Form Removed Successfully" });
    } catch (err) {
      notify({
        type: "error",
        message: `Failed to remove Form: ${err?.message || err}`,
      });
    }
  };

  const columns = useMemo(() => {
    const base = [
      { key: "title", label: "Title", sortable: true },
      {
        key: "status",
        label: "Status",
        sortable: true,
        render: (value) => {
          const status = String(value || "").toLowerCase();

          let color = "gray.700";
          let bg = "gray.100";

          if (status === "published") {
            color = "white";
            bg = "green.600";
          } else if (status === "cancelled") {
            color = "white";
            bg = "black";
          } else if (status === "draft") {
            color = "green.700";
            bg = "green.100";
          }

          return (
            <Badge
              px={2}
              py={1}
              borderRadius="md"
              bg={bg}
              color={color}
              textTransform="capitalize"
            >
              {value}
            </Badge>
          );
        },
      },
      {
        key: "created_at",
        label: "Created",
        sortable: true,
        render: (value) => (value ? new Date(value).toLocaleDateString() : "-"),
      },
      {
        key: "description",
        label: "Description",
        sortable: true,
        render: (value) => {
          if (!value) return "-";
          const maxLength = 96;
          return value.length > maxLength
            ? `${value.substring(0, maxLength)}...`
            : value;
        },
      },
      {
        key: "owner_name",
        label: "Owner",
        sortable: true,
        render: (value) => (value ? value : "-"),
      },
      {
        key: "actions",
        label: "Actions",
        sortable: false,
        render: (_, row) => (
          <HStack spacing={0} width={12}>
            <IconButton
              size="sm"
              aria-label="View"
              variant="ghost"
              color={"green"}
              onClick={() => navigate(`/forms/${row.form_key}`)}
            >
              <FaEye size={16} />
            </IconButton>

            <Can any={["forms.create", "forms.update", "forms.delete"]}>
              <IconButton
                size="sm"
                aria-label="Edit"
                variant="ghost"
                color={"#FFBF00"}
                onClick={() => navigate(`/forms/${row.form_key}/edit`)}
              >
                <FaRegEdit size={16} />
              </IconButton>
            </Can>

            {/* Delete */}
            <Can any={["forms.create", "forms.update", "forms.delete"]}>
              <Dialog.Root>
                <Dialog.Trigger asChild>
                  <IconButton
                    size="sm"
                    aria-label="Delete"
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
                      <Dialog.Title>Delete Form</Dialog.Title>
                    </Dialog.Header>

                    <Dialog.Body>
                      Are you sure you want to delete{" "}
                      <strong>{row.form_title || row.form_key}</strong>? This
                      action cannot be undone.
                      <br />
                      <Text
                        marginTop={4}
                        fontSize="sm"
                        color="red.700"
                        fontWeight="medium"
                      >
                        This will permanently remove all related responses, file
                        uploads, and remove the form from any workflows.{" "}
                        <strong>This cannot be reversed.</strong>
                      </Text>
                    </Dialog.Body>

                    <Dialog.Footer>
                      <Dialog.CloseTrigger asChild></Dialog.CloseTrigger>
                      <Button
                        size="sm"
                        bgColor="red"
                        color="white"
                        onClick={() => handleDelete(row.form_id)}
                      >
                        Delete
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

    if (!isAdmin) return base;

    const usageModeCol = {
      key: "usage_mode",
      label: "Usage Mode",
      sortable: true,
      render: (value) =>
        value === "workflow_only" ? "Workflow" : "Standalone",
    };

    const insertAfterKey = "status";
    const idx = base.findIndex((c) => c.key === insertAfterKey);
    if (idx === -1) return [...base, usageModeCol];
    return [...base.slice(0, idx + 1), usageModeCol, ...base.slice(idx + 1)];
  }, [isAdmin, navigate]);

  const { page, setPage, pageSize, totalItems, pageData } = usePagination(
    filteredForms,
    5,
  );

  if (status === "loading") return <AppLoader />;
  if (error) return <AppError message={error} />;

  return (
    <>
      {forms.length < 1 ? (
        <Flex
          direction="column"
          align="center"
          justify="center"
          py={12}
          px={6}
          bg="gray.50"
          border="1px dashed"
          borderColor="gray.300"
          borderRadius="lg"
          textAlign="center"
        >
          <Text fontSize="lg" fontWeight="500" color="gray.700">
            No forms available
          </Text>

          <Text
            mt={2}
            maxW="md"
            fontSize="sm"
            color="gray.500"
            lineHeight="1.6"
          >
            You don’t have any forms assigned to you yet.
            <br />
            If you believe this is a mistake, please reach out to your
            administrator to request access.
          </Text>
          <Can any={["forms.create"]}>
            <Link to="/forms/new">
              <Button
                leftIcon={<FaPlus size={20} />}
                color={"#fff"}
                bgColor={"#2590ce"}
              >
                <HStack>
                  <FaPlus />
                  New Form
                </HStack>
              </Button>
            </Link>
          </Can>
        </Flex>
      ) : (
        <VStack spacing={6} align="stretch">
          <HStack>
            <Flex justify="space-between" align="center" gap={2} width="full">
              <Flex justify="space-around" align="center" gap={4}>
                <InputGroup startElement={<FaSearch />}>
                  <Input
                    placeholder="Search forms by title..."
                    value={searchTerm}
                    width={96}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </InputGroup>
              </Flex>

              <Can any={["forms.create", "forms.update", "forms.delete"]}>
                <Link to="/forms/new">
                  <Button
                    leftIcon={<FaPlus size={20} />}
                    color={"#fff"}
                    bgColor={"#2590ce"}
                  >
                    <HStack>
                      <FaPlus />
                      New Form
                    </HStack>
                  </Button>
                </Link>
              </Can>
            </Flex>
          </HStack>

          {status === "loading" && <Text>Loading forms...</Text>}
          {status === "failed" && <Text color="red.500">{error}</Text>}
          <Can any={["forms.create", "forms.update", "forms.delete"]}>
            <Flex
              bg="purple.50"
              borderLeft="4px solid"
              borderColor="purple.400"
              borderRadius="md"
              p={4}
            >
              <VStack align="start" spacing={2}>
                <Text fontWeight="700" color="purple.800">
                  Admin Notice
                </Text>

                <Text fontSize="sm" color="purple.700">
                  You can manage forms here including creation, editing, and
                  access control.
                </Text>

                <Text fontSize="sm" color="purple.700">
                  <strong>Workflow-only</strong> forms are visible to admins and
                  become available to users under <em>My Tasks</em> when
                  assigned via workflows.
                </Text>

                <Text fontSize="sm" color="purple.700">
                  <strong>Standalone</strong> forms are accessible to users
                  directly and are intended for one-off requests outside
                  workflows.
                </Text>
                <Text fontSize="sm" color="purple.700">
                  Status of form should be <strong> Published </strong>for
                  accessibility among workflows and users
                </Text>
              </VStack>
            </Flex>
          </Can>
          <Can
            any={["forms.read"]}
            fallback={<Text>You are not authorized to access forms.</Text>}
          >
            <DataTable columns={columns} data={pageData ?? []} />
          </Can>
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
      )}
    </>
  );
};

export default Forms;
