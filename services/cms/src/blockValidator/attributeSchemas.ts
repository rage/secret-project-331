/* oxlint-disable i18next/no-literal-string */

import { allowedBlockVariants } from "@/blocks/supportedGutenbergBlocks"
import type { BlockType } from "@/utils/Gutenberg/types"

import { NON_INTERACTIVE_FORMATS, type RichTextFormat, TOOLBAR_FORMATS } from "./richText"

type JsonType = "string" | "number" | "integer" | "boolean" | "array" | "object" | "null"

/** The JSON Schema subset attribute schemas use; `x-` keywords carry checks JSON Schema can't. */
export interface AttributeSchema {
  type?: JsonType | JsonType[]
  enum?: unknown[]
  default?: unknown
  description?: string
  items?: AttributeSchema
  properties?: Record<string, AttributeSchema>
  required?: string[]
  additionalProperties?: boolean
  minimum?: number
  maximum?: number
  maxItems?: number
  maxProperties?: number
  pattern?: string
  /** "uri-reference" values must also be http(s), mailto, tel or relative URLs. */
  format?: "uri-reference"
  /** Rich text: validated and normalised as the editor stores it. */
  "x-rich-text"?: true
  contentMediaType?: "text/html"
  "x-rich-text-formats"?: readonly RichTextFormat[]
  /** A Vega-Lite spec as a JSON string, which must render. */
  "x-vega-lite-spec"?: true
}

interface GutenbergAttribute {
  type?: string | string[]
  source?: string
  default?: unknown
  enum?: unknown[]
  role?: string
  query?: Record<string, GutenbergAttribute>
}

/** Why agents may not write an attribute, phrased as the fix. */
const FORBIDDEN_ATTRIBUTES: Record<string, string> = {
  style:
    "Remove `style`; free-form style objects aren't accepted. Use the block's own attributes, such as textColor or fontSize, where it has them.",
  metadata: "Remove `metadata`; block bindings, names and overrides aren't accepted.",
  allowedBlocks:
    "Remove `allowedBlocks`; what a block may contain comes from its registration (see allowed_children).",
}

const FORBIDDEN_ROLE_FIX = "Remove it; it only holds a temporary upload in the editor."

const URL_ATTRIBUTES = new Set([
  "url",
  "href",
  "src",
  "poster",
  "textLinkHref",
  "dataFileUrl",
  "backgroundImage",
  "backgroundImageMedium",
  "backgroundImageLarge",
  "backgroundImageXLarge",
  "exercise_iframe_url",
])

const CSS_CLASS_LIST = "^-?[A-Za-z_][A-Za-z0-9_-]*( -?[A-Za-z_][A-Za-z0-9_-]*)*$"

/** Refinements for attributes Gutenberg registers by name on many blocks. */
const SHARED_REFINEMENTS: Record<string, AttributeSchema> = {
  className: { type: "string", pattern: CSS_CLASS_LIST },
  anchor: { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_:.-]*$" },
  lock: {
    type: "object",
    properties: { move: { type: "boolean" }, remove: { type: "boolean" } },
    additionalProperties: false,
  },
  layout: {
    type: "object",
    properties: {
      type: { type: "string", enum: ["default", "flow", "constrained", "flex", "grid"] },
      justifyContent: {
        type: "string",
        enum: ["left", "center", "right", "space-between", "stretch"],
      },
      orientation: { type: "string", enum: ["horizontal", "vertical"] },
      flexWrap: { type: "string", enum: ["wrap", "nowrap"] },
      verticalAlignment: {
        type: "string",
        enum: ["top", "center", "bottom", "space-between", "stretch"],
      },
    },
    additionalProperties: false,
  },
}

const LEGACY_EMPTY: AttributeSchema = {
  type: "string",
  enum: [""],
  description: "Legacy attribute; leave it empty and use inner blocks.",
}

/**
 * Constraints the editor's UI enforces but the registration doesn't state, keyed by
 * `<block name>.<attribute>`.
 */
