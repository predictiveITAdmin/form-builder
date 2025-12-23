import { Heading, VStack } from "@chakra-ui/react";
import React from "react";
import { Outlet } from "react-router-dom";

export default function FormsLayout() {
  return (
    <>
      <Outlet />
    </>
  );
}
