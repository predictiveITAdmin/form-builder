import React, { useEffect, useMemo, useState } from "react";
import {
  VStack,
  HStack,
  Flex,
  Input,
  Text,
  Badge,
  IconButton,
  Button,
  ButtonGroup,
  Pagination,
  InputGroup,
  Dialog,
  Portal,
  Select,
  createListCollection,
} from "@chakra-ui/react";
import { FaSearch } from "react-icons/fa";
import { FaEye, FaPlus } from "react-icons/fa6";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import DataTable from "../DataTable";
import AppLoader from "../ui/AppLoader";
import AppError from "../ui/AppError";
import { usePagination } from "@/utils/pagination";
import { Can } from "@/auth/Can";
import { selectUser } from "@/features/auth/authSlice";

import { notify } from "@/components/ui/notifyStore";

import {
  fetchWorkflowRuns,
  fetchWorkflows,
  createWorkflowRun,
  selectWorkflowRuns,
  selectWorkflowTemplates,
  selectWorkflowLoading,
  selectWorkflowError,
} from "@/features/workflows/workflowSlice";

const statusColor = (status) => {
  switch (status) {
    case "completed":
      return "green";
    case "in_progress":
      return "blue";
    case "cancelled":
      return "red";
    case "not_started":
    default:
      return "gray";
  }
};

