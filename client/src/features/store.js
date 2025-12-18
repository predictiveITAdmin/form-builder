import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./auth/authSlice";
import formReducer from "./forms/formsSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    forms: formReducer,
  },
});
