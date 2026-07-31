import React from "react";
import { Flex, Text } from "figma-kit";
import { PLUGIN_VERSION } from "../snapshot/buildSnapshot";

export const Footer: React.FC = () => (
  <Flex justify="between" align="center" style={{ paddingTop: "0.5rem", opacity: 0.6 }}>
    <Text size="small">Help an Agent · Atropical AS</Text>
    <Text size="small">v{PLUGIN_VERSION}</Text>
  </Flex>
);
