import { css } from "@emotion/css"
import React from "react"

import { BlockRendererProps } from ".."
import Centered from "../../../shared-module/components/Centering/Centered"
import { baseTheme, monospaceFont } from "../../../shared-module/styles"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

interface HighlightBoxAttributes {
  title: string
  content: string
}

const HightlightBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<HighlightBoxAttributes>>
> = (props) => {
  return (
    <>
      <div
        className={css`
          padding: 1.5rem;
          background-color: #fafbfb;
          margin: 1rem 0;
          border: 1px solid #e2e4e6;
        `}
      >
        <Centered variant="narrow">
          <span
            className={css`
              color: ${baseTheme.colors.green[700]};
              font-weight: 700;
              font-family: ${monospaceFont};
            `}
          >
            {props.data.attributes.title}
          </span>
          <span>{props.data.attributes.content}</span>
        </Centered>
      </div>
    </>
  )
}

export default withErrorBoundary(HightlightBlock)
