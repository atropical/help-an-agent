/// <reference types="@figma/plugin-typings" />

import { SerializedNode } from "../types.d";
import { hashValue, round, styleKeyFromId } from "../utils/stable";

export interface SerializeContext {
  /** How many levels below the component root to walk before truncating. */
  depth: number;
  /** Absolute width/height are usually resize noise, so they are opt-in. */
  includeSizes: boolean;
  /** Variable id -> "Collection/Variable Name", resolved lazily and cached. */
  variableNames: Map<string, string>;
}

export function createContext(overrides: Partial<SerializeContext> = {}): SerializeContext {
  return {
    depth: 6,
    includeSizes: false,
    variableNames: new Map(),
    ...overrides,
  };
}

export async function serializeNode(
  node: SceneNode,
  ctx: SerializeContext,
  level = 0,
): Promise<SerializedNode> {
  const serialized: SerializedNode = {
    type: node.type,
    name: node.name,
    props: await collectProps(node, ctx),
  };

  if (node.visible === false) serialized.hidden = true;

  if ("children" in node && node.children.length > 0) {
    if (level >= ctx.depth) {
      // Record that something was cut rather than silently reporting a leaf —
      // otherwise a deep change would look like "no change" in the diff.
      serialized.truncated = true;
      serialized.props.childCount = node.children.length;
    } else {
      serialized.children = [];
      for (const child of node.children) {
        serialized.children.push(await serializeNode(child, ctx, level + 1));
      }
    }
  }

  return serialized;
}

