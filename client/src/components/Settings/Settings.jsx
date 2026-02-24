import React, { useState, useEffect } from 'react';
import { Box, Text, Stack, Input, Button, Heading, HStack, Field, Dialog, CloseButton, Portal, Textarea } from '@chakra-ui/react';
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

const Settings = () => {
  const dispatch = useDispatch();
  
  const settingsData = useSelector(selectSettings);
  const status = useSelector(selectSettingsStatus);
  const sqlState = useSelector(selectSqlState);

  const [sessionRetention, setSessionRetention] = useState("");
  const [responsesRetention, setResponsesRetention] = useState("");
  const [logRetention, setLogRetention] = useState("");
  const [sqlQuery, setSqlQuery] = useState("");
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchSettings());
    }
  }, [status, dispatch]);

  useEffect(() => {
    if (status === 'succeeded' && settingsData) {
      setSessionRetention(settingsData.session_retention || "");
      setResponsesRetention(settingsData.responses_retention || "");
      setLogRetention(settingsData.log_retention || "");
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
        { property: "log_retention", value: logRetention }
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

  if (status === 'loading') return <Box p={5}><Text>Loading Settings...</Text></Box>;

  return (
    <Box>
      <HStack gap={6} justifyContent={"start"} alignItems={"start"}>
        
        {/* Retention Policies */}
        <Box p={5} borderWidth="1px" borderRadius="xl" shadow="sm">
          <Stack gap={4}>
            <Heading size="md">Retention Policies</Heading>
            <Text fontSize="sm" color="gray.500">
              Configure how long session and response data should be retained in the system. Maximum allowed retention is 720 days.
            </Text>
            
            <HStack gap={4} alignItems="flex-start" wrap="wrap">
              <Field.Root maxW="300px">
                <Field.Label>Session Retention (Days)</Field.Label>
                <Input 
                  type="number" 
                  max={720}
                  min={1}
                  value={sessionRetention}
                  onChange={(e) => setSessionRetention(handleNumberValidation(e.target.value))}
                  placeholder="Max 720 days"
                />
              </Field.Root>

              <Field.Root maxW="300px">
                <Field.Label>Responses Retention (Days)</Field.Label>
                <Input 
                  type="number" 
                  max={720}
                  min={1}
                  value={responsesRetention}
                  onChange={(e) => setResponsesRetention(handleNumberValidation(e.target.value))}
                  placeholder="Max 720 days"
                />
              </Field.Root>

              <Field.Root maxW="300px">
                <Field.Label>Log Retention (Days)</Field.Label>
                <Input 
                  type="number" 
                  max={720}
                  min={1}
                  value={logRetention}
                  onChange={(e) => setLogRetention(handleNumberValidation(e.target.value))}
                  placeholder="Max 720 days"
                />
              </Field.Root>
            </HStack>

            <Box pt={2}>
              <Button bgColor="#2596be" color="white" onClick={handleSave}>
                Save Retention Settings
              </Button>
            </Box>
          </Stack>
        </Box>

        {/* API Documentation */}
        <Box p={5} borderWidth="1px" borderRadius="xl" shadow="sm">
          <Stack gap={4}>
            <Heading size="md">API Documentation</Heading>
            <Text fontSize="sm" color="gray.500">
              View the dynamically generated OpenAPI (Swagger) documentation for all backend services.
            </Text>
            
            <Box pt={2}>
              <Button 
                bgColor="#10b981" 
                color="white" 
                onClick={() => window.open(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api-docs/`, '_blank')}
              >
                Open Swagger UI
              </Button>
            </Box>
          </Stack>
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

      </HStack>
    </Box>
  );
};

export default Settings;