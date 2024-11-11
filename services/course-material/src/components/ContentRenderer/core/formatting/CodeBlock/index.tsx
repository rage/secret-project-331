import { css } from "@emotion/css"
import dynamic from "next/dynamic"
import { useMemo } from "react"

import { BlockRendererProps } from "../../.."
import { CodeAttributes } from "../../../../../../types/GutenbergBlockAttributes"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import Spinner from "@/shared-module/common/components/Spinner"
import { monospaceFont } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const SyntaxHighlightedContainerLoading = <Spinner variant="medium" />

const SyntaxHighlightedContainer = dynamic(() => import("./SyntaxHighlightedContainer"), {
  ssr: true,
  loading: () => SyntaxHighlightedContainerLoading,
})

const CodeBlock: React.FC<React.PropsWithChildren<BlockRendererProps<CodeAttributes>>> = ({
  data,
  dontAllowBlockToBeWiderThanContainerWidth,
}) => {
  const { content } = data.attributes
  const fontSizePx = useMemo(() => {
    const longestLine = (content ?? "")
      .split("\n")
      .reduce((acc, line) => (line.length > acc ? line.length : acc), 0)

    let fontSizePx = 20
    if (longestLine > 70) {
      fontSizePx = 16
    }
    if (longestLine > 100) {
      fontSizePx = 14
    }
    return fontSizePx
  }, [content])

  return (
    <BreakFromCentered sidebar={false} disabled={dontAllowBlockToBeWiderThanContainerWidth}>
      <pre
        className={css`
          max-width: 1000px;
          margin: 0 auto;
          ${dontAllowBlockToBeWiderThanContainerWidth &&
          // If this is inside a container, large margins don't look good.
          `margin-top: -1.5rem;
            margin-bottom: -1.5rem;
            `}
          font-size: ${fontSizePx}px;
          font-family: ${monospaceFont} !important;
          line-height: 1.75rem;
          white-space: pre-wrap;
          overflow-wrap: break-word;
        `}
      >
        <SyntaxHighlightedContainer content={content} />
      </pre>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(CodeBlock)
