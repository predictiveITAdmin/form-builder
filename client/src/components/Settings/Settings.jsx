import React, { useState, useEffect } from 'react';
import { useAsync } from 'react-use';
import { http } from '../../api/http';
import { Box, Text, Stack, Input, Button, Heading, HStack, VStack, Field, Dialog, CloseButton, Portal, Textarea, Tabs, Switch, Badge, Combobox, useFilter, useListCollection, Span, Spinner, Loader } from '@chakra-ui/react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  fetchSettings, 
  saveSettings, 
  executeRawSql, 
  resetSqlResult,
  selectSettings, 
  selectSettingsStatus, 
  selectSqlState 
} from '../../features/settings/settingsSlice';
import { notify } from '../ui/notifyStore';
import AppLoader from '../ui/AppLoader';
import { useNavigate } from 'react-router';
const Settings = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const settingsData = useSelector(selectSettings);
  const status = useSelector(selectSettingsStatus);
  const sqlState = useSelector(selectSqlState);

  const [sessionRetention, setSessionRetention] = useState("");
  const [responsesRetention, setResponsesRetention] = useState("");
  const [logRetention, setLogRetention] = useState("");
  
  const [defaultFromEmail, setDefaultFromEmail] = useState("");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [enableEmailNotifications, setEnableEmailNotifications] = useState(true);
  const [pendingSessionReminderDays, setPendingSessionReminderDays] = useState("");
  const [maxLoginAttempts, setMaxLoginAttempts] = useState("");
  const [dashboardAnnouncement, setDashboardAnnouncement] = useState("");

  const [sqlQuery, setSqlQuery] = useState("");
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchSettings());
    }
  }, [status, dispatch]);

  const [inputValue, setInputValue] = useState("");

  const { collection, set: setCollection } = useListCollection({
    initialItems: [],
    itemToString: (item) => item.label,
    itemToValue: (item) => item.value,
  });

  const mailboxState = useAsync(async () => {
    if (status === 'idle') return;
    const response = await http.get(`/api/graph/mailboxes?search=${inputValue}`);
    setCollection(response.data.mailboxes || []);
  }, [inputValue, setCollection, status]);

  // Ensure the DB-provided defaultFromEmail is always in the collection so the Combobox can render its label properly
  useEffect(() => {
    if (defaultFromEmail && collection.items) {
      if (!collection.items.some(item => item.value === defaultFromEmail)) {
        setCollection([{ label: defaultFromEmail, value: defaultFromEmail }, ...collection.items]);
      }
    }
  }, [defaultFromEmail, collection.items, setCollection]);

  useEffect(() => {
    if (status === 'succeeded' && settingsData) {
      setSessionRetention(settingsData.session_retention || "");
      setResponsesRetention(settingsData.responses_retention || "");
      setLogRetention(settingsData.log_retention || "");
      setDefaultFromEmail(settingsData.default_from_email || "");
      setMaintenanceMode(settingsData.maintenance_mode === "true");
      setEnableEmailNotifications(settingsData.enable_email_notifications !== "false");
      setPendingSessionReminderDays(settingsData.pending_session_reminder_days || "7");
      setMaxLoginAttempts(settingsData.max_login_attempts || "5");
      setDashboardAnnouncement(settingsData.dashboard_announcement || "");

      // Initialize the input text to display the current default email
      setInputValue(settingsData.default_from_email || "");
    }
  }, [status, settingsData]);

  // Clean up any uncommitted SQL transaction when leaving the page
  useEffect(() => {
    return () => {
      dispatch(resetSqlResult());
    };
  }, [dispatch]);

  const handleSave = () => {
    const payload = {
      settings: [
        { property: "session_retention", value: sessionRetention },
        { property: "responses_retention", value: responsesRetention },
        { property: "log_retention", value: logRetention },
        { property: "default_from_email", value: defaultFromEmail },
        { property: "maintenance_mode", value: maintenanceMode ? "true" : "false" },
        { property: "enable_email_notifications", value: enableEmailNotifications ? "true" : "false" },
        { property: "pending_session_reminder_days", value: pendingSessionReminderDays },
        { property: "max_login_attempts", value: maxLoginAttempts },
        { property: "dashboard_announcement", value: dashboardAnnouncement }
      ]
    };
    dispatch(saveSettings(payload))
      .unwrap()
      .then(() => notify({ type: "success", title: "Saved", message: "Settings saved successfully!" }))
      .catch((err) => notify({ type: "error", title: "Error", message: `Failed to save settings: ${err}` }));
  };

  const handleNumberValidation = (valStr) => {
    if (valStr === "") return "";
    const val = Number(valStr);
    if (valStr.includes('.') || isNaN(val)) return parseInt(valStr) || "";
    if (val > 720) return 720;
    if (val < 1) return 1;
    return val;
  };

  const handleExecuteSql = () => {
    if (!sqlQuery.trim()) return;
    
    // Auto-detect SELECT. The backend natively ignores commits for SELECTs anyway
    const isSelect = sqlQuery.trim().toLowerCase().startsWith("select");
    
    if (!isSelect) {
      setIsConfirmDialogOpen(true);
      return;
    }

    dispatch(executeRawSql({ query: sqlQuery, action: 'execute' }));
  };

  const confirmAndExecute = () => {
    setIsConfirmDialogOpen(false);
    dispatch(executeRawSql({ query: sqlQuery, action: 'execute' }));
  };

  const handleCommit = () => {
    if (!sqlState.txId) return;
    dispatch(executeRawSql({ action: 'commit', txId: sqlState.txId }))
      .unwrap()
      .then(() => notify({ type: "success", title: "Committed", message: "Transaction safely committed to the database." }));
  };

  const handleRollback = () => {
    if (!sqlState.txId) return;
    dispatch(executeRawSql({ action: 'rollback', txId: sqlState.txId }))
      .unwrap()
      .then(() => notify({ type: "info", title: "Rolled Back", message: "Transaction rolled back successfully. No data was changed." }));
  };

  if (status === 'loading') return <AppLoader />;

  return (
    <Box maxW="1200px" mx="auto" p={4}>
      <HStack justify="space-between" mb={6}>
        <Heading size="lg">System Settings</Heading>
        <Button bgColor="#2596be" color="white" onClick={handleSave}>
          Save All Settings
        </Button>
      </HStack>

      <Tabs.Root defaultValue="general" variant="enclosed" colorScheme="blue">
        <Tabs.List>
          <Tabs.Trigger value="general">General & Communications</Tabs.Trigger>
          <Tabs.Trigger value="security">Security & Retention</Tabs.Trigger>
          <Tabs.Trigger value="developer">Developer & Advanced</Tabs.Trigger>
        </Tabs.List>

        <Box p={6} mt={2} borderWidth="1px" borderTop="none" borderBottomRadius="xl" shadow="sm" bg="white">
          <Tabs.Content value="general" m={0} p={0}>
            <VStack align="stretch" gap={8} display={sqlState.txId ? "none" : "flex"}> {/* Hide content here to avoid confusing SQL UI overlay issues, actually better to just conditionally render */}
              
              <Box>
                <Heading size="md" mb={4}>Global Configurations</Heading>
                <VStack align="stretch" gap={4}>
                  <Field.Root maxW="500px">
                    <Field.Label>Maintenance Mode</Field.Label>
                    <HStack>
                      <Switch.Root 
                        checked={maintenanceMode} 
                        onCheckedChange={(e) => setMaintenanceMode(e.checked)}
                        colorPalette="red"
                      >
                        <Switch.HiddenInput />
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch.Root>
                      <Text fontSize="sm" color="gray.500">
                        {maintenanceMode ? "System is currently IN maintenance mode." : "Enable to temporarily pause new form submissions and logins."}
                      </Text>
                    </HStack>
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>Dashboard Announcement Banner</Field.Label>
                    <Textarea 
                      value={dashboardAnnouncement}
                      onChange={(e) => setDashboardAnnouncement(e.target.value)}
                      placeholder="Enter a message to display to all users on their dashboard (supports HTML)..."
                      rows={3}
                    />
                    <Text fontSize="xs" color="gray.500" mt={1}>Leave blank to hide the banner.</Text>
                  </Field.Root>
                </VStack>
              </Box>

              <Box>
                <Heading size="md" mb={4}>Email Communications</Heading>
                <VStack align="stretch" gap={6}>
                  <Field.Root>
                    <Field.Label>Enable Email Notifications</Field.Label>
                    <HStack>
                      <Switch.Root
                        checked={enableEmailNotifications}
                        onCheckedChange={(e) => setEnableEmailNotifications(e.checked)}
                        colorPalette="green"
                      >
                        <Switch.HiddenInput />
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch.Root>
                      <Text fontSize="sm" color="gray.500">
                        Global toggle to allow outgoing system emails.
                      </Text>
                    </HStack>
                  </Field.Root>

                  <HStack gap={6} alignItems="flex-start" wrap="wrap">
                    <Field.Root maxW="300px">
                      <Field.Label>Default "From" Email</Field.Label>
                      <Combobox.Root
                        collection={collection}
                        value={defaultFromEmail ? [defaultFromEmail] : []}
                        inputValue={inputValue}
                        onValueChange={(e) => {
                          setDefaultFromEmail(e.value[0] || "");
                          if (e.items && e.items.length > 0) {
                            setInputValue(e.items[0].label || e.items[0].value || "");
                          } else {
                            setInputValue("");
                          }
                        }}
                        onInputValueChange={(e) => setInputValue(e.inputValue)}
                        positioning={{ sameWidth: false, placement: "bottom-start" }}
                        width="300px"
                      >
                        <Combobox.Control>
                          <Combobox.Input placeholder="Select mailbox..." />
                          <Combobox.IndicatorGroup>
                            <Combobox.ClearTrigger />
                            <Combobox.Trigger />
                          </Combobox.IndicatorGroup>
                        </Combobox.Control>
                        <Portal>
                          <Combobox.Positioner>
                            <Combobox.Content minW="sm">
                              <Combobox.Empty>No items found</Combobox.Empty>
                              {mailboxState.loading ? (
                                <HStack p="2">
                                  <Spinner size="xs" borderWidth="1px" />
                                  <Span>Loading...</Span>
                                </HStack>
                              ) : mailboxState.error ? (
                                <Span p="2" color="red.500">
                                  Error fetching
                                </Span>
                              ) : (
                                collection.items?.map((item) => (
                                  <Combobox.Item item={item} key={item.value}>
                                    <HStack justify="space-between" w="full" textStyle="sm">
                                      <Span fontWeight="medium" truncate>
                                        {item.label}
                                      </Span>
                                      <Span color="gray.500" truncate>
                                        {item.value}
                                      </Span>
                                    </HStack>
                                    <Combobox.ItemIndicator />
                                  </Combobox.Item>
                                ))
                              )}
                            </Combobox.Content>
                          </Combobox.Positioner>
                        </Portal>
                      </Combobox.Root>
                    </Field.Root>

                    <Field.Root maxW="300px">
                      <Field.Label>Pending Session Reminders (Days)</Field.Label>
                      <Input 
                        type="number"
                        min={1}
                        value={pendingSessionReminderDays}
                        onChange={(e) => setPendingSessionReminderDays(handleNumberValidation(e.target.value))}
                        placeholder="e.g. 7"
                      />
                      <Text fontSize="xs" color="gray.500" mt={1}>Days before sending a reminder email for uncompleted sessions.</Text>
                    </Field.Root>
                  </HStack>
                </VStack>
              </Box>
            </VStack>
          </Tabs.Content>

          <Tabs.Content value="security" m={0} p={0}>
            <VStack align="stretch" gap={8} display={sqlState.txId ? "none" : "flex"}>
              <Box>
                <Heading size="md" mb={4}>Account Security</Heading>
                <Field.Root maxW="300px">
                  <Field.Label>Max Login Attempts</Field.Label>
                  <Input 
                    type="number"
                    min={1}
                    max={20}
                    value={maxLoginAttempts}
                    onChange={(e) => setMaxLoginAttempts(handleNumberValidation(e.target.value))}
                  />
                  <Text fontSize="xs" color="gray.500" mt={1}>Failed attempts before temporary lockout.</Text>
                </Field.Root>
              </Box>

              <Box>
                <Heading size="md" mb={4}>Data Retention Policies</Heading>
                <Text fontSize="sm" color="gray.600" mb={4}>
                  Configure how long temporary data should be retained in the system. Maximum allowed retention is 720 days.
                </Text>
                <HStack gap={6} alignItems="flex-start" wrap="wrap">
                  <Field.Root maxW="200px">
                    <Field.Label>Session Retention (Days)</Field.Label>
                    <Input 
                      type="number" 
                      max={720}
                      min={1}
                      value={sessionRetention}
                      onChange={(e) => setSessionRetention(handleNumberValidation(e.target.value))}
                    />
                  </Field.Root>

                  <Field.Root maxW="200px">
                    <Field.Label>Responses Retention (Days)</Field.Label>
                    <Input 
                      type="number" 
                      max={720}
                      min={1}
                      value={responsesRetention}
                      onChange={(e) => setResponsesRetention(handleNumberValidation(e.target.value))}
                    />
                  </Field.Root>

                  <Field.Root maxW="200px">
                    <Field.Label>Log Retention (Days)</Field.Label>
                    <Input 
                      type="number" 
                      max={720}
                      min={1}
                      value={logRetention}
                      onChange={(e) => setLogRetention(handleNumberValidation(e.target.value))}
                    />
                  </Field.Root>
                </HStack>
              </Box>
            </VStack>
          </Tabs.Content>

          <Tabs.Content value="developer" m={0} p={0}>
             <Stack gap={8}>
                {/* API Documentation */}
                <Box>
                  <Heading size="md" mb={2}>API Documentation</Heading>
                  <Text fontSize="sm" color="gray.500" mb={4}>
                    View the dynamically generated OpenAPI (Swagger) documentation for all backend services.
                  </Text>
                  <Button 
                    bgColor="#10b981" 
                    color="white" 
                    onClick={() => window.open('/api-docs', '_blank')}
                  >
                    Open Swagger UI
                  </Button>
                </Box>

                {/* Database Management / Raw SQL Executor */}
                <Box p={5} borderWidth="1px" borderRadius="xl" shadow="sm" borderColor="red.200" bg="red.50">
                  <Stack gap={4}>
                    <Heading size="md" color="red.700">Database Management (Raw SQL)</Heading>
                    <Text fontSize="sm" color="red.600" fontWeight="semibold">
                      Warning: This is an advanced feature. Commands executed here run directly against the database inside a transaction. You must <b>Commit</b> your changes to make them permanent.
                    </Text>
                      
                      <Field.Root>
                        <Field.Label>SQL Query</Field.Label>
                        <Textarea
                          value={sqlQuery}
                          onChange={(e) => setSqlQuery(e.target.value)}
                          placeholder="SELECT table_name FROM information_schema.tables;"
                          minH="150px"
                          bg="white"
                          fontFamily="monospace"
                          disabled={!!sqlState.txId}
                        />
                      </Field.Root>
                    
                    <HStack gap={3}>
                      <Button 
                        colorScheme="red" 
                        bgColor="red.600" 
                        color="white" 
                        onClick={handleExecuteSql}
                        disabled={!!sqlState.txId || sqlState.status === 'loading'}
                      >
                        {sqlState.status === 'loading' && !sqlState.txId ? 'Executing...' : 'Execute SQL'}
                      </Button>

                      {sqlState.txId && (
                        <>
                          <Button 
                            colorScheme="green" 
                            bgColor="green.600" 
                            color="white" 
                            onClick={handleCommit}
                          >
                            Commit Changes
                          </Button>
                          <Button 
                            variant="outline" 
                            colorScheme="gray" 
                            onClick={handleRollback}
                          >
                            Rollback
                          </Button>
                          <Text fontSize="sm" color="green.700" fontWeight="bold">
                            [Pending Transaction: Please Commit or Rollback]
                          </Text>
                        </>
                      )}
                    </HStack>

                    {(sqlState.result || sqlState.error) && (
                      <Box mt={4} p={4} bg="gray.900" color="green.300" borderRadius="md" overflowX="auto">
                        <Text fontSize="sm" fontFamily="monospace" whiteSpace="pre-wrap">
                          {JSON.stringify(sqlState.error || sqlState.result, null, 2)}
                        </Text>
                      </Box>
                    )}
                    
                    {/* Destructive Confirm Dialog */}
                    <Dialog.Root open={isConfirmDialogOpen} onOpenChange={(e) => setIsConfirmDialogOpen(e.open)}>
                      <Portal>
                        <Dialog.Backdrop />
                        <Dialog.Positioner zIndex={2000}>
                          <Dialog.Content>
                            <Dialog.Header>
                              <Dialog.Title>Destructive Query Detected</Dialog.Title>
                              <Dialog.CloseTrigger asChild>
                                <CloseButton size="sm" />
                              </Dialog.CloseTrigger>
                            </Dialog.Header>
                            <Dialog.Body>
                              <Text>WARNING: You are about to execute a destructive backend query that modifies live data. You will have a chance to Rollback, but please proceed with caution.</Text>
                              <Text mt={4} fontWeight="bold">Are you really sure you want to test this query?</Text>
                            </Dialog.Body>
                            <Dialog.Footer>
                              <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>Cancel</Button>
                              <Button colorScheme="red" bg="red.600" color="white" onClick={confirmAndExecute}>Proceed</Button>
                            </Dialog.Footer>
                          </Dialog.Content>
                        </Dialog.Positioner>
                      </Portal>
                    </Dialog.Root>

                  </Stack>
                </Box>
             </Stack>
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Box>
  );
};

export default Settings;