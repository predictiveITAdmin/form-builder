import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { http } from "../../api/http";

export const getResponses = createAsyncThunk(
  "responses/getAllResponses",
  async (_, { rejectWithValue }) => {
    try {
      const res = await http.get("/api/responses");
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data || err?.message || "Could not Fetch Responses."
      );
    }
  }
);

export const getResponseById = createAsyncThunk(
  "responses/getResponse",
  async (responseId, { rejectWithValue }) => {
    try {
      const res = await http.get(`/api/responses/${responseId}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data ||
          err?.message ||
          "Could not fetch Response Details. Please re-check the ID"
      );
    }
  }
);

export const deleteResponse = createAsyncThunk(
  "responses/deleteResponse",
  async (responseId, { rejectWithValue }) => {
    try {
      const res = await http.delete(`/api/responses/${responseId}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data || err?.message || "Could not delete Response."
      );
    }
  }
);

const initialState = {
  responseList: null,
  responseListStatus: "idle",
  responseListError: null,

  response: null,
  responseStatus: "idle",
  responseError: null,
};

const responseSlice = createSlice({
  name: "responses",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getResponses.pending, (state) => {
        state.responseListStatus = "loading";
        state.responseListError = null;
      })
      .addCase(getResponses.fulfilled, (state, action) => {
        state.responseList = action.payload;
        state.responseListStatus = "succeeded";
        state.responseListError = null;
      })
      .addCase(getResponses.rejected, (state, action) => {
        state.responseList = null;
        state.responseListError = action.payload;
        state.responseListStatus = "failed";
      });

    builder
      .addCase(getResponseById.pending, (state) => {
        state.responseStatus = "loading";
        state.responseError = null;
      })
      .addCase(getResponseById.fulfilled, (state, action) => {
        state.response = action.payload;
        state.responseStatus = "succeeded";
        state.responseError = null;
      })
      .addCase(getResponseById.rejected, (state, action) => {
        state.response = null;
        state.responseError = action.payload;
        state.responseStatus = "failed";
      });
  },
});

export default responseSlice.reducer;

export const selectResponse = (state) => state.responses.response;
export const selectResponseList = (state) => state.responses.responseList;

export const selectResponseStatus = (state) => state.responses.responseStatus;
export const selectResponseError = (state) => state.responses.responseError;

export const selectResponseListStatus = (state) =>
  state.responses.responseListStatus;
export const selectResponseListError = (state) =>
  state.responses.responseListError;
