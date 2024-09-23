import { css } from "@emotion/css"
import React from "react"

import { BlockRendererProps } from "../.."
import InnerBlocks from "../../util/InnerBlocks"

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface RevealableContentProps {
  backgroundColor: string
  separatorColor: string
}

const RevealableHiddenContentBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<RevealableContentProps>>
> = (props) => {
  return (
    <div
      className={css`
        padding: 2rem;
        border-radius: 4px;
        background: #ffffff80;
        border: 2px dashed #718dbfcc;
      `}
    >
      <InnerBlocks parentBlockProps={props} />
    </div>
  )
}

export default withErrorBoundary(RevealableHiddenContentBlock)
