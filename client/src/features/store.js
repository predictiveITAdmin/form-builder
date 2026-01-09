import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./auth/authSlice";
import formReducer from "./forms/formsSlice";
import roleReducer from "./auth/roleSlice";
import reportReducer from "./reports/reportSlice";
import responseReducer from "./responses/responseSlice";
import workflowReducer from "./workflows/workflowSlice";
export const store = configureStore({
  reducer: {
    auth: authReducer,
    forms: formReducer,
    roles: roleReducer,
    reports: reportReducer,
    responses: responseReducer,
    workflows: workflowReducer,
  },
});
