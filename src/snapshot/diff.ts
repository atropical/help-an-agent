import {
  ChangeKind,
  ComponentRecord,
  DiffEntry,
  DiffReport,
  FieldChange,
  SNAPSHOT_SCHEMA,
  Snapshot,
  StyleRecord,
  VariableRecord,
} from "../types.d";
import { byField, stableStringify } from "../utils/stable";

interface Identified {
  key: string;
  name: string;
  hash: string;
}

/**
 * Compares two snapshots of the same library. Records are matched on publish
 * key first — that survives renames, which is exactly the case an agent tends
 * to misread as "component deleted and a new one added".
 */
export function diffSnapshots(base: Snapshot, head: Snapshot): DiffReport {
  const components = diffCollection(base.components, head.components);
  const styles = diffCollection(base.styles, head.styles);
  const variables = diffCollection(base.variables, head.variables);

  const all = [...components, ...styles, ...variables];

  return {
    schema: SNAPSHOT_SCHEMA,
    base: { fileName: base.meta.fileName, generatedAt: base.meta.generatedAt },
    head: { fileName: head.meta.fileName, generatedAt: head.meta.generatedAt },
    summary: {
      added: all.filter((entry) => entry.kind === "added").length,
      removed: all.filter((entry) => entry.kind === "removed").length,
      renamed: all.filter((entry) => entry.kind === "renamed").length,
      modified: all.filter((entry) => entry.kind === "modified").length,
      componentsChanged: components.length,
      stylesChanged: styles.length,
      variablesChanged: variables.length,
    },
    components,
    styles,
    variables,
  };
}

function diffCollection<T extends Identified>(baseItems: T[], headItems: T[]): DiffEntry[] {
  const baseByKey = indexBy(baseItems);
  const headByKey = indexBy(headItems);
  const entries: DiffEntry[] = [];

  for (const [key, headItem] of headByKey) {
    const baseItem = baseByKey.get(key);
    if (!baseItem) {
      entries.push({ kind: "added", key, name: headItem.name, changes: [] });
      continue;
    }
    if (baseItem.hash === headItem.hash) continue;

    const changes = diffRecords(baseItem, headItem);
    // A component's root node carries the same name, so a plain rename shows up
    // on both paths. Anything beyond those two is a real change.
    const renamedOnly =
      changes.length > 0 && changes.every((change) => RENAME_PATHS.has(change.path));
    const kind: ChangeKind = renamedOnly ? "renamed" : "modified";
    entries.push({
      kind,
      key,
      name: headItem.name,
      previousName: baseItem.name !== headItem.name ? baseItem.name : undefined,
      changes,
    });
  }

  for (const [key, baseItem] of baseByKey) {
    if (!headByKey.has(key)) {
      entries.push({ kind: "removed", key, name: baseItem.name, changes: [] });
    }
  }

  return entries.sort(byField((entry) => `${entry.kind}:${entry.name}`));
}

/**
 * A record with no publish key is unpublished; falling back to `name` keeps it
 * comparable, at the cost of reading a rename as add + remove.
 */
function indexBy<T extends Identified>(items: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) map.set(item.key || `name:${item.name}`, item);
  return map;
}

const IGNORED_FIELDS = new Set(["hash", "path"]);
const RENAME_PATHS = new Set(["name", "structure.name"]);

function diffRecords(base: Identified, head: Identified): FieldChange[] {
  const changes: FieldChange[] = [];
  walk(base as unknown, head as unknown, "", changes);
  return changes.filter((change) => !IGNORED_FIELDS.has(change.path)).sort(byField((change) => change.path));
}

const MAX_CHANGES = 200;

function walk(before: unknown, after: unknown, path: string, changes: FieldChange[]): void {
  if (changes.length >= MAX_CHANGES) return;

  const leafPath = path || "(root)";
  if (before === after) return;

  const bothObjects =
    before !== null && after !== null && typeof before === "object" && typeof after === "object";

  if (!bothObjects) {
    changes.push({ path: leafPath, before, after });
    return;
  }

  if (Array.isArray(before) !== Array.isArray(after)) {
    changes.push({ path: leafPath, before, after });
    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    // Arrays here are ordered by construction (children, fills, effects), so
    // index-wise comparison is the honest reading of "what moved or changed".
    const length = Math.max(before.length, after.length);
    for (let i = 0; i < length; i++) {
      walk(before[i], after[i], `${path}[${i}]`, changes);
    }
    return;
  }

  const beforeObject = before as Record<string, unknown>;
  const afterObject = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(beforeObject), ...Object.keys(afterObject)]);
  for (const key of Array.from(keys).sort()) {
    if (!path && IGNORED_FIELDS.has(key)) continue;
    walk(beforeObject[key], afterObject[key], path ? `${path}.${key}` : key, changes);
  }
}

/** Compact one-line rendering of a changed value for the Markdown report. */
export function formatValue(value: unknown): string {
  if (value === undefined) return "—";
  if (typeof value === "string") return value.length > 80 ? `${value.slice(0, 77)}…` : value;
  const serialized = stableStringify(value);
  return serialized.length > 80 ? `${serialized.slice(0, 77)}…` : serialized;
}

export type AnyRecord = ComponentRecord | StyleRecord | VariableRecord;
