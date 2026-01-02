import {
  Button,
  Dialog,
  Portal,
  Stack,
  Input,
  Field,
  Text,
  Box,
  Switch,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import slugify from "@/utils/slug";
import { notify } from "../ui/notifyStore";

import {
  listPermissions,
  assignPermissions,
  editRole,
  selectGetPermission,
  selectGetPermissionError,
  selectGetPermissionStatus,
  getPermissionsforRole,
  selectGetRolePermission,
  selectGetRolePermissionStatus,
  selectGetRolePermissionError,
} from "@/features/auth/roleSlice";

const EditRole = ({ isOpen, onClose, onEdited, role }) => {
  const dispatch = useDispatch();

  const [roleDetails, setRoleDetails] = useState(null);

  // permission_id -> boolean
  const [selectedPermissions, setSelectedPermissions] = useState({});

  // Global permission catalog (for rendering the checkbox list)
  const permissions = useSelector(selectGetPermission) ?? [];
  const permissionsError = useSelector(selectGetPermissionError);
  const permissionsStatus = useSelector(selectGetPermissionStatus);

  // Current role permissions (for pre-checking)
  const currentPermissions = useSelector(selectGetRolePermission);
  const currentPermissionError = useSelector(selectGetRolePermissionError);
  const currentPermissionStatus = useSelector(selectGetRolePermissionStatus);

  // 1) When modal opens, ensure we have the global permission catalog
  useEffect(() => {
    if (!isOpen) return;

    // fetch if idle OR previously failed (so user can reopen modal and it works)
    if (permissionsStatus === "idle" || permissionsStatus === "failed") {
      dispatch(listPermissions());
    }
  }, [isOpen, permissionsStatus, dispatch]);

  // 2) When modal opens on a role, set roleDetails and fetch that role's current permissions
  useEffect(() => {
    if (!isOpen || !role?.role_id) return;

    setRoleDetails({
      role_id: role.role_id,
      created_at: role.created_at,
      updated_at: role.updated_at,
      role_name: role.role_name ?? "",
      description: role.description ?? "",
      is_active: !!role.is_active,
      is_system_role: !!role.is_system_role,
    });

    // reset, then we will hydrate from currentPermissions once fetched
    setSelectedPermissions({});

    // IMPORTANT: this is what makes currentPermissions actually get called
    dispatch(getPermissionsforRole(role.role_id));
  }, [isOpen, role?.role_id, dispatch]);

  // 3) When currentPermissions arrives, convert to { [permission_id]: true }
  useEffect(() => {
    if (!isOpen) return;

    const list = Array.isArray(currentPermissions) ? currentPermissions : [];

    // Supports API returning:
    // - [1,2,3]
    // - [{permission_id: 1}, ...]
    const next = {};
    for (const item of list) {
      const id =
        typeof item === "number"
          ? item
          : Number(item?.permission_id ?? item?.id);

      if (Number.isFinite(id)) next[id] = true;
    }

    setSelectedPermissions(next);
  }, [isOpen, currentPermissions]);

  // 4) Cleanup on close
  useEffect(() => {
    if (isOpen) return;
    setRoleDetails(null);
    setSelectedPermissions({});
  }, [isOpen]);

  const role_code = useMemo(() => {
    const name = roleDetails?.role_name ?? "";
    return name.trim() ? slugify(name) : "";
  }, [roleDetails?.role_name]);

  const permissionsByEntity = useMemo(() => {
    const list = Array.isArray(permissions) ? permissions : [];
    const groups = {};

    for (const p of list) {
      const entity = (
        p?.resource ||
        p?.permission_code?.split(".")?.[0] ||
        "other"
      )
        .toString()
        .toLowerCase();

      if (!groups[entity]) groups[entity] = [];
      groups[entity].push(p);
    }

    const order = { create: 1, read: 2, update: 3, delete: 4 };
    for (const entity of Object.keys(groups)) {
      groups[entity].sort((a, b) => {
        const ao = order[(a?.action || "").toLowerCase()] ?? 99;
        const bo = order[(b?.action || "").toLowerCase()] ?? 99;
        if (ao !== bo) return ao - bo;
        return (a?.permission_code ?? "").localeCompare(
          b?.permission_code ?? ""
        );
      });
    }

    return groups;
  }, [permissions]);

  const updateField = (key, value) => {
    setRoleDetails((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const togglePermission = (permission_id) => {
    setSelectedPermissions((prev) => ({
      ...prev,
      [permission_id]: !prev[permission_id],
    }));
  };

  const handleSave = async () => {
    if (!roleDetails) return;

    // If your backend blocks system roles (Option A), this is just an extra UI guard
    if (roleDetails.is_system_role) {
      notify({
        type: "error",
        title: "Not allowed",
        message: "System roles cannot be edited.",
      });
      return;
    }

    const permission_ids = Object.entries(selectedPermissions)
      .filter(([, checked]) => checked)
      .map(([id]) => Number(id));

    const payload = {
      role_name: roleDetails.role_name.trim(),
      role_code,
      description: roleDetails.description.trim(),
      is_active: roleDetails.is_active,
      // include if your API accepts it, otherwise assignPermissions does the real work
      permission_ids,
    };

    const role_id = roleDetails.role_id;

    try {
      const updated = await dispatch(editRole({ role_id, payload })).unwrap();

      // Assign permissions (same flow as NewRole)
      await dispatch(
        assignPermissions({
          role_id: updated?.role_id ?? role_id,
          permission_ids,
        })
      ).unwrap();

      notify({
        type: "success",
        title: "Successfully Updated",
        message: "Role updated and permissions assigned successfully!",
      });

      onEdited?.();
      onClose();
    } catch (err) {
      notify({
        type: "error",
        title: "Update failed",
        message:
          typeof err === "string"
            ? err
            : err?.message ?? "Failed to update role.",
      });
    }
  };

  const showPermissionsLoading = permissionsStatus === "loading";
  const showPermissionsError = permissionsStatus === "failed";

  const showCurrentPermsLoading = currentPermissionStatus === "loading";
  const showCurrentPermsError = currentPermissionStatus === "failed";

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxH="80vh" display="flex" flexDirection="column">
            <Dialog.Header
              position="sticky"
              top="0"
              zIndex="1"
              bg="bg.surface"
              borderBottomWidth="1px"
            >
              <Dialog.Title>Edit Role</Dialog.Title>
            </Dialog.Header>

            <Dialog.Body flex="1" overflowY="auto">
              {!roleDetails ? (
                <Text opacity={0.7}>No role selected.</Text>
              ) : roleDetails.is_system_role ? (
                <Box>
                  <Text fontWeight="semibold">System role</Text>
                  <Text opacity={0.8}>
                    This role is locked and cannot be edited.
                  </Text>
                </Box>
              ) : (
                <Stack gap={5}>
                  {/* Metadata */}
                  <Stack spacing={1}>
                    <Text fontSize="sm" opacity={0.7}>
                      Role ID: {roleDetails.role_id}
                    </Text>
                    <Text fontSize="sm" opacity={0.7}>
                      Created:{" "}
                      {roleDetails.created_at
                        ? new Date(roleDetails.created_at).toLocaleString()
                        : "-"}
                    </Text>
                    <Text fontSize="sm" opacity={0.7}>
                      Updated:{" "}
                      {roleDetails.updated_at
                        ? new Date(roleDetails.updated_at).toLocaleString()
                        : "-"}
                    </Text>
                  </Stack>

                  {/* Role Name + Role Code */}
                  <Box
                    display="grid"
                    gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }}
                    gap={4}
                    alignItems="end"
                  >
                    <Field.Root>
                      <Field.Label>Role Name</Field.Label>
                      <Input
                        value={roleDetails.role_name}
                        onChange={(e) =>
                          updateField("role_name", e.target.value)
                        }
                        placeholder="e.g., Service Desk Engineer"
                      />
                    </Field.Root>

                    <Field.Root>
                      <Field.Label>Role Code</Field.Label>
                      <Box
                        borderWidth="1px"
                        borderRadius="md"
                        px={3}
                        py={2}
                        bg="bg.muted"
                        minH="40px"
                        display="flex"
                        alignItems="center"
                      >
                        <Text fontFamily="mono" fontSize="sm">
                          {role_code || "—"}
                        </Text>
                      </Box>
                    </Field.Root>
                  </Box>

                  {/* Description */}
                  <Field.Root>
                    <Field.Label>Description</Field.Label>
                    <Input
                      value={roleDetails.description}
                      onChange={(e) =>
                        updateField("description", e.target.value)
                      }
                      placeholder="Short description of what this role is for"
                    />
                  </Field.Root>

                  {/* Active */}
                  <Field.Root>
                    <Switch.Root
                      checked={roleDetails.is_active}
                      onCheckedChange={(e) =>
                        updateField("is_active", e.checked)
                      }
                    >
                      <Switch.HiddenInput />
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      <Switch.Label>
                        {roleDetails.is_active ? "Active" : "Inactive"}
                      </Switch.Label>
                    </Switch.Root>
                  </Field.Root>

                  {/* Permissions */}
                  <Box
                    borderWidth="1px"
                    borderRadius="md"
                    p={4}
                    maxHeight="250px"
                    overflowY="scroll"
                  >
                    <Text fontWeight="semibold" mb={3}>
                      Permissions
                    </Text>

                    {/* Current role permission fetch status */}
                    {showCurrentPermsLoading && (
                      <Text opacity={0.7}>
                        Loading current role permissions…
                      </Text>
                    )}
                    {showCurrentPermsError && (
                      <Text opacity={0.8}>
                        Failed to load current role permissions:{" "}
                        {currentPermissionError ?? "Unknown error"}
                      </Text>
                    )}

                    {/* Global permission catalog fetch status */}
                    {showPermissionsLoading && (
                      <Text opacity={0.7}>Loading permissions…</Text>
                    )}
                    {showPermissionsError && (
                      <Text opacity={0.8}>
                        Failed to load permissions:{" "}
                        {permissionsError ?? "Unknown error"}
                      </Text>
                    )}

                    {!showPermissionsLoading && !showPermissionsError && (
                      <Stack gap={5}>
                        {Object.keys(permissionsByEntity).length === 0 ? (
                          <Text opacity={0.7}>No permissions available.</Text>
                        ) : (
                          Object.entries(permissionsByEntity).map(
                            ([entity, perms]) => (
                              <Box key={entity}>
                                <Text
                                  fontWeight="semibold"
                                  textTransform="capitalize"
                                  mb={2}
                                >
                                  {entity}
                                </Text>

                                <Stack gap={2}>
                                  {perms.map((p) => {
                                    const id = p?.permission_id;
                                    const code = p?.permission_code;
                                    const checked = !!selectedPermissions[id];

                                    return (
                                      <Box
                                        key={code}
                                        display="flex"
                                        alignItems="flex-start"
                                        gap={3}
                                        p={2}
                                        borderRadius="md"
                                        _hover={{ bg: "bg.muted" }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => togglePermission(id)}
                                        />

                                        <Box>
                                          <Text
                                            fontWeight="medium"
                                            fontSize="sm"
                                          >
                                            {p?.permission_name ?? code}{" "}
                                            <Text
                                              as="span"
                                              fontFamily="mono"
                                              opacity={0.7}
                                            >
                                              ({code})
                                            </Text>
                                          </Text>
                                          {p?.description ? (
                                            <Text fontSize="sm" opacity={0.8}>
                                              {p.description}
                                            </Text>
                                          ) : null}
                                        </Box>
                                      </Box>
                                    );
                                  })}
                                </Stack>
                              </Box>
                            )
                          )
                        )}
                      </Stack>
                    )}
                  </Box>
                </Stack>
              )}
            </Dialog.Body>

            <Dialog.Footer
              position="sticky"
              bottom="0"
              zIndex="1"
              bg="bg.surface"
              borderTopWidth="1px"
            >
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.ActionTrigger>

              <Button
                onClick={handleSave}
                isDisabled={
                  !roleDetails ||
                  roleDetails.is_system_role ||
                  !roleDetails.role_name.trim() ||
                  !role_code
                }
                bgColor={"#94ca5c"}
              >
                Save
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

export default EditRole;
