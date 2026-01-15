// workflowSlice.js
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { http } from "@/api/http"; // your pre-configured axios instance

function toErrorPayload(err) {
  const status = err?.response?.status ?? null;
  const data = err?.response?.data ?? null;
  const message =
    data?.message ||
    data?.error ||
    err?.message ||
    "Something broke. Probably on purpose.";

  return { status, message, data };
}

// -------------------------
// Workflows (templates)
// -------------------------
export const fetchWorkflows = createAsyncThunk(
  "workflows/fetchWorkflows",
  async (_, { rejectWithValue }) => {
    try {
      // routes: GET /workflows (base: /api/workflows)
      const res = await http.get("/api/workflows/workflows");
      return res.data; // array
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

export const createWorkflow = createAsyncThunk(
  "workflows/createWorkflow",
  async (
    { title, workflow_key, description, status = "Active" },
    { rejectWithValue }
  ) => {
    try {
      // routes: POST /workflows
      const res = await http.post("/api/workflows/workflows", {
        title,
        workflow_key,
        description,
        status,
      });
      return res.data; // { workflow }
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

export const getWorkflow = createAsyncThunk(
  "workflows/getWorkflow",
  async ({ workflowId }, { rejectWithValue }) => {
    try {
      // routes: GET /workflows/:workflowId
      const res = await http.get(`/api/workflows/workflows/${workflowId}`);
      return res.data; // { workflow }
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

export const fetchAssignableForms = createAsyncThunk(
  "workflows/fetchAssignable",
  async (_, { rejectWithValue }) => {
    try {
      const res = await http.get(`/api/forms/published/workflowForms`);
      return res.data;
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

// -------------------------
// Workflow Forms (template<->form links)
// -------------------------
export const fetchWorkflowForms = createAsyncThunk(
  "workflows/fetchWorkflowForms",
  async (_, { rejectWithValue }) => {
    try {
      // routes: GET /workflow-forms
      const res = await http.get("/api/workflows/workflow-forms");
      return res.data; // array
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

export const getWorkflowForm = createAsyncThunk(
  "workflows/getWorkflowForm",
  async ({ workflowFormId }, { rejectWithValue }) => {
    try {
      // routes: GET /workflow-forms/:workflowFormId
      const res = await http.get(
        `/api/workflows/workflow-forms/${workflowFormId}`
      );
      return res.data; // whatever controller returns (array/rows/etc)
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

export const assignFormToWorkflow = createAsyncThunk(
  "workflows/assignFormToWorkflow",
  async (
    {
      workflowId,
      form_id,
      required = false,
      allow_multiple = false,
      sort_order = 50,
    },
    { rejectWithValue }
  ) => {
    try {
      // routes: POST /workflows/:workflowId/forms
      const res = await http.post(
        `/api/workflows/workflows/${workflowId}/forms`,
        {
          form_id,
          required,
          allow_multiple,
          sort_order,
        }
      );
      return res.data; // workflow_form row
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

// This exists in controller.js, but routes.js currently has NO PUT/PATCH route.
// If you don't add it, this thunk will 404. Included because you asked "controller + routes".
export const updateWorkflowForm = createAsyncThunk(
  "workflows/updateWorkflowForm",
  async (
    {
      workflowFormId,
      required = false,
      allow_multiple = false,
      sort_order = 50,
    },
    { rejectWithValue }
  ) => {
    try {
      // Intended route: PUT /workflow-forms/:workflowFormId
      const res = await http.put(
        `/api/workflows/workflow-forms/${workflowFormId}`,
        { required, allow_multiple, sort_order }
      );
      return res.data; // updated workflow_form row
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

export const removeWorkflowForm = createAsyncThunk(
  "workflows/removeWorkflowForm",
  async ({ workflowFormId }, { rejectWithValue }) => {
    try {
      // routes: DELETE /workflow-forms/:workflowFormId
      await http.delete(`/api/workflows/workflow-forms/${workflowFormId}`);
      return { workflowFormId };
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

// Alternate delete route also exists
export const removeWorkflowFormFromWorkflow = createAsyncThunk(
  "workflows/removeWorkflowFormFromWorkflow",
  async ({ workflowId, workflowFormId }, { rejectWithValue }) => {
    try {
      // routes: DELETE /workflows/:workflowId/forms/:workflowFormId
      await http.delete(
        `/api/workflows/workflows/${workflowId}/forms/${workflowFormId}`
      );
      return { workflowId, workflowFormId };
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

// -------------------------
// Runs
// -------------------------
export const fetchWorkflowRuns = createAsyncThunk(
  "workflows/fetchRuns",
  async (
    { mine = false, workflow_id = null, status = null } = {},
    { rejectWithValue }
  ) => {
    try {
      // routes: GET /workflow-runs?mine=true&workflow_id=...&status=...
      const params = new URLSearchParams();
      if (mine) params.set("mine", "true");
      if (workflow_id) params.set("workflow_id", String(workflow_id));
      if (status) params.set("status", status);

      const qs = params.toString();
      const res = await http.get(
        `/api/workflows/workflow-runs${qs ? `?${qs}` : ""}`
      );
      return res.data; // array
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

export const createWorkflowRun = createAsyncThunk(
  "workflows/createRun",
  async ({ workflow_id, display_name }, { rejectWithValue }) => {
    try {
      // routes: POST /workflow-runs
      const res = await http.post("/api/workflows/workflow-runs", {
        workflow_id,
        display_name,
      });
      return res.data; // { run, status }
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

export const fetchWorkflowRunDashboard = createAsyncThunk(
  "workflows/fetchRunDashboard",
  async ({ runId }, { rejectWithValue }) => {
    try {
      // routes: GET /workflow-runs/:runId
      const res = await http.get(`/api/workflows/workflow-runs/${runId}`);
      return res.data; // dashboard object
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

export const lockWorkflowRun = createAsyncThunk(
  "workflows/lockRun",
  async ({ runId }, { rejectWithValue }) => {
    try {
      // routes: POST /workflow-runs/:runId/lock
      const res = await http.post(`/api/workflows/workflow-runs/${runId}/lock`);
      return { runId, data: res.data };
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

export const cancelWorkflowRun = createAsyncThunk(
  "workflows/cancelRun",
  async ({ runId, reason }, { rejectWithValue }) => {
    try {
      // routes: POST /workflow-runs/:runId/cancel
      const res = await http.post(
        `/api/workflows/workflow-runs/${runId}/cancel`,
        { reason }
      );
      return { runId, data: res.data };
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

// -------------------------
// Items
// -------------------------
export const assignWorkflowItem = createAsyncThunk(
  "workflows/assignItem",
  async ({ itemId, assigned_user_id }, { rejectWithValue }) => {
    try {
      // routes: POST /workflow-items/:itemId/assign
      const res = await http.post(
        `/api/workflows/workflow-items/${itemId}/assign`,
        { assigned_user_id }
      );
      return res.data;
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

export const startWorkflowItem = createAsyncThunk(
  "workflows/startItem",
  async ({ itemId }, { rejectWithValue }) => {
    try {
      // routes: POST /workflow-items/:itemId/start
      const res = await http.post(
        `/api/workflows/workflow-items/${itemId}/start`
      );
      return res.data;
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

export const skipWorkflowItem = createAsyncThunk(
  "workflows/skipItem",
  async ({ itemId, reason }, { rejectWithValue }) => {
    try {
      // routes: POST /workflow-items/:itemId/skip
      const res = await http.post(
        `/api/workflows/workflow-items/${itemId}/skip`,
        { reason }
      );
      return res.data;
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

export const addRepeatWorkflowItem = createAsyncThunk(
  "workflows/addRepeatItem",
  async (
    { runId, workflowFormId, fromItemId, assigned_user_id },
    { rejectWithValue }
  ) => {
    try {
      // routes: POST /workflow-items/add
      const res = await http.post(`/api/workflows/workflow-items/add`, {
        runId,
        workflowFormId,
        fromItemId,
        assigned_user_id,
      });
      return res.data;
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

export const markWorkflowItemSubmitted = createAsyncThunk(
  "workflows/markSubmitted",
  async ({ workflow_item_id, workflow_run_id }, { rejectWithValue }) => {
    try {
      // routes: POST /workflow-items/mark-submitted
      const res = await http.post(
        `/api/workflows/workflow-items/mark-submitted`,
        { workflow_item_id, workflow_run_id }
      );
      return res.data;
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

// -------------------------
// Slice helpers
// -------------------------
function upsertDashboard(state, dashboard) {
  if (!dashboard?.workflow_run_id) return;
  state.dashboardsByRunId[dashboard.workflow_run_id] = dashboard;
}

function updateItemInDashboard(state, runId, updaterFn) {
  const dash = state.dashboardsByRunId[runId];
  if (!dash?.items?.length) return;
  updaterFn(dash);
}

function clearOpError(state, op) {
  state.error[op] = null;
}

function setOpLoading(state, op, value) {
  state.loading[op] = value;
}

function setOpError(state, op, payload) {
  state.error[op] = payload ?? { message: "Unknown error" };
}

// -------------------------
// Initial State
// -------------------------
const initialState = {
  // workflows/templates
  workflows: [],
  workflowById: {},

  // forms
  workflowForms: [],
  workflowFormById: {},

  // runs + dashboard cache
  runs: [],
  dashboardsByRunId: {},

  // item start result cache (was missing before)
  itemStartByItemId: {},

  assignableForms: [],

  loading: {
    fetchWorkflows: false,
    createWorkflow: false,
    getWorkflow: false,

    fetchWorkflowForms: false,
    getWorkflowForm: false,
    assignFormToWorkflow: false,
    updateWorkflowForm: false,
    removeWorkflowForm: false,
    removeWorkflowFormFromWorkflow: false,

    fetchAssignableForms: false,

    createRun: false,
    fetchRuns: false,
    fetchRunDashboard: false,
    lockRun: false,
    cancelRun: false,

    assignItem: false,
    startItem: false,
    skipItem: false,
    addRepeatItem: false,
    markSubmitted: false,
  },

  error: {
    fetchWorkflows: null,
    createWorkflow: null,
    getWorkflow: null,

    fetchWorkflowForms: null,
    getWorkflowForm: null,
    assignFormToWorkflow: null,
    updateWorkflowForm: null,
    removeWorkflowForm: null,
    removeWorkflowFormFromWorkflow: null,

    fetchAssignableForms: null,

    createRun: null,
    fetchRuns: null,
    fetchRunDashboard: null,
    lockRun: null,
    cancelRun: null,

    assignItem: null,
    startItem: null,
    skipItem: null,
    addRepeatItem: null,
    markSubmitted: null,
  },
};

// -------------------------
// Slice
// -------------------------
export const workflowSlice = createSlice({
  name: "workflows",
  initialState,
  reducers: {
    clearWorkflowErrors(state) {
      Object.keys(state.error).forEach((k) => (state.error[k] = null));
    },
    clearWorkflowRunDashboard(state, action) {
      const runId = Number(action.payload);
      delete state.dashboardsByRunId[runId];
    },
  },
  extraReducers: (builder) => {
    // -------------------------
    // Workflows (templates)
    // -------------------------
    builder
      .addCase(fetchWorkflows.pending, (state) => {
        setOpLoading(state, "fetchWorkflows", true);
        clearOpError(state, "fetchWorkflows");
      })
      .addCase(fetchWorkflows.fulfilled, (state, action) => {
        setOpLoading(state, "fetchWorkflows", false);
        state.workflows = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchWorkflows.rejected, (state, action) => {
        setOpLoading(state, "fetchWorkflows", false);
        setOpError(state, "fetchWorkflows", action.payload || action.error);
      });

    builder
      .addCase(createWorkflow.pending, (state) => {
        setOpLoading(state, "createWorkflow", true);
        clearOpError(state, "createWorkflow");
      })
      .addCase(createWorkflow.fulfilled, (state, action) => {
        setOpLoading(state, "createWorkflow", false);

        const wf = action.payload?.workflow;
        if (!wf) return;

        const idx = (state.workflows || []).findIndex(
          (x) => x.workflow_id === wf.workflow_id
        );
        if (idx >= 0) state.workflows[idx] = wf;
        else state.workflows = [wf, ...(state.workflows || [])];

        state.workflowById[wf.workflow_id] = wf;
      })
      .addCase(createWorkflow.rejected, (state, action) => {
        setOpLoading(state, "createWorkflow", false);
        setOpError(state, "createWorkflow", action.payload || action.error);
      });

    builder
      .addCase(getWorkflow.pending, (state) => {
        setOpLoading(state, "getWorkflow", true);
        clearOpError(state, "getWorkflow");
      })
      .addCase(getWorkflow.fulfilled, (state, action) => {
        setOpLoading(state, "getWorkflow", false);

        const wf = action.payload?.workflow;
        if (!wf) return;

        state.workflowById[wf.workflow_id] = wf;

        const idx = (state.workflows || []).findIndex(
          (x) => x.workflow_id === wf.workflow_id
        );
        if (idx >= 0) state.workflows[idx] = wf;
      })
      .addCase(getWorkflow.rejected, (state, action) => {
        setOpLoading(state, "getWorkflow", false);
        setOpError(state, "getWorkflow", action.payload || action.error);
      });

    // -------------------------
    // Workflow Forms
    // -------------------------
    builder
      .addCase(fetchWorkflowForms.pending, (state) => {
        setOpLoading(state, "fetchWorkflowForms", true);
        clearOpError(state, "fetchWorkflowForms");
      })
      .addCase(fetchWorkflowForms.fulfilled, (state, action) => {
        setOpLoading(state, "fetchWorkflowForms", false);
        state.workflowForms = Array.isArray(action.payload)
          ? action.payload
          : [];
        // optional: rebuild cache if payload is rows
        state.workflowFormById = {};
        (state.workflowForms || []).forEach((row) => {
          const id = row?.workflow_form_id;
          if (id != null) state.workflowFormById[Number(id)] = row;
        });
      })
      .addCase(fetchWorkflowForms.rejected, (state, action) => {
        setOpLoading(state, "fetchWorkflowForms", false);
        setOpError(state, "fetchWorkflowForms", action.payload || action.error);
      });

    builder
      .addCase(getWorkflowForm.pending, (state) => {
        setOpLoading(state, "getWorkflowForm", true);
        clearOpError(state, "getWorkflowForm");
      })
      .addCase(getWorkflowForm.fulfilled, (state, action) => {
        setOpLoading(state, "getWorkflowForm", false);

        // controller currently returns `result` from queries.getWorkflowForm()
        // which looks like `rows` array. So handle both shapes.
        const payload = action.payload;
        const row = Array.isArray(payload)
          ? payload?.[0]
          : payload?.rows?.[0] ?? payload;

        const id = row?.workflow_form_id;
        if (id != null) state.workflowFormById[Number(id)] = row;
      })
      .addCase(getWorkflowForm.rejected, (state, action) => {
        setOpLoading(state, "getWorkflowForm", false);
        setOpError(state, "getWorkflowForm", action.payload || action.error);
      });

    builder
      .addCase(assignFormToWorkflow.pending, (state) => {
        setOpLoading(state, "assignFormToWorkflow", true);
        clearOpError(state, "assignFormToWorkflow");
      })
      .addCase(assignFormToWorkflow.fulfilled, (state, action) => {
        setOpLoading(state, "assignFormToWorkflow", false);

        const row = action.payload;
        const id = row?.workflow_form_id;
        if (id != null) state.workflowFormById[Number(id)] = row;

        // keep list fresh-ish
        state.workflowForms = [row, ...(state.workflowForms || [])];
      })
      .addCase(assignFormToWorkflow.rejected, (state, action) => {
        setOpLoading(state, "assignFormToWorkflow", false);
        setOpError(
          state,
          "assignFormToWorkflow",
          action.payload || action.error
        );
      });

    builder
      .addCase(updateWorkflowForm.pending, (state) => {
        setOpLoading(state, "updateWorkflowForm", true);
        clearOpError(state, "updateWorkflowForm");
      })
      .addCase(updateWorkflowForm.fulfilled, (state, action) => {
        setOpLoading(state, "updateWorkflowForm", false);

        const row = action.payload;
        const id = row?.workflow_form_id;
        if (id != null) {
          state.workflowFormById[Number(id)] = row;
          state.workflowForms = (state.workflowForms || []).map((x) =>
            Number(x.workflow_form_id) === Number(id) ? row : x
          );
        }
      })
      .addCase(updateWorkflowForm.rejected, (state, action) => {
        setOpLoading(state, "updateWorkflowForm", false);
        setOpError(state, "updateWorkflowForm", action.payload || action.error);
      });

    builder
      .addCase(removeWorkflowForm.pending, (state) => {
        setOpLoading(state, "removeWorkflowForm", true);
        clearOpError(state, "removeWorkflowForm");
      })
      .addCase(removeWorkflowForm.fulfilled, (state, action) => {
        setOpLoading(state, "removeWorkflowForm", false);

        const id = Number(action.payload?.workflowFormId);
        if (!Number.isNaN(id)) {
          delete state.workflowFormById[id];
          state.workflowForms = (state.workflowForms || []).filter(
            (x) => Number(x.workflow_form_id) !== id
          );
        }
      })
      .addCase(removeWorkflowForm.rejected, (state, action) => {
        setOpLoading(state, "removeWorkflowForm", false);
        setOpError(state, "removeWorkflowForm", action.payload || action.error);
      });

    builder
      .addCase(removeWorkflowFormFromWorkflow.pending, (state) => {
        setOpLoading(state, "removeWorkflowFormFromWorkflow", true);
        clearOpError(state, "removeWorkflowFormFromWorkflow");
      })
      .addCase(removeWorkflowFormFromWorkflow.fulfilled, (state, action) => {
        setOpLoading(state, "removeWorkflowFormFromWorkflow", false);

        const id = Number(action.payload?.workflowFormId);
        if (!Number.isNaN(id)) {
          delete state.workflowFormById[id];
          state.workflowForms = (state.workflowForms || []).filter(
            (x) => Number(x.workflow_form_id) !== id
          );
        }
      })
      .addCase(removeWorkflowFormFromWorkflow.rejected, (state, action) => {
        setOpLoading(state, "removeWorkflowFormFromWorkflow", false);
        setOpError(
          state,
          "removeWorkflowFormFromWorkflow",
          action.payload || action.error
        );
      });

    // -------------------------
    // Runs
    // -------------------------
    builder
      .addCase(createWorkflowRun.pending, (state) => {
        setOpLoading(state, "createRun", true);
        clearOpError(state, "createRun");
      })
      .addCase(createWorkflowRun.fulfilled, (state, action) => {
        setOpLoading(state, "createRun", false);

        const run = action.payload?.run;
        if (run?.workflow_run_id) {
          state.dashboardsByRunId[run.workflow_run_id] = {
            ...run,
            items: [],
            required_total: action.payload?.status?.required_total ?? 0,
            required_done: action.payload?.status?.required_done ?? 0,
          };
        }
      })
      .addCase(createWorkflowRun.rejected, (state, action) => {
        setOpLoading(state, "createRun", false);
        setOpError(state, "createRun", action.payload);
      });

    builder
      .addCase(fetchWorkflowRunDashboard.pending, (state) => {
        setOpLoading(state, "fetchRunDashboard", true);
        clearOpError(state, "fetchRunDashboard");
      })
      .addCase(fetchWorkflowRunDashboard.fulfilled, (state, action) => {
        setOpLoading(state, "fetchRunDashboard", false);
        upsertDashboard(state, action.payload);
      })
      .addCase(fetchWorkflowRunDashboard.rejected, (state, action) => {
        setOpLoading(state, "fetchRunDashboard", false);
        setOpError(state, "fetchRunDashboard", action.payload);
      });

    builder
      .addCase(lockWorkflowRun.pending, (state) => {
        setOpLoading(state, "lockRun", true);
        clearOpError(state, "lockRun");
      })
      .addCase(lockWorkflowRun.fulfilled, (state, action) => {
        setOpLoading(state, "lockRun", false);
        const runId = Number(action.payload?.runId);
        const data = action.payload?.data;

        if (runId && state.dashboardsByRunId[runId]) {
          state.dashboardsByRunId[runId] = {
            ...state.dashboardsByRunId[runId],
            ...data,
          };
        }
      })
      .addCase(lockWorkflowRun.rejected, (state, action) => {
        setOpLoading(state, "lockRun", false);
        setOpError(state, "lockRun", action.payload);
      });

    builder
      .addCase(cancelWorkflowRun.pending, (state) => {
        setOpLoading(state, "cancelRun", true);
        clearOpError(state, "cancelRun");
      })
      .addCase(cancelWorkflowRun.fulfilled, (state, action) => {
        setOpLoading(state, "cancelRun", false);
        const runId = Number(action.payload?.runId);
        const data = action.payload?.data;

        if (runId && state.dashboardsByRunId[runId]) {
          state.dashboardsByRunId[runId] = {
            ...state.dashboardsByRunId[runId],
            ...data,
          };
        }
      })
      .addCase(cancelWorkflowRun.rejected, (state, action) => {
        setOpLoading(state, "cancelRun", false);
        setOpError(state, "cancelRun", action.payload);
      });

    builder
      .addCase(fetchWorkflowRuns.pending, (state) => {
        setOpLoading(state, "fetchRuns", true);
        clearOpError(state, "fetchRuns");
      })
      .addCase(fetchWorkflowRuns.fulfilled, (state, action) => {
        setOpLoading(state, "fetchRuns", false);
        state.runs = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchWorkflowRuns.rejected, (state, action) => {
        setOpLoading(state, "fetchRuns", false);
        setOpError(state, "fetchRuns", action.payload);
      });

    // -------------------------
    // Items
    // -------------------------
    builder
      .addCase(assignWorkflowItem.pending, (state) => {
        setOpLoading(state, "assignItem", true);
        clearOpError(state, "assignItem");
      })
      .addCase(assignWorkflowItem.fulfilled, (state, action) => {
        setOpLoading(state, "assignItem", false);

        const row = action.payload;
        const runId = Number(row?.workflow_run_id);
        const itemId = Number(row?.workflow_item_id);
        const assignedUserId = row?.assigned_user_id ?? null;

        updateItemInDashboard(state, runId, (dash) => {
          dash.items = dash.items.map((it) =>
            Number(it.workflow_item_id) === itemId
              ? { ...it, assigned_user_id: assignedUserId }
              : it
          );
        });
      })
      .addCase(assignWorkflowItem.rejected, (state, action) => {
        setOpLoading(state, "assignItem", false);
        setOpError(state, "assignItem", action.payload);
      });

    builder
      .addCase(startWorkflowItem.pending, (state) => {
        setOpLoading(state, "startItem", true);
        clearOpError(state, "startItem");
      })
      .addCase(startWorkflowItem.fulfilled, (state, action) => {
        setOpLoading(state, "startItem", false);

        const data = action.payload;
        const itemId = Number(data?.workflow_item_id);
        const runId = Number(data?.workflow_run_id);

        if (itemId) {
          state.itemStartByItemId[itemId] = data;
        }

        updateItemInDashboard(state, runId, (dash) => {
          dash.items = dash.items.map((it) =>
            Number(it.workflow_item_id) === itemId
              ? { ...it, status: "in_progress" }
              : it
          );
          if (dash.status === "not_started") dash.status = "in_progress";
        });
      })
      .addCase(startWorkflowItem.rejected, (state, action) => {
        setOpLoading(state, "startItem", false);
        setOpError(state, "startItem", action.payload);
      });

    builder
      .addCase(skipWorkflowItem.pending, (state) => {
        setOpLoading(state, "skipItem", true);
        clearOpError(state, "skipItem");
      })
      .addCase(skipWorkflowItem.fulfilled, (state, action) => {
        setOpLoading(state, "skipItem", false);

        const { workflow_item_id, workflow_run_id, status } =
          action.payload ?? {};
        const runId = Number(workflow_run_id);
        const itemId = Number(workflow_item_id);

        updateItemInDashboard(state, runId, (dash) => {
          dash.items = dash.items.map((it) =>
            Number(it.workflow_item_id) === itemId
              ? { ...it, status: "skipped" }
              : it
          );

          if (status?.status) dash.status = status.status;
          if (typeof status?.required_total === "number")
            dash.required_total = status.required_total;
          if (typeof status?.required_done === "number")
            dash.required_done = status.required_done;
        });
      })
      .addCase(skipWorkflowItem.rejected, (state, action) => {
        setOpLoading(state, "skipItem", false);
        setOpError(state, "skipItem", action.payload);
      });

    builder
      .addCase(addRepeatWorkflowItem.pending, (state) => {
        setOpLoading(state, "addRepeatItem", true);
        clearOpError(state, "addRepeatItem");
      })
      .addCase(addRepeatWorkflowItem.fulfilled, (state, action) => {
        setOpLoading(state, "addRepeatItem", false);

        const { item, status } = action.payload ?? {};
        const runId = Number(item?.workflow_run_id);

        if (runId && state.dashboardsByRunId[runId]) {
          state.dashboardsByRunId[runId].items = [
            ...(state.dashboardsByRunId[runId].items ?? []),
            {
              workflow_item_id: item.workflow_item_id,
              workflow_form_id: item.workflow_form_id,
              sequence_num: item.sequence_num,
              status: item.status,
              assigned_user_id: item.assigned_user_id,
            },
          ];

          if (status?.status)
            state.dashboardsByRunId[runId].status = status.status;
          if (typeof status?.required_total === "number")
            state.dashboardsByRunId[runId].required_total =
              status.required_total;
          if (typeof status?.required_done === "number")
            state.dashboardsByRunId[runId].required_done = status.required_done;
        }
      })
      .addCase(addRepeatWorkflowItem.rejected, (state, action) => {
        setOpLoading(state, "addRepeatItem", false);
        setOpError(state, "addRepeatItem", action.payload);
      });

    builder
      .addCase(markWorkflowItemSubmitted.pending, (state) => {
        setOpLoading(state, "markSubmitted", true);
        clearOpError(state, "markSubmitted");
      })
      .addCase(markWorkflowItemSubmitted.fulfilled, (state, action) => {
        setOpLoading(state, "markSubmitted", false);

        const { workflow_item_id, workflow_run_id, status } =
          action.payload ?? {};
        const runId = Number(workflow_run_id);
        const itemId = Number(workflow_item_id);

        updateItemInDashboard(state, runId, (dash) => {
          dash.items = dash.items.map((it) =>
            Number(it.workflow_item_id) === itemId
              ? { ...it, status: "submitted" }
              : it
          );

          if (status?.status) dash.status = status.status;
          if (typeof status?.required_total === "number")
            dash.required_total = status.required_total;
          if (typeof status?.required_done === "number")
            dash.required_done = status.required_done;
        });
      })
      .addCase(markWorkflowItemSubmitted.rejected, (state, action) => {
        setOpLoading(state, "markSubmitted", false);
        setOpError(state, "markSubmitted", action.payload);
      });

    builder
      .addCase(fetchAssignableForms.pending, (state) => {
        setOpLoading(state, "fetchAssignableForms", true);
        clearOpError(state, "fetchAssignableForms");
      })
      .addCase(fetchAssignableForms.fulfilled, (state, action) => {
        setOpLoading(state, "fetchAssignableForms", false);

        state.assignableForms = action.payload;
      })
      .addCase(fetchAssignableForms.rejected, (state, action) => {
        setOpLoading(state, "fetchAssignableForms", false);
        setOpError(state, "fetchAssignableForms", action.payload);
      });
  },
});

export const { clearWorkflowErrors, clearWorkflowRunDashboard } =
  workflowSlice.actions;

export default workflowSlice.reducer;

// -------------------------
// Selectors
// -------------------------
export const selectWorkflowDashboards = (state) =>
  state.workflows?.dashboardsByRunId ?? {};

export const selectWorkflowDashboardByRunId = (runId) => (state) =>
  state.workflows?.dashboardsByRunId?.[Number(runId)] ?? null;

export const selectWorkflowItemsByRunId = (runId) => (state) =>
  state.workflows?.dashboardsByRunId?.[Number(runId)]?.items ?? [];

export const selectStartResultByItemId = (itemId) => (state) =>
  state.workflows?.itemStartByItemId?.[Number(itemId)] ?? null;

// Templates (workflow templates list)
export const selectWorkflowTemplates = (state) =>
  state.workflows?.workflows ?? [];

// Single template cache
export const selectWorkflowById = (workflowId) => (state) =>
  state.workflows?.workflowById?.[Number(workflowId)] ?? null;

export const selectAssignableForms = (state) => state.workflows.assignableForms;

// Forms list + cache
export const selectWorkflowForms = (state) =>
  state.workflows?.workflowForms ?? [];

export const selectWorkflowFormById = (workflowFormId) => (state) =>
  state.workflows?.workflowFormById?.[Number(workflowFormId)] ?? null;

// Runs list
export const selectWorkflowRuns = (state) => state.workflows?.runs ?? [];

// Operation state helpers
export const selectWorkflowLoading = (op) => (state) =>
  Boolean(state.workflows?.loading?.[op]);

export const selectWorkflowError = (op) => (state) =>
  state.workflows?.error?.[op] ?? null;

// Kept from your original slice (unrelated to workflows router)
export const selectWorkflowAssignableForms = (state) =>
  state.workflows?.assignableForms ?? [];
