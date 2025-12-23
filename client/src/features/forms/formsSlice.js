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

// ------------------------------------------
// Slice
// ------------------------------------------

const initialState = {
  status: "idle", // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,

  // Lists
  forms: [], // admin list
  publishedForms: [], // end-user list

  // Create
  createStatus: "idle", // 'idle' | 'loading' | 'succeeded' | 'failed'
  createError: null,
  createdFormId: null,

  currentForm: null,
  currentFormStatus: "idle", // 'idle' | 'loading' | 'succeeded' | 'failed'
  currentFormError: null,
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
  },
});

export const { clearFormError, resetCreateState } = formSlice.actions;
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

export const selectCurrentForm = (state) => state.forms.currentForm;
export const selectCurrentFormStatus = (state) => state.forms.currentFormStatus;
export const selectCurrentFormError = (state) => state.forms.currentFormError;
