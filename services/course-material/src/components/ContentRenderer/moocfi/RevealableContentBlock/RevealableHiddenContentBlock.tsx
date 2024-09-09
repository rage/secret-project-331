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

        h1,
        h2,
        h3,
        h4,
        h5,
        h6 {
          margin-top: 0;
        }
        border: 2px solid black;
      `}
    >
      <InnerBlocks parentBlockProps={props} />
    </div>
  )
}

export default withErrorBoundary(RevealableHiddenContentBlock)
