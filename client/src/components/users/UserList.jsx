import React, { useEffect, useMemo, useState } from "react";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi";
import { FaRegEdit, FaTrashAlt } from "react-icons/fa";
import EditUser from "./EditUser";
import { Can } from "@/auth/Can";
import {
  Button,
  HStack,
  Input,
  Select,
  Stack,
  Tag,
  IconButton,
  ButtonGroup,
  Pagination,
  Text,
  createListCollection,
  Portal,
  Field,
  Dialog,
} from "@chakra-ui/react";
import DataTable from "../DataTable";
import AppLoader from "../ui/AppLoader";
import {
  selectAllUser,
  selectUsersStatus,
  selectUsersError,
  getAllUsers,
  deleteUser,
} from "@/features/auth/roleSlice";
import { useDispatch, useSelector } from "react-redux";
import AppError from "../ui/AppError";
import { usePagination } from "@/utils/pagination";
import NewUser from "./NewUser";
import { notify } from "../ui/notifyStore";

const norm = (v) => (v ?? "").toString().trim().toLowerCase();

const matchSearch = (user, term) => {
  if (!term) return true;

  const haystack = [
    user?.display_name,
    user?.email,
    ...(Array.isArray(user?.roles) ? user.roles.map((r) => r?.role_name) : []),
  ]
    .map(norm)
    .join(" ");

  return haystack.includes(term);
};

