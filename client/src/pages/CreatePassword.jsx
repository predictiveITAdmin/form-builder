import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  Text,
  Alert,
  Stack,
  VStack,
  Icon,
  Fieldset,
  Field,
  HStack,
  CloseButton,
} from "@chakra-ui/react";
import { NavLink } from "react-router";
import logo from "../assets/logo-predictiveIT.svg";

import { FiLock } from "react-icons/fi";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useMemo, useState } from "react";
import {
  createPassword,
  selectAuthStatus,
  selectAuthError,
  clearError,
} from "@/features/auth/authSlice";

export default function CreatePasswordPage() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") || "", [params]);

  const [isAlertOpen, setIsAlertOpen] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const status = useSelector(selectAuthStatus);
  const apiError = useSelector(selectAuthError);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState("");
  const [success, setSuccess] = useState("");

  const isLoading = status === "loading";

  useEffect(() => {
    dispatch(clearError());
    setLocalError("");
    setSuccess("");
  }, [dispatch]);

  const validate = () => {
    if (!token) return "Invite link is missing or invalid.";
    if (!password || !confirm) return "Please fill in both fields.";
    if (password !== confirm) return "Passwords do not match.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (apiError) return apiError;
    return "";
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    setSuccess("");

    const err = validate();
    if (err) {
      setLocalError(err);
      setIsAlertOpen(true);
      return;
    }

    const res = await dispatch(
      createPassword({ inviteToken: token, newPassword: password })
    );

    if (createPassword.fulfilled.match(res)) {
      setSuccess("Password created successfully. Redirecting to login...");
      setTimeout(() => navigate("/login"), 1000);
    }
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
      {isAlertOpen && (
        <Alert.Root
          status="error"
          title="Something went wrong"
          position={"absolute"}
          minWidth={"400px"}
          maxWidth={"400px"}
          justifySelf={"center"}
          mt={2}
          variant="solid"
        >
          <Alert.Indicator alignSelf={"center"} />
          <Alert.Content>
            <Alert.Title>Something Went Wrong</Alert.Title>
            <Alert.Description>
              {localError ||
                (typeof apiError === "string" ? apiError : apiError?.message) ||
                "Something went wrong."}
            </Alert.Description>
          </Alert.Content>
          <CloseButton
            pos="relative"
            top="-2"
            insetEnd="-2"
            onClick={() => {
              setIsAlertOpen(false);
              setLocalError("");
            }}
          />
        </Alert.Root>
      )}

      {success && (
        <Alert.Root
          status="success"
          title="Password Created Successfully"
          position={"absolute"}
          minWidth={"400px"}
          maxWidth={"400px"}
          justifySelf={"center"}
          mt={2}
        >
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>You can login now!</Alert.Title>
            <Alert.Description>{success}</Alert.Description>
          </Alert.Content>
          <CloseButton pos="relative" top="-2" insetEnd="-2" />
        </Alert.Root>
      )}
      <Flex align="center" justify="center" px={4} mt={24}>
        <Box
          w="100%"
          maxW="420px"
          bg="white"
          p={8}
          borderRadius="xl"
          boxShadow="lg"
        >
          <VStack spacing={4} align="stretch">
            <Flex align="center" gap={2}>
              <Icon as={FiLock} boxSize={6} color="brand.primary" />
              <Heading size="md">Create your password</Heading>
            </Flex>

            <Text fontSize="sm" color="gray.600">
              Set a password to activate your account. This invite link expires
              after 24 hours
            </Text>

            <Box as="form" onSubmit={onSubmit}>
              <Fieldset.Root size="lg" maxW="md">
                <Stack>
                  <Fieldset.Legend>Password setup</Fieldset.Legend>
                  <Fieldset.HelperText>
                    Choose a password for your account.
                  </Fieldset.HelperText>
                </Stack>

                <Fieldset.Content>
                  <Field.Root>
                    <Field.Label>New password</Field.Label>
                    <Input
                      name="newPassword"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      disabled={!token || isLoading}
                    />
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>Confirm password</Field.Label>
                    <Input
                      name="confirmPassword"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      autoComplete="new-password"
                      disabled={!token || isLoading}
                    />
                  </Field.Root>
                </Fieldset.Content>

                <Button
                  type="submit"
                  alignSelf="flex-end"
                  bg="#2596be"
                  color="white"
                  border="1px solid "
                  _hover={{ bg: "white", color: "#2596be" }}
                  isLoading={isLoading}
                  isDisabled={!token || isLoading}
                >
                  Create password
                </Button>
              </Fieldset.Root>
            </Box>
          </VStack>
        </Box>
      </Flex>
    </>
  );
}
