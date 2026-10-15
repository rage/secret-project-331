"use client"

import { InnerBlocks, useBlockProps } from "@wordpress/block-editor"

import type { TemplateArray } from "@/utils/Gutenberg/types"

import { gutenbergControlsHidden } from "../../../styles/EditorStyles"

const ALLOWED_NESTED_BLOCKS = ["moocfi/exercise-slide"]

const INNER_BLOCKS_TEMPLATE: TemplateArray = [["moocfi/exercise-slide", {}]]

const ExerciseSlidesEditor = () => {
  const blockProps = useBlockProps({ className: gutenbergControlsHidden })

  return (
    <div {...blockProps}>
      <InnerBlocks
        allowedBlocks={ALLOWED_NESTED_BLOCKS}
        template={INNER_BLOCKS_TEMPLATE}
        templateLock={false}
      />
    </div>
  )
}

export default ExerciseSlidesEditor
