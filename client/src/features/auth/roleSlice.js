import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { http } from "../../api/http";

export const getUserbyId = createAsyncThunk(
  "auth/getUserbyId",
  async (userId, { rejectWithValue }) => {
    try {
      const res = await http.get(`/api/auth/users/${userId}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || "Failed to get User Details"
      );
    }
  }
);

export const getAllUsers = createAsyncThunk(
  "auth/getAllUsers",
  async (_, { rejectWithValue }) => {
    try {
      const res = await http.get(`/api/auth/users`);
      console.log(res);
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || "Failed to get Users"
      );
    }
  }
);

const initialState = {
  status: "idle",
  user: null,
  error: null,

  usersStatus: "idle",
  allUsers: null,
  usersError: null,
};

const roleSlice = createSlice({
  name: "roles",
  initialState,
  reducers: {},

  extraReducers: (builder) => {
    builder
      .addCase(getUserbyId.pending, (state) => {
        (state.status = "loading"), (state.error = null), (state.user = null);
      })
      .addCase(getUserbyId.fulfilled, (state, action) => {
        const user = action.payload;
        (state.status = "success"), (state.user = user), (state.error = null);
      })
      .addCase(getUserbyId.rejected, (state, action) => {
        const error = action.error;

        state.status = "failed";
        (state.user = null),
          (state.error =
            error || "Something went wrong. Could not find User details");
      });
    builder
      .addCase(getAllUsers.pending, (state) => {
        (state.usersStatus = "loading"),
          (state.usersError = null),
          (state.allUsers = null);
      })
      .addCase(getAllUsers.fulfilled, (state, action) => {
        const user = action.payload;
        (state.usersStatus = "success"),
          (state.allUsers = user),
          (state.usersError = null);
      })
      .addCase(getAllUsers.rejected, (state, action) => {
        const error = action.error;

        state.usersStatus = "failed";
        (state.allUsers = null),
          (state.usersError =
            error || "Something went wrong. Could not get Users");
      });
  },
});

export default roleSlice.reducer;

export const selectUser = (state) => state.roles.user;
export const selectAllUser = (state) => state.roles.allUsers;
export const selectError = (state) => state.roles.error;
export const selectUsersError = (state) => state.roles.usersError;
export const selectStatus = (state) => state.roles.status;
export const selectUsersStatus = (state) => state.roles.usersStatus;
