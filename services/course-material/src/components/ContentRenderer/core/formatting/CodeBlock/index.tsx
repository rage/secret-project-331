import { css } from "@emotion/css"
import dynamic from "next/dynamic"
import { useMemo } from "react"

import { BlockRendererProps } from "../../.."
import { CodeAttributes } from "../../../../../../types/GutenbergBlockAttributes"

import { CopyButton } from "./CopyButton"
import { replaceBrTagsWithNewlines } from "./utils"

import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import Spinner from "@/shared-module/common/components/Spinner"
import { monospaceFont } from "@/shared-module/common/styles"
import { copyString } from "@/shared-module/common/utils/strings"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const SyntaxHighlightedContainerLoading = <Spinner variant="medium" />

const SyntaxHighlightedContainer = dynamic(() => import("./SyntaxHighlightedContainer"), {
  ssr: true,
  loading: () => SyntaxHighlightedContainerLoading,
})

const containerStyles = css`
  position: relative;
  max-width: 1000px;
  margin: 0 auto;
`

const getPreStyles = (fontSizePx: number, allowFullWidth: boolean) => css`
  margin-top: 0;
  font-size: ${fontSizePx}px;
  font-family: ${monospaceFont} !important;
  line-height: 1.75rem;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  padding: 16px;
  ${allowFullWidth &&
  `
    margin-top: -1.5rem;
    margin-bottom: -1.5rem;
  `}
`

/**
 * Renders a code block with syntax highlighting and a copy button.
 * Adjusts font size based on the longest line of code.
 */
const CodeBlock: React.FC<React.PropsWithChildren<BlockRendererProps<CodeAttributes>>> = ({
  data,
  dontAllowBlockToBeWiderThanContainerWidth,
}) => {
  const { content } = data.attributes

  const fontSizePx = useMemo(() => {
    const longestLine = (content ?? "")
      .split("\n")
      .reduce((acc, line) => Math.max(acc, line.length), 0)
    return longestLine > 100 ? 14 : longestLine > 70 ? 16 : 20
  }, [content])

  return (
    <BreakFromCentered sidebar={false}>
      <div className={containerStyles}>
        {content && <CopyButton content={content} />}
        <pre
          className={getPreStyles(fontSizePx, dontAllowBlockToBeWiderThanContainerWidth ?? false)}
        >
          <SyntaxHighlightedContainer content={content} />
        </pre>
      </div>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(CodeBlock)
