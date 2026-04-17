declare module "@wordpress/blocks" {
  export type Template = any[]
  export type TemplateArray = any[]
  export type BlockInstance<Attributes = any> = any
  export type Block<Attributes = any> = any
  export type BlockVariation<Attributes = any> = any
  export type BlockEditProps<Attributes = any> = any
  export type BlockSaveProps<Attributes = any> = any
  export type BlockDeprecation<NewAttributes = any, OldAttributes = any> = any
  export type BlockConfiguration<Attributes = any> = any
  export type Category = any

  export function createBlock(
    name: string,
    attributes?: Record<string, unknown>,
    innerBlocks?: BlockInstance[],
  ): BlockInstance
  export function getBlockType(name: string): Block | undefined
  export function getBlockTypes(): Block[]
  export function unregisterBlockType(name: string): void
  export function registerBlockType(name: string, settings: BlockConfiguration): unknown
  export function registerBlockVariation(...args: unknown[]): unknown
  export function unregisterBlockVariation(...args: unknown[]): unknown
  export function getCategories(): Category[]
  export function setCategories(categories: readonly Category[]): void
  export function registerBlockStyle(...args: unknown[]): unknown
  export function unregisterBlockStyle(...args: unknown[]): unknown
  export function serialize(blocks: BlockInstance[]): string
}