const UserList = () => {
  const users = useSelector(selectAllUser);
  const error = useSelector(selectUsersError);
  const status = useSelector(selectUsersStatus);
  const [selectedUser, setSelectedUser] = useState({});

  const [inviteOpen, setInviteOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);

  const dispatch = useDispatch();

  useEffect(() => {
    if (status === "idle") dispatch(getAllUsers());
  }, [dispatch, status]);

  const [search, setSearch] = useState("");
  const [userType, setUserType] = useState(["all"]);
  const [isActive, setIsActive] = useState(["active"]);

  const columns = useMemo(
    () => [
      { key: "display_name", label: "Name" },
      {
        key: "email",
        label: "Email",
        render: (val) => (
          <Text maxWidth={"100%"} truncate title={val}>
            {val.trim()}
          </Text>
        ),
      },
      {
        key: "user_type",
        label: "User Type",
        render: (val) => (
          <Tag.Root size="sm" variant="subtle">
            <Tag.Label>{val}</Tag.Label>
          </Tag.Root>
        ),
      },
      {
        key: "is_active",
        label: "Active",
        sortable: true,
        render: (val) => (
          <Tag.Root size="sm" variant={"surface"} color={val ? "green" : "red"}>
            <Tag.Label>{val ? "Active" : "Inactive"}</Tag.Label>
          </Tag.Root>
        ),
      },
      {
        key: "roles",
        label: "Roles",
        sortable: false, // sorting arrays is how chaos begins
        render: (roles) => {
          if (!roles || roles.length === 0) {
            return <Text opacity={0.6}>No role Assigned</Text>;
          }

          return (
            <Stack spacing={1}>
              {roles.map((role, idx) => (
                <Tag.Root width={"fit-content"} key={idx} fontSize="sm">
                  <Tag.Label>{role.role_name}</Tag.Label>
                </Tag.Root>
              ))}
            </Stack>
          );
        },
      },
      {
        key: "created_at",
        label: "Created",
        render: (val) => (val ? new Date(val).toLocaleDateString() : "-"),
      },
      {
        key: "actions",
        label: "Actions",
        render: (_, row) => (
          <Can
            any={["users.update", "users.create", "users.delete"]}
            fallback={<Text>You are not Authorized</Text>}
          >
            <HStack spacing={0} width={12}>
              <IconButton
                size="sm"
                aria-label="Edit"
                variant="ghost"
                color={"#FFBF00"}
                // TODO: hook up edit route
                onClick={() => handleEditClick(row)}
              >
                <FaRegEdit size={16} />
              </IconButton>
              <Dialog.Root>
                <Dialog.Trigger asChild>
                  <IconButton
                    size="sm"
                    aria-label="Delete"
                    variant="ghost"
                    color={"red"}
                  >
                    <FaTrashAlt size={16} />
                  </IconButton>
                </Dialog.Trigger>

                <Dialog.Backdrop />
                <Dialog.Positioner>
                  <Dialog.Content>
                    <Dialog.CloseTrigger />

                    <Dialog.Header>
                      <Dialog.Title>Delete User</Dialog.Title>
                    </Dialog.Header>

                    <Dialog.Body>
                      Are you sure you want to delete{" "}
                      <strong>{row.display_name || row.email}</strong>?
                      <br />
                      <Text
                        marginTop={4}
                        fontSize="sm"
                        color="red.700"
                        fontWeight="medium"
                      >
                        This action will permanently delete the user's account and revoke all access.{" "}
                        <strong>This cannot be reversed.</strong>
                      </Text>
                    </Dialog.Body>

                    <Dialog.Footer>
                      <Dialog.CloseTrigger asChild>
                        <Button variant="outline" size="sm">Cancel</Button>
                      </Dialog.CloseTrigger>
                      <Button
                        size="sm"
                        bgColor="red"
                        color="white"
                        onClick={() => handleDelete(row.user_id)}
                      >
                        Delete User
                      </Button>
                    </Dialog.Footer>
                  </Dialog.Content>
                </Dialog.Positioner>
              </Dialog.Root>
            </HStack>
          </Can>
        ),
      },
    ],
    []
  );

  const handleEditClick = (row) => {

    setSelectedUser(row);
    setEditOpen(true);
  };

  const handleEditClose = () => {
    setEditOpen(false);
    setSelectedUser(null);
  };

  const handleDelete = async (userId) => {
    try {
      await dispatch(deleteUser(userId)).unwrap();
      notify({ type: "success", message: "User Removed Successfully" });
      dispatch(getAllUsers());
    } catch (err) {
      notify({
        type: "error",
        message: err || "Failed to remove user",
      });
    }
  };

  const types = createListCollection({
    items: [
      { label: "All user types", value: "all" },
      { label: "Internal", value: "internal" },
      { label: "External", value: "external" },
    ],
  });
  const userStatus = createListCollection({
    items: [
      { label: "All", value: "all" },
      { label: "Active", value: "active" },
      { label: "Inactive", value: "inactive" },
    ],
  });

  const filteredUsers = useMemo(() => {
    const list = Array.isArray(users) ? users : [];

    const term = norm(search);
    const selectedType = userType?.[0] ?? "all";
    const selectedStatus = isActive?.[0] ?? "all";

    return list.filter((u) => {
      // search: name OR email (and role names too)
      if (!matchSearch(u, term)) return false;

      // userType filter
      if (selectedType !== "all" && norm(u.user_type) !== selectedType)
        return false;

      // active filter
      if (selectedStatus !== "all") {
        const activeBool = !!u.is_active;
        if (selectedStatus === "active" && !activeBool) return false;
        if (selectedStatus === "inactive" && activeBool) return false;
      }

      return true;
    });
  }, [users, search, userType, isActive]);

  const { page, setPage, pageSize, totalItems, pageData } = usePagination(
    filteredUsers,
    5
  );

  if (status === "loading") {
    return <AppLoader />;
  }

  if (status === "error") {
    return <AppError title="Something went wrong" message={error} />;
  }
  return (
    <Stack gap={4}>
      <HStack gap={3} wrap="wrap" justifyContent={"space-between"}>
        <Field.Root maxW="360px">
          <Field.Label>Search</Field.Label>
          <Input
            placeholder="Search name, email, role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxW="360px"
          />
        </Field.Root>

        <Select.Root
          collection={types}
          size="sm"
          width="320px"
          value={userType}
          onValueChange={(e) => setUserType(e.value)}
        >
          <Select.HiddenSelect />
          <Select.Label>Select User Type</Select.Label>
          <Select.Control>
            <Select.Trigger>
              <Select.ValueText placeholder="Select User Type" />
            </Select.Trigger>
            <Select.IndicatorGroup>
              <Select.Indicator />
            </Select.IndicatorGroup>
          </Select.Control>
          <Portal>
            <Select.Positioner>
              <Select.Content>
                {types.items.map((type) => (
                  <Select.Item item={type} key={type.value}>
                    {type.label}
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Portal>
        </Select.Root>

        <Select.Root
          collection={userStatus}
          size="sm"
          width="320px"
          value={isActive}
          onValueChange={(e) => {
            setIsActive(e.value);

          }}
        >
          <Select.HiddenSelect />
          <Select.Label>Select Status</Select.Label>
          <Select.Control>
            <Select.Trigger>
              <Select.ValueText placeholder="Select User Status" />
            </Select.Trigger>
            <Select.IndicatorGroup>
              <Select.Indicator />
            </Select.IndicatorGroup>
          </Select.Control>
          <Portal>
            <Select.Positioner>
              <Select.Content>
                {userStatus.items.map((type) => (
                  <Select.Item item={type} key={type.value}>
                    {type.label}
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Portal>
        </Select.Root>

        <Button bgColor="#2596be" onClick={() => setInviteOpen(true)}>
          Invite User
        </Button>
      </HStack>
      <DataTable columns={columns} data={pageData ?? []} />
      <Pagination.Root
        count={totalItems}
        pageSize={pageSize}
        page={page}
        onPageChange={(e) => setPage(e.page)}
      >
        <ButtonGroup
          variant="ghost"
          size="sm"
          justifyContent="flex-end"
          w="full"
          mt={3}
        >
          <Pagination.PrevTrigger asChild>
            <IconButton aria-label="Previous page">
              <HiChevronLeft />
            </IconButton>
          </Pagination.PrevTrigger>

          <Pagination.Items
            render={(p) => (
              <IconButton
                aria-label={`Page ${p.value}`}
                variant={p.value === page ? "outline" : "ghost"}
              >
                {p.value}
              </IconButton>
            )}
          />

          <Pagination.NextTrigger asChild>
            <IconButton aria-label="Next page">
              <HiChevronRight />
            </IconButton>
          </Pagination.NextTrigger>
        </ButtonGroup>
      </Pagination.Root>
      <NewUser isOpen={inviteOpen} onClose={() => setInviteOpen(false)} />
      <EditUser
        isOpen={editOpen}
        onClose={handleEditClose}
        user={selectedUser}
      />
    </Stack>
  );
};

export default UserList;
