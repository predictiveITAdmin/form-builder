import React, { useEffect, useMemo, useState } from "react";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi";
import { FaRegEdit, FaTrashAlt } from "react-icons/fa";
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
} from "@chakra-ui/react";
import { useDispatch, useSelector } from "react-redux";

import DataTable from "../DataTable";
import AppLoader from "../ui/AppLoader";
import AppError from "../ui/AppError";
import { usePagination } from "@/utils/pagination";

// TODO: adjust these imports to your real roles slice exports.
// Pattern copied from your UserList reference. :contentReference[oaicite:1]{index=1}
import {
  selectAllRoles,
  selectRolesStatus,
  selectRolesError,
  getAllRoles,
} from "@/features/auth/roleSlice";

// Optional: if you have modals like EditRole/NewRole, wire them here.
// import EditRole from "./EditRole";
// import NewRole from "./NewRole";

const norm = (v) => (v ?? "").toString().trim().toLowerCase();

const matchSearch = (role, term) => {
  if (!term) return true;

  const haystack = [role?.role_name, role?.role_code, role?.description]
    .map(norm)
    .join(" ");

  return haystack.includes(term);
};

const RolesList = () => {
  const roles = useSelector(selectAllRoles);
  const status = useSelector(selectRolesStatus);
  const error = useSelector(selectRolesError);

  const dispatch = useDispatch();

  const [selectedRole, setSelectedRole] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [systemRole, setSystemRole] = useState(["all"]);
  const [isActive, setIsActive] = useState(["all"]);

  useEffect(() => {
    if (status === "idle") dispatch(getAllRoles({ includeInactive: true }));
  }, [dispatch, status]);

  const systemRoleCollection = createListCollection({
    items: [
      { label: "All role types", value: "all" },
      { label: "System roles", value: "system" },
      { label: "Custom roles", value: "custom" },
    ],
  });

  const statusCollection = createListCollection({
    items: [
      { label: "All", value: "all" },
      { label: "Active", value: "active" },
      { label: "Inactive", value: "inactive" },
    ],
  });

  const handleEditClick = (row) => {
    setSelectedRole(row);
    setEditOpen(true);
  };

  const handleEditClose = () => {
    setEditOpen(false);
    setSelectedRole(null);
  };

  const filteredRoles = useMemo(() => {
    const list = Array.isArray(roles) ? roles : [];

    const term = norm(search);
    const selectedSystem = systemRole?.[0] ?? "all";
    const selectedStatus = isActive?.[0] ?? "all";

    return list.filter((r) => {
      if (!matchSearch(r, term)) return false;

      // System role filter
      if (selectedSystem !== "all") {
        const isSystem = !!r.is_system_role;
        if (selectedSystem === "system" && !isSystem) return false;
        if (selectedSystem === "custom" && isSystem) return false;
      }

      // Active filter
      if (selectedStatus !== "all") {
        const activeBool = !!r.is_active;
        if (selectedStatus === "active" && !activeBool) return false;
        if (selectedStatus === "inactive" && activeBool) return false;
      }

      return true;
    });
  }, [roles, search, systemRole, isActive]);

  const columns = useMemo(
    () => [
      { key: "role_name", label: "Role Name" },
      {
        key: "role_code",
        label: "Code",
        render: (val) => (
          <Text maxWidth={"100%"} truncate title={val}>
            {val ?? "-"}
          </Text>
        ),
      },
      {
        key: "description",
        label: "Description",
        render: (val) => (
          <Text maxWidth={"100%"} truncate title={val}>
            {val ?? "-"}
          </Text>
        ),
      },
      {
        key: "is_system_role",
        label: "Type",
        sortable: true,
        render: (val) => (
          <Tag.Root size="sm" variant="subtle">
            <Tag.Label>{val ? "System" : "Custom"}</Tag.Label>
          </Tag.Root>
        ),
      },
      {
        key: "is_active",
        label: "Status",
        sortable: true,
        render: (val) => (
          <Tag.Root size="sm" variant={"surface"} color={val ? "green" : "red"}>
            <Tag.Label>{val ? "Active" : "Inactive"}</Tag.Label>
          </Tag.Root>
        ),
      },
      {
        key: "role_to_users",
        label: "Users",
        sortable: true,
        render: (val) => <Text>{Number.isFinite(val) ? val : val ?? 0}</Text>,
      },
      {
        key: "permission_to_roles",
        label: "Permissions",
        sortable: true,
        render: (val) => <Text>{Number.isFinite(val) ? val : val ?? 0}</Text>,
      },
      {
        key: "created_at",
        label: "Created",
        render: (val) => (val ? new Date(val).toLocaleDateString() : "-"),
      },
      {
        key: "updated_at",
        label: "Updated",
        render: (val) => (val ? new Date(val).toLocaleDateString() : "-"),
      },
      {
        key: "actions",
        label: "Actions",
        render: (_, row) => (
          <HStack spacing={0} width={12}>
            <IconButton
              size="sm"
              aria-label="Edit"
              variant="ghost"
              color={"#FFBF00"}
              onClick={() => handleEditClick(row)}
            >
              <FaRegEdit size={16} />
            </IconButton>

            <IconButton
              size="sm"
              aria-label="Delete"
              variant="ghost"
              color="#BA2222"
              onClick={() => console.log("delete role", row?.role_id)}
            >
              <FaTrashAlt size={16} />
            </IconButton>
          </HStack>
        ),
      },
    ],
    []
  );

  const { page, setPage, pageSize, totalItems, pageData } = usePagination(
    filteredRoles,
    5
  );

  if (status === "loading") return <AppLoader />;
  if (status === "error")
    return <AppError title="Something went wrong" message={error} />;

  return (
    <Stack gap={4}>
      <HStack gap={3} wrap="wrap" justifyContent={"space-between"}>
        <Field.Root maxW="360px">
          <Field.Label>Search</Field.Label>
          <Input
            placeholder="Search role name, code, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxW="360px"
          />
        </Field.Root>

        <Select.Root
          collection={systemRoleCollection}
          size="sm"
          width="320px"
          value={systemRole}
          onValueChange={(e) => setSystemRole(e.value)}
        >
          <Select.HiddenSelect />
          <Select.Label>Select Role Type</Select.Label>
          <Select.Control>
            <Select.Trigger>
              <Select.ValueText placeholder="Select Role Type" />
            </Select.Trigger>
            <Select.IndicatorGroup>
              <Select.Indicator />
            </Select.IndicatorGroup>
          </Select.Control>
          <Portal>
            <Select.Positioner>
              <Select.Content>
                {systemRoleCollection.items.map((item) => (
                  <Select.Item item={item} key={item.value}>
                    {item.label}
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Portal>
        </Select.Root>

        <Select.Root
          collection={statusCollection}
          size="sm"
          width="320px"
          value={isActive}
          onValueChange={(e) => setIsActive(e.value)}
        >
          <Select.HiddenSelect />
          <Select.Label>Select Status</Select.Label>
          <Select.Control>
            <Select.Trigger>
              <Select.ValueText placeholder="Select Status" />
            </Select.Trigger>
            <Select.IndicatorGroup>
              <Select.Indicator />
            </Select.IndicatorGroup>
          </Select.Control>
          <Portal>
            <Select.Positioner>
              <Select.Content>
                {statusCollection.items.map((item) => (
                  <Select.Item item={item} key={item.value}>
                    {item.label}
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Portal>
        </Select.Root>

        {/* Optional: add create role button if your flow supports it */}
        <Button bgColor="#2596be" onClick={() => setNewOpen(true)}>
          Create New Role
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

      {/* Optional modals */}
      {/* <NewRole isOpen={newOpen} onClose={() => setNewOpen(false)} /> */}
      {/* <EditRole isOpen={editOpen} onClose={handleEditClose} role={selectedRole} /> */}

      {/* Keeping state hooks “live” so wiring modals later is trivial */}
      {editOpen && selectedRole ? null : null}
    </Stack>
  );
};

export default RolesList;
