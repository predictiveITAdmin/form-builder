import {
  editUserDetailsAndRoles,
  getAllRoles,
  selectAllRoles,
} from "@/features/auth/roleSlice";
import {
  Button,
  Dialog,
  Portal,
  Stack,
  Input,
  Field,
  Text,
  HStack,
  Tag,
  Select,
  Switch,
  createListCollection,
} from "@chakra-ui/react";
import { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { notify } from "../ui/notifyStore";

const EditUser = ({ isOpen, onClose, user }) => {
  const [userDetails, setUserDetails] = useState(null);
  const [selectedRoleCodes, setSelectedRoleCodes] = useState([]);
  const roles = useSelector(selectAllRoles) ?? [];

  const dispatch = useDispatch();
  const toRoleCodes = (roles) =>
    Array.isArray(roles)
      ? roles
          .map((r) => (typeof r === "string" ? r : r?.role_code))
          .filter(Boolean)
      : [];

  const toRoleObjects = (roleCodes, allRoles) =>
    (roleCodes ?? [])
      .map((code) => allRoles.find((r) => r.role_code === code))
      .filter(Boolean);

  const allRoles = [
    { role_code: "form-builder", role_name: "Form Builder" },
    { role_code: "admin", role_name: "Administrator" },
    { role_code: "form-admin", role_name: "Form Administrator" },
  ];

  const rolesCollection = useMemo(() => {
    return createListCollection({
      items: (Array.isArray(roles) ? roles : []).map((r) => ({
        label: r.role_name,
        value: r.role_code,
      })),
    });
  }, [roles]);

  useEffect(() => {
    if (isOpen && user) {
      setUserDetails({
        user_id: user.user_id,
        created_at: user.created_at,
        email: user.email ?? "",
        display_name: user.display_name ?? "",
        user_type: user.user_type ?? "External",
        is_active: !!user.is_active,
        roles: Array.isArray(user.roles) ? user.roles : [],
      });
      setSelectedRoleCodes(toRoleCodes(user.roles));
      dispatch(getAllRoles({ includeInactive: false }));
    }

    // Clear when closed
    if (!isOpen) {
      setUserDetails(null);
    }
  }, [isOpen, user]);

  const updateField = (key, value) => {
    setUserDetails((prev) => ({ ...prev, [key]: value }));

  };

  const handleSave = async () => {
    if (!userDetails) return;

    const payload = {
      user_id: userDetails.user_id,
      email: userDetails.email.trim(),
      display_name: userDetails.display_name.trim(),
      user_type: userDetails.user_type,
      is_active: userDetails.is_active,
      roles: userDetails.is_active
        ? toRoleObjects(selectedRoleCodes, roles)
        : [],
    };

    try {
      await dispatch(editUserDetailsAndRoles(payload)).unwrap();

      notify({
        type: "success",
        title: "Successfully Updated",
        message: "User Updated!",
      });

      onClose();
      window.location.reload();
    } catch (err) {

      notify({
        type: "error",
        title: "Update failed",
        message: typeof err === "string" ? err : "Failed to update user.",
      });
    }
  };

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
              <Dialog.Title>Edit User</Dialog.Title>
            </Dialog.Header>

            <Dialog.Body flex="1" overflowY="auto">
              {!userDetails ? (
                <Text opacity={0.7}>No user selected.</Text>
              ) : (
                <Stack gap={4}>
                  <Stack spacing={1}>
                    <Text fontSize="sm" opacity={0.7}>
                      User ID: {userDetails.user_id}
                    </Text>
                    <Text fontSize="sm" opacity={0.7}>
                      Created:{" "}
                      {userDetails.created_at
                        ? new Date(userDetails.created_at).toLocaleString()
                        : "-"}
                    </Text>
                    <Text fontSize="sm" opacity={0.7}>
                      Email: {userDetails.email}
                    </Text>
                  </Stack>
                  <Field.Root>
                    <Field.Label>Display Name</Field.Label>
                    <Input
                      value={userDetails.display_name}
                      onChange={(e) =>
                        updateField("display_name", e.target.value)
                      }
                    />
                  </Field.Root>
                  <Field.Root>
                    <HStack justify="space-between">
                      <Switch.Root
                        checked={userDetails.is_active}
                        onCheckedChange={(e) =>
                          updateField("is_active", e.checked)
                        }
                      >
                        <Switch.HiddenInput />
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                        <Switch.Label>
                          {userDetails.is_active ? "Active" : "Inactive"}
                        </Switch.Label>
                      </Switch.Root>
                    </HStack>
                  </Field.Root>

                  {userDetails.is_active && (
                    <Field.Root>
                      <Field.Label>Roles</Field.Label>

                      <Select.Root
                        collection={rolesCollection}
                        multiple
                        value={selectedRoleCodes}
                        onValueChange={(e) =>
                          setSelectedRoleCodes(e.value ?? [])
                        }
                      >
                        <Select.HiddenSelect />
                        <Select.Control>
                          <Select.Trigger>
                            <Select.ValueText placeholder="Select Roles" />
                          </Select.Trigger>
                          <Select.IndicatorGroup>
                            <Select.Indicator />
                          </Select.IndicatorGroup>
                        </Select.Control>
                        <Portal>
                          <Select.Positioner style={{ zIndex: 2000 }}>
                            <Select.Content style={{ zIndex: 2000 }}>
                              {rolesCollection.items.map((item) => (
                                <Select.Item item={item} key={item.value}>
                                  {item.label}
                                  <Select.ItemIndicator />
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select.Positioner>
                        </Portal>
                      </Select.Root>
                      <HStack wrap="wrap" mt={2}>
                        {selectedRoleCodes.length ? (
                          selectedRoleCodes.map((code) => {
                            const item = rolesCollection.items.find(
                              (i) => i.value === code
                            );
                            return (
                              <Tag.Root key={code} size="sm" variant="subtle">
                                <Tag.Label>{item?.label ?? code}</Tag.Label>
                              </Tag.Root>
                            );
                          })
                        ) : (
                          <Tag.Root size="sm" variant="surface">
                            <Tag.Label>No roles assigned</Tag.Label>
                          </Tag.Root>
                        )}
                      </HStack>
                    </Field.Root>
                  )}
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
                isDisabled={!userDetails}
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

export default EditUser;
