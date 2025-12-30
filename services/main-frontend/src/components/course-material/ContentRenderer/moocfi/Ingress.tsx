"use client"
import { css } from "@emotion/css"
import React from "react"

import { BlockRendererProps } from ".."
import { parseText } from "../../ContentRenderer/util/textParsing"

import ParsedText from "@/components/ParsedText"
import { GlossaryContext } from "@/contexts/course-material/GlossaryContext"
import { baseTheme, headingFont, primaryFont } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface IngressBlockAttributes {
  title: string
  subtitle: string
}

const Ingress: React.FC<React.PropsWithChildren<BlockRendererProps<IngressBlockAttributes>>> = (
  props,
) => {
  const textColor = baseTheme.colors.gray[700]

  return (
    <div
      className={css`
        margin-top: 5rem;
        margin-bottom: 4rem;
      `}
    >
      {props.data.attributes.title && (
        <ParsedText
          text={props.data.attributes.title}
          tag="h2"
          tagProps={{
            className: css`
              color: ${textColor};
              font-weight: 700;
              font-size: 3.5rem;
              line-height: 4.375rem;
              margin-bottom: 1rem;
              letter-spacing: -1;
              font-family: ${headingFont};
            `,
          }}
          useWrapperElement={true}
        />
      )}
      <ParsedText
        text={props.data.attributes.subtitle}
        tag="h3"
        tagProps={{
          className: css`
            color: ${textColor};
            font-weight: normal;
            font-size: 1.75rem;
            line-height: 1.35;
            font-family: ${primaryFont};
          `,
        }}
        useWrapperElement={true}
      />
    </div>
  )
}

export default withErrorBoundary(Ingress)
