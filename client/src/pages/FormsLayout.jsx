import { Heading, VStack } from "@chakra-ui/react";
import React from "react";
import { Outlet } from "react-router-dom";

export default function FormsLayout() {
  return (
    <>
      <Heading mb={4} fontSize={24}>
        Forms
      </Heading>
      <Outlet />
    </>
  );
}
