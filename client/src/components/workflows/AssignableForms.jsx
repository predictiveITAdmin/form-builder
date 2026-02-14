import React from "react";
import {
  VStack,
  HStack,
  Stack,
  Dialog,
  Text,
  Button,
  Input,
  Fieldset,
  Field,
  Combobox,
  useListCollection,
  useFilter,
  Portal,
  Checkbox,
} from "@chakra-ui/react";
import AppLoader from "../ui/AppLoader";

const AssignableForms = ({
  assignableForms,
  isRequired,
  setIsRequired,
  allowMultiple,
  setAllowMultiple,
  sortOrder,
  setSortOrder,
  manageFormsOpen,
  closeManageForms,
  assignableFormsLoading,
  workflowTitle,
  setManageFormsOpen,
  selectedFormId,
  setDefaultName,
  defaultName,
  setSelectedFormId,
  onAssignForm,
  assignFormLoading,
}) => {
  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, filter } = useListCollection({
    initialItems: (Array.isArray(assignableForms) ? assignableForms : []).map(
      (form) => ({
        label: form.title,
        value: form.form_id,
      }),
    ),
    filter: contains,
    limit: 10,
  });
  return (
    <Dialog.Root
      open={manageFormsOpen}
      onOpenChange={(e) => setManageFormsOpen(e.open)}
    >
      <Dialog.Trigger asChild>
        <span style={{ display: "none" }} />
      </Dialog.Trigger>

      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content borderRadius="2xl">
          <Dialog.CloseTrigger onClick={closeManageForms} />

          {assignableFormsLoading ? (
            <Dialog.Body>
              <AppLoader />
            </Dialog.Body>
          ) : (
            <Dialog.Body marginTop={6}>
              <VStack align="stretch" spacing={3}>
                <Text fontSize={14}>
                  <b>Workflow:</b> {workflowTitle}
                </Text>
                <Fieldset.Root size={"lg"} maxW={"md"}>
                  <Stack>
                    <Fieldset.Legend>Add Forms to Template</Fieldset.Legend>
                    <Fieldset.HelperText>
                      Please provide details below.
                    </Fieldset.HelperText>
                  </Stack>
                  <Fieldset.Content>
                    <Field.Root>
                      <Field.Label>Form Name</Field.Label>
                      <Combobox.Root
                        collection={collection}
                        onValueChange={(e) => setSelectedFormId(e.value ?? "")}
                        onInputValueChange={(e) => filter(e.inputValue)}
                      >
                        <Combobox.Label>Select Form</Combobox.Label>

                        <Combobox.Control>
                          <Combobox.Input placeholder="Type to search" />
                          <Combobox.IndicatorGroup>
                            <Combobox.ClearTrigger />
                            <Combobox.Trigger />
                          </Combobox.IndicatorGroup>
                        </Combobox.Control>
                        <Portal>
                          <Combobox.Positioner zIndex="popover">
                            <Combobox.Content zIndex="popover">
                              <Combobox.Empty>No items found</Combobox.Empty>
                              {collection.items.map((item) => (
                                <Combobox.Item item={item} key={item.value}>
                                  {item.label}
                                  <Combobox.ItemIndicator />
                                </Combobox.Item>
                              ))}
                            </Combobox.Content>
                          </Combobox.Positioner>
                        </Portal>
                      </Combobox.Root>
                    </Field.Root>
                    <HStack justify="space-between" align="end" w="full">
                      <VStack spacing={3} align="start">
                        <Field.Root>
                          <Field.Label>
                            Enter Default Name for Items created in Runs
                          </Field.Label>
                          <Input
                            type="text"
                            value={defaultName}
                            onChange={(e) => setDefaultName(e.target.value)}
                          />
                        </Field.Root>
                        <Field.Root>
                          <Checkbox.Root
                            checked={isRequired}
                            onCheckedChange={(e) => setIsRequired(!!e.checked)}
                          >
                            <Checkbox.HiddenInput />
                            <Checkbox.Control />
                            <Checkbox.Label>Required</Checkbox.Label>
                          </Checkbox.Root>
                        </Field.Root>

                        <Checkbox.Root
                          checked={allowMultiple}
                          onCheckedChange={(e) => setAllowMultiple(!!e.checked)}
                        >
                          <Checkbox.HiddenInput />
                          <Checkbox.Control />
                          <Checkbox.Label>Allow Multiple</Checkbox.Label>
                        </Checkbox.Root>
                      </VStack>

                      <Field.Root maxW={20}>
                        <Field.Label>Sort Order</Field.Label>
                        <Input
                          type="number"
                          maxW={20}
                          max={50}
                          value={sortOrder}
                          onChange={(e) => setSortOrder(e.target.value)}
                        />
                      </Field.Root>
                    </HStack>
                  </Fieldset.Content>
                </Fieldset.Root>
              </VStack>
            </Dialog.Body>
          )}

          <Dialog.Footer>
            <HStack>
              <Button variant="outline" onClick={closeManageForms}>
                Cancel
              </Button>
              <Button
                bgColor="#2590ce"
                color="#fff"
                onClick={onAssignForm}
                isLoading={assignFormLoading}
              >
                Add Form to Template
              </Button>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};

export default AssignableForms;