const BLOCK_REFINEMENTS: Record<string, AttributeSchema> = {
  "core/heading.level": { type: "integer", minimum: 1, maximum: 6 },
  "core/heading.levelOptions": {
    type: "array",
    items: { type: "integer", minimum: 1, maximum: 6 },
  },
  "core/image.focalPoint": {
    type: "object",
    properties: {
      x: { type: "number", minimum: 0, maximum: 1 },
      y: { type: "number", minimum: 0, maximum: 1 },
    },
    required: ["x", "y"],
    additionalProperties: false,
  },
  "core/image.lightbox": {
    type: "object",
    properties: { enabled: { type: "boolean" } },
    additionalProperties: false,
  },
  "core/embed.providerNameSlug": { type: "string", enum: allowedBlockVariants["core/embed"] ?? [] },
  "core/list.values": LEGACY_EMPTY,
  "core/quote.value": LEGACY_EMPTY,
  "moocfi/conditional-block.module_completion": { type: "array", items: { type: "string" } },
  "moocfi/conditional-block.instance_enrollment": { type: "array", items: { type: "string" } },
  "moocfi/chart.spec": { type: "string", "x-vega-lite-spec": true },
}

/** Rich-text fields Gutenberg renders with `withoutInteractiveFormatting`, so links are out. */
const NON_INTERACTIVE_FIELDS = new Set([
  "core/button.text",
  "core/file.fileName",
  "core/file.downloadButtonText",
])

const isRichText = (attribute: GutenbergAttribute): boolean =>
  attribute.type === "rich-text" || attribute.source === "html" || attribute.source === "rich-text"

const JSON_TYPES = new Set<string>([
  "string",
  "number",
  "integer",
  "boolean",
  "array",
  "object",
  "null",
])

const toJsonType = (type: string | string[] | undefined): JsonType | JsonType[] | undefined => {
  if (Array.isArray(type)) {
    return type.filter((item): item is JsonType => JSON_TYPES.has(item))
  }
  return type !== undefined && JSON_TYPES.has(type) ? (type as JsonType) : undefined
}

const convertAttribute = (fieldKey: string, attribute: GutenbergAttribute): AttributeSchema => {
  if (isRichText(attribute)) {
    const schema: AttributeSchema = {
      type: "string",
      "x-rich-text": true,
      contentMediaType: "text/html",
      "x-rich-text-formats": NON_INTERACTIVE_FIELDS.has(fieldKey)
        ? NON_INTERACTIVE_FORMATS
        : TOOLBAR_FORMATS,
    }
    if (attribute.default !== undefined) {
      schema.default = attribute.default
    }
    return schema
  }
  const schema: AttributeSchema = {}
  const type = toJsonType(attribute.type)
  if (type !== undefined) {
    schema.type = type
  }
  if (attribute.enum) {
    schema.enum = attribute.enum
  }
  if (attribute.query) {
    schema.type = "array"
    schema.items = {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(attribute.query).map(([key, nested]) => [
          key,
          convertAttribute(`${fieldKey}.${key}`, nested),
        ]),
      ),
      additionalProperties: false,
    }
  } else if (type === "array") {
    schema.maxItems = 0
  } else if (type === "object") {
    schema.maxProperties = 0
  }
  if (type === "string" && URL_ATTRIBUTES.has(fieldKey.split(".").at(-1) ?? "")) {
    schema.format = "uri-reference"
  }
  if (attribute.default !== undefined) {
    schema.default = attribute.default
  }
  return schema
}

export interface BlockAttributeSchemas {
  /** Attributes agents may write, in registration order. */
  writable: Record<string, AttributeSchema>
  /** Registered attributes agents may not write, with the fix to give. */
  forbidden: Record<string, string>
}

/** Attribute schemas for a registered block, from its registration plus the refinements above. */
export const blockAttributeSchemas = (blockType: BlockType): BlockAttributeSchemas => {
  const writable: Record<string, AttributeSchema> = {}
  const forbidden: Record<string, string> = {}
  const attributes = blockType.attributes as Record<string, GutenbergAttribute>
  for (const [attributeName, attribute] of Object.entries(attributes)) {
    const forbiddenFix =
      FORBIDDEN_ATTRIBUTES[attributeName] ??
      (attribute.role === "local" ? FORBIDDEN_ROLE_FIX : undefined)
    if (forbiddenFix !== undefined) {
      forbidden[attributeName] = forbiddenFix
      continue
    }
    const refinement =
      BLOCK_REFINEMENTS[`${blockType.name}.${attributeName}`] ?? SHARED_REFINEMENTS[attributeName]
    const schema = refinement
      ? { ...refinement }
      : convertAttribute(`${blockType.name}.${attributeName}`, attribute)
    if (attribute.default !== undefined && schema.default === undefined) {
      schema.default = attribute.default
    }
    writable[attributeName] = schema
  }
  return { writable, forbidden }
}
