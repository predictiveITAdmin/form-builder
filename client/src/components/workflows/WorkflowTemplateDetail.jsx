import React, { useEffect, useMemo, useState } from "react";
import {
  VStack,
  HStack,
  Flex,
  Dialog,
  Text,
  Badge,
  Button,
  IconButton,
  Input,
  InputGroup,
  ButtonGroup,
  Pagination,
  Card,
  Splitter,
} from "@chakra-ui/react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams, Link as RouterLink } from "react-router-dom";
import { FaSearch } from "react-icons/fa";
import { FaEye, FaPlus } from "react-icons/fa6";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi";

import DataTable from "../DataTable";
import AppLoader from "../ui/AppLoader";
import AppError from "../ui/AppError";
import { usePagination } from "@/utils/pagination";

import { Can } from "@/auth/Can";
import { notify } from "@/components/ui/notifyStore";

import {
  getWorkflow,
  fetchWorkflowRuns,
  createWorkflowRun,
  selectWorkflowById,
  selectWorkflowRuns,
  selectWorkflowLoading,
  selectWorkflowError,
  fetchWorkflowAssignableForms,
  selectWorkflowAssignableForms,
} from "@/features/workflows/workflowSlice";

const statusColor = (status) => {
  const v = String(status || "").toLowerCase();
  if (v === "active") return "green";
  if (v === "inactive") return "gray";
  return "gray";
};

const runStatusColor = (status) => {
  const v = String(status || "").toLowerCase();
  if (v === "completed") return "green";
  if (v === "in_progress") return "blue";
  if (v === "cancelled") return "red";
  return "gray";
};

const safeDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
};

