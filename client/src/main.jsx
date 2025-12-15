import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Provider as UIProvider } from "@/components/ui/provider";
import { system } from "./theme";
import { ChakraProvider } from "@chakra-ui/react";
import App from "./App.jsx";
import { BrowserRouter } from "react-router";
import { store } from "./features/store";
import { Provider as ReduxProvider } from "react-redux";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ReduxProvider store={store}>
      <ChakraProvider value={system}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ChakraProvider>
    </ReduxProvider>
  </StrictMode>
);
