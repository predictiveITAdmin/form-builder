import {
  Box,
  Button,
  Dialog,
  Field,
  Input,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import slugify from "@/utils/slug";
import { useDispatch, useSelector } from "react-redux";
import {
  addNewRole,
  clearRoleState,
  listPermissions,
  assignPermissions,
  selectAddRole,
  selectGetPermission,
  selectGetPermissionError,
  selectGetPermissionStatus,
} from "@/features/auth/roleSlice";
import { notify } from "../ui/notifyStore";

const NewRole = ({ isOpen, onClose, onCreated }) => {
  const [role_name, setRoleName] = useState("");
  const [description, setDescription] = useState("");
  const dispatch = useDispatch();

  // permission_code => boolean
  const [selectedPermissions, setSelectedPermissions] = useState({});

  const permissions = useSelector(selectGetPermission) ?? [];
  const permissionsError = useSelector(selectGetPermissionError);
  const permissionsStatus = useSelector(selectGetPermissionStatus);

  const role = useSelector(selectAddRole);

  // Fetch permissions when dialog opens (only if not already loaded)
  useEffect(() => {
    if (!isOpen) return;

    if (permissionsStatus === "idle") {
      dispatch(listPermissions());
    }
  }, [isOpen, permissionsStatus, dispatch]);

  const role_code = useMemo(() => {
    if (!role_name.trim()) return "";
    return slugify(role_name);
  }, [role_name]);

  // Group permissions by entity (resource is best; fallback to permission_code prefix)
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

    // Optional: stable sorting (CRUD order if action exists)
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

  const togglePermission = (permission_id) => {
    setSelectedPermissions((prev) => ({
      ...prev,
      [permission_id]: !prev[permission_id],
    }));
  };

  const handleCreate = async () => {
    const payload = {
      role_name,
      role_code,
      description,
      is_system_role: false,
      is_active: true,
      permission_ids: Object.entries(selectedPermissions)
        .filter(([, checked]) => checked)
        .map(([id]) => Number(id)),
    };

    try {
      const created = await dispatch(addNewRole(payload)).unwrap();

      if (payload.permission_ids?.length) {
        await dispatch(
          assignPermissions({
            role_id: created.role_id,
            permission_ids: payload.permission_ids,
          })
        ).unwrap();
      }

      notify({
        type: "success",
        message: `Role "${created.role_name}" created successfully and permissions assigned successfully!`,
      });

      await onCreated?.();
      dispatch(clearRoleState());

      setRoleName("");
      setDescription("");
      setSelectedPermissions({});
      onClose();
    } catch (err) {
      notify({
        type: "error",
        message:
          typeof err === "string"
            ? err
            : err?.message ?? "Something went wrong.",
      });

      setRoleName("");
      setDescription("");
      setSelectedPermissions({});
      onClose();
    }
  };

  const showPermissionsLoading = permissionsStatus === "loading";
  const showPermissionsError = permissionsStatus === "failed";

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
              <Dialog.Title>Create New Role</Dialog.Title>
            </Dialog.Header>

            <Dialog.Body flex="1" overflowY="auto">
              <Stack gap={5}>
                <Box
                  display="grid"
                  gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }}
                  gap={4}
                  alignItems="end"
                >
                  <Field.Root>
                    <Field.Label>Role Name</Field.Label>
                    <Input
                      placeholder="e.g., Service Desk Engineer"
                      value={role_name}
                      onChange={(e) => setRoleName(e.target.value)}
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

                <Field.Root>
                  <Field.Label>Description</Field.Label>
                  <Input
                    placeholder="Short description of what this role is for"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Field.Root>

                <Box
                  borderWidth="1px"
                  borderRadius="md"
                  p={4}
                  maxHeight={"250px"}
                  overflowY={"scroll"}
                >
                  <Text fontWeight="semibold" mb={3}>
                    Permissions
                  </Text>

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
                                        <Text fontWeight="medium" fontSize="sm">
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
                onClick={handleCreate}
                bgColor={"#94ca5c"}
                isDisabled={!role_name.trim() || !role_code}
              >
                Create Role
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

export default NewRole;
