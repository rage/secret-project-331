/* oxlint-disable i18next/no-literal-string */

import { type AttributeSchema, JSON_TYPES, type JsonType } from "@/utils/Gutenberg/agentSchema"
import type { BlockType, CmsBlockAttribute } from "@/utils/Gutenberg/types"

import { BLOCK_REFINEMENTS, SHARED_REFINEMENTS, TEXT_ALIGN_STYLE } from "./attributeRefinements"
import { NON_INTERACTIVE_FORMATS, TOOLBAR_FORMATS } from "./richText"

/** Why agents may not write an attribute, phrased as the fix. */
const FORBIDDEN_ATTRIBUTES: Record<string, string> = {
  style:
    "Remove `style`; free-form style objects aren't accepted. Use the block's own attributes, such as textColor or fontSize, where it has them.",
  metadata: "Remove `metadata`; block bindings, names and overrides aren't accepted.",
  allowedBlocks:
    "Remove `allowedBlocks`; what a block may contain comes from its registration (see allowed_children).",
}

const supportsTextAlign = (blockType: BlockType): boolean => {
  const supports = blockType.supports as { typography?: { textAlign?: unknown } } | undefined
  return Boolean(supports?.typography?.textAlign)
}

const FORBIDDEN_ROLE_FIX = "Remove it; it only holds a temporary upload in the editor."

/** Core block attributes holding a URL; custom blocks set `agentSchema: URL_REFERENCE`. */
const URL_ATTRIBUTES = new Set(["url", "href", "src", "poster", "textLinkHref"])

/** Rich-text fields Gutenberg renders with `withoutInteractiveFormatting`, so links are out. */
const NON_INTERACTIVE_FIELDS = new Set([
  "core/button.text",
  "core/file.fileName",
  "core/file.downloadButtonText",
])

const isRichText = (attribute: CmsBlockAttribute): boolean =>
  attribute.isRichText === true ||
  attribute.type === "rich-text" ||
  attribute.source === "html" ||
  attribute.source === "rich-text"

const isJsonType = (type: string): type is JsonType =>
  (JSON_TYPES as readonly string[]).includes(type)

const toJsonType = (type: string | string[] | undefined): JsonType | JsonType[] | undefined => {
  if (Array.isArray(type)) {
    return type.filter((item) => isJsonType(item))
  }
  return type !== undefined && isJsonType(type) ? type : undefined
}

/**
 * The schema of a registered attribute or query field: the registration's `agentSchema`, a
 * refinement, or one derived from its type, with the registered default.
 */
const schemaFor = (
  fieldKey: string,
  attribute: CmsBlockAttribute,
  sharedRefinement?: AttributeSchema,
): AttributeSchema => {
  const schema =
    attribute.agentSchema ??
    BLOCK_REFINEMENTS[fieldKey] ??
    sharedRefinement ??
    convertAttribute(fieldKey, attribute)
  return attribute.default === undefined || schema.default !== undefined
    ? schema
    : { ...schema, default: attribute.default }
}

const convertAttribute = (fieldKey: string, attribute: CmsBlockAttribute): AttributeSchema => {
  if (isRichText(attribute)) {
    return {
      type: "string",
      "x-rich-text": true,
      contentMediaType: "text/html",
      "x-rich-text-formats": NON_INTERACTIVE_FIELDS.has(fieldKey)
        ? NON_INTERACTIVE_FORMATS
        : TOOLBAR_FORMATS,
    }
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
          schemaFor(`${fieldKey}.${key}`, nested),
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
  return schema
}

export interface BlockAttributeSchemas {
  /** Attributes agents may write, in registration order. */
  writable: Record<string, AttributeSchema>
  /** Registered attributes agents may not write, with the fix to give. */
  forbidden: Record<string, string>
}

/** Attribute schemas for a registered block, from its registration and the refinements. */
export const blockAttributeSchemas = (blockType: BlockType): BlockAttributeSchemas => {
  const writable: Record<string, AttributeSchema> = {}
  const forbidden: Record<string, string> = {}
  for (const [attributeName, attribute] of Object.entries<CmsBlockAttribute>(
    blockType.attributes,
  )) {
    if (attributeName === "style" && supportsTextAlign(blockType)) {
      writable[attributeName] = TEXT_ALIGN_STYLE
      continue
    }
    const forbiddenFix =
      FORBIDDEN_ATTRIBUTES[attributeName] ??
      (attribute.role === "local" ? FORBIDDEN_ROLE_FIX : undefined)
    if (forbiddenFix !== undefined) {
      forbidden[attributeName] = forbiddenFix
      continue
    }
    writable[attributeName] = schemaFor(
      `${blockType.name}.${attributeName}`,
      attribute,
      SHARED_REFINEMENTS[attributeName],
    )
  }
  return { writable, forbidden }
}
