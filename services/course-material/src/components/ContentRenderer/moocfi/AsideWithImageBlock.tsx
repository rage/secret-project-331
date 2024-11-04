import { css } from "@emotion/css"
import React, { useContext } from "react"

import { BlockRendererProps } from ".."
import { GlossaryContext } from "../../../contexts/GlossaryContext"
import InnerBlocks from "../util/InnerBlocks"
import { parseText } from "../util/textParsing"

import { primaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface InfoBoxBlockAttributes {
  title: string
  content: string
  image: string
}

const TerminologyBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<InfoBoxBlockAttributes>>
> = (props) => {
  const { terms } = useContext(GlossaryContext)
  return (
    <div
      className={css`
        width: 100%;
        padding: 0 0 4rem 0;
        display: grid;
        grid-template-columns: 1fr;
        row-gap: 2rem;
        border-bottom: 2px solid #eaedf0;

        ${respondToOrLarger.sm} {
          grid-template-columns: 0.2fr 1fr;
          column-gap: 2.5rem;
        }

        div:first-of-type {
          width: 150px;
          height: 150px;
          border-radius: 100%;
          object-fit: none;
          overflow: hidden;
          margin: 0;
          figure {
            width: 7.5rem;
            aspect-ratio: 1/1;
            margin: 0;

            img {
              width: 9.375rem;
              height: 9.375rem;
              margin: 0;
            }
          }
        }

        p {
          margin: 0 !important;
          font-size: 1.125rem;
          line-height: 160%;
        }

        h4 {
          font-weight: 600;
          line-height: 140%;
          font-family: ${primaryFont};
          margin-bottom: 1.125rem;
          font-weight: 550;
          font-size: 1.5rem;
          color: #1a2333;
        }
      `}
    >
      <InnerBlocks parentBlockProps={props} />
      <div>
        <h4
          dangerouslySetInnerHTML={{
            __html: parseText(props.data.attributes.title, terms).parsedText,
          }}
        />
        <p
          className={css`
            font-size: 1rem;
            line-height: 100%;
            font-weight: 400;
          `}
        >
          {props.data.attributes.content}
        </p>
      </div>
    </div>
  )
}

export default withErrorBoundary(TerminologyBlock)
