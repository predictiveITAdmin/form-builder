import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  HStack,
  Input,
  Select,
  Stack,
  Tag,
  TagLabel,
  Text,
  createListCollection,
  Portal,
  Field,
} from "@chakra-ui/react";
import DataTable from "../DataTable";
import AppLoader from "../ui/AppLoader";

// --- helpers ---
const normalize = (v) => (v ?? "").toString().trim().toLowerCase();

function buildRolesByUserId(userRolesArray) {
  // Supports both:
  // A) [{ user_id, roles:[...] }]
  // B) [{ user_id, role_id, role_name, ... }] flat rows
  const map = new Map();

  for (const item of userRolesArray || []) {
    if (Array.isArray(item.roles)) {
      // shape A
      const userId = item.user_id;
      const names = item.roles.map((r) => r.role_name).filter(Boolean);
      map.set(userId, names);
    } else {
      // shape B
      const userId = item.user_id;
      const roleName = item.role_name;
      if (!map.has(userId)) map.set(userId, []);
      if (roleName) map.get(userId).push(roleName);
    }
  }

  // de-dupe role names just in case your backend gets creative
  for (const [k, arr] of map.entries()) {
    map.set(k, Array.from(new Set(arr)));
  }

  return map;
}

const UserList = () => {
  const [users, setUsers] = useState([]);
  const [userRoles, setUserRoles] = useState([]);

  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [userType, setUserType] = useState("all"); // all | internal | external
  const [isActive, setIsActive] = useState("all"); // all | active | inactive

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);

        // Replace with your actual fetch/axios calls
        const [usersRes, rolesRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/users/roles"),
        ]);

        const usersJson = await usersRes.json();
        const rolesJson = await rolesRes.json();

        if (!alive) return;

        setUsers(usersJson ?? []);
        setUserRoles(rolesJson ?? []);
      } catch (e) {
        console.error("Failed to load users/roles", e);
        if (!alive) return;
        setUsers([]);
        setUserRoles([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  // Merge roles into users for DataTable
  const mergedUsers = useMemo(() => {
    const rolesByUserId = buildRolesByUserId(userRoles);

    return (users || []).map((u) => {
      const roleNames = rolesByUserId.get(u.user_id) || [];
      return {
        ...u,
        roles: roleNames, // add a "roles" field for display
        rolesText: roleNames.join(", "), // convenient for sorting/search
      };
    });
  }, [users, userRoles]);

  // Apply filters
  const filteredUsers = useMemo(() => {
    const q = normalize(search);

    return mergedUsers.filter((u) => {
      // userType filter
      if (userType !== "all") {
        if (normalize(u.user_type) !== userType) return false;
      }

      // isActive filter
      if (isActive !== "all") {
        const active = Boolean(u.is_active);
        if (isActive === "active" && !active) return false;
        if (isActive === "inactive" && active) return false;
      }

      // search filter (email, display name, roles)
      if (q) {
        const haystack = [u.email, u.display_name, u.user_type, u.rolesText]
          .map(normalize)
          .join(" ");

        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [mergedUsers, search, userType, isActive]);

  const columns = useMemo(
    () => [
      { key: "display_name", label: "Name" },
      { key: "email", label: "Email" },
      {
        key: "user_type",
        label: "User Type",
        render: (val) => (
          <Tag size="sm" variant="subtle">
            <TagLabel>{val}</TagLabel>
          </Tag>
        ),
      },
      {
        key: "is_active",
        label: "Active",
        sortable: true,
        render: (val) => (
          <Tag size="sm" colorScheme={val ? "green" : "red"}>
            <TagLabel>{val ? "Active" : "Inactive"}</TagLabel>
          </Tag>
        ),
      },
      {
        key: "roles",
        label: "Roles",
        sortable: false,
        render: (_val, row) => (
          <Text noOfLines={1}>{row.rolesText || "-"}</Text>
        ),
      },
      {
        key: "created_at",
        label: "Created",
        render: (val) => (val ? new Date(val).toLocaleString() : "-"),
      },
    ],
    []
  );

  const types = createListCollection({
    items: [
      { label: "All user types", value: "all" },
      { label: "Internal", value: "internal" },
      { label: "External", value: "external" },
    ],
  });
  const userStatus = createListCollection({
    items: [
      { label: "Active", value: "Active" },
      { label: "Inactive", value: "Inactive" },
    ],
  });

  return (
    <Stack gap={4}>
      <HStack gap={3} wrap="wrap">
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
          onChange={(e) => setUserType(e.target.value)}
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
          defaultValue={"Active"}
          onChange={(e) => setIsActive(e.target.value)}
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

        <Button
          colorScheme="blue"
          onClick={() => console.log("invite user")}
          ml={12}
        >
          Invite User
        </Button>
      </HStack>

      <Box>
        {loading ? (
          <AppLoader />
        ) : (
          <DataTable columns={columns} data={filteredUsers} />
        )}
      </Box>
    </Stack>
  );
};

export default UserList;
