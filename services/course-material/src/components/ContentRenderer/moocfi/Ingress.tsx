import { css } from "@emotion/css"
import React from "react"

import { BlockRendererProps } from ".."

import { headingFont, primaryFont } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface InfoBoxBlockAttributes {
  title: string
  subtitle: boolean
}

const Ingress: React.FC<React.PropsWithChildren<BlockRendererProps<InfoBoxBlockAttributes>>> = (
  props,
) => {
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
            color: ##1a2333;
            font-weight: 700;
            font-size: 3.5rem;
            line-height: 4.375rem;
            margin-bottom: 1rem;
            letter-spacing: -1;
            font-family: ${headingFont};
          `}
        >
          {props.data.attributes.title}
        </h2>
      )}
      <h3
        className={css`
          color: ##1a2333;
          font-weight: normal;
          font-size: 1.75rem;
          line-height: 1.35;
          font-family: ${primaryFont};
        `}
      >
        {props.data.attributes.subtitle}
      </h3>
    </div>
  )
}

export default withErrorBoundary(Ingress)
