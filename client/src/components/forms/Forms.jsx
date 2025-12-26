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
  ButtonGroup,
  Pagination,
  InputGroup,
} from "@chakra-ui/react";
import DataTable from "../DataTable";
import { FaRegEye, FaSearch, FaRegEdit, FaTrashAlt } from "react-icons/fa";
import { FaPlus } from "react-icons/fa6";
import { Link, useNavigate } from "react-router-dom";
import { usePagination } from "@/utils/pagination";
import { useDispatch, useSelector } from "react-redux";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi";
import {
  fetchForms,
  selectForms,
  selectFormsStatus,
  selectFormsError,
} from "../../features/forms/formsSlice";
import AppLoader from "../ui/AppLoader";
import AppError from "../ui/AppError";

const Forms = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const forms = useSelector(selectForms);
  const status = useSelector(selectFormsStatus);
  const error = useSelector(selectFormsError);

  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    // Only fetch if we haven't already (prevents refetch loops)
    dispatch(fetchForms());
  }, [dispatch]);

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
        <HStack spacing={0} width={12}>
          <IconButton
            size="sm"
            aria-label="View"
            variant="ghost"
            color={"green.600"}
            // TODO: hook up view route
            onClick={() => navigate(`/forms/${row.form_key}`)}
          >
            <FaRegEye size={16} />
          </IconButton>

          <IconButton
            size="sm"
            aria-label="Edit"
            variant="ghost"
            color={"#FFBF00"}
            // TODO: hook up edit route
            onClick={() => console.log("edit", row.form_key)}
          >
            <FaRegEdit size={16} />
          </IconButton>

          <IconButton
            size="sm"
            aria-label="Delete"
            variant="ghost"
            color="#BA2222"
            // TODO: hook up delete action
            onClick={() => console.log("delete", row.form_key)}
          >
            <FaTrashAlt size={16} />
          </IconButton>
        </HStack>
      ),
    },
  ];
  const { page, setPage, pageSize, totalItems, pageData } = usePagination(
    filteredForms,
    5
  );

  if (status === "loading") {
    return <AppLoader />;
  }

  if (error) {
    return <AppError message={error} />;
  }

  return (
    <VStack spacing={6} align="stretch">
      <HStack>
        <Flex justify="space-between" align="center" gap={2} width="full">
          <Flex justify="space-around" align="center" gap={4}>
            <InputGroup startElement={<FaSearch />}>
              <Input
                placeholder="Search forms by title..."
                value={searchTerm}
                width={96}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </InputGroup>
          </Flex>

          <Link to="/forms/new">
            <Button
              leftIcon={<FaPlus size={20} />}
              color={"#fff"}
              bgColor={"#2590ce"}
            >
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

      <DataTable columns={columns} data={pageData ?? []} />
      <Pagination.Root
        count={totalItems}
        pageSize={pageSize}
        page={page}
        onPageChange={(e) => setPage(e.page)}
      >
        <ButtonGroup
          variant="ghost"
          size="sm"
          justifyContent="flex-end"
          w="full"
          mt={3}
        >
          <Pagination.PrevTrigger asChild>
            <IconButton aria-label="Previous page">
              <HiChevronLeft />
            </IconButton>
          </Pagination.PrevTrigger>

          <Pagination.Items
            render={(p) => (
              <IconButton
                aria-label={`Page ${p.value}`}
                variant={p.value === page ? "outline" : "ghost"}
              >
                {p.value}
              </IconButton>
            )}
          />

          <Pagination.NextTrigger asChild>
            <IconButton aria-label="Next page">
              <HiChevronRight />
            </IconButton>
          </Pagination.NextTrigger>
        </ButtonGroup>
      </Pagination.Root>
    </VStack>
  );
};

export default Forms;
