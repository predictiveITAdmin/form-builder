import { Box, Container, Flex } from "@chakra-ui/react";
import { Outlet } from "react-router-dom";

export default function FormsLayout() {
  return (
    <Box w="full" py={6}>
      <Container maxW="7xl">
        <Flex direction="column" gap={4}>
          <Outlet />
        </Flex>
      </Container>
    </Box>
  );
}
