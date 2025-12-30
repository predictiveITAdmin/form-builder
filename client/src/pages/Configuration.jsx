import RolesList from "@/components/roles/RolesList";
import UserList from "@/components/users/UserList";
import { Box, Text, Tabs } from "@chakra-ui/react";
import { FaUsersGear, FaUserLock, FaWpforms } from "react-icons/fa6";

function Configuration() {
  return (
    <Box>
      <Tabs.Root defaultValue="users">
        <Tabs.List>
          <Tabs.Trigger value="users">
            <FaUsersGear />
            Users
          </Tabs.Trigger>
          <Tabs.Trigger value="rbac">
            <FaUserLock />
            Roles & Permissions
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="users">
          <UserList />
        </Tabs.Content>
        <Tabs.Content value="rbac">
          <RolesList />
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  );
}

export default Configuration;
