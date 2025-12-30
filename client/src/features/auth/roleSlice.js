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
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || "Failed to get Users"
      );
    }
  }
);

export const getAllRoles = createAsyncThunk(
  "auth/getAllRoles",
  async ({ includeInactive }, { rejectWithValue }) => {
    try {
      const res = await http.get(
        `/api/auth/roles?includeInactive=${includeInactive}`
      );
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || "Failed to get Roles"
      );
    }
  }
);

export const editUserDetailsAndRoles = createAsyncThunk(
  "/auth/editUserAndRoles",
  async (payload, { rejectWithValue }) => {
    try {
      const res = await http.put(`/api/auth/users/${payload.user_id}`, payload);
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || "Failed to get Roles"
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

  rolesStatus: "idle",
  allRoles: null,
  rolesError: null,

  editUser: null,
  editUserStatus: "idle",
  editUserError: null,
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
    builder
      .addCase(getAllRoles.pending, (state) => {
        (state.rolesStatus = "loading"),
          (state.rolesError = null),
          (state.allRoles = null);
      })
      .addCase(getAllRoles.fulfilled, (state, action) => {
        const user = action.payload;
        (state.rolesStatus = "success"),
          (state.allRoles = user),
          (state.rolesError = null);
      })
      .addCase(getAllRoles.rejected, (state, action) => {
        const error = action.error;

        state.rolesStatus = "failed";
        (state.allRoles = null),
          (state.rolesError =
            error || "Something went wrong. Could not get Users");
      });
    builder
      .addCase(editUserDetailsAndRoles.pending, (state) => {
        (state.editUserStatus = "loading"),
          (state.editUserError = null),
          (state.editUser = null);
      })
      .addCase(editUserDetailsAndRoles.fulfilled, (state, action) => {
        const user = action.payload;
        (state.editUserStatus = "success"),
          (state.editUser = user),
          (state.editUserError = null);
      })
      .addCase(editUserDetailsAndRoles.rejected, (state, action) => {
        const error = action.error;

        state.editUserStatus = "failed";
        (state.editUser = null),
          (state.editUserError =
            error || "Something went wrong. Could not get Users");
      });
  },
});

export default roleSlice.reducer;

export const selectUser = (state) => state.roles.user;
export const selectStatus = (state) => state.roles.status;
export const selectError = (state) => state.roles.error;
export const selectAllUser = (state) => state.roles.allUsers;
export const selectUsersStatus = (state) => state.roles.usersStatus;
export const selectUsersError = (state) => state.roles.usersError;
export const selectAllRoles = (state) => state.roles.allRoles;
export const selectRolesStatus = (state) => state.roles.rolesStatus;
export const selectRolesError = (state) => state.roles.rolesEtatus;
export const selectEditUser = (state) => state.roles.editUser;
export const selectEditStatus = (state) => state.roles.editUserStatus;
export const selectEditError = (state) => state.roles.editUserError;
