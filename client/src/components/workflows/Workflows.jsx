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
import { FaSearch, FaTrash } from "react-icons/fa";
import { FaEye, FaPlus } from "react-icons/fa6";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";

import DataTable from "../DataTable";
import AppLoader from "../ui/AppLoader";
import AppError from "../ui/AppError";
import { usePagination } from "@/utils/pagination";

import { Can } from "@/auth/Can";
import { selectUser } from "@/features/auth/authSlice";

import { notify } from "@/components/ui/notifyStore";

import {
  fetchWorkflows,
  createWorkflow,
  createWorkflowRun,
  selectWorkflowTemplates,
  selectWorkflowLoading,
  selectWorkflowError,
  deleteWorkflow,
} from "@/features/workflows/workflowSlice";
import slugify from "@/utils/slug";

const Workflows = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const user = useSelector(selectUser);

  const workflows = useSelector(selectWorkflowTemplates);
  const loading = useSelector(selectWorkflowLoading("fetchWorkflows"));
  const error = useSelector(selectWorkflowError("fetchWorkflows"));

  const createWorkflowLoading = useSelector(
    selectWorkflowLoading("createWorkflow")
  );
  const createRunLoading = useSelector(selectWorkflowLoading("createRun"));

  const [searchTerm, setSearchTerm] = useState("");

  // ---- Create Workflow dialog state ----
  const [wfDialogOpen, setWfDialogOpen] = useState(false);
  const [wfTitle, setWfTitle] = useState("");
  const [wfKey, setWfKey] = useState("");
  const [wfDesc, setWfDesc] = useState("");

  const closeWfDialog = () => {
    setWfDialogOpen(false);
    setWfTitle("");
    setWfKey("");
    setWfDesc("");
  };

  // ---- Create Run dialog state (contextual) ----
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [displayName, setDisplayName] = useState("");

  const openCreateRun = (workflow) => {
    setSelectedWorkflow(workflow);
    setDisplayName("");
    setRunDialogOpen(true);
  };

  const closeRunDialog = () => {
    setRunDialogOpen(false);
    setSelectedWorkflow(null);
    setDisplayName("");
  };

  useEffect(() => {
    if (!user) return;
    dispatch(fetchWorkflows());
  }, [dispatch, user]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return workflows || [];
    return (workflows || []).filter((w) => {
      const hay = `${w.title || ""} ${w.workflow_key || ""} ${w.status || ""} ${
        w.description || ""
      }`.toLowerCase();
      return hay.includes(term);
    });
  }, [workflows, searchTerm]);

  const columns = [
    {
      key: "title",
      label: "Workflow",
      sortable: true,
      render: (value, row) => (
        <VStack align="start" spacing={0.5}>
          <Text fontWeight="bold">{value || "-"}</Text>
          <Text fontSize="sm" color="gray.600">
            {row.description || "-"}
          </Text>
        </VStack>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value) => (
        <Badge
          bgColor={String(value).toLowerCase() === "active" ? "green" : "gray"}
          color={"white"}
        >
          <Text>{value || "-"}</Text>
        </Badge>
      ),
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
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, row) => (
        <HStack spacing={0} width={28}>
          {/* Optional template detail view */}
          <IconButton
            size="sm"
            aria-label="View workflow"
            variant="ghost"
            color="green"
            onClick={() => navigate(`/workflows/${row.workflow_id}`)}
          >
            <FaEye size={16} />
          </IconButton>

          {/* Contextual Create Run */}
          <Can any={["workflows.run.create"]}>
            <IconButton
              size="sm"
              aria-label="Create run"
              variant="ghost"
              color="#2590ce"
              onClick={() => openCreateRun(row)}
            >
              <FaPlus size={16} />
            </IconButton>
          </Can>

          {/* Delete Workflow */}
          <Can any={["workflows.create"]}>
            <Dialog.Root>
              <Dialog.Trigger asChild>
                <IconButton
                  size="sm"
                  aria-label="Delete workflow"
                  variant="ghost"
                  color="red"
                >
                  <FaTrash size={16} />
                </IconButton>
              </Dialog.Trigger>

              <Dialog.Backdrop />
              <Dialog.Positioner>
                <Dialog.Content>
                  <Dialog.CloseTrigger />

                  <Dialog.Header>
                    <Dialog.Title>Delete Workflow Template</Dialog.Title>
                  </Dialog.Header>

                  <Dialog.Body>
                    Are you sure you want to delete this workflow template? This will also delete all associated runs.
                  </Dialog.Body>

                  <Dialog.Footer>
                    <Dialog.CloseTrigger asChild>
                    </Dialog.CloseTrigger>
                    <Button
                      size="sm"
                      bgColor="red"
                      color="white"
                      onClick={() => onDeleteWorkflow(row.workflow_id)}
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

  const { page, setPage, pageSize, totalItems, pageData } = usePagination(
    filtered,
    6
  );

  const onCreateWorkflow = async () => {
    const title = wfTitle.trim();
    if (!title) {
      notify({
        type: "warning",
        title: "Title required",
        message: "Give the workflow template a title.",
      });
      return;
    }

    const res = await dispatch(
      createWorkflow({
        title,
        workflow_key: wfKey.trim() || undefined,
        description: wfDesc.trim() || undefined,
      })
    );

    if (res?.meta?.requestStatus === "fulfilled") {
      notify({
        type: "success",
        title: "Workflow created",
        message: "Workflow template created successfully.",
      });
      closeWfDialog();
      // list is already upserted in slice, but refresh is cheap and keeps you honest
      dispatch(fetchWorkflows());
    } else {
      notify({
        type: "error",
        title: "Create failed",
        message: res?.payload?.message || "Unable to create workflow template.",
      });
    }
  };

  const onCreateRun = async () => {
    const wid = selectedWorkflow?.workflow_id;
    const name = displayName.trim();

    if (!wid) return;

    if (!name) {
      notify({
        type: "warning",
        title: "Display name required",
        message: "Give this run a display name (client/project/etc).",
      });
      return;
    }

    const res = await dispatch(
      createWorkflowRun({ workflow_id: wid, display_name: name })
    );

    if (res?.meta?.requestStatus === "fulfilled") {
      const runId = res?.payload?.run?.workflow_run_id;

      notify({
        type: "success",
        title: "Run created",
        message: "Workflow run created successfully.",
      });
      closeRunDialog();

      if (runId) navigate(`/workflows/runs/${runId}`);
    } else {
      notify({
        type: "error",
        title: "Create run failed",
        message: res?.payload?.message || "Unable to create workflow run.",
      });
    }
  };

  const onDeleteWorkflow = async (workflowId) => {
    const res = await dispatch(deleteWorkflow({ workflowId }));

    if (res?.meta?.requestStatus === "fulfilled") {
      notify({
        type: "success",
        title: "Deleted",
        message: "Workflow template deleted successfully.",
      });
    } else {
      notify({
        type: "error",
        title: "Delete failed",
        message: res?.payload?.message || "Unable to delete workflow template.",
      });
    }
  };

  if (loading) return <AppLoader />;
  if (error) return <AppError message={error?.message || error} />;

  return (
    <VStack spacing={6} align="stretch">
      <HStack>
        <Flex justify="space-between" align="center" gap={2} width="full">
          <Flex justify="space-around" align="center" gap={4}>
            <InputGroup startElement={<FaSearch />}>
              <Input
                placeholder="Search workflows by title/key..."
                value={searchTerm}
                width={96}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </InputGroup>
          </Flex>

          <HStack>
            <Button variant="outline" onClick={() => navigate("workflow-runs")}>
              View Runs
            </Button>

            <Can any={["workflows.create"]}>
              <Button
                bgColor="#2590ce"
                color="#fff"
                onClick={() => setWfDialogOpen(true)}
              >
                Create Workflow
              </Button>
            </Can>
          </HStack>
        </Flex>
      </HStack>

      <Can
        any={["workflows.read"]}
        fallback={<Text>You are not authorized to access workflows.</Text>}
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

      {/* ---------------- Create Workflow Dialog ---------------- */}
      <Dialog.Root
        open={wfDialogOpen}
        onOpenChange={(e) => setWfDialogOpen(e.open)}
      >
        <Dialog.Trigger asChild>
          <span style={{ display: "none" }} />
        </Dialog.Trigger>

        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content borderRadius="2xl">
            <Dialog.CloseTrigger onClick={closeWfDialog} />

            <Dialog.Header>
              <Dialog.Title>Create Workflow Template</Dialog.Title>
            </Dialog.Header>

            <Dialog.Body>
              <VStack align="stretch" spacing={3}>
                <Input
                  placeholder="Title (e.g. Client Onboarding)"
                  value={wfTitle}
                  onChange={(e) => {
                    setWfTitle(e.target.value);
                    setWfKey(slugify(e.target.value));
                  }}
                />
                <Input
                  placeholder="Key auto-generated"
                  value={wfKey}
                  disabled
                />
                <Input
                  placeholder="Description (optional)"
                  value={wfDesc}
                  onChange={(e) => setWfDesc(e.target.value)}
                />
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <HStack>
                <Button variant="outline" onClick={closeWfDialog}>
                  Cancel
                </Button>
                <Button
                  bgColor="#2590ce"
                  color="#fff"
                  onClick={onCreateWorkflow}
                  isLoading={createWorkflowLoading}
                >
                  Create
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* ---------------- Create Run Dialog (Contextual) ---------------- */}
      <Dialog.Root
        open={runDialogOpen}
        onOpenChange={(e) => setRunDialogOpen(e.open)}
      >
        <Dialog.Trigger asChild>
          <span style={{ display: "none" }} />
        </Dialog.Trigger>

        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content borderRadius="2xl">
            <Dialog.CloseTrigger onClick={closeRunDialog} />

            <Dialog.Header>
              <Dialog.Title>Create Workflow Run</Dialog.Title>
            </Dialog.Header>

            <Dialog.Body>
              <VStack align="stretch" spacing={3}>
                <Text>
                  <b>Workflow:</b> {selectedWorkflow?.title || "-"}
                </Text>

                <Input
                  placeholder="Display name (e.g. Client Onboarding for Acme Corp)"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <HStack>
                <Button variant="outline" onClick={closeRunDialog}>
                  Cancel
                </Button>
                <Button
                  bgColor="#2590ce"
                  color="#fff"
                  onClick={onCreateRun}
                  isLoading={createRunLoading}
                >
                  Create Run
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </VStack>
  );
};

export default Workflows;
