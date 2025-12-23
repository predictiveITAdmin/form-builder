import { Link, NavLink, useNavigate, useLocation } from "react-router";
import {
  Box,
  Button,
  Flex,
  Text,
  VStack,
  HStack,
  Spacer,
} from "@chakra-ui/react";
import { useDispatch, useSelector } from "react-redux";
import { logoutUser } from "../features/auth/authSlice";
import {
  FaArrowLeft,
  FaArrowRight,
  FaHome,
  FaTachometerAlt,
} from "react-icons/fa";
import { FaWpforms } from "react-icons/fa6";
import { LuTicketCheck } from "react-icons/lu";
import { CiSettings } from "react-icons/ci";
import { useState } from "react";
import logo from "../assets/logo-predictiveIT.svg";
import { IoIosLogOut } from "react-icons/io";
import { selectUser } from "../features/auth/authSlice";
import AppToast from "@/components/ui/AppToast";

function Layout({ children }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const user = useSelector(selectUser);
  const handleLogout = async (e) => {
    e.preventDefault();
    console.log("Logging out...");
    await dispatch(logoutUser());
    window.location.replace("/login");
  };

  const menuItems = [
    { path: "/", label: "Home", icon: <FaHome /> },
    { path: "/forms", label: "Forms", icon: <FaWpforms /> },
    { path: "/dashboard", label: "Dashboard", icon: <FaTachometerAlt /> },
    { path: "/responses", label: "Responses", icon: <LuTicketCheck /> },
    { path: "/configuration", label: "Configuration", icon: <CiSettings /> },
  ];

  return (
    <Flex direction="column" minH="100vh">
      <AppToast placement="top-center" />
      {/* Top Bar */}
      <Box bg="white" color="Black" px={6} py={4} boxShadow="md">
        <Flex justify="space-between" align="center">
          <HStack spacing={4}>
            <Box
              bg="white"
              color="blue.600"
              px={4}
              py={2}
              borderRadius="md"
              fontWeight="bold"
              fontSize="xl"
            >
              <NavLink to="/" className="flex items-center space-x-2">
                <img src={logo} alt="PredictiveIT Logo" className="h-10" />
              </NavLink>
            </Box>
            <Text
              as="h1"
              fontSize={{ base: "xl", md: "2xl" }}
              fontWeight="bold"
              letterSpacing="0.1em"
              color={"#24619e"}
              fontStyle={"italic"}
            >
              Automation Portal
            </Text>
          </HStack>
          <HStack
            spacing={4}
            paddingX={4}
            paddingY={2}
            borderRadius="md"
            border="1px solid"
            borderColor="gray.200"
            alignItems="center"
          >
            <VStack align="flex-start" alignItems={"center"} spacing={0}>
              <Text fontSize="sm" color="gray.500">
                Signed in as
              </Text>
              <Text fontSize="md" fontWeight="medium">
                {user.displayName}
              </Text>
            </VStack>

            <Spacer />

            <Button
              size="sm"
              onClick={handleLogout}
              variant="outline"
              borderColor="red.500"
              color="red.600"
            >
              <IoIosLogOut />
              Logout
            </Button>
          </HStack>
        </Flex>
      </Box>

      {/* Main Content Area */}
      <Flex flex={1}>
        {/* Sidebar */}
        <Box
          w={isSidebarOpen ? "250px" : "60px"}
          bg="white"
          borderRight="1px"
          borderColor="gray.200"
          transition="width 0.3s"
        >
          <Box mt={4}>
            <Button
              size="sm"
              w="3em"
              ml={"4px"}
              backgroundColor={"#2596be"}
              onClick={() => setSidebarOpen(!isSidebarOpen)}
            >
              {isSidebarOpen ? <FaArrowLeft /> : <FaArrowRight />}
            </Button>
          </Box>
          <VStack align="stretch" spacing={0} py={4}>
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}>
                  <Box
                    px={4}
                    py={3}
                    bg={isActive ? "#2596be" : "transparent"}
                    color={isActive ? "white" : "gray.700"}
                    _hover={{ bg: isActive ? "#2596be" : "gray.200" }}
                    cursor="pointer"
                    fontWeight={isActive ? "semibold" : "normal"}
                    transition="all 0.2s"
                  >
                    {isSidebarOpen ? (
                      <Flex align="center" gap="3">
                        <Box>{item.icon}</Box>
                        <Text>{item.label}</Text>
                      </Flex>
                    ) : (
                      item.icon
                    )}
                  </Box>
                </Link>
              );
            })}
          </VStack>
        </Box>

        {/* Page Content */}
        <Box flex={1} bg="#FAFFFF" p={6} overflowY="scroll" maxHeight={"80vh"}>
          {children}
        </Box>
      </Flex>

      {/* Footer */}
      <Box bg="gray.700" color="white" py={2} px={6} textAlign="center">
        <Text fontSize="sm">
          © 2025 Automation Portal. All rights reserved.
        </Text>
      </Box>
    </Flex>
  );
}

export default Layout;
