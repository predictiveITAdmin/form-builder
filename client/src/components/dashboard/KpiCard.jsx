import React from "react";
import { Box, Flex, Text, Heading, Badge } from "@chakra-ui/react";

export default function KpiCard({ label, value, hint, badge, icon }) {
  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderRadius="xl"
      p={4}
      boxShadow="sm"
      marginX={2}
    >
      <Flex justify="space-between" align="start" gap={3}>
        <Box>
          <Text fontSize="sm" color="gray.600">
            {label}
          </Text>
          <Heading size="lg" mt={1}>
            {value}
          </Heading>
          {hint ? (
            <Text fontSize="sm" color="gray.600" mt={2}>
              {hint}
            </Text>
          ) : null}
        </Box>
        <Flex direction="column" align="end" gap={2}>
          {badge ? <Badge>{badge}</Badge> : null}
          {icon ? <Box fontSize="2xl">{icon}</Box> : null}
        </Flex>
      </Flex>
    </Box>
  );
}
