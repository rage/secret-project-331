import { css } from "@emotion/css"
import React, { useContext } from "react"

import { BlockRendererProps } from ".."
import { GlossaryContext } from "../../../contexts/GlossaryContext"
import { baseTheme, monospaceFont } from "../../../shared-module/styles"
import { respondToOrLarger } from "../../../shared-module/styles/respond"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import { parseText } from "../util/textParsing"

interface HighlightBoxAttributes {
  title: string
  content: string
}

const HightlightBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<HighlightBoxAttributes>>
> = (props) => {
  const { terms } = useContext(GlossaryContext)
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
        <div
          className={css`
            max-width: 48rem;
            margin-left: auto;
            margin-right: auto;
            padding: 0rem 1.375rem;
            ${respondToOrLarger.md} {
              padding: 0rem;
            }
          `}
        >
          <span
            className={css`
              color: ${baseTheme.colors.green[700]};
              font-weight: 700;
              font-family: ${monospaceFont};
            `}
            dangerouslySetInnerHTML={{
              __html: parseText(props.data.attributes.title, terms).parsedText,
            }}
          />

          <span
            dangerouslySetInnerHTML={{
              __html: parseText(props.data.attributes.content, terms).parsedText,
            }}
          />
        </div>
      </div>
    </>
  )
}

export default withErrorBoundary(HightlightBlock)
