import { Can } from "@/auth/Can";
import RolesList from "@/components/roles/RolesList";
import UserList from "@/components/users/UserList";
import { Box, Text, Tabs } from "@chakra-ui/react";
import { FaUsersGear, FaUserLock, FaWpforms } from "react-icons/fa6";

function Configuration() {
  return (
    <Box>
      <Tabs.Root defaultValue="users">
        <Tabs.List>
          <Can
            any={["users.read", "users.update", "users.create", "users.delete"]}
          >
            <Tabs.Trigger value="users">
              <FaUsersGear />
              Users
            </Tabs.Trigger>
          </Can>
          <Can
            any={["roles.read", "roles.update", "roles.create", "roles.delete"]}
          >
            <Tabs.Trigger value="rbac">
              <FaUserLock />
              Roles & Permissions
            </Tabs.Trigger>
          </Can>
        </Tabs.List>
        <Can
          any={["users.read", "users.update", "users.create", "users.delete"]}
        >
          <Tabs.Content value="users">
            <UserList />
          </Tabs.Content>
        </Can>
        <Can
          any={["roles.read", "roles.update", "roles.create", "roles.delete"]}
        >
          <Tabs.Content value="rbac">
            <RolesList />
          </Tabs.Content>
        </Can>
      </Tabs.Root>
    </Box>
  );
}

export default Configuration;
