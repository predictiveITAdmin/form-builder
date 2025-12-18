import React, { useEffect, useMemo, useState } from "react";
import {
  Flex,
  VStack,
  HStack,
  Input,
  Text,
  Badge,
  IconButton,
  Button,
} from "@chakra-ui/react";
import DataTable from "../DataTable";
import { FaRegEye, FaSearch, FaRegEdit, FaTrashAlt } from "react-icons/fa";
import { FaPlus } from "react-icons/fa6";
import { Link } from "react-router-dom";

import { useDispatch, useSelector } from "react-redux";
import {
  fetchForms,
  selectForms,
  selectFormsStatus,
  selectFormsError,
} from "../../features/forms/formsSlice";

const Forms = () => {
  const dispatch = useDispatch();

  const forms = useSelector(selectForms);
  const status = useSelector(selectFormsStatus);
  const error = useSelector(selectFormsError);

  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    // Only fetch if we haven't already (prevents refetch loops)
    if (status === "idle") {
      dispatch(fetchForms());
    }
  }, [dispatch, status]);

  const filteredForms = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return forms;
    return (forms || []).filter((form) =>
      String(form.title || "")
        .toLowerCase()
        .includes(term)
    );
  }, [forms, searchTerm]);

  const columns = [
    { key: "title", label: "Title", sortable: true },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value) => (
        <Badge colorScheme={value === "Active" ? "green" : "gray"}>
          <Text>{value}</Text>
        </Badge>
      ),
    },
    {
      key: "created_at",
      label: "Created",
      sortable: true,
      render: (value) => (value ? new Date(value).toLocaleDateString() : "-"),
    },
    {
      key: "description",
      label: "Description",
      sortable: true,
      render: (value) => {
        if (!value) return "-";
        const maxLength = 96;
        return value.length > maxLength
          ? `${value.substring(0, maxLength)}...`
          : value;
      },
    },
    {
      key: "rpa_webhook_url",
      label: "Webhook URL",
      sortable: true,
      render: (value) => (value ? value : "-"),
    },
    {
      key: "owner_name",
      label: "Owner",
      sortable: true,
      render: (value) => (value ? value : "-"),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, row) => (
        <HStack spacing={2} width={12}>
          <IconButton
            size="sm"
            aria-label="View"
            variant="ghost"
            colorScheme="blue"
            // TODO: hook up view route
            onClick={() => console.log("view", row.form_id)}
          >
            <FaRegEye size={16} />
          </IconButton>

          <IconButton
            size="sm"
            aria-label="Edit"
            variant="ghost"
            colorScheme="purple"
            // TODO: hook up edit route
            onClick={() => console.log("edit", row.form_id)}
          >
            <FaRegEdit size={16} />
          </IconButton>

          <IconButton
            size="sm"
            aria-label="Delete"
            variant="ghost"
            colorScheme="red"
            // TODO: hook up delete action
            onClick={() => console.log("delete", row.form_id)}
          >
            <FaTrashAlt size={16} />
          </IconButton>
        </HStack>
      ),
    },
  ];

  return (
    <VStack spacing={6} align="stretch">
      <HStack>
        <Flex justify="space-between" align="center" gap={2} width="full">
          <Flex justify="space-around" align="center" gap={4}>
            <Input
              placeholder="Search forms by title..."
              value={searchTerm}
              width={96}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Flex>

          <Link to="/forms/new">
            <Button leftIcon={<FaPlus size={20} />} colorScheme="blue">
              <HStack>
                <FaPlus />
                New Form
              </HStack>
            </Button>
          </Link>
        </Flex>
      </HStack>

      {status === "loading" && <Text>Loading forms...</Text>}
      {status === "failed" && <Text color="red.500">{error}</Text>}

      <DataTable columns={columns} data={filteredForms} />
    </VStack>
  );
};

export default Forms;
