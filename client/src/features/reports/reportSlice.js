import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { http } from "../../api/http";

export const getHomeData = createAsyncThunk(
  "analytics/home",
  async (_, { rejectWithValue }) => {
    try {
      const res = await http.get("/api/analytics/home");
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data || err?.message || "Could not get home analytics"
      );
    }
  }
);

const initialState = {
  home: {
    sessions: [],
    availableForms: [],
    recentSubmissions: [],
  },
  loading: false,
  error: null,
  lastUpdated: null,
};

const analyticsSlice = createSlice({
  name: "analytics",
  initialState,
  reducers: {
    clearAnalyticsError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getHomeData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getHomeData.fulfilled, (state, action) => {
        state.loading = false;
        state.home.sessions = action.payload.sessions || [];
        state.home.availableForms = action.payload.availableForms || [];
        state.home.recentSubmissions = action.payload.recentSubmissions || [];
        state.lastUpdated = Date.now();
      })
      .addCase(getHomeData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to load analytics";
      });
  },
});

export const { clearAnalyticsError } = analyticsSlice.actions;
export default analyticsSlice.reducer;

export const selectHomeData = (state) => state.reports.home;
export const selectLoading = (state) => state.reports.loading;
export const selectError = (state) => state.reports.error;
