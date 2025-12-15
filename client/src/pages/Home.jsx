import { Box, Text } from "@chakra-ui/react";

function Home() {
  return (
    <Box>
      <Text fontSize="3xl" fontWeight="bold" mb={4}>
        Home Page
      </Text>
      <Text color="gray.600">
        Welcome to the home page of your application.
      </Text>
    </Box>
  );
}

export default Home;
