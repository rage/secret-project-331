// Block registrations and the editor-free validator bundle both import this, so no editor imports.

/** The rich-text formats agents may write, named as Gutenberg registers them. */
export type RichTextFormat =
  | "core/bold"
  | "core/italic"
  | "core/link"
  | "core/code"
  | "core/strikethrough"
  | "core/underline"
  | "core/text-color"
  | "core/subscript"
  | "core/superscript"
  | "core/keyboard"
  | "core/language"
  | "core/math"

/** The JSON types an attribute schema can name. */
export const JSON_TYPES = [
  "string",
  "number",
  "integer",
  "boolean",
  "array",
  "object",
  "null",
] as const

export type JsonType = (typeof JSON_TYPES)[number]

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

/** A `#rgb`, `#rrggbb` or `#rrggbbaa` colour, as a regular expression source. */
export const HEX_COLOR = "#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})"

// The renderer interpolates colours into CSS, so a free string could inject page-wide styles.
/** A hex colour or empty. */
export const HEX_COLOR_OR_EMPTY: AttributeSchema = {
  type: "string",
  pattern: `^(?:${HEX_COLOR})?$`,
}

/** A URL a link, image or embed may point to. */
export const URL_REFERENCE: AttributeSchema = { type: "string", format: "uri-reference" }
