import React from "react";
import { useState, useMemo, useCallback } from "react";
import { Stack, Table, HStack, Text as ChakraText } from "@chakra-ui/react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

/**
 * rowClickable options (all optional):
 * - false (default): rows are not clickable
 * - function: (row) => void
 * - object:
 *    - onClick: (row) => void
 *    - to: string | (row) => string   (falls back to window.location.assign)
 */
const DataTable = ({ columns, data, onSort, rowClickable = false }) => {
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  // Only treat rows as interactive if rowClickable is a function or a config object.
  // (Boolean true is ignored to avoid accidental "clickable" tables.)
  const rowsInteractive = rowClickable && rowClickable !== true;

  const getRowTarget = useCallback(
    (row) => {
      if (!rowClickable || rowClickable === true) return null;

      if (typeof rowClickable === "function") {
        // Treat as an onClick handler.
        return { onClick: rowClickable };
      }

      if (typeof rowClickable === "object") {
        const to = rowClickable.to;
        const resolvedTo =
          typeof to === "function"
            ? to(row)
            : typeof to === "string"
            ? to
            : null;

        return {
          onClick: rowClickable.onClick,
          to: resolvedTo,
        };
      }

      return null;
    },
    [rowClickable]
  );

  const handleRowClick = useCallback(
    (row) => {
      const target = getRowTarget(row);
      if (!target) return;

      if (typeof target.onClick === "function") {
        target.onClick(row);
        return;
      }

      if (typeof target.to === "string" && target.to.length) {
        window.location.assign(target.to);
      }
    },
    [getRowTarget]
  );

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
            <Table.Row
              key={idx}
              transition="background 0.2s"
              cursor={rowsInteractive ? "pointer" : "default"}
              _hover={rowsInteractive ? { bg: "gray.50" } : undefined}
              role={rowsInteractive ? "button" : undefined}
              tabIndex={rowsInteractive ? 0 : undefined}
              onClick={rowsInteractive ? () => handleRowClick(row) : undefined}
              onKeyDown={
                rowsInteractive
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleRowClick(row);
                      }
                    }
                  : undefined
              }
            >
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
