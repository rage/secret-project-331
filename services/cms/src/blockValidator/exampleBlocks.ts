import { PAGE_TYPES, type PageType } from "@/blocks/pageTypes"

// Free of editor imports, so the validator tests can use these on the schema export.

/** A block in the schema export's examples and templates, which carry no client ids. */
export interface ExampleBlock {
  name: string
  attributes: Record<string, unknown>
  innerBlocks: ExampleBlock[]
}

/** Example blocks as a validation request takes them; ids are `<prefix>-<index>`, nested alike. */
export const withClientIds = (blocks: ExampleBlock[], prefix: string): unknown[] =>
  blocks.map((block, index) => ({
    clientId: `${prefix}-${index}`,
    name: block.name,
    attributes: block.attributes,
    innerBlocks: withClientIds(block.innerBlocks, `${prefix}-${index}`),
  }))

/** Validated blocks back as example blocks. */
export const withoutClientIds = (blocks: unknown[]): ExampleBlock[] =>
  (blocks as (ExampleBlock & { clientId?: string; isValid?: boolean })[]).map((block) => ({
    name: block.name,
    attributes: block.attributes,
    innerBlocks: withoutClientIds(block.innerBlocks),
  }))

/** The first page type where a block can be written, to validate its example on. */
export const pageTypeOf = (
  pageTypes: Readonly<Record<string, readonly string[]>>,
  name: string,
): PageType => PAGE_TYPES.find((pageType) => pageTypes[pageType]?.includes(name)) ?? "course-page"
