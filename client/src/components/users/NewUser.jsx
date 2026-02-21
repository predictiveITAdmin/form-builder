import {
  newUserInvitation,
  selectNewUser,
  selectNewUserError,
  selectNewUserStatus,
} from "@/features/auth/authSlice";
import {
  Button,
  Dialog,
  Portal,
  Stack,
  Input,
  Field,
  useSelect,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { notify } from "../ui/notifyStore";

const NewUser = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!displayNameTouched && email.includes("@")) {
      const name = email
        .split("@")[0]
        .replace(/[._]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      setDisplayName(name);
    }
    if (email === "") {
      setDisplayName(email);
    }
  }, [email, displayNameTouched]);

  const handleInvite = async () => {

    try {
      const created = await dispatch(
        newUserInvitation({ displayName, email })
      ).unwrap();


      notify({ type: "success", message: "User Created Successfully!" });
      setEmail("");
      setDisplayName("");
      setDisplayNameTouched(false);

      onClose();
    } catch (err) {
      notify({ type: "error", message: "failed to create User. " + err });
      setEmail("");
      setDisplayName("");
      setDisplayNameTouched(false);

      onClose();
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content
            // 👇 control height + layout
            maxH="80vh"
            display="flex"
            flexDirection="column"
          >
            {/* Sticky Header */}
            <Dialog.Header
              position="sticky"
              top="0"
              zIndex="1"
              bg="bg.surface"
              borderBottomWidth="1px"
            >
              <Dialog.Title>Invite New User</Dialog.Title>
            </Dialog.Header>

            {/* Scrollable Body */}
            <Dialog.Body flex="1" overflowY="auto">
              <Stack gap={4}>
                <Field.Root>
                  <Field.Label>Email</Field.Label>
                  <Input
                    placeholder="user@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field.Root>

                <Field.Root>
                  <Field.Label>Display Name</Field.Label>
                  <Input
                    placeholder="user"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayNameTouched(true);
                      setDisplayName(e.target.value);
                    }}
                  />
                </Field.Root>
              </Stack>
            </Dialog.Body>

            {/* Sticky Footer */}
            <Dialog.Footer
              position="sticky"
              bottom="0"
              zIndex="1"
              bg="bg.surface"
              borderTopWidth="1px"
            >
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.ActionTrigger>

              <Button onClick={handleInvite} bgColor={"#94ca5c"}>
                Send Invite
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

export default NewUser;
