import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { http } from '../../api/http';

export const fetchSettings = createAsyncThunk('settings/fetchSettings', async (_, { rejectWithValue }) => {
  try {
    const response = await http.get('/api/settings');
    if (response.data.success) {
      return response.data.settings;
    }
    return rejectWithValue(response.data.message);
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || err.message);
  }
});

export const fetchMailboxes = createAsyncThunk('settings/fetchMailboxes', async (_, { rejectWithValue }) => {
  try {
    const response = await http.get('/api/graph/mailboxes');
    // Assuming backend returns { mailboxes: [...] } directly based on our controller
    return response.data.mailboxes; 
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || err.message);
  }
});

export const saveSettings = createAsyncThunk('settings/saveSettings', async (payload, { rejectWithValue }) => {
  try {
    const response = await http.post('/api/settings', payload);
    if (response.data.success) {
      return payload.settings.reduce((acc, curr) => {
        acc[curr.property] = curr.value;
        return acc;
      }, {});
    }
    return rejectWithValue(response.data.message);
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || err.message);
  }
});

// Using a custom thunk for SQL if desired, though normally it relies on component state for responses
export const executeRawSql = createAsyncThunk('settings/executeRawSql', async (payload, { rejectWithValue }) => {
  try {
    const response = await http.post('/api/settings/query', payload);
    return response.data;
  } catch (err) {
    return rejectWithValue(err.response?.data || err.message);
  }
});

export const fetchAuditLogs = createAsyncThunk(
  'settings/fetchAuditLogs', 
  async ({ resourceType, page = 1, limit = 20 }, { rejectWithValue }) => {
    try {
      const response = await http.get(`/api/audit/${resourceType}?page=${page}&limit=${limit}`);
      if (response.data.success) {
        return response.data; // { success, data, pagination }
      }
      return rejectWithValue(response.data.message);
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState: {
    data: {},
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
    saveStatus: 'idle',
    saveError: null,
    sqlStatus: 'idle',
    sqlResult: null,
    sqlError: null,
    activeTxId: null, // Transaction ID for commit/rollback
    auditLogs: {
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      status: 'idle',
      error: null
    },
    mailboxes: {
      data: [],
      status: 'idle',
      error: null
    }
  },
  reducers: {
    resetSqlResult(state) {
      state.sqlStatus = 'idle';
      state.sqlResult = null;
      state.sqlError = null;
      state.activeTxId = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Settings
      .addCase(fetchSettings.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload;
        state.error = null;
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // Save Settings
      .addCase(saveSettings.pending, (state) => {
        state.saveStatus = 'loading';
      })
      .addCase(saveSettings.fulfilled, (state, action) => {
        state.saveStatus = 'succeeded';
        // Merge saved into current state
        state.data = { ...state.data, ...action.payload };
        state.saveError = null;
      })
      .addCase(saveSettings.rejected, (state, action) => {
        state.saveStatus = 'failed';
        state.saveError = action.payload;
      })
      // Execute SQL
      .addCase(executeRawSql.pending, (state) => {
        state.sqlStatus = 'loading';
        state.sqlResult = null;
        state.sqlError = null;
      })
      .addCase(executeRawSql.fulfilled, (state, action) => {
        state.sqlStatus = 'succeeded';
        state.sqlResult = action.payload;
        if (action.payload.txId) {
          state.activeTxId = action.payload.txId;
        } else if (action.meta.arg.action === 'commit' || action.meta.arg.action === 'rollback') {
          state.activeTxId = null; // Clear TxId on terminal action
        }
      })
      .addCase(executeRawSql.rejected, (state, action) => {
        state.sqlStatus = 'failed';
        state.sqlError = action.payload;
        if (action.meta.arg.action === 'commit' || action.meta.arg.action === 'rollback') {
          state.activeTxId = null; // Error usually means Tx is dead
        }
      })
      // Fetch Audit Logs
      .addCase(fetchAuditLogs.pending, (state) => {
        state.auditLogs.status = 'loading';
      })
      .addCase(fetchAuditLogs.fulfilled, (state, action) => {
        state.auditLogs.status = 'succeeded';
        state.auditLogs.data = action.payload.data;
        state.auditLogs.pagination = action.payload.pagination;
        state.auditLogs.error = null;
      })
      .addCase(fetchAuditLogs.rejected, (state, action) => {
        state.auditLogs.status = 'failed';
        state.auditLogs.error = action.payload;
      })
      // Fetch Mailboxes
      .addCase(fetchMailboxes.pending, (state) => {
        state.mailboxes.status = 'loading';
      })
      .addCase(fetchMailboxes.fulfilled, (state, action) => {
        state.mailboxes.status = 'succeeded';
        state.mailboxes.data = action.payload;
        state.mailboxes.error = null;
      })
      .addCase(fetchMailboxes.rejected, (state, action) => {
        state.mailboxes.status = 'failed';
        state.mailboxes.error = action.payload;
      });
  },
});

export const { resetSqlResult } = settingsSlice.actions;

export const selectSettings = (state) => state.settings.data;
export const selectSettingsStatus = (state) => state.settings.status;
export const selectSqlState = (state) => ({
  status: state.settings.sqlStatus,
  result: state.settings.sqlResult,
  error: state.settings.sqlError,
  txId: state.settings.activeTxId
});

export const selectAuditLogs = (state) => state.settings.auditLogs;
export const selectAuditLogsStatus = (state) => state.settings.auditLogs.status;

export const selectMailboxes = (state) => state.settings.mailboxes.data;
export const selectMailboxesStatus = (state) => state.settings.mailboxes.status;

export default settingsSlice.reducer;
