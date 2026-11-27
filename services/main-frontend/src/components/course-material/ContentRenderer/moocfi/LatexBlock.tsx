"use client"

import { css } from "@emotion/css"
import { renderToString } from "katex"
import { useTranslation } from "react-i18next"

import "katex/dist/katex.min.css"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { ScrollRegion } from "@/shared-module/components"

import type { BlockRendererProps } from ".."

export interface TextAttributes {
  text: string
}

const KATEX_OUTPUT_FORMAT = "htmlAndMathml"

const scrollerStyles = css`
  overflow-x: auto;
  /* KaTeX boxes stick out a pixel or two vertically, which would add a vertical scrollbar. */
  overflow-y: hidden;
  padding-block: 0.25rem;

  .katex-display {
    margin: 0;
  }

  /* KaTeX pins the equation number to the right edge on top of the formula; in flow it can't overlap. */
  .katex-display > .katex > .katex-html:has(> .katex-tag) {
    display: flex;
    align-items: baseline;

    > .katex-base:first-child,
    > .katex-tag {
      margin-left: auto;
    }

    > .katex-tag {
      position: static;
      padding-left: 1em;
    }
  }
`

const LatexBlock: React.FC<React.PropsWithChildren<BlockRendererProps<TextAttributes>>> = ({
  data,
}) => {
  const { t } = useTranslation()
  const html = renderToString(data.attributes.text, {
    throwOnError: false,
    displayMode: true,
    output: KATEX_OUTPUT_FORMAT,
  })
  return (
    <ScrollRegion className={scrollerStyles} label={t("formula")}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </ScrollRegion>
  )
}

export default withErrorBoundary(LatexBlock)
