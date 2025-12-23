import React from "react";
import { Box, Text, VStack, Button, HStack } from "@chakra-ui/react";
import { FiAlertTriangle, FiRefreshCw, FiArrowLeft } from "react-icons/fi";
import { useNavigate } from "react-router";

export default function AppError({
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again.",
  showBack = true,
  showRetry = false,
  onRetry,
}) {
  const navigate = useNavigate();

  return (
    <Box
      minH="calc(100vh - 64px)"
      display="grid"
      placeItems="center"
      px={6}
      bg="red.50"
    >
      <VStack
        gap={4}
        maxW="520px"
        w="full"
        border="1px solid"
        borderColor="red.200"
        borderRadius="16px"
        px={8}
        py={10}
        bg="white"
      >
        <Box
          w="56px"
          h="56px"
          display="grid"
          placeItems="center"
          borderRadius="full"
          bg="red.100"
          color="red.600"
        >
          <FiAlertTriangle size={28} />
        </Box>

        <Text
          fontSize="2xl"
          fontWeight="800"
          color="red.700"
          textAlign="center"
        >
          {title}
        </Text>

        <Text fontSize="md" color="red.600" textAlign="center" lineHeight="1.6">
          {message}
        </Text>

        <HStack pt={4} gap={3}>
          {showBack && (
            <Button
              variant="outline"
              colorScheme="red"
              leftIcon={<FiArrowLeft />}
              onClick={() => navigate(-1)}
            >
              Go back
            </Button>
          )}

          {showRetry && (
            <Button
              colorScheme="red"
              leftIcon={<FiRefreshCw />}
              onClick={onRetry}
            >
              Retry
            </Button>
          )}
        </HStack>
      </VStack>
    </Box>
  );
}
