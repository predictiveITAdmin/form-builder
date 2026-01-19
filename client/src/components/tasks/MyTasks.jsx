// MyTasks.jsx
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
} from "@chakra-ui/react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { FaSearch } from "react-icons/fa";
import { FaEye } from "react-icons/fa6";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi";

import DataTable from "../DataTable";
import { usePagination } from "@/utils/pagination";
import AppLoader from "../ui/AppLoader";
import AppError from "../ui/AppError";

// NOTE: adjust these imports to match whatever you named them in workflowSlice.js
import {
  fetchMyWorkflowTasks, // thunk hitting GET /api/workflows/mytasks
  selectMyWorkflowTasks, // selector returning the array of items
  selectWorkflowLoading,
  selectWorkflowError,
} from "@/features/workflows/workflowSlice";

const deslugify = (status) => {
  const array = status.split("_");
  let updatedString = [];
  for (let i = 0; i < array.length; i++) {
    updatedString.push(array[i].charAt(0).toUpperCase() + array[i].slice(1));
  }
  return updatedString.join(" ");
};

const MyTasks = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const tasks = useSelector(selectMyWorkflowTasks) ?? [];
  const isLoading = useSelector(selectWorkflowLoading("fetchMyTasks"));
  const error = useSelector(selectWorkflowError("fetchMyTasks"));

  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    dispatch(fetchMyWorkflowTasks());
  }, [dispatch]);

  const filteredTasks = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return tasks;

    return (tasks || []).filter((t) => {
      const haystack = [t?.title, t?.display_name, t?.description, t?.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [tasks, searchTerm]);

  const columns = useMemo(
    () => [
      {
        key: "display_name",
        label: "Workflow",
        sortable: true,
        render: (value) => value || "-",
      },
      { key: "title", label: "Title", sortable: true, render: (v) => v || "-" },
      {
        key: "status",
        label: "Status",
        sortable: true,
        render: (value) => {
          const s = String(value || "").toLowerCase();

          // keep it consistent with your Forms badge style approach
          let color = "gray.700";
          let bg = "gray.100";

          if (["completed", "done", "submitted"].includes(s)) {
            color = "white";
            bg = "#94ca5c";
          } else if (["in_progress", "in progress", "started"].includes(s)) {
            color = "white";
            bg = "#2596be";
          } else if (["skipped"].includes(s)) {
            color = "white";
            bg = "orange.500";
          } else if (["cancelled", "canceled"].includes(s)) {
            color = "white";
            bg = "black";
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
              {deslugify(value) || "-"}
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
        key: "completed_at",
        label: "Completed",
        sortable: true,
        render: (value) => (value ? new Date(value).toLocaleDateString() : "-"),
      },
      {
        key: "description",
        label: "Description",
        sortable: false,
        render: (value) => {
          if (!value) return "-";
          const maxLength = 96;
          return value.length > maxLength
            ? `${value.substring(0, maxLength)}...`
            : value;
        },
      },
      {
        key: "actions",
        label: "Actions",
        sortable: false,
        render: (_, row) => {
          // Backend structure you gave doesn't explicitly show `form_key`,
          // but your route is /forms/:formkey, so we try common candidates.
          const formKey =
            row?.form_key ??
            row?.formkey ??
            row?.formKey ??
            row?.workflow_form_key ??
            row?.workflow_form_id ?? // fallback if your route accepts it
            row?.form_id;

          return (
            <HStack spacing={0} width={12}>
              <IconButton
                size="sm"
                aria-label="Open form"
                variant="ghost"
                color={"green"}
                onClick={() => navigate(`/forms/${formKey}`)}
                isDisabled={!formKey}
              >
                <FaEye size={16} />
              </IconButton>
            </HStack>
          );
        },
      },
    ],
    [navigate],
  );

  const { page, setPage, pageSize, totalItems, pageData } = usePagination(
    filteredTasks,
    5,
  );

  if (isLoading) return <AppLoader />;
  if (error) return <AppError message={error?.message || String(error)} />;

  return (
    <>
      {tasks.length < 1 ? (
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
            No tasks assigned
          </Text>

          <Text
            mt={2}
            maxW="md"
            fontSize="sm"
            color="gray.500"
            lineHeight="1.6"
          >
            When a workflow assigns you a workflow-only form, it’ll show up
            here.
          </Text>
        </Flex>
      ) : (
        <VStack spacing={6} align="stretch">
          <HStack>
            <Flex justify="space-between" align="center" gap={2} width="full">
              <Flex justify="space-around" align="center" gap={4}>
                <InputGroup startElement={<FaSearch />}>
                  <Input
                    placeholder="Search tasks by title, workflow, status..."
                    value={searchTerm}
                    width={96}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </InputGroup>
              </Flex>
            </Flex>
          </HStack>

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
      )}
    </>
  );
};

export default MyTasks;
