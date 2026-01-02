import React, { useEffect, useMemo } from "react";
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
  Card,
  Separator,
  Progress,
} from "@chakra-ui/react";

import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";

import AppLoader from "@/components/ui/AppLoader";
import AppError from "@/components/ui/AppError";

import {
  selectHomeData,
  selectLoading,
  selectError,
  clearAnalyticsError,
  getHomeData,
} from "@/features/reports/reportSlice";
import { selectUser } from "@/features/auth/authSlice";

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

// Resolve form id from whatever your backend sends.
// For forms: id is typically fine.
// For sessions: you MUST have formId/form_id included, otherwise we can’t build /forms/:formid.
function resolveFormCode(item) {
  return item?.formCode ?? item?.form_key ?? item?.formCode ?? item?.id ?? null;
}

/* -------------------------
   Component
-------------------------- */

export default function Home() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser);

  const userFirstName = user?.displayName;

  const home = useSelector(selectHomeData);
  const loading = useSelector(selectLoading);
  const error = useSelector(selectError);

  const sessions = Array.isArray(home?.sessions) ? home.sessions : [];
  const availableForms = Array.isArray(home?.availableForms)
    ? home.availableForms
    : [];
  const recentSubmissions = Array.isArray(home?.recentSubmissions)
    ? home.recentSubmissions
    : [];

  useEffect(() => {
    dispatch(getHomeData());
  }, [dispatch]);

  const sortedSessions = useMemo(() => {
    return [...sessions].sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
  }, [sessions]);

  const sortedForms = useMemo(() => {
    return [...availableForms];
  }, [availableForms]);

  const sortedSubmissions = useMemo(() => {
    return [...recentSubmissions].sort(
      (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
    );
  }, [recentSubmissions]);

  // Navigation rules:
  // - All forms: /forms
  // - Any session: /forms/:formid
  // - Any form: /forms/:formid
  const goAllForms = () => navigate("/forms");

  const goForm = (formCode) => {
    if (!formCode) return navigate("/forms");
    navigate(`/forms/${formCode}`);
  };

  const goFirstForm = () => {
    const first = sortedForms[0];
    goForm(resolveFormCode(first));
  };

  const retry = () => dispatch(getHomeData());
  const dismissError = () => dispatch(clearAnalyticsError());

  if (loading) return <AppLoader />;

  if (error) {
    return <AppError error={error} onRetry={retry} onDismiss={dismissError} />;
  }

  return (
    <Box p={{ base: 4, md: 6 }} maxW="1200px" mx="auto">
      {/* Header */}
      <VStack align="start" spacing={1} mb={6}>
        <Heading size="lg">Welcome, {userFirstName}</Heading>
        <Text color="gray.600">
          {sortedSessions.length > 0
            ? `You have ${sortedSessions.length} active session${
                sortedSessions.length > 1 ? "s" : ""
              } and ${sortedForms.length} available form${
                sortedForms.length !== 1 ? "s" : ""
              }.`
            : `No active sessions. You have ${
                sortedForms.length
              } available form${sortedForms.length !== 1 ? "s" : ""}.`}
        </Text>
      </VStack>

      <Grid
        templateColumns={{ base: "1fr", lg: "2fr 1fr" }}
        gap={5}
        alignItems="start"
      >
        {/* Left column */}
        <GridItem>
          <VStack spacing={5} align="stretch">
            {/* Sessions */}
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
                    <Text color="gray.600">
                      No active sessions. Start something new.
                    </Text>

                    <HStack>
                      <Button
                        colorScheme="blue"
                        onClick={goFirstForm}
                        isDisabled={sortedForms.length === 0}
                      >
                        Start a form
                      </Button>

                      <Button variant="ghost" onClick={goAllForms}>
                        Browse all forms
                      </Button>
                    </HStack>
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

                      const formId = resolveFormCode(s);

                      return (
                        <Box key={s.id} py={4}>
                          <HStack align="start" spacing={3}>
                            <Box flex="1">
                              <HStack wrap="wrap" spacing={2}>
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

                              {pct === 100 && (
                                <Text
                                  mt={2}
                                  fontSize="sm"
                                  color="orange.600"
                                  fontStyle="italic"
                                >
                                  All fields completed — final submission
                                  pending. Review your responses and click{" "}
                                  <strong>“Submit Final Response”</strong>{" "}
                                  inside the form to finish.
                                </Text>
                              )}
                            </Box>

                            <Button
                              size="sm"
                              bgColor={"#2596be"}
                              onClick={() => goForm(formId)}
                            >
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

            {/* Recent submissions */}
            <Card.Root width="full">
              <Card.Header>
                <VStack align="start" spacing={1}>
                  <Heading size="md">Recent submissions</Heading>
                  <Text fontSize="sm" color="gray.600">
                    Your latest submitted activity.
                  </Text>
                </VStack>
              </Card.Header>

              <Card.Body>
                {sortedSubmissions.length === 0 ? (
                  <VStack align="start" spacing={2}>
                    <Text color="gray.600">Nothing submitted recently.</Text>
                    <Text fontSize="sm" color="gray.500">
                      Completed submissions will appear here.
                    </Text>
                  </VStack>
                ) : (
                  <VStack align="stretch" spacing={0}>
                    {sortedSubmissions.map((s, idx) => (
                      <Box key={s.id} py={4}>
                        <HStack align="start" spacing={3}>
                          <Box flex="1">
                            <Heading size="sm">{s.formName}</Heading>
                            <Text fontSize="sm" color="gray.600" mt={1}>
                              Submitted {formatRelativeTime(s.submittedAt)}
                            </Text>
                          </Box>
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

        {/* Right column */}
        <GridItem>
          <VStack spacing={5} align="stretch">
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
                  <VStack align="start" spacing={3}>
                    <Text color="gray.600">No forms available right now.</Text>
                    <Button variant="ghost" size="sm" onClick={goAllForms}>
                      Browse all forms
                    </Button>
                  </VStack>
                ) : (
                  <VStack align="stretch" spacing={0}>
                    {sortedForms.map((f, idx) => {
                      const formId = resolveFormCode(f);

                      return (
                        <Box key={f.id ?? formId ?? idx} py={4}>
                          <HStack align="start" spacing={3}>
                            <Box flex="1">
                              <HStack wrap="wrap" spacing={2}>
                                <Heading size="sm">{f.name}</Heading>
                                {Number.isFinite(f.estMinutes) && (
                                  <Badge variant="subtle" colorScheme="gray">
                                    ~{f.estMinutes} min
                                  </Badge>
                                )}
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

                            <Button
                              size="sm"
                              bgColor={"#94ca5c"}
                              onClick={() => goForm(formId)}
                            >
                              Start
                            </Button>
                          </HStack>

                          {idx !== sortedForms.length - 1 && (
                            <Separator mt={4} />
                          )}
                        </Box>
                      );
                    })}
                  </VStack>
                )}
              </Card.Body>

              <Card.Footer>
                <Button variant="ghost" size="sm" w="full" onClick={goAllForms}>
                  Browse all forms
                </Button>
              </Card.Footer>
            </Card.Root>
          </VStack>
        </GridItem>
      </Grid>
    </Box>
  );
}
