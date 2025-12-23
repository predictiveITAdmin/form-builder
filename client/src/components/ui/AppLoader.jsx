import React from "react";
import { Box, Text, VStack } from "@chakra-ui/react";
import { FiLoader } from "react-icons/fi";

const spinKeyframes = `
@keyframes appSpin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes appPulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}
`;

export default function AppLoader({
  label = "Loading",
  sublabel = "Fetching data…",
  overlay = false,
  fullHeight = false,
  size = 28,
}) {
  return (
    <Box
      position={overlay ? "fixed" : "relative"}
      inset={overlay ? 0 : "auto"}
      zIndex={overlay ? 2000 : "auto"}
      display="grid"
      placeItems="center"
      minH={fullHeight ? "calc(100vh - 64px)" : "auto"}
      bg={overlay ? "rgba(10, 14, 20, 0.55)" : "transparent"}
      backdropFilter={overlay ? "blur(10px)" : "none"}
      px={6}
      py={10}
    >
      <Box
        bg="rgba(255,255,255,0.06)"
        border="1px solid rgba(255,255,255,0.14)"
        borderRadius="16px"
        px={7}
        py={6}
        maxW="420px"
        w="full"
      >
        <style>{spinKeyframes}</style>

        <VStack gap={2} align="center">
          <Box
            display="grid"
            placeItems="center"
            w="52px"
            h="52px"
            borderRadius="14px"
            bg="rgba(255,255,255,0.08)"
            border="1px solid rgba(255,255,255,0.12)"
          >
            <FiLoader
              size={size}
              style={{
                animation: "appSpin 0.9s linear infinite",
                opacity: 0.95,
              }}
            />
          </Box>

          <Text mt={2} fontSize="lg" fontWeight="700" letterSpacing="0.2px">
            {label}
          </Text>

          <Text
            fontSize="sm"
            opacity={0.8}
            textAlign="center"
            style={{ animation: "appPulse 1.6s ease-in-out infinite" }}
          >
            {sublabel}
          </Text>
        </VStack>
      </Box>
    </Box>
  );
}
