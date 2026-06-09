"use client"

import { InnerBlocks } from "@wordpress/block-editor"

const ChartBlockSave: React.FC<unknown> = () => {
  return (
    <div>
      <InnerBlocks.Content />
    </div>
  )
}

export default ChartBlockSave
