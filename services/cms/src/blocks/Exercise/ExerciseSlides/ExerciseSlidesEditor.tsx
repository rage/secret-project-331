"use client"

import { InnerBlocks, useBlockProps } from "@wordpress/block-editor"

import { registeredInnerBlocksProps } from "@/utils/Gutenberg/registeredInnerBlocksProps"
import type { BlockEditProps } from "@/utils/Gutenberg/types"

import { gutenbergControlsHidden } from "../../../styles/EditorStyles"

const ExerciseSlidesEditor: React.FC<BlockEditProps> = ({ name }) => {
  const blockProps = useBlockProps({ className: gutenbergControlsHidden })

  return (
    <div {...blockProps}>
      <InnerBlocks {...registeredInnerBlocksProps(name)} />
    </div>
  )
}

export default ExerciseSlidesEditor
