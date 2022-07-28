import { css } from "@emotion/css"
import React from "react"

import { BlockRendererProps } from ".."
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import InnerBlocks from "../util/InnerBlocks"

interface AsideBlockProps {
  backgroundColor: string
  separatorColor: string
}

const AsideBLock: React.FC<React.PropsWithChildren<BlockRendererProps<AsideBlockProps>>> = (
  props,
) => {
  return (
    <div
      className={css`
        padding: 2rem;
        border-top: 0.4rem solid ${props.data.attributes.separatorColor};
        border-bottom: 0.4rem solid ${props.data.attributes.separatorColor};
        background: ${props.data.attributes.backgroundColor};
        margin: 3rem 0;

        h1,
        h2,
        h3,
        h4,
        h5,
        h6 {
          margin-top: 0;
        }
      `}
    >
      <InnerBlocks parentBlockProps={props} />
    </div>
  )
}

export default withErrorBoundary(AsideBLock)
