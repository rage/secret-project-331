"use client"

import { useBlockProps } from "@wordpress/block-editor"

import RegisteredInnerBlocks from "@/utils/Gutenberg/RegisteredInnerBlocks"

import { gutenbergControlsHidden } from "../../../styles/EditorStyles"

const ExerciseSlidesEditor = () => {
  const blockProps = useBlockProps({ className: gutenbergControlsHidden })

  return (
    <div {...blockProps}>
      <RegisteredInnerBlocks />
    </div>
  )
}

export default ExerciseSlidesEditor
