import { css } from "@emotion/css"
import React, { useContext } from "react"

import { BlockRendererProps } from ".."
import { GlossaryContext } from "../../../contexts/GlossaryContext"
import { parseText } from "../../ContentRenderer/util/textParsing"
import InnerBlocks from "../util/InnerBlocks"

import Centered from "@/shared-module/common/components/Centering/Centered"
import { primaryFont } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface TerminnologyBlockAttributes {
  title: string
  primaryColor: string
  content: string
  blockName: string
}

const TerminologyBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<TerminnologyBlockAttributes>>
> = (props) => {
  const { terms } = useContext(GlossaryContext)
  return (
    <div
      className={css`
        width: 100%;
        padding: 2rem 2rem 4rem 2rem;
        border-left: 8px solid ${props.data.attributes.primaryColor};
        box-shadow: rgba(25, 35, 51, 0.06) 0px 2px 12px 0px;

        p {
          margin: 0 !important;
          font-size: 18px;
          line-height: 160%;
        }

        div {
          margin-bottom: 0 !important;
        }
        h2 {
          margin-top: 1.5rem;
          font-weight: 600;
          font-family: ${primaryFont};
          margin-bottom: 0.8rem;
          font-weight: 600;
          font-size: 30px;
          color: #1a2333;
        }
      `}
    >
      <span
        className={css`
          font-size: 1rem;
          color: ${props.data.attributes.primaryColor};
          line-height: 100%;
          font-weight: 400;
        `}
      >
        {props.data.attributes.blockName}
      </span>
      <h2
        dangerouslySetInnerHTML={{
          __html: parseText(props.data.attributes.title, terms).parsedText,
        }}
      />
      <Centered variant="narrow">
        <InnerBlocks parentBlockProps={props} />
      </Centered>
    </div>
  )
}

export default withErrorBoundary(TerminologyBlock)
