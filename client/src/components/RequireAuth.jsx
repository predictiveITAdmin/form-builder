import { useSelector } from "react-redux";
import { Navigate, Outlet } from "react-router-dom";

export default function RequireAuth() {
  const { isAuthenticated, status } = useSelector((s) => s.auth);

  if (status === "idle" || status === "loading") return null;
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
