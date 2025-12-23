import React from "react";
import { useState, useMemo } from "react";
import { Stack, Table, HStack, Text as ChakraText } from "@chakra-ui/react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

const DataTable = ({ columns, data, onSort }) => {
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    if (onSort) onSort(key, direction);
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);
  return (
    <Stack gap="10">
      <Table.Root key="outline" size="md" variant="outline">
        <Table.Header>
          <Table.Row>
            {columns.map((column) => (
              <Table.ColumnHeader
                key={column.key}
                cursor={column.sortable !== false ? "pointer" : "default"}
                onClick={() =>
                  column.sortable !== false && handleSort(column.key)
                }
                userSelect="none"
              >
                <HStack spacing={2}>
                  <ChakraText>{column.label} </ChakraText>
                  {column.sortable !== false &&
                    sortConfig.key === column.key &&
                    (sortConfig.direction === "asc" ? (
                      <FaChevronUp size={16} />
                    ) : (
                      <FaChevronDown size={16} />
                    ))}
                </HStack>
              </Table.ColumnHeader>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {sortedData.map((row, idx) => (
            <Table.Row key={idx} transition="background 0.2s">
              {columns.map((column) => (
                <Table.Cell
                  key={column.key}
                  maxWidth={column.label === "Description" ? 48 : 24}
                  maxHeight={4}
                >
                  {column.render
                    ? column.render(row[column.key], row)
                    : row[column.key]}
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Stack>
  );
};

export default DataTable;
