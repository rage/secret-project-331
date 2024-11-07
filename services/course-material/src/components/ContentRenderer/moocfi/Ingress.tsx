import { css } from "@emotion/css"
import React, { useContext } from "react"

import { BlockRendererProps } from ".."
import { GlossaryContext } from "../../../contexts/GlossaryContext"
import { parseText } from "../../ContentRenderer/util/textParsing"

import { headingFont, primaryFont } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface IngressBlockAttributes {
  title: string
  subtitle: string
}

const Ingress: React.FC<React.PropsWithChildren<BlockRendererProps<IngressBlockAttributes>>> = (
  props,
) => {
  const { terms } = useContext(GlossaryContext)
  return (
    <div
      className={css`
        margin-top: 5rem;
        margin-bottom: 4rem;
      `}
    >
      {props.data.attributes.title && (
        <h2
          className={css`
            color: #1a2333;
            font-weight: 700;
            font-size: 3.5rem;
            line-height: 4.375rem;
            margin-bottom: 1rem;
            letter-spacing: -1;
            font-family: ${headingFont};
          `}
          dangerouslySetInnerHTML={{
            __html: parseText(props.data.attributes.title, terms).parsedText,
          }}
        />
      )}
      <h3
        className={css`
          color: #1a2333;
          font-weight: normal;
          font-size: 1.75rem;
          line-height: 1.35;
          font-family: ${primaryFont};
        `}
        dangerouslySetInnerHTML={{
          __html: parseText(props.data.attributes.subtitle, terms).parsedText,
        }}
      />
    </div>
  )
}

export default withErrorBoundary(Ingress)
