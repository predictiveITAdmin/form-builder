import { Can } from "@/auth/Can";
import AppError from "@/components/ui/AppError";
import { Outlet } from "react-router";

function ResponseLayout() {
  return (
    <>
      <Can
        any={["responses.readAll"]}
        fallback={
          <AppError message="You are not Authorized to view this page." />
        }
      >
        <Outlet />
      </Can>
    </>
  );
}

export default ResponseLayout;
