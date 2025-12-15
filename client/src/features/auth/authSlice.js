import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { http } from "../../api/http";

export const loginExternal = createAsyncThunk(
  "auth/loginExternal",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const res = await http.post("/auth/login", { email, password });
      // Store token in localStorage
      if (res.data.token) {
        localStorage.setItem("token", res.data.token);
      }
      return res.data; // { token, user, message }
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || "Login failed");
    }
  }
);

export const fetchMe = createAsyncThunk(
  "auth/fetchMe",
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        return rejectWithValue("No token found");
      }

      const res = await http.get("/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return res.data.data; // Returns user object
    } catch (err) {
      // Clear invalid token
      localStorage.removeItem("token");
      return rejectWithValue(
        err?.response?.data?.message || "Failed to fetch user data"
      );
    }
  }
);

/**
 * Load session on app boot
 * Checks if token exists and validates it with /auth/me
 */
export const loadSession = createAsyncThunk(
  "auth/loadSession",
  async (_, { rejectWithValue, dispatch }) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        return { token: null, user: null };
      }

      // Validate token and fetch user data
      const res = await http.get("/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return {
        token,
        user: res.data.data,
      };
    } catch (err) {
      // Token is invalid, clear it
      localStorage.removeItem("token");
      return rejectWithValue("Session invalid or expired");
    }
  }
);

/**
 * Handle Azure AD login callback
 * After Azure redirects back, this validates the session
 */
export const handleAzureCallback = createAsyncThunk(
  "auth/handleAzureCallback",
  async (_, { rejectWithValue }) => {
    try {
      // After Azure login, the session should be set by the backend
      // We just need to fetch the user data
      const res = await http.get("/auth/me");

      return {
        user: res.data.data,
        isAzureUser: true,
      };
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || "Azure authentication failed"
      );
    }
  }
);

/**
 * Refresh user data
 * Call this after profile updates or when you need fresh data
 */
export const refreshUser = createAsyncThunk(
  "auth/refreshUser",
  async (_, { rejectWithValue }) => {
    try {
      const res = await http.get("/auth/me");
      return res.data.data;
    } catch (err) {
      return rejectWithValue("Failed to refresh user data");
    }
  }
);

// ==========================================
// Auth Slice
// ==========================================

const authSlice = createSlice({
  name: "auth",
  initialState: {
    status: "idle", // 'idle' | 'loading' | 'succeeded' | 'failed'
    isAuthenticated: false,
    token: null,
    user: null,
    error: null,
    isAzureUser: false,
  },
  reducers: {
    /**
     * Logout user and clear all auth data
     */
    logout(state) {
      state.isAuthenticated = false;
      state.token = null;
      state.user = null;
      state.error = null;
      state.isAzureUser = false;
      state.status = "idle";
      localStorage.removeItem("token");
    },

    /**
     * Set auth data from Azure callback
     * Used when Azure redirects back with session
     */
    setAuthFromCallback(state, action) {
      const { token, user } = action.payload || {};
      state.token = token || null;
      state.user = user || null;
      state.isAuthenticated = Boolean(token || user);
      state.isAzureUser = Boolean(user?.userType === "Internal");
      if (token) localStorage.setItem("token", token);
    },

    /**
     * Clear error message
     */
    clearError(state) {
      state.error = null;
    },

    /**
     * Update user data locally (optimistic update)
     */
    updateUserLocally(state, action) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
  extraReducers: (builder) => {
    // ========================================
    // Load Session
    // ========================================
    builder
      .addCase(loadSession.pending, (state) => {
        state.status = "loading";
      })
      .addCase(loadSession.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.isAuthenticated = Boolean(action.payload.token);
        state.isAzureUser = action.payload.user?.userType === "Internal";
      })
      .addCase(loadSession.rejected, (state, action) => {
        state.status = "failed";
        state.isAuthenticated = false;
        state.token = null;
        state.user = null;
        state.error = action.payload || "Session failed";
        localStorage.removeItem("token");
      });

    // ========================================
    // Login External
    // ========================================
    builder
      .addCase(loginExternal.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loginExternal.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.isAzureUser = false;
        state.error = null;
      })
      .addCase(loginExternal.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || "Login failed";
        state.isAuthenticated = false;
      });

    // ========================================
    // Fetch Me
    // ========================================
    builder
      .addCase(fetchMe.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload;
        state.isAuthenticated = true;
        state.isAzureUser = action.payload.userType === "Internal";
        state.error = null;
      })
      .addCase(fetchMe.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || "Failed to fetch user";
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
      });

    // ========================================
    // Handle Azure Callback
    // ========================================
    builder
      .addCase(handleAzureCallback.pending, (state) => {
        state.status = "loading";
      })
      .addCase(handleAzureCallback.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.isAzureUser = true;
        state.error = null;
        // Azure uses session cookies, no token in localStorage
      })
      .addCase(handleAzureCallback.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || "Azure authentication failed";
        state.isAuthenticated = false;
      });

    // ========================================
    // Refresh User
    // ========================================
    builder
      .addCase(refreshUser.pending, (state) => {
        // Don't change status to loading for refresh
        // Keep the UI stable
      })
      .addCase(refreshUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAzureUser = action.payload.userType === "Internal";
      })
      .addCase(refreshUser.rejected, (state, action) => {
        state.error = action.payload || "Failed to refresh user";
      });
  },
});

export const { logout, setAuthFromCallback, clearError, updateUserLocally } =
  authSlice.actions;
export default authSlice.reducer;

// ==========================================
// Selectors
// ==========================================

export const selectAuth = (state) => state.auth;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectUser = (state) => state.auth.user;
export const selectAuthStatus = (state) => state.auth.status;
export const selectAuthError = (state) => state.auth.error;
export const selectIsAzureUser = (state) => state.auth.isAzureUser;
