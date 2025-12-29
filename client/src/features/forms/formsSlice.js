import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { http } from "../../api/http";

// ------------------------------------------
// Thunks
// ------------------------------------------

/**
 * Admin list
 * GET /api/forms
 * Returns: { forms: [...] }
 */
export const fetchForms = createAsyncThunk(
  "forms/fetchForms",
  async (_, { rejectWithValue }) => {
    try {
      const res = await http.get("/api/forms");
      return res.data?.forms ?? [];
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to load forms"
      );
    }
  }
);

export const getForm = createAsyncThunk(
  "forms/getFormDetail",
  async (formKey, { rejectWithValue }) => {
    try {
      const res = await http.get(`/api/forms/${formKey}`);
      // backend should return the full form object
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to load form"
      );
    }
  }
);

export const getUserSessionData = createAsyncThunk(
  "forms/getUserSessionData",
  async ({ formKey, sessionToken }, { rejectWithValue }) => {
    try {
      const res = await http.get(`/api/forms/${formKey}/${sessionToken}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to load form"
      );
    }
  }
);

/**
 * End-user list
 * GET /api/forms/published
 * Returns: { forms: [...] }
 */
export const fetchPublishedForms = createAsyncThunk(
  "forms/fetchPublishedForms",
  async (_, { rejectWithValue }) => {
    try {
      const res = await http.get("/api/forms/published");
      return res.data?.forms ?? [];
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to load published forms"
      );
    }
  }
);

export const saveDraft = createAsyncThunk(
  "forms/saveDraft",
  async ({ response, response_values }, { rejectWithValue }) => {
    try {
      const res = await http.post(`/api/forms/draft`, {
        response,
        response_values,
      });
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to save draft"
      );
    }
  }
);

/**
 * Create full form graph
 * POST /api/forms
 * Returns: { form_id: number }
 */
export const createForm = createAsyncThunk(
  "forms/createForm",
  async (payload, { rejectWithValue }) => {
    try {
      const res = await http.post("/api/forms", payload);
      // expecting { form_id }
      return res.data;
    } catch (err) {
      // Your controller returns { error, problems } on 400 and { error, details } on 500/409
      const data = err?.response?.data;
      const msg =
        data?.message ||
        data?.error ||
        (Array.isArray(data?.problems) ? data.problems.join(", ") : null) ||
        "Failed to create form";

      return rejectWithValue(msg);
    }
  }
);

export const updateForm = createAsyncThunk(
  "forms/updateForm",
  async ({ formKey, payload }, { rejectWithValue }) => {
    try {
      const res = await http.put(`/api/forms/${formKey}`, payload);
      return res.data;
    } catch (err) {
      const data = err?.response?.data;
      const msg =
        data?.message ||
        data?.error ||
        (Array.isArray(data?.problems) ? data.problems.join(", ") : null) ||
        "Failed to create form";

      return rejectWithValue(msg);
    }
  }
);

// ------------------------------------------
// Slice
// ------------------------------------------

const initialState = {
  status: "idle",
  error: null,

  forms: [],
  publishedForms: [],

  createStatus: "idle",
  createError: null,
  createdFormId: null,

  currentForm: null,
  currentFormStatus: "idle",
  currentFormError: null,

  draftSaveStatus: "idle",
  draftSaveError: null,
  lastDraftSave: null,

  sessionData: null,
  sessionDataStatus: "idle",
  sessionDataError: null,

  updatedFormId: null,
  updatedFormStatus: "idle",
  updatedFormError: null,
};

const formSlice = createSlice({
  name: "forms",
  initialState,
  reducers: {
    clearFormError(state) {
      state.error = null;
      state.createError = null;
    },
    resetCreateState(state) {
      state.createStatus = "idle";
      state.createError = null;
      state.createdFormId = null;
    },
    resetDraftSaveState(state) {
      state.draftSaveStatus = "idle";
      state.draftSaveError = null;
      state.lastDraftSave = null;
    },

    resetUpdateState(state) {
      state.updatedFormError = null;
      state.updatedFormStatus = "idle";
      state.updatedFormId = null;
    },
  },
  extraReducers: (builder) => {
    // ----------------------------
    // fetchForms (admin)
    // ----------------------------
    builder
      .addCase(fetchForms.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchForms.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.forms = action.payload;
        state.error = null;
      })
      .addCase(fetchForms.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || "Failed to load forms";
      });

    // ----------------------------
    // fetchPublishedForms (end-user)
    // ----------------------------
    builder
      .addCase(fetchPublishedForms.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchPublishedForms.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.publishedForms = action.payload;
        state.error = null;
      })
      .addCase(fetchPublishedForms.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || "Failed to load published forms";
      });

    // ----------------------------
    // createForm
    // ----------------------------
    builder
      .addCase(createForm.pending, (state) => {
        state.createStatus = "loading";
        state.createError = null;
        state.createdFormId = null;
      })
      .addCase(createForm.fulfilled, (state, action) => {
        state.createStatus = "succeeded";
        state.createError = null;
        state.createdFormId = action.payload?.form_id ?? null;

        // Optional: optimistic add to admin list
        // If your API doesn't return the created form object, we can't fully add it here.
        // We'll just leave lists alone and you can refetch if needed.
      })
      .addCase(createForm.rejected, (state, action) => {
        state.createStatus = "failed";
        state.createError = action.payload || "Failed to create form";
      });

    // ----------------------------
    // updateForm
    // ----------------------------
    builder
      .addCase(updateForm.pending, (state) => {
        state.updatedFormStatus = "loading";
        state.updatedFormError = null;
        state.updatedFormId = null;
      })
      .addCase(updateForm.fulfilled, (state, action) => {
        state.updatedFormStatus = "succeeded";
        state.updatedFormError = null;
        state.updatedFormId = action.payload?.form_id ?? null;

        // Optional: optimistic add to admin list
        // If your API doesn't return the created form object, we can't fully add it here.
        // We'll just leave lists alone and you can refetch if needed.
      })
      .addCase(updateForm.rejected, (state, action) => {
        state.updatedFormStatus = "failed";
        state.updatedFormError = action.error || "Failed to create form";
      });

    // -------------------------------
    // Get Form Details
    // -------------------------------

    builder
      .addCase(getForm.pending, (state) => {
        state.currentFormStatus = "loading";
        state.currentFormError = null;
        state.currentForm = null;
      })
      .addCase(getForm.fulfilled, (state, action) => {
        state.currentFormStatus = "succeeded";
        state.currentForm = action.payload;
        state.currentFormError = null;
      })
      .addCase(getForm.rejected, (state, action) => {
        state.currentFormStatus = "failed";
        state.currentFormError = action.payload || "Failed to load form";
        state.currentForm = null;
      });

    // -------------------------------
    // Save Draft
    // -------------------------------
    builder
      .addCase(saveDraft.pending, (state) => {
        state.draftSaveStatus = "loading";
        state.draftSaveError = null;
      })
      .addCase(saveDraft.fulfilled, (state, action) => {
        state.draftSaveStatus = "succeeded";
        state.draftSaveError = null;
        state.lastDraftSave = action.payload; // contains response_id/session/etc
      })
      .addCase(saveDraft.rejected, (state, action) => {
        state.draftSaveStatus = "failed";
        state.draftSaveError = action.error.message || "Failed to save draft";
      });

    // -----------------------
    // Load Session Data
    // -----------------------
    builder
      .addCase(getUserSessionData.pending, (state) => {
        state.sessionDataStatus = "loading";
        state.sessionDataError = null;
      })
      .addCase(getUserSessionData.fulfilled, (state, action) => {
        state.sessionDataStatus = "succeeded";
        state.sessionDataError = null;
        state.sessionData = action.payload; // contains response_id/session/etc
      })
      .addCase(getUserSessionData.rejected, (state, action) => {
        state.sessionDataStatus = "failed";
        state.sessionDataError =
          action.error.message || "Failed to Retrieve Session";
      });
  },
});

export const {
  clearFormError,
  resetCreateState,
  resetDraftSaveState,
  resetUpdateState,
} = formSlice.actions;
export default formSlice.reducer;

// ------------------------------------------
// Selectors
// ------------------------------------------
export const selectFormsState = (state) => state.forms;
export const selectForms = (state) => state.forms.forms;
export const selectPublishedForms = (state) => state.forms.publishedForms;

export const selectFormsStatus = (state) => state.forms.status;
export const selectFormsError = (state) => state.forms.error;

export const selectCreateFormStatus = (state) => state.forms.createStatus;
export const selectCreateFormError = (state) => state.forms.createError;
export const selectCreatedFormId = (state) => state.forms.createdFormId;

export const selectUpdatedFormStatus = (state) => state.forms.updatedFormStatus;
export const selectUpdatedFormId = (state) => state.forms.updatedFormId;
export const selectUpdatedFormError = (state) => state.forms.updatedFormError;

export const selectCurrentForm = (state) => state.forms.currentForm;
export const selectCurrentFormStatus = (state) => state.forms.currentFormStatus;
export const selectCurrentFormError = (state) => state.forms.currentFormError;

export const selectDraftSaveStatus = (state) => state.forms.draftSaveStatus;
export const selectDraftSaveError = (state) => state.forms.draftSaveError;
export const selectLastDraftSave = (state) => state.forms.lastDraftSave;

export const selectSessionDataStatus = (state) => state.forms.sessionDataStatus;
export const selectSessionDataError = (state) => state.forms.sessionDataError;
export const selectSessionData = (state) => state.forms.sessionData;
