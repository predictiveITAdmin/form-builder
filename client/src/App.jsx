import { Routes, Route } from "react-router";
import { Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Layout from "./pages/Layout";
import Dashboard from "./pages/Dashboard";
import Configuration from "./pages/Configuration";
import Forms from "./pages/Forms";
import Responses from "./pages/Responses";
import { loadSession } from "./features/auth/authSlice";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import RequireAuth from "./components/RequireAuth";
import LoginPage from "./pages/LoginPage";

// Main App Component
function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(loadSession());
  }, [dispatch]);
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/redirect" element={<Navigate to="/" replace />} />
      <Route element={<RequireAuth />}>
        <Route
          path="/"
          element={
            <Layout>
              <Home />
            </Layout>
          }
        />

        <Route
          path="/dashboard"
          element={
            <Layout>
              <Dashboard />
            </Layout>
          }
        />
        <Route
          path="/configuration"
          element={
            <Layout>
              <Configuration />
            </Layout>
          }
        />
        <Route
          path="/forms"
          element={
            <Layout>
              <Forms />
            </Layout>
          }
        />
        <Route
          path="/responses"
          element={
            <Layout>
              <Responses />
            </Layout>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
