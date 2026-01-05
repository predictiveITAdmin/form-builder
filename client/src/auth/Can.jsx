import React from "react";
import { usePermissions } from "@/auth/Permissions";

export function Can({
  code,
  resource,
  action,
  any,
  all,
  fallback = null,
  children,
}) {
  const { canCode, can, canAny, canAll } = usePermissions();

  const allowed =
    (code ? canCode(code) : true) &&
    (resource && action ? can(resource, action) : true) &&
    (any ? canAny(any) : true) &&
    (all ? canAll(all) : true);

  return allowed ? <>{children}</> : <>{fallback}</>;
}