const WorkflowTemplateDetail = () => {
  const { workflowId } = useParams();
  const wid = Number(workflowId);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const workflow = useSelector(selectWorkflowById(wid));
  const runs = useSelector(selectWorkflowRuns);

  const wfLoading = useSelector(selectWorkflowLoading("getWorkflow"));
  const wfError = useSelector(selectWorkflowError("getWorkflow"));

  const runsLoading = useSelector(selectWorkflowLoading("fetchRuns"));
  const runsError = useSelector(selectWorkflowError("fetchRuns"));

  const createRunLoading = useSelector(selectWorkflowLoading("createRun"));

  const assignableForms = useSelector(selectWorkflowAssignableForms);
  const assignableFormsLoading = useSelector(
    selectWorkflowLoading("fetchAssignableForms")
  );
  const assignableFormsError = useSelector(
    selectWorkflowError("fetchAssignableForms")
  );

  const [searchTerm, setSearchTerm] = useState("");

  // Create Run dialog state
  const [runDialogOpen, setRunDialogOpen] = useState(false);

  const [manageFormsOpen, setManageFormsOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");

  const closeRunDialog = () => {
    setRunDialogOpen(false);
    setDisplayName("");
  };

  useEffect(() => {
    if (!Number.isFinite(wid)) return;

    dispatch(getWorkflow({ workflowId: wid }));
    dispatch(fetchWorkflowRuns({ workflow_id: wid }));
  }, [dispatch, wid]);

  useEffect(() => {
    if (!runDialogOpen /* replace with your manageFormsOpen */) return;
    dispatch(fetchWorkflowAssignableForms());
  }, [dispatch, manageFormsOpen]);

  const runsForThisWorkflow = useMemo(() => {
    const list = Array.isArray(runs) ? runs : [];
    return list.filter((r) => Number(r.workflow_id) === wid);
  }, [runs, wid]);

  const filteredRuns = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return runsForThisWorkflow;

    return runsForThisWorkflow.filter((r) => {
      const hay = `${r.workflow_title || ""} ${r.display_name || ""} ${
        r.status || ""
      } ${r.created_by_name || ""}`.toLowerCase();
      return hay.includes(term);
    });
  }, [runsForThisWorkflow, searchTerm]);

  const columns = [
    {
      key: "display_name",
      label: "Run / Client",
      sortable: true,
      render: (value, row) => (
        <VStack align="start" spacing={0.5}>
          <Text fontWeight="bold">{value || "-"}</Text>
          <Text fontSize="sm" color="gray.600">
            Run #{row.workflow_run_id} · Created {safeDate(row.created_at)}
          </Text>
        </VStack>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value) => (
        <Badge colorScheme={runStatusColor(value)} textTransform="capitalize">
          {String(value || "-").replaceAll("_", " ")}
        </Badge>
      ),
    },
    {
      key: "progress",
      label: "Required Progress",
      sortable: false,
      render: (_, row) => {
        const total = Number(row.required_total || 0);
        const done = Number(row.required_done || 0);
        return (
          <Text>
            {done} / {total}
          </Text>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, row) => (
        <HStack spacing={0}>
          <IconButton
            size="sm"
            aria-label="Open run"
            variant="ghost"
            color="green"
            onClick={() => navigate(`/workflows/runs/${row.workflow_run_id}`)}
          >
            <FaEye size={16} />
          </IconButton>
        </HStack>
      ),
    },
  ];

  const { page, setPage, pageSize, totalItems, pageData } = usePagination(
    filteredRuns,
    8
  );

  const onCreateRun = async () => {
    const name = displayName.trim();
    if (!name) {
      notify({
        type: "warning",
        title: "Display name required",
        message: "Give this run a display name (client/project/etc).",
      });
      return;
    }

    const res = await dispatch(
      createWorkflowRun({
        workflow_id: wid,
        display_name: name,
      })
    );

    if (res?.meta?.requestStatus === "fulfilled") {
      const runId = res?.payload?.run?.workflow_run_id;

      notify({
        type: "success",
        title: "Run created",
        message: "Workflow run created successfully.",
      });

      closeRunDialog();
      dispatch(fetchWorkflowRuns({ workflow_id: wid }));

      if (runId) navigate(`/workflows/runs/${runId}`);
    } else {
      notify({
        type: "error",
        title: "Create run failed",
        message: res?.payload?.message || "Unable to create workflow run.",
      });
    }
  };

  if (!Number.isFinite(wid))
    return <AppError message={`Invalid workflowId: ${workflowId}`} />;
  if (wfLoading) return <AppLoader />;
  if (wfError) return <AppError message={wfError?.message || wfError} />;

  // If workflow isn't in cache yet but load finished, treat as not found.
  if (!workflow) return <AppError message="Workflow not found" />;

  return (
    <VStack spacing={6} align="stretch">
      {/* Header */}
      <HStack justify="space-between" align="start">
        <VStack align="start" spacing={1}>
          <HStack wrap="wrap" spacing={3}>
            <Text fontSize="2xl" fontWeight="bold">
              {workflow.title || "Workflow"}
            </Text>

            <Badge colorScheme={statusColor(workflow.status)} variant="subtle">
              {workflow.status || "-"}
            </Badge>
          </HStack>

          <HStack wrap="wrap" spacing={4} color="gray.600">
            <Text>
              <b>Key:</b> {workflow.workflow_key || "-"}
            </Text>
            <Text>
              <b>ID:</b> {workflow.workflow_id}
            </Text>
            <Text>
              <b>Created:</b> {safeDate(workflow.created_at)}
            </Text>
            <Text>
              <b>Updated:</b> {safeDate(workflow.updated_at)}
            </Text>
          </HStack>

          {workflow.description ? (
            <Text color="gray.700" maxW="4xl">
              {workflow.description}
            </Text>
          ) : null}
        </VStack>

        <HStack>
          <Button as={RouterLink} to="/workflows" variant="outline">
            Back
          </Button>

          <Can any={["workflows.run.create"]}>
            <Button
              bgColor="#2590ce"
              color="#fff"
              leftIcon={<FaPlus />}
              onClick={() => setRunDialogOpen(true)}
            >
              Create Run
            </Button>
          </Can>
        </HStack>
      </HStack>

      {/* Two panels: left = template info / future builder, right = runs */}
      <Splitter.Root
        panels={[{ id: "template" }, { id: "runs" }]}
        borderWidth="1px"
        borderRadius="2xl"
        minH="60"
      >
        <Splitter.Panel id="template">
          <Card.Root variant="outline" border="0" borderRadius="0">
            <Card.Header pb={0}>
              <Text fontWeight="bold">Template Setup</Text>
            </Card.Header>
            <Card.Body>
              <VStack align="stretch" spacing={3}>
                <Text color="gray.600">
                  This is where workflow forms (required/optional,
                  allow_multiple, sort order) will live.
                </Text>

                <Text fontSize="sm" color="gray.600"></Text>

                <HStack>
                  <Button
                    variant="outline"
                    onClick={() => setManageFormsOpen(true)}
                  >
                    Manage Forms
                  </Button>
                </HStack>
              </VStack>
            </Card.Body>
          </Card.Root>
        </Splitter.Panel>

        <Splitter.ResizeTrigger disabled id="template:runs" />

        <Splitter.Panel id="runs">
          <Card.Root variant="outline" border="0" borderRadius="0">
            <Card.Header pb={0}>
              <HStack justify="space-between" align="center">
                <Text fontWeight="bold">Runs for this Workflow</Text>

                <Can any={["workflows.run.create"]}>
                  <Button
                    size="sm"
                    bgColor="#2590ce"
                    color="#fff"
                    onClick={() => setRunDialogOpen(true)}
                  >
                    Create Run
                  </Button>
                </Can>
              </HStack>
            </Card.Header>

            <Card.Body>
              <VStack align="stretch" spacing={4}>
                <InputGroup startElement={<FaSearch />}>
                  <Input
                    placeholder="Search runs by client/run name, status, creator..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </InputGroup>

                {runsLoading ? (
                  <AppLoader />
                ) : runsError ? (
                  <AppError message={runsError?.message || runsError} />
                ) : (
                  <DataTable columns={columns} data={pageData ?? []} />
                )}

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
                    mt={2}
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
            </Card.Body>
          </Card.Root>
        </Splitter.Panel>
      </Splitter.Root>

      {/* Create Run Dialog */}
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
                  <b>Workflow:</b> {workflow.title}
                </Text>

                <Input
                  placeholder="Display name (e.g. Client Onboarding for Acme Corp)"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />

                <Text fontSize="sm" color="gray.600">
                  This name is what users see everywhere (dashboard, tasks,
                  responses context).
                </Text>
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

export default WorkflowTemplateDetail;
