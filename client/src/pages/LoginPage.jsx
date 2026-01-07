import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loginExternal, refreshUser } from "../features/auth/authSlice";
import {
  Box,
  Button,
  Separator,
  Text,
  VStack,
  Input,
  Field,
  HStack,
  Flex,
} from "@chakra-ui/react";
import { NavLink, useNavigate } from "react-router";
import logo from "../assets/logo-predictiveIT.svg";
import { BsMicrosoft } from "react-icons/bs";

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { status, error } = useSelector((s) => s.auth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();

    const res = await dispatch(
      loginExternal({ email: email.toLowerCase(), password })
    );

    if (loginExternal.fulfilled.match(res)) {
      // Pull the permission-rich user payload from /api/auth/me
      await dispatch(refreshUser());
      navigate("/");
    }
  };

  const loginWithMicrosoft = () => {
    // sends user to your backend route
    window.location.href = `${
      import.meta.env.VITE_API_BASE_URL
    }/api/auth/signin`;
  };

  return (
    <>
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
        </Flex>
      </Box>
      <Box minH="80vh" display="grid" placeItems="center" p="6">
        <Box
          w="full"
          maxW="sm"
          p="8"
          borderWidth="1px"
          borderRadius="xl"
          boxShadow="0 4px 12px rgba(0, 0, 0, 0.08)"
        >
          <VStack spacing="6" align="stretch">
            <Box>
              <Text color="gray.700" my="1" textAlign={"center"}>
                Please sign in to continue
              </Text>
            </Box>

            <form onSubmit={onSubmit}>
              <VStack spacing="4" align="stretch">
                <Field.Root>
                  <Field.Label>Email</Field.Label>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field.Root>

                <Field.Root>
                  <Field.Label>Password</Field.Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field.Root>

                <Field.Root invalid={!!error}>
                  {error ? <Field.ErrorText>{error}</Field.ErrorText> : null}
                </Field.Root>

                <Button
                  type="submit"
                  isLoading={status === "loading"}
                  variant={"solid"}
                  colorPalette="blue"
                >
                  Login
                </Button>
                <HStack my="2">
                  <Separator flex="1" />
                  <Text flexShrink="0">OR</Text>
                  <Separator flex="1" />
                </HStack>
                <Button onClick={loginWithMicrosoft} variant="outline">
                  <BsMicrosoft />
                  Login with Microsoft
                </Button>
                <Text
                  color="gray.700"
                  my="1"
                  textAlign={"center"}
                  fontSize="sm"
                >
                  (For Internal Use Only)
                </Text>
              </VStack>
            </form>
          </VStack>
        </Box>
      </Box>
    </>
  );
}
