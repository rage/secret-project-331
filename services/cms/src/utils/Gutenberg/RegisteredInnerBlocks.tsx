"use client"

import { InnerBlocks, useBlockEditContext } from "@wordpress/block-editor"
import { getBlockType } from "@wordpress/blocks"
import React from "react"

import type { BlockType } from "./types"

/**
 * InnerBlocks with the registration's template and lock, matching the nesting the block validator
 * accepts. Gutenberg reads `allowedBlocks` from the registration itself.
 */
const RegisteredInnerBlocks: React.FC = () => {
  const { name } = useBlockEditContext()
  const area = (getBlockType(name) as BlockType | undefined)?.innerBlocksArea
  return <InnerBlocks template={area?.template} templateLock={area?.templateLock} />
}

export default RegisteredInnerBlocks
