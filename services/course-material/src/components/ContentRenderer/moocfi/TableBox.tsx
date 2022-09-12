import { css } from "@emotion/css"
import React, { useId } from "react"

import { BlockRendererProps } from ".."
import { baseTheme, headingFont, primaryFont } from "../../../shared-module/styles"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import InnerBlocks from "../util/InnerBlocks"

interface Cell {
  content: string
  tag: string
}

const TableBox: React.FC<React.PropsWithChildren<BlockRendererProps<unknown>>> = (props) => {
  return (
    <div
      className={css`
        margin: 1rem 0;
      `}
    >
      <div
        className={css`
          background-color: ${baseTheme.colors.green[200]};
          margin: 1rem 0;
          min-height: 100%;
          padding-bottom: 6px;
          overflow-x: auto;
        `}
      >
        <InnerBlocks parentBlockProps={props} />
      </div>
    </div>
  )
}

export default withErrorBoundary(TableBox)
