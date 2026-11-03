import type {
  BlockAttribute,
  BlockCategory,
  Block as GutenbergBlock,
  BlockConfiguration as GutenbergBlockConfiguration,
  BlockDeprecation as GutenbergBlockDeprecation,
  BlockEditProps as GutenbergBlockEditProps,
  BlockSaveProps as GutenbergBlockSaveProps,
  BlockType as GutenbergBlockType,
  BlockVariation as GutenbergBlockVariation,
} from "@wordpress/blocks"
import type { ComponentType } from "react"

import type { AttributeSchema } from "./agentSchema"

/* oxlint-disable typescript/no-explicit-any */
type UnknownAttributes = Record<string, unknown>
type CreateBlock = typeof import("@wordpress/blocks").createBlock
type CreateBlocksFromInnerBlocksTemplate =
  typeof import("@wordpress/blocks").createBlocksFromInnerBlocksTemplate

export type CmsBlockAttribute = BlockAttribute & {
  /**
   * Edited with RichText but stored without `source`: custom saves render only the inner blocks,
   * so a sourced attribute is lost on copy and paste. The agent validator reads this.
   */
  isRichText?: true
  /**
   * The schema agent writes must match, in place of the one the agent validator derives from
   * `type`, for constraints the editor's UI enforces but the type can't state.
   */
  agentSchema?: AttributeSchema
}

type BlockAttributeMap<Attributes extends object> = {
  [Key in keyof Attributes]: CmsBlockAttribute
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
  // `name` is supplied separately at registration (registerBlockType(name, config)),
  // so our config objects omit it even though upstream now requires it.
  | "name"
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
  innerBlocksArea?: InnerBlocksArea
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
  innerBlocksArea?: InnerBlocksArea
}

export type Category = BlockCategory

type UpstreamTemplateInput = NonNullable<Parameters<CreateBlocksFromInnerBlocksTemplate>[0]>

export type Template = Exclude<UpstreamTemplateInput[number], GutenbergBlock<UnknownAttributes>>

export type TemplateArray = Template[]

export type TemplateLock = "all" | "insert" | "contentOnly" | false

/**
 * A custom block's InnerBlocks area. Gutenberg's registration has `allowedBlocks` but no template
 * fields, so these live here for the editor and the headless block validator to share.
 */
export interface InnerBlocksArea {
  template?: TemplateArray
  /** Unset inherits the lock of the enclosing area, as InnerBlocks does. */
  templateLock?: TemplateLock
}
/* oxlint-enable typescript/no-explicit-any */
