import { InnerBlocks } from "@wordpress/block-editor"
import React from "react"

const CongratulationsSave: React.FC<React.PropsWithChildren<unknown>> = () => {
  return (
    <div>
      <InnerBlocks.Content />
    </div>
  )
}

export default CongratulationsSave
