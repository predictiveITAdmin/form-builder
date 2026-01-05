import React, { createContext, useContext, useMemo } from "react";
import { useSelector } from "react-redux";
import { selectUser } from "@/features/auth/authSlice";

const PermissionsContext = createContext(null);

const norm = (s) =>
  String(s || "")
    .trim()
    .toLowerCase();

function buildPermissionIndex(user) {
  const perms = user?.permissions || [];

  const codes = new Set(perms.map((p) => norm(p.permission_code)));
  const pairs = new Set(
    perms.map((p) => `${norm(p.resource)}:${norm(p.action)}`)
  );

  return { codes, pairs };
}

export function PermissionsProvider({ children }) {
  const user = useSelector(selectUser);

  const value = useMemo(() => {
    const { codes, pairs } = buildPermissionIndex(user);

    const canCode = (code) => codes.has(norm(code));

    const can = (resource, action) =>
      pairs.has(`${norm(resource)}:${norm(action)}`);

    const canAny = (codesAny) =>
      Array.isArray(codesAny) && codesAny.some((c) => canCode(c));

    const canAll = (codesAll) =>
      Array.isArray(codesAll) && codesAll.every((c) => canCode(c));

    return { user, canCode, can, canAny, canAll };
  }, [user]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) {
    throw new Error(
      "usePermissions must be used inside <PermissionsProvider>."
    );
  }
  return ctx;
}
