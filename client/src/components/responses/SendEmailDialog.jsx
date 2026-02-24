import React, { useEffect, useState } from "react";
import {
  VStack,
  Input,
  Text,
  IconButton,
  Button,
  Dialog,
  Textarea,
  Field,
} from "@chakra-ui/react";
import { FaEnvelope } from "react-icons/fa";

import { notify } from "../ui/notifyStore";
import { http } from "@/api/http";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

const SendEmailDialog = ({ responseId, submitterName, senderName, defaultToEmail, trigger }) => {
  const [to, setTo] = useState(defaultToEmail || "");
  const [subject, setSubject] = useState("");
  const [salutation, setSalutation] = useState(
    submitterName ? `Dear ${submitterName},` : "Dear,"
  );
  const [message, setMessage] = useState("");
  const [regards, setRegards] = useState(
    `Best regards,\n${senderName || "Admin"}`
  );
  const [isSending, setIsSending] = useState(false);
  const [open, setOpen] = useState(false);

  // Sync state if defaultToEmail changes
  useEffect(() => {
    if (defaultToEmail && !to) {
      setTo(defaultToEmail);
    }
  }, [defaultToEmail]);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim() || !to.trim()) {
      notify({ type: "error", message: "To, Subject, and message are required." });
      return;
    }

    try {
      setIsSending(true);
      await http.post(`/api/responses/${responseId}/email`, {
        to,
        subject,
        salutation,
        message,
        regards,
      });
      notify({ type: "success", message: "Email dispatched successfully" });
      setOpen(false);
      setTo(defaultToEmail || "");
      setSubject("");
      setSalutation(submitterName ? `Dear ${submitterName},` : "Dear,");
      setMessage("");
      setRegards(`Best regards,\n${senderName || "Admin"}`);
    } catch (err) {
      notify({
        type: "error",
        message: err.response?.data?.error || "Failed to send email",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(e) => setOpen(e.open)}>
      <Dialog.Trigger asChild>
        {trigger || (
          <IconButton
            size="sm"
            aria-label="Send email"
            variant="ghost"
            color="blue.500"
          >
            <FaEnvelope size={16} />
          </IconButton>
        )}
      </Dialog.Trigger>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.CloseTrigger />
          <Dialog.Header>
            <Dialog.Title>Send Custom Email</Dialog.Title>
          </Dialog.Header>
           <Dialog.Body>
                      <VStack spacing={4} align="stretch" mt={2}>
                        <Text fontSize="sm" color="gray.600">
                          Send an email regarding this response.
                        </Text>
                        
                        <Field.Root>
                          <Field.Label>To</Field.Label>
                          <Input
                            placeholder="To (e.g. submitter@example.com)"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                          />
                        </Field.Root>

                        <Field.Root>
                          <Field.Label>Subject</Field.Label>
                          <Input
                            placeholder="Subject line..."
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                          />
                        </Field.Root>

                        <Field.Root>
                          <Field.Label>Salutation</Field.Label>
                          <Input
                            placeholder="Salutation (e.g. Dear John,)"
                            value={salutation}
                            onChange={(e) => setSalutation(e.target.value)}
                          />
                        </Field.Root>

                        <Field.Root>
                          <Field.Label>Message</Field.Label>
                          <ReactQuill
                            theme="snow"
                            value={message}
                            onChange={setMessage}
                            placeholder="Type your message here..."
                            style={{ height: "150px", marginBottom: "40px", width: "100%" }}
                          />
                        </Field.Root>

                        <Field.Root>
                          <Field.Label>Regards</Field.Label>
                          <Textarea
                            rows={3}
                            placeholder="Regards (e.g. Best regards, Admin)"
                            value={regards}
                            onChange={(e) => setRegards(e.target.value)}
                            p={2}
                          />
                        </Field.Root>
                      </VStack>
                    </Dialog.Body>
                    <Dialog.Footer>
                      <Dialog.CloseTrigger asChild>
                      </Dialog.CloseTrigger>
                      <Button
                        bgColor={"#2596be"}
                        onClick={handleSend}
                        loading={isSending}
                      >
                        Send Email
                      </Button>
                    </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};

export default SendEmailDialog;
