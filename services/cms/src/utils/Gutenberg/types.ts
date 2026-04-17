import type { ComponentType } from "react"
import type {
  Block as GutenbergBlock,
  BlockAttribute,
  BlockCategory,
  BlockConfiguration as GutenbergBlockConfiguration,
  BlockDeprecation as GutenbergBlockDeprecation,
  BlockEditProps as GutenbergBlockEditProps,
  BlockSaveProps as GutenbergBlockSaveProps,
  BlockType as GutenbergBlockType,
  BlockVariation as GutenbergBlockVariation,
} from "@wordpress/blocks"

type UnknownAttributes = Record<string, unknown>
type CreateBlock = typeof import("@wordpress/blocks").createBlock
type CreateBlocksFromInnerBlocksTemplate =
  typeof import("@wordpress/blocks").createBlocksFromInnerBlocksTemplate

type BlockAttributeMap<Attributes extends object> = {
  [Key in keyof Attributes]: BlockAttribute
}

type UpstreamBlockInstance = ReturnType<CreateBlock>

export type BlockInstance<Attributes extends object = any> = Omit<
  UpstreamBlockInstance,
  "attributes" | "innerBlocks"
> & {
  attributes: Attributes
  innerBlocks: BlockInstance[]
}

export type BlockSaveProps<Attributes extends object = any> = Omit<
  GutenbergBlockSaveProps<UnknownAttributes>,
  "attributes"
> & {
  attributes: Attributes
}

export type BlockEditProps<Attributes extends object = any> = Omit<
  GutenbergBlockEditProps<UnknownAttributes>,
  "attributes" | "setAttributes"
> & {
  attributes: Attributes
  setAttributes: (
    attrs: Partial<Attributes> | ((prevAttrs: Attributes) => Partial<Attributes>),
  ) => void
}

export type BlockVariation<Attributes extends object = any> = Omit<
  GutenbergBlockVariation<UnknownAttributes>,
  "attributes" | "isActive"
> & {
  attributes?: Attributes
  isActive?: ((blockAttributes: Attributes, variationAttributes: Attributes) => boolean) | string[]
}

export type BlockDeprecation<
  NewAttributes extends object = any,
  OldAttributes extends object = NewAttributes,
> = Omit<
  GutenbergBlockDeprecation<UnknownAttributes, UnknownAttributes>,
  "attributes" | "save" | "isEligible" | "migrate"
> & {
  attributes: BlockAttributeMap<OldAttributes>
  save: ComponentType<BlockSaveProps<OldAttributes>>
  isEligible?: (attributes: OldAttributes, innerBlocks: BlockInstance[]) => boolean
  migrate?: (
    attributes: OldAttributes,
    innerBlocks: BlockInstance[],
  ) => NewAttributes | [NewAttributes, BlockInstance[]]
}

export type BlockConfiguration<Attributes extends object = any> = Omit<
  GutenbergBlockConfiguration<UnknownAttributes>,
  | "attributes"
  | "deprecated"
  | "edit"
  | "save"
  | "variations"
  | "providesContext"
  | "getEditWrapperProps"
  | "merge"
  | "__experimentalLabel"
> & {
  attributes: BlockAttributeMap<Attributes>
  deprecated?: BlockDeprecation<Attributes, object>[]
  edit?: ComponentType<BlockEditProps<Attributes>>
  save: ComponentType<BlockSaveProps<Attributes>>
  variations?: BlockVariation<Attributes>[]
  providesContext?: Record<string, keyof Attributes>
  getEditWrapperProps?: (attrs: Attributes) => Record<string, string | number | boolean>
  merge?: (attributes: Attributes, attributesToMerge: Attributes) => Partial<Attributes>
  __experimentalLabel?: (attributes: Attributes, options: { context: string }) => string
}

export type BlockType<Attributes extends object = any> = Omit<
  GutenbergBlockType<UnknownAttributes>,
  | "attributes"
  | "deprecated"
  | "edit"
  | "save"
  | "variations"
  | "providesContext"
  | "getEditWrapperProps"
  | "merge"
  | "__experimentalLabel"
> & {
  attributes: BlockAttributeMap<Attributes>
  deprecated?: BlockDeprecation<Attributes, object>[]
  edit?: ComponentType<BlockEditProps<Attributes>>
  save: ComponentType<BlockSaveProps<Attributes>>
  variations?: BlockVariation<Attributes>[]
  providesContext?: Record<string, keyof Attributes>
  getEditWrapperProps?: (attrs: Attributes) => Record<string, string | number | boolean>
  merge?: (attributes: Attributes, attributesToMerge: Attributes) => Partial<Attributes>
  __experimentalLabel?: (attributes: Attributes, options: { context: string }) => string
}

export type Category = BlockCategory

type UpstreamTemplateInput = NonNullable<Parameters<CreateBlocksFromInnerBlocksTemplate>[0]>

export type Template = Exclude<UpstreamTemplateInput[number], GutenbergBlock<UnknownAttributes>>

export type TemplateArray = Template[]
