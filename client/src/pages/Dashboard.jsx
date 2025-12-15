import { Box, Text } from "@chakra-ui/react";

function Dashboard() {
  return (
    <Box>
      <Text fontSize="3xl" fontWeight="bold" mb={4}>
        Dashboard
      </Text>
      <Text color="gray.600">Your dashboard content goes here.</Text>
    </Box>
  );
}

export default Dashboard;
