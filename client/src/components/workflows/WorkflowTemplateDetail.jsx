import React, { useEffect, useMemo, useState } from "react";
import {
  VStack,
  HStack,
  Stack,
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
  Fieldset,
  Field,
  Combobox,
  useListCollection,
  useFilter,
  Portal,
  Checkbox,
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
  fetchWorkflowForms,
  assignFormToWorkflow,
  updateWorkflowForm,
  removeWorkflowFormFromWorkflow,
  selectWorkflowForms,
  fetchAssignableForms,
  selectAssignableForms,
} from "@/features/workflows/workflowSlice";
import AssignableForms from "./AssignableForms";

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

  const assignableForms = useSelector(selectAssignableForms);
  const assignableFormsLoading = useSelector(
    selectWorkflowLoading("fetchAssignableForms"),
  );
  const assignableFormsError = useSelector(
    selectWorkflowError("fetchAssignableForms"),
  );

  // "assignableForms" => combobox options
  // "workflowForms"   => currently assigned forms in template setup
  const workflowForms = useSelector(selectWorkflowForms);
  const workflowFormsLoading = useSelector(
    selectWorkflowLoading("fetchWorkflowForms"),
  );
  const workflowFormsError = useSelector(
    selectWorkflowError("fetchWorkflowForms"),
  );

  const assignFormLoading = useSelector(
    selectWorkflowLoading("assignFormToWorkflow"),
  );
  const [searchTerm, setSearchTerm] = useState("");

  // Create Run dialog state
  const [runDialogOpen, setRunDialogOpen] = useState(false);

  const [manageFormsOpen, setManageFormsOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");

  // Manage Forms dialog state
  const [selectedFormId, setSelectedFormId] = useState(null);
  const [isRequired, setIsRequired] = useState(false);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [sortOrder, setSortOrder] = useState(50);

  // Edit existing assigned form
  const [editFormOpen, setEditFormOpen] = useState(false);
  const [editingWorkflowForm, setEditingWorkflowForm] = useState(null);

  const closeRunDialog = () => {
    setRunDialogOpen(false);
    setDisplayName("");
  };

  const onAssignForm = async () => {
    const formIdNum = Number(selectedFormId);
    if (!Number.isFinite(formIdNum)) {
      notify({
        type: "warning",
        title: "Select a form",
        message: "Pick a form to add to this workflow template.",
      });
      return;
    }

    const res = await dispatch(
      assignFormToWorkflow({
        workflowId: wid,
        form_id: formIdNum,
        required: Boolean(isRequired),
        allow_multiple: Boolean(allowMultiple),
        sort_order: Number(sortOrder) || 50,
      }),
    );

    if (res?.meta?.requestStatus === "fulfilled") {
      notify({
        type: "success",
        title: "Form added",
        message: "Form added to workflow template.",
      });

      // refresh workflow so the assigned forms list updates
      dispatch(getWorkflow({ workflowId: wid }));
      dispatch(fetchWorkflowForms({ workflow_id: wid }));
      closeManageForms();
    } else {
      notify({
        type: "error",
        title: "Add form failed",
        message: res?.payload?.message || "Unable to add form to workflow.",
      });
    }
  };

  const closeManageForms = () => {
    setManageFormsOpen(false);
    setSelectedFormId(null);
    setIsRequired(false);
    setAllowMultiple(false);
    setSortOrder(50);
  };

  const closeEditForm = () => {
    setEditFormOpen(false);
    setEditingWorkflowForm(null);
  };

  useEffect(() => {
    if (!Number.isFinite(wid)) return;

    dispatch(getWorkflow({ workflowId: wid }));
    dispatch(fetchWorkflowRuns({ workflow_id: wid }));
    dispatch(fetchWorkflowForms({ workflow_id: wid }));
  }, [dispatch, wid]);

  useEffect(() => {
    if (!manageFormsOpen /* replace with your manageFormsOpen */) return;
    dispatch(fetchAssignableForms());
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
        <Badge bgColor={runStatusColor(value)} textTransform="capitalize">
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
    8,
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
      }),
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

  const assignedForms = useMemo(() => {
    // Prefer the dedicated endpoint-backed list (workflowForms) if present.
    const list = Array.isArray(workflowForms) ? workflowForms : [];
    const scoped = list.filter((x) => Number(x.workflow_id) === wid);

    if (scoped.length) return scoped;

    // Fallback to whatever getWorkflow returned (older API shapes)
    const legacy =
      workflow?.workflow_forms ||
      workflow?.forms ||
      workflow?.template_forms ||
      workflow?.workflowForms ||
      [];
    return Array.isArray(legacy) ? legacy : [];
  }, [workflowForms, wid, workflow]);

  const onRemoveAssignedForm = async (workflowFormId) => {
    const wfFormIdNum = Number(workflowFormId);
    if (!Number.isFinite(wfFormIdNum)) {
      console.log(wfFormIdNum);
      return;
    }

    const res = await dispatch(
      removeWorkflowFormFromWorkflow({
        workflowId: wid,
        workflowFormId: wfFormIdNum,
      }),
    );

    if (res?.meta?.requestStatus === "fulfilled") {
      notify({
        type: "success",
        title: "Removed",
        message: "Form removed from workflow template.",
      });
      dispatch(getWorkflow({ workflowId: wid }));
      dispatch(fetchWorkflowForms({ workflow_id: wid }));
    } else {
      notify({
        type: "error",
        title: "Remove failed",
        message: res?.payload?.message || "Unable to remove form.",
      });
    }
  };

  const onOpenEditAssignedForm = (wfForm) => {
    setEditingWorkflowForm(wfForm);
    setIsRequired(Boolean(wfForm?.required));
    setAllowMultiple(Boolean(wfForm?.allow_multiple));
    setSortOrder(Number(wfForm?.sort_order ?? 50));
    setEditFormOpen(true);
  };

  const onSaveEditAssignedForm = async () => {
    const wfFormIdNum = Number(
      editingWorkflowForm?.workflow_form_id ||
        editingWorkflowForm?.workflowFormId ||
        editingWorkflowForm?.workflow_formId ||
        editingWorkflowForm?.id,
    );

    if (!Number.isFinite(wfFormIdNum)) {
      notify({
        type: "error",
        title: "Edit failed",
        message: "Missing workflow_form_id for this assignment.",
      });
      return;
    }

    const res = await dispatch(
      updateWorkflowForm({
        workflowFormId: wfFormIdNum,
        required: Boolean(isRequired),
        allow_multiple: Boolean(allowMultiple),
        sort_order: Number(sortOrder) || 50,
      }),
    );

    if (res?.meta?.requestStatus === "fulfilled") {
      notify({
        type: "success",
        title: "Updated",
        message: "Form settings updated.",
      });
      dispatch(getWorkflow({ workflowId: wid }));
      dispatch(fetchWorkflowForms({ workflow_id: wid }));
      closeEditForm();
    } else {
      notify({
        type: "error",
        title: "Update failed",
        message: res?.payload?.message || "Unable to update form settings.",
      });
    }
  };

  const collectionForms = assignableForms.map((item) => ({
    label: item.title,
    value: item.form_id,
  }));

  const { contains } = useFilter({ sensitivity: "base" });

  const { collection, filter } = useListCollection({
    initialItems: collectionForms.map((item) => ({
      label: item.title,
      value: item.form_id,
    })),
    filter: contains,
  });

  if (!Number.isFinite(wid))
    return <AppError message={`Invalid workflowId: ${workflowId}`} />;
  if (wfLoading) return <AppLoader />;
  if (wfError) return <AppError message={wfError?.message || wfError} />;

  if (!workflow) return <AppError message="Workflow not found" />;

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between" align="start">
        <VStack align="start" spacing={1}>
          <HStack wrap="wrap" spacing={3}>
            <Text fontSize="2xl" fontWeight="bold">
              {workflow.title || "Workflow"}
            </Text>

            <Badge bgColor={statusColor(workflow.status)} variant="subtle">
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
                  You can manage the forms where, these forms will be part of
                  each run that you create from this workflow.
                </Text>

                <Text fontSize="sm" color="gray.600"></Text>

                <HStack>
                  <Button
                    variant="solid"
                    bgColor={"#2596be"}
                    onClick={() => setManageFormsOpen(true)}
                  >
                    Add Form
                  </Button>
                  {assignableForms.length > 0 && (
                    <AssignableForms
                      assignableForms={assignableForms}
                      isRequired={isRequired}
                      setIsRequired={setIsRequired}
                      allowMultiple={allowMultiple}
                      setAllowMultiple={setAllowMultiple}
                      sortOrder={sortOrder}
                      setSortOrder={setSortOrder}
                      manageFormsOpen={manageFormsOpen}
                      closeManageForms={closeManageForms}
                      assignableFormsLoading={assignableFormsLoading}
                      workflowTitle={workflow.title}
                      setManageFormsOpen={setManageFormsOpen}
                      selectedFormId={selectedFormId}
                      setSelectedFormId={setSelectedFormId}
                      onAssignForm={onAssignForm}
                      assignFormLoading={assignFormLoading}
                    />
                  )}
                </HStack>

                {/* Assigned Forms list */}
                <VStack align="stretch" spacing={2} pt={2}>
                  <Text fontWeight="semibold">Forms in this Template</Text>

                  {assignedForms.length === 0 ? (
                    <Text fontSize="sm" color="gray.600">
                      No forms assigned yet.
                    </Text>
                  ) : (
                    assignedForms.map((wfForm) => {
                      const wfFormId =
                        wfForm.workflow_form_id ||
                        wfForm.workflowFormId ||
                        wfForm.id;

                      const title =
                        wfForm?.form?.title ||
                        wfForm?.title ||
                        wfForm?.form_title ||
                        wfForm?.form_name ||
                        `Form #${wfForm.form_id ?? wfForm.formId ?? "-"}`;

                      return (
                        <Card.Root
                          key={wfFormId ?? title}
                          variant="outline"
                          borderRadius="xl"
                        >
                          <Card.Body>
                            <HStack justify="space-between" align="start">
                              <VStack align="start" spacing={0.5}>
                                <Text fontWeight="bold">{title}</Text>
                                <HStack spacing={2} wrap="wrap">
                                  <Badge
                                    bgColor={
                                      wfForm.required ? "red.600" : "gray"
                                    }
                                    color="white"
                                  >
                                    {wfForm.required ? "Required" : "Optional"}
                                  </Badge>
                                  <Badge
                                    bgColor={
                                      wfForm.allow_multiple ? "blue" : "gray"
                                    }
                                    color="white"
                                  >
                                    {wfForm.allow_multiple
                                      ? "Multiple allowed"
                                      : "Single"}
                                  </Badge>
                                  <Badge variant="subtle">
                                    Sort: {wfForm.sort_order ?? "-"}
                                  </Badge>
                                </HStack>
                              </VStack>

                              <HStack>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onOpenEditAssignedForm(wfForm)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  colorPalette="red"
                                  onClick={() => onRemoveAssignedForm(wfFormId)}
                                >
                                  Remove
                                </Button>
                              </HStack>
                            </HStack>
                          </Card.Body>
                        </Card.Root>
                      );
                    })
                  )}
                </VStack>
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

      {/* Edit Assigned Form Dialog */}
      <Dialog.Root
        open={editFormOpen}
        onOpenChange={(e) => setEditFormOpen(e.open)}
      >
        <Dialog.Trigger asChild>
          <span style={{ display: "none" }} />
        </Dialog.Trigger>

        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content borderRadius="2xl">
            <Dialog.CloseTrigger onClick={closeEditForm} />

            <Dialog.Header>
              <Dialog.Title>Edit Template Form</Dialog.Title>
            </Dialog.Header>

            <Dialog.Body marginTop={6}>
              <VStack align="stretch" spacing={3}>
                <Text fontSize={14}>
                  <b>Workflow:</b> {workflow.title}
                </Text>

                <Text fontSize={14}>
                  <b>Form:</b>{" "}
                  {editingWorkflowForm?.form?.title ||
                    editingWorkflowForm?.title ||
                    editingWorkflowForm?.form_title ||
                    "-"}
                </Text>

                <VStack align="stretch" spacing={2}>
                  <Checkbox.Root
                    checked={isRequired}
                    onCheckedChange={(e) => setIsRequired(!!e.checked)}
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label>Required</Checkbox.Label>
                  </Checkbox.Root>

                  <Checkbox.Root
                    checked={allowMultiple}
                    onCheckedChange={(e) => setAllowMultiple(!!e.checked)}
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label>Allow Multiple</Checkbox.Label>
                  </Checkbox.Root>

                  <Field.Root maxW={40}>
                    <Field.Label>Sort Order</Field.Label>
                    <Input
                      type="number"
                      max={50}
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value)}
                    />
                  </Field.Root>
                </VStack>
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <HStack>
                <Button variant="outline" onClick={closeEditForm}>
                  Cancel
                </Button>
                <Button
                  bgColor="#2590ce"
                  color="#fff"
                  onClick={onSaveEditAssignedForm}
                >
                  Save
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
