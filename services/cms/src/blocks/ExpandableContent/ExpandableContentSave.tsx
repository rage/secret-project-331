import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"

const ExpendableContentSave: React.FC<unknown> = () => {
  return (
    <div>
      <InnerBlocks.Content />
    </div>
  )
}

export default ExpendableContentSave
