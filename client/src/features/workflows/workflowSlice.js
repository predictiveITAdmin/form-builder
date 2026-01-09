import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { http } from "@/api/http"; // your pre-configured axios instance

function toErrorPayload(err) {
  const status = err?.response?.status ?? null;
  const data = err?.response?.data ?? null;
  const message =
    data?.error ||
    data?.message ||
    err?.message ||
    "Something broke. Probably on purpose.";

  return { status, message, data };
}

// -------------------------
// Thunks
// -------------------------
export const createWorkflow = createAsyncThunk(
  "workflows/createWorkflow",
  async (
    { title, workflow_key, description, status = "Active" },
    { rejectWithValue }
  ) => {
    try {
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
      const res = await http.get(`/api/workflows/workflows/${workflowId}`);
      return res.data; // { workflow }
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

export const createWorkflowRun = createAsyncThunk(
  "workflows/createRun",
  async ({ workflow_id, display_name }, { rejectWithValue }) => {
    try {
      const res = await http.post("/api/workflows/workflow-runs", {
        workflow_id,
        display_name,
      });
      return res.data;
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

export const fetchWorkflowRunDashboard = createAsyncThunk(
  "workflows/fetchRunDashboard",
  async ({ runId }, { rejectWithValue }) => {
    try {
      const res = await http.get(`/api/workflows/workflow-runs/${runId}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

export const lockWorkflowRun = createAsyncThunk(
  "workflows/lockRun",
  async ({ runId }, { rejectWithValue }) => {
    try {
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

export const assignWorkflowItem = createAsyncThunk(
  "workflows/assignItem",
  async ({ itemId, assigned_user_id }, { rejectWithValue }) => {
    try {
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

export const fetchWorkflows = createAsyncThunk(
  "workflows/fetchWorkflows",
  async (_, { rejectWithValue }) => {
    try {
      const res = await http.get("/api/workflows/workflows");
      return res.data; // expect array
    } catch (err) {
      return rejectWithValue(toErrorPayload(err));
    }
  }
);

// workflowSlice.js
export const fetchWorkflowRuns = createAsyncThunk(
  "workflows/fetchRuns",
  async (
    { mine = false, workflow_id = null, status = null } = {},
    { rejectWithValue }
  ) => {
    try {
      const params = new URLSearchParams();
      if (mine) params.set("mine", "true");
      if (workflow_id) params.set("workflow_id", String(workflow_id));
      if (status) params.set("status", status);

      const qs = params.toString();
      const res = await http.get(
        `/api/workflows/workflow-runs${qs ? `?${qs}` : ""}`
      );
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

const initialState = {
  workflows: [],
  workflowById: {}, // cache workflow details by id

  dashboardsByRunId: {},

  loading: {
    fetchWorkflows: false,
    createWorkflow: false,
    getWorkflow: false,

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
    // createWorkflowRun
    builder
      .addCase(createWorkflowRun.pending, (state) => {
        setOpLoading(state, "createRun", true);
        clearOpError(state, "createRun");
      })
      .addCase(createWorkflowRun.fulfilled, (state, action) => {
        setOpLoading(state, "createRun", false);

        // action.payload = { run, status }
        // You don't have a dashboard payload here, but we can seed a lightweight dashboard-ish entry if wanted.
        const run = action.payload?.run;
        if (run?.workflow_run_id) {
          // keep it minimal; UI can immediately fetch dashboard
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

    // fetchWorkflowRunDashboard
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

    // lockWorkflowRun
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

    // cancelWorkflowRun
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
            ...data, // { status: 'cancelled', cancelled_at, ... }
          };
        }
      })
      .addCase(cancelWorkflowRun.rejected, (state, action) => {
        setOpLoading(state, "cancelRun", false);
        setOpError(state, "cancelRun", action.payload);
      });

    // assignWorkflowItem
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

    // startWorkflowItem
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

        // Optimistically reflect item as in_progress in dashboard (actual truth comes from refetch)
        updateItemInDashboard(state, runId, (dash) => {
          dash.items = dash.items.map((it) =>
            Number(it.workflow_item_id) === itemId
              ? { ...it, status: "in_progress" }
              : it
          );
          // If run was not_started, starting any item pushes it to in_progress logically
          if (dash.status === "not_started") dash.status = "in_progress";
        });
      })
      .addCase(startWorkflowItem.rejected, (state, action) => {
        setOpLoading(state, "startItem", false);
        setOpError(state, "startItem", action.payload);
      });

    // skipWorkflowItem
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

          // status includes required_total/done sometimes (depends on your query logic)
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

    // addRepeatWorkflowItem
    builder
      .addCase(addRepeatWorkflowItem.pending, (state) => {
        setOpLoading(state, "addRepeatItem", true);
        clearOpError(state, "addRepeatItem");
      })
      .addCase(addRepeatWorkflowItem.fulfilled, (state, action) => {
        setOpLoading(state, "addRepeatItem", false);

        const { item, status } = action.payload ?? {};
        const runId = Number(item?.workflow_run_id);

        // We don't have full item shape (form_title, required, etc) unless dashboard is refetched.
        // So: safest move is: no-op or append a minimal placeholder, then UI refetches dashboard.
        if (runId && state.dashboardsByRunId[runId]) {
          // Minimal placeholder so UI feels responsive
          state.dashboardsByRunId[runId].items = [
            ...(state.dashboardsByRunId[runId].items ?? []),
            {
              workflow_item_id: item.workflow_item_id,
              workflow_form_id: item.workflow_form_id,
              sequence_num: item.sequence_num,
              status: item.status,
              assigned_user_id: item.assigned_user_id,
              // other fields will appear after refetch
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

    // markWorkflowItemSubmitted
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
    // fetchWorkflows
    builder
      // ---- fetchWorkflows ----
      .addCase(fetchWorkflows.pending, (state) => {
        state.loading.fetchWorkflows = true;
        state.error.fetchWorkflows = null;
      })
      .addCase(fetchWorkflows.fulfilled, (state, action) => {
        state.loading.fetchWorkflows = false;
        state.workflows = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchWorkflows.rejected, (state, action) => {
        state.loading.fetchWorkflows = false;
        state.error.fetchWorkflows = action.payload || action.error;
      })

      // ---- createWorkflow ----
      .addCase(createWorkflow.pending, (state) => {
        state.loading.createWorkflow = true;
        state.error.createWorkflow = null;
      })
      .addCase(createWorkflow.fulfilled, (state, action) => {
        state.loading.createWorkflow = false;

        const wf = action.payload?.workflow;
        if (!wf) return;

        // Upsert into list
        const idx = (state.workflows || []).findIndex(
          (x) => x.workflow_id === wf.workflow_id
        );
        if (idx >= 0) state.workflows[idx] = wf;
        else state.workflows = [wf, ...(state.workflows || [])];

        state.workflowById[wf.workflow_id] = wf;
      })
      .addCase(createWorkflow.rejected, (state, action) => {
        state.loading.createWorkflow = false;
        state.error.createWorkflow = action.payload || action.error;
      })

      // ---- getWorkflow ----
      .addCase(getWorkflow.pending, (state) => {
        state.loading.getWorkflow = true;
        state.error.getWorkflow = null;
      })
      .addCase(getWorkflow.fulfilled, (state, action) => {
        state.loading.getWorkflow = false;

        const wf = action.payload?.workflow;
        if (!wf) return;

        state.workflowById[wf.workflow_id] = wf;

        // Keep list consistent too
        const idx = (state.workflows || []).findIndex(
          (x) => x.workflow_id === wf.workflow_id
        );
        if (idx >= 0) state.workflows[idx] = wf;
      })
      .addCase(getWorkflow.rejected, (state, action) => {
        state.loading.getWorkflow = false;
        state.error.getWorkflow = action.payload || action.error;
      });

    // fetchWorkflowRuns (optional)
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
  },
});

export const { clearWorkflowErrors, clearWorkflowRunDashboard } =
  workflowSlice.actions;

export default workflowSlice.reducer;

// -------------------------
// Selectors
// -------------------------
// ----------------------
// Selectors
// ----------------------

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

// Runs list (you need this if you import selectWorkflowRuns)
export const selectWorkflowRuns = (state) => state.workflows?.runs ?? [];

// Operation state helpers
export const selectWorkflowLoading = (op) => (state) =>
  Boolean(state.workflows?.loading?.[op]);

export const selectWorkflowError = (op) => (state) =>
  state.workflows?.error?.[op] ?? null;
