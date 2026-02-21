import React, { useState, useEffect } from 'react';
import { Box, Stack, Heading, Select, Button, HStack, Text, Badge, Portal, createListCollection, IconButton, Dialog, CloseButton } from '@chakra-ui/react';
import { useDispatch, useSelector } from 'react-redux';
import DataTable from '../DataTable';
import { fetchAuditLogs, selectAuditLogs, selectAuditLogsStatus } from '../../features/settings/settingsSlice';
import { FaEye } from 'react-icons/fa';

const resourceTypes = createListCollection({
  items: [
    { label: "Forms", value: "forms" },
    { label: "Users", value: "users" },
    { label: "Roles", value: "roles" },
    { label: "Settings", value: "settings" },
  ],
});

const Logs = () => {
  const dispatch = useDispatch();
  const { data: logs, pagination } = useSelector(selectAuditLogs);
  const status = useSelector(selectAuditLogsStatus);

  const [resourceType, setResourceType] = useState('forms');
  const [page, setPage] = useState(1);

  useEffect(() => {
    dispatch(fetchAuditLogs({ resourceType, page, limit: 20 }));
  }, [resourceType, page, dispatch]);

  const renderChanges = (diff) => {
    if (!diff) return <Text color="gray.500">None</Text>;
    
    let badge;
    let content;

    if (diff.type === 'create' || diff.type === 'update') {
      badge = diff.type === 'create' 
        ? <Badge colorScheme="green">Created Record</Badge>
        : <Badge colorScheme="orange">{diff.changes?.length || 0} Updates</Badge>;

      if (diff.changes?.length > 0) {
        content = (
          <Stack gap={3}>
            {diff.changes.map((c, idx) => (
              <Box key={idx} fontSize="sm" borderWidth="1px" p={3} borderRadius="md" bg="gray.50" mb={4}>
                <Text fontWeight="bold" color="blue.600" mb={2}>Field: {c.field}</Text>
                <HStack align="flex-start" gap={4}>
                  {diff.type !== 'create' && (
                    <Box flex={1} p={2} bg="red.50" borderRadius="sm">
                      <Text fontSize="xs" fontWeight="bold" color="red.800" mb={1}>From</Text>
                      <Text as="pre" whiteSpace="pre-wrap" fontSize="xs" maxH="150px" overflowY="auto">{JSON.stringify(c.from, null, 2)}</Text>
                    </Box>
                  )}
                  <Box flex={1} p={2} bg="green.50" borderRadius="sm">
                    <Text fontSize="xs" fontWeight="bold" color="green.800" mb={1}>{diff.type === 'create' ? 'Value' : 'To'}</Text>
                    <Text as="pre" whiteSpace="pre-wrap" fontSize="xs" maxH="150px" overflowY="auto">{JSON.stringify(c.to, null, 2)}</Text>
                  </Box>
                </HStack>
              </Box>
            ))}
          </Stack>
        );
      } else {
        content = <Text pb={4}>No specific field changes recorded.</Text>;
      }
    } else if (diff.type === 'delete') {
      badge = <Badge colorScheme="red">Deleted Record</Badge>;
      content = <Text pb={4}>Record was completely destroyed.</Text>;
    } else {
      return <Text color="gray.500">No modifications</Text>;
    }

    return (
      <HStack gap={4}>
        {badge}
        <Dialog.Root size="xl" placement="center" motionPreset="slide-in-bottom">
          <Dialog.Trigger asChild>
            <Button
              aria-label="View changes"
              variant="outline"
              colorScheme="gray"
              size="xs"
            >
              <FaEye /> View
            </Button>
          </Dialog.Trigger>
          <Portal>
            <Dialog.Backdrop />
            <Dialog.Positioner zIndex={2000}>
              <Dialog.Content maxH="90vh" overflowY="auto">
                <Dialog.Header>
                  <Dialog.Title>Audit Changes</Dialog.Title>
                  <Dialog.CloseTrigger asChild>
                    <CloseButton size="sm" />
                  </Dialog.CloseTrigger>
                </Dialog.Header>
                <Dialog.Body pb={6}>
                  {content}
                </Dialog.Body>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>
      </HStack>
    );
  };

  const columns = [
    { key: "id", label: "ID" },
    { 
      key: "timestamp", 
      label: "Timestamp",
      render: (val) => new Date(val).toLocaleString()
    },
    { 
      key: "user_name", 
      label: "User",
      render: (val, row) => val || row.username || "System"
    },
    { key: "resource_type", label: "Resource Type" },
    { key: "resource_id", label: "Resource ID" },
    { 
      key: "action", 
      label: "Action",
      render: (_, row) => (
        <HStack>
          <Badge>{row.http_method}</Badge>
          <Badge colorScheme={row.response_status < 400 ? "green" : "red"}>{row.response_status}</Badge>
        </HStack>
      )
    },
    {
      key: "diff",
      label: "Changes",
      render: (val) => renderChanges(val)
    }
  ];

  const isLoading = status === 'loading';

  return (
    <Box p={5}>
      <Stack gap={6}>
        <HStack justify="space-between">
          <Heading size="lg">Audit Logs</Heading>
          
          <HStack>
            <Text fontWeight="medium" whiteSpace="nowrap">Resource Type:</Text>
            <Select.Root 
              value={[resourceType]} 
              onValueChange={(e) => {
                setResourceType(e.value[0]);
                setPage(1);
              }}
              width="200px"
              bg="white"
              collection={resourceTypes}
            >
              <Select.Trigger>
                <Select.ValueText placeholder="Select mapping..." />
              </Select.Trigger>
              <Portal>
                <Select.Positioner>
                  <Select.Content>
                    {resourceTypes.items.map((item) => (
                      <Select.Item item={item} key={item.value}>
                        {item.label}
                        <Select.ItemIndicator />
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Positioner>
              </Portal>
            </Select.Root>
          </HStack>
        </HStack>

        <Box borderWidth="1px" borderRadius="lg" bg="white" overflowX="auto" p={4}>
          {isLoading && logs.length === 0 ? (
            <Text>Loading logs...</Text>
          ) : (
            <>
              <DataTable columns={columns} data={logs} />
              
              <HStack mt={4} justify="space-between">
                <Button 
                  disabled={page <= 1 || isLoading} 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  variant="outline"
                >
                  Previous
                </Button>
                <Text>Page {pagination.page} of {pagination.totalPages}</Text>
                <Button 
                  disabled={page >= pagination.totalPages || isLoading} 
                  onClick={() => setPage(p => p + 1)}
                  variant="outline"
                >
                  Next
                </Button>
              </HStack>
            </>
          )}
        </Box>
      </Stack>
    </Box>
  );
};

export default Logs;