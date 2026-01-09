import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  CloseButton,
  Drawer,
  Portal,
  Box,
  Input,
  HStack,
  Text,
} from "@chakra-ui/react";
import { Checkbox, Table } from "@chakra-ui/react";
import { useDispatch, useSelector } from "react-redux";

import {
  selectAllUser,
  getAllUsers,
  selectUsersStatus,
  selectUsersError,
} from "@/features/auth/roleSlice";

import {
  getUsersForForm,
  assignUsersForForm,
  selectGetUserForForm,
  selectGetUserForFormStatus,
  selectGetUserForFormError,
  selectSetUsersForFormStatus,
} from "@/features/forms/formsSlice";
import { notify } from "../ui/notifyStore";

const AssignForms = ({ isOpen, onClose, formId, formTitle }) => {
  const dispatch = useDispatch();

  /** ---------------- Redux state ---------------- */
  const users = useSelector(selectAllUser) || [];
  const usersStatus = useSelector(selectUsersStatus);
  const usersError = useSelector(selectUsersError);

  const formUsers = useSelector(selectGetUserForForm) || [];
  const formUsersStatus = useSelector(selectGetUserForFormStatus);
  const formUsersError = useSelector(selectGetUserForFormError);

  const assignStatus = useSelector(selectSetUsersForFormStatus);

  /** ---------------- Local UI state ---------------- */
  const [selection, setSelection] = useState([]);
  const [search, setSearch] = useState("");

  /** ---------------- Fetch data when drawer opens ---------------- */
  useEffect(() => {
    if (isOpen) {
      dispatch(getAllUsers());
      dispatch(getUsersForForm(formId));
    }
  }, [isOpen, formId, dispatch]);

  /**
   * When getUsersForForm resolves,
   * pre-check users who already have access
   */
  useEffect(() => {
    if (formUsers?.length) {
      const assignedUserIds = formUsers.map((u) => u.user_id);
      setSelection(assignedUserIds);
    }
  }, [formUsers]);

  /** ---------------- Search filtering ---------------- */
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;

    return users.filter((u) => {
      return (
        String(u.user_id).toLowerCase().includes(q) ||
        String(u.email ?? "")
          .toLowerCase()
          .includes(q) ||
        String(u.display_name ?? "")
          .toLowerCase()
          .includes(q) ||
        String(u.user_type ?? "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [users, search]);

  const indeterminate =
    selection.length > 0 && selection.length < filteredUsers.length;

  /** ---------------- Handlers ---------------- */
  const handleDone = () => {
    try {
      dispatch(assignUsersForForm({ formId, userIds: selection })).unwrap();
      notify({ type: "success", message: "Users Assigned Successfully!" });
      onClose();
    } catch (err) {
      notify({
        type: "error",
        message: err || "Could not assign users to the form!",
      });
    }
  };

  /** ---------------- Table rows ---------------- */
  const rows = filteredUsers.map((item) => {
    const checked = selection.includes(item.user_id);

    return (
      <Table.Row key={item.user_id} data-selected={checked ? "" : undefined}>
        <Table.Cell>
          <Checkbox.Root
            size="sm"
            checked={checked}
            onCheckedChange={(changes) => {
              setSelection((prev) =>
                changes.checked
                  ? [...new Set([...prev, item.user_id])]
                  : prev.filter((id) => id !== item.user_id)
              );
            }}
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control />
          </Checkbox.Root>
        </Table.Cell>

        <Table.Cell>{item.user_id}</Table.Cell>
        <Table.Cell>{item.display_name}</Table.Cell>
        <Table.Cell>{item.user_type}</Table.Cell>
        <Table.Cell>{item.email}</Table.Cell>
      </Table.Row>
    );
  });

  /** ---------------- UI ---------------- */
  return (
    <Drawer.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content minWidth="50vw" display="flex" flexDirection="column">
            <Drawer.Header borderBottomWidth="1px">
              <Drawer.Title>
                Assign Users {formTitle ? `— ${formTitle}` : ""}
              </Drawer.Title>
            </Drawer.Header>

            <Drawer.Body flex="1" overflowY="auto">
              <Box mb="4">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users…"
                />

                <HStack justify="space-between" mt="2">
                  <Text fontSize="sm">
                    Showing {filteredUsers.length} of {users.length}
                  </Text>

                  {(usersError || formUsersError) && (
                    <Text fontSize="sm" color="red.500">
                      {String(usersError || formUsersError)}
                    </Text>
                  )}
                </HStack>
              </Box>

              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader w="6">
                      <Checkbox.Root
                        checked={
                          indeterminate
                            ? "indeterminate"
                            : filteredUsers.length > 0 &&
                              selection.length === filteredUsers.length
                        }
                        onCheckedChange={(changes) => {
                          setSelection(
                            changes.checked
                              ? filteredUsers.map((u) => u.user_id)
                              : []
                          );
                        }}
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control />
                      </Checkbox.Root>
                    </Table.ColumnHeader>
                    <Table.ColumnHeader>User ID</Table.ColumnHeader>
                    <Table.ColumnHeader>Name</Table.ColumnHeader>
                    <Table.ColumnHeader>Type</Table.ColumnHeader>
                    <Table.ColumnHeader>Email</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>

                <Table.Body>{rows}</Table.Body>
              </Table.Root>
            </Drawer.Body>

            <Drawer.Footer borderTopWidth="1px">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>

              <Button
                bgColor="#94ca5c"
                isLoading={assignStatus === "loading"}
                onClick={handleDone}
              >
                Done
              </Button>
            </Drawer.Footer>

            <Drawer.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Drawer.CloseTrigger>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
};

export default AssignForms;
