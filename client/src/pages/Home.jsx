import React, { useMemo } from "react";
import {
  Box,
  Button,
  Heading,
  Text,
  VStack,
  HStack,
  Grid,
  GridItem,
  Badge,
  Progress,
  Spacer,
  Card,
  Separator,
} from "@chakra-ui/react";

/* -------------------------
   Helpers
-------------------------- */

function formatRelativeTime(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "Unknown";

  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;

  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;

  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;

  return `${Math.floor(d / 7)}w ago`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function StatusBadge({ status }) {
  if (!status) return null;

  const map = {
    Received: "gray",
    Processing: "blue",
    Completed: "green",
    Failed: "red",
  };

  return (
    <Badge variant="subtle" colorScheme={map[status] || "gray"}>
      {status === "Failed" ? "Needs attention" : status}
    </Badge>
  );
}

/* -------------------------
   Home Component
-------------------------- */

export default function Home() {
  /* -------------------------
     Dummy Data (replace later)
  -------------------------- */

  const userFirstName = "Bruce";

  const sessions = [
    {
      id: "s1",
      formName: "Onboarding Request",
      progressCurrent: 6,
      progressTotal: 12,
      updatedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    },
    {
      id: "s2",
      formName: "Hardware Request",
      progressCurrent: 2,
      progressTotal: 8,
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    },
  ];

  const availableForms = [
    {
      id: "f1",
      name: "Onboarding Request",
      description: "Request access, accounts, and onboarding tasks.",
      estMinutes: 6,
    },
    {
      id: "f2",
      name: "Hardware Request",
      description: "Request laptop, peripherals, or replacements.",
      estMinutes: 4,
    },
    {
      id: "f3",
      name: "Travel Reimbursement",
      description: "Submit expenses for approval.",
      estMinutes: 5,
    },
  ];

  const recentSubmissions = [
    {
      id: "r1",
      formName: "VPN Access",
      submittedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      status: "Received",
    },
    {
      id: "r2",
      formName: "Travel Reimbursement",
      submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      status: "Completed",
    },
  ];

  /* -------------------------
     Derived
  -------------------------- */

  const sortedSessions = useMemo(() => {
    return [...sessions].sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
  }, [sessions]);

  const sortedForms = useMemo(() => [...availableForms], [availableForms]);

  const sortedSubmissions = useMemo(() => {
    return [...recentSubmissions].sort(
      (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
    );
  }, [recentSubmissions]);

  /* -------------------------
     Render
  -------------------------- */

  return (
    <Box p={{ base: 4, md: 6 }} maxW="1200px" mx="auto">
      {/* Greeting */}
      <VStack align="start" spacing={1} mb={6}>
        <Heading size="lg">Welcome back, {userFirstName}</Heading>
        <Text color="gray.600">
          {sortedSessions.length > 0
            ? `You have ${sortedSessions.length} active session${
                sortedSessions.length > 1 ? "s" : ""
              } and ${sortedForms.length} form${
                sortedForms.length > 1 ? "s" : ""
              } available.`
            : `No active sessions right now. You have ${
                sortedForms.length
              } form${sortedForms.length > 1 ? "s" : ""} available to start.`}
        </Text>
      </VStack>

      {/* Layout: 2 columns on lg */}
      <Grid
        templateColumns={{ base: "1fr", lg: "2fr 1fr" }}
        gap={5}
        alignItems="start"
      >
        {/* Left: Sessions */}
        <GridItem>
          <VStack>
            <Card.Root width="full">
              <Card.Header>
                <VStack align="start" spacing={1}>
                  <Heading size="md">Your Pending Forms</Heading>
                  <Text fontSize="sm" color="gray.600">
                    Continue where you left off.
                  </Text>
                </VStack>
              </Card.Header>

              <Card.Body>
                {sortedSessions.length === 0 ? (
                  <VStack align="start" spacing={3}>
                    <Text color="gray.600">No active sessions.</Text>
                    <Button
                      colorScheme="blue"
                      isDisabled={sortedForms.length === 0}
                    >
                      Start a form
                    </Button>
                  </VStack>
                ) : (
                  <VStack align="stretch" spacing={0}>
                    {sortedSessions.map((s, idx) => {
                      const pct =
                        s.progressTotal > 0
                          ? clamp(
                              Math.round(
                                (s.progressCurrent / s.progressTotal) * 100
                              ),
                              0,
                              100
                            )
                          : 0;

                      return (
                        <Box key={s.id} py={4}>
                          <HStack align="start" spacing={3}>
                            <Box flex="1">
                              <HStack wrap="wrap">
                                <Heading size="sm">{s.formName}</Heading>
                                <Badge variant="outline" colorScheme="gray">
                                  Updated {formatRelativeTime(s.updatedAt)}
                                </Badge>
                              </HStack>

                              <Text fontSize="sm" color="gray.600" mt={1}>
                                Progress {s.progressCurrent}/{s.progressTotal}
                              </Text>

                              <Progress.Root
                                value={pct}
                                maxW="sm"
                                colorPalette={"green"}
                                variant={"outline"}
                              >
                                <HStack gap="5">
                                  <Progress.Label>Status</Progress.Label>
                                  <Progress.Track flex="1">
                                    <Progress.Range />
                                  </Progress.Track>
                                  <Progress.ValueText>
                                    {pct}%
                                  </Progress.ValueText>
                                </HStack>
                              </Progress.Root>
                            </Box>

                            <Button size="sm" bgColor={"#2596be"}>
                              Resume
                            </Button>
                          </HStack>

                          {idx !== sortedSessions.length - 1 && (
                            <Separator mt={4} />
                          )}
                        </Box>
                      );
                    })}
                  </VStack>
                )}
              </Card.Body>
            </Card.Root>

            <Card.Root width="full">
              <Card.Header>
                <VStack align="start" spacing={1}>
                  <Heading size="md">Recent submissions</Heading>
                  <Text fontSize="sm" color="gray.600">
                    Your latest activity.
                  </Text>
                </VStack>
              </Card.Header>

              <Card.Body>
                {sortedSubmissions.length === 0 ? (
                  <Text color="gray.600">Nothing submitted recently.</Text>
                ) : (
                  <VStack align="stretch" spacing={0}>
                    {sortedSubmissions.map((s, idx) => (
                      <Box key={s.id} py={4}>
                        <HStack align="start" spacing={3}>
                          <Box flex="1">
                            <Heading size="sm">{s.formName}</Heading>
                            <HStack mt={1} spacing={2} wrap="wrap">
                              <Text fontSize="sm" color="gray.600">
                                Submitted {formatRelativeTime(s.submittedAt)}
                              </Text>
                              <StatusBadge status={s.status} />
                            </HStack>
                          </Box>

                          <Button size="sm" variant="ghost">
                            View
                          </Button>
                        </HStack>

                        {idx !== sortedSubmissions.length - 1 && (
                          <Separator mt={4} />
                        )}
                      </Box>
                    ))}
                  </VStack>
                )}
              </Card.Body>
            </Card.Root>
          </VStack>
        </GridItem>

        {/* Right: Forms + Submissions */}
        <GridItem>
          <VStack spacing={5} align="stretch">
            {/* Available Forms */}
            <Card.Root>
              <Card.Header>
                <VStack align="start" spacing={1}>
                  <Heading size="md">Available forms</Heading>
                  <Text fontSize="sm" color="gray.600">
                    Forms you can start.
                  </Text>
                </VStack>
              </Card.Header>

              <Card.Body>
                {sortedForms.length === 0 ? (
                  <Text color="gray.600">No forms available right now.</Text>
                ) : (
                  <VStack align="stretch" spacing={0}>
                    {sortedForms.map((f, idx) => (
                      <Box key={f.id} py={4}>
                        <HStack align="start" spacing={3}>
                          <Box flex="1">
                            <HStack wrap="wrap" spacing={2}>
                              <Heading size="sm">{f.name}</Heading>
                            </HStack>

                            <Text
                              mt={1}
                              fontSize="sm"
                              color="gray.600"
                              noOfLines={2}
                            >
                              {f.description}
                            </Text>
                          </Box>

                          <Button size="sm" bgColor={"#94ca5c"}>
                            Start
                          </Button>
                        </HStack>

                        {idx !== sortedForms.length - 1 && <Separator mt={4} />}
                      </Box>
                    ))}
                  </VStack>
                )}
              </Card.Body>

              <Card.Footer>
                <Button variant="ghost" size="sm" w="full">
                  Browse all forms
                </Button>
              </Card.Footer>
            </Card.Root>

            {/* Recent Submissions */}
          </VStack>
        </GridItem>
      </Grid>
    </Box>
  );
}
