import { DiffEntry, DiffReport, Snapshot } from "../types.d";
import { formatValue } from "./diff";

/**
 * The Markdown report is the artefact an agent reads. It is deliberately flat
 * and heading-heavy: an agent grepping for a component name should land on
 * everything it needs without parsing JSON.
 */
export function snapshotToMarkdown(snapshot: Snapshot): string {
  const lines: string[] = [];
  const { meta } = snapshot;

  lines.push(`# Design system snapshot — ${meta.fileName}`, "");
  lines.push(`- Generated: ${meta.generatedAt}`);
  lines.push(`- Schema: \`${snapshot.schema}\``);
  if (meta.fileKey) lines.push(`- File key: \`${meta.fileKey}\``);
  for (const [name, count] of Object.entries(meta.counts)) {
    lines.push(`- ${name}: ${count}`);
  }
  lines.push("");

  lines.push("## Components", "");
  lines.push("| Component | Type | Variants | Properties | Hash |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const component of snapshot.components) {
    const variantCount = Object.keys(component.variants ?? {}).length;
    const properties = Object.keys(component.properties);
    lines.push(
      `| ${escape(component.name)} | ${component.type} | ${variantCount || "—"} | ${
        properties.length ? escape(properties.join(", ")) : "—"
      } | \`${component.hash}\` |`,
    );
  }
  lines.push("");

  for (const component of snapshot.components) {
    lines.push(`### ${escape(component.name)}`, "");
    lines.push(`- Key: \`${component.key || "(unpublished)"}\``);
    lines.push(`- Node: ${nodeReference(component.nodeId, meta.fileKey, meta.fileName)}`);
    lines.push(`- Location: ${escape(component.path) || "—"}`);
    lines.push(`- Hash: \`${component.hash}\``);
    if (component.description) lines.push(`- Description: ${escape(component.description)}`);
    for (const link of component.documentationLinks) lines.push(`- Docs: ${link}`);

    const propertyNames = Object.keys(component.properties);
    if (propertyNames.length > 0) {
      lines.push("", "Properties:", "");
      for (const name of propertyNames) {
        const property = component.properties[name];
        const options = property.variantOptions ? ` — options: ${property.variantOptions.join(" | ")}` : "";
        const preferred = property.preferredValues ? ` — preferred: ${property.preferredValues.join(", ")}` : "";
        lines.push(
          `- \`${escape(name)}\` (${property.type}), default: ${formatValue(property.defaultValue)}${options}${preferred}`,
        );
      }
    }

    const variants = component.variants ?? {};
    const variantNames = Object.keys(variants);
    if (variantNames.length > 0) {
      lines.push("", "Variants:", "");
      for (const name of variantNames) {
        lines.push(
          `- \`${escape(name)}\` — node \`${variants[name].nodeId}\`, hash \`${variants[name].hash}\``,
        );
      }
    }
    lines.push("");
  }

  if (snapshot.variableCollections.length > 0) {
    lines.push("## Variables", "");
    for (const collection of snapshot.variableCollections) {
      lines.push(`### ${escape(collection.name)} (modes: ${collection.modes.join(", ")})`, "");
      const members = snapshot.variables.filter((variable) => variable.collection === collection.name);
      lines.push(`| Variable | Type | ${collection.modes.map(escape).join(" | ")} |`);
      lines.push(`| --- | --- | ${collection.modes.map(() => "---").join(" | ")} |`);
      for (const variable of members) {
        const values = collection.modes.map((mode) => formatValue(variable.valuesByMode[mode]));
        lines.push(`| ${escape(variable.name)} | ${variable.resolvedType} | ${values.map(escape).join(" | ")} |`);
      }
      lines.push("");
    }
  }

  if (snapshot.styles.length > 0) {
    lines.push("## Styles", "");
    lines.push("| Style | Type | Hash |");
    lines.push("| --- | --- | --- |");
    for (const style of snapshot.styles) {
      lines.push(`| ${escape(style.name)} | ${style.type} | \`${style.hash}\` |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function diffToMarkdown(report: DiffReport): string {
  const lines: string[] = [];

  lines.push(`# Design system diff — ${report.head.fileName}`, "");
  lines.push(`- Base: ${report.base.generatedAt}`);
  lines.push(`- Head: ${report.head.generatedAt}`);
  lines.push(
    `- Summary: ${report.summary.added} added, ${report.summary.removed} removed, ` +
      `${report.summary.renamed} renamed, ${report.summary.modified} modified`,
  );
  lines.push("");

  if (report.components.length + report.styles.length + report.variables.length === 0) {
    lines.push("No changes.", "");
    return lines.join("\n");
  }

  section(lines, "Components", report.components);
  section(lines, "Styles", report.styles);
  section(lines, "Variables", report.variables);

  return lines.join("\n");
}

function section(lines: string[], title: string, entries: DiffEntry[]): void {
  if (entries.length === 0) return;
  lines.push(`## ${title}`, "");

  for (const entry of entries) {
    const renamed = entry.previousName ? ` (was \`${escape(entry.previousName)}\`)` : "";
    lines.push(`### ${kindLabel(entry.kind)} ${escape(entry.name)}${renamed}`, "");
    lines.push(`- Key: \`${entry.key}\``);

    if (entry.changes.length > 0) {
      lines.push("", "| Field | Before | After |", "| --- | --- | --- |");
      for (const change of entry.changes) {
        lines.push(
          `| \`${escape(change.path)}\` | ${escape(formatValue(change.before))} | ${escape(formatValue(change.after))} |`,
        );
      }
    }
    lines.push("");
  }
}

function kindLabel(kind: DiffEntry["kind"]): string {
  switch (kind) {
    case "added":
      return "➕ Added:";
    case "removed":
      return "➖ Removed:";
    case "renamed":
      return "✏️ Renamed:";
    default:
      return "🔄 Modified:";
  }
}

/**
 * A node id alone is enough for the MCP tools; with a file key it also becomes
 * a link a human can open, which is the difference between "go find this in
 * Figma" and a click.
 */
function nodeReference(nodeId: string, fileKey: string | undefined, fileName: string): string {
  if (!nodeId) return "—";
  if (!fileKey) return `\`${nodeId}\``;
  const slug = encodeURIComponent(fileName.replace(/\s+/g, "-"));
  return `[\`${nodeId}\`](https://www.figma.com/design/${fileKey}/${slug}?node-id=${encodeURIComponent(nodeId)}&m=dev)`;
}

/** Pipes break Markdown tables and backticks break inline code spans. */
function escape(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/`/g, "'").replace(/\n/g, " ");
}