const WorkflowRuns = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser);

  const runs = useSelector(selectWorkflowRuns);
  const workflows = useSelector(selectWorkflowTemplates);

  const runsLoading = useSelector(selectWorkflowLoading("fetchRuns"));
  const runsError = useSelector(selectWorkflowError("fetchRuns"));

  const workflowsLoading = useSelector(selectWorkflowLoading("fetchWorkflows"));

  const createLoading = useSelector(selectWorkflowLoading("createRun"));

  const [searchTerm, setSearchTerm] = useState("");

  // Dialog state
  const [open, setOpen] = useState(false);
  const [workflowId, setWorkflowId] = useState("");
  const [displayName, setDisplayName] = useState("");

  const closeDialog = () => {
    setOpen(false);
    setWorkflowId("");
    setDisplayName("");
  };

  useEffect(() => {
    if (!user) return;

    // If your auth slice exposes admin another way, swap this.
    // This just ensures non-admins see only their runs.
    const isAdmin =
      Boolean(user?.isAdmin) ||
      Boolean(user?.role_code === "ADMIN") ||
      Boolean(user?.role_code === "SUPER_ADMIN");

    dispatch(fetchWorkflowRuns({ mine: !isAdmin }));
  }, [dispatch, user]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return runs || [];

    return (runs || []).filter((r) =>
      [r.workflow_title, r.display_name, r.status, r.created_by_name]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [runs, searchTerm]);

  const columns = [
    { key: "workflow_title", label: "Workflow", sortable: true },
    { key: "display_name", label: "Run / Client", sortable: true },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value) => (
        <Badge bgColor={statusColor(value)} textTransform="capitalize">
          {String(value || "-").replaceAll("_", " ")}
        </Badge>
      ),
    },
    {
      key: "progress",
      label: "Progress",
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
        <IconButton
          size="sm"
          aria-label="View run"
          variant="ghost"
          color="green"
          onClick={() => navigate(`/workflows/runs/${row.workflow_run_id}`)}
        >
          <FaEye size={16} />
        </IconButton>
      ),
    },
  ];

  const { page, setPage, pageSize, totalItems, pageData } = usePagination(
    filtered,
    8,
  );

  const onOpenCreate = async () => {
    // load templates for the dropdown if not loaded yet
    if (!workflows || workflows.length === 0) {
      await dispatch(fetchWorkflows());
    }
    setOpen(true);
  };

  const onCreate = async () => {
    const wid = Number(workflowId);
    const name = displayName.trim();

    if (!wid) {
      notify({
        type: "warning",
        title: "Workflow required",
        message: "Pick a workflow template.",
      });
      return;
    }
    if (!name) {
      notify({
        type: "warning",
        title: "Display name required",
        message: "Give this run a name (client, project, whatever).",
      });
      return;
    }

    const res = await dispatch(
      createWorkflowRun({ workflow_id: wid, display_name: name }),
    );

    if (res?.meta?.requestStatus === "fulfilled") {
      const runId = res?.payload?.run?.workflow_run_id;

      notify({
        type: "success",
        title: "Run created",
        message: "Workflow run created successfully.",
      });
      closeDialog();

      if (runId) navigate(`/workflows/runs/${runId}`);
      else dispatch(fetchWorkflowRuns()); // fallback refresh
    } else {
      notify({
        type: "error",
        title: "Create run failed",
        message: res?.payload?.message || "Unable to create workflow run.",
      });
    }
  };

  const workflowCollection = useMemo(() => {
    return createListCollection({
      items: (workflows || []).map((w) => ({
        label: w.title,
        value: String(w.workflow_id),
      })),
    });
  }, [workflows]);

  if (runsLoading) return <AppLoader />;
  if (runsError) return <AppError message={runsError?.message || runsError} />;

  return (
    <VStack spacing={6} align="stretch">
      <HStack>
        <Flex justify="space-between" align="center" width="full" gap={3}>
          <InputGroup startElement={<FaSearch />}>
            <Input
              placeholder="Search workflow runs..."
              value={searchTerm}
              width={96}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>

          <HStack>
            <Button variant="outline" onClick={() => navigate("/workflows")}>
              View Workflows
            </Button>

            <Can any={["workflows.run.create"]}>
              <Button
                bgColor="#2590ce"
                color="#fff"
                leftIcon={<FaPlus />}
                onClick={onOpenCreate}
              >
                Create Run
              </Button>
            </Can>
          </HStack>
        </Flex>
      </HStack>

      <Can
        any={["workflows.run.list"]}
        fallback={<Text>You are not authorized to view workflow runs.</Text>}
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

      {/* Create Run Dialog */}
      <Dialog.Root open={open} onOpenChange={(e) => setOpen(e.open)}>
        <Dialog.Trigger asChild>
          <span style={{ display: "none" }} />
        </Dialog.Trigger>

        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content borderRadius="2xl">
            <Dialog.CloseTrigger onClick={closeDialog} />

            <Dialog.Header>
              <Dialog.Title>Create Workflow Run</Dialog.Title>
            </Dialog.Header>

            <Dialog.Body>
              <VStack align="stretch" spacing={3}>
                <Text fontSize="sm" color="gray.600">
                  Pick a workflow template, then name this run
                  (client/project/etc).
                </Text>

                <Select.Root
                  collection={workflowCollection}
                  size="sm"
                  width="100%"
                  value={workflowId ? [String(workflowId)] : []}
                  onValueChange={(details) => {
                    const next = details?.value?.[0] ?? "";
                    setWorkflowId(next);
                  }}
                  disabled={workflowsLoading}
                >
                  <Select.HiddenSelect />

                  <Select.Label>Workflow</Select.Label>

                  <Select.Control>
                    <Select.Trigger>
                      <Select.ValueText
                        placeholder={
                          workflowsLoading
                            ? "Loading workflows..."
                            : "Select workflow"
                        }
                      />
                    </Select.Trigger>

                    <Select.IndicatorGroup>
                      <Select.Indicator />
                      {/* Optional: allow clearing */}
                      <Select.ClearTrigger />
                    </Select.IndicatorGroup>
                  </Select.Control>

                  <Portal>
                    <Select.Positioner>
                      <Select.Content>
                        {workflowCollection.items.map((wf) => (
                          <Select.Item item={wf} key={wf.value}>
                            {wf.label}
                            <Select.ItemIndicator />
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Portal>
                </Select.Root>

                <Input
                  placeholder="Display name (e.g. Client Onboarding for Acme Corp)"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <HStack>
                <Button variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button
                  bgColor="#2590ce"
                  color="#fff"
                  onClick={onCreate}
                  isLoading={createLoading}
                >
                  Create
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </VStack>
  );
};

export default WorkflowRuns;