async function collectProps(node: SceneNode, ctx: SerializeContext): Promise<Record<string, unknown>> {
  const props: Record<string, unknown> = {};
  const put = (key: string, value: unknown) => {
    if (value === undefined || value === null) return;
    props[key] = value;
  };

  // --- Auto layout & sizing -------------------------------------------------
  if ("layoutMode" in node && node.layoutMode !== "NONE") {
    put("layoutMode", node.layoutMode);
    put("layoutWrap", node.layoutWrap);
    put("primaryAxisAlignItems", node.primaryAxisAlignItems);
    put("counterAxisAlignItems", node.counterAxisAlignItems);
    put("primaryAxisSizingMode", node.primaryAxisSizingMode);
    put("counterAxisSizingMode", node.counterAxisSizingMode);
    put("itemSpacing", mixedOr(node.itemSpacing, (v) => round(v)));
    if (node.layoutWrap === "WRAP") put("counterAxisSpacing", node.counterAxisSpacing);
    put("padding", [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft].map((v) => round(v)));
    put("itemReverseZIndex", node.itemReverseZIndex || undefined);
    put("strokesIncludedInLayout", node.strokesIncludedInLayout || undefined);
  }
  if ("layoutSizingHorizontal" in node) {
    put("layoutSizing", [node.layoutSizingHorizontal, node.layoutSizingVertical]);
  }
  if ("layoutPositioning" in node && node.layoutPositioning === "ABSOLUTE") {
    put("layoutPositioning", node.layoutPositioning);
  }
  if ("layoutAlign" in node) put("layoutAlign", node.layoutAlign);
  if ("layoutGrow" in node && node.layoutGrow !== 0) put("layoutGrow", node.layoutGrow);
  if ("constraints" in node) put("constraints", [node.constraints.horizontal, node.constraints.vertical]);
  if ("minWidth" in node) {
    put("minWidth", nonNull(node.minWidth));
    put("maxWidth", nonNull(node.maxWidth));
    put("minHeight", nonNull(node.minHeight));
    put("maxHeight", nonNull(node.maxHeight));
  }
  if (ctx.includeSizes && "width" in node) {
    put("size", [round(node.width), round(node.height)]);
  }

  // --- Appearance -----------------------------------------------------------
  if ("opacity" in node && node.opacity !== 1) put("opacity", round(node.opacity, 3));
  if ("blendMode" in node && node.blendMode !== "PASS_THROUGH") put("blendMode", node.blendMode);
  if ("isMask" in node && node.isMask) put("isMask", true);
  if ("clipsContent" in node) put("clipsContent", node.clipsContent);

  if ("fills" in node) put("fills", mixedOr(node.fills, (v) => v.map(serializePaint)));
  if ("strokes" in node && node.strokes.length > 0) {
    put("strokes", node.strokes.map(serializePaint));
    put("strokeWeight", mixedOr(node.strokeWeight, (v) => round(v)));
    put("strokeAlign", node.strokeAlign);
    if (node.dashPattern.length > 0) put("dashPattern", node.dashPattern);
    if ("strokeCap" in node) put("strokeCap", mixedOr(node.strokeCap, (v) => v));
  }
  if ("effects" in node && node.effects.length > 0) {
    put("effects", node.effects.map(serializeEffect));
  }
  if ("cornerRadius" in node) {
    put("cornerRadius", mixedOr(node.cornerRadius, (v) => round(v)));
    if (node.cornerRadius === figma.mixed && "topLeftRadius" in node) {
      put("corners", [node.topLeftRadius, node.topRightRadius, node.bottomRightRadius, node.bottomLeftRadius].map((v) => round(v)));
    }
  }

  // --- Style references -----------------------------------------------------
  // Keys, not ids: a style id embeds a local node reference that churns.
  if ("fillStyleId" in node) put("fillStyle", mixedOr(node.fillStyleId, styleKeyFromId));
  if ("strokeStyleId" in node) put("strokeStyle", styleKeyFromId(node.strokeStyleId));
  if ("effectStyleId" in node) put("effectStyle", styleKeyFromId(node.effectStyleId));
  if ("gridStyleId" in node) put("gridStyle", styleKeyFromId(node.gridStyleId));

  // --- Variables ------------------------------------------------------------
  if ("boundVariables" in node && node.boundVariables) {
    const bound = await serializeBoundVariables(node.boundVariables as Record<string, unknown>, ctx);
    if (Object.keys(bound).length > 0) put("boundVariables", bound);
  }
  if ("inferredVariables" in node) {
    // Deliberately skipped: inferred (not bound) variables are a UI hint and
    // flip based on unrelated edits elsewhere in the file.
  }

  // --- Text -----------------------------------------------------------------
  if (node.type === "TEXT") {
    put("characters", node.characters);
    put("textAlign", [node.textAlignHorizontal, node.textAlignVertical]);
    put("textAutoResize", node.textAutoResize);
    put("textTruncation", node.textTruncation);
    put("maxLines", nonNull(node.maxLines));
    put("paragraphSpacing", node.paragraphSpacing);
    put("paragraphIndent", node.paragraphIndent);
    put("textStyle", mixedOr(node.textStyleId, styleKeyFromId));
    // Styled segments capture per-range typography, which is the only way to
    // express a text node whose scalar props read as `figma.mixed`.
    put("segments", node.getStyledTextSegments([
      "fontName",
      "fontSize",
      "fontWeight",
      "lineHeight",
      "letterSpacing",
      "textCase",
      "textDecoration",
      "textStyleId",
      "fillStyleId",
      "listOptions",
      "indentation",
      "hyperlink",
    ]).map((segment) => ({
      characters: segment.characters,
      fontName: segment.fontName,
      fontSize: segment.fontSize,
      fontWeight: segment.fontWeight,
      lineHeight: segment.lineHeight,
      letterSpacing: segment.letterSpacing,
      textCase: segment.textCase,
      textDecoration: segment.textDecoration,
      textStyle: styleKeyFromId(segment.textStyleId),
      fillStyle: styleKeyFromId(segment.fillStyleId),
      listOptions: segment.listOptions,
      indentation: segment.indentation,
      hyperlink: segment.hyperlink,
    })));
  }

  // --- Instances ------------------------------------------------------------
  if (node.type === "INSTANCE") {
    const main = await node.getMainComponentAsync();
    put("mainComponent", main ? { key: main.key, name: main.name, remote: main.remote } : { missing: true });
    put("componentProperties", serializeComponentProperties(node.componentProperties));
    if (node.overrides.length > 0) {
      // Override *targets* are node ids, which mean nothing across files — the
      // set of overridden fields is the part that carries diff signal.
      const fields = new Set<string>();
      for (const override of node.overrides) {
        for (const field of override.overriddenFields) fields.add(field);
      }
      put("overriddenFields", Array.from(fields).sort());
      put("overrideCount", node.overrides.length);
    }
    put("exposedInstanceCount", node.exposedInstances.length || undefined);
  }

  if ("componentPropertyReferences" in node && node.componentPropertyReferences) {
    put("componentPropertyReferences", node.componentPropertyReferences);
  }

  // --- Vectors --------------------------------------------------------------
  // Path data is large and rarely read by a human; a hash still flags a change.
  if ("vectorPaths" in node) {
    put("vectorPathsHash", hashValue(node.vectorPaths.map((path) => ({ data: path.data, windingRule: path.windingRule }))));
  }

  if ("layoutGrids" in node && node.layoutGrids.length > 0) put("layoutGrids", node.layoutGrids);

  return props;
}

