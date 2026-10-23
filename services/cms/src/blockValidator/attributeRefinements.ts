import { allowedBlockVariants } from "@/blocks/supportedGutenbergBlocks"
import type { AttributeSchema } from "@/utils/Gutenberg/agentSchema"

// Free of editor imports, so the validator tests can use these.

/** Space-separated CSS class names, as a regular expression source. */
export const CSS_CLASS_LIST = "^-?[A-Za-z_][A-Za-z0-9_-]*( -?[A-Za-z_][A-Za-z0-9_-]*)*$"

const PRESET_SLUG: AttributeSchema = { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }
const VERTICAL_ALIGNMENT: AttributeSchema = {
  type: "string",
  enum: ["top", "center", "bottom", "stretch", "space-between"],
}
const HORIZONTAL_ALIGNMENT: AttributeSchema = { type: "string", enum: ["left", "center", "right"] }
const IMAGE_DIMENSION: AttributeSchema = {
  type: "string",
  pattern: "^(?:auto|\\d+(?:\\.\\d+)?(?:px)?)?$",
}
const SPACER_DIMENSION: AttributeSchema = {
  type: "string",
  pattern: "^(?:\\d+(?:\\.\\d+)?(?:px|em|rem|vw|vh)|var:preset\\|spacing\\|[a-z0-9-]+)?$",
}
const TABLE_CELL_REFINEMENTS: Record<string, AttributeSchema> = {
  tag: { type: "string", enum: ["td", "th"] },
  scope: { type: "string", enum: ["row", "col", "rowgroup", "colgroup"] },
  align: HORIZONTAL_ALIGNMENT,
  colspan: { type: "string", pattern: "^[1-9]\\d*$" },
  rowspan: { type: "string", pattern: "^[1-9]\\d*$" },
}

/** Refinements for attributes Gutenberg registers by name on many blocks. */
export const SHARED_REFINEMENTS: Readonly<Record<string, AttributeSchema>> = {
  className: { type: "string", pattern: CSS_CLASS_LIST },
  backgroundColor: PRESET_SLUG,
  textColor: PRESET_SLUG,
  borderColor: PRESET_SLUG,
  gradient: PRESET_SLUG,
  fontFamily: PRESET_SLUG,
  fontSize: PRESET_SLUG,
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
      verticalAlignment: VERTICAL_ALIGNMENT,
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
 * Constraints the editor's UI enforces but core block registrations don't state, keyed by
 * `<block name>.<attribute>`, with `.<field>` added for the fields of query attributes. Custom
 * blocks state theirs in the registration as `agentSchema`.
 */
export const BLOCK_REFINEMENTS: Readonly<Record<string, AttributeSchema>> = {
  ...Object.fromEntries(
    ["head", "body", "foot"].flatMap((section) =>
      Object.entries(TABLE_CELL_REFINEMENTS).map(([field, schema]) => [
        `core/table.${section}.cells.${field}`,
        schema,
      ]),
    ),
  ),
  "core/columns.verticalAlignment": VERTICAL_ALIGNMENT,
  "core/column.verticalAlignment": VERTICAL_ALIGNMENT,
  "core/column.width": {
    type: "string",
    pattern: "^(?:\\d+(?:\\.\\d+)?(?:%|px|em|rem|vw))?$",
  },
  "core/image.width": IMAGE_DIMENSION,
  "core/image.height": IMAGE_DIMENSION,
  "core/image.aspectRatio": {
    type: "string",
    pattern: "^(?:auto|\\d+(?:\\.\\d+)?(?:/\\d+(?:\\.\\d+)?)?)?$",
  },
  "core/image.scale": { type: "string", enum: ["cover", "contain", "fill"] },
  "core/quote.textAlign": HORIZONTAL_ALIGNMENT,
  "core/separator.opacity": { type: "string", enum: ["css", "alpha-channel"] },
  "core/spacer.height": SPACER_DIMENSION,
  "core/spacer.width": SPACER_DIMENSION,
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
}
