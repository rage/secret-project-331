import { css } from "@emotion/css"
import React, { useContext } from "react"

import { BlockRendererProps } from ".."
import { GlossaryContext } from "../../../contexts/GlossaryContext"
import { baseTheme, monospaceFont } from "../../../shared-module/styles"
import { respondToOrLarger } from "../../../shared-module/styles/respond"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import { sanitizeCourseMaterialHtml } from "../../../utils/sanitizeCourseMaterialHtml"

interface InstructionBoxAttributes {
  content: string
}

const InstructionBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<InstructionBoxAttributes>>
> = (props) => {
  return (
    <>
      <div
        className={css`
          padding: 1rem 1.5rem;
          background-color: #f2f7fc;
          margin: 1rem 0;
          border: 2px #9783c5 dashed;
        `}
      >
        <div
          className={css`
            max-width: 48rem;
            margin-left: auto;
            margin-right: auto;
            padding: 0rem 1.375rem;

            span {
              font-size: 18px;

              ${respondToOrLarger.md} {
                font-size: 20px;
              }
            }
            ${respondToOrLarger.md} {
              padding: 0rem;
            }
          `}
        >
          <span
            dangerouslySetInnerHTML={{
              __html: sanitizeCourseMaterialHtml(props.data.attributes.content),
            }}
          />
        </div>
      </div>
    </>
  )
}

export default withErrorBoundary(InstructionBlock)
