/// <reference types="@figma/plugin-typings" />

import {
  ComponentPropertyRecord,
  ComponentRecord,
  SNAPSHOT_SCHEMA,
  Snapshot,
  SnapshotOptions,
  StyleRecord,
  VariableCollectionRecord,
  VariableRecord,
} from "../types.d";
import { byField, hashValue, round, styleKeyFromId } from "../utils/stable";
import { createContext, serializeNode, SerializeContext } from "./serializeNode";

export const PLUGIN_VERSION = "0.1.0";

export type ProgressFn = (stage: string, scanned: number, total: number) => void;

export const DEFAULT_OPTIONS: SnapshotOptions = {
  depth: 6,
  includeStyles: true,
  includeVariables: true,
  includeSizes: false,
};

export async function buildSnapshot(
  options: SnapshotOptions = DEFAULT_OPTIONS,
  onProgress: ProgressFn = () => {},
): Promise<Snapshot> {
  // `documentAccess: dynamic-page` means pages are lazily loaded; a document-wide
  // search would otherwise only see the page the user happens to be on.
  await figma.loadAllPagesAsync();

  const ctx = createContext({ depth: options.depth, includeSizes: options.includeSizes });

  const components = await collectComponents(ctx, onProgress);
  const styles = options.includeStyles ? await collectStyles(onProgress) : [];
  const { collections, variables } = options.includeVariables
    ? await collectVariables(onProgress)
    : { collections: [], variables: [] };

  return {
    schema: SNAPSHOT_SCHEMA,
    meta: {
      generatedAt: new Date().toISOString(),
      pluginVersion: PLUGIN_VERSION,
      fileName: figma.root.name,
      counts: {
        components: components.filter((c) => c.type === "COMPONENT").length,
        componentSets: components.filter((c) => c.type === "COMPONENT_SET").length,
        variants: components.reduce((sum, c) => sum + Object.keys(c.variants ?? {}).length, 0),
        styles: styles.length,
        variableCollections: collections.length,
        variables: variables.length,
      },
    },
    components,
    styles,
    variableCollections: collections,
    variables,
  };
}

async function collectComponents(ctx: SerializeContext, onProgress: ProgressFn): Promise<ComponentRecord[]> {
  const found = figma.root.findAllWithCriteria({ types: ["COMPONENT", "COMPONENT_SET"] });
  // Variants are reported through their parent set, never as top-level entries.
  const roots = found.filter((node) => !(node.type === "COMPONENT" && node.parent?.type === "COMPONENT_SET"));

  const records: ComponentRecord[] = [];
  for (let i = 0; i < roots.length; i++) {
    const node = roots[i];
    onProgress("components", i, roots.length);
    records.push(await serializeComponentRoot(node, ctx));
  }
  onProgress("components", roots.length, roots.length);

  return records.sort(byField((record) => record.key || record.name));
}

async function serializeComponentRoot(
  node: ComponentNode | ComponentSetNode,
  ctx: SerializeContext,
): Promise<ComponentRecord> {
  const record: ComponentRecord = {
    key: node.key,
    name: node.name,
    path: nodePath(node),
    type: node.type,
    description: node.description ?? "",
    documentationLinks: (node.documentationLinks ?? []).map((link) => link.uri).sort(),
    properties: serializePropertyDefinitions(node.componentPropertyDefinitions),
    structure: { type: node.type, name: node.name, props: {} },
    hash: "",
  };

  if (node.type === "COMPONENT_SET") {
    // Set-level props only (padding/fills on the set frame are cosmetic but do
    // get published, so they still belong in the snapshot).
    record.structure = await serializeNode(node, { ...ctx, depth: 0 });
    delete record.structure.children;
    record.structure.truncated = undefined;

    record.variants = {};
    for (const variant of [...node.children].sort(byField((child) => child.name))) {
      if (variant.type !== "COMPONENT") continue;
      const structure = await serializeNode(variant, ctx);
      record.variants[variant.name] = {
        key: variant.key,
        hash: hashValue(structure),
        structure,
      };
    }
  } else {
    record.structure = await serializeNode(node, ctx);
  }

  record.hash = hashValue({
    key: record.key,
    name: record.name,
    type: record.type,
    description: record.description,
    documentationLinks: record.documentationLinks,
    properties: record.properties,
    variants: record.variants,
    structure: record.structure,
  });

  return record;
}

function serializePropertyDefinitions(
  definitions: ComponentPropertyDefinitions,
): Record<string, ComponentPropertyRecord> {
  const out: Record<string, ComponentPropertyRecord> = {};
  for (const name of Object.keys(definitions ?? {}).sort()) {
    const definition = definitions[name];
    const record: ComponentPropertyRecord = { type: definition.type };
    if (definition.defaultValue !== undefined) record.defaultValue = definition.defaultValue;
    if (definition.variantOptions) record.variantOptions = [...definition.variantOptions].sort();
    if (definition.preferredValues) {
      record.preferredValues = definition.preferredValues.map((value) => `${value.type}:${value.key}`).sort();
    }
    out[name] = record;
  }
  return out;
}

/** `Page / Section / Frame` — human orientation only, excluded from the hash. */
function nodePath(node: BaseNode): string {
  const parts: string[] = [];
  let current: BaseNode | null = node.parent;
  while (current && current.type !== "DOCUMENT") {
    parts.unshift(current.name);
    current = current.parent;
  }
  return parts.join(" / ");
}

