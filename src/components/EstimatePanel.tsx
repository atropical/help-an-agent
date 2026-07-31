import React, { useMemo } from "react";
import { Flex, Text } from "figma-kit";
import { estimateScan, formatBytes, formatDuration } from "../snapshot/estimate";
import { FORMATS } from "../snapshot/encode";
import { formatTokenRange } from "../utils/tokens";
import { ProbeResult } from "../types.d";

interface EstimatePanelProps {
  probe: ProbeResult | null;
  probing: boolean;
}

/**
 * Shows what a full scan will cost before the user starts one. On a large
 * icon library the difference between depth 2 and depth 8 is minutes of
 * waiting and hundreds of thousands of tokens, and that is worth knowing in
 * advance rather than after.
 */
export const EstimatePanel: React.FC<EstimatePanelProps> = ({ probe, probing }) => {
  const estimate = useMemo(() => (probe ? estimateScan(probe) : null), [probe]);

  if (probing && !estimate) {
    return (
      <Text size="small" style={{ color: "var(--figma-color-text-secondary)" }}>
        Sizing up this file…
      </Text>
    );
  }
  if (!estimate) return null;

  return (
    <Flex
      direction="column"
      gap="1"
      style={{
        border: "1px solid var(--figma-color-border)",
        borderRadius: 4,
        padding: 8,
        opacity: probing ? 0.5 : 1,
      }}
    >
      <Text size="small" weight="strong">
        {estimate.componentCount.toLocaleString()} components ·{" "}
        {estimate.totalNodes.toLocaleString()} nodes · scan {formatDuration(estimate.millis)}
      </Text>
      {FORMATS.map((descriptor) => {
        const forFormat = estimate.perFormat[descriptor.format];
        return (
          <Text key={descriptor.format} size="small" style={{ color: "var(--figma-color-text-secondary)" }}>
            {descriptor.label}: {formatTokenRange(forFormat.tokens)} tokens · {formatBytes(forFormat.bytes)}
          </Text>
        );
      })}
      <Text size="small" style={{ color: "var(--figma-color-text-tertiary)" }}>
        Fitted from {estimate.sampleSize} sampled components against an exact node count for the whole
        file. Expect a few percent out; more on a library of very uneven components.
      </Text>
    </Flex>
  );
};
