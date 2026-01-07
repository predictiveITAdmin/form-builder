import React, { useMemo } from "react";
import {
  Box,
  Flex,
  Heading,
  Text,
  Button,
  HStack,
  Dialog,
} from "@chakra-ui/react";
import { FiMaximize2, FiDownload } from "react-icons/fi";
import Papa from "papaparse";

function downloadTextFile(filename, text, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

function toCsv(rows) {
  return Papa.unparse(rows ?? []);
}

export default function ChartCard({
  title,
  subtitle,
  children,
  csvRows,
  csvFileName = "export.csv",
  rightActions,
  dialogSize = "xl", // try: "xl", "2xl", "4xl", "6xl"
}) {
  const csv = useMemo(() => toCsv(csvRows), [csvRows]);

  return (
    <Dialog.Root size={dialogSize} placement="center" motionPreset="scale">
      {/* CARD */}
      <Box bg="white" borderWidth="1px" borderRadius="xl" p={4} boxShadow="sm">
        <Flex justify="space-between" align="start" gap={3} mb={3}>
          <Box>
            <Heading size="md">{title}</Heading>
            {subtitle ? (
              <Text fontSize="sm" color="gray.600" mt={1}>
                {subtitle}
              </Text>
            ) : null}
          </Box>

          <HStack>
            {csvRows?.length ? (
              <Button
                size="sm"
                variant="outline"
                leftIcon={<FiDownload />}
                onClick={() => downloadTextFile(csvFileName, csv, "text/csv")}
              >
                CSV
              </Button>
            ) : null}

            <Dialog.Trigger asChild>
              <Button size="sm" variant="outline" leftIcon={<FiMaximize2 />}>
                Zoom
              </Button>
            </Dialog.Trigger>

            {rightActions ?? null}
          </HStack>
        </Flex>

        {children}
      </Box>

      {/* ZOOM DIALOG */}
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.CloseTrigger />

          <Dialog.Header>
            <Dialog.Title>{title}</Dialog.Title>
          </Dialog.Header>

          <Dialog.Body>
            {/* Render the same chart content bigger */}
            {children}
          </Dialog.Body>

          <Dialog.Footer>
            {csvRows?.length ? (
              <Button
                variant="outline"
                leftIcon={<FiDownload />}
                onClick={() => downloadTextFile(csvFileName, csv, "text/csv")}
              >
                Download CSV
              </Button>
            ) : null}

            <Dialog.CloseTrigger asChild>
              <Button>Close</Button>
            </Dialog.CloseTrigger>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