async function collectStyles(onProgress: ProgressFn): Promise<StyleRecord[]> {
  onProgress("styles", 0, 1);

  const [paints, texts, effects, grids] = await Promise.all([
    figma.getLocalPaintStylesAsync(),
    figma.getLocalTextStylesAsync(),
    figma.getLocalEffectStylesAsync(),
    figma.getLocalGridStylesAsync(),
  ]);

  const records: StyleRecord[] = [];
  for (const style of paints) records.push(styleRecord(style, "PAINT", { paints: style.paints }));
  for (const style of texts) {
    records.push(
      styleRecord(style, "TEXT", {
        fontName: style.fontName,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        textCase: style.textCase,
        textDecoration: style.textDecoration,
        paragraphSpacing: style.paragraphSpacing,
        paragraphIndent: style.paragraphIndent,
        listSpacing: style.listSpacing,
        hangingPunctuation: style.hangingPunctuation,
        hangingList: style.hangingList,
        leadingTrim: style.leadingTrim,
        boundVariables: style.boundVariables ? Object.keys(style.boundVariables).sort() : undefined,
      }),
    );
  }
  for (const style of effects) records.push(styleRecord(style, "EFFECT", { effects: style.effects }));
  for (const style of grids) records.push(styleRecord(style, "GRID", { layoutGrids: style.layoutGrids }));

  onProgress("styles", 1, 1);
  return records.sort(byField((record) => `${record.type}:${record.key || record.name}`));
}

function styleRecord(style: BaseStyle, type: StyleRecord["type"], value: unknown): StyleRecord {
  const normalizedValue = roundNumbers(value);
  return {
    key: style.key || styleKeyFromId(style.id) || style.id,
    name: style.name,
    type,
    description: style.description ?? "",
    value: normalizedValue,
    hash: hashValue({ name: style.name, description: style.description ?? "", value: normalizedValue }),
  };
}

async function collectVariables(
  onProgress: ProgressFn,
): Promise<{ collections: VariableCollectionRecord[]; variables: VariableRecord[] }> {
  onProgress("variables", 0, 1);

  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = await figma.variables.getLocalVariablesAsync();

  // Aliases point at variable ids; resolving them to names keeps the snapshot
  // readable and stable when Figma reissues ids.
  const nameById = new Map<string, string>();
  for (const variable of variables) nameById.set(variable.id, variable.name);

  const collectionById = new Map(collections.map((collection) => [collection.id, collection]));

  const collectionRecords: VariableCollectionRecord[] = collections
    .map((collection) => ({
      key: collection.key,
      name: collection.name,
      modes: collection.modes.map((mode) => mode.name).sort(),
      defaultMode: collection.modes.find((mode) => mode.modeId === collection.defaultModeId)?.name ?? "",
    }))
    .sort(byField((record) => record.key || record.name));

  const variableRecords: VariableRecord[] = [];
  for (const variable of variables) {
    const collection = collectionById.get(variable.variableCollectionId);
    const valuesByMode: Record<string, unknown> = {};
    for (const mode of collection?.modes ?? []) {
      const raw = variable.valuesByMode[mode.modeId];
      valuesByMode[mode.name] = serializeVariableValue(raw, nameById);
    }

    variableRecords.push({
      key: variable.key,
      name: variable.name,
      collection: collection?.name ?? "",
      resolvedType: variable.resolvedType,
      scopes: [...variable.scopes].sort(),
      codeSyntax: variable.codeSyntax as Record<string, string>,
      description: variable.description ?? "",
      valuesByMode,
      hash: hashValue({
        name: variable.name,
        collection: collection?.name ?? "",
        resolvedType: variable.resolvedType,
        scopes: [...variable.scopes].sort(),
        codeSyntax: variable.codeSyntax,
        description: variable.description ?? "",
        valuesByMode,
      }),
    });
  }

  onProgress("variables", 1, 1);
  return {
    collections: collectionRecords,
    variables: variableRecords.sort(byField((record) => `${record.collection}/${record.name}`)),
  };
}

function serializeVariableValue(value: VariableValue | undefined, nameById: Map<string, string>): unknown {
  if (value === undefined) return undefined;
  if (typeof value === "object" && value !== null && "type" in value && value.type === "VARIABLE_ALIAS") {
    const alias = value as VariableAlias;
    return `{${nameById.get(alias.id) ?? `unresolved:${alias.id}`}}`;
  }
  if (typeof value === "object" && value !== null && "r" in value) {
    const color = value as RGBA;
    const to255 = (v: number) => Math.round(v * 255);
    const hex = [to255(color.r), to255(color.g), to255(color.b)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    const alpha = color.a === undefined ? 1 : round(color.a, 3);
    return alpha === 1 ? `#${hex}` : `#${hex}/${alpha}`;
  }
  return value;
}

/** Floats from Figma carry rendering noise; rounding keeps diffs meaningful. */
function roundNumbers(value: unknown): unknown {
  if (typeof value === "number") return round(value, 4);
  if (Array.isArray(value)) return value.map(roundNumbers);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = roundNumbers(item);
    }
    return out;
  }
  return value;
}
