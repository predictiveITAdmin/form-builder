import React, { useEffect, useMemo, useState } from "react";
import {
  VStack,
  HStack,
  Flex,
  Text,
  Badge,
  Button,
  IconButton,
  Input,
  InputGroup,
  Card,
  SimpleGrid,
  Progress,
  Splitter,
  Tag,
  Select,
  Pagination,
} from "@chakra-ui/react";
import { useNavigate, useParams, Link as RouterLink } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { FaSearch } from "react-icons/fa";
import { FaEye } from "react-icons/fa6";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi";
import { notify } from "../ui/notifyStore";
import DataTable from "../DataTable";
import AppLoader from "../ui/AppLoader";
import AppError from "../ui/AppError";
import { usePagination } from "@/utils/pagination";

import { Can } from "@/auth/Can";
import { selectUser } from "@/features/auth/authSlice";

import {
  fetchWorkflowRunDashboard,
  lockWorkflowRun,
  cancelWorkflowRun,
  startWorkflowItem,
  skipWorkflowItem,
  addRepeatWorkflowItem,
  assignWorkflowItem,
  selectWorkflowDashboardByRunId,
  selectWorkflowLoading,
  selectWorkflowError,
} from "@/features/workflows/workflowSlice";

// -------------------------
// Small helpers
// -------------------------
const norm = (s) => String(s || "").toLowerCase();

const statusColor = (s) => {
  const v = norm(s);
  if (v === "completed" || v === "submitted") return "green";
  if (v === "in_progress") return "blue";
  if (v === "not_started") return "gray";
  if (v === "skipped") return "orange";
  if (v === "cancelled") return "red";
  return "gray";
};

const prettyStatus = (s) => {
  const v = norm(s);
  if (!v) return "-";
  return v.replaceAll("_", " ");
};

const safeDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
};

const isDone = (itemStatus) =>
  ["submitted", "skipped"].includes(norm(itemStatus));

const WorkflowLifecycleChips = ({ run }) => {
  const s = norm(run?.status);
  const locked = Boolean(run?.locked_at);

  const steps = [
    { key: "not_started", label: "Not started" },
    { key: "in_progress", label: "In progress" },
    { key: "completed", label: "Completed" },
  ];

  // Cancelled overrides everything visually
  if (s === "cancelled") {
    return (
      <HStack wrap="wrap" gap={2}>
        <Tag.Root colorScheme="red" variant="subtle">
          <Tag.Label>Cancelled</Tag.Label>
        </Tag.Root>
        <Tag.Root colorScheme="gray" variant="outline">
          <Tag.Label>Created: {safeDate(run?.created_at)}</Tag.Label>
        </Tag.Root>
      </HStack>
    );
  }

  return (
    <HStack wrap="wrap" gap={2}>
      {steps.map((st) => {
        const active =
          (st.key === "not_started" && s === "not_started") ||
          (st.key === "in_progress" && s === "in_progress") ||
          (st.key === "completed" && s === "completed");

        const passed =
          st.key === "not_started"
            ? true
            : st.key === "in_progress"
            ? s !== "not_started"
            : s === "completed";

        const scheme = active ? "blue" : passed ? "green" : "gray";

        return (
          <Tag.Root
            key={st.key}
            colorScheme={scheme}
            variant={active ? "solid" : "subtle"}
          >
            <Tag.Label>{st.label}</Tag.Label>
          </Tag.Root>
        );
      })}

      {locked ? (
        <Tag.Root colorScheme="purple" variant="subtle">
          <Tag.Label>Locked</Tag.Label>
        </Tag.Root>
      ) : null}
    </HStack>
  );
};

