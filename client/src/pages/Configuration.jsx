import UserList from "@/components/users/UserList";
import { Box, Text, Tabs } from "@chakra-ui/react";
import { FaUsersGear, FaUserLock, FaWpforms } from "react-icons/fa6";

function Configuration() {
  return (
    <Box>
      <Text color="gray.600" fontSize={18} mb={4}>
        Configure your application here
      </Text>

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
          <Tabs.Trigger value="forms">
            <FaWpforms />
            Forms
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="users">
          <UserList />
        </Tabs.Content>
        <Tabs.Content value="rbac">Manage your Roles</Tabs.Content>
        <Tabs.Content value="forms">Manage your Forms</Tabs.Content>
      </Tabs.Root>
    </Box>
  );
}

export default Configuration;
