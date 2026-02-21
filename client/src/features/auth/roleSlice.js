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
        err?.response?.data?.message || "Failed to Edit Roles"
      );
    }
  }
);

export const deleteUser = createAsyncThunk(
  "auth/deleteUser",
  async (userId, { rejectWithValue }) => {
    try {
      const res = await http.delete(`/api/auth/users/${userId}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || "Failed to delete user"
      );
    }
  }
);

export const addNewRole = createAsyncThunk(
  "auth/addRole",
  async (payload, { rejectWithValue }) => {
    try {
      const res = await http.post(`/api/auth/roles`, payload);
      return res.data;
    } catch (err) {
      return rejectWithValue(err || "Failed to Add Role");
    }
  }
);

export const editRole = createAsyncThunk(
  "auth/editRole",
  async ({ role_id, payload }, { rejectWithValue }) => {
    try {
      const res = await http.put(`api/auth/roles/${role_id}`, payload);

      return res.data;
    } catch (err) {
      return rejectWithValue(err || "Failed to Edit Role");
    }
  }
);

export const getPermissionsforRole = createAsyncThunk(
  "auth/listPermissionsForRole",
  async (roleId, { rejectWithValue }) => {
    try {
      const res = await http.get(`api/auth/roles/permissions/${roleId}`);
      return res.data;
    } catch (err) {
      rejectWithValue(err || "Could not get Permissions");
    }
  }
);

export const listPermissions = createAsyncThunk(
  "auth/listPermissions",
  async (_, { rejectWithValue }) => {
    try {
      const res = await http.get(`api/auth/permissions`);
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || "Failed to get permissions"
      );
    }
  }
);

export const assignPermissions = createAsyncThunk(
  "auth/assignPermission",
  async ({ role_id, permission_ids }, { rejectWithValue }) => {
    try {
      const res = await http.put(`api/auth/roles/permissions`, {
        role_id,
        permission_ids,
      });
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || "Failed to Add Permissions"
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

  // Edit
  editRoleStatus: "idle",
  editRole: null,
  editRoleError: null,

  // Add Role
  addRoleStatus: "idle",
  addRole: null,
  addRoleError: null,

  // SetPermission on Role
  setRolePermissionStatus: "idle",
  setRolePermission: null,
  setRolePermissionError: null,

  // GetPermission on Role
  getRolePermissionStatus: "idle",
  getRolePermission: null,
  getRolePermissionError: null,

  // List Permissions on Role
  getPermissionStatus: "idle",
  getPermission: null,
  getPermissionError: null,

  // Remove Role
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
  reducers: {
    clearRoleState: (state) => {
      state.addRole = null;
      state.addRoleError = null;
      state.addRoleStatus = "idle";
      state.setRolePermission = null;
      state.setRolePermissionStatus = "idle";
      state.setRolePermissionError = null;
    },
  },

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
        const error = action.payload;

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
        const error = action.payload;

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
        const error = action.payload;

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
        const error = action.payload;

        state.editUserStatus = "failed";
        (state.editUser = null),
          (state.editUserError =
            error || "Something went wrong. Could not get Users");
      });

    builder
      .addCase(addNewRole.pending, (state) => {
        (state.addRoleStatus = "loading"),
          (state.addRoleError = null),
          (state.addRole = null);
      })
      .addCase(addNewRole.fulfilled, (state, action) => {
        const role = action.payload;
        (state.addRoleStatus = "success"),
          (state.addRole = role),
          (state.addRoleError = null);
      })
      .addCase(addNewRole.rejected, (state, action) => {
        const error = action.payload;

        state.addRoleStatus = "failed";
        (state.addRole = null),
          (state.addRoleError =
            error.response.data.error ||
            "Something went wrong. Could not Create Role");
      });

    builder
      .addCase(listPermissions.pending, (state) => {
        (state.getPermissionStatus = "loading"),
          (state.getPermissionError = null),
          (state.getPermission = null);
      })
      .addCase(listPermissions.fulfilled, (state, action) => {
        const permissions = action.payload;
        (state.getPermissionStatus = "success"),
          (state.getPermission = permissions),
          (state.getPermissionError = null);
      })
      .addCase(listPermissions.rejected, (state, action) => {
        const error = action.payload;

        state.getPermissionStatus = "failed";
        (state.getPermission = null),
          (state.getPermissionError =
            error.response.data.error ||
            "Something went wrong. Could not Create Role");
      });

    builder
      .addCase(assignPermissions.pending, (state) => {
        (state.setRolePermissionStatus = "loading"),
          (state.setRolePermissionError = null),
          (state.setRolePermission = null);
      })
      .addCase(assignPermissions.fulfilled, (state, action) => {
        const permissions = action.payload;
        (state.setRolePermissionStatus = "success"),
          (state.setRolePermission = permissions),
          (state.setRolePermissionError = null);
      })
      .addCase(assignPermissions.rejected, (state, action) => {
        const error = action.payload;

        state.setRolePermissionStatus = "failed";
        (state.setRolePermission = null),
          (state.setRolePermissionError =
            error.response.data.error ||
            "Something went wrong. Could not Assign Permissions");
      });

    builder
      .addCase(getPermissionsforRole.pending, (state) => {
        (state.getRolePermissionStatus = "loading"),
          (state.getRolePermissionError = null),
          (state.getRolePermission = null);
      })
      .addCase(getPermissionsforRole.fulfilled, (state, action) => {
        const permissions = action.payload;
        (state.getRolePermissionStatus = "success"),
          (state.getRolePermission = permissions),
          (state.getRolePermissionError = null);
      })
      .addCase(getPermissionsforRole.rejected, (state, action) => {
        const error = action.payload;

        state.getRolePermissionStatus = "failed";
        (state.getRolePermission = null),
          (state.getRolePermissionError =
            error.response.data.error ||
            "Something went wrong. Could not Assign Permissions");
      });
  },
});

export default roleSlice.reducer;

export const { clearRoleState } = roleSlice.actions;

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

export const selectAddRole = (state) => state.roles.addRole;
export const selectAddRoleStatus = (state) => state.roles.addRoleStatus;
export const selectAddRoleError = (state) => state.roles.addRoleError;

export const selectGetPermission = (state) => state.roles.getPermission;
export const selectGetPermissionStatus = (state) =>
  state.roles.getPermissionStatus;
export const selectGetPermissionError = (state) =>
  state.roles.getPermissionError;

export const selectGetRolePermission = (state) => state.roles.getRolePermission;
export const selectGetRolePermissionStatus = (state) =>
  state.roles.getRolePermissionStatus;
export const selectGetRolePermissionError = (state) =>
  state.roles.getRolePermissionError;
