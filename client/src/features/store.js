import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./auth/authSlice";
import formReducer from "./forms/formsSlice";
import roleReducer from "./auth/roleSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    forms: formReducer,
    roles: roleReducer,
  },
});