function serializePaint(paint: Paint): unknown {
  const base: Record<string, unknown> = { type: paint.type };
  if (paint.visible === false) base.visible = false;
  if (paint.opacity !== undefined && paint.opacity !== 1) base.opacity = round(paint.opacity, 3);
  if (paint.blendMode && paint.blendMode !== "NORMAL") base.blendMode = paint.blendMode;

  if (paint.type === "SOLID") {
    base.color = serializeColor(paint.color);
  } else if (paint.type === "IMAGE") {
    base.imageHash = paint.imageHash;
    base.scaleMode = paint.scaleMode;
  } else if (paint.type === "VIDEO") {
    base.videoHash = paint.videoHash;
    base.scaleMode = paint.scaleMode;
  } else if (isGradient(paint)) {
    base.gradientStops = paint.gradientStops.map((stop) => ({
      position: round(stop.position, 4),
      color: serializeColor(stop.color),
    }));
    base.gradientTransform = paint.gradientTransform.map((row) => row.map((v) => round(v, 4)));
  } else {
    // Pattern and shader paints: no stable shorthand, so hash the descriptor.
    base.paintHash = hashValue(paint);
  }

  if ("boundVariables" in paint && paint.boundVariables) {
    base.boundVariables = Object.keys(paint.boundVariables).sort();
  }
  return base;
}

function isGradient(paint: Paint): paint is GradientPaint {
  return (
    paint.type === "GRADIENT_LINEAR" ||
    paint.type === "GRADIENT_RADIAL" ||
    paint.type === "GRADIENT_ANGULAR" ||
    paint.type === "GRADIENT_DIAMOND"
  );
}

function serializeColor(color: RGB | RGBA): string {
  const to255 = (v: number) => Math.round(v * 255);
  const hex = [to255(color.r), to255(color.g), to255(color.b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  const alpha = "a" in color ? round(color.a, 3) : 1;
  return alpha === 1 ? `#${hex}` : `#${hex}/${alpha}`;
}

function serializeEffect(effect: Effect): unknown {
  const base: Record<string, unknown> = { type: effect.type, visible: effect.visible !== false };
  if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
    base.color = serializeColor(effect.color);
    base.offset = [round(effect.offset.x), round(effect.offset.y)];
    base.radius = round(effect.radius);
    base.spread = round(effect.spread ?? 0);
    base.blendMode = effect.blendMode;
    if (effect.type === "DROP_SHADOW") base.showShadowBehindNode = effect.showShadowBehindNode;
  } else if (effect.type === "LAYER_BLUR" || effect.type === "BACKGROUND_BLUR") {
    base.radius = round(effect.radius);
  } else {
    // Noise / texture and any future effect type: hash the whole descriptor so
    // a change is still detected without this file needing to know the shape.
    base.effectHash = hashValue(effect);
  }
  return base;
}

function serializeComponentProperties(properties: ComponentProperties): unknown {
  const out: Record<string, unknown> = {};
  for (const name of Object.keys(properties).sort()) {
    const property = properties[name];
    out[name] = { type: property.type, value: property.value };
  }
  return out;
}

async function serializeBoundVariables(
  boundVariables: Record<string, unknown>,
  ctx: SerializeContext,
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const field of Object.keys(boundVariables).sort()) {
    const binding = boundVariables[field];
    if (!binding) continue;
    if (Array.isArray(binding)) {
      const names = await Promise.all(binding.map((alias) => variableName(alias as VariableAlias, ctx)));
      out[field] = names;
    } else {
      out[field] = await variableName(binding as VariableAlias, ctx);
    }
  }
  return out;
}

async function variableName(alias: VariableAlias, ctx: SerializeContext): Promise<string> {
  if (!alias || typeof alias !== "object" || !("id" in alias)) return "unknown";
  const cached = ctx.variableNames.get(alias.id);
  if (cached) return cached;

  // Works for library variables too, so long as they are used in this file.
  const variable = await figma.variables.getVariableByIdAsync(alias.id);
  const name = variable ? variable.name : `unresolved:${alias.id}`;
  ctx.variableNames.set(alias.id, name);
  return name;
}

/** Unwrap a value that may be `figma.mixed` or absent, mapping the concrete case. */
function mixedOr<T>(value: T | PluginAPI["mixed"] | undefined, map: (value: T) => unknown): unknown {
  if (value === undefined) return undefined;
  return value === figma.mixed ? "mixed" : map(value as T);
}

function nonNull<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}
