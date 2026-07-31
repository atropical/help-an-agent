export const SNAPSHOT_SCHEMA = "help-an-agent/design-system-snapshot@1";

export enum PluginCommands {
  SNAPSHOT = "snapshot",
  DIFF = "diff",
}

export enum MessageTypes {
  BASIC_INFO = "basic-info",
  BUILD_SNAPSHOT = "build-snapshot",
  SNAPSHOT_PROGRESS = "snapshot-progress",
  SNAPSHOT_RESULT = "snapshot-result",
  SNAPSHOT_ERROR = "snapshot-error",
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
  variants?: Record<string, { key: string; hash: string; structure: SerializedNode }>;
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
