export const SNAPSHOT_SCHEMA = "help-an-agent/design-system-snapshot@1";

export enum PluginCommands {
  SNAPSHOT = "snapshot",
  DIFF = "diff",
}

export enum MessageTypes {
  BASIC_INFO = "basic-info",
  PROBE = "probe",
  PROBE_RESULT = "probe-result",
  BUILD_SNAPSHOT = "build-snapshot",
  SNAPSHOT_PROGRESS = "snapshot-progress",
  SNAPSHOT_RESULT = "snapshot-result",
  SNAPSHOT_ERROR = "snapshot-error",
}

/** One half of the sample, measured on its own so cost can be fitted. */
export interface ProbeGroup {
  /** A real snapshot containing only this group's components. */
  snapshot: Snapshot;
  componentCount: number;
  nodes: number;
  millis: number;
}

/**
 * Result of measuring a representative sample of the file rather than all of
 * it, so the UI can tell the user what a full scan will cost them before they
 * commit to waiting for it.
 */
export interface ProbeResult {
  componentCount: number;
  sampleSize: number;
  /**
   * Nodes in every component's subtree, counted for the whole file at the
   * chosen depth. Cost tracks nodes far better than it tracks component count
   * — a 9-variant set is worth dozens of icons.
   */
  totalNodes: number;
  /**
   * The sample split into a small-component group and a large-component group.
   * Two groups with different shapes give two equations, which is what lets
   * the estimate separate per-component cost from per-node cost instead of
   * assuming everything scales the same way.
   */
  groups: ProbeGroup[];
  /** Fixed cost already paid: loading pages, styles and variables. */
  overheadMs: number;
  /** The snapshot with no components, isolating the fixed part of the output. */
  base: Snapshot;
}

/** Serialized form of a single node inside a component's subtree. */
export interface SerializedNode {
  type: string;
  name: string;
  /** Only present when the node is hidden — absence means visible. */
  hidden?: boolean;
  props: Record<string, unknown>;
  children?: SerializedNode[];
  /** Set when traversal hit the configured depth limit. */
  truncated?: boolean;
}

export interface ComponentPropertyRecord {
  type: string;
  defaultValue?: unknown;
  /** Variant options, sorted. */
  variantOptions?: string[];
  /** Preferred instance-swap values, as component/component-set keys. */
  preferredValues?: string[];
}

export interface ComponentRecord {
  /** Publish key — stable across renames and across files. Empty for unpublished nodes. */
  key: string;
  /**
   * Figma node id (`5526:1123`). The only field that addresses this component
   * from outside the snapshot: it builds the `?node-id=` deep link and is what
   * the MCP tools accept. Excluded from the hash and the diff — it is an
   * address, not content, and it changes when a file is duplicated.
   */
  nodeId: string;
  name: string;
  /** Page name + parent frame/section path, for humans reading the report. */
  path: string;
  type: "COMPONENT" | "COMPONENT_SET";
  description: string;
  documentationLinks: string[];
  properties: Record<string, ComponentPropertyRecord>;
  /**
   * For a COMPONENT_SET: each variant child, keyed by its variant name
   * (e.g. `Size=Large, State=Hover`). A set's own `structure` carries only
   * set-level props — the variant trees live here so a diff can name the
   * exact variant that changed.
   */
  variants?: Record<string, { key: string; nodeId: string; hash: string; structure: SerializedNode }>;
  structure: SerializedNode;
  /** Content hash of everything above except `path` (position is not a change). */
  hash: string;
}

export interface StyleRecord {
  key: string;
  name: string;
  type: "PAINT" | "TEXT" | "EFFECT" | "GRID";
  description: string;
  value: unknown;
  hash: string;
}

export interface VariableRecord {
  key: string;
  name: string;
  collection: string;
  resolvedType: string;
  scopes: string[];
  codeSyntax: Record<string, string>;
  description: string;
  /** Mode name -> value (aliases rendered as `{Collection/Variable}`). */
  valuesByMode: Record<string, unknown>;
  hash: string;
}

export interface VariableCollectionRecord {
  key: string;
  name: string;
  modes: string[];
  defaultMode: string;
}

export interface Snapshot {
  schema: string;
  /** Excluded from every hash and from the diff — informational only. */
  meta: {
    generatedAt: string;
    pluginVersion: string;
    fileName: string;
    /**
     * File key, so a `nodeId` can be turned into a URL without a human pasting
     * one. Absent when Figma withholds it (public plugins on some plans).
     */
    fileKey?: string;
    counts: Record<string, number>;
  };
  components: ComponentRecord[];
  styles: StyleRecord[];
  variableCollections: VariableCollectionRecord[];
  variables: VariableRecord[];
}

export type ChangeKind = "added" | "removed" | "renamed" | "modified";

export interface DiffEntry {
  kind: ChangeKind;
  key: string;
  name: string;
  previousName?: string;
  /** Dot/bracket paths into the record that differ, with before/after values. */
  changes: FieldChange[];
}

export interface FieldChange {
  path: string;
  before?: unknown;
  after?: unknown;
}

export interface DiffReport {
  schema: string;
  base: { fileName: string; generatedAt: string };
  head: { fileName: string; generatedAt: string };
  summary: Record<string, number>;
  components: DiffEntry[];
  styles: DiffEntry[];
  variables: DiffEntry[];
}

export interface PluginMessage {
  type: MessageTypes;
  command?: PluginCommands;
  editorType?: string;
  /** Snapshot build options from the UI. */
  options?: SnapshotOptions;
  snapshot?: Snapshot;
  probe?: ProbeResult;
  scanned?: number;
  total?: number;
  stage?: string;
  error?: string;
}

export interface SnapshotOptions {
  /** How deep into each component's subtree to serialize. */
  depth: number;
  includeStyles: boolean;
  includeVariables: boolean;
  /** Include absolute pixel sizes. Off by default — resizes are usually noise. */
  includeSizes: boolean;
}
