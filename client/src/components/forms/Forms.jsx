import React from "react";
import { Flex, VStack } from "@chakra-ui/react";
import {
  Heading,
  Button,
  Badge,
  IconButton,
  HStack,
  Input,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";
import DataTable from "../DataTable";
import { FaRegEye, FaSearch } from "react-icons/fa";
import { FaRegEdit } from "react-icons/fa";
import { FaTrashAlt } from "react-icons/fa";
import { FaPlus } from "react-icons/fa6";
import { Link } from "react-router";

const Forms = () => {
  const [searchTerm, setSearchTerm] = useState("");

  // Mock data
  const [forms] = useState([
    {
      form_id: 1,
      title: "Customer Feedback Form",
      description: "Collect customer feedback and suggestions",
      status: "Active",
      owner_user_id: 101,
      created_at: "2024-12-01T10:30:00Z",
      field_count: 8,
    },
    {
      form_id: 2,
      title: "Employee Onboarding",
      description: "New employee information collection",
      status: "Draft",
      owner_user_id: 102,
      created_at: "2024-12-10T14:20:00Z",
      field_count: 12,
    },
    {
      form_id: 3,
      title: "Bug Report Form",
      description: "Report software bugs and issues",
      status: "Active",
      owner_user_id: 101,
      created_at: "2024-11-15T09:15:00Z",
      field_count: 6,
    },
  ]);

  const filteredForms = forms.filter((form) =>
    form.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      key: "field_count",
      label: "Fields",
      sortable: true,
      render: (value) => <Text fontWeight="medium">{value}</Text>,
    },
    {
      key: "created_at",
      label: "Created",
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
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
          >
            <FaRegEye size={16} />
          </IconButton>
          <IconButton
            size="sm"
            icon={<FaRegEdit size={16} />}
            aria-label="Edit"
            variant="ghost"
            colorScheme="purple"
          >
            <FaRegEdit size={16} />{" "}
          </IconButton>
          <IconButton
            size="sm"
            aria-label="Delete"
            variant="ghost"
            colorScheme="red"
          >
            <FaTrashAlt size={16} color="red" />
          </IconButton>
        </HStack>
      ),
    },
  ];
  return (
    <>
      <VStack spacing={6} align="stretch">
        <HStack>
          <Flex justify="space-between" align="center" gap={2} width={"full"}>
            <Flex justify="space-around" align="center" gap={4}>
              <Input
                placeholder="Search forms by title..."
                value={searchTerm}
                width={96}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </Flex>
            <Link to={"/forms/new"}>
              <Button leftIcon={<FaPlus size={20} />} colorScheme="blue">
                <HStack>
                  <FaPlus />
                  New Form
                </HStack>
              </Button>
            </Link>
          </Flex>
        </HStack>

        <DataTable columns={columns} data={filteredForms} />
      </VStack>
    </>
  );
};

export default Forms;
