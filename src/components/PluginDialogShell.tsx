import React from "react";
import { Flex } from "figma-kit";
import { Footer } from "./Footer";

interface PluginDialogShellProps {
  children: React.ReactNode;
  /** Full-width row pinned above the content columns. */
  header?: React.ReactNode;
  showFooter?: boolean;
}

export const PluginDialogShell: React.FC<PluginDialogShellProps> = ({
  children,
  header,
  showFooter = true,
}) => (
  <Flex
    direction="column"
    gap="4"
    style={{
      padding: "1rem",
      boxSizing: "border-box",
      height: "100%",
      minHeight: 0,
      flex: 1,
      // The body has overflow hidden, so anything taller than the panel — an
      // expanded note, a long estimate — has to scroll here or it is lost.
      overflowY: "auto",
    }}
  >
    {header && (
      <Flex direction="column" gap="2" style={{ flex: "0 0 auto" }}>
        {header}
      </Flex>
    )}
    <Flex direction="column" gap="4" style={{ flex: "1 0 auto", minHeight: 0 }}>
      {children}
    </Flex>
    {showFooter && <Footer />}
  </Flex>
);
