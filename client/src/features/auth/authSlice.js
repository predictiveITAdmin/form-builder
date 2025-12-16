import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { http } from "../../api/http";

// ------------------------------------------
// Helpers
// ------------------------------------------
const normalizeUserType = (user) => {
  const raw = user?.userType ?? user?.user_type ?? "";
  return String(raw).toLowerCase(); // "internal" | "external" | ""
};

const shouldClearToken = (err) => {
  const status = err?.response?.status;
  return status === 401 || status === 403;
};

// ------------------------------------------
// Thunks
// ------------------------------------------

/**
 * External login (JWT)
 * Backend returns { token, user, message }
 */
export const loginExternal = createAsyncThunk(
  "auth/loginExternal",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const res = await http.post("/api/auth/login", { email, password });

      if (res.data?.token) {
        localStorage.setItem("token", res.data.token);
      }

      // We still call /me afterward to unify behavior, but returning user is fine too.
      return res.data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || "Login failed");
    }
  }
);

/**
 * Load session on app boot
 * Works for:
 * - Azure cookie session (internal)
 * - External JWT (Authorization header via interceptor)
 */
export const loadSession = createAsyncThunk(
  "auth/loadSession",
  async (_, { rejectWithValue }) => {
    try {
      const res = await http.get("/api/auth/me");
      return {
        user: res.data?.data ?? null,
        token: localStorage.getItem("token") || null,
      };
    } catch (err) {
      if (shouldClearToken(err)) localStorage.removeItem("token");
      return rejectWithValue(
        err?.response?.data?.message || "Not authenticated"
      );
    }
  }
);

/**
 * Explicitly refresh user from server (same as loadSession but doesn't touch token)
 */
export const refreshUser = createAsyncThunk(
  "auth/refreshUser",
  async (_, { rejectWithValue }) => {
    try {
      const res = await http.get("/api/auth/me");
      return res.data?.data ?? null;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || "Failed to refresh user"
      );
    }
  }
);

export const logoutUser = createAsyncThunk(
  "auth/logoutUser",
  async (_, { dispatch }) => {
    try {
      // Clear server-side session (kills connect.sid)
      await http.post("/api/auth/logout");
    } catch {
      // Ignore errors. Logout is not a negotiation.
    }
    dispatch(logout());

    localStorage.removeItem("token");
  }
);

/**
 * Azure callback handler:
 * In most setups, Azure redirect hits backend first, backend sets cookie/session,
 * then frontend just calls /me.
 */
export const handleAzureCallback = createAsyncThunk(
  "auth/handleAzureCallback",
  async (_, { rejectWithValue }) => {
    try {
      const res = await http.get("/api/auth/me");
      return res.data?.data ?? null;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || "Azure authentication failed"
      );
    }
  }
);

// ------------------------------------------
// Slice
// ------------------------------------------

const initialState = {
  status: "idle", // 'idle' | 'loading' | 'succeeded' | 'failed'
  isAuthenticated: false, // derived: Boolean(user || token)
  token: localStorage.getItem("token") || null, // survive refresh (storage)
  user: null,
  error: null,

  authMode: null, // 'jwt' | 'azure' | null (optional but useful)
  isAzureUser: false, // derived from userType
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      state.status = "idle";
      state.isAuthenticated = false;
      state.token = null;
      state.user = null;
      state.error = null;
      state.authMode = null;
      state.isAzureUser = false;
      localStorage.removeItem("token");
    },

    clearError(state) {
      state.error = null;
    },

    updateUserLocally(state, action) {
      if (state.user) state.user = { ...state.user, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    // ----------------------------
    // loadSession
    // ----------------------------
    builder
      .addCase(loadSession.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loadSession.fulfilled, (state, action) => {
        const { user, token } = action.payload;

        state.status = "succeeded";
        state.user = user;
        state.token = token;

        state.isAuthenticated = Boolean(user || token);

        const userType = normalizeUserType(user);
        state.isAzureUser = userType === "internal";

        // Determine auth mode:
        // - If we have a token, it's jwt
        // - If no token but user exists (cookie session), call it azure
        state.authMode = token ? "jwt" : user ? "azure" : null;

        state.error = null;
      })
      .addCase(loadSession.rejected, (state, action) => {
        state.status = "failed";
        state.user = null;

        // Keep token if we didn't explicitly clear it (we already cleared on 401/403 in thunk).
        state.token = localStorage.getItem("token") || null;

        state.isAuthenticated = false;
        state.isAzureUser = false;
        state.authMode = null;
        state.error = action.payload || "Session failed";
      });

    // ----------------------------
    // loginExternal
    // ----------------------------
    builder
      .addCase(loginExternal.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loginExternal.fulfilled, (state, action) => {
        const token =
          action.payload?.token || localStorage.getItem("token") || null;
        const user = action.payload?.user || null;

        state.status = "succeeded";
        state.token = token;
        state.user = user;
        state.isAuthenticated = Boolean(token || user);

        state.authMode = "jwt";
        state.isAzureUser = false;
        state.error = null;
      })
      .addCase(loginExternal.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || "Login failed";
        state.isAuthenticated = false;
      });

    // ----------------------------
    // refreshUser
    // ----------------------------
    builder
      .addCase(refreshUser.fulfilled, (state, action) => {
        const user = action.payload;
        state.user = user;

        const userType = normalizeUserType(user);
        state.isAzureUser = userType === "internal";

        // Auth stays true if we still have user/token
        state.isAuthenticated = Boolean(state.token || user);

        // Update auth mode if needed
        state.authMode = state.token ? "jwt" : user ? "azure" : null;
      })
      .addCase(refreshUser.rejected, (state, action) => {
        state.error = action.payload || "Failed to refresh user";
      });

    // ----------------------------
    // handleAzureCallback
    // ----------------------------
    builder
      .addCase(handleAzureCallback.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(handleAzureCallback.fulfilled, (state, action) => {
        const user = action.payload;

        state.status = "succeeded";
        state.user = user;

        // Azure is typically cookie-session based, no token required
        state.token = localStorage.getItem("token") || null;

        state.isAuthenticated = Boolean(user || state.token);

        const userType = normalizeUserType(user);
        state.isAzureUser = userType === "internal";

        state.authMode = user ? "azure" : state.token ? "jwt" : null;
        state.error = null;
      })
      .addCase(handleAzureCallback.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || "Azure authentication failed";
        state.isAuthenticated = false;
      });
  },
});

export const { logout, clearError, updateUserLocally } = authSlice.actions;
export default authSlice.reducer;

// ------------------------------------------
// Selectors
// ------------------------------------------
export const selectAuth = (state) => state.auth;
export const selectUser = (state) => state.auth.user;
export const selectToken = (state) => state.auth.token;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectAuthStatus = (state) => state.auth.status;
export const selectAuthError = (state) => state.auth.error;
export const selectIsAzureUser = (state) => state.auth.isAzureUser;
export const selectAuthMode = (state) => state.auth.authMode;
