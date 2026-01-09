import { Routes, Route } from "react-router";
import { Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Layout from "./pages/Layout";
import Forms from "./components/forms/Forms";
import Test from "./pages/Test";
import Dashboard from "./pages/Dashboard";
import Configuration from "./pages/Configuration";
import FormsLayout from "./pages/FormsLayout";
import ResponseLayout from "./pages/ResponseLayout";
import { loadSession } from "./features/auth/authSlice";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import RequireAuth from "./components/RequireAuth";
import LoginPage from "./pages/LoginPage";
import NewForm from "./components/forms/NewForm";
import FormDetail from "./components/forms/FormDetail";
import EditForm from "./components/forms/EditForm";
import CreatePasswordPage from "./pages/CreatePassword";
import Responses from "./components/responses/Responses";
import ResponseDetail from "./components/responses/ResponseDetail";
import NotFound from "./components/ui/NotFound";
import WorkflowLayout from "./pages/WorkflowLayout";
import WorkflowRunDetail from "./components/workflows/WorkflowRunDetail";
import Workflows from "./components/workflows/Workflows";
import WorkflowRuns from "./components/workflows/WorkflowRuns";
import WorkflowTemplateDetail from "./components/workflows/WorkflowTemplateDetail";
// Main App Component
function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(loadSession());
  }, [dispatch]);
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/create-password" element={<CreatePasswordPage />} />
      <Route path="/test" element={<Test />} />
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
          path="forms"
          element={
            <Layout>
              <FormsLayout />
            </Layout>
          }
        >
          <Route index element={<Forms />} />
          <Route path="new" element={<NewForm />} />
          <Route path=":formKey/edit" element={<EditForm />} />
          <Route path=":formKey" element={<FormDetail />} />
        </Route>
        <Route
          path="responses"
          element={
            <Layout>
              <ResponseLayout />
            </Layout>
          }
        >
          <Route index element={<Responses />} />
          <Route path=":responseId" element={<ResponseDetail />} />
        </Route>

        <Route
          path="workflows"
          element={
            <Layout>
              <WorkflowLayout />
            </Layout>
          }
        >
          <Route index element={<Workflows />} />
          <Route path=":workflowId" element={<WorkflowTemplateDetail />} />
          <Route path="workflow-runs" element={<WorkflowRuns />} />
          <Route path="runs/:runId" element={<WorkflowRunDetail />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