// -------------------------
// Main view
// -------------------------
const WorkflowRunDetail = () => {
  const { runId } = useParams();
  const rid = Number(runId);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const user = useSelector(selectUser);
  const dashboard = useSelector(selectWorkflowDashboardByRunId(rid));

  const loading = useSelector(selectWorkflowLoading("fetchRunDashboard"));
  const error = useSelector(selectWorkflowError("fetchRunDashboard"));

  const lockLoading = useSelector(selectWorkflowLoading("lockRun"));
  const cancelLoading = useSelector(selectWorkflowLoading("cancelRun"));
  const startLoading = useSelector(selectWorkflowLoading("startItem"));
  const skipLoading = useSelector(selectWorkflowLoading("skipItem"));
  const addRepeatLoading = useSelector(selectWorkflowLoading("addRepeatItem"));
  const assignLoading = useSelector(selectWorkflowLoading("assignItem"));

  const [searchTerm, setSearchTerm] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [assignByItem, setAssignByItem] = useState({}); // { [itemId]: assigned_user_id }

  useEffect(() => {
    if (!Number.isFinite(rid)) return;
    dispatch(fetchWorkflowRunDashboard({ runId: rid }));
  }, [dispatch, rid]);

  const run = dashboard || null;
  const items = useMemo(
    () => (run?.items && Array.isArray(run.items) ? run.items : []),
    [run]
  );

  const progress = useMemo(() => {
    const total = Number(run?.required_total ?? 0);
    const done = Number(run?.required_done ?? 0);
    const pct =
      total <= 0 ? 100 : Math.min(100, Math.round((done / total) * 100));
    return { total, done, pct };
  }, [run]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return items;

    return items.filter((it) => {
      const hay = [
        it.form_title,
        it.form_key,
        it.status,
        it.sequence_num,
        it.assigned_user_name,
        it.assigned_user_id,
        it.required ? "required" : "optional",
      ]
        .map((x) => String(x ?? "").toLowerCase())
        .join(" | ");
      return hay.includes(term);
    });
  }, [items, searchTerm]);

  // Grouping: nicer lifecycle comprehension
  const grouped = useMemo(() => {
    const buckets = {
      required_open: [],
      required_done: [],
      optional_open: [],
      optional_done: [],
    };

    for (const it of filteredItems) {
      const req = Boolean(it.required);
      const done = isDone(it.status);
      if (req && !done) buckets.required_open.push(it);
      else if (req && done) buckets.required_done.push(it);
      else if (!req && !done) buckets.optional_open.push(it);
      else buckets.optional_done.push(it);
    }

    // Stable ordering: sort_order, workflow_form_id, sequence
    const sortFn = (a, b) => {
      const sa = Number(a.sort_order ?? 0);
      const sb = Number(b.sort_order ?? 0);
      if (sa !== sb) return sa - sb;
      const wa = Number(a.workflow_form_id ?? 0);
      const wb = Number(b.workflow_form_id ?? 0);
      if (wa !== wb) return wa - wb;
      return Number(a.sequence_num ?? 0) - Number(b.sequence_num ?? 0);
    };

    Object.keys(buckets).forEach((k) => buckets[k].sort(sortFn));
    return buckets;
  }, [filteredItems]);

  const flatForTable = useMemo(() => {
    // Required open first (so users stop ignoring the important stuff),
    // then required done, then optional open, then optional done.
    return [
      ...grouped.required_open,
      ...grouped.required_done,
      ...grouped.optional_open,
      ...grouped.optional_done,
    ];
  }, [grouped]);

  const { page, setPage, pageSize, totalItems, pageData } = usePagination(
    flatForTable,
    8
  );

  if (!Number.isFinite(rid))
    return <AppError message={`Invalid workflow run id: ${runId}`} />;
  if (loading || !run) return <AppLoader />;
  if (error)
    return (
      <AppError message={error?.message || "Failed to load workflow run"} />
    );

  const runIsCancelled = norm(run.status) === "cancelled";
  const runIsLocked = Boolean(run.locked_at);

  const doRefresh = () => dispatch(fetchWorkflowRunDashboard({ runId: rid }));
  const onLock = async () => {
    const res = await dispatch(lockWorkflowRun({ runId: rid }));

    if (res?.meta?.requestStatus === "fulfilled") {
      notify({
        type: "success",
        title: "Run locked",
        message: "Workflow run has been locked.",
        duration: 1800,
      });
      doRefresh();
    } else {
      notify({
        type: "error",
        title: "Lock failed",
        message: res?.payload?.message || "Unable to lock workflow run.",
        duration: 2200,
      });
    }
  };

  const onCancel = async () => {
    const reason = cancelReason.trim();

    if (!reason) {
      notify({
        type: "warning",
        title: "Reason required",
        message: "Humans love accountability.",
        duration: 2200,
      });
      return;
    }

    const res = await dispatch(cancelWorkflowRun({ runId: rid, reason }));

    if (res?.meta?.requestStatus === "fulfilled") {
      notify({
        type: "success",
        title: "Run cancelled",
        message: "Workflow run has been cancelled.",
        duration: 1800,
      });
      doRefresh();
    } else {
      notify({
        type: "error",
        title: "Cancel failed",
        message: res?.payload?.message || "Unable to cancel workflow run.",
        duration: 2200,
      });
    }
  };

  const onStartItem = async (item) => {
    const res = await dispatch(
      startWorkflowItem({ itemId: item.workflow_item_id })
    );

    if (res?.meta?.requestStatus !== "fulfilled") {
      notify({
        type: "error",
        title: "Start failed",
        message: res?.payload?.message || "Could not start item.",
        duration: 2200,
      });
      return;
    }

    const payload = res.payload;

    navigate(`/forms/${item.form_key}`, {
      state: {
        workflow_run_id: payload.workflow_run_id,
        workflow_item_id: payload.workflow_item_id,
        session_token: payload?.session?.session_token,
        session_id: payload?.session?.session_id,
      },
    });
  };

  const onSkipItem = async (item) => {
    const reason = window.prompt("Skip reason (required):");
    if (!reason || !reason.trim()) return;

    const res = await dispatch(
      skipWorkflowItem({ itemId: item.workflow_item_id, reason })
    );

    if (res?.meta?.requestStatus === "fulfilled") {
      notify({
        type: "success",
        title: "Item skipped",
        message: "Workflow item has been skipped.",
        duration: 1600,
      });
      doRefresh();
    } else {
      notify({
        type: "error",
        title: "Skip failed",
        message: res?.payload?.message || "Unable to skip item.",
        duration: 2200,
      });
    }
  };

  const onAddAnother = async (item) => {
    const res = await dispatch(
      addRepeatWorkflowItem({
        fromItemId: item.workflow_item_id,
        assigned_user_id: item.assigned_user_id ?? null,
      })
    );

    if (res?.meta?.requestStatus === "fulfilled") {
      notify({
        type: "success",
        title: "Added another item",
        message: "A new workflow item was created.",
        duration: 1600,
      });
      doRefresh();
    } else {
      notify({
        type: "error",
        title: "Add failed",
        message: res?.payload?.message || "Unable to add another item.",
        duration: 2200,
      });
    }
  };

  const onAssign = async (item) => {
    const v = assignByItem[item.workflow_item_id];
    const assigned_user_id = v === "" ? null : Number(v);

    const res = await dispatch(
      assignWorkflowItem({ itemId: item.workflow_item_id, assigned_user_id })
    );

    if (res?.meta?.requestStatus === "fulfilled") {
      notify({
        type: "success",
        title: "Assigned",
        message: "Workflow item assignment updated.",
        duration: 1500,
      });
      doRefresh();
    } else {
      notify({
        type: "error",
        title: "Assign failed",
        message: res?.payload?.message || "Unable to assign workflow item.",
        duration: 2200,
      });
    }
  };

  const columns = [
    {
      key: "form_title",
      label: "Task (Form)",
      sortable: true,
      render: (_, row) => (
        <VStack spacing={0.5} align="start">
          <HStack wrap="wrap">
            <Text fontWeight="bold">{row.form_title || "-"}</Text>
            {row.required ? (
              <Badge colorScheme="red" variant="subtle">
                Required
              </Badge>
            ) : (
              <Badge colorScheme="gray" variant="subtle">
                Optional
              </Badge>
            )}
            {row.allow_multiple ? (
              <Badge colorScheme="blue" variant="outline">
                Repeatable
              </Badge>
            ) : null}
          </HStack>
          <Text fontSize="sm" color="gray.500">
            {row.form_key ? row.form_key : `form_${row.form_id}`} · Seq{" "}
            {row.sequence_num ?? "-"}
          </Text>
        </VStack>
      ),
    },
    {
      key: "assigned_user_name",
      label: "Assignee",
      sortable: true,
      render: (_, row) => (
        <VStack align="start" spacing={1}>
          <Text>
            {row.assigned_user_name ||
              (row.assigned_user_id ? `User #${row.assigned_user_id}` : "-")}
          </Text>

          {/* Admin-only: quick assign input (simple by design; plug in your user picker later) */}
          <Can any={["workflows.item.assign"]}>
            <HStack>
              <Select
                size="sm"
                placeholder="Assign user id..."
                value={assignByItem[row.workflow_item_id] ?? ""}
                onChange={(e) =>
                  setAssignByItem((prev) => ({
                    ...prev,
                    [row.workflow_item_id]: e.target.value,
                  }))
                }
                width={44}
                isDisabled={runIsCancelled || runIsLocked}
              >
                {/* This is intentionally dumb: you likely have a user directory picker elsewhere.
                    For now, allow typing IDs by adding them as options in your app-level user list,
                    or replace this with your Select component / directory search. */}
                {row.assigned_user_id ? (
                  <option value={row.assigned_user_id}>
                    {row.assigned_user_id}
                  </option>
                ) : null}
              </Select>

              <Button
                size="sm"
                variant="outline"
                onClick={() => onAssign(row)}
                isLoading={assignLoading}
                isDisabled={runIsCancelled || runIsLocked}
              >
                Assign
              </Button>
            </HStack>
          </Can>
        </VStack>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value, row) => (
        <VStack align="start" spacing={1}>
          <Badge
            colorScheme={statusColor(value)}
            variant="subtle"
            textTransform="capitalize"
          >
            {prettyStatus(value)}
          </Badge>
          {norm(row.status) === "skipped" && row.skipped_reason ? (
            <Text fontSize="sm" color="orange.600" noOfLines={2}>
              {row.skipped_reason}
            </Text>
          ) : null}
        </VStack>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, row) => {
        const done = isDone(row.status);
        const disabled = runIsCancelled || runIsLocked;

        return (
          <HStack spacing={1}>
            {/* View form template quickly */}
            <IconButton
              size="sm"
              aria-label="View form"
              variant="ghost"
              color="green"
              icon={<FaEye size={16} />}
              onClick={() => navigate(`/forms/${row.form_key}`)}
            />

            {/* Start / Continue */}
            <Can any={["workflows.item.start"]}>
              <Button
                size="sm"
                colorScheme="blue"
                variant={done ? "outline" : "solid"}
                onClick={() => onStartItem(row)}
                isLoading={startLoading}
                isDisabled={disabled}
              >
                {norm(row.status) === "not_started" ? "Start" : "Continue"}
              </Button>
            </Can>

            {/* Skip */}
            <Can any={["workflows.item.skip"]}>
              <Button
                size="sm"
                variant="outline"
                colorScheme="orange"
                onClick={() => onSkipItem(row)}
                isLoading={skipLoading}
                isDisabled={disabled || done}
              >
                Skip
              </Button>
            </Can>

            {/* Add another (repeatable only) */}
            <Can any={["workflows.item.add"]}>
              {row.allow_multiple ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAddAnother(row)}
                  isLoading={addRepeatLoading}
                  isDisabled={disabled}
                >
                  Add another
                </Button>
              ) : null}
            </Can>
          </HStack>
        );
      },
    },
  ];

  return (
    <VStack spacing={6} align="stretch">
      {/* Header */}
      <HStack justify="space-between" align="start">
        <VStack align="start" spacing={1}>
          <HStack wrap="wrap" spacing={3}>
            <Text fontSize="2xl" fontWeight="bold">
              {run.workflow_title || "Workflow"}:{" "}
              {run.display_name || `Run #${rid}`}
            </Text>

            <Badge
              colorScheme={statusColor(run.status)}
              variant="subtle"
              textTransform="capitalize"
            >
              {prettyStatus(run.status)}
            </Badge>

            {run.locked_at ? (
              <Badge colorScheme="purple" variant="outline">
                Locked
              </Badge>
            ) : null}
          </HStack>

          <HStack wrap="wrap" spacing={3} color="gray.600">
            <Text>
              <b>Run ID:</b> {run.workflow_run_id}
            </Text>
            <Text>
              <b>Workflow ID:</b> {run.workflow_id}
            </Text>
            <Text>
              <b>Created:</b> {safeDate(run.created_at)}
            </Text>
            <Text>
              <b>Updated:</b> {safeDate(run.updated_at)}
            </Text>
          </HStack>
        </VStack>

        <HStack>
          <Button as={RouterLink} to="/workflows" variant="outline">
            Back
          </Button>
          <Button onClick={doRefresh} variant="outline">
            Refresh
          </Button>
        </HStack>
      </HStack>

      {/* Lifecycle + Progress */}
      <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
        <Card.Root variant="outline" borderRadius="2xl">
          <Card.Header pb={0}>
            <Text fontWeight="bold">Lifecycle</Text>
          </Card.Header>
          <Card.Body>
            <VStack align="stretch" spacing={3}>
              <WorkflowLifecycleChips run={run} />
              <Splitter.Root
                panels={[{ id: "top" }, { id: "bottom" }]}
                orientation="vertical"
                minH="1"
                borderWidth="0"
              >
                <Splitter.Panel id="top">
                  {/* empty on purpose – acts as spacing */}
                </Splitter.Panel>

                <Splitter.ResizeTrigger disabled id="top:bottom" />

                <Splitter.Panel id="bottom">
                  <Text color="gray.600" fontSize="sm">
                    {run.status === "cancelled"
                      ? "This run is cancelled. No more work, no more progress, no more hope."
                      : run.locked_at
                      ? "This run is locked. Existing submissions stay, new repeat items should be blocked."
                      : "This run is active. Finish required items (submit or skip) to complete it."}
                  </Text>
                </Splitter.Panel>
              </Splitter.Root>
              {run.locked_at ? (
                <Text fontSize="sm" color="purple.700">
                  <b>Locked:</b> {safeDate(run.locked_at)}{" "}
                  {run.locked_by_name
                    ? `by ${run.locked_by_name}`
                    : run.locked_by
                    ? `by user #${run.locked_by}`
                    : ""}
                </Text>
              ) : null}
            </VStack>
          </Card.Body>
        </Card.Root>

        <Card.Root variant="outline" borderRadius="2xl">
          <Card.Header pb={0}>
            <Text fontWeight="bold">Progress</Text>
          </Card.Header>

          <Card.Body>
            <VStack align="stretch" spacing={3}>
              <HStack justify="space-between">
                <Text>
                  <b>Required:</b> {progress.done} / {progress.total}
                </Text>

                <Badge
                  colorScheme={progress.pct === 100 ? "green" : "blue"}
                  variant="subtle"
                >
                  {progress.pct}%
                </Badge>
              </HStack>

              {/* ✅ New Progress API */}
              <Progress.Root value={progress.pct} max={100} borderRadius="md">
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>

              <Text fontSize="sm" color="gray.600">
                Completion rule: all required items must be <b>submitted</b> or{" "}
                <b>skipped</b>.
              </Text>
            </VStack>
          </Card.Body>
        </Card.Root>
      </SimpleGrid>

      {/* Admin Controls */}
      <Can any={["workflows.run.lock", "workflows.run.cancel"]}>
        <Card.Root variant="outline" borderRadius="2xl">
          <Card.Header pb={0}>
            <Text fontWeight="bold">Admin Controls</Text>
          </Card.Header>
          <Card.Body>
            <VStack align="stretch" spacing={3}>
              <HStack wrap="wrap" justify="space-between">
                <HStack>
                  <Can any={["workflows.run.lock"]}>
                    <Button
                      colorScheme="purple"
                      variant="outline"
                      onClick={onLock}
                      isLoading={lockLoading}
                      isDisabled={runIsCancelled || runIsLocked}
                    >
                      Lock Run
                    </Button>
                  </Can>

                  <Can any={["workflows.run.cancel"]}>
                    <Button
                      colorScheme="red"
                      variant="outline"
                      onClick={onCancel}
                      isLoading={cancelLoading}
                      isDisabled={runIsCancelled}
                    >
                      Cancel Run
                    </Button>
                  </Can>
                </HStack>

                <InputGroup>
                  <Input
                    placeholder="Cancel reason (required)"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    width={{ base: "full", md: 96 }}
                    isDisabled={runIsCancelled}
                  />
                </InputGroup>
              </HStack>

              <Text fontSize="sm" color="gray.600">
                Lock prevents new repeat items. Cancel kills the run outright.
                Humans love power.
              </Text>
            </VStack>
          </Card.Body>
        </Card.Root>
      </Can>

      {/* Items */}
      <VStack spacing={4} align="stretch">
        <HStack>
          <Flex justify="space-between" align="center" gap={2} width="full">
            <Flex justify="space-around" align="center" gap={4}>
              <InputGroup startElement={<FaSearch />}>
                <Input
                  placeholder="Search tasks by form, status, assignee, sequence..."
                  value={searchTerm}
                  width={96}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </Flex>
          </Flex>
        </HStack>

        {pageData?.length === 0 ? (
          <Text>No items found.</Text>
        ) : (
          <DataTable columns={columns} data={pageData ?? []} />
        )}

        {/* Pagination (same vibe as Forms/Responses) */}
        <Pagination.Root
          count={totalItems}
          pageSize={pageSize}
          page={page}
          onPageChange={(e) => setPage(e.page)}
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
        </Pagination.Root>
      </VStack>
    </VStack>
  );
};

export default WorkflowRunDetail;
