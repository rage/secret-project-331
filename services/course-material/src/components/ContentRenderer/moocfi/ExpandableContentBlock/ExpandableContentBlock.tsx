import { css } from "@emotion/css"
import React from "react"

import { BlockRendererProps } from "../.."
import InnerBlocks from "../../util/InnerBlocks"

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface ExpandableContentBlockProps {
  name: string
}

const ExpandableContentBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<ExpandableContentBlockProps>>
> = (props) => {
  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        gap: 6px;
      `}
    >
      {<InnerBlocks parentBlockProps={props} />}
    </div>
  )
}

export default withErrorBoundary(ExpandableContentBlock)
